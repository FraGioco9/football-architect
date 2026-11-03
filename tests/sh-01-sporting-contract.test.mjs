import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sporting from '../assets/sporting-contract.js';
import registry from '../assets/rules-registry.js';
import engine from '../assets/competition-rules.js';
import calendar from '../assets/world-calendar-model.js';
const source=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
test('SH-01: canonical identities and rule versions bind all approved competitions',()=>{
 const definitions=[...source('divisions.json'),...source('international-competitions.json')];
 assert.equal(sporting.countries.length,8);
 assert.equal(sporting.domestic.length,16);
 assert.equal(sporting.international.length,2);
 assert.equal(new Set(sporting.competitionIds).size,18);
 assert.deepEqual(new Set(definitions.map(x=>x.id)),new Set(sporting.competitionIds));
 const profiles=registry.createRulesRegistry(definitions,engine);
 for(const def of definitions){
  assert.equal(sporting.rulesVersion(def.id),def.rules.version);
  assert.equal(profiles.resolveCompetitionRules(def.id).version,sporting.rulesVersion(def.id));
  if(def.category==='international')assert.equal(def.rules.phases.find(p=>p.id==='final').calendarEvents[0],sporting.finalEvent(def.id));
 }
 for(const id of ['',null,'IT-3','int-3','it-1','__proto__']) {
  assert.equal(sporting.rulesVersion(id),null);
  assert.equal(sporting.finalEvent(id),null);
 }
 assert.ok(Object.isFrozen(sporting.competitionIds));
 assert.ok(Object.isFrozen(sporting.countries));
});
test('SH-01: world calendar projects all canonical identities, 56 days and stable markers',()=>{
 for(const season of [1,2]){
  const projected=calendar.createSeason(season);
  assert.equal(projected.days.length,56);
  assert.deepEqual(projected.days.flatMap(d=>d.events).filter(e=>e.family==='national').length,33);
  assert.deepEqual(projected.days.flatMap(d=>d.events).filter(e=>e.family==='international').length,14);
  for(const id of sporting.domestic) {
   assert.equal(calendar.domesticPhaseMarkers(id,'league').length,30);
   assert.equal(calendar.domesticPhaseMarkers(id,id.endsWith('-1')?'playout':'promotionPlayoffs').length,id.endsWith('-1')?2:3);
  }
  const events=projected.days.flatMap(d=>d.events);
  for(const e of events)for(const id of e.competitionIds)assert.ok(sporting.competitionIds.includes(id));
  assert.deepEqual(events.find(e=>e.marker==='SOVEREIGN-FINAL').competitionIds,['int-1']);
  assert.deepEqual(events.find(e=>e.marker==='FEDERATION-FINAL').competitionIds,['int-2']);
 }
 assert.throws(()=>calendar.projectCompetition(1,'IT-3'),/Unknown competition/);
 assert.throws(()=>calendar.createSeason(0),/Invalid calendar season/);
});
