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
