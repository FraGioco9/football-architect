import assert from 'node:assert/strict';
import test from 'node:test';
import {buildSeasonCalendarEvidence,buildSeasonOneCalendarEvidence} from '../src/season-calendar-evidence.ts';
test('Season 1 calendar remains bound to its approved hash',async()=>{
 const original=await buildSeasonOneCalendarEvidence(),derived=await buildSeasonCalendarEvidence(1);
 assert.deepEqual(derived,original);
});
test('Season 2 preserves the 56-day world shape and uses distinct event identities',async()=>{
 const one=await buildSeasonCalendarEvidence(1),two=await buildSeasonCalendarEvidence(2);
 assert.equal(two.season,2);
 const days=JSON.parse(two.calendarJson).days;
 assert.equal(days.length,56);
 assert.ok(days.every((entry:{id:string;day:number},index:number)=>entry.day===index+1&&entry.id===`season:2:day:${index+1}`));
 assert.notEqual(one.calendarHash,two.calendarHash);
 assert.equal(days[55].kind,'transition');
});
test('rejects invalid season numbers at the calendar trust boundary',async()=>{
 for(const season of [0,-1,1.5,1000001])await assert.rejects(buildSeasonCalendarEvidence(season));
});
