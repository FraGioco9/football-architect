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
// Both independent INT-24 competitions share the same bracket rules; verify
// each source definition, rather than relying on one arbitrary cup as a proxy.
const internationalCups=items.filter(item=>item.category==="international");
test("each INT-24 cup bracket follows approved original seeds",()=>{
 assert.equal(internationalCups.length,2,"Both international competitions must be covered");
 for(const cup of internationalCups){
  const phases=cup.rules.phases;
  assert.deepEqual(phases[1].ties.map(x=>x.participants.map(p=>p.rank)),[[5,12],[6,11],[7,10],[8,9]],cup.id);
  assert.deepEqual(phases[2].ties.map(x=>x.participants[0].rank),[1,4,2,3],cup.id);
  assert.deepEqual(phases[2].ties.map(x=>x.participants[1].tieId),["p89","p512","p710","p611"],cup.id);
  assert.equal(phases.at(-1).ties[0].homePolicy,"neutral",cup.id);
 }
});
test("all 18 competitions reject invalid sporting rules, including INT-24 specifics",()=>{
 assert.equal(internationalCups.length,2,"Both international competitions must be covered");
 const invalidCases=[
  ["negative win points",x=>{x.rules.phases[0].points.win=-1}],
  ["overlapping rank qualification",x=>{x.rules.phases[0].rankOutcomes[1].from=4}],
  ["incomplete rank qualification",x=>{x.rules.phases[0].rankOutcomes[2].to=23}],
  ["unknown qualification policy",x=>{x.rules.qualificationPolicyId="unknown"}],
  ["cyclic knockout tie",x=>{x.rules.phases[2].ties[0].participants[1].tieId="q4"}],
  ["domestic event in international cup",x=>{x.rules.phases[1].calendarEvents=["N01"]}],
  ["other cup's final", (x,cup)=>{x.rules.phases.at(-1).calendarEvents=[cup.id==="int-1"?"FEDERATION-FINAL":"SOVEREIGN-FINAL"]}],
  ["qualification exceeding capacity",x=>{x.rules.phases[0].rankOutcomes[0].to=25}],
  ["unseeded playoff participant",x=>{x.rules.phases[1].ties[0].participants[0].rank=25}]
 ];
 for(const cup of internationalCups)for(const [label,mutate] of invalidCases){
  const modified=JSON.parse(JSON.stringify(cup));
  mutate(modified,cup);
  assert.equal(validateCompetition(modified).valid,false,cup.id+": "+label);
 }

 const domestic=items.filter(item=>item.category==="domestic");
 assert.equal(domestic.length,16,"All domestic competitions must be covered");
 // The two domestic tiers have different promotion/relegation rules. These
 // common invalid-input contracts apply independently to every division.
 const invalidDomesticCases=[
  ["odd participant capacity",x=>{x.capacity=15}],
  ["negative league win points",x=>{x.rules.phases[0].points.win=-1}],
  ["unknown qualification policy",x=>{x.rules.qualificationPolicyId="unknown"}],
  ["international calendar event in domestic league",x=>{x.rules.phases[0].calendarEvents[0]="I01"}],
  ["duplicated league calendar event",x=>{x.rules.phases[0].calendarEvents[1]=x.rules.phases[0].calendarEvents[0]}],
  ["unsupported rank outcome",x=>{x.rules.phases[0].rankOutcomes[0].kind="alien"}],
  ["rank outside the division",x=>{x.rules.phases[0].rankOutcomes[0].from=0}]
 ];
 for(const division of domestic)for(const [label,mutate] of invalidDomesticCases){
  const modified=JSON.parse(JSON.stringify(division));
  mutate(modified);
  assert.equal(validateCompetition(modified).valid,false,division.id+": "+label);
 }
});

test("catalogue preserves country/tier and approved rule version identity",()=>{
 const countries=new Set(["IT","ENG","ES","DE","FR","PT","NL","BR"]);
 for(const item of items){
   if(item.category==="domestic"){
     assert.ok(countries.has(item.countryId));
     assert.equal(item.id,item.countryId+"-"+item.tier);
     assert.equal(item.rules.version,item.tier===1?"domestic-top-v1":"domestic-second-v1");
   }else{
     assert.ok(["int-1","int-2"].includes(item.id));
     assert.equal(item.rules.version,"international-int24-v1");
   }
 }
});
