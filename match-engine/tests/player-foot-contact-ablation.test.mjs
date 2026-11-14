// ME-PB-16 — real leave-one-foot-out Rapier counterfactual.
// One genuine kinematic shoe collider is omitted in an explicitly opt-in
// roll-world research control; all 22 autonomous player frames stay identical.
// The measured whole-ball A/B difference is the *marginal collider-system*
// response, NOT an inferred exclusive foot impulse, human intent, or possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS} from '../src/player-movement.mjs';

const RAPIER=await initializeRapier(rapierModule);
const EPS=1e-6;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const configs=Object.freeze([
 Object.freeze({name:'medium-home',x:-6,y:0,vx:4,vy:0,
  ticks:110,omit:'home-10',expected:true}),
 Object.freeze({name:'fast-home-ccd',x:-6,y:0,vx:16,vy:0,
  ticks:65,omit:'home-10',expected:true,ccdWitness:true}),
 Object.freeze({name:'mirrored-away',x:6,y:0,vx:-4,vy:0,
  ticks:110,omit:'away-10',expected:true}),
 Object.freeze({name:'grazing-home',x:-5.25,y:-0.14,vx:2,vy:0.1,
  ticks:200,omit:'home-10',expected:true}),
 Object.freeze({name:'sustained-home',x:-4.96,y:0,vx:0.3,vy:0,
  ticks:210,omit:'home-10',expected:true}),
 Object.freeze({name:'distant-negative',x:0,y:0,vx:0,vy:0,
  ticks:70,omit:'home-10',negative:true})
]);

function simulate(c){
 const input={preset:'roll',seed:'pb16-'+c.name,
  x:c.x,y:c.y,z:0,vx:c.vx,vy:c.vy,vz:0};
 const baseline=createEngine(RAPIER,input);
 const allShoes=createEngine(RAPIER,input,{diagnosticPlayerFootContactsEnabled:true});
 const withoutTarget=createEngine(RAPIER,input,{
  diagnosticPlayerFootContactsEnabled:true,diagnosticOmittedFootId:c.omit
 });
 const player=createPlayerMovement(),trace=[];
 let starts=0,reportedForceSamples=0;
 try{
  assert.deepEqual(baseline.snapshot(),allShoes.snapshot());
  assert.deepEqual(allShoes.snapshot(),withoutTarget.snapshot());
  assert.equal(baseline.footContactSnapshot,undefined);
  for(let tick=1;tick<=c.ticks;tick++){
   const frame=player.step(baseline.snapshot().ball.position);
   assert.equal(frame.tick,tick);
   assert.equal(frame.players.length,INITIAL_PLAYERS.length,
    'the omitted collider NEVER removes a player from the 22-player motion');
   const reference=baseline.step();
   const full=allShoes.step(frame);
   const omitted=withoutTarget.step(frame);
   const fullEvents=allShoes.footContactSnapshot();
   const omittedEvents=withoutTarget.footContactSnapshot();
   const fullForces=allShoes.footContactSolverSnapshot();
   const omittedForces=withoutTarget.footContactSolverSnapshot();
   const fullQualification=allShoes.footContactQualificationSnapshot();
   const omittedQualification=withoutTarget.footContactQualificationSnapshot();
   assert.equal(fullEvents.tick,tick);
   assert.equal(omittedEvents.tick,tick);
   assert.equal(fullForces.tick,tick);
   assert.equal(omittedForces.tick,tick);
   assert.equal(fullQualification.possessionInferred,false);
   assert.equal(omittedQualification.possessionInferred,false);
   assert.equal(fullQualification.attribution,'unresolved');
   assert.equal(omittedQualification.attribution,'unresolved');
   for(const rows of [
    omittedEvents.started,omittedEvents.active,omittedEvents.ended,
    omittedForces.pairs.map(p=>p.id),
    omittedQualification.onsets.map(p=>p.id),
    omittedQualification.forceReportedIds
   ])assert.ok(!rows.includes(c.omit),
    'an omitted physical shoe cannot generate a real Rapier pair event');
   for(const p of fullForces.pairs){
    if(p.rapierForceReported){
     assert.ok(Number.isFinite(p.derivedNetImpulseMagnitudeNs));
     assert.ok(p.derivedNetImpulseMagnitudeNs>=0);
    }else assert.equal(p.derivedNetImpulseMagnitudeNs,null);
   }
   for(const p of omittedForces.pairs){
    if(!p.rapierForceReported)
     assert.equal(p.derivedNetImpulseMagnitudeNs,null);
   }
   starts+=fullEvents.started.filter(id=>id===c.omit).length;
   reportedForceSamples+=fullForces.pairs.filter(p=>
    p.id===c.omit&&p.rapierForceReported).length;
   trace.push(Object.freeze({
    tick,referenceBall:canonicalSnapshot(reference),
    allShoesBall:canonicalSnapshot(full),
    ablatedBall:canonicalSnapshot(omitted),
    positionDeltaM:distance(full.ball.position,omitted.ball.position),
    velocityDeltaMps:distance(full.ball.velocity,omitted.ball.velocity),
    fullStart:Object.freeze([...fullEvents.started]),
    fullEnd:Object.freeze([...fullEvents.ended]),
    fullForces:Object.freeze(fullForces.pairs.filter(p=>
     p.rapierForceReported).map(p=>Object.freeze({
      id:p.id,derivedSampleImpulseNs:p.derivedNetImpulseMagnitudeNs
     }))),
    omittedStart:Object.freeze([...omittedEvents.started]),
    omittedEnd:Object.freeze([...omittedEvents.ended]),
    omittedForcePairs:Object.freeze(omittedForces.pairs.filter(p=>
     p.rapierForceReported).map(p=>p.id))
   }));
  }
  return Object.freeze({name:c.name,target:c.omit,
   physicalTargetStarts:starts,reportedTargetForceSamples:reportedForceSamples,
   trace:Object.freeze(trace),attribution:'unresolved',
   confirmedTouch:false,playerIntentInferred:false,possessionInferred:false,
   individualFootImpulseProven:false});
 }finally{
  baseline.dispose();allShoes.dispose();withoutTarget.dispose();
 }
}
const first=(rows,predicate)=>rows.find(predicate)?.tick??null;
test('ME-PB-16 omitted foot switch strict DEV roll-only allowlist and deterministic reset',()=>{
 const roll={preset:'roll',x:-6,y:0,z:0,vx:4,vy:0,vz:0};
 for(const invalid of [false,0,1,{},[],['home-10'],'home-999','HOME-10','']){
  assert.throws(()=>createEngine(RAPIER,roll,{
   diagnosticPlayerFootContactsEnabled:true,diagnosticOmittedFootId:invalid
  }),/omitted foot ID/i);
 }
 assert.throws(()=>createEngine(RAPIER,roll,{
  diagnosticOmittedFootId:'home-10'
 }),/requires opt-in roll/);
 assert.throws(()=>createEngine(RAPIER,{preset:'launch'},{
  diagnosticPlayerFootContactsEnabled:true,diagnosticOmittedFootId:'home-10'
 }),/requires opt-in roll/);
 const opted=createEngine(RAPIER,roll,{
  diagnosticPlayerFootContactsEnabled:true,diagnosticOmittedFootId:'home-10'
 });
 const player=createPlayerMovement();
 try{
  for(let i=0;i<6;i++)opted.step(player.step(opted.snapshot().ball.position));
  const reset=opted.reset(),fresh=createEngine(RAPIER,roll,{
   diagnosticPlayerFootContactsEnabled:true,diagnosticOmittedFootId:'home-10'
  });
  const pa=createPlayerMovement(),pb=createPlayerMovement();
  try{
   for(let t=1;t<=30;t++){
    const a=pa.step(reset.snapshot().ball.position);
    const b=pb.step(fresh.snapshot().ball.position);
    assert.equal(canonicalSnapshot(reset.step(a)),canonicalSnapshot(fresh.step(b)));
    assert.deepEqual(reset.footContactSnapshot(),fresh.footContactSnapshot());
    assert.ok(!reset.footContactSnapshot().started.includes('home-10'));
   }
  }finally{reset.dispose();fresh.dispose();}
 }finally{opted.dispose();}
});
test('ME-PB-16 normal default and explicit omitted=null match, with no instrumented default state',()=>{
 const roll={preset:'roll',x:-6,y:0,z:0,vx:4,vy:0,vz:0};
 const base=createEngine(RAPIER,roll);
 const explicit=createEngine(RAPIER,roll,{diagnosticOmittedFootId:null});
 const full=createEngine(RAPIER,roll,{diagnosticPlayerFootContactsEnabled:true});
 const fullExplicit=createEngine(RAPIER,roll,{
  diagnosticPlayerFootContactsEnabled:true,diagnosticOmittedFootId:null
 });
 const ma=createPlayerMovement(),mb=createPlayerMovement();
 try{
  assert.equal(base.footContactSnapshot,undefined);
  assert.equal(explicit.footContactSnapshot,undefined);
  for(let i=0;i<80;i++){
   assert.equal(canonicalSnapshot(base.step()),canonicalSnapshot(explicit.step()));
   const a=ma.step(full.snapshot().ball.position);
   const b=mb.step(fullExplicit.snapshot().ball.position);
   assert.equal(canonicalSnapshot(full.step(a)),canonicalSnapshot(fullExplicit.step(b)));
   assert.deepEqual(full.footContactSnapshot(),fullExplicit.footContactSnapshot());
   assert.deepEqual(full.footContactSolverSnapshot(),
    fullExplicit.footContactSolverSnapshot());
  }
 }finally{
  base.dispose();explicit.dispose();full.dispose();fullExplicit.dispose();
 }
});
for(const c of configs){
 test('ME-PB-16 measured 22 vs 21 kinematic-shoe Rapier world '+c.name,()=>{
  const a=simulate(c),b=simulate(c);
  assert.deepEqual(a,b,'two independent sets of three REAL Rapier worlds must replay');
  assert.equal(a.individualFootImpulseProven,false);
  assert.equal(a.confirmedTouch,false);
  assert.equal(a.possessionInferred,false);
  assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.trace));
  const t=a.trace;
  const firstTargetStart=first(t,row=>row.fullStart.includes(c.omit));
  const firstDelta=first(t,row=>row.positionDeltaM>EPS||
   row.velocityDeltaMps>EPS);
  const firstVelocityDelta=first(t,row=>row.velocityDeltaMps>EPS);
  if(c.expected){
   assert.ok(a.physicalTargetStarts>0,'full trial must generate REAL target contact');
   assert.ok(a.reportedTargetForceSamples>0,
    'full trial must measure at least one REAL Rapier target pair-force sample');
   assert.ok(firstDelta!==null,'the ablated single shoe must have a measurable marginal effect');
   assert.ok(firstVelocityDelta!==null,'whole-ball physical motion must diverge');
  }
  if(c.ccdWitness){
   const witness=t[3];
   assert.equal(firstDelta,4,'CCD shoe-omission pre-START motion clamp must remain observable');
   assert.equal(firstTargetStart,5);
   assert.ok(witness.positionDeltaM>0.08);
   assert.ok(witness.velocityDeltaMps<EPS);
   assert.ok(!witness.fullStart.includes(c.omit));
   assert.ok(!witness.fullForces.some(p=>p.id===c.omit));
  }
  if(c.negative){
   assert.equal(a.physicalTargetStarts,0);
   assert.equal(a.reportedTargetForceSamples,0);
   assert.equal(firstDelta,null);
   assert.equal(firstVelocityDelta,null);
   assert.ok(t.every(row=>row.allShoesBall===row.ablatedBall));
  }
  process.stdout.write('ME_PB_16_ABLATION '+JSON.stringify({
   scenario:c.name,omitted:c.omit,
   firstTargetStartTick:firstTargetStart,
   firstMarginalBallDifferenceTick:firstDelta,
   firstMarginalVelocityDifferenceTick:firstVelocityDelta,
   measuredTargetStarts:a.physicalTargetStarts,
   measuredTargetPairForceSamples:a.reportedTargetForceSamples,
   finalWholeBallPositionDeltaM:t.at(-1).positionDeltaM,
   finalWholeBallVelocityDeltaMps:t.at(-1).velocityDeltaMps,
   individualFootImpulseProven:false,confirmedTouch:false,
   possessionInferred:false,identicalReplay:true
  })+'\n');
 });
}
