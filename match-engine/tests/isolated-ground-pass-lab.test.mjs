import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {smallSidedSetup} from '../src/small-sided-lab-scenarios.mjs';

test('PASS-01 two teammates, 6/12/20m, original ground impulse and read-only receiving evidence',
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
   let count=0,frame;
   for(let tick=1;tick<=600;tick++){
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
    }
    assert.equal(frame.passPairAudit.officialPassCompleted,false);
    assert.equal(frame.passPairAudit.officialReception,false);
    if(frame.passPairAudit.receiverTick!==null)break;
   }
   assert.equal(count,1,'one native pass '+side+' '+variantIndex);
   const audit=frame.passPairAudit;
   assert.ok(audit.launchSpeedMps>0);
   assert.ok(Number.isFinite(audit.closestTargetGapM));
   if(audit.receiverTick!==null){
    assert.ok(audit.receiverTick>audit.passTick);
    assert.equal(frame.decisionEvidence.firstPossibleReception.playerId,receiver.id);
    assert.equal(frame.decisionEvidence.firstPossibleReception.realRapierShoeStart,true);
   }
   rows.push({side,variantIndex,distanceM:distance,...audit});
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_GROUND_PASS_PAIR '+JSON.stringify(rows)+'\n');
});
