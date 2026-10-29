import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeAdministrativeMilestones,proposeEndSeasonMilestones,rescheduleAdministrativeMilestone,dueAdministrativeMilestones} from '../src/admin-calendar-policy.ts';
const all=()=>[...proposeAdministrativeMilestones(),...proposeEndSeasonMilestones()];
test('end-season policy: fixed identifiers, day 56 and strictly ordered execution',()=>{
 const events=proposeEndSeasonMilestones();
 assert.deepEqual(events.map(e=>[e.id,e.kind,e.day,e.order]),[
  ['season:archive','archive-season',56,9000],
  ['season:close','close-season',56,9100],
  ['season:next-prepare','prepare-next-season',56,9200],
 ]);
 assert.deepEqual(dueAdministrativeMilestones(all(),56).map(e=>e.id),events.map(e=>e.id));
 assert.equal(proposeAdministrativeMilestones().length,5,'migration must explicitly opt in; no legacy replay changes');
});
test('end-season policy: future move respects same-day order, sports completion and no past moves',()=>{
 const events=all();
 assert.equal(rescheduleAdministrativeMilestone(events,'season:close',56,9150,55).find(e=>e.id==='season:close')?.order,9150);
 for(const [id,day,order,today] of [
  ['season:archive',55,9000,40],['season:close',56,8900,55],
  ['season:archive',56,9300,55],['season:next-prepare',56,9050,55],
  ['season:archive',56,9000,56],['season:close',56,9100,56],
 ] as const)assert.throws(()=>rescheduleAdministrativeMilestone(events,id,day,order,today));
 const completed=events.map(e=>e.id==='season:archive'?{...e,status:'completed' as const}:e);
 assert.throws(()=>rescheduleAdministrativeMilestone(completed,'season:archive',56,9001,55));
});

test('ordered terminal rescheduling cannot break execution dependencies or modify completed receipts',()=>{
 const events=all();
 const changed=rescheduleAdministrativeMilestone(events,'season:next-prepare',56,9250,56);
 assert.equal(changed.find(e=>e.id==='season:next-prepare')?.order,9250);
 assert.deepEqual(dueAdministrativeMilestones(changed,56).map(e=>e.id),['season:archive','season:close','season:next-prepare']);
 assert.throws(()=>rescheduleAdministrativeMilestone(changed,'season:close',56,9300,56));
 assert.throws(()=>rescheduleAdministrativeMilestone(changed,'season:archive',56,9100,56));
 const complete=changed.map(e=>e.id==='season:archive'?{...e,status:'completed' as const}:e);
 assert.throws(()=>rescheduleAdministrativeMilestone(complete,'season:archive',56,9001,56));
});
