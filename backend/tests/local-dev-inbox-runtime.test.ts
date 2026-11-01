import {beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import type {Database} from '../src/database.ts';
import worker from '../src/index.ts';

const binding=env as any,db=binding.DB as Database,origin='http://app.localhost:2000';
const base={...binding,PLAYER_MODE:'local',PLAYER_ORIGIN:origin,PLAYER_LOCAL_INBOX_ENABLED:'true'};
const password='local-dev-registration-2026-safe-password';
const post=(path:string,payload:unknown,config=base)=>worker.fetch(new Request(origin+path,{
 method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)
}),config);
const get=(path:string,config=base)=>worker.fetch(new Request(origin+path,{headers:{Accept:'application/json'}}),config);
beforeAll(async()=>applyD1Migrations(db,binding.TEST_MIGRATIONS));
beforeEach(async()=>{
 await db.batch([
  db.prepare('DELETE FROM player_one_time_tokens'),
  db.prepare('DELETE FROM player_sessions'),
  db.prepare('DELETE FROM player_admin_operator_links'),
  db.prepare('DELETE FROM account_permissions'),
  db.prepare('DELETE FROM player_accounts'),
  db.prepare('DELETE FROM player_auth_throttles')
 ]);
 await db.prepare('CREATE TABLE IF NOT EXISTS local_dev_inbox (id TEXT PRIMARY KEY,kind TEXT NOT NULL,recipient TEXT NOT NULL,subject TEXT NOT NULL,link TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL)').run();
 await db.prepare('DELETE FROM local_dev_inbox').run();
});
describe('PLAYER-LOCAL-DEV-01 inbox and auth lifecycle',()=>{
 it('fails closed outside explicit local mode',async()=>{
  for(const config of [{...base,PLAYER_MODE:'preview'},{...base,PLAYER_MODE:'production'},{...base,PLAYER_LOCAL_INBOX_ENABLED:'false'}]){
   const r=await get('/api/local-dev/inbox',config);
   expect(r.status).toBe(404);
  }
 });
 it('registers, verifies once, authenticates, issues local reset, revokes old login and allows new login',async()=>{
  const email='local-inbox@example.invalid';
  expect((await post('/api/player/register',{email,username:'local_inbox_test',password})).status).toBe(202);
  const inbox=await get('/api/local-dev/inbox');
  expect(inbox.status).toBe(200);
  const data=await inbox.json() as {localOnly:boolean;messages:{kind:string;link:string}[]};
  expect(data.localOnly).toBe(true);
  expect(data.messages).toHaveLength(1);
  const verification=new URL(data.messages[0].link).searchParams.get('token');
  expect(verification).toMatch(/^[a-f0-9]{64}$/);
  expect((await post('/api/player/verify-email',{token:verification})).status).toBe(200);
  expect((await post('/api/player/verify-email',{token:verification})).status).toBe(400);
  const login=await post('/api/player/login',{email,password});
  expect(login.status).toBe(200);
  const cookie=login.headers.get('set-cookie')!.split(';')[0];
  expect((await post('/api/player/password-reset/request',{email})).status).toBe(202);
  const recovery=await get('/api/local-dev/inbox');
  const recovered=await recovery.json() as {messages:{kind:string;link:string}[]};
  const link=recovered.messages.find(x=>x.kind==='reset')?.link;
  expect(link).toBeTruthy();
  const token=new URL(link!).searchParams.get('token');
  expect((await post('/api/player/password-reset/complete',{token,newPassword:'replacement-local-dev-password-2026'})).status).toBe(200);
  expect((await post('/api/player/password-reset/complete',{token,newPassword:'replacement-local-dev-password-2026'})).status).toBe(400);
  expect((await worker.fetch(new Request(origin+'/api/player/session',{headers:{Cookie:cookie}}),base)).status).toBe(401);
  expect((await post('/api/player/login',{email,password})).status).toBe(401);
  expect((await post('/api/player/login',{email,password:'replacement-local-dev-password-2026'})).status).toBe(200);
 });
 it('rejects cross-origin DEV inbox requests and does not allow inbox in another origin',async()=>{
  const cross=await worker.fetch(new Request(origin+'/api/local-dev/inbox',{headers:{Origin:'https://attacker.invalid',Accept:'text/html'}}),base);
  expect(cross.status).toBe(403);
  const other=await worker.fetch(new Request('http://localhost:2000/api/local-dev/inbox',{headers:{Accept:'text/html'}}),base);
  expect(other.status).toBe(503);
 });
});
