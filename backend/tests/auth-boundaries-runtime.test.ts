import type {Database} from '../src/database.ts';
import {beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import worker from '../src/index.ts';
import {hashPassword} from '../src/passwords.ts';

const binding=env as any,db=binding.DB as Database,origin='http://localhost:2000';
const local={...binding,PLAYER_MODE:'local',PLAYER_ORIGIN:origin};
const password='auth-boundaries-test-password-2026';
const email='boundary-player@example.invalid';
const adminReads=[
 '/api/admin/session','/api/admin/world','/api/admin/seasons/events','/api/admin/seasons/archives',
 '/api/admin/seasons/history','/api/admin/seasons/next-candidate'
];
const adminWrites=[
 '/api/admin/seasons/next-approve','/api/admin/seasons/next-prepare','/api/admin/seasons/prepare',
 '/api/admin/seasons/calendar','/api/admin/seasons/start','/api/admin/seasons/advance',
 '/api/admin/seasons/events/reschedule','/api/admin/seasons/events/initialize','/api/admin/seasons/events/confirm',
 '/api/admin/seasons/events/start','/api/admin/seasons/events/advance','/api/admin/seasons/events/domestic-calendar',
 '/api/admin/seasons/events/international-draw','/api/admin/seasons/events/international-calendar',
 '/api/admin/seasons/archive','/api/admin/seasons/close','/api/admin/world/reset'
];
const playerReads=['/api/player/session','/api/player/sessions','/api/player/permissions','/api/player/admin/world'];
const playerWrites=['/api/player/logout','/api/player/account/change-password','/api/player/account/profile','/api/player/account/change-email','/api/player/account/revoke-other-sessions','/api/player/account/delete'];
function send(path:string,method:'GET'|'POST',cookie?:string,headers:Record<string,string>={}){
 return worker.fetch(new Request(origin+path,{
  method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{'Content-Type':'application/json'}:{}),...headers},
  body:method==='POST'?'{}':undefined
 }),local);
}
let verifier:string;
beforeAll(async()=>{await applyD1Migrations(db,binding.TEST_MIGRATIONS);verifier=await hashPassword(password)});
beforeEach(async()=>{
 await db.batch([
  db.prepare('DELETE FROM player_admin_operator_links'),
  db.prepare('DELETE FROM account_permissions'),
  db.prepare('DELETE FROM player_sessions'),
  db.prepare('DELETE FROM player_one_time_tokens'),
  db.prepare('DELETE FROM player_accounts'),
  db.prepare('DELETE FROM player_auth_throttles')
 ]);
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
  .bind('boundary-player',email,verifier,1,100,'active',100,100).run();
});
describe('BE-05 per-route negative access matrix (Worker with disposable D1)',()=>{
 it('denies anonymous Player private reads/writes and all active Admin routes',async()=>{
  for(const path of [...playerReads,...adminReads]){
   const response=await send(path,'GET');
   expect([path,response.status]).toEqual([path,401]);
   expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
   expect(response.headers.get('vary')).toBe('Cookie');
  }
  for(const path of [...playerWrites,...adminWrites]){
   const response=await send(path,'POST');
   expect([path,response.status]).toEqual([path,401]);
  }
 });
 it('allows Player self-access but denies every Admin route without operator link and grants',async()=>{
  const signed=await worker.fetch(new Request(origin+'/api/player/login',{
   method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
   body:JSON.stringify({email,password})
  }),local);
  expect(signed.status).toBe(200);
  const cookie=signed.headers.get('set-cookie')!.split(';')[0];
  for(const path of playerReads.slice(0,3))
   expect([path,(await send(path,'GET',cookie)).status]).toEqual([path,200]);
  for(const path of [...adminReads,...adminWrites]){
   const response=await send(path,adminReads.includes(path)?'GET':'POST',cookie);
   expect([path,response.status]).toEqual([path,403]);
  }
  expect((await send('/api/player/admin/world','GET',cookie)).status).toBe(403);
  expect((await send('/api/world','GET',cookie)).status).toBe(200);
  expect((await send('/api/world','GET')).status).toBe(200);
 });
 it('preserves strict Origin, cookie and retired legacy Admin failures',async()=>{
  expect((await send('/api/admin/login','POST')).status).toBe(410);
  expect((await send('/api/admin/logout','POST')).status).toBe(410);
  expect((await send('/api/admin/world','GET',undefined,{Cookie:'fa_admin_local='+('a'.repeat(64))})).status).toBe(401);
  expect((await send('/api/player/login','POST',undefined,{Origin:'https://attacker.invalid'})).status).toBe(403);
  expect((await send('/api/admin/seasons/prepare','POST',undefined,{Origin:'https://attacker.invalid'})).status).toBe(403);
  expect((await send('/api/admin/seasons/prepare','POST',undefined,{Origin:''})).status).toBe(403);
  expect((await send('/api/admin/world','GET',undefined,{Cookie:'fa_player_local=a; fa_player_local=b'})).status).toBe(401);
 });
});
