import {beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {linkExistingAdminOperator,revokeMigratedAdminOperator,adminOperatorMigrationInventory,adminOperatorMigrationReadiness,preflightAdminOperatorMigration,migrateAdminOperatorsBatch,revokeMigratedAdminOperatorsBatch} from '../src/admin-operator-migration.ts';
import {hashPassword} from '../src/passwords.ts';
import {playerLogin} from '../src/player-auth.ts';
const binding=env as any,db=binding.DB;
const email='migration-operator@example.invalid',password='migration-fixture-password-2026';
let verifier:string;
const now=()=>Math.floor(Date.now()/1000);
beforeAll(async()=>{await applyD1Migrations(db,binding.TEST_MIGRATIONS);verifier=await hashPassword(password)});
beforeEach(async()=>{
 await db.batch([
  db.prepare('DELETE FROM player_admin_operator_links WHERE player_account_id IN (?,?)').bind('migration-player','migration-second'),
  db.prepare('DELETE FROM account_permissions WHERE account_id IN (?,?)').bind('migration-player','migration-second'),
  db.prepare('DELETE FROM player_sessions WHERE account_id IN (?,?)').bind('migration-player','migration-second'),
  db.prepare('DELETE FROM player_accounts WHERE id IN (?,?)').bind('migration-player','migration-second'),
  db.prepare('DELETE FROM admin_accounts WHERE id IN (?,?)').bind('migration-legacy','migration-second-legacy')
 ]);
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)')
  .bind('migration-legacy',email,'historical-verifier-do-not-use',now()).run();
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
  .bind('migration-player',email,verifier,1,now()-100,'active',now()-100,now()-100).run();
});
describe('Trusted operator migration and rollback on disposable D1',()=>{
 it('migrates two explicitly mapped operators atomically and rejects a partial second mapping',async()=>{
  const insert=async()=>{
   await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)')
    .bind('migration-second-legacy','second-migration@example.invalid','historical-only',now()).run();
   await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
    .bind('migration-second','second-migration@example.invalid',verifier,1,now()-100,'active',now()-100,now()-100).run();
  };
  await insert();
  const mappings=[{playerAccountId:'migration-player',legacyAdminId:'migration-legacy'},
   {playerAccountId:'migration-second',legacyAdminId:'migration-second-legacy'}];
  await db.prepare('UPDATE player_accounts SET email_normalized=? WHERE id=?')
   .bind('mismatch@example.invalid','migration-second').run();
  await expect(migrateAdminOperatorsBatch(db,mappings,'trusted-local-operator',now())).rejects.toBeDefined();
  const none=await db.prepare('SELECT COUNT(*) AS n FROM player_admin_operator_links WHERE player_account_id IN (?,?)')
   .bind('migration-player','migration-second').first<{n:number}>();
  expect(none?.n).toBe(0);
  await db.prepare('UPDATE player_accounts SET email_normalized=? WHERE id=?')
   .bind('second-migration@example.invalid','migration-second').run();
  expect(await migrateAdminOperatorsBatch(db,mappings,'trusted-local-operator',now()))
   .toEqual({linked:2,permissionsGranted:6});
  const grants=await db.prepare('SELECT COUNT(*) AS n FROM account_permissions WHERE account_id IN (?,?)')
   .bind('migration-player','migration-second').first<{n:number}>();
  expect(grants?.n).toBe(6);
  await expect(migrateAdminOperatorsBatch(db,mappings,'trusted-local-operator',now())).rejects.toBeDefined();
 });
 it('rejects duplicate operator and Player identities before any migration writes',async()=>{
  await expect(migrateAdminOperatorsBatch(db,[
   {playerAccountId:'migration-player',legacyAdminId:'migration-legacy'},
   {playerAccountId:'migration-player',legacyAdminId:'migration-second-legacy'}
  ],'trusted-local-operator',now())).rejects.toMatchObject({status:422});
  expect(await db.prepare('SELECT 1 FROM player_admin_operator_links WHERE player_account_id=?')
   .bind('migration-player').first()).toBeNull();
 });
 it('rolls back a migrated group atomically, preserving historic operators',async()=>{
  await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)')
   .bind('migration-second-legacy','second-migration@example.invalid','historical-only',now()).run();
  await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
   .bind('migration-second','second-migration@example.invalid',verifier,1,now()-100,'active',now()-100,now()-100).run();
  const ids=['migration-player','migration-second'];
  await migrateAdminOperatorsBatch(db,[
   {playerAccountId:ids[0],legacyAdminId:'migration-legacy'},
   {playerAccountId:ids[1],legacyAdminId:'migration-second-legacy'}
  ],'trusted-local-operator',now());
  await playerLogin(db,{email,password},'local-loopback',now());
  await expect(revokeMigratedAdminOperatorsBatch(db,['migration-player','missing-player'],now())).rejects.toBeDefined();
  expect((await db.prepare('SELECT COUNT(*) AS n FROM player_admin_operator_links WHERE player_account_id IN (?,?)')
   .bind(...ids).first<{n:number}>())?.n).toBe(2);
  const result=await revokeMigratedAdminOperatorsBatch(db,ids,now());
  expect(result).toEqual({revoked:2,sessionsRevoked:1});
  expect((await db.prepare('SELECT COUNT(*) AS n FROM account_permissions WHERE account_id IN (?,?)')
   .bind(...ids).first<{n:number}>())?.n).toBe(0);
  expect((await db.prepare('SELECT COUNT(*) AS n FROM player_admin_operator_links WHERE player_account_id IN (?,?)')
   .bind(...ids).first<{n:number}>())?.n).toBe(0);
  expect((await db.prepare('SELECT COUNT(*) AS n FROM admin_accounts WHERE id IN (?,?)')
   .bind('migration-legacy','migration-second-legacy').first<{n:number}>())?.n).toBe(2);
 });
 it('preflights an explicit operator mapping without creating grants or links',async()=>{
  const plan={playerAccountId:'migration-player',legacyAdminId:'migration-legacy'};
  expect(await preflightAdminOperatorMigration(db,plan)).toEqual({eligible:true,reason:'eligible'});
  expect(await db.prepare('SELECT 1 FROM player_admin_operator_links WHERE player_account_id=?').bind(plan.playerAccountId).first()).toBeNull();
  await db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)')
   .bind(plan.playerAccountId,'admin.access',now()).run();
  expect(await preflightAdminOperatorMigration(db,plan)).toEqual({eligible:false,reason:'existing_grants'});
  await db.prepare('DELETE FROM account_permissions WHERE account_id=?').bind(plan.playerAccountId).run();
  await linkExistingAdminOperator(db,{...plan,approvedBy:'trusted-local-operator'},now());
  expect(await preflightAdminOperatorMigration(db,plan)).toEqual({eligible:false,reason:'already_linked'});
 });
 it('blocks cutover on a disabled operator still linked to Player privileges',async()=>{
  await linkExistingAdminOperator(db,{playerAccountId:'migration-player',legacyAdminId:'migration-legacy',approvedBy:'trusted-local-operator'},now());
  await db.prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?').bind('migration-legacy').run();
  const blocked=await adminOperatorMigrationReadiness(db);
  expect(blocked.ready).toBe(false);
  expect(blocked.blocked.find(row=>row.legacyAdminId==='migration-legacy')?.status).toBe('disabled_linked');
  await revokeMigratedAdminOperator(db,'migration-player',now());
  const clean=await adminOperatorMigrationReadiness(db);
  expect(clean.blocked.find(row=>row.legacyAdminId==='migration-legacy')).toBeUndefined();
  expect(clean.disabled).toBeGreaterThanOrEqual(1);
 });
 it('reports an unlinked enabled operator as rollout-blocking and a linked operator as ready',async()=>{
  const initial=await adminOperatorMigrationReadiness(db);
  const legacy=initial.blocked.find(x=>x.legacyAdminId==='migration-legacy');
  expect(legacy?.status).toBe('unlinked');
  expect(initial.ready).toBe(false);
  await linkExistingAdminOperator(db,{playerAccountId:'migration-player',legacyAdminId:'migration-legacy',approvedBy:'trusted-local-operator'},now());
  const final=await adminOperatorMigrationReadiness(db);
  expect(final.blocked.some(x=>x.legacyAdminId==='migration-legacy')).toBe(false);
  expect(final.linked).toBeGreaterThanOrEqual(1);
  await db.prepare("DELETE FROM account_permissions WHERE account_id=? AND permission='admin.world.write'").bind('migration-player').run();
  const partial=await adminOperatorMigrationReadiness(db);
  expect(partial.ready).toBe(false);
  expect(partial.blocked.find(x=>x.legacyAdminId==='migration-legacy')?.status).toBe('missing_permissions');
  await db.prepare("INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)")
   .bind('migration-player','admin.world.write',now()).run();
  await db.prepare('UPDATE player_accounts SET email_normalized=? WHERE id=?')
   .bind('changed-email@example.invalid','migration-player').run();
  const mismatch=await adminOperatorMigrationReadiness(db);
  expect(mismatch.ready).toBe(false);
  expect(mismatch.blocked.find(x=>x.legacyAdminId==='migration-legacy')?.status).toBe('invalid_player');
 });
 it('blocks the migration gate when an unlinked Player owns orphan Admin grants',async()=>{
  await linkExistingAdminOperator(db,{playerAccountId:'migration-player',legacyAdminId:'migration-legacy',approvedBy:'trusted-local-operator'},now());
  await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
   .bind('migration-second','orphan@example.invalid',verifier,1,now()-100,'active',now()-100,now()-100).run();
  await db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)')
   .bind('migration-second','admin.world.read',now()).run();
  const unsafe=await adminOperatorMigrationReadiness(db);
  expect(unsafe.ready).toBe(false);
  expect(unsafe.orphanGrants).toContain('migration-second');
  await db.prepare('DELETE FROM account_permissions WHERE account_id=?').bind('migration-second').run();
  const safe=await adminOperatorMigrationReadiness(db);
  expect(safe.ready).toBe(true);
  expect(safe.orphanGrants).toEqual([]);
 });
 it('rejects preexisting partial Admin grants before linking and preserves the original grant',async()=>{
  await db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)')
   .bind('migration-player','admin.access',now()).run();
  await expect(linkExistingAdminOperator(db,{playerAccountId:'migration-player',legacyAdminId:'migration-legacy',approvedBy:'trusted-local-operator'},now())).rejects.toBeDefined();
  const rows=await db.prepare('SELECT permission FROM account_permissions WHERE account_id=?').bind('migration-player').all<{permission:string}>();
  expect(rows.results.map(x=>x.permission)).toEqual(['admin.access']);
  const link=await db.prepare('SELECT 1 FROM player_admin_operator_links WHERE player_account_id=?').bind('migration-player').first();
  expect(link).toBeNull();
 });
 it('grants all permissions and links the exact identity in one batch, without legacy login',async()=>{
  const linked=await linkExistingAdminOperator(db,{playerAccountId:'migration-player',legacyAdminId:'migration-legacy',approvedBy:'trusted-local-operator'},now());
  expect(linked).toEqual({linked:true,permissions:3});
  const perms=await db.prepare('SELECT permission FROM account_permissions WHERE account_id=? ORDER BY permission').bind('migration-player').all<{permission:string}>();
  expect(perms.results.map(p=>p.permission)).toEqual(['admin.access','admin.world.read','admin.world.write']);
  const inventory=await adminOperatorMigrationInventory(db);
  expect(inventory.find(x=>x.legacyAdminId==='migration-legacy')?.playerAccountId).toBe('migration-player');
  await expect(linkExistingAdminOperator(db,{playerAccountId:'migration-player',legacyAdminId:'migration-legacy',approvedBy:'trusted-local-operator'},now())).rejects.toBeDefined();
  expect((await db.prepare('SELECT COUNT(*) n FROM player_admin_operator_links WHERE player_account_id=?').bind('migration-player').first<{n:number}>())!.n).toBe(1);
 });
 it('fails closed on unverified identities or mismatched emails without partial grants',async()=>{
  await db.prepare('UPDATE player_accounts SET email_verified_at=NULL,status=? WHERE id=?').bind('pending','migration-player').run();
  await expect(linkExistingAdminOperator(db,{playerAccountId:'migration-player',legacyAdminId:'migration-legacy',approvedBy:'trusted-local-operator'},now())).rejects.toBeDefined();
  await db.prepare('UPDATE player_accounts SET email_verified_at=?,status=? WHERE id=?').bind(now(),'active','migration-player').run();
  await db.prepare('UPDATE admin_accounts SET email_normalized=? WHERE id=?').bind('someone-else@example.invalid','migration-legacy').run();
  await expect(linkExistingAdminOperator(db,{playerAccountId:'migration-player',legacyAdminId:'migration-legacy',approvedBy:'trusted-local-operator'},now())).rejects.toBeDefined();
  expect((await db.prepare('SELECT COUNT(*) n FROM account_permissions WHERE account_id=?').bind('migration-player').first<{n:number}>())!.n).toBe(0);
  expect((await db.prepare('SELECT COUNT(*) n FROM player_admin_operator_links WHERE player_account_id=?').bind('migration-player').first<{n:number}>())!.n).toBe(0);
 });
 it('revokes linked Admin authority immediately if the Player email diverges',async()=>{
  const {linkedAuditOperator,unifiedAdminMutationGuard}=await import('../src/unified-admin-transaction.ts');
  const {digestOpaqueToken}=await import('../src/session-tokens.ts');
  await linkExistingAdminOperator(db,{playerAccountId:'migration-player',legacyAdminId:'migration-legacy',approvedBy:'trusted-local-operator'},now());
  const signed=await playerLogin(db,{email,password},'local-loopback',now());
  const digest=await digestOpaqueToken(signed.token),csrfDigest=await digestOpaqueToken(signed.csrfToken);
  expect(await linkedAuditOperator(db,'migration-player')).toBe('migration-legacy');
  await db.prepare('UPDATE player_accounts SET email_normalized=? WHERE id=?')
   .bind('new-identity@example.invalid','migration-player').run();
  expect(await linkedAuditOperator(db,'migration-player')).toBeNull();
  await expect(db.batch([unifiedAdminMutationGuard(db,'migration-player','migration-legacy',digest,csrfDigest,now())])).rejects.toBeDefined();
  const {replay}=await import('../src/command-guards.ts');
  const state=await db.prepare('SELECT generation FROM world_state WHERE id=1').first<{generation:string}>();
  expect(state).not.toBeNull();
  await expect(replay(db,{actor:{id:'migration-legacy',email},digest,credentialVersion:1,
   csrfDigest,unified:{playerId:'migration-player',sessionDigest:digest,csrfDigest}},
   {expectedGeneration:state!.generation} as any,'identity-drift-replay','request-hash',now()))
   .rejects.toMatchObject({status:403,code:'permission_denied'});
 });
 it('keeps emergency rollback possible after identity drift and operator disablement',async()=>{
  await linkExistingAdminOperator(db,{playerAccountId:'migration-player',legacyAdminId:'migration-legacy',approvedBy:'trusted-local-operator'},now());
  const signed=await playerLogin(db,{email,password},'local-loopback',now());
  await db.prepare('UPDATE player_accounts SET email_normalized=? WHERE id=?')
   .bind('altered@example.invalid','migration-player').run();
  await db.prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?').bind('migration-legacy').run();
  const revoked=await revokeMigratedAdminOperator(db,'migration-player',now());
  expect(revoked.revoked).toBe(true);
  expect(revoked.sessionsRevoked).toBe(1);
  const active=await db.prepare('SELECT token_digest FROM player_sessions WHERE account_id=?').bind('migration-player').first();
  expect(active).toBeNull();
  const grants=await db.prepare('SELECT permission FROM account_permissions WHERE account_id=?').bind('migration-player').all();
  expect(grants.results).toHaveLength(0);
  const historic=await db.prepare('SELECT id FROM admin_accounts WHERE id=?').bind('migration-legacy').first();
  expect(historic).not.toBeNull();
 });
 it('rolls back permissions and unified sessions while preserving historical admin identity',async()=>{
  await linkExistingAdminOperator(db,{playerAccountId:'migration-player',legacyAdminId:'migration-legacy',approvedBy:'trusted-local-operator'},now());
  const signed=await playerLogin(db,{email,password},'local-loopback',now());
  expect(signed.actor.id).toBe('migration-player');
  const revoked=await revokeMigratedAdminOperator(db,'migration-player',now());
  expect(revoked.revoked).toBe(true);expect(revoked.sessionsRevoked).toBe(1);
  expect((await db.prepare('SELECT COUNT(*) n FROM player_admin_operator_links WHERE player_account_id=?').bind('migration-player').first<{n:number}>())!.n).toBe(0);
  expect((await db.prepare('SELECT COUNT(*) n FROM account_permissions WHERE account_id=?').bind('migration-player').first<{n:number}>())!.n).toBe(0);
  expect((await db.prepare('SELECT COUNT(*) n FROM admin_accounts WHERE id=?').bind('migration-legacy').first<{n:number}>())!.n).toBe(1);
 });
});
