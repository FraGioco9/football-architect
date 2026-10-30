import {seedUnifiedOperator} from './fixtures/unified-operator.ts';
import {clearTestWorld} from './fixtures/test-world.ts';
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
import {closeSeason} from '../src/season-close-command.ts';
import {archiveSeason} from '../src/season-archive-command.ts';
import {readSeasonArchives} from '../src/season-archive-read.ts';
import {readSeasonTwoCandidate} from '../src/season-two-candidate-read.ts';
import {handleAdmin} from '../src/http-admin.ts';
import {seedUnifiedAdminHttp} from './fixtures/unified-admin-http.ts';
import {rescheduleSeasonEvent} from '../src/admin-calendar-command.ts';
import {readWorld} from '../src/world-repository.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {type AdminSession} from '../src/auth.ts';

const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000),token='7'.repeat(64);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>;
const meta=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await clearTestWorld(db);
 session=(await seedUnifiedOperator(db,'bridge-operator','bridge@example.invalid',now,token)).session;
 world=await readWorld(db);
 world=(await prepareSeason(db,session,meta(),'bridge-prepare-00001',await loadApprovedSnapshot(),now)).world;
 world=(await initializeAdministrativeEvents(db,session,meta(),'bridge-initialize-00001',now)).world;
 world=(await advanceAdministrativeClock(db,session,'start',meta(),'bridge-start-00001',now)).world;
 for(const eventId of ['domestic:entrants','international:entrants'])world=(await completeConfirmationEvent(db,session,{...meta(),eventId},'bridge-confirm-'+eventId,now)).world;
 world=(await advanceAdministrativeClock(db,session,'advance',meta(),'bridge-day2-00001',now)).world;
 world=(await stageDomesticCalendar(db,session,meta(),'bridge-domestic-00001',now)).world;
});
it('runs distinct domestic, draw and publication transactions before handing off to sporting day 4',async()=>{
 world=(await advanceAdministrativeClock(db,session,'advance',meta(),'bridge-day3-00001',now)).world;
 await expect(publishInternationalCalendar(db,session,meta(),'bridge-premature-calendar-00001',now)).rejects.toMatchObject({status:409});
 world=(await executeInternationalDraw(db,session,meta(),'bridge-draw-00001',now)).world;
 expect((await db.prepare('SELECT count(*) n FROM season_draws').first()).n).toBe(2);
 expect((await db.prepare('SELECT count(*) n FROM season_calendars').first()).n).toBe(0);
 const before=meta(),published=await publishInternationalCalendar(db,session,before,'bridge-publish-00001',now);
 world=published.world;
 expect(await publishInternationalCalendar(db,session,before,'bridge-publish-00001',now)).toEqual(published);
 const calendar=await db.prepare('SELECT calendar_json FROM season_calendars').first();
 expect(JSON.parse(calendar.calendar_json).fixtures).toHaveLength(3984);
 const receipts=(await db.prepare('SELECT day,outcome_json,outcome_hash FROM season_day_outcomes ORDER BY day').all()).results;
 expect(receipts.map((r:{day:number})=>r.day)).toEqual([1,2,3]);
 for(const r of receipts){expect(JSON.parse(r.outcome_json).results).toEqual([]);expect(r.outcome_hash).toBe(await canonicalHash(JSON.parse(r.outcome_json)));}
 expect((await db.prepare("SELECT count(*) n FROM season_admin_events WHERE status='completed'").first()).n).toBe(5);
 world=(await executeLifecycle(db,session,'advance',meta(),'bridge-sporting-day4-00001',now)).world;
 expect(world.day).toBe(4);
 expect((await db.prepare('SELECT count(*) n FROM season_day_outcomes').first()).n).toBe(4);
});
it('keeps draw and calendar publication atomic if final audit rejects',async()=>{
 world=(await advanceAdministrativeClock(db,session,'advance',meta(),'bridge-day3-00001',now)).world;
 await db.prepare("CREATE TRIGGER fail_draw BEFORE INSERT ON admin_operations WHEN NEW.command='execute-international-draw-v1' BEGIN SELECT RAISE(ABORT,'late failure'); END").run();
 try{await expect(executeInternationalDraw(db,session,meta(),'bridge-draw-fail-00001',now)).rejects.toMatchObject({status:503})}
 finally{await db.prepare('DROP TRIGGER fail_draw').run()}
 expect((await db.prepare('SELECT count(*) n FROM season_draws').first()).n).toBe(0);
 world=(await executeInternationalDraw(db,session,meta(),'bridge-draw-good-00001',now)).world;
 await db.prepare("CREATE TRIGGER fail_publish BEFORE INSERT ON admin_operations WHEN NEW.command='publish-international-calendar-v1' BEGIN SELECT RAISE(ABORT,'late failure'); END").run();
 try{await expect(publishInternationalCalendar(db,session,meta(),'bridge-publish-fail-00001',now)).rejects.toMatchObject({status:503})}
 finally{await db.prepare('DROP TRIGGER fail_publish').run()}
 expect((await db.prepare('SELECT count(*) n FROM season_calendars').first()).n).toBe(0);
 expect((await db.prepare('SELECT count(*) n FROM season_day_outcomes').first()).n).toBe(0);
 expect((await db.prepare("SELECT status FROM season_admin_events WHERE event_id='international:calendar'").first()).status).toBe('scheduled');
});

it('moves the independent international draw to day four and publication to day five without losing early-day receipts',async()=>{
 // Both international events are still future events at day two.
 world=(await rescheduleSeasonEvent(db,session,{...meta(),eventId:'international:calendar',day:5,order:2},'bridge-move-calendar-day5',now)).world;
 world=(await rescheduleSeasonEvent(db,session,{...meta(),eventId:'international:draw',day:4,order:1},'bridge-move-draw-day4',now)).world;
 world=(await advanceAdministrativeClock(db,session,'advance',meta(),'bridge-moved-day3',now)).world;
 expect(world.day).toBe(3);
 world=(await advanceAdministrativeClock(db,session,'advance',meta(),'bridge-moved-day4',now)).world;
 world=(await executeInternationalDraw(db,session,meta(),'bridge-moved-draw',now)).world;
 world=(await advanceAdministrativeClock(db,session,'advance',meta(),'bridge-moved-day5',now)).world;
 world=(await publishInternationalCalendar(db,session,meta(),'bridge-moved-publication',now)).world;
 const rows=(await db.prepare('SELECT day,outcome_json FROM season_day_outcomes ORDER BY day').all()).results;
 expect(rows.map((r:{day:number})=>r.day)).toEqual([1,2,3,4,5]);
 expect(rows.every((r:{outcome_json:string})=>JSON.parse(r.outcome_json).results.length===0)).toBe(true);
 world=(await executeLifecycle(db,session,'advance',meta(),'bridge-moved-day6',now)).world;
 expect(world.day).toBe(6);
});

it('continues all sporting days through day 56 after staged administrative setup',async()=>{
 world=(await advanceAdministrativeClock(db,session,'advance',meta(),'bridge-full-day3',now)).world;
 world=(await executeInternationalDraw(db,session,meta(),'bridge-full-draw',now)).world;
 world=(await publishInternationalCalendar(db,session,meta(),'bridge-full-publish',now)).world;
 while(world.day<56)world=(await executeLifecycle(db,session,'advance',meta(),'bridge-full-day-'+(world.day+1)+'-key',now)).world;
 expect(world).toMatchObject({day:56,phase:'active'});
 const receipts=(await db.prepare('SELECT day,outcome_json FROM season_day_outcomes ORDER BY day').all()).results;
 expect(receipts).toHaveLength(56);
 expect(receipts.reduce((n:number,r:{outcome_json:string})=>n+JSON.parse(r.outcome_json).results.length,0)).toBe(4082);
 expect((await db.prepare('SELECT count(*) n FROM season_knockout_ties').first()).n).toBe(54);
},120000);

it('closes and archives exactly one fully verified season and replays the same closure',async()=>{
 world=(await advanceAdministrativeClock(db,session,'advance',meta(),'bridge-close-day3',now)).world;
 world=(await executeInternationalDraw(db,session,meta(),'bridge-close-draw',now)).world;
 world=(await publishInternationalCalendar(db,session,meta(),'bridge-close-publish',now)).world;
 while(world.day<56)world=(await executeLifecycle(db,session,'advance',meta(),'bridge-close-day-'+(world.day+1)+'-key',now)).world;
 world=(await archiveSeason(db,session,meta(),'bridge-archive-once-00001',now)).world;
 const command=meta(),saved=await closeSeason(db,session,command,'bridge-close-once-00001',now);
 expect(saved.world).toMatchObject({day:56,phase:'closed'});
 expect((await db.prepare('SELECT count(*) n FROM season_archives').first()).n).toBe(1);
 const archive=await readSeasonArchives(db);
 expect(archive.archives).toHaveLength(1);
 const next=await readSeasonTwoCandidate(db);
 expect(next.candidate).toMatchObject({season:2,status:'provisional-results-derived'});
 expect(next.candidate.bindings).toHaveLength(18);
 expect(next.holderReview).toHaveLength(2);
 for(const holder of next.holderReview){
  expect(['int-1','int-2']).toContain(holder.competitionId);
  expect(holder.championClubId.startsWith(holder.countryId+'-')).toBe(true);
  expect(holder.requiresQualificationPolicyDecision).toBe(holder.allocatedCup!==holder.competitionId);
 }
 expect(next.requiresOwnerQualificationReview).toBe(true);
 expect(next.review.blockingReasons).toEqual(['season-two-snapshot-not-approved']);
 expect(next.holderProposal.status).toBe('approved-holder-policy-applied');
 expect(next.activation).toMatchObject({targetSeason:2,ready:false});
 for(const binding of next.candidate.bindings)expect(binding.clubIds).toHaveLength(binding.competitionId.startsWith('int-')?24:16);
 expect(archive.archives[0]).toMatchObject({seasonNumber:1,resultsCount:4082,daysCount:56,tiesCount:54});
 const env={DB:db,PLAYER_MODE:'local',PLAYER_ORIGIN:'http://localhost:2000'};
 const http=await seedUnifiedAdminHttp(db,session.actor.id,session.actor.email,now,'b'.repeat(64));
 expect((await handleAdmin(new Request('http://localhost:2000/api/admin/seasons/archives'),env)).status).toBe(401);
 const authorized=await handleAdmin(new Request('http://localhost:2000/api/admin/seasons/archives',{headers:{Cookie:http.cookie}}),env);
 expect(authorized.status).toBe(200);
 const candidateResponse=await handleAdmin(new Request('http://localhost:2000/api/admin/seasons/next-candidate',{headers:{Cookie:http.cookie}}),env);
 expect(candidateResponse.status).toBe(200);
 const replayNow=Math.floor(Date.now()/1000);
 expect(await closeSeason(db,session,command,'bridge-close-once-00001',replayNow)).toEqual(saved);
 await expect(closeSeason(db,session,command,'bridge-close-twice-00001',replayNow)).rejects.toMatchObject({status:409});
 await expect(db.prepare("UPDATE season_archives SET results_count=1").run()).rejects.toThrow();
},120000);
