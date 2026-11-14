// ME-PB-14 — real Rapier event / force-sample provenance boundary.
// Test-only observations: START, solver force and a whole-ball trajectory
// difference are three distinct signals. None proves a kick or possession.
// All player paths are the SAME externally driven reference path per world.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS}
 from '../src/player-movement.mjs';

const RAPIER=await initializeRapier(rapierModule);
const EPS=1e-6;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const cases=Object.freeze([
 Object.freeze({name:'fast-16',x:-6,vx:16,ticks:45,ccdWitness:4,onset:5}),
 Object.freeze({name:'very-fast-24',x:-6,vx:24,ticks:45,ccdWitness:3,onset:4}),
 Object.freeze({name:'medium-4',x:-6,vx:4,ticks:110,positive:true}),
 Object.freeze({name:'slow-0.8',x:-5.18,vx:0.8,ticks:60}),
 Object.freeze({name:'turf-only',preset:'bounce',x:0,z:2,vx:0,ticks:80,negative:true}),
 Object.freeze({name:'airborne',preset:'launch',x:-4.8,z:4,vx:0,ticks:30,negative:true}),
 Object.freeze({name:'distant',x:0,vx:0,ticks:60,negative:true})
]);
function readRealEvidence(engine,tick){
 const collision=engine.footContactSnapshot();
 const solver=engine.footContactSolverSnapshot();
 const qualification=engine.footContactQualificationSnapshot();
 assert.equal(collision.tick,tick);
 assert.equal(solver.tick,tick);
 assert.equal(qualification.tick,tick);
 assert.equal(qualification.attribution,'unresolved');
 assert.equal(qualification.possessionInferred,false);
 assert.equal(Object.hasOwn(qualification,'touch'),false);
 assert.equal(Object.hasOwn(qualification,'owner'),false);
 const reports=[];
 for(const pair of solver.pairs){
  assert.equal(pair.collisionActive,collision.active.includes(pair.id));
  assert.equal(pair.beganThisTick,collision.started.includes(pair.id));
  assert.equal(pair.endedThisTick,collision.ended.includes(pair.id));
  if(pair.rapierForceReported){
   assert.ok(Number.isFinite(pair.derivedNetImpulseMagnitudeNs));
   assert.ok(pair.derivedNetImpulseMagnitudeNs>=0);
   assert.ok(pair.totalForceWorldN!==null);
   reports.push(Object.freeze({
    id:pair.id,reportedPairImpulseMagnitudeNs:pair.derivedNetImpulseMagnitudeNs,
    solverContactCount:pair.manifolds.reduce((sum,m)=>sum+m.solverContacts,0)
   }));
  }else{
   assert.equal(pair.derivedNetImpulseMagnitudeNs,null,
    'a missing Rapier event is UNKNOWN, not a zero impulse');
   assert.equal(pair.totalForceWorldN,null);
  }
 }
 assert.equal(solver.reportedForcePairs,reports.length);
 const started=Object.freeze([...collision.started]);
 const active=Object.freeze([...collision.active]);
 const ended=Object.freeze([...collision.ended]);
 const unforcedStarts=Object.freeze(started.filter(id=>
  !reports.some(report=>report.id===id)));
 const forcesWithoutNewStart=Object.freeze(reports
  .filter(report=>!started.includes(report.id)).map(report=>report.id));
 // These are observation labels ONLY, explicitly never player-touch labels.
 const evidenceLabel=reports.length>1?'multi-pair-force-ambiguous':
  reports.length===1?'reported-pair-force-not-attributed':
  started.length?'start-without-force-report':'no-force-report';
 return Object.freeze({
  tick,started,active,ended,reports:Object.freeze(reports),
  unforcedStarts,forcesWithoutNewStart,evidenceLabel,
  attribution:'unresolved',possessionInferred:false,confirmedTouch:false
 });
}
function run(c){
 const input={preset:c.preset??'roll',seed:'pb14-'+c.name,
  x:c.x,y:0,z:c.z??0,vx:c.vx,vy:0,vz:0};
 const control=createEngine(RAPIER,input);
 const shoeOn=createEngine(RAPIER,input,{diagnosticPlayerFootContactsEnabled:true});
 // CCD OFF is an allowed roll/shoe research world, NEVER default behavior.
 const shoeNoCcd=c.ccdWitness?createEngine(RAPIER,input,{
  diagnosticPlayerFootContactsEnabled:true,diagnosticBallCcdEnabled:false
 }):null;
 const mover=createPlayerMovement(),trace=[];
 try{
  assert.equal(control.footContactSnapshot,undefined);
  for(let tick=1;tick<=c.ticks;tick++){
   const frame=mover.step(control.snapshot().ball.position);
   assert.equal(frame.tick,tick);
   assert.equal(frame.players.length,INITIAL_PLAYERS.length);
   const baseline=control.step();
   const on=shoeOn.step(frame);
   const off=shoeNoCcd?.step(frame);
   const onEvidence=readRealEvidence(shoeOn,tick);
   const offEvidence=shoeNoCcd?readRealEvidence(shoeNoCcd,tick):null;
   trace.push(Object.freeze({
    tick,reference:canonicalSnapshot(baseline),
    shoeCcdOn:canonicalSnapshot(on),
    shoeCcdOff:off?canonicalSnapshot(off):null,
    onPositionDeltaM:distance(baseline.ball.position,on.ball.position),
    onVelocityDeltaMps:distance(baseline.ball.velocity,on.ball.velocity),
    offPositionDeltaM:off?distance(baseline.ball.position,off.ball.position):null,
    offVelocityDeltaMps:off?distance(baseline.ball.velocity,off.ball.velocity):null,
    onEvidence,offEvidence
   }));
  }
  return Object.freeze(trace);
 }finally{
  control.dispose();shoeOn.dispose();shoeNoCcd?.dispose();
 }
}
const first=(rows,condition)=>rows.find(condition)?.tick??null;
const count=(rows,accessor)=>rows.reduce((total,row)=>total+accessor(row),0);

test('ME-PB-14 ordinary physics remains uninstrumented and unchanged',()=>{
 const input={preset:'roll',seed:'pb14-default',x:-6,y:0,z:0,vx:4,vy:0,vz:0};
 const a=createEngine(RAPIER,input),b=createEngine(RAPIER,input);
 try{
  assert.equal(a.footContactSnapshot,undefined);
  assert.equal(a.footContactSolverSnapshot,undefined);
  for(let i=0;i<60;i++)
   assert.equal(canonicalSnapshot(a.step()),canonicalSnapshot(b.step()));
 }finally{a.dispose();b.dispose();}
});

for(const c of cases){
 test('ME-PB-14 real Rapier independent force/event evidence '+c.name,()=>{
  const a=run(c),b=run(c);
  assert.deepEqual(a,b,'two independent real Rapier world sets must replay exactly');
  assert.ok(Object.isFrozen(a)&&a.every(r=>Object.isFrozen(r)&&
   Object.isFrozen(r.onEvidence)&&Object.isFrozen(r.onEvidence.reports)));
  const firstOnset=first(a,r=>r.onEvidence.started.length>0);
  const firstForce=first(a,r=>r.onEvidence.reports.length>0);
  const firstVelocityResponse=first(a,r=>r.onVelocityDeltaMps>EPS);
  const totalUnforcedStarts=count(a,r=>r.onEvidence.unforcedStarts.length);
  const totalForceOnlyTicks=count(a,r=>r.onEvidence.forcesWithoutNewStart.length);
  const totalStarts=count(a,r=>r.onEvidence.started.length);
  const totalReportedPairs=count(a,r=>r.onEvidence.reports.length);
  assert.ok(a.every(r=>r.onEvidence.confirmedTouch===false&&
   r.onEvidence.possessionInferred===false&&
   r.onEvidence.attribution==='unresolved'));
  // A true START is not a force event, a positive solver sample isn't an
  // exclusive player impulse, and a CCD clamp isn't a discrete START.
  for(const row of a){
   const e=row.onEvidence;
   assert.equal(e.unforcedStarts.length,
    e.started.filter(id=>!e.reports.some(f=>f.id===id)).length);
   if(e.reports.length===0)
    assert.ok(['start-without-force-report','no-force-report']
     .includes(e.evidenceLabel));
   if(e.reports.length===1)
    assert.equal(e.evidenceLabel,'reported-pair-force-not-attributed');
   if(e.reports.length>1)
    assert.equal(e.evidenceLabel,'multi-pair-force-ambiguous');
  }
  if(c.ccdWitness){
   const witness=a[c.ccdWitness-1],early=witness.onEvidence;
   assert.equal(firstOnset,c.onset,'actual first Rapier START must stay visible');
   assert.equal(first(a,r=>r.offEvidence.started.length>0),c.onset,
    'CCD ON and OFF discrete START ticks must remain identical');
   assert.equal(early.started.length,0,'CCD clamp is not a START');
   assert.equal(early.reports.length,0,'CCD clamp is not a force sample');
   assert.equal(early.confirmedTouch,false);
   assert.ok(witness.onPositionDeltaM>0.08,
    'retain real CCD motion-clamp position evidence');
   assert.ok(witness.onVelocityDeltaMps<EPS,
    'CCD may clamp position without changing ball velocity');
   for(const row of a.slice(0,c.onset-1)){
    assert.equal(row.offEvidence.started.length,0);
    assert.equal(row.offEvidence.reports.length,0);
    assert.ok(row.offPositionDeltaM<=EPS,
     'CCD-off cannot acquire a fabricated pre-START position response');
    assert.ok(row.offVelocityDeltaMps<=EPS);
   }
  }
  if(c.positive){
   assert.ok(totalStarts>0,'real Rapier onset required for positive control');
   assert.ok(totalReportedPairs>0,'real Rapier solver force required');
  }
  if(c.negative){
   assert.equal(totalStarts,0);
   assert.equal(totalReportedPairs,0);
   assert.equal(firstVelocityResponse,null);
   assert.ok(a.every(r=>r.onPositionDeltaM<=EPS));
   assert.ok(a.every(r=>r.reference===r.shoeCcdOn));
  }
  process.stdout.write('ME_PB_14_PROVENANCE '+JSON.stringify({
   scenario:c.name,firstDiscreteStartTick:firstOnset,
   firstReportedPairForceTick:firstForce,
   firstWholeBallVelocityDifferenceTick:firstVelocityResponse,
   totalRealStarts:totalStarts,totalReportedPairForceSamples:totalReportedPairs,
   startsWithoutSameTickPairForce:totalUnforcedStarts,
   pairForceSamplesWithoutNewStart:totalForceOnlyTicks,
   firstCcdClampTick:c.ccdWitness??null,
   ccdOnOffEventStartAgrees:c.ccdWitness?
    first(a,r=>r.offEvidence.started.length>0)===firstOnset:null,
   calibratedFootImpulse:false,confirmedTouch:false,
   possessionInferred:false,exactReplay:true
  })+'\n');
 });
}
