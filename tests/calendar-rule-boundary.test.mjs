import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import model from '../assets/world-calendar-model.js';
import rules from '../assets/competition-rules.js';
const divisions=JSON.parse(readFileSync(new URL('../data/divisions.json',import.meta.url),'utf8'));
test('permanent domestic rules normalize using only the approved world-calendar placements',()=>{
 for(const source of divisions){
  const original=JSON.stringify(source),normalized=rules.normalizeCompetition(source);
  assert.equal(JSON.stringify(source),original);
  assert.ok(source.rules.phases.every(p=>!Object.hasOwn(p,'calendarEvents')));
  for(const phase of normalized.rules.phases)assert.deepEqual(phase.calendarEvents,model.domesticPhaseMarkers(source.id,phase.id));
  assert.equal(normalized.metrics.phases.league.rounds,30);
 }
});
test('malformed explicit calendar placement fails validation without throwing or being silently repaired',()=>{
 for(const value of [null,{},[],['N01']]){
  const record=structuredClone(divisions[0]);record.rules.phases[0].calendarEvents=value;
  assert.doesNotThrow(()=>rules.validateCompetition(record));assert.equal(rules.validateCompetition(record).valid,false);
 }
});
