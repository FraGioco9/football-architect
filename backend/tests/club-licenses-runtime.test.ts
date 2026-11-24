import {beforeAll,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {clearTestWorld} from './fixtures/test-world.ts';
import {seedUnifiedAdminHttp} from './fixtures/unified-admin-http.ts';
import {handleAdmin} from '../src/http-admin.ts';
import type {Database} from '../src/database.ts';

const binding=env as any,db=binding.DB as Database;
const origin='http://app.localhost:2000';
const now=Math.floor(Date.now()/1000);
const actorId='license-admin-fixture',email='license-admin@example.invalid',token='b'.repeat(64);
let csrf='',accountId='';
const service={DB:db,PLAYER_MODE:'local',PLAYER_ORIGIN:origin};
async function call(method:'GET'|'POST'|'PUT',path='',body?:unknown,csrfOverride?:string){
 const response=await handleAdmin(new Request(origin+'/api/admin/club-licenses'+path,{
  method,headers:{Cookie:'fa_player_local='+token,Origin:origin,...(method==='POST'
   ?{'Content-Type':'application/json','X-CSRF-Token':csrfOverride??csrf}:{})},
  body:method==='POST'?JSON.stringify(body):undefined
 }),service);
 return {status:response.status,data:await response.json() as any};
}
beforeAll(async()=>{
 await applyD1Migrations(db,binding.TEST_MIGRATIONS);
 await clearTestWorld(db);
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)')
  .bind(actorId,email,'test-fixture',now-100).run();
 ({csrf,playerId:accountId}=await seedUnifiedAdminHttp(db,actorId,email,now,token));
});
it('protects license list, validates commands, and logs assign/revoke with optimistic versions',async()=>{
 const anon=await handleAdmin(new Request(origin+'/api/admin/club-licenses'),service);
 expect(anon.status).toBe(401);
 expect((await call('PUT')).status).toBe(405);
 expect((await call('GET','?bad=1')).status).toBe(422);
 const original=await call('GET');
 expect(original.status).toBe(200);
 expect(original.data.clubs).toHaveLength(320);
 expect(original.data.history).toEqual([]);
 const search=await call('GET','/accounts?q=license-admin');
 expect(search.status).toBe(200);
 expect(search.data.accounts).toContainEqual({id:accountId,email});
 expect((await call('GET','/accounts?q=a')).status).toBe(422);
 const command={clubKey:'IT-1',accountId,expectedAccountId:null,expectedVersion:0};
 expect((await call('POST','',command,'bad')).status).toBe(403);
 expect((await call('POST','',{...command,clubKey:'it-1'})).status).toBe(422);
 expect((await call('POST','',{...command,accountId:'missing'})).status).toBe(422);
 expect((await call('POST','',{...command,expectedVersion:1})).status).toBe(409);
 expect((await call('POST','',command)).data).toMatchObject({action:'assign',version:1});
 expect((await call('POST','',command)).status).toBe(409);
 const revoke={clubKey:'IT-1',accountId:null,expectedAccountId:accountId,expectedVersion:1};
 expect((await call('POST','',revoke)).data).toMatchObject({action:'revoke',version:2});
 expect((await call('POST','',command)).status).toBe(409);
 const latest=await call('GET');
 expect(latest.data.clubs.find((c:any)=>c.clubKey==='IT-1')).toMatchObject({accountId:null,version:2});
 expect(latest.data.history).toHaveLength(2);
 const eventId=latest.data.history[0].id;
 await expect(db.prepare('DELETE FROM club_license_events WHERE id=?').bind(eventId).run()).rejects.toThrow();
 await db.prepare("DELETE FROM account_permissions WHERE account_id=? AND permission='admin.world.write'").bind(accountId).run();
 expect((await call('GET')).status).toBe(200);
 expect((await call('POST','',command)).status).toBe(403);
});
