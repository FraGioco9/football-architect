import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createPhysicalFixtureStepRuntime} from '../src/physical-fixture-step-runtime.mjs';
import {measuredPitchCentreCrossing,SHOT_BOUNDARY_VERSION,
 createPhysicalShotBoundaryObserver,SHOT_BOUNDARY_WINDOW_TICKS}
 from '../src/player-ball-shot-boundary-observer.mjs';
// Synthetic PROTOCOL test only; a real shoe witness is independently
// required in physical C3.2a fixtures before this is a real carry.
test('C3.2a a real-action-shaped ground carry can never start a shot observer episode',()=>{
 const o=createPhysicalShotBoundaryObserver('c32a-synthetic-geometry');
 const feed=(tick,foot)=>({
  physicsTick:tick,realFootEventsOnly:true,officialGoalEvidence:false,
  started:foot?[{engineId:'home-9',team:'home'}]:[],
  active:foot?[{engineId:'home-9',team:'home'}]:[]
 });
 const zero=o.observe({physicsTick:0,ballPosition:{x:-5,y:0,z:0.11},
  localAutonomousAction:null,physicalContactFeed:feed(0,false)});
 assert.equal(zero.active,null);
 const out=o.observe({physicsTick:1,ballPosition:{x:-4.98,y:0,z:0.11},
  physicalContactFeed:feed(1,true),
  localAutonomousAction:{tick:1,action:'carry',playerId:'home-9',
   team:'home',appliedByRapier:true,officialMatchAction:false}
 });
 assert.equal(out.active,null);
 assert.equal(out.lastResolved,null);
 assert.equal(out.shotOnTarget,null);
 assert.equal(out.goalScored,null);
 assert.equal(out.officialMatchResult,null);
 assert.ok(Object.isFrozen(out));
});

test('C2.1 geometric 3D ball-centre plane crossing is never a goal',()=>{
 const good=measuredPitchCentreCrossing({x:52.2,y:0,z:0.4},{x:52.8,y:0,z:0.4});
 assert.equal(good.kind,'goal-line-plane');
 assert.equal(good.side,'away-end');
 assert.equal(good.withinGoalOpeningCentre,true);
 assert.equal(good.goalScored,null);
 assert.equal(good.shotOnTarget,null);
 assert.equal(good.fullBallCrossingProven,false);
 assert.equal(measuredPitchCentreCrossing({x:52.2,y:0,z:2.5},
  {x:52.8,y:0,z:2.5}).withinGoalOpeningCentre,false);
 const wide=measuredPitchCentreCrossing({x:52.2,y:5,z:0.4},
  {x:52.8,y:5,z:0.4});
 assert.equal(wide.withinGoalOpeningCentre,false);
 const side=measuredPitchCentreCrossing({x:0,y:33.8,z:0.4},
  {x:0,y:34.5,z:0.4});
 assert.equal(side.kind,'touch-line-plane');
 const corner=measuredPitchCentreCrossing({x:52.4,y:33.8,z:0.4},
  {x:52.8,y:34.8,z:0.4});
 assert.equal(corner.kind,'touch-line-plane');
 assert.equal(measuredPitchCentreCrossing({x:0,y:0,z:0.11},
  {x:2,y:1,z:0.11}),null);
 assert.throws(()=>measuredPitchCentreCrossing({x:52,y:0,z:0.4},
  {x:Infinity,y:0,z:0.4}),/Finite actual/);
});
test('C2.1 observed 155 same-tick real Rapier fixture frames remain read-only and replayable',async()=>{
 const R=await initializeRapier(rapier);
 const fixture={id:'season:1:ENG-1:N01:ENG-1:ENG-2',
  competitionId:'ENG-1',marker:'N01',day:1,round:1,
  homeClubId:'ENG-1',awayClubId:'ENG-2'};
 const scene={preset:'roll',seed:'c2-real-physics-boundary',
  x:4.96,y:0,z:0,vx:-0.3,vy:0,vz:0};
 const a=createPhysicalFixtureStepRuntime(R,fixture,scene,{autonomousActions:true});
 const b=createPhysicalFixtureStepRuntime(R,fixture,scene,{autonomousActions:true});
 try{
  for(let tick=1;tick<=155;tick++){
   const x=a.step(),y=b.step();
   assert.equal(x.physicalShotBoundary.version,SHOT_BOUNDARY_VERSION);
   assert.equal(x.physicalShotBoundary.physicsTick,tick);
   assert.equal(x.physicalShotBoundary.goalScored,null);
   assert.equal(x.physicalShotBoundary.realRapierBallFramesOnly,true);
   const shot=x.physicalShotBoundary.active??x.physicalShotBoundary.lastResolved;
   if(shot){
    assert.ok(shot.physicalSampleCount<=SHOT_BOUNDARY_WINDOW_TICKS+1);
    assert.equal(shot.physicalSampleCount,shot.measuredBallCentres3D.length);
    assert.ok(Object.isFrozen(shot.measuredBallCentres3D));
    assert.ok(shot.observedPath3DM>=0);
    assert.ok(shot.observedGroundPathM>=0);
    assert.ok(shot.maximumBallCentreHeightM>=0);
    assert.equal(shot.goalScored,null);
   }
   assert.equal(x.physicalShotBoundary.shotOnTarget,null);
   assert.equal(x.physicalShotBoundary.officialMatchResult,null);
   assert.equal(x.productionScoringConnected,false);
   assert.deepEqual(x.physicalShotBoundary,y.physicalShotBoundary);
   assert.equal(x.canonicalBall,y.canonicalBall);
  }
 }finally{a.dispose();b.dispose();}
});


// C2.2 unit-only scenario vectors test observation contracts. They do NOT
// stand in for real Rapier shot witnesses (which only the fixture may produce).
test('C2.2 synthetic contract trajectory accumulates measured 3D samples, no projected goal',()=>{
 const observer=createPhysicalShotBoundaryObserver('unit-only-fixture');
 const shoe=(engineId,team)=>Object.freeze({engineId,team});
 const feed=(physicsTick,started=[],active=[])=>({
  physicsTick,started,active,realFootEventsOnly:true,officialGoalEvidence:false
 });
 const take=(tick,position,contact,action=null)=>observer.observe({
  physicsTick:tick,ballPosition:position,physicalContactFeed:contact,
  localAutonomousAction:action
 });
 const p0=take(0,{x:51.0,y:0,z:0.11},feed(0));
 assert.equal(p0.active,null);
 const shot={tick:1,action:'shot',playerId:'home-10',team:'home',
  appliedByRapier:true,officialMatchAction:false};
 const first=take(1,{x:51.1,y:0,z:0.11},
  feed(1,[shoe('home-10','home')],[shoe('home-10','home')]),shot);
 assert.equal(first.active.physicalSampleCount,1);
 assert.equal(first.active.observedPath3DM,0);
 assert.equal(first.active.maximumBallCentreHeightM,0.11);
 assert.ok(Object.isFrozen(first.active.measuredBallCentres3D));
 const second=take(2,{x:51.9,y:0,z:0.51},feed(2));
 assert.equal(second.active.physicalSampleCount,2);
 assert.ok(Math.abs(second.active.observedPath3DM-Math.hypot(0.8,0.4))<1e-10);
 assert.ok(Math.abs(second.active.observedGroundPathM-0.8)<1e-10);
 assert.equal(second.active.maximumBallCentreHeightM,0.51);
 const ended=take(3,{x:52.6,y:0,z:0.51},feed(3));
 assert.equal(ended.active,null);
 assert.equal(ended.lastResolved.status,'centre-plane-observed');
 assert.equal(ended.lastResolved.firstPitchPlaneCrossing.withinGoalOpeningCentre,true);
 assert.equal(ended.lastResolved.measuredBallCentres3D.length,3);
 assert.equal(ended.lastResolved.firstLaterShoeContact,null);
 assert.equal(ended.lastResolved.goalScored,null);
 assert.equal(ended.lastResolved.shotOnTarget,null);
 assert.equal(ended.lastResolved.fullBallCrossingProven,false);
 assert.ok(Object.isFrozen(ended.lastResolved));
 assert.ok(Object.isFrozen(ended.lastResolved.measuredBallCentres3D));
});
test('C2.2 synthetic first subsequent shoe and same-tick plane remain ambiguous',()=>{
 const actor=(engineId,team)=>({engineId,team});
 const feed=(tick,started=[],active=[])=>({
  physicsTick:tick,started,active,realFootEventsOnly:true,officialGoalEvidence:false
 });
 const s=createPhysicalShotBoundaryObserver('unit');
 const next=(tick,x,shoes=[],action=null)=>s.observe({
  physicsTick:tick,ballPosition:{x,y:0,z:0.4},
  localAutonomousAction:action,
  physicalContactFeed:feed(tick,shoes,shoes)
 });
 next(0,52.1);
 next(1,52.2,[actor('home-9','home')],{
  tick:1,playerId:'home-9',team:'home',action:'shot',
  appliedByRapier:true,officialMatchAction:false
 });
 const both=next(2,52.8,[actor('away-2','away'),actor('home-9','home')]);
 assert.equal(both.lastResolved.status,'plane-and-shoe-same-tick-order-unknown');
 assert.equal(both.lastResolved.firstLaterShoeContact.simultaneousShoeStartsAmbiguous,true);
 assert.equal(both.lastResolved.firstLaterShoeContact.temporalOrderWithPlaneCrossing,
  'unknown-within-same-physics-step');
 assert.deepEqual(both.lastResolved.firstLaterShoeContact.contacts.map(x=>x.contactKind),
  ['opponent-shoe','shooter-recontact']);
 assert.equal(both.lastResolved.goalScored,null);
});
test('C2.2 synthetic negative inputs fail closed rather than generating physical shots',()=>{
 const make=(tick,started=[],active=[])=>({
  physicsTick:tick,started,active,realFootEventsOnly:true,officialGoalEvidence:false
 });
 const a=createPhysicalShotBoundaryObserver('fixture');
 const p={x:0,y:0,z:0.11};
 a.observe({physicsTick:0,ballPosition:p,physicalContactFeed:make(0)});
 const shot={tick:1,action:'shot',playerId:'home-10',team:'home',
  appliedByRapier:true,officialMatchAction:false};
 for(const [contact,action] of [
  [make(1),shot],
  [make(1,[{engineId:'away-10',team:'away'}],
    [{engineId:'away-10',team:'away'}]),shot],
  [make(1,[{engineId:'home-10',team:'home'}],
    [{engineId:'home-10',team:'home'}]),{...shot,appliedByRapier:false}],
  [make(1,[{engineId:'home-10',team:'home'}],
    [{engineId:'home-10',team:'home'}]),{...shot,tick:0}]
 ])assert.throws(()=>a.observe({
   physicsTick:1,ballPosition:p,physicalContactFeed:contact,
   localAutonomousAction:action
  }),/genuine exclusive Rapier shoe contact/);
 assert.throws(()=>a.observe({
  physicsTick:2,ballPosition:p,physicalContactFeed:make(2)
 }),/Untrusted physics tick/);
});
test('C2.2 bounded synthetic observation expires, cannot manufacture a goal',()=>{
 const s=createPhysicalShotBoundaryObserver('unit');
 const shoe={engineId:'home-10',team:'home'};
 const feed=(tick,started=[],active=[])=>({
  physicsTick:tick,started,active,realFootEventsOnly:true,officialGoalEvidence:false
 });
 let last=s.observe({physicsTick:0,ballPosition:{x:0,y:0,z:0.11},
  physicalContactFeed:feed(0)});
 for(let tick=1;tick<=SHOT_BOUNDARY_WINDOW_TICKS+1;tick++){
  last=s.observe({physicsTick:tick,ballPosition:{x:tick*0.005,y:0,z:0.11},
   physicalContactFeed:feed(tick,tick===1?[shoe]:[],tick===1?[shoe]:[]),
   localAutonomousAction:tick===1?{
    tick:1,action:'shot',playerId:'home-10',team:'home',
    appliedByRapier:true,officialMatchAction:false
   }:null});
 }
 assert.equal(last.active,null);
 assert.equal(last.lastResolved.status,'expired-without-plane-or-contact');
 assert.equal(last.lastResolved.physicalSampleCount,SHOT_BOUNDARY_WINDOW_TICKS+1);
 assert.ok(last.lastResolved.observedGroundPathM>0);
 assert.equal(last.lastResolved.goalScored,null);
});
