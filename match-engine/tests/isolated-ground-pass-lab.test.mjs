import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {smallSidedSetup} from '../src/small-sided-lab-scenarios.mjs';

test('PASS-01 two teammates, 6/12/20m, faster distance-calibrated native ground impulse and bounded first-touch reception',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 assert.throws(()=>createControlledActionLab(R,'pass-pair',{bodyGuardEnabled:true}),TypeError);
 for(const side of ['home','away'])for(const variantIndex of [0,1,2,9,10,11,27,28,29]){
  const lab=createControlledActionLab(R,'pass-pair',{shotSide:side,variantIndex});
  try{
   const setup=smallSidedSetup('pass-pair',side,INITIAL_PLAYERS,{variantIndex});
   const receiver=setup.staged.find(p=>p.id===side+'-9');
   assert.equal(lab.snapshot().genuinePhysicalPlayerCount,2);
   assert.deepEqual(lab.focus,[side+'-9',side+'-10']);
   const distance=Math.hypot(receiver.x-setup.ball.x,receiver.y-setup.ball.y);
   assert.ok(Math.abs(distance-[6,12,20][variantIndex%3])<1e-8);
   let count=0,frame=lab.snapshot();
   for(let tick=1;tick<=660;tick++){
    if(tick>600&&frame.passPairAudit.receiverTick===null)break;
    const previous=frame;
    frame=lab.step();
    assert.equal(frame.physicsTick,tick);
    assert.ok(frame.starts.every(id=>lab.focus.includes(id)));
    assert.equal(frame.officialMatchPossession,false);
    assert.equal(frame.officialMatchResult,null);
    const observed=frame.observedMovementPlayers.find(p=>p.id===receiver.id);
    assert.ok(Math.hypot(observed.x-receiver.x,observed.y-receiver.y)<1e-7);
    if(frame.action){
     count++;
     assert.equal(frame.action.action,'pass');
     assert.equal(frame.action.playerId,side+'-10');
     assert.equal(frame.action.passTarget.recipientId,side+'-9');
     assert.deepEqual(frame.starts,[side+'-10']);
     assert.equal(frame.action.actualPhysicsImpulseApplied,true);
     assert.equal(frame.action.impulseNs.z,0);
     const calibration=frame.action.isolatedGroundPassCalibration;
     assert.equal(calibration.source,'isolated-ground-pass-distance-candidate-v3');
     assert.ok(calibration.scale>=1.25&&calibration.scale<=3.30);
     assert.equal(calibration.officialMatchAction,false);
     assert.equal(frame.action.impulseNs.x,calibration.originalImpulseNs.x*calibration.scale);
     assert.equal(frame.action.impulseNs.y,calibration.originalImpulseNs.y*calibration.scale);
     assert.ok(Math.abs(Math.hypot(calibration.originalImpulseNs.x,calibration.originalImpulseNs.y)-2.4)<1e-8);
     assert.ok(Math.abs(calibration.scale-[1.85,2.45,3.25][variantIndex%3])<0.02);
    }
    assert.equal(frame.passPairAudit.officialPassCompleted,false);
    assert.equal(frame.passPairAudit.officialReception,false);
    const audit=frame.passPairAudit;
    if(audit.receiverTick===tick){
     const contact=audit.receivingContact;
     assert.equal(contact.receiverId,receiver.id);
     assert.equal(contact.priorSampleTick,tick-1);
     assert.equal(contact.contactTick,tick);
     assert.equal(contact.priorSampleSpeedMps,Math.hypot(
      previous.ball.velocity.x,previous.ball.velocity.y));
     assert.equal(contact.postContactSpeedMps,Math.hypot(
      frame.ball.velocity.x,frame.ball.velocity.y));
     const cushion=contact.cushion;
     if(cushion){
      assert.equal(contact.mode,'active-cushion');
      assert.equal(cushion.actorId,receiver.id);
      assert.equal(cushion.tick,tick);
      assert.equal(cushion.originalPassTick,audit.passTick);
      assert.equal(cushion.nativeExclusiveShoeStart,true);
      assert.equal(cushion.actualPhysicsImpulseApplied,true);
      assert.equal(cushion.officialPossession,false);
      assert.equal(cushion.noActiveOpponents,true);
      assert.equal(cushion.measuredNearestOpponentM,null);
      assert.equal(cushion.impulseNs.z,0);
      const magnitude=Math.hypot(cushion.impulseNs.x,cushion.impulseNs.y);
      assert.ok(magnitude<=2.7+1e-9);
      assert.equal(cushion.residualTargetMps,0.50);
      const baseMagnitude=Math.hypot(cushion.originalM25ImpulseNs.x,cushion.originalM25ImpulseNs.y);
      assert.ok(magnitude>=baseMagnitude-1e-9);
      assert.ok(Math.abs(magnitude-Math.min(2.7,
       Math.max(baseMagnitude,0.43*(cushion.actualRelativeSpeedMps-0.50))))<1e-6);
      assert.ok(cushion.impulseNs.x*cushion.originalM25ImpulseNs.x+
       cushion.impulseNs.y*cushion.originalM25ImpulseNs.y>0);
      assert.equal(contact.postSolverSpeedMps,Math.hypot(
       cushion.realPreBallVelocity.x,cushion.realPreBallVelocity.y));
      // A stationary receiver's relative velocity must use vx/vy,
      // never its absolute field coordinates x/y. Check the actual
      // opposing impulse vector as well as the native speed reduction.
      const relativeX=cushion.realPreBallVelocity.x-observed.vx;
      const relativeY=cushion.realPreBallVelocity.y-observed.vy;
      assert.ok(Math.abs(cushion.actualRelativeSpeedMps-
       Math.hypot(relativeX,relativeY))<1e-9);
      assert.ok(cushion.impulseNs.x*relativeX+cushion.impulseNs.y*relativeY<0);
      assert.ok(contact.postContactSpeedMps<contact.postSolverSpeedMps,
       JSON.stringify({side,variantIndex,contact}));
      // All receivers are stationary. A first touch must not reverse
      // the post-solver velocity or fake a stop by assigning velocity.
      assert.ok(cushion.realPostBallVelocity.x*cushion.realPreBallVelocity.x+
       cushion.realPostBallVelocity.y*cushion.realPreBallVelocity.y>=-1e-7);
      assert.equal(contact.postContactSpeedMps,Math.hypot(
       cushion.realPostBallVelocity.x,cushion.realPostBallVelocity.y));
     }else{
      assert.equal(contact.mode,'passive-contact');
      assert.equal(contact.postSolverSpeedMps,contact.postContactSpeedMps);
     }
     assert.equal(contact.realRapierShoeStart,true);
     assert.equal(contact.officialReception,false);
     assert.ok(Object.isFrozen(contact));
    }
    if(audit.receiverFollowThrough?.completed){
     assert.equal(tick,audit.receiverTick+60);
     assert.equal(audit.receiverFollowThrough.samples,61);
     assert.equal(audit.receiverFollowThrough.atHalfSecond.tick,audit.receiverTick+30);
     assert.equal(audit.receiverFollowThrough.atOneSecond.tick,tick);
     assert.equal(audit.receiverFollowThrough.atOneSecond.speedMps,
      Math.hypot(frame.ball.velocity.x,frame.ball.velocity.y));
     assert.equal(audit.receiverFollowThrough.atOneSecond.gapM,
      Math.hypot(frame.ball.position.x-receiver.x,frame.ball.position.y-receiver.y));
     assert.equal(audit.receiverFollowThrough.officialReception,false);
     break;
    }
   }
   assert.equal(count,1,'one native pass '+side+' '+variantIndex);
   const audit=frame.passPairAudit;
   assert.ok(audit.launchSpeedMps>0);
   assert.ok(Number.isFinite(audit.closestTargetGapM));
   rows.push({side,variantIndex,distanceM:distance,...audit});
   if(audit.receiverTick!==null){
    assert.ok(audit.receiverTick>audit.passTick);
    assert.equal(frame.decisionEvidence.firstPossibleReception.playerId,receiver.id);
    assert.equal(frame.decisionEvidence.firstPossibleReception.realRapierShoeStart,true);
   }
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_GROUND_PASS_PAIR '+JSON.stringify(rows)+'\n');
 // Report the complete matrix even if an experimental candidate misses.
 // Contact is not controlled reception; no official outcome is inferred.
 assert.equal(rows.length,18);
 for(const row of rows){
  assert.notEqual(row.receiverTick,null,
   'Missing authentic receiver START: '+JSON.stringify(row));
  assert.ok(row.flightTimeS>0&&row.flightTimeS<=10);
  assert.ok(row.receivingContact.priorSampleSpeedMps>0);
  assert.ok(Number.isFinite(row.receivingContact.postSolverSpeedMps));
  assert.equal(row.receiverFollowThrough.completed,true);
  // Provisional physical control envelope, not official possession.
  assert.ok(row.receiverFollowThrough.atOneSecond.gapM<=0.85,JSON.stringify(row));
  assert.ok(row.receiverFollowThrough.atOneSecond.speedMps<=0.30,JSON.stringify(row));
  assert.ok(row.peakGroundClearanceM<0.10,JSON.stringify(row));
  // Owner visual QA: all three distances must be meaningfully faster,
  // including 6m. The existing control/ground envelope above is retained.
  const maxTime=row.distanceM<7?1.0:row.distanceM<13?1.6:2.3;
  assert.ok(row.flightTimeS<=maxTime,JSON.stringify(row));
  const minLaunch=row.distanceM<7?9:row.distanceM<13?12:16;
  assert.ok(row.launchSpeedMps>=minLaunch,JSON.stringify(row));
  if(row.receivingContact.postSolverSpeedMps>1.15)
   assert.equal(row.receivingContact.mode,'active-cushion',JSON.stringify(row));
 }
 assert.ok(rows.some(row=>row.receivingContact.mode==='active-cushion'),
  'Harder passes must exercise the authentic M25 first-touch path');
});
