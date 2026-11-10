import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,ENGINE_VERSION} from '../src/core.mjs';
import {SPIN_DECAY_CHECKPOINTS_S,runSpinDecayDiagnostics} from '../src/spin-decay-qa.mjs';
import {reviewSpinRetentionEvidence,SPIN_RETENTION_PUBLISHED_TRIAL,
 SPIN_RETENTION_DECISION} from '../src/spin-retention-evidence.mjs';
const R=await initializeRapier(wasm);
const run=()=>reviewSpinRetentionEvidence(runSpinDecayDiagnostics(R));

test('ME-PHYS-24 preserve approximate published trial and independent time intervals',()=>{
 const s=SPIN_RETENTION_PUBLISHED_TRIAL;
 assert.equal(s.source,'https://www.mdpi.com/2504-3900/49/1/88');
 assert.equal(s.spinInitialRevS,5.8);
 assert.equal(s.spinLaterRevS,5.7);
 assert.equal(s.spinIntervalS,0.8);
 assert.equal(s.speedInitialMps,18.8);
 assert.equal(s.speedLaterMps,14.7);
 assert.equal(s.speedIntervalS,1);
 assert.equal(s.timeSeriesAvailable,false);
 assert.equal(s.specimenMatched,false);
 assert.ok(Object.isFrozen(s));
 assert.ok(SPIN_DECAY_CHECKPOINTS_S.includes(0.8));
 const r=run();
 assert.ok(Math.abs(r.observation.spinRetainedFraction-5.7/5.8)<1e-12);
 assert.ok(Math.abs(r.observation.spinLostFraction-0.01724137931)<1e-7);
 assert.ok(Math.abs(r.observation.speedRetainedFraction-14.7/18.8)<1e-12);
 assert.ok(r.observation.equivalentExponentialRatePerS>0.02);
 assert.ok(r.observation.equivalentExponentialRatePerS<0.03);
 assert.match(r.note,/periods differ/);
});

test('ME-PHYS-24 real Rapier spin readings at same 0.8s, no model tuning',()=>{
 const r=run();
 assert.deepEqual(r.rows.map(x=>x.ratePerS),[0,0.2,0.5]);
 assert.equal(r.referenceTrialCount,1);
 assert.equal(r.referenceIsApproximate,true);
 assert.equal(r.rawTrajectoryAvailable,false);
 assert.equal(r.coefficientFitPerformed,false);
 assert.equal(r.scientificallyCalibrated,false);
 assert.equal(r.gameplayApproved,false);
 assert.match(r.decision,/HOLD/);
 assert.equal(r.decision,SPIN_RETENTION_DECISION);
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.rows));
 for(const row of r.rows){
  assert.ok(Object.isFrozen(row)&&Object.isFrozen(row.previous));
  for(const model of ['previous','candidate']){
   const result=row[model];
   const expected=Math.exp(-row.ratePerS*0.8);
   assert.ok(Math.abs(result.spinRetainedFraction-expected)<0.002,
      'Rapier .8s retention must match original diagnostic without refit');
   assert.ok(Math.abs(result.spinLostFraction-(1-expected))<0.002);
   assert.ok(Math.abs(result.lossRatioToPublished-
      result.spinLostFraction/r.observation.spinLostFraction)<1e-12);
   assert.ok(Math.abs(result.deviationFromPublishedLossFraction-
      (result.spinLostFraction-r.observation.spinLostFraction))<1e-12);
  }
  assert.ok(Math.abs(row.previous.spinRetainedFraction-
    row.candidate.spinRetainedFraction)<0.001);
 }
 assert.ok(r.rows[1].previous.lossRatioToPublished>8);
 assert.ok(r.rows[2].previous.lossRatioToPublished>19);
 assert.equal(r.rows[0].previous.spinLostFraction,0);
 assert.equal(r.rows[0].candidate.spinLostFraction,0);
 assert.equal(r.rows[0].previous.lossRatioToPublished,0);
});

test('ME-PHYS-24 independent source crosscheck never changes active LAB physics',()=>{
 assert.throws(()=>reviewSpinRetentionEvidence(null),/Spin-decay Rapier diagnostics required/);
 assert.throws(()=>reviewSpinRetentionEvidence({cases:[]}),/Missing measured/);
 const active=createEngine(R,{preset:'bounce',seed:'me24-sci-gate'});
 try{
  for(let i=0;i<27;i++)active.step();
  const initial=canonicalSnapshot(active.snapshot()),a=run(),b=run();
  assert.deepEqual(a,b);
  assert.equal(canonicalSnapshot(active.snapshot()),initial);
  assert.equal(ENGINE_VERSION,'me-01-physics-v4');
  assert.match(a.note,/no rates are fitted or enabled for gameplay/);
 }finally{active.dispose();}
});
