import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assertApprovedBaseline,DEBUG_SEASONS,validateSeasonFragment} from "../tools/debug-data-schema.mjs";
import {buildDomesticLeague,projectDomesticLeague} from "../tools/debug-data-domestic-generator.mjs";
const baseline=JSON.parse(readFileSync(new URL("../backend/catalogues/season-1.participants.json",import.meta.url),"utf8"));
test("approved first-season baseline has 16 domestic and 2 cup rosters",()=>{
 const result=assertApprovedBaseline(baseline);assert.equal(result.size,18);assert.deepEqual(DEBUG_SEASONS,[1,2,3,4,5]);
});
test("fresh domestic schedule is reproducible and has 30 rounds",()=>{
 const clubs=assertApprovedBaseline(baseline).get("IT-1");
 const input={datasetId:"debug-v1",seasonNumber:1,competitionId:"IT-1",participants:clubs,seed:"fresh-debug-data-v1"};
 const a=buildDomesticLeague(input),b=buildDomesticLeague(input);
 assert.deepEqual(a,b);assert.equal(a.events.length,240);assert.equal(new Set(a.events.map(x=>x.roundId)).size,30);
 assert.equal(new Set(a.events.map(x=>[x.homeId,x.awayId].sort().join(":"))).size,120);
 const partial=projectDomesticLeague(a,25);assert.equal(partial.standings.reduce((sum,row)=>sum+row.played,0),partial.fixtures.filter(x=>x.result).length*2);
 assert.ok(partial.fixtures.some(x=>x.result===null));
 assert.ok(projectDomesticLeague(a,56).fixtures.every(x=>x.result!==null));
});
test("source provenance and world day failures are rejected",()=>{
 const clubs=assertApprovedBaseline(baseline).get("IT-2");
 const s=buildDomesticLeague({datasetId:"debug-v1",seasonNumber:5,competitionId:"IT-2",participants:clubs,seed:"new-seed"});
 assert.equal(validateSeasonFragment(s),true);
 assert.throws(()=>validateSeasonFragment({...s,source:{kind:"authoritative"}}));
 assert.throws(()=>projectDomesticLeague(s,57));
});
