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
  {id:1,name:'First1 Last1',clubKey:null,secondary_positions:[]},
  {id:2,name:'First2 Last2',clubKey:null,secondary_positions:[]},
  {id:3,name:'First3 Last3',clubKey:null,secondary_positions:[]}
 ]);
 expect(res.data.clubs).toHaveLength(320);
 expect(res.data.clubs).toContainEqual({clubKey:'IT-40',name:expect.any(String)});
 expect(JSON.stringify(res.data)).not.toMatch(/development_aptitude|initial_age|batch_id|seed|csrfToken/);
 expect(res.headers.get('cache-control')).toContain('private');
 expect((await call('GET','?playerId=2')).data.players).toEqual([{id:2,name:'First2 Last2',clubKey:null,secondary_positions:[]}]);
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
 await db.prepare('UPDATE world_state SET generation=? WHERE id=1').bind(crypto.randomUUID()).run();
 expect((await call('POST','',command(1,'BR-40','IT-1'))).status).toBe(409);
 expect((await db.prepare('SELECT club_key FROM player_club_affiliations WHERE player_id=1').first<{club_key:string}>())?.club_key).toBe('IT-1');
});


it('projects Players directory fields without exposing private generation attributes',async()=>{
 await db.prepare('UPDATE generated_players SET payload_json=? WHERE id=?')
  .bind(JSON.stringify({id:1,first_name:'Demo',last_name:'Footballer',nationality:'ITA',
   age:21,height_cm:182,preferred_foot:'left',primary_position:'CM',secondary_positions:['DM','AM'],
   development_aptitude:100,initial_age:18}),1).run();
 const res=await call('GET','?page=1');
 expect(res.status).toBe(200);
 expect(res.data.players[0]).toMatchObject({id:1,name:'Demo Footballer',nationality:'ITA',
  age:21,height_cm:182,preferred_foot:'left',primary_position:'CM',
  secondary_positions:['DM','AM'],clubKey:null});
 expect(JSON.stringify(res.data)).not.toMatch(/development_aptitude|initial_age|payload_json/);
});
it('atomically assigns and unassigns several selected players with one guarded batch',async()=>{
 const before=(await db.prepare('SELECT * FROM generated_players ORDER BY id').all()).results;
 const input=(players:any[],clubKey:string|null)=>({players,clubKey,expectedGeneration:generation,expectedRevision:revision});
 const p1={playerId:1,expectedClubKey:null},p2={playerId:2,expectedClubKey:null};
 let res=await call('POST','',input([p1,p2],'IT-1'));
 expect(res.status).toBe(200);expect(res.data.updated).toBe(2);
 expect((await db.prepare('SELECT player_id,club_key FROM player_club_affiliations ORDER BY player_id').all()).results)
  .toEqual([{player_id:1,club_key:'IT-1'},{player_id:2,club_key:'IT-1'}]);
 res=await call('POST','',input([{playerId:1,expectedClubKey:'IT-1'},{playerId:2,expectedClubKey:'IT-1'}],null));
 expect(res.status).toBe(200);expect(res.data.updated).toBe(2);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM player_club_affiliations').first<{n:number}>())?.n).toBe(0);
 expect((await db.prepare('SELECT * FROM generated_players ORDER BY id').all()).results).toEqual(before);
});
it('rejects unsafe, stale and unauthorized batches without partial assignments',async()=>{
 const body=(players:any[],clubKey:unknown='ENG-1')=>({players,clubKey,expectedGeneration:generation,expectedRevision:revision});
 const current=[{playerId:1,expectedClubKey:null},{playerId:2,expectedClubKey:null}];
 for(const broken of [body([]),body(Array(51).fill({playerId:1,expectedClubKey:null})),
  body([current[0],current[0]]),body([{playerId:1,expectedClubKey:'ENG-1'},current[1]]),
  body([current[0],{playerId:99,expectedClubKey:null}]),
  body(current,'UNKNOWN'),body(current,'it-1'),{...body(current),extra:'forged'},
  {...body(current),expectedRevision:revision+1}]){
  const res=await call('POST','',broken);
  expect([404,409,422]).toContain(res.status);
 }
 expect((await call('POST','',body(current),'invalid-csrf')).status).toBe(403);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM player_club_affiliations').first<{n:number}>())?.n).toBe(0);
 // Simulate a second operator changing one affiliation since this list was read.
 await db.prepare('INSERT INTO player_club_affiliations(player_id,club_key) VALUES(?,?)').bind(2,'BR-40').run();
 expect((await call('POST','',body(current))).status).toBe(409);
 expect((await db.prepare('SELECT player_id,club_key FROM player_club_affiliations').all()).results)
  .toEqual([{player_id:2,club_key:'BR-40'}]);
});
