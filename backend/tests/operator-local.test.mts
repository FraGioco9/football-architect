import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openLocalDatabase,manageAccount} from '../tools/operator-local.mts';
import {auditOperatorCutover} from '../tools/operator-cutover-audit.mts';
import {requireStoredSession} from '../src/session-repository.ts';
import {createOpaqueToken,digestOpaqueToken} from '../src/session-tokens.ts';

test('local operator bootstrap/recovery persists across restart without default account or plaintext credentials',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fa-admin-operator-'));
 let handle:Awaited<ReturnType<typeof openLocalDatabase>>|undefined;
 try{
  handle=await openLocalDatabase(dir);
  const generation=await handle.db.prepare('SELECT generation FROM world_state').first();
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM admin_accounts').first())!.n,0);
  await manageAccount(handle.db,'create',' Operator@Example.Invalid ','local-synthetic-password-2026');
  await assert.rejects(manageAccount(handle.db,'create','operator@example.invalid','other-synthetic-password-2026'));
  const account=await handle.db.prepare('SELECT * FROM admin_accounts').first() as any;
  assert.equal(account.email_normalized,'operator@example.invalid');assert.equal(account.credential_version,1);
  assert.ok(String(account.password_verifier).startsWith('$argon2id$v=19$m=19456,t=2,p=1$'));
  assert.ok(!JSON.stringify(account).includes('local-synthetic-password-2026'));
  const token=createOpaqueToken(),now=Math.floor(Date.now()/1000),digest=await digestOpaqueToken(token);
  await handle.db.prepare('INSERT INTO admin_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?,?)').bind(digest,account.id,1,'a'.repeat(64),now,now,now+100).run();
  assert.equal(await requireStoredSession(handle.db,token,now),account.id);
  await handle.close();handle=undefined;handle=await openLocalDatabase(dir);
  assert.equal(await requireStoredSession(handle.db,token,now),account.id);
  await manageAccount(handle.db,'replace-password','operator@example.invalid','replacement-synthetic-password-2026');
  await assert.rejects(requireStoredSession(handle.db,token,now));
  assert.equal((await handle.db.prepare('SELECT credential_version FROM admin_accounts').first())!.credential_version,2);
  await handle.close();handle=undefined;
  handle=await openLocalDatabase(dir);
  assert.deepEqual(await handle.db.prepare('SELECT generation FROM world_state').first(),generation);
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM admin_accounts').first())!.n,1);
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM admin_sessions').first())!.n,0);
 }finally{await handle?.close();await rm(dir,{recursive:true,force:true})}
});

test('operator local storage refuses remote and ambiguous targets',async()=>{
 for(const target of ['','relative/path','https://remote.invalid/db','//server/share'])await assert.rejects(openLocalDatabase(target));
});

test('operator refuses ancestor and persistence-subtree symlinks without writing through them',async()=>{
 const {symlink,mkdir,readdir}=await import('node:fs/promises');
 const root=await mkdtemp(join(tmpdir(),'fa-admin-links-'));
 try{
  const outside=join(root,'outside');await mkdir(outside);
  const linked=join(root,'alias');await symlink(outside,linked);
  await assert.rejects(openLocalDatabase(join(linked,'child')));
  assert.deepEqual(await readdir(outside),[]);
  const state=join(root,'state');await mkdir(state);await symlink(outside,join(state,'v3'));
  await assert.rejects(openLocalDatabase(state));
  assert.deepEqual(await readdir(outside),[]);
  const nested=join(root,'nested','v3','d1','namespace');await mkdir(nested,{recursive:true});await symlink(outside,join(nested,'database.sqlite'));
  await assert.rejects(openLocalDatabase(join(root,'nested')));
  assert.deepEqual(await readdir(outside),[]);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('read-only cutover audit denies incomplete linking and accepts explicit verified grants',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fa-cutover-audit-'));
 const email='audit@example.invalid',now=Math.floor(Date.now()/1000);
 const handle=await openLocalDatabase(dir);
 try{
  const first=await auditOperatorCutover(handle.db,email);
  assert.equal(first.ready,false);assert.ok(first.findings.includes('operator_missing'));
  await manageAccount(handle.db,'create',email,'synthetic-cutover-password-2026');
  await handle.db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
   .bind('audit-player',email,'synthetic',1,'pending',now,now).run();
  const unverified=await auditOperatorCutover(handle.db,email);
  assert.deepEqual(unverified.findings,['player_inactive','player_unverified','operator_link_missing','missing_access','missing_read','missing_write']);
  const operator=await handle.db.prepare('SELECT id FROM admin_accounts WHERE email_normalized=?').bind(email).first<{id:string}>();
  assert.ok(operator);
  await handle.db.prepare('UPDATE player_accounts SET status=?,email_verified_at=? WHERE id=?').bind('active',now,'audit-player').run();
  await handle.db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
   .bind('audit-player',operator.id,now).run();
  await handle.db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>
   handle.db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind('audit-player',permission,now)));
  const before=await handle.db.prepare('SELECT generation,revision FROM world_state').first();
  assert.deepEqual(await auditOperatorCutover(handle.db,email),{ready:true,findings:[]});
  await handle.db.prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?').bind(operator.id).run();
  assert.deepEqual((await auditOperatorCutover(handle.db,email)).findings,['operator_disabled']);
  await handle.db.prepare('UPDATE admin_accounts SET enabled=1 WHERE id=?').bind(operator.id).run();
  await handle.db.prepare('DELETE FROM player_admin_operator_links WHERE player_account_id=?').bind('audit-player').run();
  assert.deepEqual((await auditOperatorCutover(handle.db,email)).findings,['operator_link_missing']);
  await handle.db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
   .bind('audit-player',operator.id,now).run();
  assert.deepEqual(await auditOperatorCutover(handle.db,email),{ready:true,findings:[]});
  assert.deepEqual(await handle.db.prepare('SELECT generation,revision FROM world_state').first(),before,'Preflight never changes sporting world');
  await handle.db.prepare('DELETE FROM account_permissions WHERE account_id=? AND permission=?').bind('audit-player','admin.world.write').run();
  assert.deepEqual((await auditOperatorCutover(handle.db,email)).findings,['missing_write']);
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM player_sessions').first<{n:number}>())?.n,0);
  await assert.rejects(auditOperatorCutover(handle.db,'invalid'));
 }finally{await handle.close();await rm(dir,{recursive:true,force:true})}
});
