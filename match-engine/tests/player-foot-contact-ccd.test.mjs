// ME-PB-13 — investigate *observed* CCD motion clamping vs discrete
// Rapier COLLISION_EVENTS. NEVER treat a whole-ball trajectory deviation as a
// confirmed touch, a solver impulse, a ball owner, or an exact substep TOI.
// Fixed reference-player schedule holds all 22 autonomous foot trajectories
// equal between all worlds; no scripted moves or synthetic Rapier events.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,FIXED_DT}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,PLAYER_DT}
 from '../src/player-movement.mjs';

const RAPIER=await initializeRapier(rapierModule);
const length=v=>Math.hypot(v.x,v.y,v.z);
const separation=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const fmt=n=>n===null?null:Math.round(n*1e6)/1e6;
const EPS=1e-6;
const configs=Object.freeze([
 Object.freeze({name:'fast-16-ccd-regression',x:-6,y:0,vx:16,vy:0,ticks:35,fast:true}),
 Object.freeze({name:'very-fast-24',x:-6,y:0,vx:24,vy:0,ticks:35}),
 Object.freeze({name:'medium-4',x:-6,y:0,vx:4,vy:0,ticks:65}),
 Object.freeze({name:'slow-0.8',x:-5.18,y:0,vx:0.8,vy:0,ticks:45}),
 Object.freeze({name:'turf-only-negative',preset:'bounce',x:0,y:0,z:2,vx:0,vy:0,ticks:80,negative:true})
]);
function run(c){
 const input={preset:c.preset??'roll',seed:'pb13-'+c.name,
  x:c.x,y:c.y,z:c.z??0,vx:c.vx,vy:c.vy,vz:0};
 const baseline=createEngine(RAPIER,input);
 const withCcd=createEngine(RAPIER,input,{diagnosticPlayerFootContactsEnabled:true});
 const withoutCcd=c.negative?null:createEngine(RAPIER,input,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticBallCcdEnabled:false
 });
 const mover=createPlayerMovement();
 const trace=[],onsets=[],forceTicks={ccdOn:0,ccdOff:0};
 let firstOnsetOn=null,firstOnsetOff=null,firstDivergenceOn=null,firstDivergenceOff=null;
 let firstPreEventOn=null,firstPreEventOff=null;
 let preEventMaxPositionOn=0,preEventMaxVelocityOn=0;
 let preEventMaxPositionOff=0,preEventMaxVelocityOff=0;
 let noCcdControlDivergenceBeforeCcdOnStart=null;
 let witness=null;
 try{
  assert.deepEqual(baseline.snapshot(),withCcd.snapshot());
  if(withoutCcd)assert.deepEqual(baseline.snapshot(),withoutCcd.snapshot());
  assert.equal(baseline.footContactSnapshot,undefined);
  for(let tick=1;tick<=c.ticks;tick++){
   const before=baseline.snapshot(),beforeOn=withCcd.snapshot();
   const playerFrame=mover.step(before.ball.position);
   assert.equal(playerFrame.tick,tick);
   assert.equal(playerFrame.timeS,tick*PLAYER_DT);
   assert.equal(playerFrame.players.length,INITIAL_PLAYERS.length);
   const control=baseline.step(),on=withCcd.step(playerFrame);
   const off=withoutCcd?withoutCcd.step(playerFrame):null;
   const eventOn=withCcd.footContactSnapshot();
   const forceOn=withCcd.footContactSolverSnapshot();
   const eventOff=withoutCcd?.footContactSnapshot?.();
   const forceOff=withoutCcd?.footContactSolverSnapshot?.();
   assert.equal(on.tick,tick);
   assert.equal(control.tick,tick);
   assert.equal(eventOn.tick,tick);
   assert.equal(forceOn.tick,tick);
   assert.equal(withCcd.footContactQualificationSnapshot().possessionInferred,false);
   if(off){
    assert.equal(off.tick,tick);
    assert.equal(eventOff.tick,tick);
    assert.equal(forceOff.tick,tick);
    assert.equal(withoutCcd.footContactQualificationSnapshot().possessionInferred,false);
   }
   const distOn=separation(control.ball.position,on.ball.position);
   const velOn=separation(control.ball.velocity,on.ball.velocity);
   const distOff=off?separation(control.ball.position,off.ball.position):null;
   const velOff=off?separation(control.ball.velocity,off.ball.velocity):null;
   const startOn=eventOn.started;
   const startOff=eventOff?.started??[];
   if(startOn.length&&firstOnsetOn===null)firstOnsetOn=tick;
   if(startOff.length&&firstOnsetOff===null)firstOnsetOff=tick;
   if(forceOn.reportedForcePairs)forceTicks.ccdOn++;
   if(forceOff?.reportedForcePairs)forceTicks.ccdOff++;
   if(firstDivergenceOn===null&&(distOn>EPS||velOn>EPS))
    firstDivergenceOn=tick;
   if(off&&firstDivergenceOff===null&&(distOff>EPS||velOff>EPS))
    firstDivergenceOff=tick;
   if(firstOnsetOn===null){
    preEventMaxPositionOn=Math.max(preEventMaxPositionOn,distOn);
    preEventMaxVelocityOn=Math.max(preEventMaxVelocityOn,velOn);
    if(firstPreEventOn===null&&(distOn>EPS||velOn>EPS)){
     firstPreEventOn=tick;
     const worldDx=control.ball.position.x-before.ball.position.x;
     const ccdDx=on.ball.position.x-beforeOn.ball.position.x;
     witness=Object.freeze({
      tick,controlAfter:Object.freeze({...control.ball.position}),
      ccdAfter:Object.freeze({...on.ball.position}),
      beforeControl:Object.freeze({...before.ball.position}),
      controlAfterVelocity:Object.freeze({...control.ball.velocity}),
      ccdAfterVelocity:Object.freeze({...on.ball.velocity}),
      positionDifferenceM:distOn,velocityDifferenceMps:velOn,
      // Progress fraction along +X under equal starting positions, not
      // Rapier's internal time of impact; grass/rotation can perturb this.
      measuredRelativeXProgressFraction:
       Math.abs(worldDx)>EPS?ccdDx/worldDx:null
     });
    }
   }
   if(off&&firstOnsetOff===null){
    preEventMaxPositionOff=Math.max(preEventMaxPositionOff,distOff);
    preEventMaxVelocityOff=Math.max(preEventMaxVelocityOff,velOff);
    if(firstPreEventOff===null&&(distOff>EPS||velOff>EPS))
     firstPreEventOff=tick;
   }
   if(off&&firstOnsetOn===null&&firstDivergenceOff!==null&&
      noCcdControlDivergenceBeforeCcdOnStart===null)
    noCcdControlDivergenceBeforeCcdOnStart=tick;
   trace.push(Object.freeze({
    tick,
    control:canonicalSnapshot(control),ccdOn:canonicalSnapshot(on),
    ccdOff:off?canonicalSnapshot(off):null,
    positionDifferenceOnM:distOn,velocityDifferenceOnMps:velOn,
    positionDifferenceOffM:distOff,velocityDifferenceOffMps:velOff
   }));
   onsets.push(Object.freeze({
    tick,ccdOn:Object.freeze([...startOn]),ccdOff:Object.freeze([...startOff]),
    ccdOnPairForceReports:forceOn.reportedForcePairs,
    ccdOffPairForceReports:forceOff?.reportedForcePairs??null
   }));
  }
  return Object.freeze({
   caseName:c.name,firstOnsetOn,firstOnsetOff,
   firstDivergenceOn,firstDivergenceOff,
   firstPreEventOn,firstPreEventOff,
   preEventMaxPositionOn,preEventMaxVelocityOn,
   preEventMaxPositionOff,preEventMaxVelocityOff,
   noCcdControlDivergenceBeforeCcdOnStart,
   witness,forceTicks:Object.freeze({...forceTicks}),
   trace:Object.freeze(trace),onsets:Object.freeze(onsets),
   attribution:'unresolved',possessionInferred:false,
   confirmedCcdToiFraction:null
  });
 }finally{
  baseline.dispose();withCcd.dispose();withoutCcd?.dispose();
 }
}
test('ME-PB-13 invalid CCD switches never affect ordinary baseline/production engine',()=>{
 const config={preset:'roll',x:-6,y:0,z:0,vx:16,vy:0,vz:0};
 for(const option of [0,'false',null,undefined,{},[]]){
  if(option===undefined)continue; // omission is the enabled default.
  assert.throws(()=>createEngine(RAPIER,config,{
   diagnosticPlayerFootContactsEnabled:true,diagnosticBallCcdEnabled:option
  }),/CCD/);
 }
 assert.throws(()=>createEngine(RAPIER,config,{diagnosticBallCcdEnabled:false}),
  /requires opt-in/);
 assert.throws(()=>createEngine(RAPIER,{preset:'launch'},
  {diagnosticPlayerFootContactsEnabled:true,diagnosticBallCcdEnabled:false}),/requires opt-in roll/);
 const normal=createEngine(RAPIER,config),explicit=createEngine(RAPIER,config,
  {diagnosticBallCcdEnabled:true});
 try{
  for(let i=0;i<35;i++){
   assert.deepEqual(canonicalSnapshot(normal.step()),canonicalSnapshot(explicit.step()));
  }
 }finally{normal.dispose();explicit.dispose();}
 const original=createEngine(RAPIER,config,{
  diagnosticPlayerFootContactsEnabled:true,diagnosticBallCcdEnabled:false
 });
 const mover=createPlayerMovement();
 try{
  for(let tick=1;tick<=8;tick++)original.step(mover.step(original.snapshot().ball.position));
  const reset=original.reset(),fresh=createEngine(RAPIER,config,{
   diagnosticPlayerFootContactsEnabled:true,diagnosticBallCcdEnabled:false
  }),a=createPlayerMovement(),b=createPlayerMovement();
  try{
   for(let tick=1;tick<=15;tick++){
    const aa=reset.step(a.step(reset.snapshot().ball.position));
    const bb=fresh.step(b.step(fresh.snapshot().ball.position));
    assert.deepEqual(canonicalSnapshot(aa),canonicalSnapshot(bb));
    assert.deepEqual(reset.footContactSnapshot(),fresh.footContactSnapshot());
   }
  }finally{reset.dispose();fresh.dispose();}
 }finally{original.dispose();}
});
for(const c of configs){
 test('ME-PB-13 real Rapier CCD diagnosis '+c.name+' and exact triple-world replay',()=>{
  const one=run(c),two=run(c);
  assert.deepEqual(one,two,'real source event + 3D trajectory replay must be byte-identical');
  assert.equal(one.attribution,'unresolved');
  assert.equal(one.possessionInferred,false);
  assert.equal(one.confirmedCcdToiFraction,null);
  assert.ok(Object.isFrozen(one)&&Object.isFrozen(one.trace));
  if(c.fast||c.name==='very-fast-24'){
   const firstWitnessTick=c.fast?4:3;
   const firstStartTick=c.fast?5:4;
   const minPositionM=c.fast?0.08:0.21;
   const maxPositionM=c.fast?0.10:0.23;
   assert.equal(one.firstPreEventOn,firstWitnessTick,
    'CCD-only pre-START position clamping must be visible and deterministic');
   assert.equal(one.firstDivergenceOn,firstWitnessTick);
   assert.equal(one.firstOnsetOn,firstStartTick);
   assert.equal(one.firstOnsetOff,firstStartTick,
    'both Rapier event queues report the same first START tick');
   assert.equal(one.firstPreEventOff,null,
    'CCD-disabled comparison must not acquire an earlier position clamp');
   assert.ok(one.preEventMaxPositionOff<=EPS);
   assert.ok(one.preEventMaxVelocityOff<=EPS);
   assert.ok(one.firstDivergenceOff===null||
    one.firstDivergenceOff>=firstStartTick,
    'a discrete START may precede measurable ball response in CCD-off trial');
   assert.ok(one.witness?.positionDifferenceM>minPositionM&&
    one.witness.positionDifferenceM<maxPositionM);
   assert.ok(one.witness.velocityDifferenceMps<EPS,
    'CCD motion clamp moves position while preserving whole-ball velocity');
   assert.ok(one.witness.measuredRelativeXProgressFraction!==null&&
    one.witness.measuredRelativeXProgressFraction>0&&
    one.witness.measuredRelativeXProgressFraction<1);
   assert.deepEqual(one.onsets[firstWitnessTick-1].ccdOn,[],
    'no fabricated Rapier collision START in earlier CCD clamp tick');
   assert.equal(one.onsets[firstWitnessTick-1].ccdOnPairForceReports,0);
   assert.equal(one.onsets[firstStartTick-1].ccdOn.includes('home-10'),true);
  }
  if(c.name==='very-fast-24'){
   assert.ok(one.firstDivergenceOff>one.firstOnsetOff,
    'a recorded discrete CCD-off START need not imply immediate ball impulse');
  }
  if(c.name==='medium-4'||c.name==='slow-0.8'){
   assert.equal(one.firstPreEventOn,null);
   assert.equal(one.firstPreEventOff,null);
   assert.equal(one.firstDivergenceOn,one.firstOnsetOn);
   assert.equal(one.firstDivergenceOff,one.firstOnsetOff);
  }
  if(c.negative){
   assert.equal(one.firstOnsetOn,null);
   assert.equal(one.firstDivergenceOn,null);
   assert.equal(one.firstPreEventOn,null);
   assert.deepEqual(one.trace.map(x=>x.control),one.trace.map(x=>x.ccdOn));
  }
  process.stdout.write('ME_PB_13_CCD '+JSON.stringify({
   scenario:c.name,ccdOnStartTick:one.firstOnsetOn,
   ccdOffStartTick:one.firstOnsetOff,
   ccdOnFirstDivergenceTick:one.firstDivergenceOn,
   ccdOffFirstDivergenceTick:one.firstDivergenceOff,
   ccdOnFirstPreEventTick:one.firstPreEventOn,
   ccdOffFirstPreEventTick:one.firstPreEventOff,
   ccdOnPreEventMaxPositionM:fmt(one.preEventMaxPositionOn),
   ccdOnPreEventMaxVelocityMps:fmt(one.preEventMaxVelocityOn),
   ccdOffPreEventMaxPositionM:fmt(one.preEventMaxPositionOff),
   ccdOffPreEventMaxVelocityMps:fmt(one.preEventMaxVelocityOff),
   ccdWitnessPositionOnly:one.witness!==null&&one.witness.velocityDifferenceMps<EPS,
   ccdWitnessRelativeXProgressFraction:fmt(one.witness?.measuredRelativeXProgressFraction??null),
   ccdOnForceReportTicks:one.forceTicks.ccdOn,
   ccdOffForceReportTicks:one.forceTicks.ccdOff,
   confirmedCcdToiFraction:null,
   eventTimingCannotInferTouch:true,identicalReplay:true
  })+'\n');
 });
}
