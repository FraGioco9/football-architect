// DEBUG-DATA-01 I02 integration QA — runs entirely in memory.
// No remote DB, no production API, no artifact publication.
import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildFiveSeasonCorpusCandidate} from "../tools/debug-data-five-season-corpus.mjs";
import {planProtectedDebugExport} from "../tools/debug-data-export-plan.mjs";
import {projectDebugWorldAtDay} from "../tools/debug-data-projection.mjs";
import {hash} from "../tools/debug-data-schema.mjs";
const read=async p=>JSON.parse(await readFile(new URL("../"+p,import.meta.url),"utf8"));
const [baseline,divisions,cupCatalog]=await Promise.all([
 read("backend/catalogues/season-1.participants.json"),read("data/divisions.json"),read("data/international-competitions.json")]);
const config={baseline,divisions,cupCatalog,seed:"i02-validation-2026-11-02",datasetId:"debug-i02-qa"};
test("I02 full five-season build + 90 protected fragments + deterministic manifest",()=>{
 const a=buildFiveSeasonCorpusCandidate(config),plan=planProtectedDebugExport(a);
 assert.equal(a.seasons.length,5);
 assert.equal(plan.files.length,90);
 assert.equal(new Set(plan.files.map(f=>f.path)).size,90);
 for(const f of plan.files){assert.equal(hash(JSON.stringify(f.content)),f.sha256);assert.equal(Buffer.byteLength(JSON.stringify(f.content)),f.bytes);}
 const b=buildFiveSeasonCorpusCandidate(config),second=planProtectedDebugExport(b);
 assert.equal(plan.manifestHash,second.manifestHash);
 assert.equal(a.status,"UNSEALED_NOT_FOR_RUNTIME");
 for(const s of a.seasons){
  assert.equal(Object.keys(s.domestic).length,16);
  assert.equal(Object.keys(s.cups).length,2);
  for(const cup of Object.values(s.cups))assert.equal(cup.events.length,93);
 }
});
test("I02 projection masks future scores, future knockout identities and returns partial standings",()=>{
 const corpus=buildFiveSeasonCorpusCandidate(config);
 for(const seasonNumber of [1,3,5])for(const competitionId of ["IT-1","IT-2","int-1","int-2"]){
  const early=projectDebugWorldAtDay(corpus,{seasonNumber,worldDay:1,competitionId,divisions,cupCatalog});
  assert.equal(early.events.filter(f=>f.result!==null).length,0);
  assert.equal(early.standings.length,competitionId.startsWith("int-")?24:16);
  assert.equal(early.champion,null);
  assert.equal(early.completed,false);
  const near=projectDebugWorldAtDay(corpus,{seasonNumber,worldDay:31,competitionId,divisions,cupCatalog});
  assert.ok(near.events.some(f=>f.result!==null));
  assert.ok(near.events.filter(f=>f.phaseId!=="league"&&f.day>31).every(f=>f.homeId===null&&f.awayId===null));
  const last=projectDebugWorldAtDay(corpus,{seasonNumber,worldDay:56,competitionId,divisions,cupCatalog});
  assert.ok(last.events.every(f=>f.result!==null));
  assert.ok(last.champion);
  assert.equal(last.completed,true);
 }
});
