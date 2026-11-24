import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {smallSidedSetup} from '../src/small-sided-lab-scenarios.mjs';

test('PASS-01 two teammates, 6/12/20m, distance-calibrated native ground impulse and receiving-contact gate',
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
     assert.ok(calibration.scale>=1&&calibration.scale<=1.85);
     assert.equal(calibration.officialMatchAction,false);
     assert.equal(frame.action.impulseNs.x,calibration.originalImpulseNs.x*calibration.scale);
     assert.equal(frame.action.impulseNs.y,calibration.originalImpulseNs.y*calibration.scale);
     assert.ok(Math.abs(Math.hypot(calibration.originalImpulseNs.x,calibration.originalImpulseNs.y)-2.4)<1e-8);
     if(distance<7)assert.ok(calibration.scale<1.02);
     else if(distance<13)assert.ok(calibration.scale>1.3&&calibration.scale<1.5);
     else assert.ok(calibration.scale>1.6);
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
     assert.equal(contact.postSolverSpeedMps,Math.hypot(
      frame.ball.velocity.x,frame.ball.velocity.y));
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
 }
});
