// #628 M19 exact ORIGINAL source diagnosis, not player steering.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {auditNaturalNativeFeedback}
 from '../src/natural-native-feedback-audit-m14.mjs';
import {createNativeEncounterTelemetry}
 from '../src/native-contact-dynamics-m19.mjs';

test('M19 genuine Rapier observer must be inert and deterministic',
 {timeout:60000},async()=>{
 const R=await initializeRapier(wasm);
 const options={
  stateId:'centre',side:'home',ticks:150,mode:'feedback',
  shoeBodyHandoff:'bounded',
  researchBallStart:{x:0,y:0},
  initialBallVelocity:{vx:6.8,vy:0}
 };
 const base=auditNaturalNativeFeedback(R,options);
 const a=auditNaturalNativeFeedback(R,{
  ...options,researchEncounterTelemetry:true});
 const b=auditNaturalNativeFeedback(R,{
  ...options,researchEncounterTelemetry:true});
 assert.deepEqual(a,b);
 const {observedContactDynamics,...withoutObservation}=a;
 assert.deepEqual(withoutObservation,base,
  'M19 must never alter original 22-player Rapier/mover evidence');
 assert.equal(observedContactDynamics.ticks,150);
 assert.equal(observedContactDynamics.originalPlayers,22);
 assert.equal(observedContactDynamics.realNativeStarts,a.nativeBodyStarts);
 assert.equal(observedContactDynamics.realNativeEnds,a.nativeBodyEnds);
 assert.equal(observedContactDynamics.realNativeActivePeak,a.maxSimultaneousBodyPairs);
 assert.equal(observedContactDynamics.nativeSourceOnly,true);
 assert.equal(observedContactDynamics.matchAuthority,false);
 assert.equal(observedContactDynamics.opposingNativeStarts+
  observedContactDynamics.teammateNativeStarts,a.nativeBodyStarts);
 for(const threshold of ['1.5','3','5','8']){
  const x=observedContactDynamics.proximity[threshold];
  assert.ok(x.twoDisjointOpponentTicks<=x.anyOpponentTicks);
  assert.ok(x.twoDisjointOpponentTicks<=x.twoDisjointAllBodiesTicks);
  assert.ok(x.anyOpponentTicks<=150);
 }
 const negative=auditNaturalNativeFeedback(R,{
  ...options,mode:'observe',researchEncounterTelemetry:true});
 assert.equal(negative.acceptedNativeResponses,0);
 assert.equal(negative.observedContactDynamics.ticks,150);
 assert.ok(negative.observedContactDynamics.realNativeStarts>=0);
 assert.equal(negative.officialTackle,false);
 assert.equal(negative.matchAuthority,false);
 process.stdout.write('ME_628_M19_FOCUSED_OBSERVATION '+
  JSON.stringify({genuineNativeStarts:a.nativeBodyStarts,
   telemetryActivePeak:observedContactDynamics.realNativeActivePeak,
   prox:observedContactDynamics.proximity,
   nearBall:observedContactDynamics.nearBall})+'\n');
});
test('M19 rejects injected or stale body source and disabled legacy opt-in',
 async()=>{
 const R=await initializeRapier(wasm);
 assert.throws(()=>auditNaturalNativeFeedback(R,{
  shoeBodyHandoff:'legacy',researchEncounterTelemetry:true
 }),TypeError);
 assert.throws(()=>auditNaturalNativeFeedback(R,{
  shoeBodyHandoff:'bounded',researchEncounterTelemetry:'true'
 }),TypeError);
 const reporter=createNativeEncounterTelemetry();
 assert.throws(()=>reporter.snapshot(),TypeError);
 assert.throws(()=>reporter.record({
  tick:1,frame:{tick:1,players:[]},
  native:{tick:1,physicalActors:[]},ball:{x:0,y:0}
 }),TypeError);
});
