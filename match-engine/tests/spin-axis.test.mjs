import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot,ENGINE_VERSION,
 GRASS_ROLL_DECELERATION} from '../src/core.mjs';
import {runSpinAxisDiagnostics,SPIN_AXIS_CASES,SPIN_AXIS_LAUNCH,SPIN_AXIS_DURATION_S}
 from '../src/spin-axis-qa.mjs';
const RAPIER=await initializeRapier(wasm);
const run=()=>runSpinAxisDiagnostics(RAPIER);
const trial=(r,k,m)=>r.cases.find(c=>c.key===k)[m];

test('ME-PHYS-22 10 measured 3D Rapier paths have valid pre-impact samples',()=>{
 const r=run();
 assert.deepEqual(SPIN_AXIS_CASES.map(c=>c.key),
  ['none','side-plus','side-minus','topspin','backspin']);
 assert.equal(r.cases.length,5);
 assert.equal(r.independentWorlds,10);
 assert.equal(SPIN_AXIS_DURATION_S,3.5);
 assert.equal(r.physicsVersion,ENGINE_VERSION);
 assert.equal(r.grassDecelerationMps2,GRASS_ROLL_DECELERATION);
 assert.equal(r.launch.vx,15);
 for(const c of r.cases){
  assert.ok(Object.isFrozen(c));
  for(const m of [c.previous,c.candidate]){
   assert.ok(Object.isFrozen(m));
   assert.ok(Math.abs(Math.hypot(...Object.values(m.initialOmega))-
    Math.hypot(...Object.values(c.spin)))<1e-4);
   assert.ok(m.atOne&&m.atOne.timeS===1);
   assert.ok(m.firstContactTimeS!==null&&m.firstContactTimeS>1&&m.firstContactTimeS<=3.5);
   assert.ok(m.trajectory.length>10);
   assert.equal(m.trajectory[0].timeS,0);
   assert.ok(m.trajectory.every(p=>p.timeS<m.firstContactTimeS &&
    p.clearanceM>=0&&Object.values(p).every(Number.isFinite)));
   assert.ok(m.impact&&Math.abs(m.impact.timeS-m.firstContactTimeS)<1e-10);
   assert.ok(m.trajectory.at(-1).timeS<m.impact.timeS);
  }
 }
});

test('ME-PHYS-22 signed ±Z lateral / ±Y vertical flight evidence',()=>{
 const r=run();
 for(const model of ['previous','candidate']){
  const none=trial(r,'none',model),plus=trial(r,'side-plus',model),
   minus=trial(r,'side-minus',model),top=trial(r,'topspin',model),
   back=trial(r,'backspin',model);
  assert.ok(Math.abs(none.initialLiftN.y)<1e-10&&Math.abs(none.initialLiftN.z)<1e-10);
  assert.ok(plus.initialLiftN.y>0&&minus.initialLiftN.y<0);
  assert.ok(Math.abs(plus.initialLiftN.y+minus.initialLiftN.y)<1e-10);
  assert.ok(top.initialLiftN.z<0&&back.initialLiftN.z>0);
  assert.ok(Math.abs(top.initialLiftN.z+back.initialLiftN.z)<1e-10);
  assert.ok(plus.atOne.lateralM>none.atOne.lateralM+0.15);
  assert.ok(minus.atOne.lateralM<none.atOne.lateralM-0.15);
  assert.ok(Math.abs(plus.atOne.lateralM+minus.atOne.lateralM)<0.08);
  assert.ok(top.atOne.clearanceM<none.atOne.clearanceM-0.1);
  assert.ok(back.atOne.clearanceM>none.atOne.clearanceM+0.1);
  assert.ok(top.firstContactTimeS<none.firstContactTimeS);
  assert.ok(back.firstContactTimeS>none.firstContactTimeS);
 }
});

test('ME-PHYS-22 reproducible, isolated, uncalibrated, no default force activation',()=>{
 const engine=createEngine(RAPIER,{preset:'roll',seed:'me22-isolation'});
 try{
  for(let i=0;i<35;i++)engine.step();
  const before=canonicalSnapshot(engine.snapshot());
  const a=run(),b=run();
  assert.deepEqual(a,b);
  assert.equal(canonicalSnapshot(engine.snapshot()),before);
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
  assert.equal(SPIN_AXIS_LAUNCH.preset,'launch');
  assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.cases));
  assert.equal(a.gameplayApproved,false);
  assert.equal(a.realTrajectoryValidation,false);
  assert.equal(a.scientificallyCalibrated,false);
  assert.equal(a.coefficientFitPerformed,false);
  assert.match(a.assumption,/unverified/);
 }finally{engine.dispose();}
});
