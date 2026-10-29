import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {prepareSeason} from '../src/commands.ts';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {advanceAdministrativeClock} from '../src/admin-calendar-clock.ts';
import {completeConfirmationEvent} from '../src/admin-calendar-confirm.ts';
import {stageDomesticCalendar} from '../src/admin-domestic-stage.ts';
import {readWorld} from '../src/world-repository.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {csrfFor,hashText,type AdminSession} from '../src/auth.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000),token='9'.repeat(64);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>;
const command=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await db.batch(['DELETE FROM season_domestic_stages','DELETE FROM season_admin_events','DELETE FROM season_knockout_ties','DELETE FROM season_day_outcomes','DELETE FROM season_draws','DELETE FROM season_calendars','DELETE FROM admin_operations','DELETE FROM seasons','DELETE FROM admin_sessions','DELETE FROM admin_accounts',"UPDATE world_state SET revision=0,season_number=0,day=0,phase='unstarted'"].map(q=>db.prepare(q)));
 const csrf=await csrfFor(token);
 session={actor:{id:'domestic-operator',email:'domestic@example.invalid'},digest:await digestOpaqueToken(token),credentialVersion:1,csrfDigest:await hashText(csrf)};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic',now-100).run();
 await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(session.digest,session.actor.id,1,session.csrfDigest,now-100,now-10,now+1000).run();
 world=await readWorld(db);
 world=(await prepareSeason(db,session,command(),'domestic-prepare-00001',await loadApprovedSnapshot(),now)).world;
 world=(await initializeAdministrativeEvents(db,session,command(),'domestic-init-00001',now)).world;
 world=(await advanceAdministrativeClock(db,session,'start',command(),'domestic-start-00001',now)).world;
 for(const eventId of ['domestic:entrants','international:entrants'])world=(await completeConfirmationEvent(db,session,{...command(),eventId},'domestic-confirm-'+eventId,now)).world;
 world=(await advanceAdministrativeClock(db,session,'advance',command(),'domestic-day2-00001',now)).world;
});
it('stages only 3840 domestic fixtures and an immutable receipt, never a cup draw',async()=>{
 const original=command(),result=await stageDomesticCalendar(db,session,original,'domestic-stage-00001',now);
 const stage=await db.prepare('SELECT * FROM season_domestic_stages').first();
 const fixtures=JSON.parse(stage.fixtures_json);
 expect(fixtures).toHaveLength(3840);
 expect(fixtures.every((f:any)=>!f.competitionId.startsWith('int-'))).toBe(true);
 expect(stage.fixtures_hash).toBe(await canonicalHash(fixtures));
 expect((await db.prepare('SELECT count(*) n FROM season_draws').first()).n).toBe(0);
 expect((await db.prepare('SELECT count(*) n FROM season_calendars').first()).n).toBe(0);
 expect((await db.prepare("SELECT status,receipt_hash FROM season_admin_events WHERE event_id='domestic:calendar'").first()).status).toBe('completed');
 expect(await stageDomesticCalendar(db,session,original,'domestic-stage-00001',now)).toEqual(result);
 world=result.world;
 world=(await advanceAdministrativeClock(db,session,'advance',command(),'domestic-day3-00001',now)).world;
 expect(world.day).toBe(3);
});
it('refuses a day-three transition until domestic fixture evidence exists',async()=>{
 await expect(advanceAdministrativeClock(db,session,'advance',command(),'domestic-day3-too-early',now)).rejects.toMatchObject({status:409});
});
it('rolls back domestic staging on audit failure',async()=>{
 await db.prepare("CREATE TRIGGER fail_domestic_stage BEFORE INSERT ON admin_operations WHEN NEW.command='stage-domestic-calendar-v1' BEGIN SELECT RAISE(ABORT,'late stage failure'); END").run();
 try{await expect(stageDomesticCalendar(db,session,command(),'domestic-stage-failure',now)).rejects.toMatchObject({status:503})}
 finally{await db.prepare('DROP TRIGGER fail_domestic_stage').run()}
 expect((await db.prepare('SELECT count(*) n FROM season_domestic_stages').first()).n).toBe(0);
 expect((await db.prepare("SELECT status FROM season_admin_events WHERE event_id='domestic:calendar'").first()).status).toBe('scheduled');
 expect(await readWorld(db)).toEqual(world);
});
