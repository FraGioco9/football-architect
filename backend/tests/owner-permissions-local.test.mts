import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openLocalDatabase} from '../tools/operator-local.mts';
import {accountPool,initializeAccountPool,inspectAdminPermissions,changeAdminPermissions} from '../tools/owner-permissions.mts';
import {readAccountPermissions} from '../src/account-permissions.ts';

const now=1_800_000_000,email='new-owner@example.invalid';
async function fixture(run:(db:any,state:string)=>Promise<void>){
 const state=await mkdtemp(join(tmpdir(),'fa-owner-permissions-'));const handle=await openLocalDatabase(state);
 try{await run(handle.db,state)}finally{await handle.close();await rm(state,{recursive:true,force:true})}
}
async function player(db:any,id='player',address=email,verified=true){
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,status,email_verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,address,'synthetic','active',verified?now:null,now,now).run();
}
const request=(extra={})=>({action:'grant' as const,environment:'dev',email,expectedAccountId:'player',...extra});
const count=async(db:any,table:string)=>(await db.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n;

test('pool selection pins Dev/Preview together and rejects relabeling or unknown environments',()=>fixture(async db=>{
 assert.equal(accountPool('dev'),'dev-preview');assert.equal(accountPool('preview'),'dev-preview');assert.equal(accountPool('production'),'production');
 assert.throws(()=>accountPool('prod'),/invalid_environment/);
 await initializeAccountPool(db,'dev',now);await initializeAccountPool(db,'preview',now);
 await assert.rejects(initializeAccountPool(db,'production',now),/account_pool_mismatch/);
 await assert.rejects(db.prepare("UPDATE account_environment_pool SET pool='production'").run());
 await assert.rejects(db.prepare('DELETE FROM account_environment_pool').run());
 await assert.rejects(db.prepare("INSERT OR REPLACE INTO account_environment_pool VALUES(1,'production',?)").bind(now+1).run());
 assert.equal((await db.prepare('SELECT pool FROM account_environment_pool').first()).pool,'dev-preview');
}));
test('explicit owner bootstrap grants current permissions, revokes old credentials and preserves the world',()=>fixture(async db=>{
 await initializeAccountPool(db,'dev',now);await player(db);
 const world=await db.prepare('SELECT * FROM world_state').first();
 const before=await inspectAdminPermissions(db,'preview',email);assert.equal(before.accountId,'player');assert.deepEqual(before.permissions,[]);
 assert.equal(await count(db,'admin_accounts'),0);
 await db.prepare('INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind('a'.repeat(64),'player',1,'b'.repeat(64),now,now,now+1000).run();
 await changeAdminPermissions(db,request(),now);
 assert.deepEqual((await readAccountPermissions(db,'player')).sort(),['admin.access','admin.world.read','admin.world.write']);
 assert.equal(await count(db,'player_sessions'),0);assert.equal(await count(db,'account_permission_events'),1);
 const principal=await db.prepare('SELECT * FROM admin_accounts').first();assert.equal(principal.password_verifier,'!unified-player-audit-only');
 assert.deepEqual(await db.prepare('SELECT * FROM world_state').first(),world);assert.equal(await count(db,'admin_operations'),0);
 await assert.rejects(db.prepare("DELETE FROM account_permission_events").run());
 const receipt=await db.prepare('SELECT * FROM account_permission_events').first();
 await assert.rejects(db.prepare("INSERT OR REPLACE INTO account_permission_events(id,action,pool,player_account_id,legacy_admin_account_id,approved_by,created_at) VALUES(?,'revoke','production','other',NULL,'local-owner-cli',?)").bind(receipt.id,now+1).run());
 assert.deepEqual(await db.prepare('SELECT * FROM account_permission_events').first(),receipt);
 await db.prepare("UPDATE player_accounts SET email_verified_at=NULL WHERE id='player'").run();
 await db.prepare("UPDATE admin_accounts SET enabled=0,email_normalized='changed-legacy@example.invalid'").run();
 await changeAdminPermissions(db,request({action:'revoke'}),now+1);
 assert.deepEqual(await readAccountPermissions(db,'player'),[]);assert.equal(await count(db,'admin_accounts'),1);assert.equal(await count(db,'account_permission_events'),2);
}));
test('unverified identity, stale account ID, unbound or wrong pool never create a principal or permission',()=>fixture(async db=>{
 await player(db,'player',email,false);
 await assert.rejects(changeAdminPermissions(db,request(),now),/account_pool_unbound/);
 await initializeAccountPool(db,'dev',now);
 await assert.rejects(changeAdminPermissions(db,request(),now),/account_not_verified/);
 await db.prepare("UPDATE player_accounts SET email_verified_at=? WHERE id='player'").bind(now).run();
 await assert.rejects(changeAdminPermissions(db,request({expectedAccountId:'other'}),now),/account_selection_changed/);
 await assert.rejects(changeAdminPermissions(db,request({environment:'production'}),now),/account_pool_mismatch/);
 assert.equal(await count(db,'admin_accounts'),0);assert.equal(await count(db,'account_permissions'),0);assert.equal(await count(db,'account_permission_events'),0);
}));
test('a historic operator cannot be linked merely because the email matches',()=>fixture(async db=>{
 await initializeAccountPool(db,'dev',now);await player(db);
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind('historic',email,'old-verifier',now).run();
 await assert.rejects(changeAdminPermissions(db,request(),now),/explicit_legacy_selection_required/);
 await changeAdminPermissions(db,request({legacyId:'historic'}),now);
 assert.equal((await db.prepare('SELECT legacy_admin_account_id AS id FROM player_admin_operator_links').first()).id,'historic');
 assert.equal((await db.prepare('SELECT password_verifier AS verifier FROM admin_accounts').first()).verifier,'old-verifier');
}));
test('a concurrent verification change or late receipt failure rolls back every permission mutation',()=>fixture(async db=>{
 await initializeAccountPool(db,'dev',now);await player(db);
 const racing={prepare:db.prepare.bind(db),batch:async(statements:any[])=>{
  await db.prepare("UPDATE player_accounts SET email_verified_at=NULL WHERE id='player'").run();return db.batch(statements);
 }};
 await assert.rejects(changeAdminPermissions(racing,request(),now));
 assert.equal(await count(db,'admin_accounts'),0);assert.equal(await count(db,'account_permissions'),0);
 await db.prepare("UPDATE player_accounts SET email_verified_at=? WHERE id='player'").bind(now).run();
 await db.prepare('INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind('c'.repeat(64),'player',1,'d'.repeat(64),now,now,now+1000).run();
 await db.prepare("CREATE TRIGGER deny_permission_receipt BEFORE INSERT ON account_permission_events BEGIN SELECT RAISE(ABORT,'synthetic receipt failure'); END").run();
 await assert.rejects(changeAdminPermissions(db,request(),now));
 assert.equal(await count(db,'admin_accounts'),0);assert.equal(await count(db,'player_admin_operator_links'),0);assert.equal(await count(db,'account_permissions'),0);assert.equal(await count(db,'player_sessions'),1);
}));

import {parsePermissionArguments,runPermissionCommand} from '../tools/admin-permissions.mts';
import {access} from 'node:fs/promises';
test('CLI rejects unknown/duplicate flags, unsafe targets and confirmation bypasses',()=>{
 for(const args of [[],['grant','--remote'],['grant','--email',email,'--environment','prod'],['grant','--email',email,'--persist-to','https://example.invalid'],['grant','--email',email,'--email',email],['status','--email',email,'--apply'],['init','--email',email],['init','--apply','--dry-run'],['revoke','--email',email,'--legacy-id','foreign'],['status','--email',email,'--legacy-id','foreign']])assert.throws(()=>parsePermissionArguments(args));
 assert.equal(parsePermissionArguments(['grant','--email',email]).apply,false);
});
test('CLI init dry-run creates no directory; status never initializes a missing target',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'fa-owner-no-write-')),state=join(parent,'missing');
 try{
  await runPermissionCommand(['init','--persist-to',state],{output:()=>{}});
  await assert.rejects(access(state));
  await assert.rejects(runPermissionCommand(['status','--email',email,'--persist-to',state],{output:()=>{}}));
  await assert.rejects(access(state));
 }finally{await rm(parent,{recursive:true,force:true})}
});
test('CLI dry-run is non-authorizing; apply needs the exact account and correct pool',()=>fixture(async(db,state)=>{
 await initializeAccountPool(db,'dev',now);await player(db);
 const args=['grant','--email',email,'--persist-to',state];
 await runPermissionCommand(args,{output:()=>{}});assert.equal(await count(db,'account_permissions'),0);
 await assert.rejects(runPermissionCommand([...args,'--apply'],{output:()=>{}}),/confirmation_required/);
 await assert.rejects(runPermissionCommand([...args,'--apply','--confirm-account','wrong'],{output:()=>{}}),/account_selection_changed/);
 await runPermissionCommand([...args,'--apply','--confirm-account','player'],{output:()=>{}});
 assert.equal((await readAccountPermissions(db,'player')).length,3);
 await assert.rejects(runPermissionCommand(['revoke','--email',email,'--environment','production','--persist-to',state,'--apply','--confirm-account','player'],{output:()=>{}}),/account_pool_mismatch/);
 assert.equal((await readAccountPermissions(db,'player')).length,3);
}));

test('read-only opening refuses an empty D1 directory before the engine creates a database',async()=>{
 const state=await mkdtemp(join(tmpdir(),'fa-owner-empty-'));
 try{
  await mkdir(join(state,'v3','d1'),{recursive:true});
  await assert.rejects(openLocalDatabase(state,{migrate:false,requireExisting:true}),/existing_local_state_required/);
  assert.deepEqual(await readdir(join(state,'v3','d1')),[]);
 }finally{await rm(state,{recursive:true,force:true})}
});


test('same email in separate local pools remains independent and only the selected target changes',()=>fixture(async dev=>fixture(async production=>{
 await initializeAccountPool(dev,'dev',now);await initializeAccountPool(production,'production',now);
 await player(dev);await assert.rejects(inspectAdminPermissions(production,'production',email),/account_not_found/);
 await player(production,'production-player');
 await changeAdminPermissions(dev,request(),now);
 assert.equal((await readAccountPermissions(dev,'player')).length,3);
 assert.deepEqual(await readAccountPermissions(production,'production-player'),[]);
 await assert.rejects(changeAdminPermissions(production,request({expectedAccountId:'production-player'}),now),/account_pool_mismatch/);
 assert.equal(await count(production,'admin_accounts'),0);
})));

test('unrelated SQLite files never cause a selected database or cache to be created',async()=>{
 const state=await mkdtemp(join(tmpdir(),'fa-owner-unrelated-'));
 try{
  const {writeFile}=await import('node:fs/promises');
  await mkdir(join(state,'v3','d1','unrelated'),{recursive:true});
  await writeFile(join(state,'v3','d1','unrelated','other.sqlite'),'unrelated file');
  const before=(await readdir(state,{recursive:true})).sort();
  await assert.rejects(openLocalDatabase(state,{migrate:false,requireExisting:true}));
  assert.deepEqual((await readdir(state,{recursive:true})).sort(),before);
  assert.equal(await (await import('node:fs/promises')).readFile(join(state,'v3','d1','unrelated','other.sqlite'),'utf8'),'unrelated file');
 }finally{await rm(state,{recursive:true,force:true})}
});
