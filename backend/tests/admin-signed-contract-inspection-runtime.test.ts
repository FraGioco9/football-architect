import {beforeAll,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {clearTestWorld} from './fixtures/test-world.ts';
import {seedUnifiedAdminHttp} from './fixtures/unified-admin-http.ts';
import {handleAdmin} from '../src/http-admin.ts';
import {readWorld} from '../src/world-repository.ts';
import {seedSignedTestTerm} from './fixtures/signed-contracts.ts';
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
// Separate disposable Worker/D1 file: immutable contract records must not be reset between tests.
beforeAll(async()=>{
 await applyD1Migrations(db,bindings.TEST_MIGRATIONS);
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
   display_name:'First'+id+' Last'+id,career_status:'active',initial_age:18,development_aptitude:70};
  await db.prepare(`INSERT INTO generated_players
   (id,batch_id,world_generation,entry_season,payload_json,created_at)
   VALUES(?,?,?,?,?,?)`).bind(id,draftId,generation,0,JSON.stringify(payload),now-10).run();
 }
});
it('returns protected, paginated signed-term inspection and canonical club labels',async()=>{
 // All immutable fixture terms are scoped to this isolated test.
 await seedSignedTestTerm(db,generation,1,'IT-1',0,now,'admin-contract-fixture');
 const res=await call('GET','?page=1');
 expect(res.status).toBe(200);
 expect(res.data).toMatchObject({count:3,page:1,pageSize:50,totalPages:1,worldGeneration:generation,worldRevision:revision});
 expect(res.data.players).toEqual([
  {id:1,canPrepareContract:false,name:'First1 Last1',clubKey:'IT-1',secondary_positions:[],contract:{id:expect.any(Number),annualSalaryArc:125,durationSeasons:1,startTick:0,endTick:56,signedAt:new Date(now*1000).toISOString()}},
  {id:2,canPrepareContract:true,name:'First2 Last2',clubKey:null,secondary_positions:[],contract:null},
  {id:3,canPrepareContract:true,name:'First3 Last3',clubKey:null,secondary_positions:[],contract:null}
 ]);
 expect(res.data.clubs).toHaveLength(320);
 expect(JSON.stringify(res.data)).not.toMatch(/development_aptitude|initial_age|batch_id|seed|csrfToken|signing_key|signed_mandate_id/);
 expect(res.headers.get('cache-control')).toContain('private');
 expect((await call('GET','?playerId=2')).data.players[0].contract).toBeNull();
 expect((await call('GET','?playerId=99')).status).toBe(404);
});
