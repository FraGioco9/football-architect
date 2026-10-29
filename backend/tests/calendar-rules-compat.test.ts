import assert from 'node:assert/strict';
import test from 'node:test';
import divisions from '../../data/divisions.json' with {type:'json'};
import {assertCalendarMappings,legacySeasonOneRules} from '../src/calendar-rules-compat.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
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
