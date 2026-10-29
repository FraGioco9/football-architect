import assert from 'node:assert/strict';
import test from 'node:test';
import {parseRescheduleRequest} from '../src/admin-calendar-command.ts';
const valid={expectedGeneration:'550e8400-e29b-41d4-a716-446655440000',expectedRevision:3,eventId:'international:draw',day:3,order:2};
test('accepts only strict revision-bound rescheduling metadata',()=>{
 assert.deepEqual(parseRescheduleRequest(valid),valid);
 for(const bad of [null,{},[],{...valid,day:2.5},{...valid,order:'2'},{...valid,eventId:'../foo'},{...valid,approved:true},{...valid,expectedRevision:-1}])
  assert.throws(()=>parseRescheduleRequest(bad));
});
