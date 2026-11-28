import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {uniformSoloCarryAttributes} from '../src/solo-carry-attribute-calibration.mjs';
import {planNativeCarryTouch} from '../src/isolated-dribble-touches.mjs';
import {planNativeCarryPhaseImpulse} from '../src/solo-carry-phases.mjs';
import {chooseNativeFixedCarryImpulse}
 from '../src/native-fixed-carry-impulse.mjs';

test('#628 native fixed-phase touch requires authenticated source and pace',()=>{
 const actor={id:'home-10',team:'home',x:0,y:0,vx:2,vy:0};
 const valid={phase:'moderate',playerAttributes:uniformSoloCarryAttributes(50),
  player:actor,attackingSide:'home',ballVelocity:{x:1,y:0,z:0},
  verifiedNativeExclusiveShoeStart:true,contactActorId:actor.id};
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
  attackingSide:'away',contactActorId:'away-10',ballVelocity:{x:-1,y:0,z:0}});
 assert.ok(away.impulseNs.x<0);
 // Contact identity, not shirt number, authorizes the phase calculation.
 for(const shirt of [1,4,9,11]){
  const player={...actor,id:'home-'+shirt};
  const result=chooseNativeFixedCarryImpulse({...valid,player,contactActorId:player.id});
  assert.deepEqual(result,touch);
 }
 assert.throws(()=>chooseNativeFixedCarryImpulse({...valid,contactActorId:'away-10'}),/exclusive Rapier shoe/);
 assert.throws(()=>chooseNativeFixedCarryImpulse({...valid,player:{...actor,id:'home-99'},contactActorId:'home-99'}),/exclusive Rapier shoe/);
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
    outOfReachTicks=0,last=null,addedImpulseSumNs=0;
   const nativeActionTicks=[];
   const start=lab.snapshot().ball.position.x;
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
     nativeActionTicks.push(tick);
     addedImpulseSumNs+=Math.hypot(
      f.action.impulseNs.x,f.action.impulseNs.y,f.action.impulseNs.z);
    }else if(f.soloNativeFeet.exclusivePhysicalStart)skippedEvents++;
    if([120,300,600].includes(tick)){
     const observed=f.soloCarryMeasurements;
     const meanGapS=nativeActionTicks.length>1?
      (nativeActionTicks.at(-1)-nativeActionTicks[0])/
       (60*(nativeActionTicks.length-1)):null;
     const meanAddedNs=nativeActionTicks.length?
      addedImpulseSumNs/nativeActionTicks.length:null;
     assert.equal(observed.nativeConfirmedImpulseCount,actions);
     assert.equal(observed.appliedCarryImpulses,actions);
     assert.equal(observed.nativeRecent2sImpulseCount,
      nativeActionTicks.filter(t=>t>tick-120).length);
     assert.equal(observed.nativeMeanImpulseGapS,meanGapS);
     assert.ok(meanAddedNs===null?
      observed.nativeMeanAddedImpulseNs===null:
      Math.abs(observed.nativeMeanAddedImpulseNs-meanAddedNs)<1e-12);
     checkpoints.push({
      tick,gapM:gap,ballForwardM:(side==='home'?1:-1)*
       (f.ball.position.x-start),
      ballX:f.ball.position.x,actions,verifiedStarts,
      outOfReachTicks,realPeakGap,
      realNativeActionsLast2s:observed.nativeRecent2sImpulseCount,
      nativeMeanImpulseGapS:meanGapS,
      nativeMeanAddedImpulseNs:meanAddedNs
     });
    }
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
  assert.ok(p[0].maxAllowedSpeedMps<=p[1].maxAllowedSpeedMps&&
   p[1].maxAllowedSpeedMps<=p[2].maxAllowedSpeedMps&&
   p[2].maxAllowedSpeedMps<=p[3].maxAllowedSpeedMps,
    'Attribute-dependent allowed pace must be monotonic; observed speed is real evidence and may vary with collisions');
 }
 process.stdout.write('ME_628_NATIVE_RATING_MATRIX '+JSON.stringify(data)+'\\n');
});

test('#628 paired native fixed Sprint long-stride research 2/5/10s',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier),matrix=[];
 for(const rating of [50,90])
 for(const side of ['home','away'])
 for(const longStride of [false,true]){
  const lab=createControlledActionLab(R,'carry-solo',{
   shotSide:side,variantIndex:3,carryRunwayStart:true,
   nativeFixedCarryResearch:true,soloCarryLockedPhase:'sprint',
   nativeFixedSprintLongStride:longStride,
   soloCarryPlayerAttributes:uniformSoloCarryAttributes(rating)
  });
  try{
   let actions=0,starts=0,impulseSumNs=0,lostTicks=0;
   const actionTicks=[],checkpoints=[];
   const firstBallX=lab.snapshot().ball.position.x;
   for(let tick=1;tick<=600;tick++){
    const f=lab.step(),actor=f.observedMovementPlayers.find(p=>p.id===side+'-10');
    const gap=Math.hypot(f.ball.position.x-actor.x,f.ball.position.y-actor.y);
    if(gap>1.5)lostTicks++;
    starts+=f.soloNativeFeet.started.length;
    assert.equal(f.officialMatchPossession,false);
    assert.equal(f.soloCarryLockedPhase,'sprint');
    assert.equal(f.nativeFixedCarryResearch,true);
    if(f.action){
     assert.equal(f.action.action,'carry');
     assert.equal(f.action.nativeShoeContactVerified,true);
     assert.equal(f.action.nativeFixedPhaseCalibration.nativeFixedSprintLongStride,longStride);
     assert.equal(f.soloNativeFeet.exclusivePhysicalStart,true);
     assert.equal(f.action.actualPhysicsImpulseApplied,true);
     actions++;actionTicks.push(tick);
     impulseSumNs+=Math.hypot(
      f.action.impulseNs.x,f.action.impulseNs.y,f.action.impulseNs.z);
    }
    if([120,300,600].includes(tick)){
     const observed=f.soloCarryMeasurements;
     const meanImpulse=actions?impulseSumNs/actions:null;
     assert.equal(observed.nativeConfirmedImpulseCount,actions);
     assert.equal(observed.nativeRecent2sImpulseCount,
      actionTicks.filter(t=>t>tick-120).length);
     assert.ok(meanImpulse===null?
      observed.nativeMeanAddedImpulseNs===null:
      Math.abs(observed.nativeMeanAddedImpulseNs-meanImpulse)<1e-12);
     checkpoints.push({
      tick,actions,physicalStarts:starts,
      recent2sActions:observed.nativeRecent2sImpulseCount,
      meanAddedImpulseNs:meanImpulse,
      ballForwardM:(side==='home'?1:-1)*
       (f.ball.position.x-firstBallX),
      playerBallGapM:gap,lostTicks,
      peakGapM:observed.peakGapM,
      peakPlayerKmh:observed.peakPlayerSpeedMps*3.6,
      peakBallKmh:observed.peakBallSpeedMps*3.6,
      deadBall:f.refereeEvidence?.lastEvent?.kind??null
     });
    }
   }
   matrix.push({rating,side,longStride,checkpoints});
  }finally{lab.dispose();}
 }
 assert.equal(matrix.length,8);
 // DEV-only acceptance: real contacts and impulses must both be fewer,
 // stronger physical pushes must retain safe ball reach and forward progress.
 for(const rating of [50,90])for(const side of ['home','away']){
  const base=matrix.find(x=>x.rating===rating&&x.side===side&&!x.longStride);
  const tuned=matrix.find(x=>x.rating===rating&&x.side===side&&x.longStride);
  assert.ok(base&&tuned);
  const a=base.checkpoints,b=tuned.checkpoints;
  assert.ok(b[0].actions<=a[0].actions,'no opening Sprint touch burst');
  assert.ok(b[2].actions<a[2].actions,'fewer real 10s Carry impulses');
  assert.ok(b[2].physicalStarts<a[2].physicalStarts,
   'fewer genuine native physical shoe STARTs');
  assert.ok(b[2].meanAddedImpulseNs>a[2].meanAddedImpulseNs,
   'stronger additional native impulse');
  assert.equal(b[2].lostTicks,0,'no 1.5m lost-ball frames');
  assert.ok(b[2].peakGapM<1.5);
  assert.ok(b[2].ballForwardM>=a[2].ballForwardM);
  assert.ok(b[2].peakPlayerKmh>a[2].peakPlayerKmh);
  assert.equal(b[2].deadBall,null);
 }
 for(const row of matrix){
  assert.ok(row.checkpoints[2].physicalStarts>=row.checkpoints[2].actions);
  assert.ok(row.checkpoints[2].ballForwardM>=0);
 }
 process.stdout.write('ME_628_NATIVE_LONG_STRIDE_AB_10S '+
  JSON.stringify(matrix)+'\\n');
});

test('#628 Sprint long-stride physical 10s extra ratings and variants',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 for(const rating of [25,50,75,90])
 for(const side of ['home','away'])
 for(const variantIndex of [0,17,29]){
  const lab=createControlledActionLab(R,'carry-solo',{
   shotSide:side,variantIndex,carryRunwayStart:true,
   nativeFixedCarryResearch:true,soloCarryLockedPhase:'sprint',
   nativeFixedSprintLongStride:true,
   soloCarryPlayerAttributes:uniformSoloCarryAttributes(rating)
  });
  try{
   let actions=0,starts=0,lostTicks=0,frame=null;
   const startX=lab.snapshot().ball.position.x;
   for(let tick=1;tick<=600;tick++){
    frame=lab.step();
    const player=frame.observedMovementPlayers.find(p=>p.id===side+'-10');
    if(Math.hypot(frame.ball.position.x-player.x,frame.ball.position.y-player.y)>1.5)
     lostTicks++;
    starts+=frame.soloNativeFeet.started.length;
    if(frame.action){
     actions++;
     assert.equal(frame.action.nativeShoeContactVerified,true);
     assert.equal(frame.soloNativeFeet.exclusivePhysicalStart,true);
     assert.equal(frame.action.nativeFixedPhaseCalibration.nativeFixedSprintLongStride,true);
    }
    assert.equal(frame.officialMatchPossession,false);
   }
   rows.push({
    rating,side,variantIndex,actions,starts,lostTicks,
    peakGapM:frame.soloCarryMeasurements.peakGapM,
    peakPlayerKmh:frame.soloCarryMeasurements.peakPlayerSpeedMps*3.6,
    peakBallKmh:frame.soloCarryMeasurements.peakBallSpeedMps*3.6,
    nativeNonActionStarts:frame.nativeDribbleAudit.nativeShoeStartsWithoutCarryImpulse,
    nativeNonActionReasons:frame.nativeDribbleAudit.nonActionStartReasons,
    nativeHandoffReasons:frame.nativeDribbleAudit.unreleasedSingleFootEndStartKinds,
    forwardM:(side==='home'?1:-1)*(frame.ball.position.x-startX),
    deadBall:frame.refereeEvidence?.lastEvent?.kind??null
   });
  }finally{lab.dispose();}
 }
 assert.equal(rows.length,24);
 for(const row of rows){
  assert.ok(row.starts>=row.actions,'physical contacts must back actions');
  assert.ok(Number.isFinite(row.peakGapM));
 }
 // Research-only: a few combinations have many physical STARTs but very
 // few separate carry actions. Print negative evidence; never call this a
 // realistic all-seed improvement or activate it in the visible selector.
 const weak=rows.filter(row=>row.starts>=18&&row.actions<=7);
 const controls=[];
 for(const item of weak){
  const lab=createControlledActionLab(R,'carry-solo',{
   shotSide:item.side,variantIndex:item.variantIndex,
   carryRunwayStart:true,nativeFixedCarryResearch:true,
   soloCarryLockedPhase:'sprint',
   soloCarryPlayerAttributes:uniformSoloCarryAttributes(item.rating)
  });
  try{
   let frame;
   for(let tick=1;tick<=600;tick++)frame=lab.step();
   controls.push({
    rating:item.rating,side:item.side,variantIndex:item.variantIndex,
    baselineActions:frame.nativeDribbleAudit.appliedCarryActions,
    baselineShoeStarts:frame.nativeDribbleAudit.nativePhysicalShoeStarts,
    baselineNoActionStarts:frame.nativeDribbleAudit.nativeShoeStartsWithoutCarryImpulse,
    candidateActions:item.actions,candidateShoeStarts:item.starts,
    candidateNoActionStarts:item.nativeNonActionStarts
   });
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_NATIVE_LONG_STRIDE_EXTRA_VARIANTS '+
  JSON.stringify({rows,weakControls:controls})+'\\n');
});

test('#628 accepted native Sprint source recontact guard: 4 ratings x 4 starts x both sides',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 const critical=new Set([
  '25:29:home','25:29:away','50:3:home','50:3:away',
  '75:17:away','90:0:home','90:0:away'
 ]);
 for(const rating of [25,50,75,90])
 for(const side of ['home','away'])
 for(const variantIndex of [0,3,17,29]){
  const lab=createControlledActionLab(R,'carry-solo',{
   shotSide:side,variantIndex,carryRunwayStart:true,
   nativeFixedCarryResearch:true,soloCarryLockedPhase:'sprint',
   soloCarryPlayerAttributes:uniformSoloCarryAttributes(rating)
  });
  try{
   let frame=null,actions=0,starts=0,unreachable=0;
   const startX=lab.snapshot().ball.position.x;
   for(let tick=1;tick<=600;tick++){
    frame=lab.step();
    assert.equal(frame.soloNativeFeet.source,'rapier-physical-collider-events');
    assert.equal(frame.soloNativeFeet.independentColliders,2);
    assert.equal(frame.officialMatchPossession,false);
    starts+=frame.soloNativeFeet.started.length;
    const actor=frame.observedMovementPlayers.find(p=>p.id===side+'-10');
    if(Math.hypot(frame.ball.position.x-actor.x,
       frame.ball.position.y-actor.y)>1.5)unreachable++;
    if(frame.action){
     assert.equal(frame.action.action,'carry');
     assert.equal(frame.action.nativeShoeContactVerified,true);
     assert.equal(frame.soloNativeFeet.exclusivePhysicalStart,true);
     assert.equal(frame.action.actualPhysicsImpulseApplied,true);
     actions++;
    }
   }
   const a=frame.nativeDribbleAudit;
   assert.equal(a.nativePhysicalShoeStarts,starts);
   assert.equal(a.appliedCarryActions,actions);
   assert.equal(frame.soloCarryMeasurements.nativeConfirmedImpulseCount,actions);
   const row={
    rating,side,variantIndex,actions,starts,unreachable,
    unconverted:a.nativeShoeStartsWithoutCarryImpulse,
    simultaneous:a.nonActionStartReasons.simultaneousFootStarts,
    otherShoeActive:a.nonActionStartReasons.otherFootAlreadyActive,
    oppositeSameTickHandoffs:
     a.unreleasedSingleFootEndStartKinds.oppositeFootEndStartSameTick,
    peakGapM:frame.soloCarryMeasurements.peakGapM,
    ballForwardM:(side==='home'?1:-1)*(frame.ball.position.x-startX)
   };
   rows.push(row);
   if(critical.has(rating+':'+variantIndex+':'+side)){
    assert.ok(actions>=10,'native baseline must preserve independent Carry touches');
    assert.ok(starts<=17,'no explosion of real two-shoe STARTs');
    assert.ok(row.unconverted<=2,'no conversion collapse from shoe overlap');
    assert.equal(row.oppositeSameTickHandoffs,0,
     'do not regress accepted full-release handoffs');
    assert.equal(row.simultaneous,0,'no overlapping simultaneous shoe START');
    assert.equal(unreachable,0,'original ball stays physically reachable');
    assert.ok(row.peakGapM<1.5);
    assert.ok(row.ballForwardM>30);
   }
  }finally{lab.dispose();}
 }
 assert.equal(rows.length,32);
 process.stdout.write('ME_628_ACCEPTED_NATIVE_SPRINT_RELEASE_GUARD '+
  JSON.stringify(rows)+'\\n');
});


test('#628 native active-shoe release on full 32-seed paired 10s Rapier matrix',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 for(const rating of [25,50,75,90])
 for(const variantIndex of [0,3,17,29])
 for(const side of ['home','away']){
  const arms=[];
  for(const releaseM of [0,0.06]){
   const lab=createControlledActionLab(R,'carry-solo',{
    shotSide:side,variantIndex,carryRunwayStart:true,
    nativeFixedCarryResearch:true,soloCarryLockedPhase:'sprint',
    soloSprintActiveFootReleaseM:releaseM,
    soloCarryPlayerAttributes:uniformSoloCarryAttributes(rating)
   });
   try{
    let frame=null,starts=0,actions=0,lostTicks=0;
    const startX=lab.snapshot().ball.position.x,checkpoints=[];
    for(let tick=1;tick<=600;tick++){
     frame=lab.step();
     const shoes=frame.soloNativeFeet;
     assert.equal(shoes.source,'rapier-physical-collider-events');
     assert.equal(shoes.independentColliders,2);
     assert.equal(shoes.sprintActiveFootReleaseM,releaseM);
     assert.equal(frame.officialMatchPossession,false);
     starts+=shoes.started.length;
     const p=frame.observedMovementPlayers.find(x=>x.id===side+'-10');
     if(Math.hypot(frame.ball.position.x-p.x,
       frame.ball.position.y-p.y)>1.5)lostTicks++;
     if(frame.action){
      actions++;
      assert.equal(frame.action.action,'carry');
      assert.equal(frame.action.nativeShoeContactVerified,true);
      assert.equal(frame.action.actualPhysicsImpulseApplied,true);
      assert.equal(shoes.exclusivePhysicalStart,true);
     }
     if([120,300,600].includes(tick)){
      const a=frame.nativeDribbleAudit;
      assert.equal(a.nativePhysicalShoeStarts,starts);
      assert.equal(a.appliedCarryActions,actions);
      checkpoints.push({
       tick,starts,actions,lostTicks,
       unconverted:a.nativeShoeStartsWithoutCarryImpulse,
       handoffs:a.unreleasedSingleFootEndStartKinds.oppositeFootEndStartSameTick,
       overlaps:a.nonActionStartReasons.otherFootAlreadyActive,
       simultaneous:a.nonActionStartReasons.simultaneousFootStarts,
       bothActiveTicks:a.nativeBothFeetActiveTicks,
       fullReleases:a.nativeActorFullReleaseEvents,
       realContactReleases:a.nativeActorStartsAfterFullRelease,
       forwardM:(side==='home'?1:-1)*(frame.ball.position.x-startX),
       peakGapM:frame.soloCarryMeasurements.peakGapM,
       peakPlayerKmh:frame.soloCarryMeasurements.peakPlayerSpeedMps*3.6,
       peakBallKmh:frame.soloCarryMeasurements.peakBallSpeedMps*3.6
      });
     }
    }
    arms.push({releaseM,checkpoints});
   }finally{lab.dispose();}
  }
  assert.equal(arms.length,2);
  // Keep all negative evidence; no auto-approval just because both arms ran.
  for(const a of arms){
   const v=a.checkpoints[2];
   assert.ok(v.starts>=v.actions);
   assert.ok(Number.isFinite(v.forwardM)&&Number.isFinite(v.peakGapM));
  }
  rows.push({rating,variantIndex,side,baseline:arms[0].checkpoints,
   release6cm:arms[1].checkpoints});
 }
 assert.equal(rows.length,32);
 // All paired simulations must preserve valid native Carry impulses,
 // remove—not merely reclassify—false STARTs, and keep the real ball
 // physically reachable. A green test alone must not hide poor arms.
 let removedUnconverted=0,removedHandoffs=0;
 for(const row of rows){
  const old=row.baseline[2],tuned=row.release6cm[2];
  const key=`${row.rating}/V${row.variantIndex+1}/${row.side}`;
  assert.equal(tuned.lostTicks,0,key+' original ball out of reach');
  assert.ok(tuned.peakGapM<1.5,key+' lost physical contact');
  assert.ok(tuned.actions>=old.actions,key+' applied actions regressed');
  assert.ok(tuned.starts<=old.starts+1,key+' more spurious native STARTs');
  assert.ok(tuned.unconverted<=old.unconverted,key+' unconverted STARTs rose');
  assert.ok(tuned.handoffs<=old.handoffs,key+' same-tick shoe handoff regressed');
  assert.ok(tuned.bothActiveTicks<=old.bothActiveTicks,
   key+' two-shoe overlap increased');
  assert.ok(tuned.forwardM>=old.forwardM-0.15,
   key+' original Rapier ball progress regressed');
  assert.ok(tuned.fullReleases>=tuned.actions-2,
   key+' applied actions lack true actor full-release episodes');
  removedUnconverted+=old.unconverted-tuned.unconverted;
  removedHandoffs+=old.handoffs-tuned.handoffs;
  if(row.rating===75&&row.variantIndex===0){
   assert.ok(tuned.actions>=old.actions+4,
    key+' historical genuine Carry collapse not fixed');
   assert.equal(tuned.unconverted,0,key+' old false contacts remain');
   assert.equal(tuned.bothActiveTicks,0,key+' both shoes still overlap');
  }
 }
 assert.ok(removedUnconverted>=20,'no material reduction in native non-action STARTs');
 assert.ok(removedHandoffs>=10,'no material reduction in same-tick handoffs');
 process.stdout.write('ME_628_NATIVE_ACTIVE_RELEASE_FULL_32_AB '+
  JSON.stringify(rows)+'\\n');
});

test('#628 adaptive Sprint pursuit A/B 32 seeded physical source episodes',
 {timeout:180000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 for(const rating of [25,50,75,90])
 for(const variantIndex of [0,3,17,29])
 for(const side of ['home','away']){
  const arms=[];
  for(const adaptive of [false,true]){
   const lab=createControlledActionLab(R,'carry-solo',{
    shotSide:side,variantIndex,carryRunwayStart:true,
    nativeFixedCarryResearch:true,soloCarryLockedPhase:'sprint',
    soloSprintActiveFootReleaseM:0.06,
    soloSprintPursuitLeadM:adaptive?0.25:0,
    
    soloCarryPlayerAttributes:uniformSoloCarryAttributes(rating)
   });
   try{
    let frame=null,actions=0,starts=0,lost=0;
    const firstX=lab.snapshot().ball.position.x,checkpoints=[];
    for(let tick=1;tick<=600;tick++){
     frame=lab.step();
     starts+=frame.soloNativeFeet.started.length;
     const p=frame.observedMovementPlayers.find(x=>x.id===side+'-10');
     if(Math.hypot(frame.ball.position.x-p.x,
       frame.ball.position.y-p.y)>1.5)lost++;
     assert.equal(frame.soloNativeFeet.source,'rapier-physical-collider-events');
     assert.equal(frame.officialMatchPossession,false);
     if(frame.action){
      actions++;
      assert.equal(frame.action.nativeShoeContactVerified,true);
      assert.equal(frame.soloNativeFeet.exclusivePhysicalStart,true);
      assert.equal(frame.action.actualPhysicsImpulseApplied,true);
     }
     if([120,300,600].includes(tick)){
      const a=frame.nativeDribbleAudit,m=frame.soloCarryMeasurements;
      assert.equal(a.nativePhysicalShoeStarts,starts);
      assert.equal(a.appliedCarryActions,actions);
      checkpoints.push({
       tick,actions,starts,lost,
       unconverted:a.nativeShoeStartsWithoutCarryImpulse,
       handoffs:a.unreleasedSingleFootEndStartKinds.oppositeFootEndStartSameTick,
       overlap:a.nativeBothFeetActiveTicks,
       releases:a.nativeActorFullReleaseEvents,
       peakGapM:m.peakGapM,
       meanGapM:m.meanGapM,
       forwardM:(side==='home'?1:-1)*(frame.ball.position.x-firstX),
       peakPlayerKmh:m.peakPlayerSpeedMps*3.6,
       lateKmh:m.lateMeanSpeedMps*3.6,
       meanImpulseGapS:m.nativeMeanImpulseGapS
      });
     }
    }
    arms.push({adaptive,checkpoints});
   }finally{lab.dispose();}
  }
  rows.push({rating,variantIndex,side,baseline:arms[0].checkpoints,
   adaptive:arms[1].checkpoints});
 }
 assert.equal(rows.length,32);
 // This is an acceptance gate, not just a printed A/B. All actions must
 // remain authenticated original Rapier START impulses and the football
 // cannot be lost. Limit native contacts to avoid a step-by-step tap burst.
 for(const r of rows){
  const a=r.baseline[2],b=r.adaptive[2];
  const context=`${r.rating}/V${r.variantIndex+1}/${r.side}`;
  assert.ok(a.starts>=a.actions&&b.starts>=b.actions,context+' source only');
  assert.equal(b.lost,0,context+' lost original ball');
  assert.ok(b.peakGapM<1.5,context+' lost-ball gap');
  assert.equal(b.handoffs,0,context+' ambiguous same-tick shoe handoff');
  assert.ok(b.unconverted<=a.unconverted+1,context+' nonaction START increase');
  assert.ok(b.overlap<=a.overlap+1,context+' physical two-shoe overlap increase');
  assert.ok(b.actions>=a.actions&&b.actions<=18&&b.actions<=a.actions+4,
   context+' uncontrolled touch cadence');
  assert.ok(b.starts<=a.starts+4,context+' repeated shoe collision burst');
  assert.ok(b.peakPlayerKmh>=a.peakPlayerKmh+0.6,
   context+' no physical acceleration improvement');
  assert.ok(b.forwardM>=a.forwardM+1,
   context+' original ball forward progress did not improve');
  assert.ok(b.meanImpulseGapS>=0.5,
   context+' native Carry touches too frequent');
 }
 process.stdout.write('ME_628_NATIVE_ADAPTIVE_PURSUIT_FULL32_AB '+
  JSON.stringify(rows)+'\\n');
});

test('ME-01-QA U-01B: same selected open carry phase has the same physical impulse proposal',()=>{
 const inputs=[['control',0.6,0.2,0.30],['moderate',2,1.2,0.42],['sprint',4,2.4,0.60]];
 for(const attackingSide of ['home','away'])for(const [phase,speed,rolling,gap] of inputs){
  const dir=attackingSide==='home'?1:-1;
  const actor={id:attackingSide+'-10',team:attackingSide,x:dir*10,y:0,vx:dir*speed,vy:0};
  const ballPosition={x:actor.x+dir*gap,y:0,z:0.11},ballVelocity={x:dir*rolling,y:0,z:0};
  const base={phase,player:actor,attackingSide,ballVelocity};
  const locked=chooseNativeFixedCarryImpulse({...base,playerAttributes:uniformSoloCarryAttributes(50),
   verifiedNativeExclusiveShoeStart:true,contactActorId:actor.id});
  const auto=planNativeCarryTouch({attacker:actor,attackingSide,ballPosition,ballVelocity});
  assert.equal(auto.carryPhase,phase);
  assert.deepEqual(auto.phaseProposal.impulseNs,locked.impulseNs);
  assert.equal(auto.magnitudeNs,Math.abs(locked.impulseNs.x));
  assert.equal(auto.dx,locked.impulseNs.x);
  assert.equal(auto.genuineRapierShoeStartRequired,true);
  assert.equal(auto.officialPossession,false);
  const reversed=planNativeCarryPhaseImpulse({...base,player:{...actor,x:-actor.x,vx:-actor.vx},
   ballVelocity:{...ballVelocity,x:-ballVelocity.x},attackPolarity:-1});
  assert.equal(reversed.impulseNs.x,-locked.impulseNs.x);
  assert.equal(planNativeCarryPhaseImpulse({...base,ballVelocity:{x:dir*10,y:0,z:0}}).impulseNs,null);
  assert.throws(()=>chooseNativeFixedCarryImpulse({...base,playerAttributes:uniformSoloCarryAttributes(50),
   verifiedNativeExclusiveShoeStart:false,contactActorId:actor.id}),/exclusive Rapier shoe/);
 }
});
