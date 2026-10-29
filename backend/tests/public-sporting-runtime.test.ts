import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import worker from '../src/index.ts';
import {prepareSeason} from '../src/commands.ts';
import {generateSeasonCalendar} from '../src/calendar-command.ts';
import {executeLifecycle} from '../src/lifecycle-command.ts';
import {closeSeason} from '../src/season-close-command.ts';
import {resetWorld} from '../src/reset-world-command.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {readWorld} from '../src/world-repository.ts';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {hashText,type AdminSession} from '../src/auth.ts';
import {rankLeagueTable} from '../src/league-standings.ts';
import {loadSeasonSportingEvidence} from '../src/season-sporting-evidence.ts';
const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>;
const meta=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
const request=(competition='IT-1',season='1',method='GET',database=db)=>worker.fetch(new Request('https://example.invalid/api/competitions/'+competition+'/seasons/'+season,{method}),{DB:database});
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 session={actor:{id:'public-operator',email:'public@example.invalid'},digest:await hashText('public-session'),credentialVersion:1,csrfDigest:await hashText('public-csrf')};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic',now-10).run();
 await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(session.digest,session.actor.id,1,session.csrfDigest,now-10,now-5,now+1000).run();
 world=await readWorld(db);
});
async function prepare(){world=(await prepareSeason(db,session,meta(),'public-prepare-0001',await loadApprovedSnapshot(),now)).world}
async function calendar(){await prepare();world=(await generateSeasonCalendar(db,session,meta(),'public-calendar-0001',now)).world}
async function through(day:number){world=(await executeLifecycle(db,session,'start',meta(),'public-start-0001',now)).world;while(world.day<day)world=(await executeLifecycle(db,session,'advance',meta(),'public-day-'+(world.day+1)+'-0001',now)).world}
it('reads anonymously with explicit empty and unsupported viewed-season states',async()=>{
 let r=await request();expect(r.status).toBe(200);expect(await r.json()).toMatchObject({status:'empty',selectedSeason:1,data:null});
 await prepare();r=await request();expect(await r.json()).toMatchObject({status:'empty',reason:'calendar-unpublished',data:null});
 const future=await request('IT-1','2');expect(await future.json()).toMatchObject({status:'unavailable',selectedSeason:2,reason:'unsupported-season',data:null});
 expect((await request('IT-1','1','POST')).status).toBe(405);
 expect((await request('ZZ-1')).status).toBe(404);
 expect((await request('IT-1','0')).status).toBe(404);
 expect(r.headers.get('cache-control')).toBe('no-store');
});
it('returns published future fixtures with no fabricated results or player stats',async()=>{
 await calendar();const r=await request(),body=await r.json() as any;
 expect(body).toMatchObject({providerId:'authoritative-world',status:'partial',data:{season:1,history:null,standings:{complete:false},statistics:{matchesPlayed:0,totalGoals:0,players:null}}});
 expect(body.data.fixtures).toHaveLength(240);
 expect(body.data.fixtures.every((f:any)=>f.result===null)).toBe(true);
 expect(body.data.calendar).toHaveLength(56);
 expect(JSON.stringify(body)).not.toMatch(/password|csrf|token|operationId|sourceSeedHash|"seed"|approvalReference/);
 expect(body.provenance.kind).toBe('authoritative');
});
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
 const cup=await (await request('int-1')).json() as any;
 expect(cup.data.fixtures).toHaveLength(72);expect(cup.data.statistics.matchesPlayed).toBe(0);
 expect(cup.data.standings.rows.every((r:any)=>r.played===0)).toBe(true);
});
it('fails closed on a missing daily receipt without advancing the shared world',async()=>{
 await calendar();await through(13);
 await db.prepare('DELETE FROM season_day_outcomes WHERE day=12').run();
 const r=await request();expect(r.status).toBe(503);expect(await r.json()).toEqual({error:{code:'sporting_data_unavailable'}});
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
 world=(await closeSeason(db,session,meta(),'public-close-0001',now)).world;
 body=await (await request()).json() as any;
 expect(body).toMatchObject({status:'available',data:{history:{championClubId:expected[0].clubId,season:1}}});
 const cup=await (await request('int-1')).json() as any;
 expect(cup.data.fixtures).toHaveLength(93);
 expect(cup.data.standings.rows.every((r:any)=>r.played===6)).toBe(true);
 expect(cup.data.history.championClubId).toBe(cup.data.fixtures.find((f:any)=>f.marker==='SOVEREIGN-FINAL').result.winnerClubId);
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
