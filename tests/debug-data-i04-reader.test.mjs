import test from "node:test";
import assert from "node:assert/strict";
import {createProtectedDebugSeasonReader} from "../tools/debug-data-i04-reader.mjs";

const divisions=[],cupCatalog=[];
const sample=()=>createProtectedDebugSeasonReader({loadCorpus:async()=>({datasetId:"bad",status:"UNSEALED_NOT_FOR_RUNTIME"}),divisions,cupCatalog});
test("I04 rejects invalid source, season, day and competition before loading",async()=>{
 const r=sample();
 await assert.rejects(r.read({seasonNumber:1,worldDay:1,competitionId:"IT-1"}),/source not activated/);
 assert.throws(()=>r.activate({datasetId:"../bad"}),/invalid dataset/);
 r.activate({datasetId:"debug-corpus-v1"});
 for(const options of [{seasonNumber:0,worldDay:1,competitionId:"IT-1"},
 {seasonNumber:1,worldDay:0,competitionId:"IT-1"},
 {seasonNumber:1,worldDay:57,competitionId:"IT-1"},
 {seasonNumber:1,worldDay:1,competitionId:"foreign"}]){
  await assert.rejects(r.read(options),/invalid/);
 }
 await assert.rejects(r.read({seasonNumber:1,worldDay:1,competitionId:"IT-1"}),/dataset identity mismatch/);
});
test("I04 invalidates in-flight source reads when source changes or Debug OFF",async()=>{
 let release;
 const pending=new Promise(resolve=>{release=resolve});
 const r=createProtectedDebugSeasonReader({
  loadCorpus:async()=>pending,divisions,cupCatalog
 });
 const oldEpoch=r.activate({datasetId:"debug-corpus-v1"});
 const old=r.read({seasonNumber:1,worldDay:1,competitionId:"IT-1"});
 r.close();
 assert.equal(r.isCurrent(oldEpoch,"debug-corpus-v1"),false);
 release({datasetId:"debug-corpus-v1",status:"UNSEALED_NOT_FOR_RUNTIME"});
 // Old request is discarded regardless of whether validation succeeds;
 // a separate full-corpus integration test covers successful plan validation.
 assert.deepEqual(await old,{status:"stale",epoch:oldEpoch});
 assert.equal(r.getEpoch(),oldEpoch+1);
});

test("I04 old pending dataset cannot contaminate newly activated dataset",async()=>{
 const releases=new Map();
 const r=createProtectedDebugSeasonReader({
  loadCorpus:id=>new Promise(resolve=>releases.set(id,resolve)),divisions,cupCatalog
 });
 const firstEpoch=r.activate({datasetId:"debug-old"});
 const first=r.read({seasonNumber:1,worldDay:12,competitionId:"IT-1"});
 await Promise.resolve();
 const secondEpoch=r.activate({datasetId:"debug-new"});
 const second=r.read({seasonNumber:1,worldDay:13,competitionId:"IT-1"});
 await Promise.resolve();
 releases.get("debug-old")({datasetId:"debug-old",status:"UNSEALED_NOT_FOR_RUNTIME"});
 assert.deepEqual(await first,{status:"stale",epoch:firstEpoch});
 assert.equal(r.isCurrent(secondEpoch,"debug-new"),true);
 releases.get("debug-new")({datasetId:"wrong",status:"UNSEALED_NOT_FOR_RUNTIME"});
 await assert.rejects(second,/dataset identity mismatch/);
});


test("I04 rejects history boundaries before corpus access",async()=>{
 const r=sample();
 r.activate({datasetId:"debug-corpus-v1"});
 for(const beforeSeasonNumber of [0,7,1.5,null,"3"]){
  await assert.rejects(r.history({beforeSeasonNumber}),/invalid history boundary/);
 }
 await assert.rejects(r.history({beforeSeasonNumber:2}),/dataset identity mismatch/);
});

test("I04 retries a failed source load without using a rejected cached promise",async()=>{
 let calls=0;
 const r=createProtectedDebugSeasonReader({
  loadCorpus:async id=>{
   calls++;
   if(calls===1)throw new Error("transient local read error");
   return {datasetId:"wrong",status:"UNSEALED_NOT_FOR_RUNTIME"};
  },divisions,cupCatalog
 });
 r.activate({datasetId:"debug-corpus-v1"});
 const request={seasonNumber:1,worldDay:1,competitionId:"IT-1"};
 await assert.rejects(r.read(request),/transient local read error/);
 await assert.rejects(r.read(request),/dataset identity mismatch/);
 assert.equal(calls,2);
});

test("I04 explicitly invalidates a pending history read after Debug OFF",async()=>{
 let resolve;
 const pending=new Promise(r=>{resolve=r});
 const reader=createProtectedDebugSeasonReader({loadCorpus:()=>pending,divisions,cupCatalog});
 const epoch=reader.activate({datasetId:"debug-corpus-v1"});
 const history=reader.history({beforeSeasonNumber:6});
 await Promise.resolve();
 reader.close();
 resolve({datasetId:"debug-corpus-v1",status:"UNSEALED_NOT_FOR_RUNTIME"});
 assert.deepEqual(await history,{status:"stale",epoch});
});
