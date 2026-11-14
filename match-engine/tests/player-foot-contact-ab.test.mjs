// ME-PB-12 — paired physical counterfactual, RAPiER vs exactly same Rapier.
// Treatment: opt-in kinematic 22-foot shoe colliders. Control: no foot bodies.
// All other scenario, fixed timestep, actual measured ball parameters, engine
// coefficients, initial conditions and (externally chosen) player motion match.
// Player commands come from the reference BALL at every tick, not the treated
// ball, to avoid hiding treatment effects inside tactical feedback. A/B output
// is a WHOLE-WORLD trajectory delta, NEVER a per-foot impulse or possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,FIXED_DT}
 from '../src/core.mjs';
import {createPlayerMovement,PLAYER_DT,INITIAL_PLAYERS}
 from '../src/player-movement.mjs';

const RAPIER=await initializeRapier(rapierModule);
const xyz=Object.freeze(['x','y','z']);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const distance=(a,b)=>Math.hypot(...xyz.map(k=>a[k]-b[k]));
const length=v=>Math.hypot(v.x,v.y,v.z);
const round=n=>Math.round(n*1e6)/1e6;
const turn=(a,b)=>{
 const denom=length(a)*length(b);
 if(denom<=1e-12)return null;
 return Math.acos(Math.max(-1,Math.min(1,
  (a.x*b.x+a.y*b.y+a.z*b.z)/denom)))*180/Math.PI;
};
const QUANTIZATION_TOLERANCE_M=1e-6;
const one=Object.freeze([
 {name:'stationary',x:-4.78,y:0,vx:0,vy:0,ticks:65,target:'home-10',positive:true},
 {name:'slow',x:-5.18,y:0,vx:0.8,vy:0,ticks:110,target:'home-10',positive:true},
 {name:'medium',x:-6,y:0,vx:4,vy:0,ticks:105,target:'home-10',positive:true},
 {name:'fast',x:-6,y:0,vx:16,vy:0,ticks:75,target:'home-10',positive:true},
 {name:'lateral',x:-4.78,y:-0.55,vx:0,vy:3.5,ticks:100,target:'home-10',positive:true},
 {name:'mirrored-away',x:6,y:0,vx:-4,vy:0,ticks:105,target:'away-10',positive:true},
 {name:'grazing-recontacts',x:-5.25,y:-0.14,vx:2,vy:0.1,ticks:185,target:'home-10',positive:true,recontacts:true},
 {name:'medium-soft-foot',x:-6,y:0,vx:4,vy:0,ticks:100,restitution:0,target:'home-10',positive:true},
 {name:'medium-firm-foot',x:-6,y:0,vx:4,vy:0,ticks:100,restitution:0.35,target:'home-10',positive:true},
 {name:'turf-only-bounce',preset:'bounce',x:0,y:0,z:2,vx:0,vy:0,ticks:125,negative:true},
 {name:'airborne-negative',preset:'launch',x:-4.78,y:0,z:3,vx:0,vy:0,ticks:35,negative:true},
 {name:'distant-stationary',x:0,y:0,vx:0,vy:0,ticks:70,negative:true}
].map(x=>Object.freeze(x)));

function paired(config){
 const initial={
  preset:config.preset??'roll',seed:'pb12-'+config.name,
  x:config.x,y:config.y,z:config.z??0,
  vx:config.vx,vy:config.vy,vz:0
 };
 const without=createEngine(RAPIER,initial);
 const withFeet=createEngine(RAPIER,initial,{
  diagnosticPlayerFootContactsEnabled:true,
  ...(config.restitution===undefined?{}:{diagnosticFootRestitution:config.restitution})
 });
 const mover=createPlayerMovement();
 const baselineTrace=[],enabledTrace=[],events=[],episodeEnd=[],metrics=[];
 let firstOnsetTick=null,firstDivergenceTick=null,forceEventTicks=0;
 let preEventDivergenceTickCount=0,firstPreEventDivergenceTick=null;
 let maxPositionDifferenceM=0,maxVelocityDifferenceMps=0;
 let cumulativeControlDistanceM=0,cumulativeExperimentalDistanceM=0;
 let maxPreOnsetPositionDifferenceM=0,maxPreOnsetVelocityDifferenceMps=0;
 let referenceTurfOnlyBounces=0,footTurfOnlyBounces=0;
 try{
  assert.equal(without.footContactSnapshot,undefined);
  assert.equal(without.footContactSolverSnapshot,undefined);
  assert.equal(without.footContactQualificationSnapshot,undefined);
  assert.equal(without.ballProperties.massKg,withFeet.ballProperties.massKg);
  assert.deepEqual(without.snapshot(),withFeet.snapshot(),
   'identical initial canonical ball state');
  const initialMassKg=without.ballProperties.massKg;
  assert.ok(initialMassKg>0);
  for(let tick=1;tick<=config.ticks;tick++){
   const controlBefore=without.snapshot(),treatedBefore=withFeet.snapshot();
   assert.equal(controlBefore.tick,tick-1);
   assert.equal(treatedBefore.tick,tick-1);
   // Fully exogenous 22-player frame, driven only by reference ball state.
   const playerFrame=mover.step(controlBefore.ball.position);
   assert.equal(playerFrame.tick,tick);
   assert.equal(playerFrame.timeS,tick*PLAYER_DT);
   assert.equal(playerFrame.players.length,INITIAL_PLAYERS.length);
   const controlAfter=without.step();
   const treatedAfter=withFeet.step(playerFrame);
   assert.equal(controlAfter.tick,tick);
   assert.equal(treatedAfter.tick,tick);
   assert.equal(controlAfter.time,tick*FIXED_DT);
   assert.equal(treatedAfter.time,tick*FIXED_DT);
   const contact=withFeet.footContactSnapshot();
   const timeline=withFeet.footContactTimelineSnapshot();
   const solver=withFeet.footContactSolverSnapshot();
   const qualified=withFeet.footContactQualificationSnapshot();
   assert.equal(contact.tick,tick);
   assert.equal(timeline.tick,tick);
   assert.equal(solver.tick,tick);
   assert.equal(qualified.tick,tick);
   assert.deepEqual(timeline.onsets.map(x=>x.id),contact.started);
   assert.deepEqual(timeline.completed.map(x=>x.id),contact.ended);
   assert.deepEqual(qualified.activeIds,contact.active);
   assert.equal(qualified.possessionInferred,false);
   assert.equal(qualified.attribution,'unresolved');
   if(contact.started.length>0&&firstOnsetTick===null)
    firstOnsetTick=tick;
   if(solver.reportedForcePairs>0)forceEventTicks++;
   const positionDifferenceM=distance(
    controlAfter.ball.position,treatedAfter.ball.position);
   const velocityDifferenceMps=distance(
    controlAfter.ball.velocity,treatedAfter.ball.velocity);
   assert.ok(finite(positionDifferenceM)&&finite(velocityDifferenceMps));
   const beforeFirstOnset=firstOnsetTick===null;
   if(beforeFirstOnset){
    maxPreOnsetPositionDifferenceM=Math.max(maxPreOnsetPositionDifferenceM,
     positionDifferenceM);
    maxPreOnsetVelocityDifferenceMps=Math.max(maxPreOnsetVelocityDifferenceMps,
     velocityDifferenceMps);
    if(positionDifferenceM>QUANTIZATION_TOLERANCE_M||
       velocityDifferenceMps>QUANTIZATION_TOLERANCE_M){
      preEventDivergenceTickCount++;
      if(firstPreEventDivergenceTick===null)firstPreEventDivergenceTick=tick;
    }
   }
   if(firstDivergenceTick===null&&(positionDifferenceM>QUANTIZATION_TOLERANCE_M||
      velocityDifferenceMps>QUANTIZATION_TOLERANCE_M))
    firstDivergenceTick=tick;
   maxPositionDifferenceM=Math.max(maxPositionDifferenceM,positionDifferenceM);
   maxVelocityDifferenceMps=Math.max(maxVelocityDifferenceMps,velocityDifferenceMps);
   cumulativeControlDistanceM+=distance(controlBefore.ball.position,controlAfter.ball.position);
   cumulativeExperimentalDistanceM+=distance(treatedBefore.ball.position,treatedAfter.ball.position);
   const observedTurnDeg=turn(controlAfter.ball.velocity,treatedAfter.ball.velocity);
   assert.ok(observedTurnDeg===null||observedTurnDeg>=0&&observedTurnDeg<=180);
   const record=Object.freeze({
    tick,positionDifferenceM,velocityDifferenceMps,
    controlSpeedMps:length(controlAfter.ball.velocity),
    experimentalSpeedMps:length(treatedAfter.ball.velocity),
    worldVelocityAngleDeg:observedTurnDeg,
    observedWholeBallMomentumDifferenceMagnitudeNs:velocityDifferenceMps*initialMassKg,
    firstOnsetAlreadySeen:firstOnsetTick!==null
   });
   metrics.push(record);
   baselineTrace.push(canonicalSnapshot(controlAfter));
   enabledTrace.push(canonicalSnapshot(treatedAfter));
   events.push(contact);
   episodeEnd.push(...timeline.completed);
   if(controlBefore.ball.velocity.z< -0.05&&
      controlAfter.ball.velocity.z>0.05)referenceTurfOnlyBounces++;
   if(treatedBefore.ball.velocity.z< -0.05&&
      treatedAfter.ball.velocity.z>0.05&&contact.started.length===0&&
      contact.active.length===0&&solver.reportedForcePairs===0)
    footTurfOnlyBounces++;
  }
  const last=metrics.at(-1);
  return Object.freeze({
   configName:config.name,
   controlTrace:Object.freeze(baselineTrace),
   experimentalTrace:Object.freeze(enabledTrace),
   eventTrace:Object.freeze(events),
   finishedEpisodes:Object.freeze(episodeEnd),
   metrics:Object.freeze(metrics),
   firstRapierOnsetTick:firstOnsetTick,
   firstWorldDivergenceTick:firstDivergenceTick,
   firstPreEventDivergenceTick,preEventDivergenceTickCount,
   physicalOnsets:events.reduce((n,e)=>n+e.started.length,0),
   forceEventTicks,
   maxPreOnsetPositionDifferenceM,maxPreOnsetVelocityDifferenceMps,
   maxPositionDifferenceM,maxVelocityDifferenceMps,
   finalPositionDifferenceM:last.positionDifferenceM,
   finalVelocityDifferenceMps:last.velocityDifferenceMps,
   finalWorldVelocityAngleDeg:last.worldVelocityAngleDeg,
   cumulativeControlDistanceM,cumulativeExperimentalDistanceM,
   referenceTurfOnlyBounces,footTurfOnlyBounces,
   attribution:'unresolved',possessionInferred:false,
   exclusivePlayerImpulseProven:false
  });
 }finally{without.dispose();withFeet.dispose();}
}

for(const config of one){
 test('ME-PB-12 controlled Rapier with/without shoes '+config.name+' exact A/B replay',()=>{
  const a=paired(config),b=paired(config);
  assert.deepEqual(a,b,'both entire Rapier 3D worlds must replay exactly');
  assert.equal(a.attribution,'unresolved');
  assert.equal(a.possessionInferred,false);
  assert.equal(a.exclusivePlayerImpulseProven,false);
  assert.equal(a.controlTrace.length,config.ticks);
  assert.equal(a.experimentalTrace.length,config.ticks);
  assert.equal(a.eventTrace.length,config.ticks);
  assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.metrics)&&
   a.metrics.every(x=>Object.isFrozen(x)));
  if(config.positive){
   assert.ok(a.firstRapierOnsetTick!==null,
    'actual physical shoe onset required for a positive A/B');
   assert.ok(a.eventTrace.some(e=>e.started.includes(config.target)),
    'target collision must arise in real Rapier world');
   assert.ok(a.forceEventTicks>=1,
    'positive physics case must contain at least one real force report');
   assert.ok(a.maxPositionDifferenceM>0.001,
    'physical shoe collider experiment must diverge from no-shoe baseline');
   assert.ok(a.firstWorldDivergenceTick!==null);
   if(a.firstWorldDivergenceTick<a.firstRapierOnsetTick){
    // High-speed CCD may alter TOI/solver state BEFORE a collision START is
    // delivered through the discrete event queue. This is NOT a certified
    // touch: retain an explicit unresolved pre-event finding, never silently
    // re-label this tick as a player impact or fabricate an onset/force.
    assert.equal(config.name,'fast',
     'unexplained pre-Rapier-event A/B divergence in another scenario');
    assert.ok(a.preEventDivergenceTickCount>0);
    assert.equal(a.firstPreEventDivergenceTick,a.firstWorldDivergenceTick);
   }else{
    assert.equal(a.preEventDivergenceTickCount,0);
    assert.equal(a.firstPreEventDivergenceTick,null);
    assert.ok(a.maxPreOnsetPositionDifferenceM<=QUANTIZATION_TOLERANCE_M);
    assert.ok(a.maxPreOnsetVelocityDifferenceMps<=QUANTIZATION_TOLERANCE_M);
   }
  }
  if(config.negative){
   assert.equal(a.firstRapierOnsetTick,null);
   assert.equal(a.physicalOnsets,0);
   assert.equal(a.forceEventTicks,0);
   assert.equal(a.firstWorldDivergenceTick,null);
   assert.equal(a.firstPreEventDivergenceTick,null);
   assert.equal(a.preEventDivergenceTickCount,0);
   assert.ok(a.maxPositionDifferenceM<=QUANTIZATION_TOLERANCE_M);
   assert.ok(a.maxVelocityDifferenceMps<=QUANTIZATION_TOLERANCE_M);
   assert.deepEqual(a.controlTrace,a.experimentalTrace,
    'control and shoe-on negative worlds must be canonically identical');
  }
  if(config.name==='turf-only-bounce'){
   assert.ok(a.referenceTurfOnlyBounces>=1);
   assert.equal(a.referenceTurfOnlyBounces,a.footTurfOnlyBounces);
  }
  if(config.recontacts){
   const home=a.eventTrace.flatMap(e=>e.started
    .filter(id=>id==='home-10').map(id=>({id,tick:e.tick})));
   // A/B exogenous reference driving is deliberately different from
   // closed-loop ME-PB-09; only require new true Rapier START after END,
   // never pin exact closed-loop start/end ticks from that other experiment.
   assert.ok(home.length>=2,
    'real shoe-collision returns must be observed, not scripted');
   for(let i=1;i<home.length;i++){
    const priorEnd=a.eventTrace.some(e=>e.tick>home[i-1].tick&&
     e.tick<home[i].tick&&e.ended.includes('home-10'));
    assert.ok(priorEnd,'same-player new Rapier START requires previous END');
   }
  }
  process.stdout.write('ME_PB_12_AB '+JSON.stringify({
   scenario:config.name,firstContact:a.firstRapierOnsetTick,
   firstDivergence:a.firstWorldDivergenceTick,physicalOnsets:a.physicalOnsets,
   forceReportTicks:a.forceEventTicks,
   maxBallPositionDifferenceM:round(a.maxPositionDifferenceM),
   finalBallPositionDifferenceM:round(a.finalPositionDifferenceM),
   maxVelocityDifferenceMps:round(a.maxVelocityDifferenceMps),
   finalVelocityDifferenceMps:round(a.finalVelocityDifferenceMps),
   finalWorldVelocityAngleDeg:a.finalWorldVelocityAngleDeg===null?null:
    round(a.finalWorldVelocityAngleDeg),
   referenceDistanceM:round(a.cumulativeControlDistanceM),
   experimentalDistanceM:round(a.cumulativeExperimentalDistanceM),
   noBallDivergenceBeforeRapierContact:a.preEventDivergenceTickCount===0,
   unclassifiedPreEventDivergenceFirstTick:a.firstPreEventDivergenceTick,
   unclassifiedPreEventDivergenceTicks:a.preEventDivergenceTickCount,
   maxPreEventBallPositionDifferenceM:round(a.maxPreOnsetPositionDifferenceM),
   maxPreEventVelocityDifferenceMps:round(a.maxPreOnsetVelocityDifferenceMps),
   identicalReplay:true,attribution:a.attribution,
   playerPathPolicy:'reference-ball-exogenous'
  })+'\n');
 });
}
