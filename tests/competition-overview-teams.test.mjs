import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {competitionSummary,renderCompetitionOverview,renderCompetitionTeams} from "../assets/competition-overview-teams.mjs";

const manifest=JSON.parse(readFileSync(new URL("../competitions/_shared/manifest.json",import.meta.url),"utf8"));
const divisions=manifest.divisions;

test("ROUTE-02 Overview derives approved competition facts without fictional results for every domestic division",()=>{
 assert.equal(divisions.length,16,"All eight countries and both domestic tiers must be covered");
 for(const division of divisions){
  const summary=competitionSummary(division);
  assert.equal(summary.participants,16,division.id);
  assert.equal(summary.matchdays,30,division.id);
  assert.equal(summary.matches,240,division.id);
  assert.equal(summary.name,division.name,division.id);
  const overview=renderCompetitionOverview(division);
  assert.ok(overview.includes(division.name),division.id);
  assert.doesNotMatch(overview,/champion|winner|goals scored/i,division.id);
 }
});

test("ROUTE-02 Teams lists every approved participant with canonical club Overview links",()=>{
 assert.equal(divisions.length,16);
 for(const division of divisions){
  const summary=competitionSummary(division);
  const output=renderCompetitionTeams(division);
  assert.equal(summary.clubs.length,16,division.id);
  assert.equal((output.match(/<li>/g)||[]).length,16,division.id);
  for(const club of summary.clubs){
   const href="/clubs/"+division.countryId.toLowerCase()+"/"+String(club.id).padStart(2,"0")+"/overview";
   assert.equal(club.href,href,division.id+": "+club.id);
   assert.ok(output.includes('href="'+href+'"'),division.id+": "+club.id);
  }
 }
});

test("ROUTE-02 every domestic presentation rejects malformed participants and escapes HTML",()=>{
 assert.equal(divisions.length,16);
 for(const division of divisions){
  const mutate=(label,modify)=>{
   const changed=modify(division);
   assert.throws(()=>competitionSummary(changed),undefined,division.id+": "+label);
  };
  mutate("missing participant",d=>({...d,clubs:d.clubs.slice(1)}));
  mutate("duplicate club identity",d=>({...d,clubs:d.clubs.map(c=>({...c,clubId:d.clubs[0].clubId}))}));
  mutate("empty display name",d=>({...d,clubs:d.clubs.map((c,i)=>i?c:{...c,primaryName:""})}));
  mutate("out-of-range ID",d=>({...d,clubs:d.clubs.map((c,i)=>i?c:{...c,clubId:0})}));
  const injected={...division,name:"<script>evil()</script>",clubs:division.clubs.map((c,i)=>i?c:{
   ...c,primaryName:"<script>evil()</script>",stadiumName:"<img src=x onerror=evil()>"
  })};
  const teams=renderCompetitionTeams(injected);
  const overview=renderCompetitionOverview(injected);
  assert.doesNotMatch(teams,/<script>|<img/,division.id);
  assert.match(teams,/&lt;script&gt;/,division.id);
  assert.match(teams,/&lt;img/,division.id);
  assert.doesNotMatch(overview,/<script>/,division.id);
  assert.match(overview,/&lt;script&gt;/,division.id);
 }
});
