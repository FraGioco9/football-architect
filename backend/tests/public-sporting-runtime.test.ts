import {seedUnifiedOperator} from './fixtures/unified-operator.ts';
import {clearTestWorld} from './fixtures/test-world.ts';
import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import worker from '../src/index.ts';
import {prepareSeason} from '../src/commands.ts';
import {generateSeasonCalendar} from '../src/calendar-command.ts';
import {executeLifecycle} from '../src/lifecycle-command.ts';
import {closeSeason} from '../src/season-close-command.ts';
import {archiveSeason} from '../src/season-archive-command.ts';
import {proposeEndSeasonMilestones} from '../src/domain/calendar/admin-calendar-policy.ts';
import {resetWorld} from '../src/reset-world-command.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {readWorld} from '../src/world-repository.ts';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {type AdminSession} from '../src/auth.ts';
import {rankLeagueTable} from '../src/league-standings.ts';
import {loadSeasonSportingEvidence} from '../src/season-sporting-evidence.ts';
import {deriveInternationalClubStatus} from '../src/public-sporting-read.ts';
// @ts-expect-error Frontend .mjs contract is intentionally JavaScript-only.
import {projectClubMemberships} from '../../assets/club-season-source.mjs';
const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>;
const meta=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
const request=(competition='IT-1',season='1',method='GET',database=db)=>worker.fetch(new Request('https://example.invalid/api/competitions/'+competition+'/seasons/'+season,{method}),{DB:database});
const clubHistory=(club='IT-1',method='GET')=>worker.fetch(new Request('https://example.invalid/api/clubs/'+club+'/history',{method}),{DB:db});
const clubFixtures=(club='IT-1',season='1',method='GET',database=db,query='')=>
 worker.fetch(new Request('https://example.invalid/api/clubs/'+club+'/seasons/'+season+'/fixtures'+query,{method}),{DB:database});
// Read each season's projection from the one canonical History HTTP response.
const clubOverview=async(club='IT-1',season='1',method='GET')=>{
 const response=await clubHistory(club,method);
 if(!response.ok)return response;
 const batch=await response.json() as any;
 const selected=batch.data?.overviews?.find((row:any)=>row.selectedSeason===Number(season));
 return new Response(JSON.stringify(selected??{error:{code:'not_found'}}),
  {status:selected?200:404,headers:{'content-type':'application/json'}});
};
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await clearTestWorld(db);
 session=(await seedUnifiedOperator(db,'public-operator','public@example.invalid',now,'a'.repeat(64))).session;
 world=await readWorld(db);
});
async function prepare(){world=(await prepareSeason(db,session,meta(),'public-prepare-0001',await loadApprovedSnapshot(),now)).world}
async function calendar(){await prepare();world=(await generateSeasonCalendar(db,session,meta(),'public-calendar-0001',now)).world}
async function through(day:number){world=(await executeLifecycle(db,session,'start',meta(),'public-start-0001',now)).world;while(world.day<day)world=(await executeLifecycle(db,session,'advance',meta(),'public-day-'+(world.day+1)+'-0001',now)).world}
it('tracks INT-24 elimination and advancement only through decisive knockout results',()=>{
 const club='IT-1',opponent='ENG-1';
 const tie=(phaseId:string)=>({phaseId,fixtures:[
  {fixture:{id:phaseId+':1',homeClubId:club,awayClubId:opponent}},
  {fixture:{id:phaseId+':2',homeClubId:opponent,awayClubId:club}}
 ]}) as any;
 const final={phaseId:'final',fixtures:[{fixture:{id:'final:1',homeClubId:club,awayClubId:opponent}}]} as any;
 const playoff=tie('playoffs'),quarter=tie('quarterfinals'),semi=tie('semifinals');
 const results=new Map<string,any>();
 const resolve=(id:string,winnerClubId:string|null)=>results.set(id,{winnerClubId});
 const get=(rank:number,complete=true,plans:any[]=[playoff,quarter,semi,final])=>
  deriveInternationalClubStatus(club,rank,complete,plans,results);
 expect(get(3,false)).toBe(null);
 expect(get(13)).toBe('groupStage');
 expect(get(3,true,[])).toBe('quarterfinals');
 expect(get(7,true,[])).toBe('playoffs');
 resolve('playoffs:1',club);
 expect(get(7)).toBe('playoffs'); // First leg is not the deciding result.
 resolve('playoffs:2',opponent);
 expect(get(7)).toBe('playoffs'); // Eliminated; never advance to quarter-finals.
 resolve('playoffs:2',club);
 expect(get(7)).toBe('quarterfinals');
 resolve('quarterfinals:2',club);
 expect(get(7)).toBe('semifinals');
 resolve('semifinals:2',club);
 expect(get(7)).toBe('final');
 resolve('final:1',opponent);
 expect(get(7)).toBe('runnerUp');
 resolve('final:1',club);
 expect(get(7)).toBe('winner');
 resolve('final:1',null);
 expect(()=>get(7)).toThrow(); // A played final without a winner is invalid.
 results.clear();
 resolve('quarterfinals:2',opponent);
 expect(get(3)).toBe('quarterfinals'); // Direct qualifier eliminated in quarter-finals.
});
it('keeps public competition reads independent of malformed Player cookies and disabled auth configuration',async()=>{
 const url='https://example.invalid/api/competitions/IT-1/seasons/1';
 const anonymous=await worker.fetch(new Request(url),{DB:db});
 const malformedCookie=await worker.fetch(new Request(url,{headers:{Cookie:'fa_player_local=invalid; fa_admin_local=obsolete'}}),{DB:db,PLAYER_MODE:'production',PLAYER_ORIGIN:'https://other.invalid'});
 expect(anonymous.status).toBe(200);
 expect(malformedCookie.status).toBe(200);
 expect(await malformedCookie.json()).toEqual(await anonymous.json());
});
it('reads anonymously with explicit empty and unsupported viewed-season states',async()=>{
 const seasonZeroHistory=await (await clubHistory()).json() as any;
 expect(seasonZeroHistory).toMatchObject({schemaVersion:1,providerId:'authoritative-world',clubKey:'IT-1',status:'available',data:{overviews:[]}});
 let r=await request();expect(r.status).toBe(200);expect(await r.json()).toMatchObject({status:'empty',selectedSeason:1,data:null});
 await prepare();r=await request();expect(await r.json()).toMatchObject({status:'empty',reason:'calendar-unpublished',data:null});
 const future=await request('IT-1','2');expect(await future.json()).toMatchObject({status:'empty',selectedSeason:2,reason:'season-not-prepared',data:null});
 expect((await request('IT-1','1','POST')).status).toBe(405);
 expect((await request('ZZ-1')).status).toBe(404);
 expect((await request('IT-1','0')).status).toBe(404);
 expect(r.headers.get('cache-control')).toBe('no-store');
 const club=await clubOverview();
 expect(club.status).toBe(200);
 const unpublishedClub=await club.json() as any;
 expect(unpublishedClub).toMatchObject({clubKey:'IT-1',status:'empty',data:null});
 expect(projectClubMemberships(unpublishedClub,'IT-1',1,world).coverage).toBe('unpublished');
 expect((await clubOverview('IT-1','1','POST')).status).toBe(405);
 expect((await clubOverview('IT-41')).status).toBe(404);
 expect((await clubOverview('IT-1','0')).status).toBe(404);
 const preparingHistory=await (await clubHistory()).json() as any;
 expect(preparingHistory).toMatchObject({status:'available',data:{overviews:[{selectedSeason:1,status:'empty',reason:'calendar-unpublished',data:null}]}});
 expect((await clubHistory('IT-1','POST')).status).toBe(405);
 expect((await clubHistory('IT-41')).status).toBe(404);
 expect((await worker.fetch(new Request('https://example.invalid/api/clubs/IT-1/history?all=true'),{DB:db})).status).toBe(422);
 expect((await worker.fetch(new Request('https://example.invalid/api/clubs/IT-1/seasons/1/overview'),{DB:db})).status).toBe(404);
});
it('returns published future fixtures with no fabricated results or player stats',async()=>{
 await calendar();const r=await request(),body=await r.json() as any;
 expect(body).toMatchObject({providerId:'authoritative-world',status:'partial',data:{season:1,history:null,standings:{complete:false},statistics:{matchesPlayed:0,totalGoals:0,players:null}}});
 expect(body.data.fixtures).toHaveLength(240);
 expect(body.data.fixtures.every((f:any)=>f.result===null&&f.phaseId==='league'&&f.tieId===null&&f.leg===null&&f.neutral===false)).toBe(true);
 expect(body.data.calendar).toHaveLength(56);
 expect(JSON.stringify(body)).not.toMatch(/password|csrf|token|operationId|sourceSeedHash|"seed"|approvalReference/);
 expect(body.provenance.kind).toBe('authoritative');
 const overview=await (await clubOverview()).json() as any;
 expect(overview).toMatchObject({schemaVersion:1,providerId:'authoritative-world',clubKey:'IT-1',selectedSeason:1,status:'partial'});
 expect(overview.provenance.kind).toBe('authoritative');
 expect(overview.data.memberships).toHaveLength(2);
 expect(overview.data.memberships.filter((m:any)=>m.category==='domestic').map((m:any)=>m.competitionId)).toEqual(['IT-1']);
 expect(overview.data.memberships.filter((m:any)=>m.category==='international')).toHaveLength(1);
 expect(overview.data.memberships.every((m:any)=>m.position===null&&m.points===0&&m.nextMatch?.day>0)).toBe(true);
 expect(overview.data.memberships.every((m:any)=>m.stats?.played===0&&
  m.stats.won===0&&m.stats.drawn===0&&m.stats.lost===0&&
  m.stats.goalsFor===0&&m.stats.goalsAgainst===0&&m.stats.goalDifference===0))
  .toBe(true); // No future scores are included in compact Club History totals.
 const projected=projectClubMemberships(overview,'IT-1',1,world);
 expect(projected.coverage).toBe('complete');
 expect(projected.memberships).toHaveLength(2);
 expect(projected.memberships.every((m:any)=>m.nextMatch?.day>0)).toBe(true);
 expect(JSON.stringify(overview)).not.toMatch(/password|csrf|token|operationId|sourceSeedHash|"seed"|approvalReference/);
 const inactive=await (await clubOverview('IT-40')).json() as any;
 expect(inactive.data.memberships).toEqual([]);
 expect(inactive.status).toBe('partial');
});
it('returns all verified fixtures for one club in one request, without leaking future results',async()=>{
 let response=await clubFixtures();
 expect(response.status).toBe(200);
 expect(await response.json()).toMatchObject({schemaVersion:1,providerId:'authoritative-world',clubKey:'IT-1',selectedSeason:1,status:'empty',reason:'season-not-prepared',data:null});
 expect((await clubFixtures('IT-1','1','POST')).status).toBe(405);
 expect((await clubFixtures('IT-41')).status).toBe(404);
 expect((await clubFixtures('IT-1','0')).status).toBe(404);
 expect((await clubFixtures('IT-1','1','GET',db,'?competition=IT-1')).status).toBe(422);
 await prepare();
 expect(await (await clubFixtures()).json()).toMatchObject({status:'empty',reason:'calendar-unpublished',data:null});
 world=(await generateSeasonCalendar(db,session,meta(),'public-calendar-fixtures-0001',now)).world;
 response=await clubFixtures();
 expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
 let body=await response.json() as any;
 expect(body).toMatchObject({clubKey:'IT-1',selectedSeason:1,status:'partial',world,
  provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1'},
  data:{season:1,seasonState:{day:0},competitions:['IT-1','int-1']}});
 expect(body.data.fixtures).toHaveLength(36);
 expect(body.data.fixtures.filter((f:any)=>f.competitionId==='IT-1')).toHaveLength(30);
 expect(body.data.fixtures.filter((f:any)=>f.competitionId==='int-1')).toHaveLength(6);
 expect(body.data.fixtures.every((f:any)=>[f.homeClubId,f.awayClubId].includes('IT-1')&&f.result===null)).toBe(true);
 expect(JSON.stringify(body)).not.toMatch(/password|csrf|token|operationId|sourceSeedHash|"seed"|approvalReference/);
 const league=await (await request('IT-1')).json() as any;
 const cup=await (await request('int-1')).json() as any;
 const expected=[...league.data.fixtures,...cup.data.fixtures]
  .filter((f:any)=>[f.homeClubId,f.awayClubId].includes('IT-1'))
  .sort((a:any,b:any)=>a.day-b.day||a.competitionId.localeCompare(b.competitionId,'en')||
   a.marker.localeCompare(b.marker,'en')||a.id.localeCompare(b.id,'en'));
 expect(body.data.fixtures).toEqual(expected);
 await through(13);
 body=await (await clubFixtures()).json() as any;
 expect(body.world).toEqual(world);
 expect(body.data.fixtures.filter((f:any)=>f.day>world.day).every((f:any)=>f.result===null)).toBe(true);
 expect(body.data.fixtures.some((f:any)=>f.day===13&&f.result!==null)).toBe(true);
 const inactive=await (await clubFixtures('IT-40')).json() as any;
 expect(inactive.data.competitions).toEqual([]);expect(inactive.data.fixtures).toEqual([]);
},120000);
it('uses saved day13 results for partial standings and score-only statistics',async()=>{
 await calendar();await through(13);
 const body=await (await request()).json() as any;
 const played=body.data.fixtures.filter((f:any)=>f.result!==null);
 expect(played).toHaveLength(8);
 expect(body.data.standings.rows.every((r:any)=>r.played===1)).toBe(true);
 expect(body.data.statistics.matchesPlayed).toBe(8);
 expect(body.data.statistics.totalGoals).toBe(played.reduce((sum:number,f:any)=>sum+f.result.homeGoals+f.result.awayGoals,0));
 expect(body.data.statistics.teams.reduce((sum:number,r:any)=>sum+r.goalsFor,0)).toBe(body.data.statistics.totalGoals);
 expect(body.data.calendar.find((d:any)=>d.day===13).played).toBe(8);
 const overview13=await (await clubOverview()).json() as any;
 const domestic=overview13.data.memberships.find((m:any)=>m.competitionId==='IT-1');
 const ranked=body.data.standings.rows.find((r:any)=>r.clubId==='IT-1');
 expect(domestic).toMatchObject({season:1,position:ranked.rank,points:ranked.points});
 expect(domestic.stats).toEqual((({clubId,...stats}:any)=>stats)(
  body.data.statistics.teams.find((team:any)=>team.clubId==='IT-1'))); // Exact same verified persisted score totals.
 expect(Object.hasOwn(domestic.stats,'clubId')).toBe(false);
 expect(domestic.stats.played).toBe(1);
 const projected=projectClubMemberships(overview13,'IT-1',1,world);
 expect(projected.coverage).toBe('complete');
 expect(projected.memberships.find((m:any)=>m.competitionId==='IT-1')?.points).toBe(ranked.points);
 expect(domestic.nextMatch===null||domestic.nextMatch.day>13).toBe(true);
 expect(overview13.world).toEqual(body.world);
 // One club-level History GET contains every supported season, with no
 // per-competition HTTP requests required by the browser.
 const historyResponse=await clubHistory();
 expect(historyResponse.status).toBe(200);
 const oneGet=await historyResponse.json() as any;
 expect(oneGet).toMatchObject({schemaVersion:1,providerId:'authoritative-world',clubKey:'IT-1',
  status:'available',reason:null,
  provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1'}});
 expect(oneGet.world).toEqual(body.world);
 expect(oneGet.data.overviews).toHaveLength(1);
 expect(oneGet.data.overviews[0]).toEqual(overview13);
 expect(oneGet.data.overviews[0].data.memberships.every((m:any)=>
  m.stats&&Number.isSafeInteger(m.stats.played))).toBe(true);
 const cup=await (await request('int-1')).json() as any;
 expect(cup.data.fixtures).toHaveLength(72);expect(cup.data.statistics.matchesPlayed).toBe(0);
 expect(cup.data.standings.rows.every((r:any)=>r.played===0)).toBe(true);
 const compactCup=overview13.data.memberships.find((m:any)=>m.competitionId==='int-1');
 expect(compactCup.stats).toEqual((({clubId,...stats}:any)=>stats)(
  cup.data.statistics.teams.find((team:any)=>team.clubId==='IT-1')));
});
it('makes real future Playoff pairings public immediately after I06 without scores',async()=>{
 await calendar();
 const calendarModel=(await import('../../assets/world-calendar-model.js')).default as {createSeason:(season:number)=>{days:{day:number;events:{marker:string}[]}[]}};
 const finalDay=calendarModel.createSeason(1).days.find((d:any)=>d.events.some((e:any)=>e.marker==='I06'))!.day;
 await through(finalDay);
 const cup=await (await request('int-1')).json() as any;
 expect(cup.status).toBe('partial');
 expect(cup.data.standings.complete).toBe(true);
 expect(cup.data.fixtures).toHaveLength(80);
 const planned=cup.data.fixtures.filter((f:any)=>f.phaseId==='playoffs');
 expect(planned).toHaveLength(8);
 expect(planned.every((f:any)=>f.day>finalDay&&f.result===null&&f.tieId!==null)).toBe(true);
 expect(cup.data.fixtures.filter((f:any)=>['quarterfinals','semifinals','final'].includes(f.phaseId))).toHaveLength(0);
 const topClub=cup.data.standings.rows[0].clubId;
 const clubCup=await (await clubOverview(topClub)).json() as any;
 expect(clubCup.data.memberships.find((m:any)=>m.competitionId==='int-1').cupStatus).toBe('quarterfinals');
},120000);

it('fails closed on a missing daily receipt without advancing the shared world',async()=>{
 await calendar();await through(13);
 await db.prepare('DELETE FROM season_day_outcomes WHERE day=12').run();
 const r=await request();expect(r.status).toBe(503);expect(await r.json()).toEqual({error:{code:'sporting_data_unavailable'}});
 expect((await clubOverview()).status).toBe(503);
 expect(await readWorld(db)).toEqual(world);
});
it('does not combine old sporting data with a newly reset generation',async()=>{
 await calendar();await through(1);
 let reads=0;
 const changing={prepare(sql:string){
  const statement=db.prepare(sql);
  if(sql.includes('FROM world_state WHERE id = 1'))return {first:async()=>{
   const row=await statement.first();if(++reads===2)return {...row,generation:'12345678-1234-4123-8123-123456789abc'};return row;
  }};
  return statement;
 },batch:db.batch.bind(db)};
 const r=await request('IT-1','1','GET',changing);
 expect(r.status).toBe(409);expect(await r.json()).toEqual({error:{code:'stale_world'}});
});
it('returns canonical final league tables and history only after actual closure',async()=>{
 await calendar();await through(56);
 let body=await (await request()).json() as any;
 expect(body.data.history).toBe(null);
 const evidence=await loadSeasonSportingEvidence(db,world);
 const rows=(await db.prepare('SELECT outcome_json FROM season_day_outcomes ORDER BY day').all()).results;
 const scores=new Map<string,{homeGoals:number;awayGoals:number}>(rows.flatMap((r:any)=>JSON.parse(r.outcome_json).results.map((s:any)=>[s.fixtureId,s])));
 const expected=await rankLeagueTable('IT-1',evidence.snapshot.bindings.find(b=>b.competitionId==='IT-1')!.clubIds,evidence.schedule.fixtures.filter(f=>f.competitionId==='IT-1'),scores,evidence.schedule.seed);
 expect(body.data.standings.rows).toEqual(expected.map(({drawKey,...row})=>row));
 for(const event of proposeEndSeasonMilestones())await db.prepare('INSERT INTO season_admin_events(season_number,event_id,kind,scope,scheduled_day,event_order,created_at) VALUES(?,?,?,?,?,?,?)').bind(world.seasonNumber,event.id,event.kind,event.scope,event.day,event.order,now).run();
 world=(await archiveSeason(db,session,meta(),'public-archive-00001',now)).world;
 world=(await closeSeason(db,session,meta(),'public-close-0001',now)).world;
 body=await (await request()).json() as any;
 expect(body).toMatchObject({status:'available',data:{history:{championClubId:expected[0].clubId,season:1}}});
 const cup=await (await request('int-1')).json() as any;
 expect(cup.data.fixtures).toHaveLength(93);
 expect(cup.data.fixtures.filter((f:any)=>f.tieId!==null)).toHaveLength(21);
 expect(cup.data.fixtures.find((f:any)=>f.marker==='SOVEREIGN-FINAL')).toMatchObject({phaseId:'final',tieId:'final',leg:1,neutral:true});
 expect(cup.data.standings.rows.every((r:any)=>r.played===6)).toBe(true);
 expect(cup.data.history.championClubId).toBe(cup.data.fixtures.find((f:any)=>f.marker==='SOVEREIGN-FINAL').result.winnerClubId);
 const winnerCup=await (await clubOverview(cup.data.history.championClubId)).json() as any;
 expect(winnerCup.data.memberships.find((m:any)=>m.competitionId==='int-1').cupStatus).toBe('winner');
},120000);

it('clears public sporting data after a real protected generation reset',async()=>{
 await calendar();await through(13);
 const previous=world.generation;
 world=(await resetWorld(db,session,{...meta(),confirmation:'RESET SEASON 0'},'public-reset-0001',now)).world;
 const body=await (await request()).json() as any;
 expect(body).toMatchObject({status:'empty',reason:'season-not-prepared',data:null});
 expect(body.world.generation).not.toBe(previous);
 expect(world.seasonNumber).toBe(0);
});

it('rejects a self-rehashed corrupted saved score instead of showing a fabricated table',async()=>{
 await calendar();await through(13);
 const row=await db.prepare('SELECT outcome_json FROM season_day_outcomes WHERE day=13').first();
 const payload=JSON.parse(row.outcome_json);payload.results[0].homeGoals++;
 const trigger=await db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='season_day_outcome_immutable'").first();
 await db.prepare('DROP TRIGGER season_day_outcome_immutable').run();
 try{await db.prepare('UPDATE season_day_outcomes SET outcome_hash=?,outcome_json=? WHERE day=13').bind(await canonicalHash(payload),JSON.stringify(payload)).run()}
 finally{await db.prepare(trigger.sql).run()}
 const r=await request();expect(r.status).toBe(503);
 expect(await r.json()).toEqual({error:{code:'sporting_data_unavailable'}});
 expect(await readWorld(db)).toEqual(world);
});
it('projects one global day with the same saved scores as the competition source',async()=>{
 await calendar();await through(13);
 const response=await worker.fetch(new Request('https://example.invalid/api/calendar/seasons/1/days/13'),{DB:db});
 expect(response.status).toBe(200);const day=await response.json() as any;
 expect(day).toMatchObject({scope:'calendar',selectedSeason:1,day:13,status:'partial'});
 expect(day.data.fixtures).toHaveLength(128);
 expect(day.data.fixtures.every((f:any)=>f.day===13&&f.result!==null)).toBe(true);
 const competition=await (await request()).json() as any;
 expect(day.data.fixtures.filter((f:any)=>f.competitionId==='IT-1')).toEqual(competition.data.fixtures.filter((f:any)=>f.day===13));
 expect(day.data.competitions).toHaveLength(18);
 expect(JSON.stringify(day)).not.toMatch(/"seed"|token|csrf|password|sourceSeedHash/);
});
it('keeps daily calendar unsupported/unpublished states explicit and rejects invalid days/writes',async()=>{
 const read=(season:number,day:number,method='GET')=>worker.fetch(new Request(`https://example.invalid/api/calendar/seasons/${season}/days/${day}`,{method}),{DB:db});
 expect(await (await read(1,1)).json()).toMatchObject({status:'empty',data:null});
 await prepare();
 expect(await (await read(2,1)).json()).toMatchObject({status:'empty',selectedSeason:2,reason:'season-not-prepared',data:null});
 expect(await (await read(3,1)).json()).toMatchObject({status:'unavailable',selectedSeason:3,reason:'unsupported-season',data:null});
 expect((await read(1,57)).status).toBe(404);expect((await read(1,1,'POST')).status).toBe(405);
});
