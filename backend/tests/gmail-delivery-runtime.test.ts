import {beforeAll,beforeEach,afterEach,it,expect,vi} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import worker from '../src/index.ts';
import type {Database} from '../src/database.ts';
const binding=env as any,db=binding.DB as Database,origin='https://football-architect-preview.example.workers.dev';
const config={...binding,PLAYER_MODE:'preview',PLAYER_TRUSTED_SOURCE:'cloudflare',PLAYER_ORIGIN:origin,
 PLAYER_EMAIL_DELIVERY_ENABLED:'gmail-preview',PLAYER_EMAIL_FROM:'notifications@gmail.com',
 PLAYER_EMAIL_PREVIEW_RECIPIENTS:'tester@example.invalid',GMAIL_CLIENT_ID:'synthetic-client',
 GMAIL_CLIENT_SECRET:'synthetic-secret',GMAIL_REFRESH_TOKEN:'synthetic-refresh'};
const password='synthetic-gmail-player-password-2026';
const call=(path:string,body:unknown,configuration=config)=>worker.fetch(new Request(configuration.PLAYER_ORIGIN+path,{
 method:'POST',headers:{Origin:configuration.PLAYER_ORIGIN,'CF-Connecting-IP':'192.0.2.45','Content-Type':'application/json','Accept-Language':'it'},body:JSON.stringify(body)}),configuration);
beforeAll(async()=>{await applyD1Migrations(db,binding.TEST_MIGRATIONS);await db.prepare("INSERT INTO account_environment_pool VALUES(1,'dev-preview',1)").run()});
beforeEach(async()=>{await db.batch([db.prepare('DELETE FROM player_one_time_tokens'),db.prepare('DELETE FROM player_sessions'),
 db.prepare('DELETE FROM player_admin_operator_links'),db.prepare('DELETE FROM account_permissions'),db.prepare('DELETE FROM player_accounts'),db.prepare('DELETE FROM player_auth_throttles')])});
afterEach(()=>vi.restoreAllMocks());
it('uses the configured Gmail transport through real registration, one-time verification and password recovery',async()=>{
 const links:string[]=[],requests:string[]=[];
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const r=new Request(input,init);
  requests.push(r.url);
  if(r.url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'synthetic-access',token_type:'Bearer',expires_in:3600});
  expect(r.url).toBe('https://gmail.googleapis.com/gmail/v1/users/notifications%40gmail.com/messages/send');
  const {raw}=await r.json() as {raw:string};
  const mime=atob(raw.replace(/-/g,'+').replace(/_/g,'/'));
  const part=mime.match(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)(?=\r\n--)/)![1];
  links.push(atob(part.replace(/\s/g,'')).match(/https:\/\/[^\s]+/)![0]);
  return Response.json({id:'synthetic-message',threadId:'synthetic-thread',labelIds:['SENT']});
 });
 const created=await call('/api/player/register',{email:'tester@example.invalid',password,username:'Gmail_Tester'});
 expect(created.status,JSON.stringify({body:await created.clone().json(),requests,links})).toBe(202);expect(await created.json()).toEqual({accepted:true,verificationRequired:true});
 const verify=new URL(links[0]);expect(verify.origin).toBe(origin);expect(verify.pathname).toBe('/account/verify-email');expect(verify.searchParams.get('lang')).toBe('it');
 const token=verify.searchParams.get('token')!;
 expect((await db.prepare('SELECT token_digest FROM player_one_time_tokens').first<{token_digest:string}>())?.token_digest).not.toBe(token);
 expect((await call('/api/player/verify-email',{token})).status).toBe(200);
 expect((await call('/api/player/verify-email',{token})).status).toBe(400);
 const login=await call('/api/player/login',{email:'tester@example.invalid',password});expect(login.status).toBe(200);
 const cookie=login.headers.get('set-cookie')!.split(';')[0];
 expect((await call('/api/player/password-reset/request',{email:'tester@example.invalid'})).status).toBe(202);
 const reset=new URL(links[1]);expect(reset.pathname).toBe('/account/recover');expect(reset.searchParams.get('lang')).toBe('it');
 const resetBody={token:reset.searchParams.get('token'),newPassword:password+'-new'};
 expect((await call('/api/player/password-reset/complete',resetBody)).status).toBe(200);
 expect((await call('/api/player/password-reset/complete',resetBody)).status).toBe(400);
 expect((await worker.fetch(new Request(origin+'/api/player/session',{headers:{'CF-Connecting-IP':'192.0.2.45',Cookie:cookie}}),config)).status).toBe(401);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM account_permissions').first<{n:number}>())?.n).toBe(0);
});
it('removes pending registration for blocked recipients and OAuth failure',async()=>{
 vi.spyOn(globalThis,'fetch').mockImplementation(async()=>Response.json({error:'private-provider-response'},{status:401}));
 const failed=await call('/api/player/register',{email:'other@example.invalid',password,username:'No_Gmail_Delivery'});
 expect(failed.status).toBe(503);expect(await failed.json()).toEqual({error:{code:'verification_unavailable'}});
 expect((await db.prepare("SELECT count(*) AS n FROM player_accounts WHERE username='No_Gmail_Delivery'").first<{n:number}>())?.n).toBe(0);
 expect((await call('/api/player/register',{email:'tester@example.invalid',password,username:'Failed_Gmail_Delivery'})).status).toBe(503);
 expect((await db.prepare("SELECT count(*) AS n FROM player_accounts WHERE username='Failed_Gmail_Delivery'").first<{n:number}>())?.n).toBe(0);
 expect((await db.prepare('SELECT count(*) AS n FROM player_one_time_tokens').first<{n:number}>())?.n).toBe(0);
});
it('never activates Gmail from local or Production configurations or absent recipient approval',async()=>{
 const transport=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('no_external_calls'));
 for(const extra of [{PLAYER_MODE:'local',PLAYER_ORIGIN:'http://app.localhost:2000'},{PLAYER_MODE:'production'},
  {PLAYER_EMAIL_PREVIEW_RECIPIENTS:''},{GMAIL_REFRESH_TOKEN:''}]){
  expect((await call('/api/player/register',{email:'blocked@example.invalid',password,username:'Blocked_Gmail'},{...config,...extra})).status).toBe(503);
 }
 expect(transport).not.toHaveBeenCalled();
});
