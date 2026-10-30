import type {Database} from '../src/database.ts';
import {beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import worker from '../src/index.ts';
const binding=env as any,db=binding.DB as Database,origin='http://localhost:2000';
const base={...binding,PLAYER_MODE:'local',PLAYER_ORIGIN:origin};
const password='registration-synthetic-password-2026';
const send=(path:string,body:unknown,config=base)=>worker.fetch(new Request(origin+path,{
 method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}),config);
beforeAll(async()=>{await applyD1Migrations(db,binding.TEST_MIGRATIONS)});
beforeEach(async()=>{await db.batch([db.prepare('DELETE FROM player_one_time_tokens'),db.prepare('DELETE FROM player_sessions'),
 db.prepare('DELETE FROM player_admin_operator_links'),db.prepare('DELETE FROM account_permissions'),
 db.prepare('DELETE FROM player_accounts'),db.prepare('DELETE FROM player_auth_throttles')])});
describe('PLAYER-AUTH registration verification deferred final gate',()=>{
 it('does not enable Cloudflare email automatically in local mode even when a fake binding and opt-in are supplied',async()=>{
  let sends=0;
  const unsafe={...base,PLAYER_EMAIL_DELIVERY_ENABLED:'cloudflare',PLAYER_EMAIL_FROM:'noreply@example.invalid',
   EMAIL:{send:async()=>{sends++}}};
  const response=await send('/api/player/register',{
   email:'binding-local@example.invalid',password,username:'local_binding_user'
  },unsafe);
  expect(response.status).toBe(503);
  expect(sends).toBe(0);
  expect((await db.prepare('SELECT COUNT(*) AS n FROM player_accounts').first<{n:number}>())?.n).toBe(0);
 });
 it('fails closed before creating an account when email delivery is not configured',async()=>{
  const response=await send('/api/player/register',{email:'new@example.invalid',password,username:'new_player'});
  expect(response.status).toBe(503);
  expect((await db.prepare('SELECT COUNT(*) AS n FROM player_accounts').first<{n:number}>())!.n).toBe(0);
 });
 it('registers pending account, retains digest only, activates once, and permits login',async()=>{
  let secret='',address='';
  const configured={...base,PLAYER_VERIFICATION_DELIVERY:async(email:string,token:string)=>{address=email;secret=token}};
  const registered=await send('/api/player/register',{email:' NEW@example.invalid ',password,username:'New_Player',nationality:'IT',city:' Bologna '},configured);
  expect(registered.status).toBe(202);
  expect(await registered.json()).toEqual({accepted:true,verificationRequired:true});
  expect(address).toBe('new@example.invalid');
  const stored=await db.prepare('SELECT status,email_verified_at FROM player_accounts WHERE email_normalized=?').bind(address).first<{status:string;email_verified_at:number|null}>();
  const profile=await db.prepare('SELECT username,nationality,city FROM player_accounts WHERE email_normalized=?').bind(address).first();
  expect(profile).toEqual({username:'New_Player',nationality:'IT',city:'Bologna'});
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
  const input={email:'duplicate@example.invalid',password,username:'duplicate_player'};
  expect((await send('/api/player/register',input,configured)).status).toBe(202);
  expect((await send('/api/player/register',{...input,username:'another_free_name'},configured)).status).toBe(202);
  const rejected=await send('/api/player/register',{...input,permissions:['admin.access']},configured);
  expect(rejected.status).toBe(422);
  expect((await db.prepare('SELECT COUNT(*) AS n FROM account_permissions').first<{n:number}>())!.n).toBe(0);
 });
 it('rejects expired and malformed tokens',async()=>{
  const configured={...base,PLAYER_VERIFICATION_DELIVERY:async()=>{}};
  await send('/api/player/register',{email:'expires@example.invalid',password,username:'expires_player'},configured);
  await db.prepare('UPDATE player_one_time_tokens SET expires_at=issued_at+1').run();
  expect((await send('/api/player/verify-email',{token:'0'.repeat(64)})).status).toBe(400);
 });
});

it('unique username conflicts are case insensitive and leave no orphan tokens',async()=>{
 const configured={...base,PLAYER_VERIFICATION_DELIVERY:async()=>{}};
 const results=await Promise.all([
  send('/api/player/register',{email:'one@example.invalid',password,username:'Unique_Player'},configured),
  send('/api/player/register',{email:'two@example.invalid',password,username:'unique_player'},configured)
 ]);
 expect(results.map(r=>r.status).sort()).toEqual([202,409]);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM player_accounts').first<{n:number}>())!.n).toBe(1);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM player_one_time_tokens').first<{n:number}>())!.n).toBe(1);
});
it('rejects missing username, malformed countries and excessive cities before delivery',async()=>{
 let deliveries=0;
 const configured={...base,PLAYER_VERIFICATION_DELIVERY:async()=>{deliveries++}};
 for(const extra of [{},{username:'ab'},{username:'valid',nationality:'ZZ'},{username:'valid',city:'x'.repeat(101)}]){
  expect((await send('/api/player/register',{email:'invalid@example.invalid',password,...extra},configured)).status).toBe(422);
 }
 expect(deliveries).toBe(0);
});
it('failed delivery releases username and removes the one-time token',async()=>{
 const failed={...base,PLAYER_VERIFICATION_DELIVERY:async()=>{throw Error('synthetic delivery failure')}};
 const input={email:'retry@example.invalid',password,username:'Retry_Player'};
 expect((await send('/api/player/register',input,failed)).status).toBe(503);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM player_one_time_tokens').first<{n:number}>())!.n).toBe(0);
 expect((await send('/api/player/register',input,{...base,PLAYER_VERIFICATION_DELIVERY:async()=>{}})).status).toBe(202);
});
it('taken username responses cannot distinguish existing and unknown emails',async()=>{
 const configured={...base,PLAYER_VERIFICATION_DELIVERY:async()=>{}};
 expect((await send('/api/player/register',{email:'known@example.invalid',password,username:'Known_User'},configured)).status).toBe(202);
 const known=await send('/api/player/register',{email:'known@example.invalid',password,username:'known_user'},configured);
 const unknown=await send('/api/player/register',{email:'unknown@example.invalid',password,username:'known_user'},configured);
 expect(known.status).toBe(unknown.status);
 expect(await known.json()).toEqual(await unknown.json());
});

it('propagates the registration request language to simulated delivery',async()=>{
 let deliveredLanguage='';
 const config={...base,PLAYER_VERIFICATION_DELIVERY:async(_email:string,_token:string,locale?:string)=>{deliveredLanguage=locale??''}};
 const response=await worker.fetch(new Request(origin+'/api/player/register',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Accept-Language':'it-IT,it;q=0.9'},
  body:JSON.stringify({email:'language@example.invalid',password,username:'language_user'})
 }),config);
 expect(response.status).toBe(202);
 expect(deliveredLanguage).toBe('it-IT,it;q=0.9');
});

it('completes simulated registration, one-time verification and authenticated login without outbound email',async()=>{
 let message:{to:string;token:string;locale?:string}|undefined;
 const config={...base,PLAYER_VERIFICATION_DELIVERY:async(to:string,token:string,locale?:string)=>{message={to,token,locale}}};
 const payload={email:'journey@example.invalid',password,username:'journey_player'};
 const response=await worker.fetch(new Request(origin+'/api/player/register',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Accept-Language':'it-IT'},
  body:JSON.stringify(payload)
 }),config);
 expect(response.status).toBe(202);
 expect(message?.to).toBe(payload.email);
 expect(message?.locale).toBe('it-IT');
 expect((await send('/api/player/login',{email:payload.email,password})).status).toBe(401);
 const token=message!.token;
 expect(token).toMatch(/^[0-9a-f]{64}$/);
 expect((await send('/api/player/verify-email',{token})).status).toBe(200);
 expect((await send('/api/player/verify-email',{token})).status).toBe(400);
 const signed=await send('/api/player/login',{email:payload.email,password});
 expect(signed.status).toBe(200);
 const sessionCookie=signed.headers.get('set-cookie')!.split(';')[0];
 const restored=await worker.fetch(new Request(origin+'/api/player/session',{headers:{Origin:origin,Cookie:sessionCookie}}),base);
 expect(restored.status).toBe(200);
 expect((await restored.json() as any).authenticated).toBe(true);
});
