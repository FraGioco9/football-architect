import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot,
 ENGINE_VERSION,GRASS_ROLL_DECELERATION} from '../src/core.mjs';
import {runSpinDecayDiagnostics} from '../src/spin-decay-qa.mjs';
import {magnusLift} from '../src/magnus.mjs';
import {literatureCandidateForces} from '../src/literature-aero-candidate.mjs';
import {reviewLiftInputContributions,LIFT_INPUT_TIME_S,
 LIFT_INPUT_DECISION} from '../src/lift-input-qa.mjs';
const R=await initializeRapier(wasm);
const sampled=()=>runSpinDecayDiagnostics(R);
const report=()=>reviewLiftInputContributions(sampled());
const forceY=(m,v,w)=>m==='previous'?magnusLift(v,w).force.y:
 literatureCandidateForces(v,w).lift.y;

test('ME-PHYS-25 no new Rapier worlds or active LAB mutation',()=>{
 const active=createEngine(R,{preset:'bounce',seed:'me25-isolation'});
 try{
  for(let i=0;i<45;i++)active.step();
  const before=canonicalSnapshot(active.snapshot());
  const a=report(),b=report();
  assert.deepEqual(a,b);
  assert.equal(canonicalSnapshot(active.snapshot()),before);
  assert.equal(a.newRapierWorlds,0);
  assert.equal(a.modelEvaluations,24);
  assert.equal(a.timeS,LIFT_INPUT_TIME_S);
  assert.equal(LIFT_INPUT_TIME_S,0.8);
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
  assert.equal(GRASS_ROLL_DECELERATION,0.8);
  assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.rows)&&
    a.rows.every(Object.isFrozen));
 }finally{active.dispose();}
});

test('ME-PHYS-25 exact signed 2x2 decomposition of existing force laws',()=>{
 const flights=sampled(),r=reviewLiftInputContributions(flights);
 assert.deepEqual(r.rows.map(x=>[x.ratePerS,x.model]),[
  [0,'previous'],[0,'candidate'],[0.2,'previous'],[0.2,'candidate'],
  [0.5,'previous'],[0.5,'candidate']]);
 for(const row of r.rows){
  const flight=flights.cases.find(x=>x.axis==='side-plus'&&
   x.decayRatePerS===row.ratePerS)[row.model];
  const p0=flight.checkpoints[0],p1=flight.checkpoints.find(p=>p?.timeS===0.8);
  const a=forceY(row.model,p0.velocityMps,p0.angularVelocityRadS);
  const b=forceY(row.model,p1.velocityMps,p0.angularVelocityRadS);
  const c=forceY(row.model,p0.velocityMps,p1.angularVelocityRadS);
  const d=forceY(row.model,p1.velocityMps,p1.angularVelocityRadS);
  assert.ok(a>0&&d>0);
  assert.ok(Math.abs(row.initialSideLiftN-a)<1e-12);
  assert.ok(Math.abs(row.velocityOnlySideLiftN-b)<1e-12);
  assert.ok(Math.abs(row.spinOnlySideLiftN-c)<1e-12);
  assert.ok(Math.abs(row.observedSideLiftN-d)<1e-12);
  assert.ok(Math.abs(row.velocityContributionN-0.5*((b-a)+(d-c)))<1e-12);
  assert.ok(Math.abs(row.spinContributionN-0.5*((c-a)+(d-b)))<1e-12);
  assert.ok(Math.abs(row.totalDeltaN-(row.observedSideLiftN-row.initialSideLiftN))<1e-12);
  assert.ok(Math.abs(row.closureResidualN)<1e-10);
  assert.ok(row.initialSpeedMps>0&&row.observedSpeedMps>0);
  assert.ok(row.initialSpinRevS>5.99);
  assert.ok(row.observedSpinRevS>0);
 }
});

test('ME-PHYS-25 spin stress test is distinct from velocity-vector contribution',()=>{
 const r=report();
 for(const model of ['previous','candidate']){
  const cases=r.rows.filter(x=>x.model===model);
  assert.equal(cases.length,3);
  assert.ok(Math.abs(cases[0].spinContributionN)<1e-3,
   'zero-decay model should not attribute nonzero Y force to spin loss');
  assert.ok(cases[1].spinContributionN< -0.01);
  assert.ok(cases[2].spinContributionN<cases[1].spinContributionN);
  assert.ok(cases[2].observedSpinRevS<cases[1].observedSpinRevS);
  assert.ok(cases[1].observedSpinRevS<cases[0].observedSpinRevS);
 }
 assert.equal(r.scientificallyCalibrated,false);
 assert.equal(r.coefficientFitPerformed,false);
 assert.equal(r.gameplayApproved,false);
 assert.equal(r.decision,LIFT_INPUT_DECISION);
 assert.match(r.caveat,/INCLUDES flight direction AND speed/);
 assert.match(r.caveat,/NOT real ball validation/);
 assert.match(r.caveat,/NOT.*trajectory contribution/);
});

test('ME-PHYS-25 rejects missing, contacted or invalid flight state',()=>{
 assert.throws(()=>reviewLiftInputContributions(),/Rapier spin-decay report required/);
 assert.throws(()=>reviewLiftInputContributions({cases:[]}),/Missing measured/);
 const data=sampled();
 const cases=data.cases.map(c=>({...c}));
 const i=cases.findIndex(c=>c.axis==='side-plus'&&c.decayRatePerS===0);
 cases[i]={...cases[i],previous:{...cases[i].previous,firstContactTimeS:0.6}};
 assert.throws(()=>reviewLiftInputContributions({...data,cases}),/Missing airborne/);
 const other=data.cases.map(c=>({...c}));
 const original=other.findIndex(c=>c.axis==='side-plus'&&c.decayRatePerS===0);
 const edited=other[original].previous.checkpoints.map(p=>p?{...p}:p);
 edited[0].velocityMps={x:NaN,y:0,z:10};
 other[original]={...other[original],previous:{...other[original].previous,checkpoints:edited}};
 assert.throws(()=>reviewLiftInputContributions({...data,cases:other}),/Invalid measured/);
});
