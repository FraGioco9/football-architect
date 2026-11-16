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
import {readPublicMatchLineupV1} from '../src/public-match-read-lineup-v1.ts';
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
   const payload={id,career_status:'active',first_name:'Test',last_name:'Player'+id,
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
  .toMatchObject({status:'scheduled',result:null,lineup:null,events:null});
 const oldWorld=world,oldCommand=cmd();
 await db.prepare("CREATE TRIGGER fail_day13_audit BEFORE INSERT ON admin_operations WHEN NEW.command='advance-season-v1' BEGIN SELECT RAISE(ABORT,'late day13 failure'); END").run();
 try{
  await expect(executeLineupLifecycleV1(db,session,'advance',oldCommand,
   'day13-actual-000001',now)).rejects.toMatchObject({status:503});
 }finally{await db.prepare('DROP TRIGGER fail_day13_audit').run()}
 expect(await readWorld(db)).toEqual(oldWorld);
 expect(await count('match_lineup_result_receipts')).toBe(0);
 expect(await count('season_lineup_day_outcomes')).toBe(12);
 const committed=await executeLineupLifecycleV1(db,session,'advance',oldCommand,
  'day13-actual-000001',now);
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
 expect(a).toMatchObject({status:'completed',provenance:{resultAuthority:'temporary-lineup-v1'}});
 expect(a.lineup.home.kind).toBe('real_xi');
 expect(a.lineup.away.kind).toBe('real_xi');
 expect(a.lineup.home.starters).toHaveLength(11);
 expect(a.lineup.away.appearances).toHaveLength(11);
 expect(b.status).toBe('completed');
 expect(b.lineup.home.kind).toBe('real_xi');
 expect(b.lineup.away.kind).toBe('team_fallback');
 expect(b.lineup.away.starters).toEqual([]);
 expect(b.lineup.away.appearances).toEqual([]);
 expect(a.events.length).toBe(a.result.homeGoals+a.result.awayGoals);
 expect(b.events.filter((e:any)=>e.side==='away')).toHaveLength(0);
 const season=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
 expect(season.data.fixtures.filter((f:any)=>f.result)).toHaveLength(8);
 expect(season.data.statistics.matchesPlayed).toBe(8);
 expect(season.data.statistics.players).toHaveLength(33);
 const calendar=await readPublicCalendarDayLineupV1(db,1,13) as any;
 expect(calendar.data.fixtures.length).toBe(128);
 expect(calendar.data.fixtures.every((f:any)=>f.result)).toBe(true);
 // Current affiliation edits must never rewrite the finalized V2 evidence.
 await db.prepare('DELETE FROM player_club_affiliations WHERE player_id=1').run();
 expect(await readPublicMatchLineupV1(db,String(full.public_id))).toEqual(a);
 const afterward=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
 expect(afterward.data.statistics.players).toEqual(season.data.statistics.players);
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
 expect(httpMatch.lineup).toEqual(a.lineup);
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
  .toMatchObject({status:'scheduled',result:null,lineup:null,events:null});
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
