import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {generateSeasonCalendar} from '../src/calendar-command.ts';
import {prepareSeason} from '../src/commands.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {readWorld} from '../src/world-repository.ts';
import {csrfFor,hashText,type AdminSession} from '../src/auth.ts';
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
 await db.batch(['DELETE FROM season_domestic_stages','DELETE FROM season_admin_events','DELETE FROM season_draws','DELETE FROM season_calendars','DELETE FROM admin_operations','DELETE FROM seasons','DELETE FROM admin_sessions','DELETE FROM admin_accounts',"UPDATE world_state SET revision=0,season_number=0,day=0,phase='unstarted'"].map(s=>db.prepare(s)));
 session={actor:{id:'calendar-operator',email:'calendar@example.invalid'},digest:await digestOpaqueToken(token),credentialVersion:1,csrfDigest:await hashText(await csrfFor(token))};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic-not-login',now-100).run();
 await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(session.digest,session.actor.id,1,session.csrfDigest,now-100,now-10,now+1000).run();
 csrfToken=await csrfFor(token);
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
 const raced:Database={prepare:db.prepare.bind(db),async batch(statements){if(statements.length>1)await db.prepare('UPDATE admin_accounts SET credential_version=2').run();return db.batch(statements)}};
 await expect(generate(key,command(),raced)).rejects.toMatchObject({status:401});expect(await readWorld(db)).toEqual(world);
 await db.prepare('UPDATE admin_accounts SET credential_version=1').run();await generate();
 await db.prepare('DELETE FROM admin_sessions').run();await expect(generate()).rejects.toMatchObject({status:401});
});
it('rolls back calendar, both draws and world if the final audit fails',async()=>{
 await db.prepare("CREATE TRIGGER calendar_late_failure BEFORE INSERT ON admin_operations WHEN NEW.command='generate-calendar-v1' BEGIN SELECT RAISE(ABORT,'synthetic late failure'); END").run();
 try{await expect(generate()).rejects.toMatchObject({status:503,code:'calendar_unavailable'})}finally{await db.prepare('DROP TRIGGER calendar_late_failure').run()}
 expect(await readWorld(db)).toEqual(world);
 for(const table of ['season_calendars','season_draws'])expect((await db.prepare(`SELECT count(*) n FROM ${table}`).first()).n).toBe(0);
});
it('HTTP requires live authentication, exact Origin, CSRF, idempotency and server-owned command shape',async()=>{
 const config={DB:db,ADMIN_MODE:'local',ADMIN_ORIGIN:'http://localhost:2000'};
 const request=(headers:Record<string,string>={},body:unknown=command())=>new Request('http://localhost:2000/api/admin/seasons/calendar',{method:'POST',headers:{'Content-Type':'application/json',Origin:config.ADMIN_ORIGIN,Cookie:'fa_admin_local='+token,'X-CSRF-Token':csrfToken,'Idempotency-Key':key,...headers},body:JSON.stringify(body)});
 for(const headers of [{Cookie:''},{'X-CSRF-Token':''},{Origin:'https://evil.example'},{'Idempotency-Key':''}] as Record<string,string>[])expect((await handleAdmin(request(headers),config)).status).toBeGreaterThanOrEqual(400);
 expect((await handleAdmin(request({}, {...command(),fixtures:[]}),config)).status).toBe(422);
 const response=await handleAdmin(request(),config);expect(response.status).toBe(200);expect((await response.json() as any).world.revision).toBe(2);
});
