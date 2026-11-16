import {describe,it,expect,beforeAll,beforeEach} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {seedUnifiedOperator} from './fixtures/unified-operator.ts';
import {clearTestWorld} from './fixtures/test-world.ts';
import {prepareSeason} from '../src/commands.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {advanceAdministrativeClock} from '../src/admin-calendar-clock.ts';
import {completeConfirmationEvent} from '../src/admin-calendar-confirm.ts';
import {stageDomesticCalendar} from '../src/admin-domestic-stage.ts';
import {executeInternationalDraw} from '../src/admin-international-draw.ts';
import {publishInternationalCalendarLineupV1} from '../src/admin-calendar-publish-lineup-v1.ts';
import {loadSeasonSportingEvidence} from '../src/season-sporting-evidence.ts';
import {replayLineupSeasonV1} from '../src/lineup-season-replay.ts';
import {readWorld} from '../src/world-repository.ts';
import type {AdminSession} from '../src/auth.ts';

const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>;
const cmd=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
const number=async(table:string)=>(await db.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n;
beforeAll(async()=>applyD1Migrations(db,bindings.TEST_MIGRATIONS));
beforeEach(async()=>{
 await clearTestWorld(db);
 session=(await seedUnifiedOperator(db,'lineup-publication','lineup-publisher@example.invalid',
  now,'8'.repeat(64))).session;
 world=await readWorld(db);
 world=(await prepareSeason(db,session,cmd(),'lineup-publish-prepare',await loadApprovedSnapshot(),now)).world;
 world=(await initializeAdministrativeEvents(db,session,cmd(),'lineup-publish-init',now)).world;
 world=(await advanceAdministrativeClock(db,session,'start',cmd(),'lineup-publish-start',now)).world;
 for(const eventId of ['domestic:entrants','international:entrants']){
  world=(await completeConfirmationEvent(db,session,{...cmd(),eventId},
   'lineup-publish-confirm-'+eventId,now)).world;
 }
 world=(await advanceAdministrativeClock(db,session,'advance',cmd(),'lineup-publish-day2',now)).world;
 world=(await stageDomesticCalendar(db,session,cmd(),'lineup-publish-domestic',now)).world;
 world=(await advanceAdministrativeClock(db,session,'advance',cmd(),'lineup-publish-day3',now)).world;
 world=(await executeInternationalDraw(db,session,cmd(),'lineup-publish-draw',now)).world;
});
describe('#613 V2-only published calendar (candidate, no HTTP cutover)',()=>{
 it('rolls back late failure then seals days 1–3 as empty V2, no legacy scores',async()=>{
  const before=cmd();
  await db.prepare(
   "CREATE TRIGGER fail_lineup_publication BEFORE INSERT ON admin_operations WHEN NEW.command='publish-international-calendar-v1' BEGIN SELECT RAISE(ABORT,'late audit error'); END"
  ).run();
  try{
   await expect(publishInternationalCalendarLineupV1(
    db,session,before,'lineup-publish-same-key',now
   )).rejects.toMatchObject({status:503});
  }finally{await db.prepare('DROP TRIGGER fail_lineup_publication').run()}
  expect(await number('season_calendars')).toBe(0);
  expect(await number('season_lineup_day_outcomes')).toBe(0);
  expect(await number('match_lineup_result_receipts')).toBe(0);
  expect(await readWorld(db)).toEqual(world);
  const published=await publishInternationalCalendarLineupV1(
   db,session,before,'lineup-publish-same-key',now
  );
  world=published.world;
  expect(await publishInternationalCalendarLineupV1(
   db,session,before,'lineup-publish-same-key',now
  )).toEqual(published);
  const days=(await db.prepare(
   'SELECT day,simulation_version,outcome_json FROM season_lineup_day_outcomes ORDER BY day'
  ).all()).results;
  expect(days.map((d:any)=>d.day)).toEqual([1,2,3]);
  expect(days.every((d:any)=>d.simulation_version==='temporary-lineup-v1'&&
   JSON.parse(d.outcome_json).schemaVersion===2&&
   JSON.parse(d.outcome_json).results.length===0)).toBe(true);
  expect(await number('season_day_outcomes')).toBe(0);
  expect(await number('match_lineup_result_receipts')).toBe(0);
  const evidence=await loadSeasonSportingEvidence(db,world);
  const replay=await replayLineupSeasonV1(db,world,evidence,world.day);
  expect(replay.resultCount).toBe(0);
  expect(replay.days).toHaveLength(3);
  expect(replay.progression.lastDay).toBe(3);
  expect(replay.progression.ties.size).toBe(0);
 },60000);
});
