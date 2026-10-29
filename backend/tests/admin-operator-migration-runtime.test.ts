import {beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {linkExistingAdminOperator,revokeMigratedAdminOperator,adminOperatorMigrationInventory,adminOperatorMigrationReadiness} from '../src/admin-operator-migration.ts';
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
 it('reports an unlinked enabled operator as rollout-blocking and a linked operator as ready',async()=>{
  const initial=await adminOperatorMigrationReadiness(db);
  const legacy=initial.blocked.find(x=>x.legacyAdminId==='migration-legacy');
  expect(legacy?.status).toBe('unlinked');
  expect(initial.ready).toBe(false);
  await linkExistingAdminOperator(db,{playerAccountId:'migration-player',legacyAdminId:'migration-legacy',approvedBy:'trusted-local-operator'},now());
  const final=await adminOperatorMigrationReadiness(db);
  expect(final.blocked.some(x=>x.legacyAdminId==='migration-legacy')).toBe(false);
  expect(final.linked).toBeGreaterThanOrEqual(1);
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
