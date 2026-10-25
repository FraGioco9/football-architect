import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
const require=createRequire(import.meta.url);
const api=await import('../assets/provider-contract.mjs');
const catalogue=loadCompetitionCatalogue();
const lookup=id=>catalogue.find(d=>d.id===id)||null;
const request=()=>({competitionId:'IT-1',selectedSeason:1,scope:'season',requestId:'a',contextRevision:1});
const empty=()=>({...request(),schemaVersion:1,providerId:'static',status:'empty',data:null,provenance:{kind:'none',sourceRef:null,approved:false,coverage:'none'},reason:'no-results'});
const options={providerId:'static'};
test('request contract rejects noncanonical identities and invalid season/revision before reading',()=>{
 assert.equal(typeof api.validateRequest,'function');
 const input=request(),out=api.validateRequest(input,lookup);assert.deepEqual(out,input);assert.ok(Object.isFrozen(out));assert.equal(Object.isFrozen(input),false);
 for(const change of [{competitionId:'it-1'},{competitionId:'IT-99'},{selectedSeason:0},{selectedSeason:'1'},{contextRevision:0},{scope:'awards'},{requestId:''}])assert.throws(()=>api.validateRequest({...input,...change},lookup),TypeError);
 for(const d of catalogue)assert.equal(api.validateRequest({...input,competitionId:d.id},lookup).competitionId,d.id);
});
test('empty/error envelope is coherent and cannot impersonate another request or provider',()=>{
 assert.equal(typeof api.validateResponse,'function');
 assert.deepEqual(api.validateResponse(empty(),request(),options),empty());
 for(const change of [{schemaVersion:2},{providerId:'dev-fictional'},{requestId:'b'},{contextRevision:2},{selectedSeason:2},{reason:null},{data:{}},{status:'loading'},{provenance:null}])assert.equal(api.validateResponse({...empty(),...change},request(),options),null);
 assert.ok(api.validateResponse({...empty(),status:'unavailable',reason:'source-unavailable'},request(),options));
});
function supplied(){return {...empty(),providerId:'dev-fictional',status:'partial',reason:null,data:{season:1,status:'partial',statistics:null,results:[]},provenance:{kind:'fictional',sourceRef:'dev-fixtures',approved:false,coverage:'partial'}};}
test('domain validation fails closed and calls real historical-rule validation without repairing snapshots',()=>{
 const model=require('../assets/competition-model.js'),definition=lookup('IT-1');
 const data={...supplied().data,rulesVersion:definition.rules.version,rulesSnapshot:structuredClone(definition.rules)};
 const response={...supplied(),data};
 const config={providerId:'dev-fictional',validateData:value=>Boolean(model.resolveSeasonRules(definition,value))};
 assert.ok(api.validateResponse(response,request(),config));
 assert.equal(api.validateResponse(response,request(),{providerId:'dev-fictional'}),null);
 response.data.rulesSnapshot.phases[0].points.win=-1;
 assert.equal(api.validateResponse(response,request(),config),null);
});
test('fictional data never becomes verified through flags and verified data requires trusted source binding',()=>{
 const r=supplied(),config={providerId:'dev-fictional',validateData:()=>true};
 assert.ok(api.validateResponse(r,request(),config));
 assert.equal(api.validateResponse({...r,provenance:{...r.provenance,approved:true}},request(),config),null);
 const verified={...r,providerId:'verified-historical',provenance:{kind:'verified',approved:true,sourceRef:'approved-archive',coverage:'complete'}};
 assert.equal(api.validateResponse(verified,request(),{providerId:'verified-historical',validateData:()=>true}),null);
 assert.ok(api.validateResponse(verified,request(),{providerId:'verified-historical',sourceRef:'approved-archive',approved:true,validateData:()=>true}));
 assert.equal(api.validateResponse({...verified,scope:'history',provenance:{...verified.provenance,coverage:'partial'}},{...request(),scope:'history'},{providerId:'verified-historical',sourceRef:'approved-archive',approved:true,validateData:()=>true}),null);
});
test('accepted snapshots are detached; missing stays null and valid zero/negative domain metrics survive',()=>{
 const r=supplied();r.data.statistics={matchesPlayed:0,goalDifference:-2,goalsPerMatch:0};
 const out=api.validateResponse(r,request(),{providerId:'dev-fictional',validateData:()=>true});
 assert.deepEqual(out.data,r.data);assert.ok(Object.isFrozen(out.data.statistics));assert.equal(Object.isFrozen(r.data),false);
 r.data.statistics.matchesPlayed=10;assert.equal(out.data.statistics.matchesPlayed,0);
});
test('leases reject stale successes/errors, ABA progress and dead owners without cancelling independent producers',()=>{
 assert.equal(typeof api.captureLease,'function');assert.equal(typeof api.isCurrentLease,'function');
 const state={...request(),providerId:'dev-fictional',owner:'document-1',slot:'fixtures',generation:1,enabled:true,progressGeneration:1,debugSeason:1,matchdays:15};
 const lease=api.captureLease(state);assert.equal(api.isCurrentLease(lease,state),true);
 for(const change of [{owner:'document-2'},{requestId:'b'},{contextRevision:2},{selectedSeason:2},{enabled:false},{progressGeneration:3},{debugSeason:0},{matchdays:16},{disposed:true}])assert.equal(api.isCurrentLease(lease,{...state,...change}),false);
 const stats={...state,slot:'stats',requestId:'stats-1'};const statsLease=api.captureLease(stats);
 assert.equal(api.isCurrentLease(lease,state),true);assert.equal(api.isCurrentLease(statsLease,stats),true);
 assert.equal(api.isCurrentLease(statsLease,{...stats,contextRevision:2}),false);
});
test('malformed leases never authorize publication',()=>{
 assert.equal(api.isCurrentLease({},{}),false);
 assert.equal(api.isCurrentLease(null,{}),false);
});
test('pure contract stays outside public staging and protected dependencies',async()=>{
 const {planPublicFiles}=await import('../tools/publication-guard.mjs');
 assert.equal(planPublicFiles().includes('assets/provider-contract.mjs'),false);
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../assets/provider-contract.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\b(?:import|require|fetch|document|sessionStorage|localStorage)\s*[.(]/);
});
