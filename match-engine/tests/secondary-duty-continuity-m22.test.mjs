// #628 M22: true source-continuity, no fabricated physical witness.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createOriginalSecondaryDutyContinuity}
 from '../src/secondary-duty-continuity-m22.mjs';
import {auditNaturalNativeFeedback}
 from '../src/natural-native-feedback-audit-m14.mjs';

test('M22 refuses empty, fake or malformed role source',()=>{
 const observer=createOriginalSecondaryDutyContinuity();
 assert.throws(()=>observer.snapshot(),TypeError);
 assert.throws(()=>observer.record({
  tick:1,frame:{tick:1,players:[]},
  native:{tick:1,physicalActors:[],activePairs:[]}
 }),TypeError);
});
test('M22 matches actual original source counters and native contact truth',
 {timeout:60000},async()=>{
 const R=await initializeRapier(wasm);
 const config={stateId:'centre',side:'home',ticks:150,mode:'feedback',
  shoeBodyHandoff:'bounded',
  researchBallStart:{x:0,y:0},
  initialBallVelocity:{vx:6.8,vy:0},
  researchEncounterTelemetry:true};
 const previous=auditNaturalNativeFeedback(R,config);
 const first=auditNaturalNativeFeedback(R,{
  ...config,researchSecondaryPressSupport:true});
 const replay=auditNaturalNativeFeedback(R,{
  ...config,researchSecondaryPressSupport:true});
 assert.deepEqual(first,replay,'real source must reproduce exact role timeline');
 assert.equal(Object.hasOwn(previous.observedContactDynamics,
  'secondaryDutyContinuity'),false);
 const record=first.observedContactDynamics.secondaryDutyContinuity;
 assert.ok(record&&record.nativeOnly&&record.readOnly);
 assert.equal(record.matchAuthority,false);
 let assigned=0;
 for(const team of ['home','away']){
  const duty=record[team];
  assigned+=duty.selectedTeamTicks;
  assert.equal(duty.selectedTeamTicks,
   first.secondaryPressActiveTicks[team]);
  assert.equal(duty.sourceRoleSwitches,
   first.secondaryPressSwitches[team]);
  assert.equal(duty.assignedWithoutRealContestTicks,0);
  assert.ok(duty.closedEpisodeCount+
   (duty.pendingEpisode?1:0)<=duty.sourceRoleSwitches);
  assert.ok(duty.activeNativeMarkedPairTicks<=duty.selectedTeamTicks);
  assert.ok(duty.activeNativeAnyMarkerPairTicks<=duty.selectedTeamTicks);
  assert.ok(duty.realPhysicalMarkerOpponentGapM.within1_5MTeamTicks<=
   duty.realPhysicalMarkerOpponentGapM.within3MTeamTicks);
  assert.ok(duty.realPhysicalMarkerOpponentGapM.within3MTeamTicks<=
   duty.realPhysicalMarkerOpponentGapM.within5MTeamTicks);
  assert.ok(duty.realPhysicalMarkerOpponentGapM.within5MTeamTicks<=
   duty.selectedTeamTicks);
 }
 assert.ok(assigned>0,'genuine second defender must actually be assigned');
 const physical=first.observedContactDynamics;
 assert.equal(physical.realNativeStarts,first.nativeBodyStarts);
 assert.equal(physical.realNativeActivePeak,
  first.maxSimultaneousBodyPairs);
 assert.equal(physical.stillActiveNativePairAgesTicks.length,
  physical.stillActiveNativePairs.length);
 assert.ok(physical.completedNativeContactDurationsTicks
  .every(x=>Number.isSafeInteger(x)&&x>=0));
 assert.equal(first.matchAuthority,false);
 assert.equal(first.officialTackle,false);
 assert.equal(first.officialPossession,false);
 const negative=auditNaturalNativeFeedback(R,{
  ...config,mode:'observe',researchSecondaryPressSupport:true
 });
 assert.equal(negative.acceptedNativeResponses,0);
 assert.ok(negative.observedContactDynamics.secondaryDutyContinuity);
 process.stdout.write('ME_628_M22_GENUINE_DUTY_TIMELINE '+
  JSON.stringify({assignedTicks:assigned,
   homeSwitches:record.home.sourceRoleSwitches,
   awaySwitches:record.away.sourceRoleSwitches,
   realNativeStarts:first.nativeBodyStarts,
   trueNativeConcurrentPeak:first.maxSimultaneousBodyPairs})+'\n');
});
