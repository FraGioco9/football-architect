/** Isolated Worker D1 day-13 E2E. Immutable V2 rows are never torn down. */
import {beforeAll,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {seedUnifiedOperator} from './fixtures/unified-operator.ts';
import {clearTestWorld} from './fixtures/test-world.ts';
import {prepareSeason} from '../src/commands.ts';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {advanceAdministrativeClockLineupV1} from '../src/admin-calendar-clock-lineup-v1.ts';
import {completeConfirmationEvent} from '../src/admin-calendar-confirm.ts';
import {stageDomesticCalendar} from '../src/admin-domestic-stage.ts';
import {executeInternationalDraw} from '../src/admin-international-draw.ts';
import {publishInternationalCalendarLineupV1} from '../src/admin-calendar-publish-lineup-v1.ts';
import {executeLineupLifecycleV1} from '../src/lineup-lifecycle-command.ts';
import {resetWorld} from '../src/reset-world-command.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {readWorld} from '../src/world-repository.ts';
import {loadSeasonSportingEvidence} from '../src/season-sporting-evidence.ts';
import {replayLineupSeasonV1} from '../src/lineup-season-replay.ts';
import {readPublicMatchLineupV1,readPublicMatchStatisticsV1} from '../src/public-match-read-lineup-v1.ts';
import worker from '../src/index.ts';
import {handleAdmin} from '../src/http-admin.ts';
import {seedUnifiedAdminHttp} from './fixtures/unified-admin-http.ts';
import {
 readPublicSportingSeasonLineupV1,readPublicCalendarDayLineupV1
} from '../src/public-sporting-read-lineup-v1.ts';
import {ATTRIBUTES} from '../src/players-generator-core.mjs';
const LINEUP_V1_SLOTS=['GK','RB','CB','CB','LB','CM','DM','CM','RW','ST','LW'] as const;
import type {AdminSession} from '../src/auth.ts';

const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000);
type World=Awaited<ReturnType<typeof readWorld>>;
type FixtureRow={public_id:number;fixture_id:string;home_club_id:string;away_club_id:string};
const count=async(table:string):Promise<number>=>{
 const value=await db.prepare('SELECT COUNT(*) AS n FROM '+table).first() as {n:number};
 return value.n;
};
beforeAll(async()=>applyD1Migrations(db,bindings.TEST_MIGRATIONS));

it('#613 day13 real XI/fallback results, atomic failure/retry, immutable V2 replay and public parity',async()=>{
 await clearTestWorld(db);
 const session:AdminSession=(await seedUnifiedOperator(db,'lineup-day13-qa',
  'lineup-day13@example.invalid',now,'7'.repeat(64))).session;
 let world:World=await readWorld(db);
 const cmd=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
 const step=async(next:Promise<{world:World}>)=>{world=(await next).world;};
 await step(prepareSeason(db,session,cmd(),'day13-prepare-000001',await loadApprovedSnapshot(),now));
 await step(initializeAdministrativeEvents(db,session,cmd(),'day13-initialize-0001',now));
 await step(advanceAdministrativeClockLineupV1(db,session,'start',cmd(),'day13-start-0000001',now));
 for(const eventId of ['domestic:entrants','international:entrants'])
  await step(completeConfirmationEvent(db,session,{...cmd(),eventId},
   'day13-confirm-'+eventId,now));
 await step(advanceAdministrativeClockLineupV1(db,session,'advance',cmd(),'day13-admin2-000001',now));
 await step(stageDomesticCalendar(db,session,cmd(),'day13-domestic-00001',now));
 await step(advanceAdministrativeClockLineupV1(db,session,'advance',cmd(),'day13-admin3-000001',now));
 await step(executeInternationalDraw(db,session,cmd(),'day13-draw-00000001',now));
 await step(publishInternationalCalendarLineupV1(db,session,cmd(),'day13-publish-000001',now));
 expect(world.day).toBe(3);
 const rows=(await db.prepare(
  "SELECT p.id AS public_id,s.source_fixture_id AS fixture_id,s.home_club_id,s.away_club_id FROM public_match_numbers p JOIN season_match_slots s ON s.match_id=p.slot_match_id WHERE s.season_number=1 AND s.competition_id='IT-1' AND s.scheduled_day=13 ORDER BY p.id"
 ).all()).results as FixtureRow[];
 expect(rows).toHaveLength(8);
 const [full,mixed]=rows;
 expect(new Set([full.home_club_id,full.away_club_id,mixed.home_club_id,mixed.away_club_id]).size).toBe(4);
 const draftId='11111111-1111-4111-8111-111111111113';
 await db.prepare('INSERT INTO player_generation_drafts (id,world_generation,season_number,account_id,options_json,candidates_json,count,seed,status,created_at,expires_at,committed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
  .bind(draftId,world.generation,0,session.actor.id,'{}','[]',43,'lineup-day13-seed','committed',now-20,now+7200,now-10).run();
 let playerId=0;
 for(const [club,quantity] of [[full.home_club_id,11],[full.away_club_id,11],
  [mixed.home_club_id,11],[mixed.away_club_id,10]] as const){
  for(let n=0;n<quantity;n++){
   const id=++playerId;
   const payload={id,career_status:'active',first_name:'Test',last_name:'Player'+id,nationality:'ITA',
    primary_position:LINEUP_V1_SLOTS[n],secondary_positions:[],
    attributes:Object.fromEntries(ATTRIBUTES.map((key:string)=>[key,65+n%10]))};
   await db.prepare('INSERT INTO generated_players(id,batch_id,world_generation,entry_season,payload_json,created_at) VALUES(?,?,?,?,?,?)')
    .bind(id,draftId,world.generation,0,JSON.stringify(payload),now).run();
   await db.prepare('INSERT INTO player_club_affiliations(player_id,club_key) VALUES(?,?)')
    .bind(id,club).run();
  }
 }
 expect(await count('player_club_affiliations')).toBe(43);
 for(let day=4;day<=12;day++){
  await step(executeLineupLifecycleV1(db,session,'advance',cmd(),'day13-empty-'+day+'-000000',now));
  expect(world.day).toBe(day);
 }
 expect(await count('season_lineup_day_outcomes')).toBe(12);
 expect(await count('match_lineup_result_receipts')).toBe(0);
 expect(await readPublicMatchLineupV1(db,String(full.public_id)))
  .toMatchObject({status:'scheduled',result:null,kickoff:null});
 expect((await readPublicMatchStatisticsV1(db,String(full.public_id))).statistics).toBeNull();
 const oldWorld=world,oldCommand=cmd();
 await db.prepare("CREATE TRIGGER fail_day13_audit BEFORE INSERT ON admin_operations WHEN NEW.command='advance-season-v1' BEGIN SELECT RAISE(ABORT,'late day13 failure'); END").run();
 let failureClockReads=0;
 const failureClock=async()=>{
  failureClockReads++;
  if(failureClockReads===2){
   // A concurrent authenticated GET refreshes this session during V2 planning.
   await db.prepare('UPDATE player_sessions SET last_seen_at=? WHERE token_digest=?')
    .bind(now+15,session.unified!.sessionDigest).run();
  }
  return failureClockReads>=2?now+16:now;
 };
 try{
  await expect(executeLineupLifecycleV1(db,session,'advance',oldCommand,
   'day13-actual-000001',now,failureClock)).rejects.toMatchObject({status:503});
  expect(failureClockReads).toBeGreaterThanOrEqual(3);
 }finally{
  await db.prepare('UPDATE player_sessions SET last_seen_at=? WHERE token_digest=?')
   .bind(now,session.unified!.sessionDigest).run();
  await db.prepare('DROP TRIGGER fail_day13_audit').run();
 }
 expect(await readWorld(db)).toEqual(oldWorld);
 expect(await count('match_lineup_result_receipts')).toBe(0);
 expect(await count('season_lineup_day_outcomes')).toBe(12);
 let successClockReads=0;
 const successClock=async()=>{
  successClockReads++;
  if(successClockReads===2){
   await db.prepare('UPDATE player_sessions SET last_seen_at=? WHERE token_digest=?')
    .bind(now+19,session.unified!.sessionDigest).run();
  }
  return successClockReads>=2?now+20:now;
 };
 const committed=await executeLineupLifecycleV1(db,session,'advance',oldCommand,
  'day13-actual-000001',now,successClock);
 expect(successClockReads).toBe(2);
 await db.prepare('UPDATE player_sessions SET last_seen_at=? WHERE token_digest=?')
  .bind(now,session.unified!.sessionDigest).run();
 world=committed.world;
 expect(world.day).toBe(13);
 expect(await executeLineupLifecycleV1(db,session,'advance',oldCommand,
  'day13-actual-000001',now)).toEqual(committed);
 await expect(executeLineupLifecycleV1(db,session,'advance',oldCommand,
  'day13-second-000001',now)).rejects.toMatchObject({status:409});
 expect(await count('season_day_outcomes')).toBe(0);
 expect(await count('season_lineup_day_outcomes')).toBe(13);
 expect(await count('match_lineup_result_receipts')).toBe(128);
 const evidence=await loadSeasonSportingEvidence(db,world);
 const replay=await replayLineupSeasonV1(db,world,evidence,13);
 expect(replay.resultCount).toBe(128);
 expect(replay.frozenMatches.size).toBe(128);
 const a=await readPublicMatchLineupV1(db,String(full.public_id)) as any;
 const b=await readPublicMatchLineupV1(db,String(mixed.public_id)) as any;
 const statsA=await readPublicMatchStatisticsV1(db,String(full.public_id));
 const statsB=await readPublicMatchStatisticsV1(db,String(mixed.public_id));
 expect(a).not.toHaveProperty('lineup');expect(a).not.toHaveProperty('statistics');
 expect(statsA.statistics?.home.players).toHaveLength(11);
 expect(statsA.statistics?.home.players[0]).toMatchObject({name:expect.stringMatching(/^Test Player/),nationality:'ITA',assists:expect.any(Number),redCards:expect.any(Number)});
 expect(a).toMatchObject({status:'completed',kickoff:null,provenance:{kind:'authoritative'}});
 expect(Object.keys(a.provenance).sort()).toEqual(['kind','receiptHash']);
 expect(statsA.statistics!.home.kind).toBe('real_xi');
 expect(statsA.statistics!.away.kind).toBe('real_xi');
 expect(statsA.statistics!.home.players).toHaveLength(11);
 expect(statsA.statistics!.away.players).toHaveLength(11);
 expect(statsA.statistics!.home).not.toHaveProperty('appearances');
 expect(b.status).toBe('completed');
 expect(statsB.statistics!.home.kind).toBe('real_xi');
 expect(statsB.statistics!.away.kind).toBe('team_fallback');
 expect(statsB.statistics!.away.players).toEqual([]);
 expect(statsB.statistics!.away).not.toHaveProperty('appearances');
 // Retain immutable scoring evidence in D1 while omitting events from public Match Detail.
 expect(a).not.toHaveProperty('events');
 expect(b).not.toHaveProperty('events');
 const frozenA=await db.prepare('SELECT receipt_json FROM match_lineup_result_receipts WHERE public_match_id=?')
  .bind(full.public_id).first() as {receipt_json:string}|null;
 const frozenB=await db.prepare('SELECT receipt_json FROM match_lineup_result_receipts WHERE public_match_id=?')
  .bind(mixed.public_id).first() as {receipt_json:string}|null;
 expect(JSON.parse(frozenA!.receipt_json).result.events.filter((e:{type:string})=>e.type==='goal'))
  .toHaveLength(a.result.homeGoals+a.result.awayGoals);
 expect(JSON.parse(frozenB!.receipt_json).result.events.filter((e:{side:string})=>e.side==='away'))
  .toHaveLength(0);
 const identityQueries:string[]=[];
 const trackedDb={prepare(sql:string){if(sql.includes('FROM generated_players'))identityQueries.push(sql);return db.prepare(sql)},batch:db.batch.bind(db)};
 const season=await readPublicSportingSeasonLineupV1(trackedDb,'IT-1',1) as any;
 expect(identityQueries,'complete frozen identities require no live directory lookup').toHaveLength(0);
 expect(season.data.fixtures.filter((f:any)=>f.result)).toHaveLength(8);
 expect(season.data.statistics.matchesPlayed).toBe(8);
 expect(season.data.statistics.players).toHaveLength(33);
 for(const player of season.data.statistics.players){
  expect(player.displayName).toBe('Test Player'+player.playerId);
  expect(player.appearances).toBe(1);
  expect(player.starts).toBe(1);
  expect(player.nationality).toBe('ITA');
  expect(player.ratedAppearances).toBe(1);
  expect(player.averageRating).toBeGreaterThanOrEqual(4);
  expect(player.minutes).toBeGreaterThan(0);
  expect(player.assists).toBeGreaterThanOrEqual(0);
  expect(player.redCards).toBeGreaterThanOrEqual(0);
  expect(player.subAppearances).toBe(0);
 }
 const fullPlayers=season.data.statistics.players.filter((p:any)=>[full.home_club_id,full.away_club_id].includes(p.clubId));
 expect(fullPlayers).toHaveLength(22);
 expect(season.data.statistics.players.filter((p:any)=>p.clubId===mixed.home_club_id)).toHaveLength(11);
 expect(season.data.statistics.players.some((p:any)=>p.clubId===mixed.away_club_id)).toBe(false);
 const calendar=await readPublicCalendarDayLineupV1(db,1,13) as any;
 expect(calendar.data.fixtures.length).toBe(128);
 expect(calendar.data.fixtures.every((f:any)=>f.result)).toBe(true);
 // Current affiliation edits must never rewrite the finalized V2 evidence.
 await db.prepare('DELETE FROM player_club_affiliations WHERE player_id=1').run();
 expect(await readPublicMatchLineupV1(db,String(full.public_id))).toEqual(a);
 const afterward=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
 expect(afterward.data.statistics.players).toEqual(season.data.statistics.players);
 const beforeIdentityRead=await readWorld(db);
 // An unavailable directory label must never fabricate a name or erase totals.
 const payload=await db.prepare('SELECT payload_json FROM generated_players WHERE id=1').first() as {payload_json:string};
 const unknown=JSON.parse(payload.payload_json);delete unknown.first_name;delete unknown.last_name;
 await db.prepare('UPDATE generated_players SET payload_json=? WHERE id=1').bind(JSON.stringify(unknown)).run();
 const unnamed=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
 const recorded=season.data.statistics.players.find((p:any)=>p.playerId===1);
 expect(unnamed.data.statistics.players.find((p:any)=>p.playerId===1)).toEqual(recorded);
 expect((await readPublicMatchStatisticsV1(db,String(full.public_id))).statistics).toEqual(statsA.statistics);
 expect(await readWorld(db)).toEqual(beforeIdentityRead);
 await db.prepare('UPDATE generated_players SET payload_json=? WHERE id=1').bind(payload.payload_json).run();

 // Verify the ACTUAL anonymous HTTP router, not only the standalone V2
 // projection. Every public endpoint must agree with the same finalized day.
 const get=async(path:string)=>{
  const response=await worker.fetch(new Request('https://example.invalid'+path),{DB:db});
  expect(response.status).toBe(200);
  return response.json() as Promise<any>;
 };
 const httpMatch=await get('/api/matches/'+full.public_id);
 expect(httpMatch.status).toBe('completed');
 expect(httpMatch.result).toEqual(a.result);
 expect(httpMatch).not.toHaveProperty('lineup');
 const httpStats=await get('/api/matches/'+full.public_id+'/stats');
 expect(httpStats.statistics).toEqual(statsA.statistics);
 expect(httpStats.provenance.receiptHash).toBe(httpMatch.provenance.receiptHash);
 expect((await worker.fetch(new Request('https://example.invalid/api/matches/'+full.public_id+'/stats?extra=1'),{DB:db})).status).toBe(422);
 expect((await worker.fetch(new Request('https://example.invalid/api/matches/'+full.public_id+'/stats',{method:'POST'}),{DB:db})).status).toBe(405);

 expect(httpMatch).not.toHaveProperty('events');
 expect(httpMatch).not.toHaveProperty('marker');
 expect(httpMatch).not.toHaveProperty('slotId');
 expect(httpMatch).toHaveProperty('kickoff',null);
 const httpSport=await get('/api/competitions/IT-1/seasons/1');
 expect(httpSport.data.statistics.matchesPlayed).toBe(8);
 expect(httpSport.data.fixtures.filter((f:any)=>f.result)).toHaveLength(8);
 const httpCalendar=await get('/api/calendar/seasons/1/days/13');
 expect(httpCalendar.data.fixtures.length).toBe(128);
 expect(httpCalendar.data.fixtures.every((f:any)=>f.result)).toBe(true);
 const httpClub=await get('/api/clubs/'+full.home_club_id+'/seasons/1/fixtures');
 expect(httpClub.data.fixtures.some((f:any)=>f.result!==null)).toBe(true);
 const httpHistory=await get('/api/clubs/'+full.home_club_id+'/history');
 expect(httpHistory.provenance.resultAuthority).toBe('temporary-lineup-v1');
 expect((await get('/api/matches/seasons/1/competitions/IT-1')).fixtures).toHaveLength(242);
 const future=(await db.prepare(
  "SELECT p.id AS id FROM public_match_numbers p JOIN season_match_slots s ON s.match_id=p.slot_match_id WHERE s.season_number=1 AND s.scheduled_day=14 LIMIT 1"
 ).first()) as {id:number};
 expect(await readPublicMatchLineupV1(db,String(future.id)))
  .toMatchObject({status:'scheduled',result:null,kickoff:null});
 // Authenticated Admin GET must report the SAME V2 day count as public GETs.
 const operator=await seedUnifiedAdminHttp(db,session.actor.id,session.actor.email,
  now,'c'.repeat(64));
 const adminEnv={DB:db,PLAYER_MODE:'local',PLAYER_ORIGIN:'http://localhost:2000'};
 const calendarRead=await handleAdmin(new Request(
  'http://localhost:2000/api/admin/seasons/events',
  {headers:{Cookie:operator.cookie}}
 ),adminEnv);
 expect(calendarRead.status).toBe(200);
 expect((await calendarRead.json() as any).closure.days).toBe(13);
 // Both direct score-only calendar generation and old season start must
 // stay retired. Only explicit V2 Admin milestones can begin a season.
 for(const retiredPath of ['calendar','start']){
  const retired=await handleAdmin(new Request(
   'http://localhost:2000/api/admin/seasons/'+retiredPath,{
    method:'POST',
    headers:{Cookie:operator.cookie,Origin:'http://localhost:2000',
     'X-CSRF-Token':operator.csrf,'Content-Type':'application/json',
     'Idempotency-Key':'lineup-retired-'+retiredPath+'-0001'},
    body:JSON.stringify(cmd())
   }),adminEnv);
  expect(retired.status).toBe(410);
  expect(await retired.json()).toMatchObject({error:{code:'legacy_season_command_retired'}});
 }
 // The immutable tables reject ordinary deletes. Only the protected Season 0
 // reset may remove this generation's receipts inside its own single batch.
 await expect(db.prepare('DELETE FROM match_lineup_result_receipts').run()).rejects.toThrow();
 await expect(db.prepare('DELETE FROM season_lineup_day_outcomes').run()).rejects.toThrow();
 const beforeReset=world, resetCommand={...cmd(),confirmation:'RESET SEASON 0'};
 const existingPlayers=await count('generated_players');
 const existingLinks=await count('player_club_affiliations');
 await db.prepare("CREATE TRIGGER fail_lineup_reset_late BEFORE INSERT ON admin_operations WHEN NEW.command='reset-world-v1' BEGIN SELECT RAISE(ABORT,'late reset rollback'); END").run();
 try{
  await expect(resetWorld(db,session,resetCommand,'day13-reset-qa-000001',now))
   .rejects.toMatchObject({status:503});
 }finally{await db.prepare('DROP TRIGGER fail_lineup_reset_late').run()}
 expect(await readWorld(db)).toEqual(beforeReset);
 expect(await count('match_lineup_result_receipts')).toBe(128);
 expect(await count('season_lineup_day_outcomes')).toBe(13);
 expect(await count('world_reset_permits')).toBe(0);
 const reset=await resetWorld(db,session,resetCommand,'day13-reset-qa-000001',now);
 expect(reset.world).toMatchObject({seasonNumber:0,day:0,phase:'unstarted'});
 expect(await count('match_lineup_result_receipts')).toBe(0);
 expect(await count('season_lineup_day_outcomes')).toBe(0);
 expect(await count('world_reset_permits')).toBe(0);
 expect(await count('generated_players')).toBe(existingPlayers);
 expect(await count('player_club_affiliations')).toBe(existingLinks);
 await expect(resetWorld(db,session,resetCommand,'day13-reset-qa-000001',now))
  .rejects.toMatchObject({status:409});
},180000);
