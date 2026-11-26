// #628 M25: physical first-touch A/B in original Rapier world only.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,BALL_RADIUS}
 from '../src/core.mjs';
import {createControlledActionLab as createCurrentActionLab} from '../src/action-labs.mjs';
 // Historical M/B evidence comparator only. Current gameplay uses the default.
 const createControlledActionLab=(R,id,options={})=>createCurrentActionLab(R,id,{
  ...options,historicalEvidenceBaseline:!['pass-pair','cross-pair','carry-solo','dribble-1v1','keeper-1v1','defender-1v1','overload-2v1','duel-2v2','duel-3v3'].includes(id)
 });

import {createPlayerMovement} from '../src/player-movement.mjs';
import {CONTROL_LAB_STARTS} from '../src/action-lab-scenarios.mjs';
import {calculateRealReceivingCushion,M25_CUSHION_MAX_IMPULSE_NS}
 from '../src/physical-receiving-cushion-m25.mjs';
const planar=v=>Math.hypot(v.x,v.y);
test('M25 pure impulse candidate is bounded; cannot self-authenticate contact',()=>{
 const c=calculateRealReceivingCushion({
  ballVelocity:{x:10,y:0,z:0},playerVelocity:{x:0,y:0},
  ballCentreZ:BALL_RADIUS,ballRadiusM:BALL_RADIUS,
  realBallPlayerGapM:0.3,nearestOpponentM:1.7
 });
 assert.ok(c);
 assert.ok(planar(c.impulseNs)<=M25_CUSHION_MAX_IMPULSE_NS+1e-9);
 assert.equal(c.impulseNs.z,0);
 assert.ok(c.impulseNs.x<0);
 assert.equal(c.underImmediatePressure,true);
 assert.equal(c.officialPossession,false);
 assert.equal(c.researchOnly,true);
 assert.equal(calculateRealReceivingCushion({
  ballVelocity:{x:11,y:0,z:0},playerVelocity:{x:0,y:0},
  ballCentreZ:BALL_RADIUS,ballRadiusM:BALL_RADIUS,
  realBallPlayerGapM:1.1,nearestOpponentM:2
 }),null);
 assert.throws(()=>calculateRealReceivingCushion({
  ballVelocity:{x:NaN,y:0,z:0},playerVelocity:{x:0,y:0},
  ballCentreZ:BALL_RADIUS,ballRadiusM:BALL_RADIUS,
  realBallPlayerGapM:0.2,nearestOpponentM:2
 }),TypeError);
});
test('M25 opt-in cannot leak to ordinary Match Engine or shared native body modes',
 {timeout:20000},async()=>{
 const R=await initializeRapier(wasm);
 const ball=CONTROL_LAB_STARTS.home;
 for(const opts of [
  {diagnosticResearchReceivingCushionEnabled:true},
  {diagnosticResearchReceivingCushionEnabled:true,
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true},
  {diagnosticResearchReceivingCushionEnabled:true,
   diagnosticResearchControlReceiver:true,
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true,
   diagnosticAutonomousCarryEnabled:true},
  {diagnosticResearchReceivingCushionEnabled:true,
   diagnosticResearchControlReceiver:true,
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true,
   diagnosticPlayerBodyCollidersEnabled:true,
   diagnosticSharedContactEventsEnabled:true}
 ])assert.throws(()=>createEngine(R,ball,opts),TypeError);
 const ordinary=createEngine(R,ball);
 try{
  assert.equal(ordinary.researchReceivingCushionSnapshot,undefined);
  assert.equal(ordinary.step().tick,1);
 }finally{ordinary.dispose();}
});
test('M25 real HOME/AWAY matched physical first-touch cushions the original ball',
 {timeout:100000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const base=createControlledActionLab(R,'control',{controlSide:side});
  const variant=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-cushion'
  });
  const replay=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-cushion'
  });
  let first=null;
  try{
   assert.equal(Object.hasOwn(base.snapshot(),'physicalFirstTouch'),false);
   assert.equal(variant.snapshot().physicalFirstTouch,null);
   for(let t=1;t<=100;t++){
    const original=base.step(),modified=variant.step(),again=replay.step();
    assert.deepEqual(modified,again,'M25 real full source must replay bit-for-bit');
    assert.equal(original.physicsTick,t);
    assert.equal(modified.physicsTick,t);
    assert.equal(modified.officialMatchPossession,false);
    assert.equal(modified.decisionEvidence.verifiedReception,false);
    assert.equal(modified.contactContinuity.verifiedBallControl,false);
    assert.equal(modified.contactContinuity.verifiedPossession,false);
    if(t<30)assert.deepEqual(modified.ball,original.ball,
     'experimental first touch must have zero pre-contact side effects');
    if(t===1){
     assert.equal(original.action?.action,'pass');
     assert.deepEqual(modified.action,original.action);
    }
    if(t===30){
     first=modified.physicalFirstTouch;
     assert.ok(first,'actual receiver must trigger the real physics attempt');
     assert.equal(first.tick,30);
     assert.equal(first.actorId,side+'-9');
     assert.equal(first.originalPassTick,1);
     assert.equal(first.actualPhysicsImpulseApplied,true);
     assert.equal(first.nativeExclusiveShoeStart,true);
     assert.equal(first.originalRapierBallBody,true);
     assert.equal(first.officialPossession,false);
     assert.equal(first.verifiedBallControl,false);
     assert.deepEqual(modified.starts,[side+'-9']);
     assert.deepEqual(original.starts,[side+'-9']);
     assert.ok(planar(first.impulseNs)<=M25_CUSHION_MAX_IMPULSE_NS+1e-9);
     assert.ok(planar(modified.ball.velocity)<
      planar(original.ball.velocity)-0.5,
      'actual world-bound first touch must decelerate the ball');
    }
   }
   assert.ok(first);
   const b=base.snapshot().contactContinuity.latestCompleted;
   const v=variant.snapshot().contactContinuity.latestCompleted;
   assert.ok(b&&v,'both actual receiving contacts need bounded observation');
   assert.equal(v.kind,'possible-post-pass-receiver-contact');
   assert.equal(v.verifiedBallControl,false);
   assert.equal(v.verifiedPossession,false);
   assert.equal(b.observedTicks,60);
   assert.ok(v.cumulativeBallTravelXYM<b.cumulativeBallTravelXYM,
    'same original scenario must reduce real observed post-contact travel');
   process.stdout.write('ME_628_M25_GENUINE_FIRST_TOUCH_'+side.toUpperCase()+' '+
    JSON.stringify({tick:first.tick,realOpponentGapM:first.measuredNearestOpponentM,
     originalTravelM:b.cumulativeBallTravelXYM,
     experimentalTravelM:v.cumulativeBallTravelXYM,
     exactPhysicalImpulseNs:first.impulseNs,
     possessionGranted:false})+'\n');
  }finally{base.dispose();variant.dispose();replay.dispose();}
 }
});
test('M25 genuine opponent-first shoe invalidates receiving impulse',
 {timeout:80000},async()=>{
 const R=await initializeRapier(wasm);
 const ball=CONTROL_LAB_STARTS.home;
 const physics=createEngine(R,ball,{
  diagnosticResearchControlReceiver:true,
  diagnosticResearchControlOpponentFirst:true,
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:true,
  diagnosticResearchReceivingCushionEnabled:true
 });
 const mover=createPlayerMovement({
  researchControlReceiver:true,researchControlBall:ball,
  researchControlOpponentFirst:true
 });
 let firstPass=null,opponent=null,late=null;
 try{
  for(let t=1;t<=215;t++){
   const f=mover.step(physics.snapshot().ball.position,firstPass);
   physics.step(f);
   const action=physics.uniformAutonomousActionSnapshot();
   if(action?.action==='pass'&&firstPass===null)firstPass=action;
   const touches=physics.footContactSnapshot().started;
   if(t===91)opponent=touches;
   if(t===204)late=touches;
   assert.equal(physics.researchReceivingCushionSnapshot(),null,
    'real earlier opponent START bars any later original pass cushioning');
  }
  assert.deepEqual(opponent,['away-7']);
  assert.deepEqual(late,['home-9']);
  assert.equal(firstPass.tick,1);
 }finally{physics.dispose();}
});
