import {beforeAll,beforeEach,describe,it,expect} from 'vitest';
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
import {executeLineupLifecycleV1} from '../src/lineup-lifecycle-command.ts';
import {publishInternationalCalendarLineupV1} from '../src/admin-calendar-publish-lineup-v1.ts';
import {loadSeasonSportingEvidence} from '../src/season-sporting-evidence.ts';
import {replayLineupSeasonV1} from '../src/lineup-season-replay.ts';
import {readWorld} from '../src/world-repository.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import type {AdminSession} from '../src/auth.ts';

const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>;
const cmd=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
const count=async(table:string)=>(await db.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n as number;
beforeAll(async()=>applyD1Migrations(db,bindings.TEST_MIGRATIONS));
beforeEach(async()=>{
 await clearTestWorld(db);
 session=(await seedUnifiedOperator(db,'lineup-auto-operator',
  'lineup-auto@example.invalid',now,'9'.repeat(64))).session;
 world=await readWorld(db);
 world=(await prepareSeason(db,session,cmd(),'lineup-auto-prepare-0001',
  await loadApprovedSnapshot(),now)).world;
 world=(await initializeAdministrativeEvents(db,session,cmd(),'lineup-auto-init-0001',now)).world;
});
describe('#613 one-authority administrative clock and sporting handoff',()=>{
 it('requires explicit calendar publication, then hands off to the real V2 daily command',async()=>{
  world=(await advanceAdministrativeClockLineupV1(
   db,session,'start',cmd(),'lineup-auto-start-0001',now)).world;
  for(const eventId of ['domestic:entrants','international:entrants']){
   world=(await completeConfirmationEvent(db,session,{...cmd(),eventId},
    'lineup-auto-confirm-'+eventId,now)).world;
  }
  world=(await advanceAdministrativeClockLineupV1(
   db,session,'advance',cmd(),'lineup-auto-day2-0001',now)).world;
  expect(world.day).toBe(2);
  world=(await stageDomesticCalendar(db,session,cmd(),'lineup-auto-domestic-0001',now)).world;
  world=(await advanceAdministrativeClockLineupV1(
   db,session,'advance',cmd(),'lineup-auto-day3-0001',now)).world;
  world=(await executeInternationalDraw(db,session,cmd(),'lineup-auto-draw-0001',now)).world;
  expect(await count('season_match_slots')).toBe(3984);
  expect(await count('season_knockout_match_slots')).toBe(98);
  const before=world,request=cmd();
  // Explicit event completion is mandatory, even though a calendar could
  // be constructed from the already verified domestic/draw records.
  await expect(advanceAdministrativeClockLineupV1(
   db,session,'advance',request,'lineup-auto-blocked-before-publish',now
  )).rejects.toMatchObject({status:409,code:'calendar_event_prerequisites'});
  await db.prepare("CREATE TRIGGER fail_lineup_auto_publish BEFORE INSERT ON admin_operations WHEN NEW.command='publish-international-calendar-v1' BEGIN SELECT RAISE(ABORT,'late audit failure'); END").run();
  try{
   await expect(publishInternationalCalendarLineupV1(
    db,session,request,'lineup-auto-publish-0001',now
   )).rejects.toMatchObject({status:503});
  }finally{await db.prepare('DROP TRIGGER fail_lineup_auto_publish').run()}
  expect(await readWorld(db)).toEqual(before);
  expect(await count('season_calendars')).toBe(0);
  expect(await count('season_lineup_day_outcomes')).toBe(0);
  expect(await count('season_day_outcomes')).toBe(0);
  const published=await publishInternationalCalendarLineupV1(
   db,session,request,'lineup-auto-publish-0001',now);
  world=published.world;
  expect(world.day).toBe(3);
  expect(await publishInternationalCalendarLineupV1(
   db,session,request,'lineup-auto-publish-0001',now
  )).toEqual(published);
  const rows=(await db.prepare('SELECT day,simulation_version,outcome_json FROM season_lineup_day_outcomes ORDER BY day').all()).results;
  expect(rows.map((r:any)=>r.day)).toEqual([1,2,3]);
  expect(rows.every((r:any)=>r.simulation_version==='temporary-lineup-v1'&&
   JSON.parse(r.outcome_json).schemaVersion===2&&
   JSON.parse(r.outcome_json).results.length===0)).toBe(true);
  expect(await count('season_day_outcomes')).toBe(0);
  expect(await count('match_lineup_result_receipts')).toBe(0);
  const evidence=await loadSeasonSportingEvidence(db,world);
  const replay=await replayLineupSeasonV1(db,world,evidence,world.day);
  expect(replay.progression.lastDay).toBe(3);
  expect(replay.resultCount).toBe(0);

  const start=cmd();
  const next=await executeLineupLifecycleV1(
   db,session,'advance',start,'lineup-auto-sporting-day4',now
  );
  world=next.world;
  expect(world.day).toBe(4);
  expect(await count('season_lineup_day_outcomes')).toBe(4);
  expect(await count('season_day_outcomes')).toBe(0);
  expect(await executeLineupLifecycleV1(
   db,session,'advance',start,'lineup-auto-sporting-day4',now
  )).toEqual(next);
 },120000);
});