import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {prepareSeason} from '../src/commands.ts';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {advanceAdministrativeClock} from '../src/admin-calendar-clock.ts';
import {completeConfirmationEvent} from '../src/admin-calendar-confirm.ts';
import {stageDomesticCalendar} from '../src/admin-domestic-stage.ts';
import {executeInternationalDraw} from '../src/admin-international-draw.ts';
import {publishInternationalCalendar} from '../src/admin-calendar-publish.ts';
import {executeLifecycle} from '../src/lifecycle-command.ts';
import {rescheduleSeasonEvent} from '../src/admin-calendar-command.ts';
import {readWorld} from '../src/world-repository.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {csrfFor,hashText,type AdminSession} from '../src/auth.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000),token='7'.repeat(64);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>;
const meta=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await db.batch(['DELETE FROM season_domestic_stages','DELETE FROM season_admin_events','DELETE FROM season_knockout_ties','DELETE FROM season_day_outcomes','DELETE FROM season_draws','DELETE FROM season_calendars','DELETE FROM admin_operations','DELETE FROM seasons','DELETE FROM admin_sessions','DELETE FROM admin_accounts',"UPDATE world_state SET revision=0,season_number=0,day=0,phase='unstarted'"].map(q=>db.prepare(q)));
 const csrf=await csrfFor(token);
 session={actor:{id:'bridge-operator',email:'bridge@example.invalid'},digest:await digestOpaqueToken(token),credentialVersion:1,csrfDigest:await hashText(csrf)};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic',now-100).run();
 await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(session.digest,session.actor.id,1,session.csrfDigest,now-100,now-10,now+1000).run();
 world=await readWorld(db);
 world=(await prepareSeason(db,session,meta(),'bridge-prepare-00001',await loadApprovedSnapshot(),now)).world;
 world=(await initializeAdministrativeEvents(db,session,meta(),'bridge-initialize-00001',now)).world;
 world=(await advanceAdministrativeClock(db,session,'start',meta(),'bridge-start-00001',now)).world;
 for(const eventId of ['domestic:entrants','international:entrants'])world=(await completeConfirmationEvent(db,session,{...meta(),eventId},'bridge-confirm-'+eventId,now)).world;
 world=(await advanceAdministrativeClock(db,session,'advance',meta(),'bridge-day2-00001',now)).world;
 world=(await stageDomesticCalendar(db,session,meta(),'bridge-domestic-00001',now)).world;
 world=(await advanceAdministrativeClock(db,session,'advance',meta(),'bridge-day3-00001',now)).world;
});
it('runs distinct domestic, draw and publication transactions before handing off to sporting day 4',async()=>{
 await expect(publishInternationalCalendar(db,session,meta(),'bridge-premature-calendar-00001',now)).rejects.toMatchObject({status:409});
 world=(await executeInternationalDraw(db,session,meta(),'bridge-draw-00001',now)).world;
 expect((await db.prepare('SELECT count(*) n FROM season_draws').first<any>()).n).toBe(2);
 expect((await db.prepare('SELECT count(*) n FROM season_calendars').first<any>()).n).toBe(0);
 const before=meta(),published=await publishInternationalCalendar(db,session,before,'bridge-publish-00001',now);
 world=published.world;
 expect(await publishInternationalCalendar(db,session,before,'bridge-publish-00001',now)).toEqual(published);
 const calendar=await db.prepare('SELECT calendar_json FROM season_calendars').first<any>();
 expect(JSON.parse(calendar.calendar_json).fixtures).toHaveLength(3984);
 const receipts=(await db.prepare('SELECT day,outcome_json,outcome_hash FROM season_day_outcomes ORDER BY day').all<any>()).results;
 expect(receipts.map(r=>r.day)).toEqual([1,2,3]);
 for(const r of receipts){expect(JSON.parse(r.outcome_json).results).toEqual([]);expect(r.outcome_hash).toBe(await canonicalHash(JSON.parse(r.outcome_json)));}
 expect((await db.prepare("SELECT count(*) n FROM season_admin_events WHERE status='completed'").first<any>()).n).toBe(5);
 world=(await executeLifecycle(db,session,'advance',meta(),'bridge-sporting-day4-00001',now)).world;
 expect(world.day).toBe(4);
 expect((await db.prepare('SELECT count(*) n FROM season_day_outcomes').first<any>()).n).toBe(4);
});
it('keeps draw and calendar publication atomic if final audit rejects',async()=>{
 await db.prepare("CREATE TRIGGER fail_draw BEFORE INSERT ON admin_operations WHEN NEW.command='execute-international-draw-v1' BEGIN SELECT RAISE(ABORT,'late failure'); END").run();
 try{await expect(executeInternationalDraw(db,session,meta(),'bridge-draw-fail-00001',now)).rejects.toMatchObject({status:503})}
 finally{await db.prepare('DROP TRIGGER fail_draw').run()}
 expect((await db.prepare('SELECT count(*) n FROM season_draws').first<any>()).n).toBe(0);
 world=(await executeInternationalDraw(db,session,meta(),'bridge-draw-good-00001',now)).world;
 await db.prepare("CREATE TRIGGER fail_publish BEFORE INSERT ON admin_operations WHEN NEW.command='publish-international-calendar-v1' BEGIN SELECT RAISE(ABORT,'late failure'); END").run();
 try{await expect(publishInternationalCalendar(db,session,meta(),'bridge-publish-fail-00001',now)).rejects.toMatchObject({status:503})}
 finally{await db.prepare('DROP TRIGGER fail_publish').run()}
 expect((await db.prepare('SELECT count(*) n FROM season_calendars').first<any>()).n).toBe(0);
 expect((await db.prepare('SELECT count(*) n FROM season_day_outcomes').first<any>()).n).toBe(0);
 expect((await db.prepare("SELECT status FROM season_admin_events WHERE event_id='international:calendar'").first<any>()).status).toBe('scheduled');
});

it('moves the independent international draw to day four and publication to day five without losing early-day receipts',async()=>{
 // Only future events are movable: build a new plan from the still-eligible day-two state.
 await db.prepare("UPDATE world_state SET day=2").run();
 world=await readWorld(db);
 world=(await rescheduleSeasonEvent(db,session,{...meta(),eventId:'international:calendar',day:5,order:2},'bridge-move-calendar-day5',now)).world;
 world=(await rescheduleSeasonEvent(db,session,{...meta(),eventId:'international:draw',day:4,order:1},'bridge-move-draw-day4',now)).world;
 world=(await advanceAdministrativeClock(db,session,'advance',meta(),'bridge-moved-day3',now)).world;
 expect(world.day).toBe(3);
 world=(await advanceAdministrativeClock(db,session,'advance',meta(),'bridge-moved-day4',now)).world;
 world=(await executeInternationalDraw(db,session,meta(),'bridge-moved-draw',now)).world;
 world=(await advanceAdministrativeClock(db,session,'advance',meta(),'bridge-moved-day5',now)).world;
 world=(await publishInternationalCalendar(db,session,meta(),'bridge-moved-publication',now)).world;
 const rows=(await db.prepare('SELECT day,outcome_json FROM season_day_outcomes ORDER BY day').all<any>()).results;
 expect(rows.map(r=>r.day)).toEqual([1,2,3,4,5]);
 expect(rows.every(r=>JSON.parse(r.outcome_json).results.length===0)).toBe(true);
 world=(await executeLifecycle(db,session,'advance',meta(),'bridge-moved-day6',now)).world;
 expect(world.day).toBe(6);
});
