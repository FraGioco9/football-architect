// #628 M17 — narrow, non-duplicative source classifier regression.
// The full 192 trials run as a dedicated exact-head workflow.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {auditMovingBallMultiPairMatrix}
 from '../src/moving-ball-multipair-audit-m15.mjs';
import {summarizeOriginalConcurrentPairSurvey}
 from '../src/natural-concurrent-pair-survey-m17.mjs';

test('M17 real original Rapier START/END pair classification and mirrored controls',
 {timeout:50000},async()=>{
 const R=await initializeRapier(wasm);
 const m=auditMovingBallMultiPairMatrix(R,{
  stateIds:['centre','near-center-recovery'],
  velocityIds:['forward-roll'],ticks:240,handoffPolicy:'bounded'
 });
 const a=summarizeOriginalConcurrentPairSurvey(m);
 const b=summarizeOriginalConcurrentPairSurvey(m);
 assert.deepEqual(a,b);
 assert.equal(a.requestedRuns,8);
 assert.equal(a.completedRuns,8);
 assert.equal(a.blockedRuns,0);
 assert.equal(a.completeFeedbackControlPairs,4);
 assert.equal(a.negativeControlCorrections,0);
 assert.equal(a.allOriginal22Players,true);
 assert.equal(a.oneNativeWorldAndQueue,true);
 assert.equal(a.matchAuthority,false);
 assert.equal(a.cases.length,8);
 assert.equal(a.cases.filter(x=>x.mode==='observe').length,4);
 assert.ok(a.largestSameTickNativePairCount>=0);
 assert.equal(a.genuineMultiPairGatePassed,a.simultaneousNativeWitnesses.length>0);
 for(const w of a.simultaneousNativeWitnesses){
  assert.ok(w.tick>0&&w.tick<=240);
  assert.ok(w.nativePairs.length>=2);
  assert.equal(new Set(w.nativePairs).size,w.nativePairs.length);
  const row=a.cases.find(x=>x.stateId===w.stateId&&
   x.velocityId===w.velocityId&&x.side===w.side&&x.mode==='feedback');
  assert.deepEqual(row.firstNativeMultiPair,{
   tick:w.tick,pairs:w.nativePairs
  });
 }
 process.stdout.write('ME_628_M17_CLASSIFIER_FOCUSED '+
  JSON.stringify({complete:a.completedRuns,blocked:a.blockedRuns,
   bodyStarts:a.realFeedbackNativeStarts,
   maxConcurrent:a.largestSameTickNativePairCount,
   truePositive:a.genuineMultiPairGatePassed})+'\n');
});
test('M17 rejects falsified positive, violated source bounds and missing control',
 {timeout:25000},async()=>{
 const R=await initializeRapier(wasm);
 const m=auditMovingBallMultiPairMatrix(R,{
  stateIds:['centre'],velocityIds:['forward-roll'],ticks:12
 });
 const alter=(f)=>{const x=structuredClone(m);f(x);return x;};
 assert.throws(()=>summarizeOriginalConcurrentPairSurvey(alter(x=>{
  x.rows.find(p=>p.mode==='feedback').firstSimultaneousBodyPairs={
   tick:1,pairs:['home-1|away-1','home-2|away-2']
  };
 })),TypeError);
 assert.throws(()=>summarizeOriginalConcurrentPairSurvey(alter(x=>{
  x.rows.find(p=>p.mode==='observe').acceptedNativeResponses=1;
 })),TypeError);
 assert.throws(()=>summarizeOriginalConcurrentPairSurvey(alter(x=>{
  x.rows.pop();x.completedRuns--;
  x.runs--;
 })),TypeError);
 assert.throws(()=>summarizeOriginalConcurrentPairSurvey(alter(x=>{
  x.rows[0].nativeColliderRadiusM=0.51;
 })),TypeError);
 assert.throws(()=>summarizeOriginalConcurrentPairSurvey(alter(x=>{
  x.rows[0].fullShapeTicks=1;
 })),TypeError);
});
