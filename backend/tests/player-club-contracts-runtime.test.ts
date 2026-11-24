import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {clearTestWorld} from './fixtures/test-world.ts';
import {seedUnifiedAdminHttp} from './fixtures/unified-admin-http.ts';
import {handleAdmin} from '../src/http-admin.ts';
import {readWorld} from '../src/world-repository.ts';
import {seedSignedTestTerm} from './fixtures/signed-contracts.ts';
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
  {id:1,name:'First1 Last1',clubKey:'IT-1',secondary_positions:[],contract:{id:expect.any(Number),annualSalaryArc:125,durationSeasons:1,startTick:0,endTick:56,signedAt:new Date(now*1000).toISOString()}},
  {id:2,name:'First2 Last2',clubKey:null,secondary_positions:[],contract:null},
  {id:3,name:'First3 Last3',clubKey:null,secondary_positions:[],contract:null}
 ]);
 expect(res.data.clubs).toHaveLength(320);
 expect(JSON.stringify(res.data)).not.toMatch(/development_aptitude|initial_age|batch_id|seed|csrfToken|signing_key|signed_mandate_id/);
 expect(res.headers.get('cache-control')).toContain('private');
 expect((await call('GET','?playerId=2')).data.players[0].contract).toBeNull();
 expect((await call('GET','?playerId=99')).status).toBe(404);
});
it('rejects legacy single and batch assignment, regardless of write grants',async()=>{
 const before=(await db.prepare('SELECT * FROM generated_players ORDER BY id').all()).results;
 for(const payload of [command(1,'IT-1',null),{players:[{playerId:1,expectedClubKey:null}],clubKey:'IT-1',expectedGeneration:generation,expectedRevision:revision},command(1,null,'IT-1')]){
  const res=await call('POST','',payload);
  expect(res.status).toBe(405);
  expect(res.headers.get('allow')).toBe('GET');
 }
 expect((await db.prepare('SELECT COUNT(*) n FROM player_signed_contracts').first<{n:number}>())?.n).toBe(0);
 expect((await db.prepare('SELECT * FROM generated_players ORDER BY id').all()).results).toEqual(before);
});
it('read-only Admin access is authorized and anonymous or revoked access is denied',async()=>{
 await db.prepare("DELETE FROM account_permissions WHERE account_id=? AND permission='admin.world.write'").bind(accountId).run();
 expect((await call('GET','?page=1')).status).toBe(200);
 expect((await call('POST','',command(1,'IT-1',null))).status).toBe(405);
 const anon=await handleAdmin(new Request(origin+'/api/admin/contracts'),service);
 expect(anon.status).toBe(401);
 await db.prepare("DELETE FROM account_permissions WHERE account_id=? AND permission='admin.world.read'").bind(accountId).run();
 expect((await call('GET','?page=1')).status).toBe(403);
});
it('validates HTTP methods and query shape; refuses ambiguous pagination',async()=>{
 for(const q of ['?page=0','?page=-1','?page=1&page=2','?playerId=0','?playerId=2&page=1','?evil=1','?playerId=01'])expect((await call('GET',q)).status).toBe(422);
 expect((await call('PUT','')).status).toBe(405);
 expect((await call('POST','?page=1',command(1,'IT-1',null))).status).toBe(405);
 expect(parseContractListQuery('')).toEqual({page:1,playerId:null});
});
