import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {resetWorld} from '../src/reset-world-command.ts';
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
 await db.batch(['DELETE FROM season_archives','DELETE FROM season_domestic_stages','DELETE FROM season_admin_events','DELETE FROM season_knockout_ties','DELETE FROM season_day_outcomes','DELETE FROM season_draws','DELETE FROM season_calendars','DELETE FROM admin_operations','DELETE FROM seasons','DELETE FROM admin_sessions','DELETE FROM admin_accounts',"UPDATE world_state SET revision=0,season_number=0,day=0,phase='unstarted'"].map(x=>db.prepare(x)));
 const csrf=await csrfFor(token);
 session={actor:{id:'initialize-operator',email:'initialize@example.invalid'},digest:await digestOpaqueToken(token),credentialVersion:1,csrfDigest:await hashText(csrf)};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic',now-100).run();
 await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(session.digest,session.actor.id,1,session.csrfDigest,now-100,now-10,now+1000).run();
 world=await readWorld(db);
 world=(await prepareSeason(db,session,{expectedGeneration:world.generation,expectedRevision:world.revision},'initialize-prepare-synthetic-0001',await loadApprovedSnapshot(),now)).world;
});
const cmd=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});

it('purges all season state and retains admin access plus historical operation log in a single batch',async()=>{
 const before=cmd();
 world=(await initializeAdministrativeEvents(db,session,before,'reset-event-init-00001',now)).world;
 const previousGeneration=world.generation;
 const originalAudit=(await db.prepare('SELECT count(*) n FROM admin_operations').first<any>()).n;
 const resetRequest={...cmd(),confirmation:'RESET SEASON 0'};
 const outcome=await resetWorld(db,session,resetRequest,'reset-full-command-00001',now);
 expect(outcome.world).toMatchObject({phase:'unstarted',seasonNumber:0,day:0,revision:0});
 expect(outcome.world.generation).not.toEqual(previousGeneration);
 expect(await readWorld(db)).toEqual(outcome.world);
 await expect(resetWorld(db,session,resetRequest,'reset-full-command-00001',now)).rejects.toMatchObject({status:409});
 await expect(resetWorld(db,session,resetRequest,'reset-other-command-00001',now)).rejects.toMatchObject({status:409});
 const audit=await db.prepare("SELECT generation,expected_revision,resulting_revision FROM admin_operations WHERE command='reset-world-v1'").first<any>();
 expect(audit).toMatchObject({generation:previousGeneration,expected_revision:resetRequest.expectedRevision,resulting_revision:resetRequest.expectedRevision+1});
 for(const table of ['seasons','season_admin_events','season_domestic_stages','season_calendars','season_draws','season_day_outcomes','season_knockout_ties','season_archives'])
  expect((await db.prepare('SELECT count(*) n FROM '+table).first<any>()).n).toBe(0);
 expect((await db.prepare('SELECT count(*) n FROM admin_accounts').first<any>()).n).toBe(1);
 expect((await db.prepare('SELECT count(*) n FROM admin_sessions').first<any>()).n).toBe(1);
 expect((await db.prepare('SELECT count(*) n FROM admin_operations').first<any>()).n).toBe(originalAudit+1);
 await expect(initializeAdministrativeEvents(db,session,{expectedGeneration:previousGeneration,expectedRevision:world.revision},'stale-event-command-00001',now)).rejects.toMatchObject({status:409});
 const prepared=await prepareSeason(db,session,{expectedGeneration:outcome.world.generation,expectedRevision:0},'new-generation-prepare-00001',await loadApprovedSnapshot(),now);
 expect(prepared.world).toMatchObject({seasonNumber:1,phase:'preparing',revision:1});
});
it('refuses missing confirmation and atomically rolls back failed reset audit',async()=>{
 await expect(resetWorld(db,session,{...cmd(),confirmation:'RESET'},'invalid-reset-00001',now)).rejects.toMatchObject({status:422});
 world=(await initializeAdministrativeEvents(db,session,cmd(),'reset-fail-events-00001',now)).world;
 await db.prepare("CREATE TRIGGER prevent_reset_audit BEFORE INSERT ON admin_operations WHEN NEW.command='reset-world-v1' BEGIN SELECT RAISE(ABORT,'audit failure'); END").run();
 try{await expect(resetWorld(db,session,{...cmd(),confirmation:'RESET SEASON 0'},'reset-rollback-00001',now)).rejects.toMatchObject({status:503})}
 finally{await db.prepare('DROP TRIGGER prevent_reset_audit').run()}
 expect(await readWorld(db)).toEqual(world);
 expect((await db.prepare('SELECT count(*) n FROM seasons').first<any>()).n).toBe(1);
 expect((await db.prepare('SELECT count(*) n FROM season_admin_events').first<any>()).n).toBe(5);
});
