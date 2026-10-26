import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
import * as contract from '../assets/provider-contract.mjs';

const require=createRequire(import.meta.url);
const model=require('../assets/world-calendar-model.js');
globalThis.faWorldCalendarModel=model;
const clock=require('../assets/world-clock-adapter.js');
const catalogue=loadCompetitionCatalogue();
const lookup=id=>catalogue.find(item=>item.id===id)||null;
const request=(selectedSeason,requestId,contextRevision)=>({competitionId:'IT-1',selectedSeason,scope:'season',requestId,contextRevision});
const envelope=r=>({...r,schemaVersion:1,providerId:'static',status:'empty',data:null,reason:'no-results',provenance:{kind:'none',sourceRef:null,approved:false,coverage:'none'}});
const snapshot=(season,day)=>clock.normalize({source:{kind:'dev',reference:'a06-08'},current:{season,day}});

test('A06-08 viewed season is independent of world season and cannot change the request identity',()=>{
 const world=snapshot(2,31);
 const previous=clock.project(1,world),current=clock.project(2,world);
 assert.equal(previous.days[30].relative,'past');
 assert.equal(current.days[30].relative,'current');
 const a=request(1,'view-1',1),b=request(2,'view-2',2);
 assert.equal(contract.validateRequest(a,lookup).selectedSeason,1);
 assert.equal(contract.validateResponse(envelope(a),b,{providerId:'static'}),null);
 assert.equal(contract.validateResponse(envelope(b),b,{providerId:'static'}).selectedSeason,2);
});

test('A06-08 world-day transition preserves frozen snapshots without manufacturing results',()=>{
 const old=snapshot(1,55),next=snapshot(1,56);
 const before=clock.projectCompetition(1,'IT-1',old);
 const after=clock.projectCompetition(1,'IT-1',next);
 assert.equal(before.days[54].relative,'current');
 assert.equal(after.days[55].relative,'current');
 assert.equal(before.days[54].relative,'current');
 assert.ok(Object.isFrozen(before.days));
 for(const projection of [before,after])
  for(const day of projection.days)for(const event of day.events)for(const item of event.competitions)
   assert.equal(item.status,null);
});

test('A06-08 unavailable or malformed clock snapshots fail closed across season boundaries',()=>{
 assert.equal(clock.project(1,null).days[0].relative,null);
 assert.throws(()=>snapshot(1,57),TypeError);
 assert.throws(()=>clock.normalize({source:{kind:'dev',reference:'a06-08'},current:{season:1,day:56},eventStates:[{status:'completed'}]}),TypeError);
 const later=clock.project(2,snapshot(1,56));
 assert.ok(later.days.every(day=>day.relative==='future'));
});

test('A06-08 late success and source failure cannot overwrite a newer season/revision',async()=>{
 for(const sourceFailure of [false,true]){
  let release;
  const provider=contract.createProvider({id:'static',getCompetition:lookup,load:async r=>{
   if(r.requestId==='old'){
    await new Promise(resolve=>{release=resolve});
    if(sourceFailure)throw new contract.ProviderSourceError('unavailable');
   }
   return envelope(r);
  }});
  const old={...request(1,'old',1),providerId:'static',owner:'competition-page',slot:'fixtures',generation:1};
  let current=old;
  const oldLease=contract.captureLease(old),commits=[];
  const pending=provider.read(old).then(response=>{
   if(contract.isCurrentLease(oldLease,current))commits.push(response.requestId);
   return response;
  });
  current={...request(2,'new',2),providerId:'static',owner:'competition-page',slot:'fixtures',generation:2};
  const newLease=contract.captureLease(current);
  const fresh=await provider.read(current);
  assert.equal(contract.isCurrentLease(newLease,current),true);
  commits.push(fresh.requestId);
  release();
  const late=await pending;
  assert.equal(late.selectedSeason,1);
  assert.equal(late.reason,sourceFailure?'source-unavailable':'no-results');
  assert.deepEqual(commits,['new']);
 }
});
