import {clearTestWorld} from './fixtures/test-world.ts';
import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {generateSeasonCalendar} from '../src/calendar-command.ts';
import {prepareSeason} from '../src/commands.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {readWorld} from '../src/world-repository.ts';
import {type AdminSession} from '../src/auth.ts';
import {playerCsrfFor} from '../src/player-auth.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
import {handleAdmin} from '../src/http-admin.ts';
import type {Database} from '../src/database.ts';
const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000),token='a'.repeat(64);
let csrfToken:string;
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>;
const key='calendar-command-synthetic-0001';
const command=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
const generate=(k=key,cmd=command(),database:Database=db)=>generateSeasonCalendar(database,session,cmd,k,now);
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await clearTestWorld(db);
 session={actor:{id:'calendar-operator',email:'calendar@example.invalid'},digest:await digestOpaqueToken(token),credentialVersion:1,csrfDigest:await digestOpaqueToken(await playerCsrfFor(token)),unified:{playerId:'calendar-player',sessionDigest:await digestOpaqueToken(token),csrfDigest:await digestOpaqueToken(await playerCsrfFor(token))}};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic-not-login',now-100).run();
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind('calendar-player',session.actor.email,'synthetic',1,now-100,'active',now-100,now-100).run();
 await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)').bind('calendar-player',session.actor.id,now-100).run();
 await db.prepare('INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(session.digest,'calendar-player',1,session.csrfDigest,now-100,now-10,now+1000).run();
 await db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind('calendar-player',permission,now-100)));
 csrfToken=await playerCsrfFor(token);
 world=await readWorld(db);
 await prepareSeason(db,session,command(),'calendar-prepare-synthetic',await loadApprovedSnapshot(),now);
 world=await readWorld(db);
});
it('atomically saves 3984 actual fixtures, both draw outcomes, server seed, immutable hashes and one revision without starting season',async()=>{
 const result=await generate();expect(result.world).toEqual({...world,revision:2});
 const row=await db.prepare('SELECT * FROM season_calendars').first(),value=JSON.parse(row.calendar_json);
 expect(value.fixtures).toHaveLength(3984);expect(row.calendar_hash).toBe(await canonicalHash(value));
 expect(row.status).toBe('generated');expect(value.scope).toBe('initial-leagues');
 const draws=(await db.prepare('SELECT * FROM season_draws ORDER BY competition_id').all()).results;
 expect(draws).toHaveLength(2);
 for(const draw of draws){const outcome=JSON.parse(draw.outcome_json);expect(outcome.fixtures).toHaveLength(72);expect(draw.seed).toBe(value.seed);expect(draw.outcome_hash).toBe(await canonicalHash(outcome));expect(outcome.pots.map((p:string[])=>p.length)).toEqual([8,8,8]);}
 const audit=await db.prepare("SELECT * FROM admin_operations WHERE command='generate-calendar-v1'").first();
 expect(audit.account_id).toBe(session.actor.id);expect(audit.resulting_revision).toBe(2);expect(audit.created_at).toBe(now);
 expect(audit.outcome_json).not.toContain(value.seed);expect(audit.outcome_json).not.toContain(session.digest);
});
it('concurrent identical keys replay one durable random seed, revision and audit; different keys cannot replace it',async()=>{
 const results=await Promise.all([generate(),generate(),generate()]);expect(results[1]).toEqual(results[0]);expect(results[2]).toEqual(results[0]);
 expect(await generate()).toEqual(results[0]);expect((await db.prepare('SELECT count(*) n FROM season_calendars').first()).n).toBe(1);
 expect((await db.prepare("SELECT count(*) n FROM admin_operations WHERE command='generate-calendar-v1'").first()).n).toBe(1);
 await expect(generate(key,{...command(),expectedRevision:2})).rejects.toMatchObject({status:409,code:'idempotency_conflict'});
 await expect(generate('calendar-new-key-synthetic',{...command(),expectedRevision:2})).rejects.toMatchObject({status:409});
});
it('only one concurrent distinct-key winner commits at the same revision',async()=>{
 const results=await Promise.allSettled([generate(),generate('calendar-competing-key-0002')]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected').map((r:any)=>r.reason.status)).toEqual([409]);
 expect((await readWorld(db)).revision).toBe(2);
});
it('rejects forged inputs, stale metadata, invalid phase and missing/corrupt authoritative snapshot without writes',async()=>{
 for(const cmd of [{...command(),expectedRevision:0},{...command(),expectedGeneration:crypto.randomUUID()},{...command(),seed:'client-supplied-seed'}])await expect(generate(key,cmd)).rejects.toMatchObject({status:cmd.expectedRevision===world.revision&&'seed' in cmd?422:409});
 await db.prepare("UPDATE world_state SET phase='active',day=1").run();await expect(generate()).rejects.toMatchObject({status:422});
 await db.prepare("UPDATE world_state SET phase='preparing',day=0").run();
 await db.prepare('DELETE FROM seasons').run();await expect(generate()).rejects.toMatchObject({status:422});
 await db.prepare('INSERT INTO seasons VALUES(1,?,?,?,?,?)').bind(world.generation,'a'.repeat(64),'b'.repeat(64),'{}',now).run();await expect(generate()).rejects.toMatchObject({status:422});
 expect((await db.prepare('SELECT count(*) n FROM season_calendars').first()).n).toBe(0);expect(await readWorld(db)).toEqual(world);
});
it('guards live session inside the commit and refuses saved outcomes after revocation',async()=>{
 const raced:Database={prepare:db.prepare.bind(db),async batch(statements){if(statements.length>1)await db.prepare('UPDATE player_accounts SET credential_version=2').run();return db.batch(statements)}};
 await expect(generate(key,command(),raced)).rejects.toMatchObject({status:401});expect(await readWorld(db)).toEqual(world);
 await db.prepare('UPDATE player_accounts SET credential_version=1').run();await generate();
 await db.prepare('DELETE FROM player_sessions').run();await expect(generate()).rejects.toMatchObject({status:401});
});
it('rolls back calendar, both draws and world if the final audit fails',async()=>{
 await db.prepare("CREATE TRIGGER calendar_late_failure BEFORE INSERT ON admin_operations WHEN NEW.command='generate-calendar-v1' BEGIN SELECT RAISE(ABORT,'synthetic late failure'); END").run();
 try{await expect(generate()).rejects.toMatchObject({status:503,code:'calendar_unavailable'})}finally{await db.prepare('DROP TRIGGER calendar_late_failure').run()}
 expect(await readWorld(db)).toEqual(world);
 for(const table of ['season_calendars','season_draws'])expect((await db.prepare(`SELECT count(*) n FROM ${table}`).first()).n).toBe(0);
});
it('HTTP requires live authentication, exact Origin, CSRF, idempotency and server-owned command shape',async()=>{
 const config={DB:db,PLAYER_MODE:'local',PLAYER_ORIGIN:'http://localhost:2000'};
 const request=(headers:Record<string,string>={},body:unknown=command())=>new Request('http://localhost:2000/api/admin/seasons/calendar',{method:'POST',headers:{'Content-Type':'application/json',Origin:config.PLAYER_ORIGIN,Cookie:'fa_player_local='+token,'X-CSRF-Token':csrfToken,'Idempotency-Key':key,...headers},body:JSON.stringify(body)});
 for(const headers of [{Cookie:''},{'X-CSRF-Token':''},{Origin:'https://evil.example'},{'Idempotency-Key':''}] as Record<string,string>[])expect((await handleAdmin(request(headers),config)).status).toBeGreaterThanOrEqual(400);
 expect((await handleAdmin(request({}, {...command(),fixtures:[]}),config)).status).toBe(422);
 const response=await handleAdmin(request(),config);expect(response.status).toBe(200);expect((await response.json() as any).world.revision).toBe(2);
});
