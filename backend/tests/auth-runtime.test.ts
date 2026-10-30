import type {Database} from '../src/database.ts';
import {beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import worker from '../src/index.ts';
import {hashPassword} from '../src/passwords.ts';

const binding=env as any,db=binding.DB as Database,origin='http://localhost:2000';
const config={...binding,PLAYER_MODE:'local',PLAYER_ORIGIN:origin};
const password='synthetic-operator-password-2026';
const email='operator@example.invalid';
const now=()=>Math.floor(Date.now()/1000);
let verifier:string;
function request(path:string,body?:unknown,headers:Record<string,string>={},method=body===undefined?'GET':'POST'){
 return worker.fetch(new Request(origin+path,{method,headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},
 body:body===undefined?undefined:JSON.stringify(body)}),config);
}
const login=()=>request('/api/player/login',{email,password});
const cookie=(r:Response)=>r.headers.get('set-cookie')!.split(';')[0];
const csrf=async(r:Response)=>(await r.json() as {csrfToken:string}).csrfToken;
const grant=async(...permissions:string[])=>db.batch(permissions.map(permission=>db.prepare(
 'INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)'
).bind('operator-player',permission,now())));
beforeAll(async()=>{await applyD1Migrations(db,binding.TEST_MIGRATIONS);verifier=await hashPassword(password)});
beforeEach(async()=>{
 await db.batch([
  db.prepare('DELETE FROM admin_operations'),db.prepare('DELETE FROM seasons'),
  db.prepare("UPDATE world_state SET revision=0,season_number=0,day=0,phase='unstarted'"),
  db.prepare('DELETE FROM player_admin_operator_links'),
  db.prepare('DELETE FROM account_permissions'),
  db.prepare('DELETE FROM player_sessions'),
  db.prepare('DELETE FROM player_one_time_tokens'),
  db.prepare('DELETE FROM player_accounts'),
  db.prepare('DELETE FROM player_auth_throttles'),
  db.prepare('DELETE FROM admin_sessions'),
  db.prepare('DELETE FROM admin_accounts'),
  db.prepare('DELETE FROM auth_throttles')
 ]);
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)')
 .bind('operator-legacy',email,'historical-audit-only',now()).run();
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
 .bind('operator-player',email,verifier,1,100,'active',100,100).run();
 await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
 .bind('operator-player','operator-legacy',now()).run();
});
describe('Unified Admin HTTP contract — replacement for the legacy login',()=>{
 it('rejects legacy login and logout even if supplied an old credential cookie',async()=>{
  expect((await request('/api/admin/login',{email,password})).status).toBe(410);
  expect((await request('/api/admin/logout',{}, {Cookie:'fa_admin_local=old'})).status).toBe(410);
  expect((await request('/api/admin/world',undefined,{Cookie:'fa_admin_local=old'})).status).toBe(401);
  expect((await request('/api/admin/signup',{})).status).toBe(404);
 });
 it('authenticates via the Player cookie, restores CSRF and preserves anonymous reads',async()=>{
  await grant('admin.access','admin.world.read');
  const signed=await login();expect(signed.status).toBe(200);
  const c=cookie(signed),token=await csrf(signed);
  expect(c).toMatch(/^fa_player_local=[a-f0-9]{64}$/);
  const restored=await request('/api/admin/session',undefined,{Cookie:c});
  expect(restored.status).toBe(200);
  expect(await restored.json()).toEqual({actor:{id:'operator-player',email},csrfToken:token});
  expect((await request('/api/admin/world',undefined,{Cookie:c})).status).toBe(200);
  expect((await request('/api/world')).status).toBe(200);
  expect((await request('/api/admin/world')).status).toBe(401);
  expect((await request('/api/admin/world',undefined,{Cookie:'fa_admin_local=old'})).status).toBe(401);
  expect((await request('/api/player/logout',{}, {Cookie:c,'X-CSRF-Token':token})).status).toBe(200);
  expect((await request('/api/admin/session',undefined,{Cookie:c})).status).toBe(401);
 });
 it('enforces separate access, read and write grants and immediate revocation',async()=>{
  const signed=await login(),c=cookie(signed),token=await csrf(signed);
  expect((await request('/api/admin/world',undefined,{Cookie:c})).status).toBe(403);
  await grant('admin.access');
  expect((await request('/api/admin/world',undefined,{Cookie:c})).status).toBe(403);
  await grant('admin.world.read');
  expect((await request('/api/admin/world',undefined,{Cookie:c})).status).toBe(200);
  expect((await request('/api/admin/seasons/prepare',{}, {Cookie:c,'X-CSRF-Token':token})).status).toBe(403);
  await grant('admin.world.write');
  const world=(await (await request('/api/world')).json() as any).world;
  const command={expectedGeneration:world.generation,expectedRevision:world.revision};
  expect((await request('/api/admin/seasons/prepare',command,{Cookie:c,'X-CSRF-Token':'0'.repeat(64)})).status).toBe(403);
  const malformed=await request('/api/admin/seasons/prepare',{...command,clientApproved:true},
    {Cookie:c,'X-CSRF-Token':token,'Idempotency-Key':'unified-prepare-contract-1'});
  expect(malformed.status).toBe(422);
  await db.prepare("DELETE FROM account_permissions WHERE permission='admin.world.write'").run();
  expect((await request('/api/admin/seasons/prepare',command,{Cookie:c,'X-CSRF-Token':token})).status).toBe(403);
  await db.prepare("DELETE FROM account_permissions WHERE permission='admin.world.read'").run();
  expect((await request('/api/admin/world',undefined,{Cookie:c})).status).toBe(403);
 });
 it('rejects unlinked, disabled, password-rotated and expired Player sessions',async()=>{
  await grant('admin.access','admin.world.read');
  const signed=await login(),c=cookie(signed);
  await db.prepare("DELETE FROM player_admin_operator_links WHERE player_account_id='operator-player'").run();
  expect((await request('/api/admin/world',undefined,{Cookie:c})).status).toBe(403);
  await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)').bind('operator-player','operator-legacy',now()).run();
  await db.prepare("UPDATE admin_accounts SET enabled=0 WHERE id='operator-legacy'").run();
  expect((await request('/api/admin/world',undefined,{Cookie:c})).status).toBe(403);
  await db.prepare("UPDATE admin_accounts SET enabled=1 WHERE id='operator-legacy'").run();
  await db.prepare("UPDATE player_accounts SET credential_version=credential_version+1 WHERE id='operator-player'").run();
  expect((await request('/api/admin/world',undefined,{Cookie:c})).status).toBe(401);
 });
 it('rejects foreign origin, duplicate cookies and wrongly configured runtime',async()=>{
  await grant('admin.access','admin.world.read');
  const signed=await login(),c=cookie(signed);
  expect((await request('/api/admin/world',undefined,{Cookie:c+'; '+c})).status).toBe(401);
  expect((await request('/api/admin/seasons/prepare',{}, {Origin:'https://foreign.invalid',Cookie:c})).status).toBe(403);
  const misconfigured=await worker.fetch(new Request(origin+'/api/admin/session'),{...binding,PLAYER_MODE:'production',PLAYER_ORIGIN:origin});
  expect(misconfigured.status).toBe(503);
 });
 it('keeps secret material out of Admin response and cache storage',async()=>{
  await grant('admin.access','admin.world.read');
  const signed=await login(),c=cookie(signed);
  const reply=await request('/api/admin/session',undefined,{Cookie:c});
  expect(reply.headers.get('cache-control')).toContain('no-store');
  expect(reply.headers.get('vary')).toBe('Cookie');
  const data=await reply.text();
  expect(data).not.toContain(c.split('=')[1]);
  expect(data).not.toContain(verifier);
  expect((await db.prepare('SELECT COUNT(*) n FROM admin_sessions').first<{n:number}>())!.n).toBe(0);
 });
});
