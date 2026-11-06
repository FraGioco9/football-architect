import assert from 'node:assert/strict';
import test from 'node:test';
import divisions from '../../data/divisions.json' with {type:'json'};
import {assertCalendarMappings,legacySeasonOneRules} from '../src/calendar-rules-compat.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {ApiError} from '../src/errors.ts';
test('division catalogue contains sporting rules only; versioned calendar owns 32 placement bindings',()=>{
 assert.equal(divisions.length,16);
 assert.ok(divisions.every(c=>c.rules.phases.every(p=>!('calendarEvents' in p))));
 assert.doesNotThrow(()=>assertCalendarMappings(divisions));
 const restored=legacySeasonOneRules(divisions);
 assert.equal(restored.length,16);
 assert.ok(restored.every(c=>c.rules.phases.every(p=>'calendarEvents' in p&&Array.isArray(p.calendarEvents)&&p.calendarEvents.length>=2)));
 assert.deepEqual((restored.find(c=>c.id==='BR-1')!.rules.phases[1] as unknown as {calendarEvents:string[]}).calendarEvents,['N31','N32']);
 assert.deepEqual((restored.find(c=>c.id==='BR-2')!.rules.phases[1] as unknown as {calendarEvents:string[]}).calendarEvents,['N31','N32','N33']);
});
test('unchanged frozen season-one approval still validates via trusted backwards-compatible reconstruction',async()=>{
 const snapshot=await loadApprovedSnapshot();
 assert.equal(snapshot.bindings.length,18);
 assert.equal(snapshot.manifestVersion,1);
});

test('legacy calendar binding retains fail-closed guards for explicit events, duplicate IDs and unknown divisions',()=>{
 const baseline=JSON.stringify(divisions);
 const explicit=structuredClone(divisions);
 Object.assign(explicit[0].rules.phases[0],{calendarEvents:['N01']});
 const duplicate=structuredClone(divisions);
 Object.assign(duplicate[0].rules.phases[1],{id:duplicate[0].rules.phases[0].id});
 const unknown=structuredClone(divisions);
 Object.assign(unknown[0],{id:'UNKNOWN-1'});
 const rejects=(candidate:unknown)=>assert.throws(
  ()=>legacySeasonOneRules(candidate as typeof divisions),
  error=>error instanceof ApiError&&error.status===422&&error.code==='calendar_invalid'
 );
 for(const candidate of [explicit,duplicate,unknown])rejects(candidate);
 assert.equal(JSON.stringify(divisions),baseline,'failed validation must not mutate approved source');
});
