// #628 M18 — new ball-only initial states, native source and negative controls.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {auditNaturalNativeFeedback}
 from '../src/natural-native-feedback-audit-m14.mjs';
import {M18_ORIGINAL_BALL_POSITIONS,M18_ORIGINAL_BALL_VELOCITIES,
 auditExpandedNativePairSource,summarizeExpandedNativePairSource}
 from '../src/expanded-native-pair-survey-m18.mjs';

test('M18 authentic 22-player source: ball-only position/motion paired physical runs',
 {timeout:60000},async()=>{
 const R=await initializeRapier(wasm);
 const starts=[
  M18_ORIGINAL_BALL_POSITIONS.find(x=>x.x===-6&&x.y===0).id,
  M18_ORIGINAL_BALL_POSITIONS.find(x=>x.x===6&&x.y===9).id
 ];
 const a=auditExpandedNativePairSource(R,{
  positionIds:starts,
  velocityIds:['forward-68','diagonal-south'],ticks:90
 });
 const b=auditExpandedNativePairSource(R,{
  positionIds:starts,
  velocityIds:['forward-68','diagonal-south'],ticks:90
 });
 assert.deepEqual(a,b);
 assert.equal(a.requestedRuns,16);
 assert.equal(a.completedRuns,16);
 assert.equal(a.blockedRuns,0);
 assert.equal(a.fullPairedCases,8);
 assert.equal(a.completeOriginalSource,true);
 assert.equal(a.controlCorrections,0);
 assert.equal(a.cases.length,16);
 assert.ok(a.cases.every(x=>x.minCanonicalGapM>=0.98-1e-8));
 assert.ok(a.cases.every(x=>x.maxCanonicalSpeedMps<=7+1e-7));
 assert.ok(a.cases.every(x=>x.peakNativeBodyPairs>=0));
 assert.equal(a.genuineMultiPairGatePassed,
  a.positiveSimultaneousNativeWitnesses.length>0);
 process.stdout.write('ME_628_M18_FOCUSED_SOURCE '+
  JSON.stringify({complete:a.completedRuns,
   bodyStarts:a.nativeBodyStarts,
   peakSameTick:a.peakSameTickNativeBodyPairs,
   trueNativeMultiPair:a.genuineMultiPairGatePassed})+'\n');
});
test('M18 rejects invalid ball source, forged events and incomplete controls',
 {timeout:25000},async()=>{
 const R=await initializeRapier(wasm);
 const valid={stateId:'centre',side:'home',mode:'feedback',
  ticks:12,shoeBodyHandoff:'bounded',
  initialBallVelocity:{vx:6.8,vy:0},
  researchBallStart:{x:6,y:9}};
 for(const researchBallStart of [
  {x:49,y:0},{x:0,y:-31},{x:NaN,y:0},
  {x:1},{x:0,y:0,z:0},'centre'
 ])assert.throws(()=>auditNaturalNativeFeedback(R,{
  ...valid,researchBallStart
 }),TypeError);
 for(const args of [
  {stateId:'attacking-third'},{shoeBodyHandoff:'legacy'},
  {initialBallVelocity:null}
 ])assert.throws(()=>auditNaturalNativeFeedback(R,{
  ...valid,...args
 }),TypeError);
 for(const args of [
  {positionIds:[]},{velocityIds:['invented']},
  {positionIds:['centre-x0-y0','centre-x0-y0']},
  {ticks:241}
 ])assert.throws(()=>auditExpandedNativePairSource(R,args),TypeError);
 const pos=M18_ORIGINAL_BALL_POSITIONS.find(p=>p.x===0&&p.y===9);
 const vel=M18_ORIGINAL_BALL_VELOCITIES[0];
 const f=auditNaturalNativeFeedback(R,{
  ...valid,researchBallStart:{x:pos.x,y:pos.y}
 });
 const o=auditNaturalNativeFeedback(R,{
  ...valid,researchBallStart:{x:pos.x,y:pos.y},mode:'observe'
 });
 const matrix={version:'m18-original-ball-only-source-matrix-v1',
  positionIds:[pos.id],velocityIds:[vel.id],ticks:12,runs:4,
  rows:[{...f,positionId:pos.id,velocityId:vel.id,side:'home'},
   {...o,positionId:pos.id,velocityId:vel.id,side:'home'}],
  blocked:[
   {positionId:pos.id,velocityId:vel.id,side:'away',mode:'feedback',
    reason:'genuine-physical-shoe-body-mismatch',blockedAtTick:5},
   {positionId:pos.id,velocityId:vel.id,side:'away',mode:'observe',
    reason:'genuine-physical-shoe-body-mismatch',blockedAtTick:5}
  ]};
 const s=summarizeExpandedNativePairSource(matrix);
 assert.equal(s.completeOriginalSource,false);
 assert.equal(s.blockedRuns,2);
 const alter=fn=>{const clone=structuredClone(matrix);fn(clone);return clone;};
 assert.throws(()=>summarizeExpandedNativePairSource(alter(m=>{
  m.rows[0].firstSimultaneousBodyPairs={
   tick:2,pairs:['away-1|home-1','away-2|home-2']
  };
 })),TypeError);
 assert.throws(()=>summarizeExpandedNativePairSource(alter(m=>{
  m.rows[1].acceptedNativeResponses=1;
 })),TypeError);
 assert.throws(()=>summarizeExpandedNativePairSource(alter(m=>{
  m.rows[0].nativeColliderRadiusM=0.51;
 })),TypeError);
 assert.throws(()=>summarizeExpandedNativePairSource(alter(m=>{
  m.blocked.pop();
 })),TypeError);
});
