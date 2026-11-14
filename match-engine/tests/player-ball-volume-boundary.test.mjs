// C2.3a: pure geometry vs real, continuously sampled Rapier fixture worlds.
// Synthetic vectors below are CONTRACT TESTS, not witnessed physical goals.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {BALL_RADIUS,FIXED_DT,initializeRapier} from '../src/core.mjs';
import {createPhysicalFixtureStepRuntime} from '../src/physical-fixture-step-runtime.mjs';
import {measuredWholeBallPlaneExit,createPhysicalBallVolumeBoundaryObserver,
 PHYSICAL_BALL_VOLUME_BOUNDARY_VERSION}
 from '../src/player-ball-volume-boundary.mjs';
const fixture=country=>Object.freeze({
 id:'season:1:'+country+'-1:N01:'+country+'-1:'+country+'-2',
 competitionId:country+'-1',marker:'N01',day:1,round:1,
 homeClubId:country+'-1',awayClubId:country+'-2'
});

test('C2.3a geometry contract: 0.11m FULL ball clears each plane, without inventing a goal',()=>{
 const outside=measuredWholeBallPlaneExit(
  {x:52.46,y:0,z:0.4},{x:52.82,y:0,z:0.4});
 assert.equal(outside.kind,'goal-line-plane');
 assert.equal(outside.side,'away-end');
 assert.equal(outside.physicalBallRadiusM,BALL_RADIUS);
 assert.ok(outside.centre.x>=52.5+BALL_RADIUS-1e-10);
 assert.equal(outside.fitsWholeGoalOpening,true);
 assert.equal(outside.wholeBallBeyondPlaneInNextSample,true);
 assert.equal(outside.officialOutOfPlay,null);
 assert.equal(outside.goalScored,null);
 assert.equal(outside.shotOnTarget,null);
 assert.equal(outside.officialMatchResult,null);
 assert.ok(Object.isFrozen(outside));
 assert.ok(Object.isFrozen(outside.centre));
 assert.ok(Object.isFrozen(outside.allCrossedPlanes));
 for(const [side,start,end] of [
  ['home-end',-52.40,-52.85],
  ['away-end',52.40,52.85]
 ]){
  const e=measuredWholeBallPlaneExit(
   {x:start,y:0,z:0.3},{x:end,y:0,z:0.3});
  assert.equal(e.side,side);
  assert.equal(e.fitsWholeGoalOpening,true);
  assert.equal(e.goalScored,null);
 }
 const high=measuredWholeBallPlaneExit(
  {x:52.4,y:0,z:2.5},{x:52.9,y:0,z:2.5});
 const wide=measuredWholeBallPlaneExit(
  {x:52.4,y:5,z:0.5},{x:52.9,y:5,z:0.5});
 assert.equal(high.fitsWholeGoalOpening,false);
 assert.equal(wide.fitsWholeGoalOpening,false);
 for(const [side,sy,ey] of [
  ['upper-side',34,34.5],['lower-side',-34,-34.5]
 ]){
  const e=measuredWholeBallPlaneExit(
   {x:0,y:sy,z:0.11},{x:0,y:ey,z:0.11});
  assert.equal(e.kind,'touch-line-plane');
  assert.equal(e.side,side);
  assert.equal(e.fitsWholeGoalOpening,null);
  assert.equal(e.goalScored,null);
 }
 const corner=measuredWholeBallPlaneExit(
  {x:52.55,y:33.97,z:0.11},{x:52.9,y:34.42,z:0.11});
 assert.equal(corner.sameTickMultiplePlanes,true);
 assert.equal(corner.allCrossedPlanes.length,2);
 assert.equal(corner.goalScored,null);
 assert.equal(measuredWholeBallPlaneExit(
  {x:52.8,y:0,z:0.11},{x:52.3,y:0,z:0.11}),null);
 assert.equal(measuredWholeBallPlaneExit(
  {x:0,y:0,z:0.11},{x:5,y:0,z:0.11}),null);
 assert.throws(()=>measuredWholeBallPlaneExit(
  {x:0,y:Infinity,z:0.11},{x:5,y:0,z:0.11}),/Finite measured/);
});

test('C2.3a contract-only chronological observer is immutable and refuses fake ticks',()=>{
 const o=createPhysicalBallVolumeBoundaryObserver('synthetic-only');
 const first=o.observe({physicsTick:0,ballPosition:{x:52.3,y:0,z:0.4}});
 assert.equal(first.firstObservedExit,null);
 assert.equal(first.fixtureId,'synthetic-only');
 assert.equal(first.goalScored,null);
 assert.throws(()=>o.observe({physicsTick:2,
  ballPosition:{x:52.9,y:0,z:0.4}}),/Consecutive physical ticks/);
 const next=o.observe({physicsTick:1,ballPosition:{x:52.8,y:0,z:0.4}});
 assert.equal(next.version,PHYSICAL_BALL_VOLUME_BOUNDARY_VERSION);
 assert.equal(next.firstObservedExit.side,'away-end');
 assert.equal(next.firstObservedExit.observedAtTick,1);
 assert.equal(next.firstObservedExit.observedAtSeconds,FIXED_DT);
 assert.ok(Object.isFrozen(next.firstObservedExit));
 assert.equal(next.productionScoringConnected,false);
 assert.equal(next.officialOutOfPlay,null);
 const stable=o.observe({physicsTick:2,ballPosition:{x:51,y:0,z:0.4}});
 assert.equal(stable.firstObservedExit,next.firstObservedExit);
 assert.throws(()=>o.observe({physicsTick:3,
  ballPosition:{x:NaN,y:0,z:0.4}}),/Finite measured/);
});

test('C2.3a REAL Rapier, two opposite field ends: actual whole ball crosses 105m boundary, not a score',async()=>{
 const R=await initializeRapier(rapier);
 for(const [country,sign,side] of [
  ['ENG',1,'away-end'],['IT',-1,'home-end']
 ]){
  // Legal, temporary 60Hz 22-player world. Origin stays inside the pitch;
  // the fast rolling ball itself reaches the plane beyond goal width.
  // No player or shoe is artificially placed, no physics are overridden.
  const scenario={preset:'roll',seed:'c2-3a-real-outward-'+country,
   x:sign*47,y:30,z:0,vx:sign*20,vy:0,vz:0};
  const a=createPhysicalFixtureStepRuntime(R,fixture(country),scenario);
  const b=createPhysicalFixtureStepRuntime(R,fixture(country),scenario);
  const frames=[];
  try{
   assert.equal(a.snapshot().physicalBallVolumeBoundary.firstObservedExit,null);
   let exit=null;
   for(let tick=1;tick<=100;tick++){
    const x=a.step(),y=b.step();
    frames.push(x);
    assert.equal(x.canonicalBall,y.canonicalBall);
    assert.deepEqual(x.physicalBallVolumeBoundary,y.physicalBallVolumeBoundary);
    const volume=x.physicalBallVolumeBoundary;
    assert.equal(volume.version,PHYSICAL_BALL_VOLUME_BOUNDARY_VERSION);
    assert.equal(volume.physicsTick,tick);
    assert.equal(volume.fixtureId,fixture(country).id);
    assert.equal(x.officialMatchResult,null);
    assert.equal(x.officialGoalEvidence,false);
    assert.equal(x.productionScoringConnected,false);
    assert.equal(volume.goalScored,null);
    assert.equal(volume.officialOutOfPlay,null);
    assert.equal(volume.officialMatchResult,null);
    assert.equal(x.localAutonomousAction,null);
    if(volume.firstObservedExit){
     exit=volume.firstObservedExit;
     assert.equal(exit.observedAtTick,tick);
     assert.equal(exit.side,side);
     assert.equal(exit.kind,'goal-line-plane');
     assert.equal(exit.fitsWholeGoalOpening,false,
      'this real lateral boundary exit was OUTSIDE the goal mouth');
     assert.equal(exit.officialGoalEvidence,false);
     assert.equal(exit.officialMatchResult,null);
     assert.equal(exit.goalScored,null);
     assert.equal(exit.physicalBallRadiusM,BALL_RADIUS);
     assert.ok(sign*exit.nextMeasuredCentre.x>=52.5+BALL_RADIUS,
      'genuine subsequent Rapier ball centre is fully beyond line');
     assert.ok(sign*exit.previousMeasuredCentre.x<52.5+BALL_RADIUS);
     assert.ok(Object.isFrozen(exit));
     assert.ok(Object.isFrozen(exit.nextMeasuredCentre));
     break;
    }
   }
   assert.ok(exit,'actual Rapier ball must eventually move fully beyond '+side);
   // Physical reset recreates the world, not a pre-recorded event.
   const replay=a.reset();
   try{
    assert.deepEqual(replay.advance(frames.length),frames);
   }finally{replay.dispose();}
  }finally{a.dispose();b.dispose();}
 }
});

test('C2.3a stationary 60Hz Rapier ball, with action mode disabled, cannot fabricate field exit',async()=>{
 const R=await initializeRapier(rapier);
 const a=createPhysicalFixtureStepRuntime(R,fixture('ES'),{
  preset:'drop',seed:'c2-3a-stationary',x:0,y:0,z:0,vx:0,vy:0,vz:0
 });
 try{
  for(let i=0;i<90;i++){
   const frame=a.step();
   assert.equal(frame.physicalBallVolumeBoundary.firstObservedExit,null);
   assert.equal(frame.physicalBallVolumeBoundary.goalScored,null);
   assert.equal(frame.physicalBallVolumeBoundary.officialOutOfPlay,null);
   assert.equal(frame.officialMatchResult,null);
  }
 }finally{a.dispose();}
});
