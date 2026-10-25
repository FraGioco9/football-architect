import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
import {createVerifiedHistoryProvider} from '../assets/verified-history-provider.mjs';
import {planPublicFiles} from '../tools/publication-guard.mjs';
const require=createRequire(import.meta.url);
const model=require('../assets/competition-model.js');
const definition=loadCompetitionCatalogue().find(item=>item.id==='IT-1');
const getCompetition=id=>id==='IT-1'?definition:null;
const request=(extra={})=>({competitionId:'IT-1',selectedSeason:2,scope:'history',requestId:'history-a',contextRevision:1,...extra});
const record=()=>({source:'canonical',competitionId:'IT-1',coverage:'complete',provenance:{approved:true},
 seasons:[{seasonId:1,status:'completed',rulesVersion:definition.rules.version,rulesSnapshot:structuredClone(definition.rules)}]});
const adapter=(extra={})=>createVerifiedHistoryProvider({getCompetition,loadHistory:async()=>record(),
 resolveSeasonRules:model.resolveSeasonRules,validateHistory:p=>p.seasons.every(s=>s.status==='completed'),
 sourceRef:'trusted-archive',approved:true,...extra});
test('A04-09: trusted historical source retains canonical rules and provenance',async()=>{
 const result=await adapter().read(request());
 assert.equal(result.status,'available');assert.equal(result.reason,null);
 assert.deepEqual(result.provenance,{kind:'verified',sourceRef:'trusted-archive',approved:true,coverage:'complete'});
 assert.equal(result.data.seasons[0].rulesSnapshot.phases[0].points.win,3);
 assert.ok(Object.isFrozen(result.data.seasons[0]));
});
test('A04-09: absent and unconfigured sources cannot create historical results',async()=>{
 let calls=0;
 const unconfigured=adapter({approved:false,loadHistory:async()=>{calls++;return record()}});
 assert.equal((await unconfigured.read(request())).reason,'source-unavailable');assert.equal(calls,0);
 const absent=adapter({loadHistory:async()=>null});
 assert.equal((await absent.read(request())).status,'empty');
 const unsupported=await adapter().read(request({scope:'season'}));
 assert.equal(unsupported.reason,'unsupported');assert.equal(unsupported.data,null);
});
test('A04-09: partial, unapproved, duplicate and impossible archives fail closed',async()=>{
 const invalid=[
  p=>{p.coverage='partial'},
  p=>{p.provenance.approved=false},
  p=>{p.seasons.push(structuredClone(p.seasons[0]))},
  p=>{p.seasons[0].seasonId=3},
  p=>{p.seasons[0].rulesSnapshot.phases[0].points.win=-1},
  p=>{p.seasons=[]}
 ];
 for(const mutate of invalid){
  const payload=record();mutate(payload);
  const result=await adapter({loadHistory:async()=>payload}).read(request());
  assert.equal(result.status,'unavailable');assert.equal(result.reason,'invalid-data');
  assert.equal(result.data,null);
 }
});
test('A04-09: declared source errors are unavailable; unexpected faults propagate',async()=>{
 const {ProviderSourceError}=await import('../assets/provider-contract.mjs');
 const unavailable=await adapter({loadHistory:async()=>{throw new ProviderSourceError('offline')}}).read(request());
 assert.equal(unavailable.reason,'source-unavailable');
 const bug=Error('validator bug');
 await assert.rejects(adapter({validateHistory:()=>{throw bug}}).read(request()),error=>error===bug);
});
test('A04-09: provider stays outside public staging and current browser consumers',()=>{
 assert.equal(planPublicFiles().includes('assets/verified-history-provider.mjs'),false);
});
