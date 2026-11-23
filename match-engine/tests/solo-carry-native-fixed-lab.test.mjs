import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {uniformSoloCarryAttributes} from '../src/solo-carry-attribute-calibration.mjs';
import {chooseNativeFixedCarryImpulse}
 from '../src/native-fixed-carry-impulse.mjs';

test('#628 native fixed-phase touch requires authenticated source and pace',()=>{
 const actor={id:'home-10',team:'home',x:0,y:0,vx:2,vy:0};
 const valid={phase:'moderate',playerAttributes:uniformSoloCarryAttributes(50),
  player:actor,attackingSide:'home',ballVelocity:{x:1,y:0,z:0},
  verifiedNativeExclusiveShoeStart:true};
 const touch=chooseNativeFixedCarryImpulse(valid);
 assert.equal(touch.nativeShoeContactVerified,true);
 assert.equal(touch.originalRapierBall,true);
 assert.ok(touch.impulseNs.x>0);
 assert.ok(touch.controlledTargetSpeedMps<touch.calibratedTargetSpeedMps);
 assert.equal(touch.impulseNs.y,0);
 assert.equal(touch.impulseNs.z,0);
 assert.equal(touch.officialPossession,false);
 assert.equal(chooseNativeFixedCarryImpulse({...valid,ballVelocity:{x:10,y:0,z:0}})
  .impulseNs,null,'Ball already faster than running shoe needs no extra action');
 assert.throws(()=>chooseNativeFixedCarryImpulse({
  ...valid,verifiedNativeExclusiveShoeStart:false
 }),/exclusive Rapier shoe/);
 assert.throws(()=>chooseNativeFixedCarryImpulse({
  ...valid,player:{...actor,id:'home-9'}
 }),/exclusive Rapier shoe/);
 const away=chooseNativeFixedCarryImpulse({...valid,
  player:{...actor,id:'away-10',team:'away',vx:-2},
  attackingSide:'away',ballVelocity:{x:-1,y:0,z:0}});
 assert.ok(away.impulseNs.x<0);
});

test('#628 real 10s native locked phases remain contact-authenticated and separate from intent',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier),matrix=[];
 for(const phase of ['control','moderate','sprint'])
 for(const side of ['home','away']){
  const lab=createControlledActionLab(R,'carry-solo',{
   shotSide:side,variantIndex:3,carryRunwayStart:true,
   nativeFixedCarryResearch:true,soloCarryLockedPhase:phase,
   soloCarryPlayerAttributes:uniformSoloCarryAttributes(50)
  });
  try{
   let actions=0,verifiedStarts=0,skippedEvents=0,realPeakGap=0,
    outOfReachTicks=0,last=null;const start=lab.snapshot().ball.position.x;
   const checkpoints=[];
   for(let tick=1;tick<=600;tick++){
    const f=lab.step();last=f;
    assert.equal(f.nativeFixedCarryResearch,true);
    assert.equal(f.intentDrivenCarry,undefined);
    assert.equal(f.soloCarryPhase.phase,phase);
    assert.equal(f.soloCarryMeasurements.samples,tick);
    assert.equal(f.officialMatchPossession,false);
    assert.equal(f.soloCarryLockedPhase,phase);
    assert.equal(f.soloNativeFeet.independentColliders,2);
    assert.equal(f.soloNativeFeet.source,'rapier-physical-collider-events');
    const a=f.observedMovementPlayers.find(p=>p.id===side+'-10');
    const gap=Math.hypot(f.ball.position.x-a.x,
     f.ball.position.y-a.y);
    realPeakGap=Math.max(realPeakGap,gap);
    if(gap>1.5)outOfReachTicks++;
    if(f.soloNativeFeet.started.length)verifiedStarts+=
      f.soloNativeFeet.started.length;
    if(f.action){
     assert.equal(f.action.action,'carry');
     assert.equal(f.action.nativeShoeContactVerified,true);
     assert.equal(f.action.physicalTrigger,'same-tick-real-rapier-shoe-start');
     assert.equal(f.soloNativeFeet.exclusivePhysicalStart,true);
     assert.equal(f.nativeRealShoeStartThisTick,true);
     assert.equal(f.action.appliedByRapier,true);
     assert.equal(f.action.actualPhysicsImpulseApplied,true);
     assert.ok(f.action.nativeFixedPhaseCalibration);
     actions++;
    }else if(f.soloNativeFeet.exclusivePhysicalStart)skippedEvents++;
    if([120,300,600].includes(tick))checkpoints.push({
     tick,gapM:gap,ballForwardM:(side==='home'?1:-1)*
       (f.ball.position.x-start),
     ballX:f.ball.position.x,actions,verifiedStarts,
     outOfReachTicks,realPeakGap
    });
   }
   // A phase can genuinely MISS every shoe contact: record failure as
   // physical evidence, never invent one to satisfy the experiment.
   assert.ok(verifiedStarts>=actions,
    'No action can outnumber genuine physics-sourced foot STARTs');
   assert.ok(checkpoints[0].ballForwardM>=0);
   assert.ok(Number.isFinite(checkpoints[2].gapM));
   matrix.push({phase,side,checkpoints,actions,verifiedStarts,
    skippedEvents,peakPlayerSpeedMps:last.soloCarryMeasurements.peakPlayerSpeedMps,
    peakBallSpeedMps:last.soloCarryMeasurements.peakBallSpeedMps});
  }finally{lab.dispose();}
 }
 assert.equal(matrix.length,6);
 process.stdout.write('ME_628_FIXED_NATIVE_10S_MATRIX '+JSON.stringify(matrix)+'\\n');
 assert.ok(matrix.some(v=>v.verifiedStarts>0),
  'At least one physical contact source must be observed across the matrix');
});

test('#628 native 25/50/75/90 player pace matrix is real physical source, not intention',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier),data=[];
 for(const rating of [25,50,75,90])
 for(const phase of ['control','moderate','sprint']){
  const lab=createControlledActionLab(R,'carry-solo',{
   shotSide:'home',variantIndex:3,carryRunwayStart:true,
   nativeFixedCarryResearch:true,soloCarryLockedPhase:phase,
   soloCarryPlayerAttributes:uniformSoloCarryAttributes(rating)
  });
  try{
   let f=null,actions=0;
   for(let tick=1;tick<=120;tick++){
    f=lab.step();
    if(f.action?.action==='carry'){
     assert.equal(f.action.nativeShoeContactVerified,true);
     actions++;
    }
   }
   data.push({rating,phase,actions,
    maxAllowedSpeedMps:f.soloCarryPhase.maxSpeedMps,
    peakPlayerSpeedMps:f.soloCarryMeasurements.peakPlayerSpeedMps,
    peakBallSpeedMps:f.soloCarryMeasurements.peakBallSpeedMps,
    gapM:f.soloCarryPhase.ballGapM,
    ballForwardM:f.soloCarryMeasurements.ballForwardM});
  }finally{lab.dispose()}
 }
 assert.equal(data.length,12);
 for(const phase of ['control','moderate','sprint']){
  const p=data.filter(v=>v.phase===phase);
  assert.ok(p[0].maxAllowedSpeedMps<p[1].maxAllowedSpeedMps&&
   p[1].maxAllowedSpeedMps<p[2].maxAllowedSpeedMps&&
   p[2].maxAllowedSpeedMps<=p[3].maxAllowedSpeedMps,
    'Attribute-dependent allowed pace must be monotonic; observed speed is real evidence and may vary with collisions');
 }
 process.stdout.write('ME_628_NATIVE_RATING_MATRIX '+JSON.stringify(data)+'\\n');
});
