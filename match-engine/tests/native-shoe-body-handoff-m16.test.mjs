// #628 M16 — physical shoe and body can each travel <=7m/s per 60Hz.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {PLAYER_DT,PLAYER_MAX_SPEED_MPS,PLAYER_MIN_SEPARATION_M,
 createPlayerMovement,INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {projectNativeShoeBodyStep,projectNativeShoeBodyFacing}
 from '../src/native-shoe-body-handoff.mjs';
import {auditMovingBallMultiPairMatrix}
 from '../src/moving-ball-multipair-audit-m15.mjs';

const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const turn=a=>Math.atan2(Math.sin(a),Math.cos(a));
test('M16 bounded next step cannot teleport original shoe or canonical body',()=>{
 const prior={x:0.07,y:0},shoe={x:0,y:0};
 const proposed={x:0.186,y:0};
 const r=projectNativeShoeBodyStep(prior,shoe,proposed,{
  dt:PLAYER_DT,maxSpeed:PLAYER_MAX_SPEED_MPS
 });
 assert.ok(r.clippedM>0);
 assert.ok(gap(r,shoe)<=PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-10);
 assert.ok(gap(r,prior)<=PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-10);
 assert.ok(Math.abs(r.x-prior.x-r.vx*PLAYER_DT)<1e-12);
 assert.ok(Math.hypot(r.vx,r.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
 const untouched=projectNativeShoeBodyStep(
  {x:0,y:0},{x:0,y:0},{x:0.08,y:0.01},
  {dt:PLAYER_DT,maxSpeed:PLAYER_MAX_SPEED_MPS});
 assert.equal(untouched.clippedM,0);
 assert.throws(()=>projectNativeShoeBodyStep(
  {x:0.3,y:0},{x:0,y:0},{x:0.31,y:0},
  {dt:PLAYER_DT,maxSpeed:PLAYER_MAX_SPEED_MPS}),/prior shoe cannot reach/);
 assert.throws(()=>projectNativeShoeBodyStep(
  {x:0,y:0},{x:0,y:0},{x:5,y:0},
  {dt:PLAYER_DT,maxSpeed:PLAYER_MAX_SPEED_MPS}),/player speed bound/);
});
test('M16 source heading lies in BOTH body and original shoe turning intervals',()=>{
 const radius=6*PLAYER_DT;
 const a=projectNativeShoeBodyFacing(0.09,0,0.19,radius);
 assert.ok(a.clippedRad>0);
 assert.ok(Math.abs(turn(a.facingRad-0))<=radius+1e-10);
 assert.ok(Math.abs(turn(a.facingRad-0.09))<=radius+1e-10);
 assert.equal(projectNativeShoeBodyFacing(0,0,0.06,radius).clippedRad,0);
 assert.throws(()=>projectNativeShoeBodyFacing(0.4,0,0.5,radius),
  /heading not jointly reachable/);
});
test('M16 explicit opt-in preserves the canonical original 22 and all defaults',()=>{
 const standard=createPlayerMovement(),m13={
  researchOpposingPressConvergence:true,
  researchUnstagedNativeBodyFeedback:true
 };
 const legacy=createPlayerMovement(m13);
 const bounded=createPlayerMovement({...m13,researchShoeBodyHandoff:true});
 assert.deepEqual(standard.snapshot().players,legacy.snapshot().players);
 assert.deepEqual(legacy.snapshot().players,bounded.snapshot().players);
 assert.equal(legacy.snapshot().shoeBodyHandoff,undefined);
 assert.equal(bounded.snapshot().shoeBodyHandoff.positionClamps,0);
 assert.equal(bounded.snapshot().players.length,INITIAL_PLAYERS.length);
 for(const bad of [
  {researchShoeBodyHandoff:true},
  {...m13,researchShoeBodyHandoff:false},
  {researchOpposingPressConvergence:true,researchShoeBodyHandoff:true},
  {...m13,researchShoeBodyHandoff:true,researchCarrySide:'home'}
 ])assert.throws(()=>createPlayerMovement(bad),TypeError);
});
test('M16 genuine previously blocked moving-ball HOME/AWAY runs are now shoe-safe',
 {timeout:150000},async()=>{
 const R=await initializeRapier(wasm);
 const options={stateIds:['middle-halfspace','near-center-recovery'],
  velocityIds:['forward-roll','diagonal-roll'],ticks:225};
 const legacy=auditMovingBallMultiPairMatrix(R,{
  ...options,handoffPolicy:'legacy'
 });
 const bounded=auditMovingBallMultiPairMatrix(R,{
  ...options,handoffPolicy:'bounded'
 });
 assert.equal(legacy.runs,16);
 assert.equal(legacy.blockedRuns,8,
  'M15 historical eight true pre-solver shoe incompatibilities');
 assert.equal(bounded.runs,16);
 assert.equal(bounded.blockedRuns,0,
  'M16 all 16 original physical rolling-ball trials must run full duration');
 assert.equal(bounded.completedRuns,16);
 assert.equal(bounded.completeFeedbackControlPairs,8);
 assert.equal(bounded.controlsCanonicalResponses,0);
 let clamps=0;
 for(const row of bounded.rows){
  assert.equal(row.fullShapeTicks,225);
  assert.equal(row.original22Unstaged,true);
  assert.equal(row.singleNativeEventQueue,true);
  assert.equal(row.matchAuthority,false);
  assert.equal(row.officialPossession,false);
  assert.equal(row.officialTackle,false);
  assert.ok(row.minimumCanonicalGapM>=PLAYER_MIN_SEPARATION_M-1e-8);
  assert.ok(row.peakCanonicalSpeedMps<=PLAYER_MAX_SPEED_MPS+1e-7);
  if(row.mode==='feedback'){
   assert.equal(row.shoeBodyHandoff,'bounded');
   assert.ok(row.sourceBoundShoeHandoff?.preSolverNativeShoes);
   clamps+=(row.sourceBoundShoeHandoff.positionClamps+
    row.sourceBoundShoeHandoff.headingClamps);
  }else{
   assert.equal(row.acceptedNativeResponses,0);
   assert.equal(row.shoeBodyHandoff,'observe-only');
  }
 }
 assert.ok(clamps>0,'Real native source must require bounded shoe handoff');
 process.stdout.write('ME_628_M16_SHOE_BODY_HANDOFF '+JSON.stringify({
  originalRuns:legacy.runs,previouslyBlocked:legacy.blockedRuns,
  boundedComplete:bounded.completedRuns,boundedBlocked:bounded.blockedRuns,
  originalNativeBodyStarts:bounded.feedbackNativeBodyStarts,
  nativeShoeStarts:bounded.feedbackNativeShoeStarts,
  canonicalFeedbackCorrections:bounded.actualCanonicalResponses,
  shoeAndFacingClamps:clamps,
  peakSimultaneousPairs:bounded.maximumSimultaneousNativeBodyPairs
 })+'\n');
});
