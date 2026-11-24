// #628 M20: real selection, strict opt-in and physical negative controls.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {INITIAL_PLAYERS,createPlayerMovement}
 from '../src/player-movement.mjs';
import {selectObservedSecondaryPressSupport}
 from '../src/secondary-press-support-m20.mjs';
import {auditNaturalNativeFeedback}
 from '../src/natural-native-feedback-audit-m14.mjs';

test('M20 picks observed non-primary teammate and real off-ball opponent',()=>{
 const players=INITIAL_PLAYERS.map(p=>({...p}));
 const ball={x:0,y:0},pressers={home:'home-10',away:'away-10'};
 for(const team of ['home','away']){
  const p=selectObservedSecondaryPressSupport(players,team,ball,pressers);
  assert.ok(p);
  assert.ok(p.playerId.startsWith(team+'-'));
  assert.notEqual(p.playerId,pressers[team]);
  assert.notEqual(p.opponentId,pressers[team==='home'?'away':'home']);
  assert.ok(p.ballGapM<=25);
  assert.ok(p.currentOpponentGapM<=32);
  assert.deepEqual(p,selectObservedSecondaryPressSupport(
   players,team,ball,pressers,{incumbentId:p.playerId}));
  const excluded=selectObservedSecondaryPressSupport(
   players,team,ball,pressers,{excludedIds:[p.playerId]});
  assert.notEqual(excluded?.playerId,p.playerId);
 }
 assert.throws(()=>selectObservedSecondaryPressSupport(
  [...players.slice(1),players[0]],'home',ball,pressers),TypeError);
 assert.throws(()=>selectObservedSecondaryPressSupport(
  players,'home',ball,{home:'fake',away:'away-10'}),TypeError);
});
test('M20 research cannot leak to ordinary mover or unsafe native settings',()=>{
 for(const o of [
  {researchSecondaryPressSupport:true},
  {researchOpposingPressConvergence:true,researchSecondaryPressSupport:false},
  {researchOpposingPressConvergence:true,
   researchUnstagedNativeBodyFeedback:true,
   researchSecondaryPressSupport:true}
 ])assert.throws(()=>createPlayerMovement(o),TypeError);
 assert.doesNotThrow(()=>createPlayerMovement({
  researchOpposingPressConvergence:true,researchSecondaryPressSupport:true
 }));
 assert.doesNotThrow(()=>createPlayerMovement({
  researchOpposingPressConvergence:true,
  researchUnstagedNativeBodyFeedback:true,researchShoeBodyHandoff:true,
  researchSecondaryPressSupport:true
 }));
 assert.equal(Object.hasOwn(
  createPlayerMovement().snapshot(),'secondaryPressSupport'),false);
});
test('M20 genuine rolling Rapier source and observe-only control remain safe',
 {timeout:85000},async()=>{
 const R=await initializeRapier(wasm),ball={
  researchBallStart:{x:0,y:0},initialBallVelocity:{vx:6.8,vy:0}
 };
 const args={...ball,stateId:'centre',side:'home',ticks:150,
  shoeBodyHandoff:'bounded',researchEncounterTelemetry:true};
 const baseline=auditNaturalNativeFeedback(R,{...args,mode:'feedback'});
 const p=auditNaturalNativeFeedback(R,{
  ...args,mode:'feedback',researchSecondaryPressSupport:true
 });
 const observe=auditNaturalNativeFeedback(R,{
  ...args,mode:'observe',researchSecondaryPressSupport:true
 });
 for(const x of [baseline,p,observe]){
  assert.equal(x.original22Unstaged,true);
  assert.equal(x.sameRapierWorld,true);
  assert.equal(x.singleNativeEventQueue,true);
  assert.equal(x.fullShapeTicks,150);
  assert.equal(x.nativeColliderRadiusM,0.49);
  assert.ok(x.minimumCanonicalGapM>=0.98-1e-8);
  assert.ok(x.peakCanonicalSpeedMps<=7+1e-7);
  assert.equal(x.matchAuthority,false);
  assert.equal(x.officialTackle,false);
  assert.equal(x.observedContactDynamics.realNativeStarts,x.nativeBodyStarts);
 }
 assert.ok(p.secondaryPressActiveTicks.home+
  p.secondaryPressActiveTicks.away>0);
 assert.equal(observe.acceptedNativeResponses,0);
 assert.ok(observe.secondaryPressActiveTicks.home+
  observe.secondaryPressActiveTicks.away>0);
 process.stdout.write('ME_628_M20_FOCUSED '+JSON.stringify({
  baselineStarts:baseline.nativeBodyStarts,
  secondaryStarts:p.nativeBodyStarts,
  assignments:p.secondaryPressActiveTicks,
  baselineDisjoint5:baseline.observedContactDynamics.proximity['5'].twoDisjointOpponentTicks,
  secondaryDisjoint5:p.observedContactDynamics.proximity['5'].twoDisjointOpponentTicks
 })+'\n');
});
