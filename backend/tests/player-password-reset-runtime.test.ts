import type {Database} from '../src/database.ts';
import {beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import worker from '../src/index.ts';
import {hashPassword} from '../src/passwords.ts';

const binding=env as any,db=binding.DB as Database,origin='http://localhost:2000';
const base={...binding,PLAYER_MODE:'local',PLAYER_ORIGIN:origin};
const email='recovery@example.invalid',password='recovery-original-password-2026';
const request=(path:string,body:unknown,config=base)=>worker.fetch(new Request(origin+path,{
 method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)
}),config);
beforeAll(async()=>{await applyD1Migrations(db,binding.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await db.batch([
  db.prepare('DELETE FROM player_one_time_tokens'),
  db.prepare('DELETE FROM player_sessions'),
  db.prepare('DELETE FROM player_admin_operator_links'),
  db.prepare('DELETE FROM account_permissions'),
  db.prepare('DELETE FROM player_accounts'),
  db.prepare('DELETE FROM player_auth_throttles')
 ]);
 const now=Math.floor(Date.now()/1000);
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
  .bind('recovery-player',email,await hashPassword(password),1,now-60,'active',now-60,now-60).run();
});
describe('PLAYER-AUTH password recovery delivery contract (deferred acceptance)',()=>{
 it('fails closed when no approved outbound delivery is configured',async()=>{
  const res=await request('/api/player/password-reset/request',{email});
  expect(res.status).toBe(503);
  const count=await db.prepare('SELECT COUNT(*) AS n FROM player_one_time_tokens').first<{n:number}>();
  expect(count?.n).toBe(0);
 });
 it('keeps unknown-account reset responses generic without invoking delivery',async()=>{
  let deliveries=0;
  const config={...base,PLAYER_RESET_DELIVERY:async()=>{deliveries++}};
  const missing=await request('/api/player/password-reset/request',{email:'missing@example.invalid'},config);
  const existing=await request('/api/player/password-reset/request',{email},config);
  expect(missing.status).toBe(202);
  expect(existing.status).toBe(202);
  expect(await missing.json()).toEqual(await existing.json());
  expect(deliveries).toBe(1);
 });
 it('consumes a reset token exactly once, updates credentials, and invalidates old sessions',async()=>{
  let token='';
  const config={...base,PLAYER_RESET_DELIVERY:async(_email:string,secret:string)=>{token=secret}};
  const signed=await request('/api/player/login',{email,password});
  expect(signed.status).toBe(200);
  const previousCookie=signed.headers.get('set-cookie')!.split(';')[0];
  const requested=await request('/api/player/password-reset/request',{email},config);
  expect(requested.status).toBe(202);
  expect(token).toMatch(/^[0-9a-f]{64}$/);
  const digest=await db.prepare('SELECT token_digest FROM player_one_time_tokens WHERE account_id=?')
   .bind('recovery-player').first<{token_digest:string}>();
  expect(digest?.token_digest).not.toBe(token);
  const newPassword='recovery-new-password-2026';
  const changed=await request('/api/player/password-reset/complete',{token,newPassword});
  expect(changed.status).toBe(200);
  expect((await request('/api/player/password-reset/complete',{token,newPassword})).status).toBe(400);
  const old=await worker.fetch(new Request(origin+'/api/player/session',{
   method:'GET',headers:{Origin:origin,Cookie:previousCookie}
  }),base);
  expect(old.status).toBe(401);
  expect((await request('/api/player/login',{email,password})).status).toBe(401);
  expect((await request('/api/player/login',{email,password:newPassword})).status).toBe(200);
 });
 it('preserves an older valid reset token on delivery failure',async()=>{
  let firstToken='';
  const delivered={...base,PLAYER_RESET_DELIVERY:async(_email:string,token:string)=>{firstToken=token}};
  expect((await request('/api/player/password-reset/request',{email},delivered)).status).toBe(202);
  const failed={...base,PLAYER_RESET_DELIVERY:async()=>{throw new Error('unavailable')}};
  expect((await request('/api/player/password-reset/request',{email},failed)).status).toBe(503);
  const records=await db.prepare("SELECT COUNT(*) AS n FROM player_one_time_tokens WHERE purpose='reset_password' AND consumed_at IS NULL")
   .first<{n:number}>();
  expect(records?.n).toBe(1);
  const result=await request('/api/player/password-reset/complete',{
   token:firstToken,newPassword:'recovery-after-failure-password-2026'
  });
  expect(result.status).toBe(200);
 });
 it('rejects expired, malformed, and previously consumed recovery links',async()=>{
  let token='';
  const config={...base,PLAYER_RESET_DELIVERY:async(_email:string,raw:string)=>{token=raw}};
  expect((await request('/api/player/password-reset/request',{email},config)).status).toBe(202);
  expect((await request('/api/player/password-reset/complete',{
   token:'not-a-token',newPassword:'recovery-invalid-token-password-2026'
  })).status).toBe(400);
  await db.prepare("UPDATE player_one_time_tokens SET expires_at=issued_at WHERE purpose='reset_password'")
   .run();
  expect((await request('/api/player/password-reset/complete',{
   token,newPassword:'recovery-expired-token-password-2026'
  })).status).toBe(400);
  expect((await request('/api/player/login',{email,password})).status).toBe(200);
 });
 it('enforces per-account password-reset throttling independently of email existence',async()=>{
  const deliveries:string[]=[];
  const config={...base,PLAYER_RESET_DELIVERY:async(address:string)=>{deliveries.push(address)}};
  for(let n=0;n<3;n++){
   expect((await request('/api/player/password-reset/request',{email},config)).status).toBe(202);
  }
  const exceeded=await request('/api/player/password-reset/request',{email},config);
  expect(exceeded.status).toBe(429);
  expect(exceeded.headers.get('Retry-After')).toBe('900');
  expect(deliveries).toHaveLength(3);
  // A different account must not inherit this account's quota.
  expect((await request('/api/player/password-reset/request',{
   email:'unknown-account@example.invalid'
  },config)).status).toBe(202);
 });
 it('rejects cross-origin reset requests before issuing any one-time token',async()=>{
  const response=await worker.fetch(new Request(origin+'/api/player/password-reset/request',{
   method:'POST',headers:{Origin:'https://attacker.example.invalid','Content-Type':'application/json'},
   body:JSON.stringify({email})
  }),{...base,PLAYER_RESET_DELIVERY:async()=>{}});
  expect(response.status).toBe(403);
  const n=await db.prepare('SELECT COUNT(*) AS n FROM player_one_time_tokens').first<{n:number}>();
  expect(n?.n).toBe(0);
 });
 it('revokes an older reset link only after a replacement was successfully delivered',async()=>{
  const issued:string[]=[];
  const config={...base,PLAYER_RESET_DELIVERY:async(_email:string,token:string)=>{issued.push(token)}};
  expect((await request('/api/player/password-reset/request',{email},config)).status).toBe(202);
  expect((await request('/api/player/password-reset/request',{email},config)).status).toBe(202);
  expect(issued).toHaveLength(2);
  expect((await request('/api/player/password-reset/complete',{
   token:issued[0],newPassword:'expired-replacement-password-2026'
  })).status).toBe(400);
  expect((await request('/api/player/password-reset/complete',{
   token:issued[1],newPassword:'valid-replacement-password-2026'
  })).status).toBe(200);
 });
});
