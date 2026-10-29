import {beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import worker from '../src/index.ts';
const binding=env as any,db=binding.DB,origin='http://localhost:2000';
const base={...binding,PLAYER_MODE:'local',PLAYER_ORIGIN:origin};
const password='registration-synthetic-password-2026';
const send=(path:string,body:unknown,config=base)=>worker.fetch(new Request(origin+path,{
 method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}),config);
beforeAll(async()=>{await applyD1Migrations(db,binding.TEST_MIGRATIONS)});
beforeEach(async()=>{await db.batch([db.prepare('DELETE FROM player_one_time_tokens'),db.prepare('DELETE FROM player_sessions'),
 db.prepare('DELETE FROM player_admin_operator_links'),db.prepare('DELETE FROM account_permissions'),
 db.prepare('DELETE FROM player_accounts'),db.prepare('DELETE FROM player_auth_throttles')])});
describe('PLAYER-AUTH registration verification deferred final gate',()=>{
 it('fails closed before creating an account when email delivery is not configured',async()=>{
  const response=await send('/api/player/register',{email:'new@example.invalid',password});
  expect(response.status).toBe(503);
  expect((await db.prepare('SELECT COUNT(*) AS n FROM player_accounts').first<{n:number}>())!.n).toBe(0);
 });
 it('registers pending account, retains digest only, activates once, and permits login',async()=>{
  let secret='',address='';
  const configured={...base,PLAYER_VERIFICATION_DELIVERY:async(email:string,token:string)=>{address=email;secret=token}};
  const registered=await send('/api/player/register',{email:' NEW@example.invalid ',password},configured);
  expect(registered.status).toBe(202);
  expect(await registered.json()).toEqual({accepted:true,verificationRequired:true});
  expect(address).toBe('new@example.invalid');
  const stored=await db.prepare('SELECT status,email_verified_at FROM player_accounts WHERE email_normalized=?').bind(address).first<{status:string;email_verified_at:number|null}>();
  expect(stored?.status).toBe('pending');expect(stored?.email_verified_at).toBeNull();
  expect((await send('/api/player/login',{email:address,password})).status).toBe(401);
  const tokens=await db.prepare('SELECT token_digest FROM player_one_time_tokens').all<{token_digest:string}>();
  expect(tokens.results).toHaveLength(1);expect(tokens.results[0].token_digest).not.toBe(secret);
  expect((await send('/api/player/verify-email',{token:secret})).status).toBe(200);
  expect((await send('/api/player/verify-email',{token:secret})).status).toBe(400);
  expect((await send('/api/player/login',{email:address,password})).status).toBe(200);
 });
 it('does not enumerate existing accounts and does not let users grant permissions',async()=>{
  const configured={...base,PLAYER_VERIFICATION_DELIVERY:async()=>{}};
  const input={email:'duplicate@example.invalid',password};
  expect((await send('/api/player/register',input,configured)).status).toBe(202);
  expect((await send('/api/player/register',input,configured)).status).toBe(202);
  const rejected=await send('/api/player/register',{...input,permissions:['admin.access']},configured);
  expect(rejected.status).toBe(422);
  expect((await db.prepare('SELECT COUNT(*) AS n FROM account_permissions').first<{n:number}>())!.n).toBe(0);
 });
 it('rejects expired and malformed tokens',async()=>{
  const configured={...base,PLAYER_VERIFICATION_DELIVERY:async()=>{}};
  await send('/api/player/register',{email:'expires@example.invalid',password},configured);
  await db.prepare('UPDATE player_one_time_tokens SET expires_at=issued_at+1').run();
  expect((await send('/api/player/verify-email',{token:'0'.repeat(64)})).status).toBe(400);
 });
});
