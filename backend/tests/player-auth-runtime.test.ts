import {beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import worker from '../src/index.ts';
import {hashPassword} from '../src/passwords.ts';
const binding=env as any,db=binding.DB,origin='http://localhost:2000';
const configured={...binding,PLAYER_MODE:'local',PLAYER_ORIGIN:origin};
const password='synthetic-player-password-2026';
let verifier:string;
function request(path:string,body?:unknown,headers:Record<string,string>={},method=body===undefined?'GET':'POST'){
 return worker.fetch(new Request(origin+path,{method,headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)}),configured);
}
const cookie=(response:Response)=>response.headers.get('set-cookie')!.split(';')[0];
const login=()=>request('/api/player/login',{email:' PLAYER@example.invalid ',password});
beforeAll(async()=>{await applyD1Migrations(db,binding.TEST_MIGRATIONS);verifier=await hashPassword(password)});
beforeEach(async()=>{
 await db.batch([db.prepare('DELETE FROM player_sessions'),db.prepare('DELETE FROM player_one_time_tokens'),db.prepare('DELETE FROM player_accounts'),db.prepare('DELETE FROM player_auth_throttles')]);
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
 .bind('player-1','player@example.invalid',verifier,1,100,'active',100,100).run();
});
describe('PLAYER-AUTH-01 Worker+D1 scoped login foundation',()=>{
 it('Admin HTTP uses unified cookies and denies legacy sign-in and privilege withdrawal',async()=>{
  const now=Math.floor(Date.now()/1000);
  await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind('legacy-mapped','legacy-mapped@example.invalid','synthetic',now).run();
  await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)').bind('player-1','legacy-mapped',now).run();
  const signed=await login(),cookieHeader=cookie(signed);
  expect((await request('/api/admin/world',undefined,{Cookie:cookieHeader})).status).toBe(403);
  await db.batch(['admin.access','admin.world.read'].map(permission=>db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind('player-1',permission,now)));
  expect((await request('/api/admin/world',undefined,{Cookie:cookieHeader})).status).toBe(200);
  expect((await request('/api/admin/seasons/prepare',{}, {Cookie:cookieHeader})).status).toBe(403);
  await db.prepare("DELETE FROM account_permissions WHERE permission='admin.world.read'").run();
  expect((await request('/api/admin/world',undefined,{Cookie:cookieHeader})).status).toBe(403);
  expect((await request('/api/admin/login',{email:'legacy-mapped@example.invalid',password})).status).toBe(410);
  await db.prepare('DELETE FROM player_admin_operator_links WHERE player_account_id=?').bind('player-1').run();
  await db.prepare('DELETE FROM admin_accounts WHERE id=?').bind('legacy-mapped').run();
 });

 it('rolls back a world mutation atomically when an Admin permission is revoked',async()=>{
  const {unifiedAdminMutationGuard}=await import('../src/unified-admin-transaction.ts');
  const signed=await login(),data=await signed.json() as any;
  const token=cookie(signed).split('=')[1];
  const {digestOpaqueToken}=await import('../src/session-tokens.ts');
  const digest=await digestOpaqueToken(token),csrfDigest=await digestOpaqueToken(data.csrfToken);
  const now=Math.floor(Date.now()/1000);
  await db.batch(['admin.access','admin.world.write'].map(permission=>db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind('player-1',permission,now)));
  await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind('linked-admin','linked-admin@example.invalid','synthetic',now).run();
  await expect(db.batch([unifiedAdminMutationGuard(db,'player-1','linked-admin',digest,csrfDigest,now),db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1')])).rejects.toBeDefined();
  await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)').bind('player-1','linked-admin',now).run();
  const original=(await db.prepare('SELECT revision FROM world_state WHERE id=1').first<{revision:number}>())!.revision;
  await db.batch([unifiedAdminMutationGuard(db,'player-1','linked-admin',digest,csrfDigest,now),
    db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1')]);
  expect((await db.prepare('SELECT revision FROM world_state WHERE id=1').first<{revision:number}>())!.revision).toBe(original+1);
  await db.prepare("DELETE FROM account_permissions WHERE permission='admin.world.write'").run();
  await expect(db.batch([unifiedAdminMutationGuard(db,'player-1','linked-admin',digest,csrfDigest,now),
    db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1')])).rejects.toBeDefined();
  expect((await db.prepare('SELECT revision FROM world_state WHERE id=1').first<{revision:number}>())!.revision).toBe(original+1);
  await db.prepare('UPDATE world_state SET revision=? WHERE id=1').bind(original).run();
  await db.prepare('DELETE FROM player_admin_operator_links WHERE player_account_id=?').bind('player-1').run();
  await db.prepare('DELETE FROM admin_accounts WHERE id=?').bind('linked-admin').run();
 });

 it('returns server-derived permissions and checks Admin read/write separately',async()=>{
  const {authorizeUnifiedAdmin}=await import('../src/unified-admin-authorization.ts');
  const signed=await login(),token=cookie(signed).split('=')[1],csrf=(await signed.json() as any).csrfToken;
  expect((await request('/api/player/admin/world',undefined,{Cookie:'fa_player_local='+token})).status).toBe(403);
  const empty=await request('/api/player/permissions',undefined,{Cookie:'fa_player_local='+token});
  expect(await empty.json()).toEqual({permissions:[]});
  await expect(authorizeUnifiedAdmin(db,token,Math.floor(Date.now()/1000),'admin.world.read')).rejects.toMatchObject({status:403});
  await db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES (?,?,?)').bind('player-1','admin.access',Math.floor(Date.now()/1000)).run();
  await expect(authorizeUnifiedAdmin(db,token,Math.floor(Date.now()/1000),'admin.world.read')).rejects.toMatchObject({status:403});
  await db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES (?,?,?)').bind('player-1','admin.world.read',Math.floor(Date.now()/1000)).run();
  expect((await request('/api/player/admin/world',undefined,{Cookie:'fa_player_local='+token})).status).toBe(200);
  expect((await authorizeUnifiedAdmin(db,token,Math.floor(Date.now()/1000),'admin.world.read')).actor.id).toBe('player-1');
  await expect(authorizeUnifiedAdmin(db,token,Math.floor(Date.now()/1000),'admin.world.write',csrf)).rejects.toMatchObject({status:403});
  await db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES (?,?,?)').bind('player-1','admin.world.write',Math.floor(Date.now()/1000)).run();
  await expect(authorizeUnifiedAdmin(db,token,Math.floor(Date.now()/1000),'admin.world.write','0'.repeat(64))).rejects.toMatchObject({status:403});
  expect((await authorizeUnifiedAdmin(db,token,Math.floor(Date.now()/1000),'admin.world.write',csrf)).actor.id).toBe('player-1');
  await db.prepare("DELETE FROM account_permissions WHERE permission='admin.access'").run();
  expect((await request('/api/player/admin/world',undefined,{Cookie:'fa_player_local='+token})).status).toBe(403);
  await expect(authorizeUnifiedAdmin(db,token,Math.floor(Date.now()/1000),'admin.world.write',csrf)).rejects.toMatchObject({status:403});
 });

 it('logs in with a digest-only session and restores CSRF after reload, then revokes at logout',async()=>{
  const signed=await login();expect(signed.status).toBe(200);
  expect(signed.headers.get('set-cookie')).toMatch(/^fa_player_local=[0-9a-f]{64};.*HttpOnly.*SameSite=Strict/);
  const data=await signed.json() as any,c=cookie(signed);
  const session=await request('/api/player/session',undefined,{Cookie:c});
  expect(session.status).toBe(200);expect((await session.json() as any).csrfToken).toBe(data.csrfToken);
  const rows=await db.prepare('SELECT * FROM player_sessions').all();
  expect(rows.results).toHaveLength(1);expect(JSON.stringify(rows.results)).not.toContain(c.slice(c.indexOf('=')+1));
  expect(JSON.stringify(rows.results)).not.toContain(data.csrfToken);
  expect((await request('/api/player/logout',{}, {Cookie:c,'X-CSRF-Token':'0'.repeat(64)})).status).toBe(403);
  expect((await request('/api/player/logout',{}, {Cookie:c,'X-CSRF-Token':data.csrfToken})).status).toBe(200);
  expect((await request('/api/player/session',undefined,{Cookie:c})).status).toBe(401);
 });
 it('rejects unverified and absent users without disclosing their existence',async()=>{
  const missing=await request('/api/player/login',{email:'missing@example.invalid',password});
  await db.prepare("UPDATE player_accounts SET status='pending',email_verified_at=NULL").run();
  const pending=await login();
  expect(missing.status).toBe(401);expect(pending.status).toBe(401);
  expect(await missing.json()).toEqual(await pending.json());
 });
 it('keeps player cookie entirely unusable on Admin routes and public browsing anonymous',async()=>{
  const signed=await login(),c=cookie(signed);
  expect((await request('/api/admin/world',undefined,{Cookie:c})).status).toBe(401);
  expect((await request('/api/world')).status).toBe(200);
  expect((await request('/api/player/session')).status).toBe(401);
 });
 it('revokes sessions on credential update and expires on inactivity',async()=>{
  const signed=await login(),c=cookie(signed);
  await db.prepare('UPDATE player_accounts SET credential_version=credential_version+1').run();
  expect((await request('/api/player/session',undefined,{Cookie:c})).status).toBe(401);
  const next=await login(),current=cookie(next),now=Math.floor(Date.now()/1000);
  await db.prepare('UPDATE player_sessions SET last_seen_at=? WHERE token_digest=(SELECT token_digest FROM player_sessions ORDER BY created_at DESC LIMIT 1)')
    .bind(now-7*86400-1).run();
  expect((await request('/api/player/session',undefined,{Cookie:current})).status).toBe(401);
 });
 it('rejects cross-origin writes, duplicate cookies and unknown Player routes',async()=>{
  expect((await request('/api/player/login',{email:'player@example.invalid',password},{Origin:'https://evil.example'})).status).toBe(403);
  const signed=await login(),c=cookie(signed);
  expect((await request('/api/player/session',undefined,{Cookie:c+'; '+c})).status).toBe(401);
  expect((await request('/api/player/signup',{})).status).toBe(404);
 });
});
