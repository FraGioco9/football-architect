import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {loadCompetitionCatalogue} from "../tools/competition-catalogue.mjs";
const require=createRequire(import.meta.url);
const {validateCompetition,normalizeCompetition,phaseMetrics,outcomeAt}=require("../assets/competition-rules.js");
const items=loadCompetitionCatalogue();
test("18 competitions with approved derived totals",()=>{
 assert.equal(items.length,18);
 for(const d of items){assert.equal(Object.isFrozen(d.rules),true);if(d.category==="domestic"){assert.deepEqual(phaseMetrics(d,"league"),{rounds:30,matchesPerRound:8,matches:240});}else{assert.deepEqual(phaseMetrics(d,"league"),{rounds:6,matchesPerRound:12,matches:72});assert.equal(d.metrics.totalMatches,93);assert.equal(outcomeAt(d,"league",4).kind,"quarterfinals");assert.equal(outcomeAt(d,"league",12).kind,"knockouts");assert.equal(outcomeAt(d,"league",24).kind,"eliminated");}}
});
test("cup bracket follows approved original seeds",()=>{
 const cup=items.find(x=>x.id==="sovereign-cup");
 const phases=cup.rules.phases;
 assert.deepEqual(phases[1].ties.map(x=>x.participants.map(p=>p.rank)),[[5,12],[6,11],[7,10],[8,9]]);
 assert.deepEqual(phases[2].ties.map(x=>x.participants[0].rank),[1,4,2,3]);
 assert.deepEqual(phases[2].ties.map(x=>x.participants[1].tieId),["p89","p512","p710","p611"]);
 assert.equal(phases.at(-1).ties[0].homePolicy,"neutral");
});
test("reject invalid rank overlap, points, policies and cyclic ties",()=>{
 const input=items.find(x=>x.id==="sovereign-cup");
 const change=mutate=>{const copy=JSON.parse(JSON.stringify(input));mutate(copy);assert.equal(validateCompetition(copy).valid,false)};
 change(x=>x.rules.phases[0].points.win=-1);
 change(x=>x.rules.phases[0].rankOutcomes[1].from=4);
 change(x=>x.rules.phases[0].rankOutcomes[2].to=23);
 change(x=>x.rules.qualificationPolicyId="unknown");
 change(x=>x.rules.phases[2].ties[0].participants[1].tieId="q4");
 change(x=>x.rules.phases[1].calendarEvents=["N01"]);
 change(x=>x.rules.phases.at(-1).calendarEvents=["FEDERATION-FINAL"]);
 change(x=>x.rules.phases[0].rankOutcomes[0].to=25);
 change(x=>x.rules.phases[1].ties[0].participants[0].rank=25);
});
