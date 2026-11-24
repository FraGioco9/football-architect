import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {clearTestWorld} from './fixtures/test-world.ts';
import {seedUnifiedAdminHttp} from './fixtures/unified-admin-http.ts';
import {handleAdmin} from '../src/http-admin.ts';
import {readWorld} from '../src/world-repository.ts';
import {parseContractListQuery,signInitialAiContract} from '../src/player-club-contracts.ts';
import {ATTRIBUTES} from '../src/players-generator-core.mjs';
import {economicAssert,postEconomicOperation,provisionClubAccounts} from '../src/economic-ledger.ts';
import {abortUnless} from '../src/command-guards.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
import {rawDestinationSalaryReferenceArc} from '../src/player-market-value.mjs';
import {salaryBounds} from '../src/player-contract-policy.ts';
import type {Database} from '../src/database.ts';

const bindings=env as any,db=bindings.DB as Database;
const origin='http://app.localhost:2000',now=Math.floor(Date.now()/1000);
const actor='contract-test-operator',email='contracts@example.invalid',token='9'.repeat(64);
const draftId='00000000-0000-4000-8000-000000000029';
let csrf='',accountId='',generation='',revision=0;
const service={DB:db,PLAYER_MODE:'local',PLAYER_ORIGIN:origin};
async function call(method:'GET'|'POST'|'PUT',path:string,payload?:unknown,csrfOverride?:string,key?:string){
 const response=await handleAdmin(new Request(origin+'/api/admin/contracts'+path,{
  method,headers:{Cookie:'fa_player_local='+token,Origin:origin,
   ...(method==='POST'?{'Content-Type':'application/json','X-CSRF-Token':csrfOverride??csrf,...(key?{'Idempotency-Key':key}:{})}:{})},
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
 expect(quote.data.blockers).toContain('salary_reference_unavailable');
 expect((await call('POST','/sign',{...request,quoteHash:'0'.repeat(64)},undefined,'missing-policy-sign-test')).data.error.code).toBe('salary_reference_unavailable');
 expect(quote.data).toMatchObject({playerId:2,clubKey:club,durationSeasons:2,startTick:0,endTick:112,representation:'ai',minimumArc:40,annualSalaryArc:null,signable:false});
 expect((await call('POST','/preview',request,'bad')).status).toBe(403);
 expect((await call('POST','/preview',{...request,annualSalaryArc:1})).status).toBe(422);
 expect((await call('POST','/preview',{...request,expectedRevision:revision+1})).status).toBe(409);
 await db.prepare("DELETE FROM account_permissions WHERE account_id=? AND permission='admin.world.write'").bind(accountId).run();
 expect((await call('POST','/preview',request)).status).toBe(403);
 expect((await db.prepare('SELECT COUNT(*) n FROM player_signed_contracts').first<{n:number}>())?.n).toBe(0);
});

it('signs an initial AI term atomically with certified synthetic forecast and actual ledger cash; gated HTTP activation',async()=>{
 const {loadApprovedSnapshot}=await import('../src/approved-season-one.ts');
 const club=(await loadApprovedSnapshot()).bindings.find(b=>b.competitionId.endsWith('-1')&&!b.competitionId.startsWith('int-'))!.clubIds[0];
 const request={playerId:2,clubKey:club,durationSeasons:2,expectedGeneration:generation,expectedRevision:revision};
 const digest=await digestOpaqueToken(token),csrfDigest=await digestOpaqueToken(csrf);
 const session={actor:{id:actor,email},digest,credentialVersion:1,csrfDigest,unified:{playerId:accountId,sessionDigest:digest,csrfDigest}};
 const payload={id:2,first_name:'First2',last_name:'Last2',display_name:'First2 Last2',career_status:'active',initial_age:18,age:18,primary_position:'CM',secondary_positions:[],attributes:Object.fromEntries(ATTRIBUTES.map(k=>[k,60]))};
 await db.prepare('UPDATE generated_players SET payload_json=? WHERE id=2').bind(JSON.stringify(payload)).run();
 const authority=async()=>({expectedAnnualRewardsArc:10000,sourceVersion:'synthetic-opening-test',guards:[abortUnless(db,'SELECT 1',[])]});
 const key='initial-signing-test-001';
 await expect(signInitialAiContract(db,session,request,key,now,authority)).rejects.toMatchObject({code:'payroll_affordability_unavailable'});
 const access=[economicAssert(db,'SELECT 1')];
 await provisionClubAccounts(db,now,access);
 const version='synthetic-signing-test';
 const snapshot=await loadApprovedSnapshot();
 const expectedRewardsByClub=Object.fromEntries(snapshot.bindings.filter(b=>!b.competitionId.startsWith('int-')).flatMap(b=>b.clubIds.map(k=>[k,10000])));
 const rules=JSON.stringify({openingContracts:{schema:'opening-contract-forecast-v1',worldGeneration:generation,participantsHash:snapshot.participantsHash,rulesHash:snapshot.rulesHash,formulaVersion:'remaining-agent-salary-draft-v5-769',expectedRewardsByClub}});
 await db.prepare('INSERT INTO economic_policy_versions VALUES(?,?,?,?,?,?,?)').bind(version,now,'fixture',10000,10000,JSON.stringify({[club]:2000}),rules).run();
 await db.prepare('INSERT INTO economic_control VALUES(1,?,1)').bind(version).run();
 const post=(purpose:'GENESIS_RESERVE'|'CLUB_OPENING',sourceId:string,from:string,to:string,amount:number)=>postEconomicOperation(db,{businessKey:'sign-test-'+purpose,requestKey:'sign-test-'+purpose,purpose,actorKind:'system',actorId:'fixture',configVersion:version,sourceId,lines:[{accountId:from,amountArc:-amount},{accountId:to,amountArc:amount}]},{access},now);
 await post('GENESIS_RESERVE','platform','issuance','reserve',10000);
 await post('CLUB_OPENING',club,'reserve','club:'+club,2000);
 await expect(signInitialAiContract(db,session,request,key,now,async()=>({...await authority(),expectedAnnualRewardsArc:0}))).rejects.toMatchObject({code:'salary_reference_unavailable'});
 await expect(signInitialAiContract(db,session,request,key,now,async()=>({...await authority(),guards:[]}))).rejects.toMatchObject({code:'salary_reference_unavailable'});
 await expect(signInitialAiContract(db,session,request,key,now,async()=>({...await authority(),expectedAnnualRewardsArc:10000000000}))).rejects.toMatchObject({code:'contract_insufficient_cash_proof'});
 const noConsent={...request,playerId:3};
 await db.prepare('INSERT INTO player_agent_mandates(player_id,world_generation,account_id,start_tick,acquired_at_ms,acquisition_key) VALUES(?,?,?,0,?,?)').bind(3,generation,accountId,now*1000,'synthetic-mandate-3').run();
 await expect(signInitialAiContract(db,session,noConsent,'initial-signing-test-003',now,authority)).rejects.toMatchObject({code:'contract_player_ineligible'});

 await expect(signInitialAiContract(db,session,request,key,now,async()=>({...await authority(),guards:[abortUnless(db,'SELECT 1 WHERE 0',[])]}))).rejects.toMatchObject({code:'contract_signing_preconditions_changed'});
 expect((await db.prepare('SELECT COUNT(*) n FROM player_signed_contracts').first<{n:number}>())?.n).toBe(0);
 const preview=await call('POST','/preview',request);
 expect(preview.status).toBe(200);expect(preview.data).toMatchObject({signable:true,annualSalaryArc:salaryBounds(1,rawDestinationSalaryReferenceArc(payload,10000)!).aiDemand});
 const signedRequest={...request,quoteHash:preview.data.quoteHash};
 expect((await call('POST','/sign',{...signedRequest,quoteHash:'0'.repeat(64)},undefined,key)).data.error.code).toBe('contract_quote_changed');
 expect((await call('POST','/sign',signedRequest,'bad',key)).status).toBe(403);
 expect((await call('POST','/sign',{...signedRequest,annualSalaryArc:1},undefined,key)).status).toBe(422);
 const signed=await call('POST','/sign',signedRequest,undefined,key);expect(signed.status).toBe(200);
 const result=signed.data;
 expect(result.world.revision).toBe(revision+1);
 const audit=await db.prepare('SELECT outcome_json FROM admin_operations WHERE id=?').bind(result.operationId).first<{outcome_json:string}>();
 expect(JSON.parse(audit!.outcome_json).contract).toMatchObject({salaryFormulaVersion:'remaining-agent-salary-draft-v5-769',forecastVersion:expect.stringMatching(/^opening-forecast:[a-f0-9]{64}$/),expectedAnnualRewardsArc:10000,financeVersion:version,availableArc:2000});
 expect((await call('POST','/sign',signedRequest,undefined,key)).data).toEqual(result);
 expect((await db.prepare('SELECT annual_salary_arc,reference_arc,duration_seasons,start_tick,scheduled_end_tick FROM player_signed_contracts WHERE player_id=2').first())).toMatchObject({annual_salary_arc:salaryBounds(1,rawDestinationSalaryReferenceArc(payload,10000)!).aiDemand,duration_seasons:2,start_tick:0,scheduled_end_tick:112});
 expect((await db.prepare('SELECT COUNT(*) n FROM economic_transactions').first<{n:number}>())?.n).toBe(2);
 expect((await call('GET','?playerId=2')).data.players[0].clubKey).toBe(club);
 expect((await call('POST','/sign',{...signedRequest,durationSeasons:1},undefined,key)).data.error.code).toBe('idempotency_conflict');
});
