import {seedUnifiedOperator} from './fixtures/unified-operator.ts';
import {clearTestWorld} from './fixtures/test-world.ts';
import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {prepareSeason} from '../src/commands.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {advanceAdministrativeClock} from '../src/admin-calendar-clock.ts';
import {completeConfirmationEvent} from '../src/admin-calendar-confirm.ts';
import {stageDomesticCalendar} from '../src/admin-domestic-stage.ts';
import {executeInternationalDraw} from '../src/admin-international-draw.ts';
import {publishInternationalCalendar} from '../src/admin-calendar-publish.ts';
import {rescheduleSeasonEvent} from '../src/admin-calendar-command.ts';
import {executeLifecycle} from '../src/lifecycle-command.ts';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {readWorld} from '../src/world-repository.ts';
import {readAdministrativeCalendar} from '../src/admin-calendar-read.ts';
import {handleAdmin} from '../src/http-admin.ts';
import {type AdminSession} from '../src/auth.ts';

const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000),token='f'.repeat(64);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>;
const cmd=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await clearTestWorld(db);
 session=(await seedUnifiedOperator(db,'automatic-operator','automatic@example.invalid',now,token)).session;
 world=await readWorld(db);
 world=(await prepareSeason(db,session,cmd(),'clock-prepare-synthetic-0001',await loadApprovedSnapshot(),now)).world;
 world=(await initializeAdministrativeEvents(db,session,cmd(),'clock-initialize-synthetic-0001',now)).world;
});

const count=async(table:string)=>(await db.prepare('SELECT count(*) n FROM '+table).first()).n;
// Explicitly complete each scheduled action with its own guarded transaction.
const completeDue=async(key:string)=>{
 const events=(await readAdministrativeCalendar(db)).events.filter(e=>e.day===world.day&&e.status==='scheduled');
 for(const event of events){
  const operationKey=key+'-'+event.id;
  if(event.kind.startsWith('confirm-'))world=(await completeConfirmationEvent(db,session,{...cmd(),eventId:event.id},operationKey,now)).world;
  else if(event.kind==='generate-domestic-calendar')world=(await stageDomesticCalendar(db,session,cmd(),operationKey,now)).world;
  else if(event.kind==='draw-international')world=(await executeInternationalDraw(db,session,cmd(),operationKey,now)).world;
  else if(event.kind==='generate-international-calendar')world=(await publishInternationalCalendar(db,session,cmd(),operationKey,now)).world;
 }
};
const advance=async(key:string)=>{
 await completeDue(key);
 world=(await (await count('season_calendars')?executeLifecycle(db,session,'advance',cmd(),key,now):advanceAdministrativeClock(db,session,world.day===0?'start':'advance',cmd(),key,now))).world;
};
it('rejects direct advancement after zero or only some current-day actions, with no writes',async()=>{
 await advance('manual-start-0001');
 const before=world;
 await expect(advanceAdministrativeClock(db,session,'advance',cmd(),'manual-blocked-day2',now)).rejects.toMatchObject({status:409,code:'calendar_event_prerequisites'});
 expect(await readWorld(db)).toEqual(before);
 world=(await completeConfirmationEvent(db,session,{...cmd(),eventId:'domestic:entrants'},'manual-confirm-one',now)).world;
 await expect(advanceAdministrativeClock(db,session,'advance',cmd(),'manual-still-blocked',now)).rejects.toMatchObject({status:409});
 for(const table of ['season_domestic_stages','season_draws','season_calendars','season_day_outcomes'])expect(await count(table)).toBe(0);
 await advance('manual-complete-day2');expect(world.day).toBe(2);
 await expect(advanceAdministrativeClock(db,session,'advance',cmd(),'manual-blocked-stage',now)).rejects.toMatchObject({status:409});
});
it('hands off to sporting progression only after separately completed draw and publication',async()=>{
 for(const key of ['start','day2','day3'])await advance('manual-flow-'+key);
 expect(world.day).toBe(3);expect(await count('season_draws')).toBe(0);
 world=(await executeInternationalDraw(db,session,cmd(),'manual-flow-draw',now)).world;
 const before=world;
 await expect(advanceAdministrativeClock(db,session,'advance',cmd(),'manual-blocked-publish',now)).rejects.toMatchObject({status:409});
 expect(await readWorld(db)).toEqual(before);expect(await count('season_calendars')).toBe(0);
 await completeDue('manual-flow-publish');
 const previous=cmd(),saved=await executeLifecycle(db,session,'advance',previous,'manual-flow-day4',now);world=saved.world;
 expect(await executeLifecycle(db,session,'advance',previous,'manual-flow-day4',now)).toEqual(saved);
 expect(world.day).toBe(4);expect(await count('season_draws')).toBe(2);
 expect((await readAdministrativeCalendar(db)).events.filter(e=>e.scope!=='season').every(e=>e.hasReceipt&&e.status==='completed')).toBe(true);
 const receipts=(await db.prepare('SELECT day,outcome_json,outcome_hash FROM season_day_outcomes ORDER BY day').all()).results;
 expect(receipts.map((r:{day:number})=>r.day)).toEqual([1,2,3,4]);
 for(const row of receipts)expect(row.outcome_hash).toBe(await canonicalHash(JSON.parse(row.outcome_json)));
});
it('rolls back time on late audit failure without undoing separately completed actions',async()=>{
 await advance('manual-rollback-start');await completeDue('manual-rollback-confirm');const before=world;
 await db.prepare("CREATE TRIGGER fail_manual_advance BEFORE INSERT ON admin_operations WHEN NEW.command='advance-admin-calendar-v1' BEGIN SELECT RAISE(ABORT,'late failure'); END").run();
 try{await expect(advanceAdministrativeClock(db,session,'advance',cmd(),'manual-failed-day2',now)).rejects.toMatchObject({status:503})}
 finally{await db.prepare('DROP TRIGGER fail_manual_advance').run()}
 expect(await readWorld(db)).toEqual(before);
 expect((await readAdministrativeCalendar(db)).events.filter(e=>e.status==='completed')).toHaveLength(2);
 for(const table of ['season_draws','season_calendars','season_day_outcomes'])expect(await count(table)).toBe(0);
 await advance('manual-retry-day2');expect(world.day).toBe(2);
});
it('allows one winner for competing same-revision advances after all due actions complete',async()=>{
 await advance('manual-race-start');await advance('manual-race-day2');await completeDue('manual-race-stage');const before=cmd();
 const results=await Promise.allSettled(['a','b'].map(k=>advanceAdministrativeClock(db,session,'advance',before,'manual-race-day3-'+k,now)));
 expect(results.filter(r=>r.status==='fulfilled'),JSON.stringify(results.map(result=>result.status==='rejected'?{status:result.reason.status,code:result.reason.code,message:result.reason.message}:result.value))).toHaveLength(1);
 expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{status:409}});
 expect((await readWorld(db)).revision).toBe(before.expectedRevision+1);
 expect(await count('season_domestic_stages')).toBe(1);expect(await count('season_draws')).toBe(0);
});
it('respects moved actions through day twelve and requires explicit publication before day thirteen',async()=>{
 world=(await rescheduleSeasonEvent(db,session,{...cmd(),eventId:'international:calendar',day:12,order:2},'manual-move-publish',now)).world;
 world=(await rescheduleSeasonEvent(db,session,{...cmd(),eventId:'international:draw',day:4,order:1},'manual-move-draw',now)).world;
 while(world.day<12)await advance('manual-moved-day-'+(world.day+1));
 expect(await count('season_draws')).toBe(2);expect(await count('season_calendars')).toBe(0);
 await expect(advanceAdministrativeClock(db,session,'advance',cmd(),'manual-blocked-day13',now)).rejects.toMatchObject({status:409});
 await advance('manual-moved-day13');expect(world.day).toBe(13);
 const rows=(await db.prepare('SELECT day,outcome_json FROM season_day_outcomes ORDER BY day').all()).results;
 expect(rows).toHaveLength(13);expect(JSON.parse(rows[12].outcome_json).results.length).toBeGreaterThan(0);
},120000);
it('rejects a forged completed confirmation without changing world or artifacts',async()=>{
 await advance('manual-forged-start');await completeDue('manual-forged-confirm');
 const trigger=await db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='season_admin_event_no_retroactive_update'").first();
 await db.prepare('DROP TRIGGER season_admin_event_no_retroactive_update').run();
 try{await db.prepare("UPDATE season_admin_events SET receipt_hash=? WHERE event_id='domestic:entrants'").bind('0'.repeat(64)).run()}
 finally{await db.prepare(trigger.sql).run()}
 const before=world;await expect(advanceAdministrativeClock(db,session,'advance',cmd(),'manual-forged-day2',now)).rejects.toMatchObject({status:422});
 expect(await readWorld(db)).toEqual(before);expect(await count('season_domestic_stages')).toBe(0);
});
it('rejects an overdue milestone without retroactive completion',async()=>{
 await advance('manual-overdue-start');await db.prepare('UPDATE world_state SET day=2').run();world=await readWorld(db);
 await expect(advanceAdministrativeClock(db,session,'advance',cmd(),'manual-overdue-advance',now)).rejects.toMatchObject({status:409});
 expect(await readWorld(db)).toEqual(world);expect(await count('season_domestic_stages')).toBe(0);
});
it('rejects missing persisted evidence for a completed domestic action',async()=>{
 await advance('manual-missing-start');await advance('manual-missing-day2');await completeDue('manual-missing-stage');await db.prepare('DELETE FROM season_domestic_stages').run();
 const before=world;await expect(advanceAdministrativeClock(db,session,'advance',cmd(),'manual-missing-day3',now)).rejects.toMatchObject({status:422});
 expect(await readWorld(db)).toEqual(before);expect(await count('season_draws')).toBe(0);
});
it('rejects draw evidence inserted ahead of its owning event',async()=>{
 await advance('manual-extra-start');await completeDue('manual-extra-confirm');
 await db.prepare('INSERT INTO season_draws VALUES(?,?,?,?,?,?,?,?,?)').bind(1,'int-1','league','initial-leagues-v1','0123456789abcdef','0'.repeat(64),'{}','generated',now).run();
 const before=world;await expect(advanceAdministrativeClock(db,session,'advance',cmd(),'manual-extra-day2',now)).rejects.toMatchObject({status:422});
 expect(await readWorld(db)).toEqual(before);expect(await count('season_domestic_stages')).toBe(0);
});
it('aborts when completed stage evidence disappears between validation and commit',async()=>{
 await advance('manual-replaced-start');await advance('manual-replaced-day2');await completeDue('manual-replaced-stage');const before=world;
 const racingDb={prepare:db.prepare.bind(db),batch:async(statements:any[])=>{
  if(statements.length>1)await db.prepare('DELETE FROM season_domestic_stages').run();return db.batch(statements);
 }};
 await expect(advanceAdministrativeClock(racingDb,session,'advance',cmd(),'manual-replaced-day3',now)).rejects.toMatchObject({status:503});
 expect(await readWorld(db)).toEqual(before);expect(await count('season_draws')).toBe(0);
});
it('rechecks live credentials at advance commit without changing time',async()=>{
 await advance('manual-revoked-start');await advance('manual-revoked-day2');await completeDue('manual-revoked-stage');const before=world;
 const racingDb={prepare:db.prepare.bind(db),batch:async(statements:any[])=>{
  if(statements.length>1)await db.prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?').bind(session.actor.id).run();return db.batch(statements);
 }};
 await expect(advanceAdministrativeClock(racingDb,session,'advance',cmd(),'manual-revoked-day3',now)).rejects.toMatchObject({status:403,code:'permission_denied'});
 expect(await readWorld(db)).toEqual(before);expect(await count('season_draws')).toBe(0);
});
