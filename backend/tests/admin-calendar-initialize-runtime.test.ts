import {clearTestWorld} from './fixtures/test-world.ts';
import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {generateSeasonCalendar} from '../src/calendar-command.ts';
import {prepareSeason} from '../src/commands.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {readWorld} from '../src/world-repository.ts';
import {type AdminSession} from '../src/auth.ts';
import {playerCsrfFor} from '../src/player-auth.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000),token='e'.repeat(64);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>;
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await clearTestWorld(db);
 const csrf=await playerCsrfFor(token);
 session={actor:{id:'initialize-operator',email:'initialize@example.invalid'},digest:await digestOpaqueToken(token),credentialVersion:1,csrfDigest:await digestOpaqueToken(csrf),unified:{playerId:'initialize-player',sessionDigest:await digestOpaqueToken(token),csrfDigest:await digestOpaqueToken(csrf)}};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic',now-100).run();
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind('initialize-player',session.actor.email,'synthetic',1,now-100,'active',now-100,now-100).run();
 await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)').bind('initialize-player',session.actor.id,now-100).run();
 await db.prepare('INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(session.digest,'initialize-player',1,session.csrfDigest,now-100,now-10,now+1000).run();
 await db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind('initialize-player',permission,now-100)));
 world=await readWorld(db);
 world=(await prepareSeason(db,session,{expectedGeneration:world.generation,expectedRevision:world.revision},'initialize-prepare-synthetic-0001',await loadApprovedSnapshot(),now)).world;
});
const cmd=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
it('atomically seeds eight ordered milestones without inventing games or draws, and replays',async()=>{
 const c=cmd(),a=await initializeAdministrativeEvents(db,session,c,'initialize-events-synthetic-0001',now);
 expect(a.world.revision).toBe(c.expectedRevision+1);
 expect((await db.prepare('SELECT event_id,scheduled_day,event_order FROM season_admin_events ORDER BY scheduled_day,event_order').all()).results.map((e:any)=>[e.event_id,e.scheduled_day,e.event_order])).toEqual([
 ['domestic:entrants',1,1],['international:entrants',1,2],['domestic:calendar',2,1],['international:draw',3,1],['international:calendar',3,2],['season:archive',56,9000],['season:close',56,9100],['season:next-prepare',56,9200]]);
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
 await db.prepare("CREATE TRIGGER event_init_fail BEFORE INSERT ON admin_operations WHEN NEW.command='initialize-admin-events-v2' BEGIN SELECT RAISE(ABORT,'late failure'); END").run();
 try{await expect(initializeAdministrativeEvents(db,session,cmd(),'initialize-fail-synthetic-0001',now)).rejects.toMatchObject({status:503})}
 finally{await db.prepare('DROP TRIGGER event_init_fail').run()}
 expect((await db.prepare('SELECT count(*) n FROM season_admin_events').first()).n).toBe(0);
 expect(await readWorld(db)).toEqual(world);
});
