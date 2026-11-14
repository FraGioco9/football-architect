// ME-PB-07: actual ball momentum change and reported Rapier pair impulses
// remain independent evidence, not an invented kick or exclusive attribution.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {BALL_MASS_KG,FIXED_DT,createEngine,canonicalSnapshot,initializeRapier}
 from '../src/core.mjs';
import {createPlayerMovement} from '../src/player-movement.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION} from '../src/player-foot-contact-solver.mjs';
import {FOOT_MOMENTUM_AUDIT_VERSION,summarizeFootMomentumAudit}
 from '../src/player-foot-contact-momentum.mjs';

const sample=(tick,v)=>({
 version:'me-01-physics-v4',tick,time:tick*FIXED_DT,
 ball:{position:{x:0,y:0,z:0.11},velocity:v}
});
const pair=(id='home-10')=>({
 id,rapierForceReported:true,totalForceWorldN:{x:12,y:0,z:0},
 totalForceMagnitudeN:12,maxContactForceMagnitudeN:12,
 derivedNetImpulseWorldNs:{x:12*FIXED_DT,y:0,z:0},
 derivedNetImpulseMagnitudeNs:12*FIXED_DT,
 manifolds:[{normalWorld:{x:-1,y:0,z:0},solverContacts:1}]
});
const solver=(tick,pairs)=>({
 version:FOOT_SOLVER_EVIDENCE_VERSION,tick,pairs,
 reportedForcePairs:pairs.filter(p=>p.rapierForceReported).length,
 simultaneousSolverPairs:pairs.filter(p=>p.rapierForceReported).length>=2
});
const before=sample(0,{x:2,y:0,z:0});
const after=sample(1,{x:3,y:0,z:-0.1});

test('ME-PB-07 measured ball delta-momentum and Rapier pair impulse remain separate independent units',()=>{
 const record=summarizeFootMomentumAudit(before,after,solver(1,[pair()]),BALL_MASS_KG);
 assert.equal(record.version,FOOT_MOMENTUM_AUDIT_VERSION);
 assert.equal(record.tick,1);
 assert.ok(Math.abs(record.ballDeltaLinearMomentumWorldNs.x-BALL_MASS_KG)<1e-12);
 assert.ok(Math.abs(record.ballDeltaLinearMomentumWorldNs.z+0.1*BALL_MASS_KG)<1e-12);
 assert.ok(Math.abs(record.ballDeltaLinearMomentumMagnitudeNs-Math.hypot(BALL_MASS_KG,0.1*BALL_MASS_KG))<1e-12);
 assert.equal(record.reportedFootPairImpulseMagnitudesSumNs,12*FIXED_DT);
 assert.equal(record.reportedFootPairCount,1);
 assert.deepEqual(record.pairs,[{
  id:'home-10',rapierForceReported:true,
  pairImpulseMagnitudeNs:12*FIXED_DT,maxAbsForceNormalAlignment:1,
  availableSolverManifolds:1
 }]);
 assert.equal(record.attribution,'unresolved');
 assert.equal(record.exclusiveFootMomentumTransferProven,false);
 assert.notEqual(record.ballDeltaLinearMomentumMagnitudeNs,record.reportedFootPairImpulseMagnitudesSumNs);
 assert.equal(Object.hasOwn(record,'possessor'),false);
 assert.ok(Object.isFrozen(record)&&Object.isFrozen(record.pairs)&&
  Object.isFrozen(record.pairs[0])&&Object.isFrozen(record.ballDeltaLinearMomentumWorldNs));
});

test('ME-PB-07 no force event is NULL, not fabricated zero; other forces still move ball',()=>{
 const noForce={id:'home-10',rapierForceReported:false,
  totalForceWorldN:null,derivedNetImpulseWorldNs:null,
  derivedNetImpulseMagnitudeNs:null,manifolds:[]};
 const record=summarizeFootMomentumAudit(before,after,solver(1,[noForce]),BALL_MASS_KG);
 assert.equal(record.reportedFootPairCount,0);
 assert.equal(record.pairs[0].pairImpulseMagnitudeNs,null);
 assert.equal(record.pairs[0].maxAbsForceNormalAlignment,null);
 assert.equal(record.pairs[0].availableSolverManifolds,0);
 assert.ok(record.ballDeltaLinearMomentumMagnitudeNs>0);
 assert.equal(record.reportedFootPairImpulseMagnitudesSumNs,0);
 const empty=summarizeFootMomentumAudit(before,after,solver(1,[]),BALL_MASS_KG);
 assert.deepEqual(empty.pairs,[]);
 assert.equal(empty.attribution,'unresolved');
 assert.ok(empty.ballDeltaLinearMomentumMagnitudeNs>0);
});

test('ME-PB-07 multiple Home/Away pair forces do not imply possession or ball momentum conservation',()=>{
 const second={...pair('away-10'),
  totalForceWorldN:{x:-8,y:0,z:0},
  derivedNetImpulseWorldNs:{x:-8*FIXED_DT,y:0,z:0},
  derivedNetImpulseMagnitudeNs:8*FIXED_DT,
  totalForceMagnitudeN:8,maxContactForceMagnitudeN:8,
  manifolds:[{normalWorld:{x:1,y:0,z:0},solverContacts:2}]
 };
 const out=summarizeFootMomentumAudit(before,after,
  solver(1,[pair(),second]),BALL_MASS_KG);
 assert.equal(out.reportedFootPairCount,2);
 assert.ok(Math.abs(out.reportedFootPairImpulseMagnitudesSumNs-20*FIXED_DT)<1e-12);
 assert.equal(out.exclusiveFootMomentumTransferProven,false);
 assert.equal(out.attribution,'unresolved');
 assert.deepEqual(out.pairs.map(x=>x.id),['home-10','away-10']);
 assert.ok(out.pairs.every(x=>x.maxAbsForceNormalAlignment===1));
});

test('ME-PB-07 missing manifold and zero pair force do not invent alignment',()=>{
 const withoutNormal={...pair(),manifolds:[]};
 const noDir={...pair(),totalForceWorldN:{x:0,y:0,z:0},
  totalForceMagnitudeN:0,maxContactForceMagnitudeN:0,
  derivedNetImpulseWorldNs:{x:0,y:0,z:0},
  derivedNetImpulseMagnitudeNs:0
 };
 const a=summarizeFootMomentumAudit(before,after,solver(1,[withoutNormal]),BALL_MASS_KG);
 const b=summarizeFootMomentumAudit(before,after,solver(1,[noDir]),BALL_MASS_KG);
 assert.equal(a.pairs[0].availableSolverManifolds,0);
 assert.equal(a.pairs[0].maxAbsForceNormalAlignment,null);
 assert.equal(b.pairs[0].maxAbsForceNormalAlignment,null);
 assert.equal(b.pairs[0].pairImpulseMagnitudeNs,0);
 const noSolverContacts={...pair(),manifolds:[{normalWorld:{x:1,y:0,z:0},solverContacts:0}]};
 assert.equal(summarizeFootMomentumAudit(before,after,
  solver(1,[noSolverContacts]),BALL_MASS_KG).pairs[0].maxAbsForceNormalAlignment,null);
});

test('ME-PB-07 rejects stale ticks, malformed units, double-counted IDs or impossible momentum data',()=>{
 const valid=solver(1,[pair()]);
 const badCases=[
  [before,{...after,tick:2},valid,BALL_MASS_KG],
  [before,after,{...valid,tick:2},BALL_MASS_KG],
  [before,after,valid,NaN],
  [before,after,valid,-1],
  [before,{...after,ball:{...after.ball,velocity:{x:Infinity,y:0,z:0}}},valid,BALL_MASS_KG],
  [before,after,solver(1,[pair(),pair()]),BALL_MASS_KG],
  [before,after,{...valid,reportedForcePairs:0},BALL_MASS_KG],
  [before,after,solver(1,[{...pair(),derivedNetImpulseWorldNs:{x:12,y:0,z:0}}]),BALL_MASS_KG],
  [before,after,solver(1,[{...pair(),derivedNetImpulseMagnitudeNs:0}]),BALL_MASS_KG],
  [before,after,solver(1,[{...pair(),manifolds:[{normalWorld:{x:0,y:0,z:0},solverContacts:1}]}]),BALL_MASS_KG]
 ];
 for(const args of badCases)assert.throws(()=>summarizeFootMomentumAudit(...args));
});

const RAPIER=await initializeRapier(rapierModule);
function run(input,ticks,enabled){
 const engine=createEngine(RAPIER,input,{diagnosticPlayerFootContactsEnabled:enabled});
 const players=enabled?createPlayerMovement():null;
 const observed=[],positions=[];
 const measuredBallMassKg=engine.ballProperties.massKg;
 assert.ok(Math.abs(measuredBallMassKg-BALL_MASS_KG)<1e-4);
 try{
  assert.equal(engine.footContactMomentumAuditSnapshot===undefined,!enabled);
  if(enabled){
   const first=engine.footContactMomentumAuditSnapshot();
   assert.equal(first.tick,0);
   assert.equal(first.ballDeltaLinearMomentumWorldNs,null);
  }
  for(let tick=1;tick<=ticks;tick++){
   const previous=engine.snapshot(),p=enabled?players.step(previous.ball.position):null;
   const current=enabled?engine.step(p):engine.step();
   positions.push(canonicalSnapshot(current));
   if(!enabled)continue;
   const audit=engine.footContactMomentumAuditSnapshot();
   const solverEvidence=engine.footContactSolverSnapshot();
   assert.equal(audit.tick,tick);
   assert.equal(audit.version,FOOT_MOMENTUM_AUDIT_VERSION);
   assert.equal(audit.reportedFootPairCount,solverEvidence.reportedForcePairs);
   assert.equal(audit.pairs.length,solverEvidence.pairs.length);
   const delta=audit.ballDeltaLinearMomentumWorldNs;
   assert.ok(Math.abs(delta.x-(current.ball.velocity.x-previous.ball.velocity.x)*measuredBallMassKg)<1e-10);
   assert.ok(Math.abs(delta.y-(current.ball.velocity.y-previous.ball.velocity.y)*measuredBallMassKg)<1e-10);
   assert.ok(Math.abs(delta.z-(current.ball.velocity.z-previous.ball.velocity.z)*measuredBallMassKg)<1e-10);
   assert.equal(audit.attribution,'unresolved');
   assert.equal(audit.exclusiveFootMomentumTransferProven,false);
   assert.ok(Object.isFrozen(audit)&&Object.isFrozen(audit.pairs));
   observed.push(audit);
  }
  return {trace:positions,observed};
 }finally{engine.dispose();}
}

test('ME-PB-07 180 actual Rapier ticks preserve canonical ball replay and independent momentum audit',()=>{
 const input={preset:'roll',seed:'pb07-real',x:-6,y:0,z:0,vx:4,vy:0,vz:0};
 const a=run(input,180,true),b=run(input,180,true);
 assert.deepEqual(a.trace,b.trace);
 assert.deepEqual(a.observed,b.observed);
 assert.ok(a.observed.some(x=>x.reportedFootPairCount===1));
 const measured=a.observed.find(x=>x.reportedFootPairCount>0);
 assert.ok(measured.pairs.some(p=>p.id==='home-10'&&p.pairImpulseMagnitudeNs>0));
 assert.ok(measured.pairs.some(p=>p.id==='home-10'&&
  p.maxAbsForceNormalAlignment!==null));
 process.stdout.write('ME_PB_07_MOMENTUM '+JSON.stringify({
  tick:measured.tick,
  observedBallMomentumChangeNs:measured.ballDeltaLinearMomentumMagnitudeNs,
  reportedFootPairImpulseMagnitudeSumNs:measured.reportedFootPairImpulseMagnitudesSumNs,
  normalAlignmentAbs:measured.pairs.find(p=>p.id==='home-10').maxAbsForceNormalAlignment,
  attribution:measured.attribution,exactReplay:true
 })+'\n');
});

test('ME-PB-07 high-air and distant-ball controls report no foot impulse; baseline remains isolated',()=>{
 const cases=[
  [{preset:'launch',seed:'pb07-air',x:-4.8,y:0,z:4,vx:0,vy:0,vz:0},28],
  [{preset:'roll',seed:'pb07-far',x:0,y:0,z:0,vx:0,vy:0,vz:0},60]
 ];
 for(const [input,ticks] of cases){
  const a=run(input,ticks,true);
  assert.ok(a.observed.every(x=>x.reportedFootPairCount===0&&
   x.reportedFootPairImpulseMagnitudesSumNs===0));
  if(input.preset==='launch')
   assert.ok(a.observed.some(x=>x.ballDeltaLinearMomentumMagnitudeNs>0),
    'gravity must change the airborne ball momentum');
  else
   assert.ok(a.observed.every(x=>x.ballDeltaLinearMomentumMagnitudeNs===0),
    'a distant stationary ball must remain at rest with zero foot impulse');
  assert.deepEqual(a.trace,run(input,ticks,true).trace);
 }
 const normal={preset:'roll',seed:'pb07-default',x:-6,y:0,z:0,vx:4,vy:0,vz:0};
 assert.deepEqual(run(normal,110,false).trace,run(normal,110,false).trace);
});

test('ME-PB-07 mirrored Away pair forces remain separate from actual ball delta momentum',()=>{
 const specs=[{x:-6,vx:4,id:'home-10'},{x:6,vx:-4,id:'away-10'}];
 for(const spec of specs){
  const input={preset:'roll',seed:'pb07-'+spec.id,x:spec.x,y:0,z:0,
    vx:spec.vx,vy:0,vz:0};
  const a=run(input,110,true),b=run(input,110,true);
  assert.deepEqual(a.observed,b.observed);
  assert.ok(a.observed.some(t=>t.pairs.some(p=>
   p.id===spec.id&&p.rapierForceReported&&p.pairImpulseMagnitudeNs>0)));
 }
});
