import test from "node:test";
import assert from "node:assert/strict";
import {competitionSummary,renderCompetitionOverview,renderCompetitionTeams} from "../assets/competition-overview-teams.mjs";
const division={id:"IT-1",name:"Lega Federale",countryId:"IT",countryName:"Italy",tier:1,
 clubs:Array.from({length:16},(_,i)=>({clubId:i+1,primaryName:"Club "+(i+1),stadiumName:"Stadium "+(i+1)}))};
test("ROUTE-02 Overview derives approved competition facts without fictional results",()=>{
 const summary=competitionSummary(division);
 assert.equal(summary.participants,16);assert.equal(summary.matchdays,30);assert.equal(summary.matches,240);
 assert.match(renderCompetitionOverview(division),/Lega Federale/);
 assert.doesNotMatch(renderCompetitionOverview(division),/champion|winner|goals scored/i);
});
test("ROUTE-02 Teams lists 16 manifest identities linked to canonical club Overview",()=>{
 const output=renderCompetitionTeams(division);
 assert.equal((output.match(/<li>/g)||[]).length,16);
 assert.match(output,/href="\/clubs\/it\/01\/overview"/);
 assert.match(output,/href="\/clubs\/it\/16\/overview"/);
 assert.match(output,/Stadium 16/);
});
test("ROUTE-02 presentation rejects malformed data and escapes HTML",()=>{
 assert.throws(()=>competitionSummary({...division,clubs:division.clubs.slice(1)}));
 assert.throws(()=>competitionSummary({...division,clubs:division.clubs.map(c=>({...c,clubId:1}))}));
 const modified={...division,clubs:division.clubs.map((c,i)=>i?c:{...c,primaryName:"<script>alert(1)</script>"})};
 const output=renderCompetitionTeams(modified);
 assert.doesNotMatch(output,/<script>/);
 assert.match(output,/&lt;script&gt;/);
});
