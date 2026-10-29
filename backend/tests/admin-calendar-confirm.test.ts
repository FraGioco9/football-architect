import assert from 'node:assert/strict';
import test from 'node:test';
import {parseCompleteEventRequest} from '../src/admin-calendar-confirm.ts';
const good={expectedGeneration:'550e8400-e29b-41d4-a716-446655440000',expectedRevision:7,eventId:'domestic:entrants'};
test('confirmation endpoint accepts only revision-bound event identity',()=>{
 assert.deepEqual(parseCompleteEventRequest(good),good);
 for(const bad of [null,[],{...good,status:'completed'},{...good,approval:true},{...good,eventId:'../../test'},{...good,expectedRevision:-1}])
  assert.throws(()=>parseCompleteEventRequest(bad));
});
