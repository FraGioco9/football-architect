import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {prepareSeason} from '../src/commands.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {advanceAdministrativeClock} from '../src/admin-calendar-clock.ts';
import {completeConfirmationEvent} from '../src/admin-calendar-confirm.ts';
import {readWorld} from '../src/world-repository.ts';
import {readAdministrativeCalendar} from '../src/admin-calendar-read.ts';
import {handleAdmin} from '../src/http-admin.ts';
import {csrfFor,hashText,type AdminSession} from '../src/auth.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000),token='f'.repeat(64);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>;
const cmd=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await db.batch(['DELETE FROM season_domestic_stages','DELETE FROM season_admin_events','DELETE FROM season_knockout_ties','DELETE FROM season_day_outcomes','DELETE FROM season_draws','DELETE FROM season_calendars','DELETE FROM admin_operations','DELETE FROM seasons','DELETE FROM admin_sessions','DELETE FROM admin_accounts',"UPDATE world_state SET revision=0,season_number=0,day=0,phase='unstarted'"].map(q=>db.prepare(q)));
 const csrf=await csrfFor(token);
 session={actor:{id:'clock-operator',email:'clock@example.invalid'},digest:await digestOpaqueToken(token),credentialVersion:1,csrfDigest:await hashText(csrf)};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic',now-100).run();
 await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(session.digest,session.actor.id,1,session.csrfDigest,now-100,now-10,now+1000).run();
 world=await readWorld(db);
 world=(await prepareSeason(db,session,cmd(),'clock-prepare-synthetic-0001',await loadApprovedSnapshot(),now)).world;
 world=(await initializeAdministrativeEvents(db,session,cmd(),'clock-initialize-synthetic-0001',now)).world;
});
it('activates at day 1 without inventing schedules; confirms both entrants and moves to day 2',async()=>{
 world=(await advanceAdministrativeClock(db,session,'start',cmd(),'clock-start-synthetic-0001',now)).world;
 expect(world).toMatchObject({phase:'active',day:1});
 expect((await db.prepare('SELECT count(*) n FROM season_calendars').first()).n).toBe(0);
 for(const id of ['domestic:entrants','international:entrants']){
  world=(await completeConfirmationEvent(db,session,{...cmd(),eventId:id},'clock-confirm-'+id+'-synthetic',now)).world;
 }
 world=(await advanceAdministrativeClock(db,session,'advance',cmd(),'clock-day2-synthetic-0001',now)).world;
 expect(world.day).toBe(2);
 world=(await advanceAdministrativeClock(db,session,'advance',cmd(),'clock-day3-automatic-stage',now)).world;
 expect(world.day).toBe(3);
 expect((await db.prepare('SELECT count(*) n FROM season_domestic_stages').first()).n).toBe(1);
 expect((await db.prepare('SELECT count(*) n FROM season_draws').first()).n).toBe(0);
});
it('keeps duplicate start idempotent and refuses stale competing key',async()=>{
 const c=cmd(),r=await advanceAdministrativeClock(db,session,'start',c,'clock-replay-synthetic-0001',now);
 expect(await advanceAdministrativeClock(db,session,'start',c,'clock-replay-synthetic-0001',now)).toEqual(r);
 await expect(advanceAdministrativeClock(db,session,'start',c,'clock-compete-synthetic-0001',now)).rejects.toMatchObject({status:409});
});

it('projects planned and completed milestones for authenticated Admin only',async()=>{
 const planned=await readAdministrativeCalendar(db);
 expect(planned).toMatchObject({mode:'administrative',events:[{id:'domestic:entrants',day:1,status:'scheduled',hasReceipt:false}]});
 const config={DB:db,ADMIN_MODE:'local',ADMIN_ORIGIN:'http://localhost:2000'};
 const req=(cookie:string)=>new Request('http://localhost:2000/api/admin/seasons/events',{headers:{Cookie:cookie}});
 expect((await handleAdmin(req(''),config)).status).toBe(401);
 expect((await handleAdmin(req('fa_admin_local='+token),config)).status).toBe(200);
 world=(await advanceAdministrativeClock(db,session,'start',cmd(),'clock-projection-start-0001',now)).world;
 world=(await completeConfirmationEvent(db,session,{...cmd(),eventId:'domestic:entrants'},'clock-projection-confirm-0001',now)).world;
 const after=await readAdministrativeCalendar(db);
 expect(after.events.find(e=>e.id==='domestic:entrants')).toMatchObject({status:'completed',hasReceipt:true,day:1});
 expect(after.events.find(e=>e.id==='international:entrants')).toMatchObject({status:'scheduled',hasReceipt:false});
});
