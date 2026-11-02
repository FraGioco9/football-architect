// I04 narrow, in-memory verification: no remote DB or runtime activation.
import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildFiveSeasonCorpusCandidate} from "../tools/debug-data-five-season-corpus.mjs";
import {createProtectedDebugSeasonReader} from "../tools/debug-data-i04-reader.mjs";
import {DEBUG_COMPETITIONS} from "../tools/debug-data-schema.mjs";
const load=async path=>JSON.parse(await readFile(new URL("../"+path,import.meta.url),"utf8"));
const [baseline,divisions,cupCatalog]=await Promise.all([
 load("backend/catalogues/season-1.participants.json"),
 load("data/divisions.json"),
 load("data/international-competitions.json")
]);
const datasetId="debug-i04-isolated";
const corpus=buildFiveSeasonCorpusCandidate({baseline,divisions,cupCatalog,datasetId,seed:"i04-integration-2026-11-02"});
const reader=()=>createProtectedDebugSeasonReader({loadCorpus:async()=>corpus,divisions,cupCatalog,seed:"i04-integration-2026-11-02"});

test("I04 S1–S5: all 90 protected projections remain time-redacted",async()=>{
 const r=reader();r.activate({datasetId});
 for(let seasonNumber=1;seasonNumber<=5;seasonNumber++){
  for(const competitionId of DEBUG_COMPETITIONS){
   const first=(await r.read({seasonNumber,worldDay:1,competitionId})).projection;
   const midpoint=(await r.read({seasonNumber,worldDay:31,competitionId})).projection;
   const final=(await r.read({seasonNumber,worldDay:56,competitionId})).projection;
   for(const [day,projection] of [[1,first],[31,midpoint],[56,final]]){
    assert.equal(projection.seasonNumber,seasonNumber);
    assert.equal(projection.competitionId,competitionId);
    assert.ok(projection.events.every(e=>e.day<=day||e.result===null));
    assert.ok(projection.events.every(e=>e.day<=day||e.phaseId==="league"||(e.homeId===null&&e.awayId===null)));
    if(day<56){assert.equal(projection.champion,null);assert.equal(projection.finalTable,null);assert.equal(projection.completed,false);}
   }
   assert.equal(final.completed,true);
   assert.ok(final.champion);
   assert.ok(final.events.every(e=>e.result!==null));
   assert.deepEqual(first.events.map(e=>e.eventId),final.events.map(e=>e.eventId));
  }
 }
 r.close();
});

test("I04 historical candidate boundary excludes current and future seasons",async()=>{
 const r=reader();r.activate({datasetId});
 for(let n=1;n<=6;n++){
  const result=await r.history({beforeSeasonNumber:n});
  assert.equal(result.status,"candidate");
  assert.equal(result.records.length,n-1);
  assert.ok(result.records.every(record=>record.seasonNumber<n&&record.status==="UNSEALED_NOT_FOR_RUNTIME"));
 }
 r.close();
});
