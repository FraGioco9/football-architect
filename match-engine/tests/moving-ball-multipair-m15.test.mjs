// #628 M15 — source-driven rolling-ball survey, no synthetic contact.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {PLAYER_MIN_SEPARATION_M,PLAYER_MAX_SPEED_MPS}
 from '../src/player-movement.mjs';
import {M11_BALL_STARTS} from '../src/unstaged-body-contact-audit.mjs';
import {auditNaturalNativeFeedback}
 from '../src/natural-native-feedback-audit-m14.mjs';
import {M15_ORIGINAL_BALL_MOTIONS,auditMovingBallMultiPairMatrix}
 from '../src/moving-ball-multipair-audit-m15.mjs';

test('M15 fixed 22-player native movement: rolling ball paired with observe-only', 
 {timeout:150000},async()=>{
 const R=await initializeRapier(wasm);
 const states=['centre','middle-halfspace','attacking-halfspace','near-center-recovery'];
 const velocities=['forward-roll','diagonal-roll'];
 const a=auditMovingBallMultiPairMatrix(R,{
  stateIds:states,velocityIds:velocities,ticks:225
 });
 assert.equal(a.originalTerritories,4);
 assert.equal(a.originalRollingProfiles,2);
 assert.equal(a.runs,32);
 assert.equal(a.completedRuns+a.blockedRuns,32);
 assert.equal(a.rows.length,a.completedRuns);
 assert.equal(a.blocked.length,a.blockedRuns);
 assert.ok(a.completedRuns>0);
 assert.equal(a.allRequestedRunsCompleted,a.blockedRuns===0);
 for(const blocked of a.blocked){
  assert.equal(blocked.reason,'genuine-physical-shoe-body-mismatch');
  assert.ok(blocked.blockedAtTick>=1&&blocked.blockedAtTick<=225);
  assert.ok(blocked.violations.length>0);
  assert.ok(blocked.violations.every(x=>x.id.startsWith('home-')||
   x.id.startsWith('away-')));
 }
 assert.ok(a.completeFeedbackControlPairs<=8);
 assert.equal(a.controlsCanonicalResponses,0);
 assert.equal(a.allPlayersOriginal,true);
 assert.equal(a.matchAuthority,false);
 assert.equal(typeof a.trueMultiPairContactObserved,'boolean');
 assert.ok(a.maximumSimultaneousNativeBodyPairs>=0);
 const stateMap=new Map(M11_BALL_STARTS.map(x=>[x.id,x]));
 const motionMap=new Map(M15_ORIGINAL_BALL_MOTIONS.map(x=>[x.id,x]));
 for(const p of a.rows){
  const source=stateMap.get(p.stateId);
  const move=motionMap.get(p.velocityId);
  const sign=p.side==='home'?1:-1;
  assert.equal(p.initialBall.x,sign*source.x);
  assert.equal(p.initialBall.y,source.y);
  assert.equal(p.initialBall.vx,sign*move.vx);
  assert.equal(p.initialBall.vy,move.vy);
  assert.equal(p.initialRollingFraction,1);
  assert.equal(p.original22Unstaged,true);
  assert.equal(p.sameRapierWorld,true);
  assert.equal(p.singleNativeEventQueue,true);
  assert.equal(p.nativeColliderRadiusM,PLAYER_MIN_SEPARATION_M/2);
  assert.ok(p.minimumCanonicalGapM>=PLAYER_MIN_SEPARATION_M-1e-8);
  assert.ok(p.peakCanonicalSpeedMps<=PLAYER_MAX_SPEED_MPS+1e-7);
  assert.equal(p.fullShapeTicks,225);
  assert.equal(p.matchAuthority,false);
  assert.equal(p.officialTackle,false);
  assert.equal(p.officialInterception,false);
  assert.equal(p.officialPossession,false);
  assert.equal(p.officialResult,null);
  assert.ok(p.originalPressTicks>=0&&p.originalPressTicks<=225);
  assert.ok(p.originalSupportTicks>=0&&p.originalSupportTicks<=225);
  if(p.mode==='observe'){
   assert.equal(p.acceptedNativeResponses,0);
   assert.equal(p.firstAppliedFeedback,null);
  }
  if(p.maxSimultaneousBodyPairs>=2){
   assert.ok(p.firstSimultaneousBodyPairs);
   assert.equal(p.firstSimultaneousBodyPairs.pairs.length>=2,true);
   assert.ok(p.firstSimultaneousBodyPairs.tick>=1);
   assert.ok(p.simultaneousBodyPairTicks>=1);
   for(const pair of p.firstSimultaneousBodyPairs.pairs)
    assert.ok(p.realBodyPairs.includes(pair));
  }else{
   assert.equal(p.firstSimultaneousBodyPairs,null);
   assert.equal(p.simultaneousBodyPairTicks,0);
  }
 }
 assert.equal(a.trueMultiPairContactObserved,a.rows.some(
  x=>x.mode==='feedback'&&x.firstSimultaneousBodyPairs!==null&&
   a.rows.some(n=>n.mode==='observe'&&
    n.stateId===x.stateId&&n.side===x.side&&
    n.velocityId===x.velocityId)));
 if(a.trueMultiPairContactObserved){
  assert.ok(a.firstRealMultiPairEvidence);
  assert.equal(a.firstRealMultiPairEvidence.pairs.length>=2,true);
 }else{
  assert.equal(a.firstRealMultiPairEvidence,null);
  assert.equal(a.realMultiPairFeedbackRuns,0);
 }
 process.stdout.write('ME_628_M15_NATURAL_MOVING_BALL_MATRIX '+
  JSON.stringify({
   attemptedRuns:a.runs,completedRuns:a.completedRuns,
   blockedRuns:a.blockedRuns,pairedRuns:a.completeFeedbackControlPairs,
   blockers:a.blocked.map(x=>({
    state:x.stateId,velocity:x.velocityId,side:x.side,mode:x.mode,
    tick:x.blockedAtTick,actors:x.violations.map(y=>y.id)
   })),
   ticks:a.ticksPerRun,realBodyStarts:a.feedbackNativeBodyStarts,
   realShoeStarts:a.feedbackNativeShoeStarts,
   feedbackCorrections:a.actualCanonicalResponses,
   controlCorrections:a.controlsCanonicalResponses,
   peakSimultaneousNativePairs:a.maximumSimultaneousNativeBodyPairs,
   multiPairObserved:a.trueMultiPairContactObserved,
   firstVerifiedMultiPair:a.firstRealMultiPairEvidence
  })+'\\n');
});

test('M15 rolling-ball original source is deterministic and rejects invalid velocity', 
 {timeout:30000},async()=>{
 const R=await initializeRapier(wasm);
 const options={stateId:'centre',side:'home',mode:'feedback',ticks:90,
  initialBallVelocity:{vx:4,vy:0}};
 const first=auditNaturalNativeFeedback(R,options);
 const repeat=auditNaturalNativeFeedback(R,options);
 assert.deepEqual(first,repeat);
 for(const invalid of [
  {vx:0,vy:0},{vx:100,vy:0},{vx:NaN,vy:1},{vx:1},
  {vx:2,vy:2,extra:1},'forced-player-contact'
 ])assert.throws(()=>auditNaturalNativeFeedback(R,{
  ...options,initialBallVelocity:invalid}),TypeError);
 for(const invalid of [
  {stateIds:[]},{velocityIds:[]},{velocityIds:['injected']},
  {velocityIds:['forward-roll','forward-roll']},
  {stateIds:['centre','centre']},{ticks:241}
 ])assert.throws(()=>auditMovingBallMultiPairMatrix(R,invalid),TypeError);
});
