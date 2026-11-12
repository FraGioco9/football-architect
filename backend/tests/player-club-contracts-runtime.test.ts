import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {clearTestWorld} from './fixtures/test-world.ts';
import {seedUnifiedAdminHttp} from './fixtures/unified-admin-http.ts';
import {handleAdmin} from '../src/http-admin.ts';
import {readWorld} from '../src/world-repository.ts';
import {parseContractListQuery} from '../src/player-club-contracts.ts';
import type {Database} from '../src/database.ts';

const bindings=env as any,db=bindings.DB as Database;
const origin='http://app.localhost:2000',now=Math.floor(Date.now()/1000);
const actor='contract-test-operator',email='contracts@example.invalid',token='9'.repeat(64);
const draftId='00000000-0000-4000-8000-000000000029';
let csrf='',accountId='',generation='',revision=0;
const service={DB:db,PLAYER_MODE:'local',PLAYER_ORIGIN:origin};
async function call(method:'GET'|'POST'|'PUT',path:string,payload?:unknown,csrfOverride?:string){
 const response=await handleAdmin(new Request(origin+'/api/admin/contracts'+path,{
  method,headers:{Cookie:'fa_player_local='+token,Origin:origin,
   ...(method==='POST'?{'Content-Type':'application/json','X-CSRF-Token':csrfOverride??csrf}:{})},
  body:method==='POST'?JSON.stringify(payload):undefined
 }),service);
 return {status:response.status,data:await response.json() as any,headers:response.headers};
}
const command=(playerId:number,clubKey:string|null,expectedClubKey:string|null)=>
 ({playerId,clubKey,expectedClubKey,expectedGeneration:generation,expectedRevision:revision});
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await clearTestWorld(db);
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)')
  .bind(actor,email,'fixture-no-login',now-100).run();
 ({csrf,playerId:accountId}=await seedUnifiedAdminHttp(db,actor,email,now,token));
 const world=await readWorld(db);generation=world.generation;revision=world.revision;
 await db.prepare(`INSERT INTO player_generation_drafts
  (id,world_generation,season_number,account_id,options_json,candidates_json,count,seed,status,created_at,expires_at,committed_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
  .bind(draftId,generation,0,accountId,'{}','[]',3,'contracts-test','committed',now-100,now+100,now-50).run();
 for(const id of [1,2,3]){
  const payload={id,first_name:'First'+id,last_name:'Last'+id,
   display_name:'First'+id+' Last'+id,initial_age:18,development_aptitude:70};
  await db.prepare(`INSERT INTO generated_players
   (id,batch_id,world_generation,entry_season,payload_json,created_at)
   VALUES(?,?,?,?,?,?)`).bind(id,draftId,generation,0,JSON.stringify(payload),now-10).run();
 }
});
it('returns protected, paginated current affiliation records and all canonical clubs, no internal fields',async()=>{
 const res=await call('GET','?page=1');
 expect(res.status).toBe(200);
 expect(res.data).toMatchObject({count:3,page:1,pageSize:50,totalPages:1,
  worldGeneration:generation,worldRevision:revision});
 expect(res.data.players).toEqual([
  {id:1,name:'First1 Last1',clubKey:null},
  {id:2,name:'First2 Last2',clubKey:null},
  {id:3,name:'First3 Last3',clubKey:null}
 ]);
 expect(res.data.clubs).toHaveLength(320);
 expect(res.data.clubs).toContainEqual({clubKey:'IT-40',name:expect.any(String)});
 expect(JSON.stringify(res.data)).not.toMatch(/development_aptitude|initial_age|batch_id|seed|csrfToken/);
 expect(res.headers.get('cache-control')).toContain('private');
 expect((await call('GET','?playerId=2')).data.players).toEqual([{id:2,name:'First2 Last2',clubKey:null}]);
 expect((await call('GET','?playerId=99')).status).toBe(404);
});
it('supports assign, same-club idempotency, guarded reassign and explicit unassign without changing player rows',async()=>{
 const before=(await db.prepare('SELECT * FROM generated_players ORDER BY id').all()).results;
 expect((await call('POST','',command(1,'IT-1',null))).status).toBe(200);
 expect((await call('POST','',command(2,'IT-1',null))).status).toBe(200);
 expect((await call('GET','?playerId=1')).data.players[0].clubKey).toBe('IT-1');
 expect((await call('POST','',command(1,'IT-1','IT-1'))).status).toBe(200);
 expect((await call('POST','',command(1,'IT-40','IT-1'))).status).toBe(200);
 expect((await call('POST','',command(2,null,'IT-1'))).status).toBe(200);
 const links=(await db.prepare('SELECT player_id,club_key FROM player_club_affiliations').all()).results;
 expect(links).toEqual([{player_id:1,club_key:'IT-40'}]);
 expect((await db.prepare('SELECT * FROM generated_players ORDER BY id').all()).results).toEqual(before);
 expect((await call('GET','?page=1')).data.count).toBe(3);
});
it('rejects invalid ID, ineligible clubs, unknown players, stale world or stale membership with no partial writes',async()=>{
 for(const value of [-1,0,1.5,'1',9999999999999999999]){
  expect((await call('POST','',{...command(1,'IT-1',null),playerId:value})).status).toBe(422);
 }
 for(const clubKey of ['XX-1','IT-41','it-1','IT-01','',1]){
  expect((await call('POST','',{...command(1,null,null),clubKey})).status).toBe(422);
 }
 expect((await call('POST','',command(100,'IT-1',null))).status).toBe(404);
 expect((await call('POST','',{...command(1,'IT-1',null),expectedRevision:revision+1})).status).toBe(409);
 expect((await call('POST','',command(1,'IT-1','DE-1'))).status).toBe(409);
 expect((await call('POST','',{...command(1,'IT-1',null),extra:'forged'})).status).toBe(422);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM player_club_affiliations').first<{n:number}>())?.n).toBe(0);
});
it('rejects unauthorized writes, stale CSRF and missing grants, and exposes no unauthenticated Admin data',async()=>{
 expect((await call('POST','',command(1,'IT-1',null),'bad')).status).toBe(403);
 await db.prepare("DELETE FROM account_permissions WHERE account_id=? AND permission='admin.world.write'").bind(accountId).run();
 expect((await call('POST','',command(1,'IT-1',null))).status).toBe(403);
 expect((await call('GET','?page=1')).status).toBe(200);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM player_club_affiliations').first<{n:number}>())?.n).toBe(0);
 const anon=await handleAdmin(new Request(origin+'/api/admin/contracts'),service);
 expect(anon.status).toBe(401);
});
it('validates HTTP methods and query shape; refuses ambiguous or hidden pagination',async()=>{
 for(const q of ['?page=0','?page=-1','?page=1&page=2','?playerId=0','?playerId=2&page=1','?evil=1','?playerId=01']){
  expect((await call('GET',q)).status).toBe(422);
 }
 expect((await call('PUT','')).status).toBe(405);
 expect((await call('POST','?page=1',command(1,'IT-1',null))).status).toBe(422);
 expect(parseContractListQuery('')).toEqual({page:1,playerId:null});
});
it('optimistic link comparison ensures a stale operator cannot overwrite a newer choice',async()=>{
 const first=await call('POST','',command(1,'IT-1',null));
 expect(first.status).toBe(200);
 const raced=await call('POST','',command(1,'BR-40',null));
 expect(raced.status).toBe(409);
 expect((await call('GET','?playerId=1')).data.players[0].clubKey).toBe('IT-1');
 await db.prepare("UPDATE world_state SET revision=revision+1 WHERE id=1").run();
 expect((await call('POST','',command(1,'BR-40','IT-1'))).status).toBe(409);
 expect((await db.prepare('SELECT club_key FROM player_club_affiliations WHERE player_id=1').first<{club_key:string}>())?.club_key).toBe('IT-1');
});
