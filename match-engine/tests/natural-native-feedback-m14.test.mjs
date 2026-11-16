// #628 M14: original-ball territory and multi-native-contact admission gate.
// Count ONLY collision STARTs from original same-world Rapier queue; absence
// of concurrent contact is reported, never created for test convenience.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine} from '../src/core.mjs';
import {createPlayerMovement,PLAYER_MIN_SEPARATION_M,
 PLAYER_MAX_SPEED_MPS,INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {M11_BALL_STARTS} from '../src/unstaged-body-contact-audit.mjs';
import {advanceFreePlayerKinematics} from '../src/individual-kinematics.mjs';
import {auditNaturalNativeFeedback,auditNaturalNativeFeedbackMatrix}
 from '../src/natural-native-feedback-audit-m14.mjs';

test('M14 pitch-edge actual velocity equals real clipped XY displacement on both axes',()=>{
 const limits={dt:1/60,maxSpeed:PLAYER_MAX_SPEED_MPS,
  acceleration:9,braking:12,turnRate:6,maxX:52.06,maxY:33.56};
 const p0={x:0,y:0,vx:0,vy:0};
 const control=advanceFreePlayerKinematics(p0,{x:20,y:0},limits);
 assert.ok(control.vx>0);
 assert.ok(Math.abs(control.x-p0.x-control.vx*limits.dt)<1e-12);
 for(const [player,target] of [
  [{x:limits.maxX-0.02,y:1,vx:5,vy:0},
   {x:limits.maxX+9,y:1}],
  [{x:-limits.maxX+0.01,y:-1,vx:-5,vy:0},
   {x:-limits.maxX-7,y:-1}],
  [{x:1,y:limits.maxY-0.015,vx:0,vy:6},
   {x:1,y:limits.maxY+11}],
  [{x:-1,y:-limits.maxY+0.01,vx:0,vy:-6},
   {x:-1,y:-limits.maxY-5}],
  [{x:limits.maxX-0.008,y:limits.maxY-0.013,vx:5,vy:5},
   {x:limits.maxX+10,y:limits.maxY+9}],
  [{x:limits.maxX,y:limits.maxY,vx:3,vy:4},
   {x:limits.maxX+12,y:limits.maxY+9}]
 ]){
  const next=advanceFreePlayerKinematics(player,target,limits);
  assert.ok(Math.abs(next.x-player.x-next.vx*limits.dt)<1e-10,
   'actual X must agree exactly with physical velocity at field edge');
  assert.ok(Math.abs(next.y-player.y-next.vy*limits.dt)<1e-10,
   'actual Y must agree exactly with physical velocity at field edge');
  assert.ok(Math.abs(next.x)<=limits.maxX+1e-10);
  assert.ok(Math.abs(next.y)<=limits.maxY+1e-10);
  assert.ok(Math.hypot(next.vx,next.vy)<=limits.maxSpeed+1e-7);
 }
});
test('M14 8 actual different ball territories × HOME/AWAY × feedback/observational negative',
 {timeout:115000},async()=>{
 const R=await initializeRapier(wasm);
 const originalStates=['centre','middle-halfspace','middle-wide',
  'attacking-halfspace','attacking-wing','attacking-box',
  'defending-box','high-wide-recovery'];
 assert.ok(originalStates.every(id=>M11_BALL_STARTS.some(x=>x.id===id)));
 const a=auditNaturalNativeFeedbackMatrix(R,{stateIds:originalStates,
  ticks:225});
 assert.equal(a.originalStates,8);
 assert.equal(a.eachTicks,225);
 assert.equal(a.totalRuns,32);
 assert.equal(a.rows.length,32);
 assert.equal(a.controlsAcceptedResponses,0);
 assert.ok(a.feedbackCasesWithNativeContact>=2,
  'Centre HOME/AWAY actual Rapier collision must remain observable');
 assert.ok(a.positiveFeedbackCases>=2,
  'Genuine original centre collision must generate safe source-driven feedback');
 assert.ok(a.totalAcceptedNativeResponses>=2);
 assert.ok(a.nativeShoeStarts>=2,
  'Original shared shoe/ball observer must keep producing native STARTs');
 assert.equal(typeof a.multipleSimultaneousNativeBodyPairsObserved,'boolean');
 assert.ok(a.maximumSimultaneousNativeBodyPairs>=1);
 assert.equal(a.all22AndFootballAuthorityInvariant,true);
 const positive=a.rows.filter(x=>x.mode==='feedback');
 const negative=a.rows.filter(x=>x.mode==='observe');
 let record=[];
 for(const p of positive){
  const n=negative.find(x=>x.side===p.side&&x.stateId===p.stateId);
  assert.ok(n,'Every original source ball state has same-world non-feedback control');
  assert.equal(p.sameRapierWorld,true);
  assert.equal(p.singleNativeEventQueue,true);
  assert.equal(p.nativeColliderRadiusM,PLAYER_MIN_SEPARATION_M/2);
  assert.equal(p.original22Unstaged,true);
  assert.equal(n.original22Unstaged,true);
  assert.equal(n.sameRapierWorld,true);
  assert.equal(n.singleNativeEventQueue,true);
  assert.deepEqual(p.initialBall,n.initialBall);
  assert.equal(n.nativeColliderRadiusM,p.nativeColliderRadiusM);
  assert.equal(n.acceptedNativeResponses,0);
  assert.equal(n.firstAppliedFeedback,null);
  assert.equal(p.matchAuthority,false);
  assert.equal(p.officialTackle,false);
  assert.equal(p.officialInterception,false);
  assert.equal(p.officialPossession,false);
  assert.equal(p.officialResult,null);
  assert.equal(n.officialResult,null);
  assert.ok(p.minimumCanonicalGapM>=PLAYER_MIN_SEPARATION_M-1e-8);
  assert.ok(n.minimumCanonicalGapM>=PLAYER_MIN_SEPARATION_M-1e-8);
  assert.ok(p.peakCanonicalSpeedMps<=PLAYER_MAX_SPEED_MPS+1e-7);
  assert.ok(n.peakCanonicalSpeedMps<=PLAYER_MAX_SPEED_MPS+1e-7);
  assert.equal(p.fullShapeTicks,225);
  assert.equal(n.fullShapeTicks,225);
  // Authentic distant-ball situations can have no independently
  // selected presser. Report the actual pressure coverage, no fake IDs.
  assert.ok(p.originalPressTicks>=0&&p.originalPressTicks<=225);
  assert.ok(n.originalPressTicks>=0&&n.originalPressTicks<=225);
  assert.ok(p.originalSupportTicks>=0);
  assert.ok(n.originalSupportTicks>=0);
  assert.ok(p.actualConvergenceTicks>=0);
  assert.ok(n.actualConvergenceTicks>=0);
  for(const team of ['home','away']){
   const press=p.latestPressers[team];
   assert.ok(press===null||press.startsWith(team+'-'),
    'Original presser can be genuinely unassigned, never invented');
  }
  assert.ok(p.latestShape.home.defenderLineX!==null);
  assert.ok(p.latestShape.away.midfieldLineX!==null);
  if(p.nativeBodyStarts===0){
   assert.equal(p.firstNativeBodyStart,null);
   assert.equal(p.firstAppliedFeedback,null);
   assert.equal(p.acceptedNativeResponses,0);
   assert.equal(p.maxSimultaneousBodyPairs,0);
  }else{
   assert.ok(p.firstNativeBodyStart.tick>0);
   assert.ok(p.firstNativeBodyStart.tick<=225);
   assert.ok(p.realBodyPairs.length>0);
  }
  if(p.acceptedNativeResponses>0){
   assert.ok(p.firstAppliedFeedback);
   assert.ok(p.firstAppliedFeedback.adjustedM>0);
   assert.ok(p.firstAppliedFeedback.minGapM>=PLAYER_MIN_SEPARATION_M-1e-8);
   assert.ok(p.firstAppliedFeedback.tick>=p.firstNativeBodyStart.tick);
  }
  if(p.maxSimultaneousBodyPairs>1)
   assert.ok(p.realBodyPairs.length>1);
  if(p.stateId==='centre'){
   assert.equal(p.firstNativeBodyStart?.tick,67);
   assert.equal(n.firstNativeBodyStart?.tick,67);
   assert.equal(p.firstAppliedFeedback?.tick,67);
   assert.equal(p.nativeBodyStarts>0,true);
   assert.equal(n.nativeBodyStarts>0,true);
   assert.ok(p.nativeShoeStarts>0);
   assert.ok(n.nativeShoeStarts>0);
  }
  record.push({
   state:p.stateId,side:p.side,bodyStarts:p.nativeBodyStarts,
   controlBodyStarts:n.nativeBodyStarts,
   applied:p.acceptedNativeResponses,controlApplied:n.acceptedNativeResponses,
   shoeStarts:p.nativeShoeStarts,controlShoeStarts:n.nativeShoeStarts,
   peakActiveNativePairs:p.maxSimultaneousBodyPairs,
   sameTickBodyAndShoeStarts:p.sameTickNativeBodyAndShoeStarts,
   minGapM:+p.minimumCanonicalGapM.toFixed(6),
   pressTicks:p.originalPressTicks,supportTicks:p.originalSupportTicks
  });
 }
 process.stdout.write('ME_628_M14_NATURAL_MULTITERRITORY_MATRIX '+
  JSON.stringify({
   states:a.originalStates,trials:a.totalRuns,ticks:a.eachTicks,
   nativeStarts:a.nativeBodyStarts,shoeStarts:a.nativeShoeStarts,
   positiveSourceTrials:a.feedbackCasesWithNativeContact,
   acceptedSourceTrials:a.positiveFeedbackCases,
   acceptedTotal:a.totalAcceptedNativeResponses,
   maxConcurrentNativePairs:a.maximumSimultaneousNativeBodyPairs,
   multiPairConfirmed:a.multipleSimultaneousNativeBodyPairsObserved,
   genuineSameTickBodyAndShoeStarts:a.sameTickNativeBodyAndShoeStarts,
   observations:record
  })+'\n');
});
test('M14 mirrored centre source native collision, feedback and shoes replay deterministically',
 {timeout:40000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away'])for(const mode of ['feedback','observe']){
  const a=auditNaturalNativeFeedback(R,{side,mode,stateId:'centre',ticks:160});
  const b=auditNaturalNativeFeedback(R,{side,mode,stateId:'centre',ticks:160});
  assert.deepEqual(a,b,'Original single Rapier 22-player replay');
  assert.equal(a.firstNativeBodyStart?.tick,67);
  assert.equal(a.nativeBodyStarts,1);
  assert.ok(a.nativeShoeStarts>0);
  assert.equal(a.officialTackle,false);
  assert.equal(a.officialPossession,false);
  if(mode==='feedback'){
   assert.equal(a.firstAppliedFeedback?.tick,67);
   assert.ok(a.acceptedNativeResponses>0);
  }else{
   assert.equal(a.acceptedNativeResponses,0);
   assert.equal(a.firstAppliedFeedback,null);
  }
 }
});
test('M14 fake simultaneous native contact pairs and invalid source states fail closed',
 {timeout:14000},async()=>{
 const R=await initializeRapier(wasm);
 for(const bad of [
  {stateId:'staged-players'},{side:'both'},{ticks:0},
  {ticks:241},{ticks:7.3},{mode:'synthetic-body'},
  {mode:'feedback',side:'home',stateId:null}
 ])assert.throws(()=>auditNaturalNativeFeedback(R,bad),TypeError);
 for(const bad of [
  {stateIds:[]},{stateIds:['centre','centre']},
  {stateIds:['invented-contact']},{stateIds:'centre'}
 ])assert.throws(()=>auditNaturalNativeFeedbackMatrix(R,bad),TypeError);
 const mover=createPlayerMovement({
  researchOpposingPressConvergence:true,
  researchUnstagedNativeBodyFeedback:true
 });
 const engine=createEngine(R,{
  preset:'roll',seed:'m14-false-native-pair',x:0,y:0,z:0,
  vx:0,vy:0,vz:0
 },{
  diagnosticPlayerBodyCollidersEnabled:true,
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticSharedContactEventsEnabled:true,
  diagnosticUnstagedBodyFeedbackEnabled:true
 });
 try{
  const frame=mover.step(engine.snapshot().ball.position);
  engine.step(frame);
  const native=engine.nativePlayerBodySnapshot();
  assert.equal(native.tick,1);
  assert.equal(native.actualNativeStarts,0);
  assert.deepEqual(native.activePairs,[]);
  const forged={
   ...native,activePairs:['away-10|home-10','away-9|home-9']
  };
  assert.throws(()=>mover.reconcileUnstagedNativeBodyResponse(forged),
   /authenticated Rapier START/);
  assert.equal(mover.snapshot().actualNativeResponseCount,0);
  assert.deepEqual(mover.snapshot().players,frame.players,
   'Forged simultaneous contacts cannot modify even one original actor');
  const correct=mover.reconcileUnstagedNativeBodyResponse(native);
  assert.equal(correct.accepted,false);
  assert.equal(correct.reason,'no-native-active-pair');
  assert.equal(engine.acknowledgeNativePlayerResponse(mover.snapshot()).tick,1);
 }finally{engine.dispose();}
});
