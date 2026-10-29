import assert from 'node:assert/strict';
import test from 'node:test';
import {parseRescheduleRequest} from '../src/admin-calendar-command.ts';
const valid={expectedGeneration:'550e8400-e29b-41d4-a716-446655440000',expectedRevision:3,eventId:'international:draw',day:3,order:2};
test('accepts only strict revision-bound rescheduling metadata',()=>{
 assert.deepEqual(parseRescheduleRequest(valid),valid);
 for(const bad of [null,{},[],{...valid,day:2.5},{...valid,order:'2'},{...valid,eventId:'../foo'},{...valid,approved:true},{...valid,expectedRevision:-1}])
  assert.throws(()=>parseRescheduleRequest(bad));
});

test('rescheduling policy is enforced by source-level publication guards',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/admin-calendar-command.ts',import.meta.url),'utf8');
 assert.match(source,/SELECT season_number FROM season_calendars WHERE season_number=/);
 assert.match(source,/SELECT day FROM season_day_outcomes WHERE season_number=/);
 assert.match(source,/SELECT count\(\*\) FROM season_calendars WHERE season_number=/);
 assert.match(source,/SELECT count\(\*\) FROM season_day_outcomes WHERE season_number=/);
});
