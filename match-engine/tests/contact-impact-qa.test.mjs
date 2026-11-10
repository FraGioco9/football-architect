import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,
 ENGINE_VERSION,GRASS_ROLL_DECELERATION,BALL_MASS_KG} from '../src/core.mjs';
import {CONTACT_LAUNCH,CONTACT_SPIN_CASES,CONTACT_OBSERVATION_S,
 contactEnergySample,measureContactImpact,runContactImpactDiagnostics} from '../src/contact-impact-qa.mjs';
const R=await initializeRapier(wasm);
const run=()=>runContactImpactDiagnostics(R);
const byKey=(r,k)=>r.cases.find(c=>c.key===k);

test('ME-PHYS-26 5 bounded independent no-aerodynamics contact launches',()=>{
 const r=run();
 assert.deepEqual(r.cases.map(x=>x.key),
  ['none','topspin','backspin','side-plus','side-minus']);
 assert.equal(r.independentWorlds,5);
 assert.equal(r.observationSeconds,CONTACT_OBSERVATION_S);
 assert.deepEqual(CONTACT_LAUNCH,{preset:'launch',seed:'me26-contact',x:0,y:0,z:2,
  vx:4,vy:0,vz:0});
 assert.equal(CONTACT_SPIN_CASES.length,5);
 assert.equal(r.engineVersion,'me-01-physics-v4');
 assert.equal(ENGINE_VERSION,r.engineVersion);
 assert.equal(r.grassDecelerationMps2,GRASS_ROLL_DECELERATION);
 assert.equal(r.grassDecelerationMps2,0.8);
 assert.equal(r.scientificallyCalibrated,false);
 assert.equal(r.measuredRealBounce,false);
 assert.equal(r.gameplayApproved,false);
 assert.equal(r.coefficientFitPerformed,false);
 assert.match(r.limitation,/not.*configured collider restitution/i);
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.cases)&&
  r.cases.every(c=>Object.isFrozen(c)&&Object.isFrozen(c.pre)&&
    Object.isFrozen(c.post)&&Object.isFrozen(c.pre.velocityMps)));
});

test('ME-PHYS-26 actual 60Hz impact and rebound energy stays bounded',()=>{
 const r=run();
 for(const c of r.cases){
  assert.ok(c.firstImpactTimeS>0.55&&c.firstImpactTimeS<0.85,c.key);
  assert.ok(Math.abs(c.contactWindowS-1/60)<1e-9);
  assert.ok(c.impactCount>=1);
  assert.ok(c.pre.verticalSpeedMps< -4);
  assert.ok(c.post.verticalSpeedMps>1);
  assert.ok(c.effectiveStepRestitution>0&&c.effectiveStepRestitution<1);
  assert.ok(c.pre.clearanceM>=0&&c.post.clearanceM<0.08);
  assert.ok(c.firstReboundHeightM!==null&&c.firstReboundHeightM>0.1);
  assert.ok(Number.isFinite(c.pre.totalMechanicalJ));
  assert.ok(Number.isFinite(c.post.totalMechanicalJ));
  assert.ok(c.energyRetainedFraction>0&&c.energyRetainedFraction<1.01,
    'energy audit reports unphysical first-contact gain: '+c.key);
  assert.ok(Math.abs(c.energyChangeJ-
     (c.post.totalMechanicalJ-c.pre.totalMechanicalJ))<1e-9);
  assert.ok(Math.abs(c.energyRetainedFraction-
     c.post.totalMechanicalJ/c.pre.totalMechanicalJ)<1e-12);
  assert.ok(Math.abs(c.deltaVX-
    (c.post.velocityMps.x-c.pre.velocityMps.x))<1e-12);
  assert.ok(c.pre.contactSlipMps.magnitude>=0);
  assert.ok(c.post.contactSlipMps.magnitude>=0);
 }
 assert.equal(byKey(r,'none').initialSpinRevS,0);
 for(const key of ['topspin','backspin','side-plus','side-minus'])
  assert.equal(byKey(r,key).initialSpinRevS,6);
});

test('ME-PHYS-26 signed spin changes contact response without changing turf',()=>{
 const r=run(),none=byKey(r,'none'),top=byKey(r,'topspin'),back=byKey(r,'backspin');
 assert.ok(top.pre.contactSlipMps.magnitude<back.pre.contactSlipMps.magnitude,
  'topspin nearly matches forward travel at bottom contact');
 assert.ok(top.post.velocityMps.x>back.post.velocityMps.x,
  'forward topspin must retain more forward velocity than backspin after friction');
 assert.ok(Math.abs(byKey(r,'side-plus').post.velocityMps.y)<0.05);
 assert.ok(Math.abs(byKey(r,'side-minus').post.velocityMps.y)<0.05);
 assert.ok(Math.abs(byKey(r,'side-plus').post.velocityMps.x-
   byKey(r,'side-minus').post.velocityMps.x)<0.05);
 assert.ok(none.pre.spinRevS<0.02);
 assert.ok(Math.abs(byKey(r,'side-plus').pre.spinRevS-
   byKey(r,'side-minus').pre.spinRevS)<0.01);
});

test('ME-PHYS-26 3D contact ledger computes dimensions and rejects bad inputs',()=>{
 assert.throws(()=>contactEnergySample(null),/Finite Rapier/);
 assert.throws(()=>contactEnergySample({
   ball:{velocity:{x:NaN,y:0,z:0},position:{x:0,y:0,z:0}},
   angularVelocity:{x:0,y:0,z:0}
 }),/Finite Rapier/);
 assert.throws(()=>measureContactImpact([]),/at least 3/);
 const r=run();
 for(const c of r.cases){
  const prev=c.pre,post=c.post;
  for(const v of [prev,post]){
   assert.ok(v.translationJ>=0&&v.rotationJ>=0&&v.potentialJ>=0);
   assert.ok(Math.abs(v.totalMechanicalJ-
     (v.translationJ+v.rotationJ+v.potentialJ))<1e-10);
   assert.ok(Object.isFrozen(v.contactSlipMps));
   assert.ok(Math.abs(v.contactSlipMps.magnitude-
     Math.hypot(v.contactSlipMps.x,v.contactSlipMps.y))<1e-12);
  }
 }
 assert.equal(BALL_MASS_KG,0.43);
});

test('ME-PHYS-26 deterministic worlds and active physics-v4 state untouched',()=>{
 const active=createEngine(R,{preset:'bounce',seed:'me26-active'});
 try{
  for(let i=0;i<39;i++)active.step();
  const before=canonicalSnapshot(active.snapshot());
  assert.deepEqual(run(),run());
  assert.equal(canonicalSnapshot(active.snapshot()),before);
 }finally{active.dispose();}
});
