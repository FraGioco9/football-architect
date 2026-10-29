import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {generateSeasonCalendar} from '../src/calendar-command.ts';
import {prepareSeason} from '../src/commands.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {readWorld} from '../src/world-repository.ts';
import {csrfFor,hashText,type AdminSession} from '../src/auth.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000),token='e'.repeat(64);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>;
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await db.batch(['DELETE FROM season_admin_events','DELETE FROM season_knockout_ties','DELETE FROM season_day_outcomes','DELETE FROM season_draws','DELETE FROM season_calendars','DELETE FROM admin_operations','DELETE FROM seasons','DELETE FROM admin_sessions','DELETE FROM admin_accounts',"UPDATE world_state SET revision=0,season_number=0,day=0,phase='unstarted'"].map(x=>db.prepare(x)));
 const csrf=await csrfFor(token);
 session={actor:{id:'initialize-operator',email:'initialize@example.invalid'},digest:await digestOpaqueToken(token),credentialVersion:1,csrfDigest:await hashText(csrf)};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic',now-100).run();
 await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(session.digest,session.actor.id,1,session.csrfDigest,now-100,now-10,now+1000).run();
 world=await readWorld(db);
 world=(await prepareSeason(db,session,{expectedGeneration:world.generation,expectedRevision:world.revision},'initialize-prepare-synthetic-0001',await loadApprovedSnapshot(),now)).world;
});
const cmd=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
it('atomically seeds five ordered milestones without inventing games or draws, and replays',async()=>{
 const c=cmd(),a=await initializeAdministrativeEvents(db,session,c,'initialize-events-synthetic-0001',now);
 expect(a.world.revision).toBe(c.expectedRevision+1);
 expect((await db.prepare('SELECT event_id,scheduled_day,event_order FROM season_admin_events ORDER BY scheduled_day,event_order').all()).results.map((e:any)=>[e.event_id,e.scheduled_day,e.event_order])).toEqual([
 ['domestic:entrants',1,1],['international:entrants',1,2],['domestic:calendar',2,1],['international:draw',3,1],['international:calendar',3,2]]);
 expect((await db.prepare('SELECT count(*) n FROM season_calendars').first()).n).toBe(0);
 expect((await db.prepare('SELECT count(*) n FROM season_draws').first()).n).toBe(0);
 expect(await initializeAdministrativeEvents(db,session,c,'initialize-events-synthetic-0001',now)).toEqual(a);
 await expect(generateSeasonCalendar(db,session,{...c,expectedRevision:a.world.revision},'legacy-calendar-blocked-0001',now)).rejects.toMatchObject({status:409});
});
it('refuses to initialize future events over already-published Season 1 fixtures',async()=>{
 const c=cmd();world=(await generateSeasonCalendar(db,session,c,'legacy-calendar-first-0001',now)).world;
 await expect(initializeAdministrativeEvents(db,session,cmd(),'initialize-after-legacy-0001',now)).rejects.toMatchObject({status:409});
 expect((await db.prepare('SELECT count(*) n FROM season_admin_events').first()).n).toBe(0);
});
it('rolls back all milestones, revision and audit on late failure',async()=>{
 await db.prepare("CREATE TRIGGER event_init_fail BEFORE INSERT ON admin_operations WHEN NEW.command='initialize-admin-events-v1' BEGIN SELECT RAISE(ABORT,'late failure'); END").run();
 try{await expect(initializeAdministrativeEvents(db,session,cmd(),'initialize-fail-synthetic-0001',now)).rejects.toMatchObject({status:503})}
 finally{await db.prepare('DROP TRIGGER event_init_fail').run()}
 expect((await db.prepare('SELECT count(*) n FROM season_admin_events').first()).n).toBe(0);
 expect(await readWorld(db)).toEqual(world);
});
