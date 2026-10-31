import type {Database} from '../src/database.ts';
import {beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import worker from '../src/index.ts';
import {hashPassword} from '../src/passwords.ts';
const binding=env as any,db=binding.DB as Database,origin='http://localhost:2000';
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
 await db.batch([db.prepare('DELETE FROM player_admin_operator_links'),db.prepare('DELETE FROM account_permissions'),db.prepare('DELETE FROM player_sessions'),db.prepare('DELETE FROM player_one_time_tokens'),db.prepare('DELETE FROM player_accounts'),db.prepare('DELETE FROM player_auth_throttles')]);
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
 .bind('player-1','player@example.invalid',verifier,1,100,'active',100,100).run();
});
describe('PLAYER-AUTH-01 Worker+D1 scoped login foundation',()=>{
 it('Admin HTTP uses unified cookies and denies legacy sign-in and privilege withdrawal',async()=>{
  const now=Math.floor(Date.now()/1000);
  await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind('legacy-mapped','player@example.invalid','synthetic',now).run();
  await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)').bind('player-1','legacy-mapped',now).run();
  const signed=await login(),cookieHeader=cookie(signed);
  expect((await request('/api/admin/world',undefined,{Cookie:cookieHeader})).status).toBe(403);
  await db.batch(['admin.access','admin.world.read'].map(permission=>db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind('player-1',permission,now)));
  expect((await request('/api/admin/world',undefined,{Cookie:cookieHeader})).status).toBe(200);
  await db.prepare("UPDATE admin_accounts SET enabled=0 WHERE id='legacy-mapped'").run();
  expect((await request('/api/admin/world',undefined,{Cookie:cookieHeader})).status).toBe(403);
  await db.prepare("UPDATE admin_accounts SET enabled=1 WHERE id='legacy-mapped'").run();
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
  await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind('linked-admin','player@example.invalid','synthetic',now).run();
  await expect(db.batch([unifiedAdminMutationGuard(db,'player-1','linked-admin',digest,csrfDigest,now),db.prepare("UPDATE player_accounts SET updated_at=updated_at+1 WHERE id='player-1'")])).rejects.toBeDefined();
  await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)').bind('player-1','linked-admin',now).run();
  const original=(await db.prepare("SELECT updated_at FROM player_accounts WHERE id='player-1'").first<{updated_at:number}>())!.updated_at;
  await db.batch([unifiedAdminMutationGuard(db,'player-1','linked-admin',digest,csrfDigest,now),
    db.prepare("UPDATE player_accounts SET updated_at=updated_at+1 WHERE id='player-1'")]);
  expect((await db.prepare("SELECT updated_at FROM player_accounts WHERE id='player-1'").first<{updated_at:number}>())!.updated_at).toBe(original+1);
  await db.prepare("DELETE FROM account_permissions WHERE permission='admin.world.write'").run();
  await expect(db.batch([unifiedAdminMutationGuard(db,'player-1','linked-admin',digest,csrfDigest,now),
    db.prepare("UPDATE player_accounts SET updated_at=updated_at+1 WHERE id='player-1'")])).rejects.toBeDefined();
  expect((await db.prepare("SELECT updated_at FROM player_accounts WHERE id='player-1'").first<{updated_at:number}>())!.updated_at).toBe(original+1);
  await db.prepare("UPDATE player_accounts SET updated_at=? WHERE id='player-1'").bind(original).run();
  await db.prepare('DELETE FROM player_admin_operator_links WHERE player_account_id=?').bind('player-1').run();
  await db.prepare('DELETE FROM admin_accounts WHERE id=?').bind('linked-admin').run();
 });

 it('isolates account sessions and private endpoints across two Player identities',async()=>{
  const now=Math.floor(Date.now()/1000);
  await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
   .bind('player-2','second@example.invalid',verifier,1,now-100,'active',now-100,now-100).run();
  const first=await login();
  const firstCookie=cookie(first),firstCsrf=(await first.json() as any).csrfToken;
  const second=await request('/api/player/login',{email:'second@example.invalid',password});
  const secondCookie=cookie(second),secondCsrf=(await second.json() as any).csrfToken;
  const firstSession=await request('/api/player/session',undefined,{Cookie:firstCookie});
  const secondSession=await request('/api/player/session',undefined,{Cookie:secondCookie});
  expect((await firstSession.json() as any).actor.id).toBe('player-1');
  expect((await secondSession.json() as any).actor.id).toBe('player-2');
  const firstList=await request('/api/player/sessions',undefined,{Cookie:firstCookie});
  const secondList=await request('/api/player/sessions',undefined,{Cookie:secondCookie});
  expect((await firstList.json() as any).sessions).toHaveLength(1);
  expect((await secondList.json() as any).sessions).toHaveLength(1);
  const blocked=await request('/api/player/account/revoke-other-sessions',{},{
   Cookie:firstCookie,'X-CSRF-Token':secondCsrf
  });
  expect(blocked.status).toBe(403);
  const valid=await request('/api/player/account/revoke-other-sessions',{},{
   Cookie:firstCookie,'X-CSRF-Token':firstCsrf
  });
  expect(valid.status).toBe(200);
  const survivor=await request('/api/player/session',undefined,{Cookie:secondCookie});
  expect(survivor.status).toBe(200);
  expect((await survivor.json() as any).actor.id).toBe('player-2');
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
  // Permissions without an approved historical operator link are insufficient.
  expect((await request('/api/player/admin/world',undefined,{Cookie:'fa_player_local='+token})).status).toBe(403);
  const now=Math.floor(Date.now()/1000);
  await db.prepare("DELETE FROM admin_accounts WHERE email_normalized='player@example.invalid'").run();
  await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)')
   .bind('read-legacy','player@example.invalid','synthetic-audit-only',now).run();
  await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
   .bind('player-1','read-legacy',now).run();
  expect((await request('/api/player/admin/world',undefined,{Cookie:'fa_player_local='+token})).status).toBe(200);
  await db.prepare("UPDATE admin_accounts SET enabled=0 WHERE id='read-legacy'").run();
  expect((await request('/api/player/admin/world',undefined,{Cookie:'fa_player_local='+token})).status).toBe(403);
  await db.prepare("UPDATE admin_accounts SET enabled=1 WHERE id='read-legacy'").run();
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
 it('keeps only the current session after explicit other-device revocation',async()=>{
  const first=await login(),firstCookie=cookie(first),firstToken=(await first.json() as any).csrfToken;
  const second=await login(),secondCookie=cookie(second);
  const before=await request('/api/player/sessions',undefined,{Cookie:firstCookie});
  expect(before.status).toBe(200);
  const rows=(await before.json() as any).sessions;
  expect(rows).toHaveLength(2);
  expect(rows.filter((r:any)=>r.current)).toHaveLength(1);
  expect(JSON.stringify(rows)).not.toContain(firstCookie.split('=')[1]);
  const revoked=await request('/api/player/account/revoke-other-sessions',{}, {Cookie:firstCookie,'X-CSRF-Token':firstToken});
  expect(revoked.status).toBe(200);
  expect((await request('/api/player/session',undefined,{Cookie:secondCookie})).status).toBe(401);
  expect((await request('/api/player/session',undefined,{Cookie:firstCookie})).status).toBe(200);
  const remaining=await request('/api/player/sessions',undefined,{Cookie:firstCookie});
  expect((await remaining.json() as any).sessions).toHaveLength(1);
 });
 it('does not present expired or idle sessions as active devices',async()=>{
  const first=await login(),firstCookie=cookie(first);
  await login();
  const current=await request('/api/player/sessions',undefined,{Cookie:firstCookie});
  expect(current.status).toBe(200);
  expect((await current.json() as any).sessions).toHaveLength(2);
  const {digestOpaqueToken}=await import('../src/session-tokens.ts');
  const firstDigest=await digestOpaqueToken(firstCookie.split('=')[1]);
  const expired=await db.prepare('SELECT token_digest FROM player_sessions WHERE token_digest<>? LIMIT 1').bind(firstDigest).first<{token_digest:string}>();
  expect(expired).not.toBeNull();
  await db.prepare('UPDATE player_sessions SET created_at=created_at-86400,last_seen_at=last_seen_at-86400,expires_at=created_at-1 WHERE token_digest=?').bind(expired!.token_digest).run();
  const listed=await request('/api/player/sessions',undefined,{Cookie:firstCookie});
  expect(listed.status).toBe(200);
  const sessions=(await listed.json() as any).sessions;
  expect(sessions).toHaveLength(1);
  expect(sessions[0].current).toBe(true);
 });
 it('isolates two Player identities and refuses unauthorized Admin escalation',async()=>{
  const primary=await login(),primaryCookie=cookie(primary),primaryCsrf=(await primary.json() as any).csrfToken;
  const otherPassword='synthetic-other-player-secret-2026';
  await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
   .bind('player-2','other@example.invalid',await hashPassword(otherPassword),1,100,'active',100,100).run();
  const second=await request('/api/player/login',{email:'other@example.invalid',password:otherPassword});
  expect(second.status).toBe(200);
  const otherCookie=cookie(second),otherCsrf=(await second.json() as any).csrfToken;
  await db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)')
   .bind('player-1','admin.access',Math.floor(Date.now()/1000)).run();
  await db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)')
   .bind('player-1','admin.world.read',Math.floor(Date.now()/1000)).run();
  expect((await request('/api/player/permissions',undefined,{Cookie:otherCookie})).status).toBe(200);
  expect(await (await request('/api/player/permissions',undefined,{Cookie:otherCookie})).json()).toEqual({permissions:[]});
  expect((await request('/api/player/admin/world',undefined,{Cookie:otherCookie})).status).toBe(403);
  const forbidden=await request('/api/player/account/revoke-other-sessions',{}, {Cookie:otherCookie,'X-CSRF-Token':primaryCsrf});
  expect(forbidden.status).toBe(403);
  const revoked=await request('/api/player/account/revoke-other-sessions',{}, {Cookie:otherCookie,'X-CSRF-Token':otherCsrf});
  expect(revoked.status).toBe(200);
  expect((await request('/api/player/session',undefined,{Cookie:primaryCookie})).status).toBe(200);
  expect((await request('/api/player/session',undefined,{Cookie:otherCookie})).status).toBe(200);
 });
 it('reports revoked unified Admin replay as unauthorized, not a storage outage',async()=>{
  const {replay}=await import('../src/command-guards.ts');
  const {digestOpaqueToken}=await import('../src/session-tokens.ts');
  const signed=await login(),c=cookie(signed),raw=c.split('=')[1],token=await digestOpaqueToken(raw);
  const csrfToken=(await signed.json() as any).csrfToken;
  const session={actor:{id:'audit-operator',email:'player@example.invalid'},digest:token,credentialVersion:1,
   csrfDigest:await digestOpaqueToken(csrfToken),
   unified:{playerId:'player-1',sessionDigest:token,csrfDigest:await digestOpaqueToken(csrfToken)}};
  await db.prepare('DELETE FROM player_sessions WHERE token_digest=?').bind(token).run();
  const world=(await (await request('/api/world')).json() as any).world;
  await expect(replay(db,session,{expectedGeneration:world.generation,expectedRevision:world.revision},
   'revoked-replay-test-0001','synthetic-request-hash',Math.floor(Date.now()/1000)))
   .rejects.toMatchObject({status:401,code:'unauthorized'});
 });
 it('rejects session timestamps outside absolute lifetime and blocks session restoration',async()=>{
  const signed=await login(),c=cookie(signed),now=Math.floor(Date.now()/1000);
  const {digestOpaqueToken}=await import('../src/session-tokens.ts');
  const digest=await digestOpaqueToken(c.split('=')[1]);
  await db.prepare('UPDATE player_sessions SET expires_at=created_at+2592001 WHERE token_digest=?').bind(digest).run();
  expect((await request('/api/player/session',undefined,{Cookie:c})).status).toBe(401);
  await db.prepare('UPDATE player_sessions SET expires_at=created_at+2592000,last_seen_at=created_at+2592001 WHERE token_digest=?').bind(digest).run();
  expect((await request('/api/player/session',undefined,{Cookie:c})).status).toBe(401);
  await db.prepare('UPDATE player_sessions SET last_seen_at=? WHERE token_digest=?').bind(now+30,digest).run();
  expect((await request('/api/player/session',undefined,{Cookie:c})).status).toBe(401);
 });
 it('denies cross-origin account mutation and an invalid CSRF without revoking the valid session',async()=>{
  const signed=await login(),sessionCookie=cookie(signed);
  const csrf=(await signed.json() as any).csrfToken;
  const crossOrigin=await request('/api/player/account/revoke-other-sessions',{},
   {Cookie:sessionCookie,Origin:'https://attacker.example.invalid','X-CSRF-Token':csrf});
  expect(crossOrigin.status).toBe(403);
  const missingCsrf=await request('/api/player/account/revoke-other-sessions',{}, {Cookie:sessionCookie});
  expect(missingCsrf.status).toBe(403);
  const unrelatedCsrf=await request('/api/player/account/revoke-other-sessions',{},
   {Cookie:sessionCookie,'X-CSRF-Token':'0'.repeat(64)});
  expect(unrelatedCsrf.status).toBe(403);
  expect((await request('/api/player/session',undefined,{Cookie:sessionCookie})).status).toBe(200);
 });
 it('rejects a legacy Admin idempotent replay without consulting historic session state',async()=>{
  const {replay}=await import('../src/command-guards.ts');
  const legacy={actor:{id:'old-admin',email:'old@example.invalid'},
   digest:'0'.repeat(64),csrfDigest:'1'.repeat(64),credentialVersion:1};
  await expect(replay(db,legacy,{expectedGeneration:'unused'} as any,
   'legacy-replay-key','legacy-request-hash',Math.floor(Date.now()/1000)))
   .rejects.toMatchObject({status:403,code:'legacy_admin_session_retired'});
 });
 it('rejects legacy Admin credentials at the shared mutation guard',async()=>{
  const {sessionGuard}=await import('../src/command-guards.ts');
  const legacy={actor:{id:'old-admin',email:'old@example.invalid'},
   digest:'0'.repeat(64),csrfDigest:'1'.repeat(64),credentialVersion:1};
  expect(()=>sessionGuard(db,legacy,Math.floor(Date.now()/1000)))
   .toThrowError('legacy_admin_session_retired');
 });
 it('throttles repeated invalid login attempts without revealing account existence',async()=>{
  const wrong='invalid-login-password-2026';
  for(let attempt=0;attempt<5;attempt++){
   const denied=await request('/api/player/login',{email:'player@example.invalid',password:wrong});
   expect(denied.status).toBe(401);
   expect(await denied.json()).toEqual({error:{code:'invalid_credentials'}});
  }
  const limited=await request('/api/player/login',{email:'player@example.invalid',password:wrong});
  expect(limited.status).toBe(429);
  expect(limited.headers.get('Retry-After')).toBe('900');
  const distinct=await request('/api/player/login',{email:'unknown@example.invalid',password:wrong});
  expect(distinct.status).toBe(401);
  expect(await distinct.json()).toEqual({error:{code:'invalid_credentials'}});
 });
 it('does not let a revoked session recover through an already issued CSRF token',async()=>{
  const signed=await login(),c=cookie(signed),csrf=(await signed.json() as any).csrfToken;
  const {digestOpaqueToken}=await import('../src/session-tokens.ts');
  await db.prepare('DELETE FROM player_sessions WHERE token_digest=?')
   .bind(await digestOpaqueToken(c.split('=')[1])).run();
  expect((await request('/api/player/session',undefined,{Cookie:c})).status).toBe(401);
  const mutation=await request('/api/player/account/revoke-other-sessions',{},{
   Cookie:c,'X-CSRF-Token':csrf
  });
  expect(mutation.status).toBe(401);
  expect((await request('/api/admin/world',undefined,{Cookie:c})).status).toBe(401);
 });
 it('rejects unverified and absent users without disclosing their existence',async()=>{
  const missing=await request('/api/player/login',{email:'missing@example.invalid',password});
  await db.prepare("UPDATE player_accounts SET status='pending',email_verified_at=NULL").run();
  const pending=await login();
  expect(missing.status).toBe(401);expect(pending.status).toBe(401);
  expect(await missing.json()).toEqual(await pending.json());
 });
 it('requires explicit Admin grants for unified Player cookies while leaving public browsing anonymous',async()=>{
  const signed=await login(),c=cookie(signed);
  // A valid unified Player session is authenticated but cannot administer
  // the world without explicitly approved operator mapping and permissions.
  expect((await request('/api/admin/world',undefined,{Cookie:c})).status).toBe(403);
  expect((await request('/api/admin/world')).status).toBe(401);
  expect((await request('/api/world')).status).toBe(200);
  expect((await request('/api/player/session')).status).toBe(401);
 });
 it('revokes sessions on credential update and expires on inactivity',async()=>{
  const signed=await login(),c=cookie(signed);
  await db.prepare('UPDATE player_accounts SET credential_version=credential_version+1').run();
  expect((await request('/api/player/session',undefined,{Cookie:c})).status).toBe(401);
  const next=await login(),current=cookie(next),now=Math.floor(Date.now()/1000);
  const {digestOpaqueToken}=await import('../src/session-tokens.ts');
  await db.prepare('UPDATE player_sessions SET created_at=?,last_seen_at=? WHERE token_digest=?')
    .bind(now-8*86400,now-7*86400-1,await digestOpaqueToken(current.split('=')[1])).run();
  expect((await request('/api/player/session',undefined,{Cookie:current})).status).toBe(401);
 });
 it('rejects cross-origin writes, duplicate cookies and unknown Player routes',async()=>{
  expect((await request('/api/player/login',{email:'player@example.invalid',password},{Origin:'https://evil.example'})).status).toBe(403);
  const signed=await login(),c=cookie(signed);
  expect((await request('/api/player/session',undefined,{Cookie:c+'; '+c})).status).toBe(401);
  expect((await request('/api/player/signup',{})).status).toBe(404);
 });
});
