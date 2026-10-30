import {seedUnifiedOperator} from './fixtures/unified-operator.ts';
import {clearTestWorld} from './fixtures/test-world.ts';
import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {prepareSeason} from '../src/commands.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {advanceAdministrativeClock} from '../src/admin-calendar-clock.ts';
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

const advance=async(key:string)=>{world=(await advanceAdministrativeClock(db,session,world.day===0?'start':'advance',cmd(),key,now)).world};
const count=async(table:string)=>(await db.prepare('SELECT count(*) n FROM '+table).first()).n;
it('atomically completes current-day events, then hands off to ordinary sporting progression',async()=>{
 await advance('automatic-start-0001');
 await advance('automatic-day2-0001');
 expect(world.day).toBe(2);
 expect(await count('season_draws')).toBe(0);
 expect((await readAdministrativeCalendar(db)).events.filter(e=>e.hasReceipt)).toHaveLength(2);
 await advance('automatic-day3-0001');
 expect(JSON.parse((await db.prepare('SELECT fixtures_json FROM season_domestic_stages').first()).fixtures_json)).toHaveLength(3840);
 expect(await count('season_calendars')).toBe(0);
 const previous=cmd(),saved=await advanceAdministrativeClock(db,session,'advance',previous,'automatic-day4-0001',now);
 world=saved.world;
 expect(world).toMatchObject({day:4,phase:'active',revision:previous.expectedRevision+1});
 expect(await advanceAdministrativeClock(db,session,'advance',previous,'automatic-day4-0001',now)).toEqual(saved);
 expect(await count('season_draws')).toBe(2);
 expect(JSON.parse((await db.prepare('SELECT calendar_json FROM season_calendars').first()).calendar_json).fixtures).toHaveLength(3984);
 const projection=await readAdministrativeCalendar(db);
 expect(projection.mode).toBe('sporting');
 expect(projection.events.filter(e=>e.scope!=='season').every(e=>e.hasReceipt&&e.status==='completed')).toBe(true);
 const receipts=(await db.prepare('SELECT day,outcome_json,outcome_hash FROM season_day_outcomes ORDER BY day').all()).results;
 expect(receipts.map((r:{day:number})=>r.day)).toEqual([1,2,3,4]);
 for(const r of receipts)expect(r.outcome_hash).toBe(await canonicalHash(JSON.parse(r.outcome_json)));
 world=(await executeLifecycle(db,session,'advance',cmd(),'automatic-sporting-day5',now)).world;
 expect(world.day).toBe(5);
});
it('rolls back same-day draw, publication, receipts and time on late audit failure',async()=>{
 for(const k of ['start','day2','day3'])await advance('automatic-rollback-'+k);
 const before=await readWorld(db);
 await db.prepare("CREATE TRIGGER fail_auto BEFORE INSERT ON admin_operations WHEN NEW.command='advance-admin-calendar-v1' BEGIN SELECT RAISE(ABORT,'late failure'); END").run();
 try{await expect(advance('automatic-failed-day4')).rejects.toMatchObject({status:503})}
 finally{await db.prepare('DROP TRIGGER fail_auto').run()}
 expect(await readWorld(db)).toEqual(before);
 for(const table of ['season_draws','season_calendars','season_day_outcomes'])expect(await count(table)).toBe(0);
 expect((await readAdministrativeCalendar(db)).events.filter(e=>e.status==='completed')).toHaveLength(3);
 await advance('automatic-retry-day4');
 expect(world.day).toBe(4);
});
it('allows one winner for competing same-revision artifact advances',async()=>{
 for(const k of ['start','day2','day3'])await advance('automatic-race-'+k);
 const before=cmd();
 const results=await Promise.allSettled(['a','b'].map(k=>advanceAdministrativeClock(db,session,'advance',before,'automatic-race-final-'+k,now)));
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{status:409}});
 expect((await readWorld(db)).revision).toBe(before.expectedRevision+1);
 expect(await count('season_draws')).toBe(2);
 expect(await count('season_calendars')).toBe(1);
});
it('respects independently moved draw and publication through the last administrative day',async()=>{
 world=(await rescheduleSeasonEvent(db,session,{...cmd(),eventId:'international:calendar',day:12,order:2},'automatic-move-publish',now)).world;
 world=(await rescheduleSeasonEvent(db,session,{...cmd(),eventId:'international:draw',day:4,order:1},'automatic-move-draw',now)).world;
 while(world.day<5)await advance('automatic-moved-day-'+(world.day+1));
 expect(await count('season_draws')).toBe(2);
 expect(await count('season_calendars')).toBe(0);
 while(world.day<13)await advance('automatic-moved-day-'+(world.day+1));
 expect(world.day).toBe(13);
 const rows=(await db.prepare('SELECT day,outcome_json FROM season_day_outcomes ORDER BY day').all()).results;
 expect(rows).toHaveLength(13);
 expect(JSON.parse(rows[12].outcome_json).results.length).toBeGreaterThan(0);
 world=(await executeLifecycle(db,session,'advance',cmd(),'automatic-moved-day14',now)).world;
 expect(world.day).toBe(14);
},120000);
it('rejects a forged completed confirmation without changing world or artifacts',async()=>{
 await advance('automatic-forged-start');
 await advance('automatic-forged-day2');
 // Simulate out-of-band storage corruption, then restore the production trigger.
 const trigger=await db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='season_admin_event_no_retroactive_update'").first();
 await db.prepare('DROP TRIGGER season_admin_event_no_retroactive_update').run();
 try{await db.prepare("UPDATE season_admin_events SET receipt_hash=? WHERE event_id='domestic:entrants'").bind('0'.repeat(64)).run()}
 finally{await db.prepare(trigger.sql).run()}
 const before=await readWorld(db);
 await expect(advance('automatic-forged-day3')).rejects.toMatchObject({status:422});
 expect(await readWorld(db)).toEqual(before);
 expect(await count('season_domestic_stages')).toBe(0);
});
it('rejects an overdue milestone without silently generating retroactive artifacts',async()=>{
 await advance('automatic-overdue-start');
 await db.prepare("UPDATE world_state SET day=2").run();world=await readWorld(db);
 await expect(advance('automatic-overdue-advance')).rejects.toMatchObject({status:409});
 expect(await readWorld(db)).toEqual(world);
 expect(await count('season_domestic_stages')).toBe(0);
});
it('rejects missing persisted stage evidence for a completed domestic event',async()=>{
 for(const k of ['start','day2','day3'])await advance('automatic-missing-'+k);
 await db.prepare('DELETE FROM season_domestic_stages').run();
 const before=await readWorld(db);
 await expect(advance('automatic-missing-day4')).rejects.toMatchObject({status:422});
 expect(await readWorld(db)).toEqual(before);
 expect(await count('season_draws')).toBe(0);
});
it('rejects draw evidence inserted ahead of its owning event',async()=>{
 await advance('automatic-extra-start');
 await db.prepare('INSERT INTO season_draws VALUES(?,?,?,?,?,?,?,?,?)').bind(1,'int-1','league','initial-leagues-v1','0123456789abcdef','0'.repeat(64),'{}','generated',now).run();
 const before=await readWorld(db);
 await expect(advance('automatic-extra-day2')).rejects.toMatchObject({status:422});
 expect(await readWorld(db)).toEqual(before);
 expect((await readAdministrativeCalendar(db)).events.every(e=>e.status==='scheduled')).toBe(true);
});
it('aborts when stage evidence disappears between validation and transaction commit',async()=>{
 for(const k of ['start','day2','day3'])await advance('automatic-replaced-'+k);
 const before=await readWorld(db);
 const racingDb={prepare:db.prepare.bind(db),batch:async(statements:any[])=>{
  if(statements.length>1)await db.prepare('DELETE FROM season_domestic_stages').run();
  return db.batch(statements);
 }};
 await expect(advanceAdministrativeClock(racingDb,session,'advance',cmd(),'automatic-replaced-day4',now)).rejects.toMatchObject({status:503});
 expect(await readWorld(db)).toEqual(before);
 for(const table of ['season_draws','season_calendars','season_day_outcomes'])expect(await count(table)).toBe(0);
});
it('rechecks live credentials at commit and rolls back all planned artifacts on revocation',async()=>{
 for(const k of ['start','day2','day3'])await advance('automatic-revoked-'+k);
 const before=await readWorld(db);
 const racingDb={prepare:db.prepare.bind(db),batch:async(statements:any[])=>{
  if(statements.length>1)await db.prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?').bind(session.actor.id).run();
  return db.batch(statements);
 }};
 await expect(advanceAdministrativeClock(racingDb,session,'advance',cmd(),'automatic-revoked-day4',now)).rejects.toMatchObject({status:401});
 expect(await readWorld(db)).toEqual(before);
 for(const table of ['season_draws','season_calendars','season_day_outcomes'])expect(await count(table)).toBe(0);
});
