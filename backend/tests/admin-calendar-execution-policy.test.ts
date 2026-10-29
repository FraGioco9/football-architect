import assert from 'node:assert/strict';
import test from 'node:test';
import {proposeAdministrativeMilestones} from '../src/admin-calendar-policy.ts';
import {planDueAdministrativeEvents} from '../src/admin-calendar-execution-policy.ts';
test('day one confirmations are independently ordered without simulated match results',()=>{
 const plan=planDueAdministrativeEvents(proposeAdministrativeMilestones(),1,0);
 assert.deepEqual(plan.map(e=>e.event.id),['domestic:entrants','international:entrants']);
 assert.ok(plan.every(e=>!e.requiresArtifact));
});
test('day two fails closed until its prerequisite confirmation is persisted',()=>{
 assert.throws(()=>planDueAdministrativeEvents(proposeAdministrativeMilestones(),2,1),
  (error:any)=>error.status===409);
 const done=proposeAdministrativeMilestones().map(e=>e.day===1?{...e,status:'completed' as const}:e);
 const plan=planDueAdministrativeEvents(done,2,1);
 assert.deepEqual(plan.map(e=>e.event.id),['domestic:calendar']);
 assert.equal(plan[0].requiresArtifact,true);
});
test('day three exposes draw before calendar generation and refuses fabricated completion',()=>{
 const done=proposeAdministrativeMilestones().map(e=>e.day<3?{...e,status:'completed' as const}:e);
 const plan=planDueAdministrativeEvents(done,3,2);
 assert.deepEqual(plan.map(e=>e.event.id),['international:draw']);
 assert.equal(plan[0].requiresArtifact,true);
 const withDraw=done.map(e=>e.id==='international:draw'?{...e,status:'completed' as const}:e);
 const next=planDueAdministrativeEvents(withDraw,3,2);
 assert.deepEqual(next.map(e=>e.event.id),['international:calendar']);
});
test('refuses skipping uncompleted events and malformed day transitions',()=>{
 assert.throws(()=>planDueAdministrativeEvents(proposeAdministrativeMilestones(),4,3));
 assert.throws(()=>planDueAdministrativeEvents(proposeAdministrativeMilestones(),1,1));
});
