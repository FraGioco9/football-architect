// ME-PB-53 B5.2 — first real-world regression of the closed guard.
// Full adversarial test matrix and exact-head CI are separate B5.3/B5.4.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as module from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,canonicalSnapshot}
 from '../src/core.mjs';
import {createLocalBallContestSession}
 from '../src/player-ball-contest.mjs';
import {createLocalBallAmbiguityGuardSession,
 BALL_AMBIGUITY_GUARD_VERSION}
 from '../src/player-ball-ambiguity-guard.mjs';
import {readFileSync} from 'node:fs';

const Rapier=await initializeRapier(module);
const PITCH=Object.freeze({
 preset:'roll',seed:'me-pb-52-distinct-opponent-owner',
 x:4.96,y:0,z:0,vx:-0.3,vy:0,vz:0
});
const FAR=Object.freeze({
 preset:'roll',seed:'me-pb-53-no-touch',x:30,y:20,z:0,
 vx:0,vy:0,vz:0
});

test('ME-PB-53 B5.2 closed guard only observes genuine Rapier control, loss, unqualified contact and new owner',()=>{
 const a=createLocalBallAmbiguityGuardSession(Rapier,PITCH);
 const b=createLocalBallContestSession(Rapier,PITCH);
 const checkpoints=new Map();
 try{
  assert.equal(a.snapshot().physicsTick,0);
  assert.equal(a.snapshot().version,BALL_AMBIGUITY_GUARD_VERSION);
  for(let tick=1;tick<=155;tick++){
   const frame=a.step(),reference=b.step();
   assert.equal(frame.physicsTick,tick);
   assert.equal(canonicalSnapshot(frame.ballSnapshot),
    canonicalSnapshot(reference.ballSnapshot));
   assert.deepEqual(frame.footContact,reference.footContact);
   assert.equal(frame.ownerPlayerId,reference.ownerPlayerId);
   assert.deepEqual(frame.physicalStarts,reference.physicalStarts);
   assert.deepEqual(frame.losses,reference.losses);
   assert.deepEqual(frame.acquisitions,reference.acquisitions);
   assert.deepEqual(frame.subsequentOwners,reference.subsequentOwners);
   assert.equal(frame.officialMatchPossession,false);
   assert.equal(frame.ballForceApplied,false);
   assert.equal(frame.interceptionProven,false);
   assert.ok(Object.isFrozen(frame));
   if([1,7,15,19,127,130,141,145,146].includes(tick))
    checkpoints.set(tick,frame);
  }
  assert.equal(checkpoints.get(1).ownerPlayerId,null);
  assert.equal(checkpoints.get(1).contactClassification,
   'unqualified-physical-contact');
  assert.equal(checkpoints.get(7).ownerPlayerId,'away-10');
  assert.equal(checkpoints.get(7).contactClassification,
   'qualified-local-control');
  assert.equal(checkpoints.get(15).ownerPlayerId,null);
  assert.equal(checkpoints.get(19).ownerPlayerId,null);
  assert.equal(checkpoints.get(127).ownerPlayerId,null);
  assert.equal(checkpoints.get(130).ownerPlayerId,null);
  assert.equal(checkpoints.get(141).ownerPlayerId,null);
  assert.equal(checkpoints.get(145).ownerPlayerId,null);
  assert.equal(checkpoints.get(146).ownerPlayerId,'home-10');
  assert.equal(checkpoints.get(146).subsequentOwners[0].classification,
   'later-owner-after-prior-control-loss');
 }finally{a.dispose();b.dispose();}
});

test('ME-PB-53 B5.2 no-contact, no injected evidence, deterministic replay and reset are closed',()=>{
 const s=createLocalBallAmbiguityGuardSession(Rapier,FAR);
 try{
  for(const fake of [{ownerPlayerId:'away-10'},{started:['away-10']},
   {ballForceApplied:true},null,0]){
   assert.throws(()=>s.step(fake),/cannot accept injected owner/);
   assert.equal(s.snapshot().physicsTick,0);
  }
  for(let tick=1;tick<=35;tick++){
   const f=s.step();
   assert.equal(f.ownerPlayerId,null);
   assert.equal(f.contactClassification,'no-active-shoe');
   assert.equal(f.unqualifiedContactTicks,0);
   assert.equal(f.acquisitions.length,0);
  }
  const next=s.reset();
  try{
   assert.throws(()=>s.step(),/Ambiguity guard disposed/);
   for(let tick=1;tick<=35;tick++){
    const f=next.step();
    assert.equal(f.physicsTick,tick);
    assert.equal(f.ownerPlayerId,null);
   }
  }finally{next.dispose();}
 }finally{s.dispose();}
 assert.throws(()=>createLocalBallAmbiguityGuardSession(Rapier,FAR,
  {globalResponse:1,footRestitution:0.25}),
 /Only a single common ball response/);
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const core=readFileSync(new URL('../src/core.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(html,/player-ball-ambiguity-guard/);
 assert.doesNotMatch(core,/createLocalBallAmbiguityGuardSession/);
});
