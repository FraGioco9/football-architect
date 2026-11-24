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
   display_name:'First'+id+' Last'+id,career_status:'active',initial_age:18,development_aptitude:70};
  await db.prepare(`INSERT INTO generated_players
   (id,batch_id,world_generation,entry_season,payload_json,created_at)
   VALUES(?,?,?,?,?,?)`).bind(id,draftId,generation,0,JSON.stringify(payload),now-10).run();
 }
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

it('prepares real dates only for authorized initial free agents and never signs',async()=>{
 const {loadApprovedSnapshot}=await import('../src/approved-season-one.ts');
 const snapshot=await loadApprovedSnapshot();
 const club=snapshot.bindings.find(b=>b.competitionId.endsWith('-1')&&!b.competitionId.startsWith('int-'))!.clubIds[0];
 const request={playerId:2,clubKey:club,durationSeasons:2,expectedGeneration:generation,expectedRevision:revision};
 const quote=await call('POST','/preview',request);
 expect(quote.status).toBe(200);
 expect(quote.data).toMatchObject({playerId:2,clubKey:club,durationSeasons:2,startTick:0,endTick:112,representation:'ai',minimumArc:40,annualSalaryArc:null,signable:false});
 expect((await call('POST','/preview',request,'bad')).status).toBe(403);
 expect((await call('POST','/preview',{...request,annualSalaryArc:1})).status).toBe(422);
 expect((await call('POST','/preview',{...request,expectedRevision:revision+1})).status).toBe(409);
 await db.prepare("DELETE FROM account_permissions WHERE account_id=? AND permission='admin.world.write'").bind(accountId).run();
 expect((await call('POST','/preview',request)).status).toBe(403);
 expect((await db.prepare('SELECT COUNT(*) n FROM player_signed_contracts').first<{n:number}>())?.n).toBe(0);
});
