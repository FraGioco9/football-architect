import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot,ENGINE_VERSION,
 GRASS_ROLL_DECELERATION} from '../src/core.mjs';
import {SPIN_DECAY_RATES_PER_S,SPIN_DECAY_AXES,SPIN_DECAY_CHECKPOINTS_S,
 runSpinDecayDiagnostics} from '../src/spin-decay-qa.mjs';
import {SPIN_AXIS_LAUNCH,SPIN_AXIS_CASES} from '../src/spin-axis-qa.mjs';
const R=await initializeRapier(wasm),run=()=>runSpinDecayDiagnostics(R);
const get=(r,axis,rate,model)=>r.cases.find(c=>c.axis===axis&&c.decayRatePerS===rate)[model];

test('ME-PHYS-23 validates diagnostic-only in-flight spin damping',()=>{
 for(const invalid of [-1,1.1,Infinity,NaN,'0.2',null]){
  assert.throws(()=>createEngine(R,SPIN_AXIS_LAUNCH,{
   diagnosticMagnusSpinRadS:SPIN_AXIS_CASES[1].spin,
   diagnosticSpinDecayRatePerS:invalid
  }),/Invalid diagnostic in-flight spin decay rate/);
 }
 for(const [input,spin] of [
  [{preset:'roll'},SPIN_AXIS_CASES[1].spin],
  [{preset:'launch'},null],
  [{preset:'launch'},{x:0,y:0,z:0}]
 ]){
  assert.throws(()=>createEngine(R,input,{
   diagnosticMagnusSpinRadS:spin,diagnosticSpinDecayRatePerS:0.2
  }),/Spin decay requires|Magnus spin is only available/);
 }
 assert.deepEqual(SPIN_DECAY_RATES_PER_S,[0,0.2,0.5]);
 assert.deepEqual(SPIN_DECAY_AXES.map(x=>x.key),
  ['side-plus','side-minus','topspin','backspin']);
 assert.deepEqual(SPIN_DECAY_CHECKPOINTS_S,[0,0.25,0.5,0.75,0.8,1,1.25,1.5]);
 assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 assert.equal(GRASS_ROLL_DECELERATION,0.8);
});

test('ME-PHYS-23 zero rate matches original v4 and reset retains chosen rate',()=>{
 const opts={diagnosticMagnusSpinRadS:SPIN_AXIS_CASES[1].spin,
  diagnosticAerodynamicProfile:'literature-2011'};
 const original=createEngine(R,SPIN_AXIS_LAUNCH,opts);
 const zero=createEngine(R,SPIN_AXIS_LAUNCH,{...opts,diagnosticSpinDecayRatePerS:0});
 const decaying=createEngine(R,SPIN_AXIS_LAUNCH,{...opts,diagnosticSpinDecayRatePerS:0.2});
 try{
  for(let i=0;i<80;i++){
   assert.equal(canonicalSnapshot(original.step()),canonicalSnapshot(zero.step()));
   decaying.step();
  }
  const reset=decaying.reset();
  const fresh=createEngine(R,SPIN_AXIS_LAUNCH,{...opts,diagnosticSpinDecayRatePerS:0.2});
  try{
   for(let i=0;i<60;i++){
    assert.equal(canonicalSnapshot(reset.step()),canonicalSnapshot(fresh.step()));
    const a=reset.angularVelocity(),b=fresh.angularVelocity();
    for(const k of ['x','y','z'])assert.ok(Math.abs(a[k]-b[k])<1e-7);
   }
  }finally{reset.dispose();fresh.dispose();}
 }finally{original.dispose();zero.dispose();decaying.dispose();}
});

test('ME-PHYS-23 24 measured Rapier trajectories follow airborne decay law',()=>{
 const r=run();
 assert.equal(r.cases.length,12);
 assert.equal(r.independentWorlds,24);
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.cases));
 assert.equal(r.gameplayApproved,false);
 assert.equal(r.measuredRealSpin,false);
 assert.equal(r.scientificallyCalibrated,false);
 assert.equal(r.coefficientFitPerformed,false);
 for(const c of r.cases){
  assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.previous));
  for(const model of ['previous','candidate']){
   const t=c[model];
   assert.ok(t.initialSpinRevS>5.99&&t.initialSpinRevS<6.01);
   assert.ok(t.atOne&&t.atOne.timeS===1);
   assert.ok(t.firstContactTimeS!==null&&t.firstContactTimeS>1.5);
   assert.equal(t.checkpoints.length,8);
   assert.ok(t.checkpoints.every(p=>p===null||
     (Object.isFrozen(p.velocityMps)&&Object.isFrozen(p.angularVelocityRadS)&&
      ['x','y','z'].every(k=>Number.isFinite(p.velocityMps[k])&&
        Number.isFinite(p.angularVelocityRadS[k])))));
   assert.ok(t.checkpoints.every((s,i)=>s!==null&&
     s.timeS===SPIN_DECAY_CHECKPOINTS_S[i]&&
     Number.isFinite(s.spinRevS)&&Number.isFinite(s.rotationalEnergyJ)));
   const expected=t.initialSpinRevS*Math.exp(-c.decayRatePerS);
   assert.ok(Math.abs(t.atOne.spinRevS-expected)<0.02,
    'measured spin at one second must match decay law: '+c.axis+'/'+c.decayRatePerS);
   assert.ok(t.atOne.spinRevS<=t.initialSpinRevS+0.001);
   const measuredEnergyFraction=t.atOne.rotationalEnergyJ/t.checkpoints[0].rotationalEnergyJ;
   const exponentialEnergyFraction=Math.exp(-2*c.decayRatePerS);
   assert.ok(Math.abs(measuredEnergyFraction-exponentialEnergyFraction)<0.02,
     'measured rotational energy must follow squared spin decay: '+
       c.axis+'/'+c.decayRatePerS+' observed '+measuredEnergyFraction+
       ' expected '+exponentialEnergyFraction);
  }
 }
});

test('ME-PHYS-23 stronger damping reduces signed lift, both aerodynamics',()=>{
 const r=run();
 for(const model of ['previous','candidate']){
  const x=(axis,rate)=>get(r,axis,rate,model);
  for(const axis of SPIN_DECAY_AXES.map(a=>a.key)){
   assert.ok(x(axis,0).atOne.spinRevS>x(axis,0.2).atOne.spinRevS);
   assert.ok(x(axis,0.2).atOne.spinRevS>x(axis,0.5).atOne.spinRevS);
  }
  assert.ok(x('side-plus',0).atOne.lateralM>x('side-plus',0.5).atOne.lateralM);
  assert.ok(x('side-minus',0).atOne.lateralM<x('side-minus',0.5).atOne.lateralM);
  assert.ok(x('topspin',0).atOne.undersideM<x('topspin',0.5).atOne.undersideM);
  assert.ok(x('backspin',0).atOne.undersideM>x('backspin',0.5).atOne.undersideM);
  assert.ok(Math.abs(x('side-plus',0.5).atOne.lateralM+
    x('side-minus',0.5).atOne.lateralM)<0.1);
 }
});

test('ME-PHYS-23 deterministic and isolated from active LAB/default replay',()=>{
 const active=createEngine(R,{preset:'bounce',seed:'me23-unchanged'});
 try{
  for(let i=0;i<33;i++)active.step();
  const before=canonicalSnapshot(active.snapshot());
  const a=run(),b=run();
  assert.deepEqual(a,b);
  assert.equal(canonicalSnapshot(active.snapshot()),before);
  assert.equal(a.physicsVersion,ENGINE_VERSION);
  assert.equal(a.grassDecelerationMps2,0.8);
  assert.match(a.disclaimer,/NOT fitted to a real ball/);
  assert.match(a.disclaimer,/before first contact/);
 }finally{active.dispose();}
});
