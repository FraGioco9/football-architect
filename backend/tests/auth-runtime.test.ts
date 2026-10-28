import {beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import worker from '../src/index.ts';
import {hashPassword} from '../src/passwords.ts';
const binding=env as any;
const db=binding.DB;
const origin='http://localhost:2000';
const config={...binding,ADMIN_MODE:'local',ADMIN_ORIGIN:origin};
const password='synthetic-operator-password-2026';
let verifier:string;
const request=(path:string,body?:unknown,headers:Record<string,string>={},method=body===undefined?'GET':'POST')=>worker.fetch(new Request(origin+path,{
 method,headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)
}),config);
const login=()=>request('/api/admin/login',{email:' Operator@Example.Invalid ',password});
const cookie=(r:Response)=>r.headers.get('set-cookie')!.split(';')[0];
beforeAll(async()=>{
 await applyD1Migrations(db,binding.TEST_MIGRATIONS);
 verifier=await hashPassword(password);
});
beforeEach(async()=>{
 await db.batch([db.prepare('DELETE FROM admin_sessions'),db.prepare('DELETE FROM admin_accounts'),db.prepare('DELETE FROM auth_throttles')]);
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES (?,?,?,?)').bind('operator','operator@example.invalid',verifier,Math.floor(Date.now()/1000)).run();
});
describe('real Worker/D1 authentication without remote services',()=>{
 it('logs in, persists digests, authorizes reads, preserves public independence and logs out',async()=>{
  const r=await login();expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('no-store');
  expect(r.headers.get('set-cookie')).toMatch(/^fa_admin_local=[a-f0-9]{64};.*HttpOnly.*SameSite=Strict.*Path=\//);
  const body=await r.json() as any;expect(body.actor).toEqual({id:'operator',email:'operator@example.invalid'});expect(body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
  const sessionCookie=cookie(r);
  const rows=await db.prepare('SELECT * FROM admin_sessions').all();expect(rows.results).toHaveLength(1);
  expect(JSON.stringify(rows.results)).not.toContain(sessionCookie.split('=')[1]);expect(JSON.stringify(rows.results)).not.toContain(body.csrfToken);
  expect((await request('/api/admin/session',undefined,{Cookie:sessionCookie})).status).toBe(200);
  expect((await request('/api/admin/world',undefined,{Cookie:sessionCookie})).status).toBe(200);
  expect((await request('/api/world')).status).toBe(200);
  expect((await request('/api/admin/world')).status).toBe(401);
  const denied=await request('/api/admin/logout',{}, {Cookie:sessionCookie,'X-CSRF-Token':'0'.repeat(64)});expect(denied.status).toBe(403);
  const loggedOut=await request('/api/admin/logout',{}, {Cookie:sessionCookie,'X-CSRF-Token':body.csrfToken});expect(loggedOut.status).toBe(200);expect(loggedOut.headers.get('set-cookie')).toContain('Max-Age=0');
  expect((await request('/api/admin/session',undefined,{Cookie:sessionCookie})).status).toBe(401);
 });
 it('uses generic wrong, absent and disabled account failures and stores no plaintext credentials',async()=>{
  const wrong=await request('/api/admin/login',{email:'operator@example.invalid',password:'wrong-synthetic-password-2026'});
  const missing=await request('/api/admin/login',{email:'missing@example.invalid',password});
  await db.prepare('UPDATE admin_accounts SET enabled=0').run();const disabled=await login();
  expect([wrong.status,missing.status,disabled.status]).toEqual([401,401,401]);
  expect(await wrong.json()).toEqual(await missing.json());expect(await disabled.json()).toEqual({error:{code:'invalid_credentials'}});
  const sessions=await db.prepare('SELECT * FROM admin_sessions').all();expect(sessions.results).toHaveLength(0);
 });
 it('reserves persisted account throttle before verification, including concurrent requests',async()=>{
  const results=await Promise.all(Array.from({length:6},()=>request('/api/admin/login',{email:'operator@example.invalid',password:'wrong-synthetic-password-2026'})));
  expect(results.some(r=>r.status===429)).toBe(true);
  expect((await login()).status).toBe(429);
  const counters=await db.prepare('SELECT * FROM auth_throttles').all();expect(counters.results).toHaveLength(2);expect(counters.results.some((x:any)=>x.attempts>=6)).toBe(true);
 });
 it('rejects foreign/missing/null Origin, wrong methods, oversized and malformed JSON',async()=>{
  for(const value of ['http://evil.invalid','null',''])expect((await request('/api/admin/login',{email:'operator@example.invalid',password},{Origin:value})).status).toBe(403);
  expect((await request('/api/admin/login')).status).toBe(405);
  const malformed=await worker.fetch(new Request(origin+'/api/admin/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{broken'}),config);expect(malformed.status).toBe(400);
  expect((await request('/api/admin/login',{email:'operator@example.invalid',password:'x'.repeat(20000)})).status).toBe(413);
 });
 it('rejects expired/idle, disabled and rotated sessions against durable account state',async()=>{
  const r=await login();const c=cookie(r);
  await db.prepare('UPDATE admin_accounts SET credential_version=credential_version+1').run();
  expect((await request('/api/admin/session',undefined,{Cookie:c})).status).toBe(401);
  const next=await login();const nextCookie=cookie(next);
  await db.prepare('UPDATE admin_sessions SET created_at=?,last_seen_at=?,expires_at=?').bind(Math.floor(Date.now()/1000)-1900,Math.floor(Date.now()/1000)-1801,Math.floor(Date.now()/1000)+1000).run();
  expect((await request('/api/admin/session',undefined,{Cookie:nextCookie})).status).toBe(401);
  const active=await login();expect(active.status).toBe(200);await db.prepare('UPDATE admin_accounts SET enabled=0').run();
  expect((await request('/api/admin/session',undefined,{Cookie:cookie(active)})).status).toBe(401);
 });
 it('keeps production and misconfigured auth fail-closed and refuses forged approval',async()=>{
  expect((await worker.fetch(new Request('https://app.example.invalid/api/admin/session'),{...binding,ADMIN_MODE:'production',ADMIN_ORIGIN:'https://app.example.invalid'})).status).toBe(503);
  const r=await login();const b=await r.json() as any;
  const prepared=await request('/api/admin/seasons/prepare',{expectedGeneration:(await (await request('/api/world')).json() as any).world.generation,expectedRevision:0},{Cookie:cookie(r),'X-CSRF-Token':b.csrfToken,'Idempotency-Key':'synthetic-prepare-0001'});
  expect(prepared.status).toBe(422);expect(await prepared.json()).toEqual({error:{code:'catalogue_not_approved'}});
  expect((await request('/api/admin/signup',{})).status).toBe(404);
 });
 it('rotates the current session on login, refreshes idle time without extending absolute expiry, and makes logout replay safe',async()=>{
  const first=await login();const old=cookie(first);const next=await request('/api/admin/login',{email:'operator@example.invalid',password},{Cookie:old});
  expect(next.status).toBe(200);const current=cookie(next),csrf=(await next.json() as any).csrfToken;
  expect(current).not.toBe(old);expect((await request('/api/admin/session',undefined,{Cookie:old})).status).toBe(401);
  await db.prepare('UPDATE admin_sessions SET created_at=created_at-60,last_seen_at=last_seen_at-60,expires_at=expires_at-60').run();
  const before=await db.prepare('SELECT last_seen_at,expires_at FROM admin_sessions').first();
  const read=await request('/api/admin/session',undefined,{Cookie:current});expect(read.status).toBe(200);expect((await read.json() as any).csrfToken).toBe(csrf);
  const after=await db.prepare('SELECT last_seen_at,expires_at FROM admin_sessions').first();expect(after.last_seen_at).toBeGreaterThan(before.last_seen_at);expect(after.expires_at).toBe(before.expires_at);
  for(let i=0;i<2;i++)expect((await request('/api/admin/logout',{}, {Cookie:current,'X-CSRF-Token':csrf})).status).toBe(200);
 });
 it('enforces source throttles across account identifiers and treats storage failures as unavailable',async()=>{
  const now=Math.floor(Date.now()/1000);
  const {hashText}=await import('../src/auth.ts');
  await db.prepare('INSERT INTO auth_throttles VALUES(?,?,?,?)').bind('source:'+await hashText('local-loopback'),now,30,now+900).run();
  expect((await request('/api/admin/login',{email:'another@example.invalid',password})).status).toBe(429);
  const unavailable={...config,DB:{prepare(){throw Error('private SQL storage detail')},batch(){throw Error('private SQL storage detail')}}};
  const r=await worker.fetch(new Request(origin+'/api/admin/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'operator@example.invalid',password})}),unavailable as any);
  expect(r.status).toBe(503);expect(await r.text()).not.toContain('private SQL');
 });
 it('rejects ambiguous duplicate cookies and absolute expiry and does not trust forwarded local client headers',async()=>{
  const signed=await login();const c=cookie(signed);
  expect((await request('/api/admin/session',undefined,{Cookie:c+'; '+c})).status).toBe(401);
  const now=Math.floor(Date.now()/1000);
  await db.prepare('UPDATE admin_sessions SET created_at=?,last_seen_at=?,expires_at=?').bind(now-100,now-1,now).run();
  expect((await request('/api/admin/session',undefined,{Cookie:c})).status).toBe(401);
  for(let i=0;i<6;i++)await request('/api/admin/login',{email:'operator@example.invalid',password:'incorrect-synthetic-password-2026'},{'X-Forwarded-For':'192.0.2.'+i,'CF-Connecting-IP':'192.0.2.'+i});
  expect((await login()).status).toBe(429);
 });

 it('denied sources cannot grow account throttle rows and expired records are pruned in bounded batches',async()=>{
  const now=Math.floor(Date.now()/1000),{hashText}=await import('../src/auth.ts');
  await db.prepare('INSERT INTO auth_throttles VALUES(?,?,?,?)').bind('source:'+await hashText('local-loopback'),now,30,now+900).run();
  for(let i=0;i<8;i++)expect((await request('/api/admin/login',{email:'new-'+i+'@example.invalid',password})).status).toBe(429);
  expect((await db.prepare('SELECT COUNT(*) AS n FROM auth_throttles').first()).n).toBe(1);
  await db.prepare('DELETE FROM auth_throttles').run();
  await db.batch(Array.from({length:80},(_,i)=>db.prepare('INSERT INTO auth_throttles VALUES(?,?,?,?)').bind('expired-'+i,now-1000,1,now-100)));
  await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind('e'.repeat(64),'operator',1,'d'.repeat(64),now-100,now-100,now-1).run();
  expect((await login()).status).toBe(200);
  expect((await db.prepare('SELECT COUNT(*) AS n FROM auth_throttles WHERE throttle_key LIKE ?').bind('expired-%').first()).n).toBe(16);
  expect(await db.prepare('SELECT * FROM admin_sessions WHERE token_digest=?').bind('e'.repeat(64)).first()).toBeNull();
 });

 it('successful login releases only its own account reservation without clearing failed attempts',async()=>{
  for(let i=0;i<6;i++)expect((await login()).status).toBe(200);
  for(let i=0;i<5;i++)expect((await request('/api/admin/login',{email:'operator@example.invalid',password:'wrong-synthetic-password-2026'})).status).toBe(401);
  expect((await login()).status).toBe(429);
 });

});
