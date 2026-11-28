import assert from 'node:assert/strict';
import {test} from 'vitest';
import type {Database} from '../src/database.ts';
import {readPublicPlayerContract} from '../src/public-player-contract-read.ts';

const generation='550e8400-e29b-41d4-a716-446655440000';
const active={career_status:'active',contract_id:1,club_key:'IT-1',signed_at_ms:1700000000000,
 start_tick:0,end_tick:168,duration_seasons:3,signed_salary_arc:240,effective_salary_arc:240,
 mandate_id:null,agent_username:null,paid_arc:120};
function fixture(row:Record<string,unknown>|null=active,season=1,day=28,changed=false){
 let reads=0;
 const db={prepare(sql:string){
  const stmt=(args:unknown[])=>({
   bind(...next:unknown[]){return stmt(next)},
   async first(){
    if(sql.startsWith('SELECT schema_version'))return {schema_version:1,generation,revision:changed?reads++:0,season_number:season,day,phase:season===0?'unstarted':'active'};
    if(sql.includes('sqlite_schema'))return null;
    if(sql.includes('FROM generated_players p')){
     assert.deepEqual(args,[Math.max(0,(season-1)*56)+Math.max(day,1)-1,Math.max(0,(season-1)*56)+Math.max(day,1)-1,Math.max(0,(season-1)*56)+Math.max(day,1)-1,42]);
     assert.match(sql,/FROM player_signed_contracts/);
     assert.match(sql,/payroll_claim_outstanding/);
     assert.doesNotMatch(sql,/player_club_affiliations|email_normalized|password_verifier/);
     return row;
    }
    throw Error('Unexpected SQL: '+sql);
   }
  });return stmt([]);
 },async batch(){throw Error('read only')}} as unknown as Database;
 return db;
}
test('public contract returns only effective terms and certified contract-level amounts',async()=>{
 const result=await readPublicPlayerContract(fixture(),42);
 assert.deepEqual(result,{schemaVersion:1,playerId:42,season:1,day:28,status:'under_contract',
 representation:{kind:'ai',username:null},contract:{clubKey:'IT-1',signedAt:new Date(active.signed_at_ms).toISOString(),
 startTick:0,endTick:168,durationSeasons:3,remainingDays:140,signedSalaryArc:240,
 currentSeasonalSalaryArc:240,earnedThisSeasonArc:120,paidThisSeasonArc:120}});
 assert.doesNotMatch(JSON.stringify(result),/arrears|promotionAdjustment|mandate_id|account_id|referenceArc/);
});
test('signed opening term is pending and does not earn salary in season zero',async()=>{
 const result=await readPublicPlayerContract(fixture({...active,paid_arc:0},0,0),42);
 assert.equal(result.status,'signed_pending');
 assert.equal(result.contract?.earnedThisSeasonArc,0);
});
test('confirmed free agent, retired, unavailable, and actual human representation are distinct',async()=>{
 const free=await readPublicPlayerContract(fixture({...active,contract_id:null,mandate_id:5,agent_username:'Agent_42'}),42);
 assert.equal(free.status,'free_agent');assert.equal(free.contract,null);
 assert.deepEqual(free.representation,{kind:'human',username:'Agent_42'});
 assert.equal((await readPublicPlayerContract(fixture({...active,career_status:'retired'}),42)).status,'retired');
 assert.equal((await readPublicPlayerContract(fixture({...active,career_status:'unknown'}),42)).status,'unavailable');
});
test('midseason wage proration and effective salary use canonical cumulative arithmetic',async()=>{
 const result=await readPublicPlayerContract(fixture({...active,start_tick:14,signed_salary_arc:20,effective_salary_arc:40,paid_arc:0}),42);
 assert.equal(result.contract?.earnedThisSeasonArc,10);
 assert.equal(result.contract?.currentSeasonalSalaryArc,40);
});
test('missing, invalid, inconsistent and changed world fail closed',async()=>{
 await assert.rejects(readPublicPlayerContract(fixture(null),42),{status:404,code:'player_not_found'});
 await assert.rejects(readPublicPlayerContract(fixture(),0),{status:422,code:'invalid_public_request'});
 await assert.rejects(readPublicPlayerContract(fixture({...active,paid_arc:121}),42),{status:503,code:'player_contract_unavailable'});
 await assert.rejects(readPublicPlayerContract(fixture(active,1,28,true),42),{status:409,code:'stale_world'});
});
