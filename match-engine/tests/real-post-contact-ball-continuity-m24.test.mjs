// #628 M24: actual one-second post-contact trace, never a fake control.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab as createCurrentActionLab} from '../src/action-labs.mjs';
 // Historical M/B evidence comparator only. Current gameplay uses the default.
 const createControlledActionLab=(R,id,options={})=>createCurrentActionLab(R,id,{
  ...options,historicalEvidenceBaseline:!['pass-pair','cross-pair','carry-solo','dribble-1v1','keeper-1v1','defender-1v1','overload-2v1','duel-2v2','duel-3v3'].includes(id)
 });

import {createRealPostContactBallContinuity,M24_OBSERVATION_TICKS}
 from '../src/real-post-contact-ball-continuity-m24.mjs';

test('M24 is a fail-closed observer, not a physical or possession authority',()=>{
 assert.equal(M24_OBSERVATION_TICKS,60);
 const o=createRealPostContactBallContinuity();
 assert.throws(()=>o.snapshot(),TypeError);
 assert.throws(()=>o.observe({}),TypeError);
 assert.throws(()=>o.observe({
  physics:{tick:0,ball:{position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0}}},
  playerFrame:{tick:0,players:[]},foot:{tick:0,started:[],ended:[],active:[]},
  decisionEvidence:{tick:0,nativeSourceObserverOnly:true,readOnly:true,
   matchAuthority:false,officialPossession:false}
 }),TypeError);
});

test('M24 records full 60 measured native post-contact ticks after real receiver',
 {timeout:90000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const a=createControlledActionLab(R,'control',{controlSide:side});
  const b=createControlledActionLab(R,'control',{controlSide:side});
  let opening=null,completed=null;
  try{
   assert.deepEqual(a.snapshot().contactContinuity,b.snapshot().contactContinuity);
   for(let tick=1;tick<=105;tick++){
    const f=a.step(),g=b.step();
    const c=f.contactContinuity;
    assert.deepEqual(c,g.contactContinuity);
    assert.equal(c.tick,tick);
    assert.equal(c.physicallyObservedOnly,true);
    assert.equal(c.readOnly,true);
    assert.equal(c.matchAuthority,false);
    assert.equal(c.verifiedBallControl,false);
    assert.equal(c.verifiedPossession,false);
    assert.equal(c.verifiedReception,false);
    assert.equal(f.officialMatchPossession,false);
    if(f.decisionEvidence.current.kind==='possible-post-pass-receiver-contact'&&
       opening===null){
     opening={tick,trace:c.active};
     assert.equal(c.active?.onsetTick,tick);
     assert.equal(c.active?.actorId,side+'-9');
     assert.equal(c.active?.observedTicks,1);
     assert.equal(c.active?.actualShoeActiveTicks,1);
     assert.equal(c.active?.completedObservation,false);
    }
    if(c.latestCompleted&&completed===null)
     completed=c.latestCompleted;
   }
   assert.ok(opening,'real original receiving shoe START must occur');
   assert.ok(completed,'one-second bounded physical trace must finish');
   assert.equal(completed.kind,'possible-post-pass-receiver-contact');
   assert.equal(completed.onsetTick,opening.tick);
   assert.equal(completed.actorId,side+'-9');
   assert.equal(completed.observedTicks,60);
   assert.equal(completed.endReason,'one-second-observation-complete');
   assert.equal(completed.lastTick,opening.tick+59);
   assert.ok(completed.actualShoeActiveTicks>=1);
   assert.ok(completed.cumulativeBallTravelXYM>=0);
   assert.ok(completed.cumulativeBallTravel3DM>=completed.cumulativeBallTravelXYM-0.0002);
   assert.ok(Number.isFinite(completed.initialBallSpeedMps));
   assert.ok(Number.isFinite(completed.lastBallSpeedMps));
   assert.ok(Number.isFinite(completed.finalBallCentreToPlayerXYM));
   assert.equal(completed.verifiedReception,false);
   assert.equal(completed.verifiedBallControl,false);
   assert.equal(completed.verifiedPossession,false);
   assert.equal(a.snapshot().contactContinuity.active,null);
   process.stdout.write('ME_628_M24_REAL_RECEIVER_'+side.toUpperCase()+' '+
    JSON.stringify({onsetTick:opening.tick,observedTicks:completed.observedTicks,
     realShoeActiveTicks:completed.actualShoeActiveTicks,
     realBallTravelXYM:completed.cumulativeBallTravelXYM,
     firstBallSpeed:completed.initialBallSpeedMps,
     lastBallSpeed:completed.lastBallSpeedMps,
     finalBallGapM:completed.finalBallCentreToPlayerXYM,
     claimedPossession:false})+'\n');
  }finally{a.dispose();b.dispose();}
 }
});

test('M24 opponent-first: opponent clearance trace not a receiver, later touch excluded',
 {timeout:100000},async()=>{
 const R=await initializeRapier(wasm);
 const a=createControlledActionLab(R,'control',{controlScene:'opponent-first'});
 const b=createControlledActionLab(R,'control',{controlScene:'opponent-first'});
 try{
  let opponent=null;
  for(let tick=1;tick<=220;tick++){
   const f=a.step(),g=b.step(),c=f.contactContinuity;
   assert.deepEqual(c,g.contactContinuity);
   assert.equal(c.officialMatchAction,false);
   assert.equal(c.verifiedInterception,false);
   assert.equal(c.verifiedTackle,false);
   assert.equal(c.verifiedPossession,false);
   if(tick===91){
    assert.equal(c.active?.kind,'possible-opponent-pass-interruption');
    assert.equal(c.active?.actorId,'away-7');
    assert.equal(c.active?.onsetTick,91);
    opponent=c.active;
   }
   if(tick===150){
    assert.equal(c.latestCompleted?.kind,'possible-opponent-pass-interruption');
    assert.equal(c.latestCompleted?.observedTicks,60);
    assert.equal(c.latestCompleted?.verifiedInterception,false);
   }
   if(tick===204){
    assert.equal(f.decisionEvidence.current.actorId,'home-9');
    assert.equal(f.decisionEvidence.current.kind,'unclaimed-shoe-contact');
    assert.equal(c.completedCount,1);
    assert.equal(c.active,null);
    assert.equal(c.latestCompleted.actorId,'away-7');
   }
  }
  assert.equal(opponent?.onsetTick,91);
  assert.equal(a.snapshot().contactContinuity.completedCount,1);
  process.stdout.write('ME_628_M24_REAL_OPPONENT_FIRST '+
   JSON.stringify({opponentOnset:opponent.onsetTick,
    observedTicks:60,lateReceiverTick:204,
    falseReceivingTraces:0,claimedInterception:false})+'\n');
 }finally{a.dispose();b.dispose();}
});

test('M24 mirrored actual challenge has no invented control; no-contact remains empty',
 {timeout:50000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const a=createControlledActionLab(R,'challenge',{challengeSide:side});
  const b=createControlledActionLab(R,'challenge',{
   challengeSide:side,challengeScene:'no-contact'
  });
  try{
   for(let t=1;t<=75;t++){
    const physical=a.step(),noContact=b.step();
    assert.equal(physical.contactContinuity.active,null);
    assert.equal(physical.contactContinuity.completedCount,0);
    assert.equal(noContact.contactContinuity.active,null);
    assert.equal(noContact.contactContinuity.completedCount,0);
    assert.equal(noContact.contactContinuity.verifiedTackle,false);
    assert.equal(noContact.contactContinuity.verifiedPossession,false);
   }
  }finally{a.dispose();b.dispose();}
 }
});
