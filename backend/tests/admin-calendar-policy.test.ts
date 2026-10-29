import assert from 'node:assert/strict';
import test from 'node:test';
import {rescheduleAdministrativeMilestone,dueAdministrativeMilestones,proposeAdministrativeMilestones,type AdministrativeMilestone} from '../src/admin-calendar-policy.ts';
const milestones:AdministrativeMilestone[]=[
 {id:'domestic:entrants',scope:'domestic',kind:'confirm-domestic-entrants',day:1,order:1,status:'scheduled'},
 {id:'domestic:fixtures',scope:'domestic',kind:'generate-domestic-calendar',day:2,order:1,status:'scheduled'},
 {id:'international:entrants',scope:'international',kind:'confirm-international-entrants',day:1,order:2,status:'scheduled'},
 {id:'international:draw',scope:'international',kind:'draw-international',day:3,order:1,status:'scheduled'},
 {id:'international:fixtures',scope:'international',kind:'generate-international-calendar',day:3,order:2,status:'scheduled'},
];
test('independent milestones on same day have explicit deterministic ordering',()=>{
 assert.deepEqual(dueAdministrativeMilestones(milestones,1).map(e=>e.id),['domestic:entrants','international:entrants']);
 assert.deepEqual(dueAdministrativeMilestones(milestones,3).map(e=>e.id),['international:draw','international:fixtures']);
});
test('rescheduling one future milestone preserves all other placements and original input',()=>{
 const moved=rescheduleAdministrativeMilestone(milestones,'international:draw',2,2,0);
 assert.equal(moved.find(e=>e.id==='international:draw')!.day,2);
 assert.equal(milestones.find(e=>e.id==='international:draw')!.day,3);
 assert.equal(moved.find(e=>e.id==='international:fixtures')!.day,3);
});
test('rejects reordering ahead of dependencies, collision and past/executed changes',()=>{
 assert.throws(()=>rescheduleAdministrativeMilestone(milestones,'international:draw',1,1,0));
 assert.throws(()=>rescheduleAdministrativeMilestone(milestones,'international:draw',4,1,0));
 assert.throws(()=>rescheduleAdministrativeMilestone(milestones,'international:draw',2,1,0));
 assert.throws(()=>rescheduleAdministrativeMilestone(milestones,'international:draw',3,1,3));
 assert.throws(()=>rescheduleAdministrativeMilestone(milestones,'international:draw',2,2,2));
 const completed=milestones.map(e=>e.id==='international:draw'?{...e,status:'completed' as const}:e);
 assert.throws(()=>rescheduleAdministrativeMilestone(completed,'international:draw',2,2,0));
});
test('rejects missing dependencies and forged or duplicate milestone identities',()=>{
 assert.throws(()=>dueAdministrativeMilestones(milestones.filter(e=>e.id!=='international:entrants'),3));
 assert.throws(()=>dueAdministrativeMilestones([...milestones,milestones[0]],3));
 assert.throws(()=>rescheduleAdministrativeMilestone(milestones,'absent',4,3,0));
 assert.throws(()=>dueAdministrativeMilestones(milestones,57));
});

test('proposed new-season milestones mirror approved independently movable day 1/2/3 setup',()=>{
 const plan=proposeAdministrativeMilestones();
 assert.deepEqual(plan,milestones);
 assert.ok(Object.isFrozen(plan));
 assert.throws(()=>rescheduleAdministrativeMilestone(plan,'international:draw',1,3,0));
 const changed=rescheduleAdministrativeMilestone(plan,'international:draw',2,2,0);
 assert.equal(changed[3].day,2);
});
