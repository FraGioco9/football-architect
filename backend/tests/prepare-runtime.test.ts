import reviewCandidate from '../catalogues/season-1.candidate.json' with {type:'json'};
import {beforeAll,beforeEach,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import * as commands from '../src/commands.ts';
import * as snapshots from '../src/catalogue-snapshot.ts';
import {readWorld} from '../src/world-repository.ts';
import type {AdminSession} from '../src/auth.ts';
import type {Database} from '../src/database.ts';
import {syntheticApproval} from './fixtures/synthetic-approval.ts';
const binding=env as any,db=binding.DB;
const now=1_800_000_000;
const session:AdminSession={actor:{id:'synthetic-operator',email:'operator@example.invalid'},digest:'a'.repeat(64),credentialVersion:1,csrfDigest:'b'.repeat(64),unified:{playerId:'synthetic-player',sessionDigest:'a'.repeat(64),csrfDigest:'b'.repeat(64)}};
let world:Awaited<ReturnType<typeof readWorld>>;
const key='synthetic-prepare-0001';
const command=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
const approved=()=>syntheticApproval(snapshots);
const prepare=async(k=key,cmd=command(),snapshot:any=approved(),database:Database=db)=>commands.prepareSeason(database,session,cmd,k,await snapshot,now);
beforeAll(async()=>{await applyD1Migrations(db,binding.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await db.batch([db.prepare('DELETE FROM admin_operations'),db.prepare('DELETE FROM seasons'),db.prepare('DELETE FROM admin_sessions'),db.prepare('DELETE FROM player_admin_operator_links'),db.prepare('DELETE FROM player_sessions'),db.prepare('DELETE FROM account_permissions'),db.prepare('DELETE FROM player_accounts'),db.prepare('DELETE FROM admin_accounts'),db.prepare("UPDATE world_state SET revision=0,season_number=0,day=0,phase='unstarted'")]);
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic-not-a-login-verifier',now-100).run();
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind('synthetic-player',session.actor.email,'synthetic',1,now-100,'active',now-100,now-100).run();
 await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)').bind('synthetic-player',session.actor.id,now-100).run();
 await db.prepare('INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(session.digest,'synthetic-player',1,session.csrfDigest,now-100,now-10,now+1000).run();
 await db.batch(['admin.access','admin.world.write'].map(permission=>db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind('synthetic-player',permission,now-100)));
 world=await readWorld(db);
});
it('prepares exactly Season 1 with immutable trusted hashes, no active state or fabricated results',async()=>{
 const snapshot=await approved();const result=await prepare();
 expect(result.world).toEqual({...world,revision:1,seasonNumber:1,phase:'preparing'});
 expect(result.operationId).toMatch(/^[0-9a-f-]{36}$/);
 expect(await readWorld(db)).toEqual(result.world);
 const row=await db.prepare('SELECT * FROM seasons').first();
 expect(row.participants_hash).toBe(snapshot.participantsHash);expect(row.rules_hash).toBe(snapshot.rulesHash);
 expect(JSON.parse(row.snapshot_json).bindings).toHaveLength(18);
 const audit=await db.prepare('SELECT * FROM admin_operations').all();expect(audit.results).toHaveLength(1);
 for(const secret of [session.digest,session.csrfDigest,session.actor.email,'password'])expect(JSON.stringify(audit.results)).not.toContain(secret);
});
it('replays the saved outcome for concurrent identical keys with one durable mutation',async()=>{
 const results=await Promise.all([prepare(),prepare(),prepare()]);expect(results[1]).toEqual(results[0]);expect(results[2]).toEqual(results[0]);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM admin_operations').first()).n).toBe(1);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM seasons').first()).n).toBe(1);
 expect((await readWorld(db)).revision).toBe(1);expect(await prepare()).toEqual(results[0]);
});
it('rejects conflicting replay including another actor and does not change the saved outcome',async()=>{
 const first=await prepare();await expect(prepare(key,{...command(),expectedRevision:1})).rejects.toMatchObject({status:409});
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind('other','other@example.invalid','synthetic',now-100).run();
 await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)').bind('synthetic-player','other',now-100).run();
 await expect(commands.prepareSeason(db,{...session,actor:{id:'other',email:'other@example.invalid'}},command(),key,await approved(),now)).rejects.toMatchObject({status:409});
 expect(await readWorld(db)).toEqual(first.world);
});
it('allows only one winner for concurrent different keys at the same revision',async()=>{
 const results=await Promise.allSettled([prepare(),prepare('synthetic-prepare-0002')]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect(results.filter(r=>r.status==='rejected').map((r:any)=>r.reason.status)).toEqual([409]);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM admin_operations').first()).n).toBe(1);
});
it('rejects stale world metadata and absent approval without any mutation',async()=>{
 for(const cmd of [{...command(),expectedRevision:1},{...command(),expectedGeneration:crypto.randomUUID()}])await expect(prepare(key,cmd)).rejects.toMatchObject({status:409});
 await expect(prepare(key,command(),null)).rejects.toMatchObject({status:422,code:'catalogue_not_approved'});
 expect(await readWorld(db)).toEqual(world);expect((await db.prepare('SELECT COUNT(*) AS n FROM seasons').first()).n).toBe(0);
});
it('rechecks Player recovery, operator disable, logout and expiry before mutation',async()=>{
 for(const [sql,status] of [
  ['UPDATE player_accounts SET credential_version=2',401],
  ['UPDATE admin_accounts SET enabled=0',403],
  ['UPDATE player_sessions SET expires_at='+now,401],
  ['UPDATE player_sessions SET created_at='+(now-700000)+',last_seen_at='+(now-700000),401]
 ] as const){
  await db.prepare(sql).run();
  await expect(prepare()).rejects.toMatchObject({status});
  await db.prepare('UPDATE player_accounts SET credential_version=1').run();
  await db.prepare('UPDATE admin_accounts SET enabled=1').run();
  await db.prepare('UPDATE player_sessions SET created_at=?,expires_at=?,last_seen_at=?').bind(now-100,now+1000,now-10).run();
 }
 await db.prepare('DELETE FROM player_sessions').run();
 await expect(prepare()).rejects.toMatchObject({status:401});
 expect(await readWorld(db)).toEqual(world);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM admin_operations').first()).n).toBe(0);
});
it('does not return an idempotent outcome to a revoked session',async()=>{
 await prepare();await db.prepare('UPDATE player_accounts SET credential_version=2').run();
 await expect(prepare()).rejects.toMatchObject({status:401});
});
it('rolls back world, season and audit when a later audit insert fails',async()=>{
 await db.prepare("CREATE TRIGGER synthetic_late_failure BEFORE INSERT ON admin_operations BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END").run();
 try{await expect(prepare()).rejects.toMatchObject({status:503});}finally{await db.prepare('DROP TRIGGER synthetic_late_failure').run()}
 expect(await readWorld(db)).toEqual(world);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM seasons').first()).n).toBe(0);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM admin_operations').first()).n).toBe(0);
});
it('checks recovery inside the actual mutation batch rather than trusting an earlier read',async()=>{
 const raced:Database={prepare:db.prepare.bind(db),async batch(statements){
  await db.prepare('UPDATE player_accounts SET credential_version=2').run();return db.batch(statements);
 }};
 await expect(prepare(key,command(),approved(),raced)).rejects.toMatchObject({status:401});
 expect(await readWorld(db)).toEqual(world);expect((await db.prepare('SELECT COUNT(*) AS n FROM seasons').first()).n).toBe(0);
});

it('treats storage failure as unavailable rather than invalid credentials',async()=>{
 const unavailable:Database={prepare(){throw Error('private SQL detail')},async batch(){throw Error('private SQL detail')}};
 await expect(prepare(key,command(),approved(),unavailable)).rejects.toMatchObject({status:503,code:'prepare_unavailable'});
});
it('refuses structural approval objects that never passed server validation',async()=>{
 const snapshot=await approved();await expect(prepare(key,command(),structuredClone(snapshot))).rejects.toMatchObject({status:422});
 expect(await readWorld(db)).toEqual(world);
});

it('rejects a complete pending-review candidate at the D1 command boundary with zero writes',async()=>{
 for(const candidate of [reviewCandidate,reviewCandidate.manifest,{...reviewCandidate.manifest,approvalReference:'forged-owner-approval'}])
  await expect(prepare(key,command(),candidate)).rejects.toMatchObject({status:422,code:'catalogue_not_approved'});
 expect(await readWorld(db)).toEqual(world);
 for(const table of ['seasons','admin_operations'])expect((await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n).toBe(0);
});
