// #628 M11: ORIGINAL unstaged 22-player formation in many real ball states.
// A near miss is not a native body collision. Nothing mutates the mover.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier} from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,
 PLAYER_MIN_SEPARATION_M} from '../src/player-movement.mjs';
import {auditUnstagedBodyContacts,M11_BALL_STARTS,
 screenNativeBodyResponse} from '../src/unstaged-body-contact-audit.mjs';

test('M11 closed real-ball matrix, research-only original formation, no staging',async()=>{
 assert.equal(M11_BALL_STARTS.length,12);
 assert.equal(new Set(M11_BALL_STARTS.map(s=>s.id)).size,12);
 assert.ok(Object.isFrozen(M11_BALL_STARTS));
 for(const s of M11_BALL_STARTS){
  assert.ok(Object.isFrozen(s));
  assert.ok(Math.abs(s.x)<52.5&&Math.abs(s.y)<34);
 }
 const R=await initializeRapier(wasm);
 for(const bad of [
  {stateId:'nonexistent'},
  {side:'both'},
  {ticks:0},
  {ticks:241},
  {ticks:1.5},
  {mode:'synthetic-contact'},
  {mode:'native',side:'both'}
 ])assert.throws(()=>auditUnstagedBodyContacts(R,bad),TypeError);
 const code=readFileSync(new URL('../src/unstaged-body-contact-audit.mjs',
  import.meta.url),'utf8');
 assert.match(code,/createPlayerMovement\(\);/);
 assert.match(code,/diagnosticSharedContactEventsEnabled:true/);
 assert.match(code,/diagnosticPlayerBodyCollidersEnabled:true/);
 assert.match(code,/diagnosticPlayerFootContactsEnabled:true/);
 assert.doesNotMatch(code,/researchBodyEncounter:true/);
 assert.doesNotMatch(code,/diagnosticResearchBodyEncounter:true/);
 assert.doesNotMatch(code,/diagnosticAutonomousFixtureActionEnabled:true/);
 assert.doesNotMatch(code,/fakeContact|fakeStart|officialTackle:true/);
});
test('M11 bounded 12×2 genuine original Rapier ball-start sweep audits native physical STARTs',
 {timeout:100000},async()=>{
 const R=await initializeRapier(wasm);
 const rows=[],contacts=[];
 let shoeWitnesses=0,movingSupportStates=0;
 for(const side of ['home','away']){
  for(const s of M11_BALL_STARTS){
   const result=auditUnstagedBodyContacts(R,{
    side,stateId:s.id,ticks:160
   });
   assert.equal(result.stateId,s.id);
   assert.equal(result.side,side);
   assert.equal(result.ticks,160);
   assert.equal(result.mode,'native');
   assert.equal(result.original22Unstaged,true);
   assert.equal(result.oneOriginalRapierBallWorld,true);
   assert.equal(result.nativePlayerBodiesEnabled,true);
   assert.equal(result.oneNativeEventQueue,true);
   assert.equal(result.actualMoverFeedbackCount,0);
   assert.equal(result.officialAction,false);
   assert.equal(result.officialTackle,false);
   assert.equal(result.officialPossession,false);
   assert.equal(result.officialResult,null);
   assert.equal(result.initialBall.x,side==='home'?s.x:-s.x);
   assert.equal(result.initialBall.y,s.y);
   assert.ok(result.nearestCanonicalGapM>=
    PLAYER_MIN_SEPARATION_M-1e-8);
   assert.ok(result.nearestPhysicalPair?.gapM>0);
   assert.ok(result.nearestOpposingPhysicalPair?.gapM>0);
   assert.ok(result.nearestPhysicalPair.gapM<=
    result.nearestOpposingPhysicalPair.gapM+1e-7);
   assert.ok(Number.isSafeInteger(result.bodyCollisionStarts));
   assert.ok(Number.isSafeInteger(result.footCollisionStarts));
   assert.ok(Number.isSafeInteger(result.eligibleResponseFrames));
   assert.ok(result.genuinePressTicks>=0);
   assert.ok(result.genuineSupportTicks>=0);
   if(result.footCollisionStarts>0)shoeWitnesses++;
   if(result.genuineSupportTicks>0)movingSupportStates++;
   if(result.bodyCollisionStarts>0){
    assert.ok(result.firstNativeBodyStart);
    assert.equal(result.firstNativeBodyStart.source,
     'native-rapier-collision-event');
    assert.ok(result.firstNativeBodyStart.tick<=160);
    // A real START can also END in the same tick. No active body pair
    // means there is no admissible solver correction to screen.
    contacts.push(result);
   }else{
    assert.equal(result.firstNativeBodyStart,null);
    assert.equal(result.eligibleResponseFrames,0,
     'Never screen a body correction without native START');
    assert.equal(result.firstReadOnlyAdmissibleResponse,null);
   }
   rows.push({
    seed:s.id,side,bodyStarts:result.bodyCollisionStarts,
    shoeStarts:result.footCollisionStarts,
    minPhysicalGapM:+result.nearestPhysicalPair.gapM.toFixed(5),
    minOpposingGapM:+result.nearestOpposingPhysicalPair.gapM.toFixed(5),
    minCanonicalGapM:+result.nearestCanonicalGapM.toFixed(5),
    nearFrames:result.nearPhysicalFramesBelow145cm,
    supportTicks:result.genuineSupportTicks,
    pressTicks:result.genuinePressTicks,
    screenedFrames:result.eligibleResponseFrames,
    firstNativeBodyStart:result.firstNativeBodyStart,
    firstAdmissible:result.firstReadOnlyAdmissibleResponse
   });
  }
 }
 assert.equal(rows.length,24);
 assert.ok(shoeWitnesses>0,
  'At least one actual shoe START must survive the shared native queue');
 assert.ok(movingSupportStates>0,
  'Some genuine original 22-player support decisions must be observed');
 process.stdout.write('ME_628_M11_UNSTAGED_MATRIX '+JSON.stringify({
  auditedStarts:rows.length,eachTicks:160,
  totalNativeBodyStarts:rows.reduce((n,r)=>n+r.bodyStarts,0),
  positiveNativeSeeds:contacts.length,
  physicalShoePositiveSeeds:shoeWitnesses,
  originalSupportSeeds:movingSupportStates,
  closestPhysical:rows.reduce((a,b)=>b.minPhysicalGapM<a.minPhysicalGapM?b:a),
  rows
 })+'\n');
});
test('M11 native and OFF controls repeat deterministically without invented body authority',
 {timeout:35000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  for(const id of ['centre','attacking-third']){
   const a=auditUnstagedBodyContacts(R,{side,stateId:id,ticks:120});
   const b=auditUnstagedBodyContacts(R,{side,stateId:id,ticks:120});
   assert.deepEqual(a,b,'original physics exact same-state deterministic replay');
   const off=auditUnstagedBodyContacts(R,{
    side,stateId:id,ticks:120,mode:'off'
   });
   assert.equal(off.bodyCollisionStarts,0);
   assert.equal(off.footCollisionStarts,0);
   assert.equal(off.firstNativeBodyStart,null);
   assert.equal(off.nearestPhysicalPair,null);
   assert.equal(off.nearestOpposingPhysicalPair,null);
   assert.equal(off.eligibleResponseFrames,0);
   assert.equal(off.oneOriginalRapierBallWorld,true);
   assert.equal(off.nativePlayerBodiesEnabled,false);
   assert.equal(off.oneNativeEventQueue,false);
   assert.equal(off.actualMoverFeedbackCount,0);
   assert.equal(off.officialTackle,false);
   assert.ok(off.nearestCanonicalGapM>=
    PLAYER_MIN_SEPARATION_M-1e-8);
  }
 }
});
test('M11 never accepts an invented native pair or stale/fake sample',async()=>{
 const R=await initializeRapier(wasm);
 const world=createEngine(R,{preset:'roll',x:0,y:0,z:0,
  vx:0,vy:0,vz:0,seed:'m11-source-guard'},{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticPlayerBodyCollidersEnabled:true,
  diagnosticSharedContactEventsEnabled:true
 });
 const mover=createPlayerMovement();
 try{
  const before=mover.snapshot(),now=mover.step(world.snapshot().ball.position);
  world.step(now);
  const snapshot=world.nativePlayerBodySnapshot();
  assert.equal(snapshot.tick,1);
  assert.equal(snapshot.controlledEncounter,false);
  assert.equal(snapshot.activePairs.length,0);
  assert.equal(snapshot.physicalActors.length,22);
  assert.deepEqual(snapshot.physicalActors.map(p=>p.id),
   INITIAL_PLAYERS.map(p=>p.id));
  const empty=screenNativeBodyResponse(before,now,snapshot);
  assert.equal(empty.evaluated,false);
  assert.equal(empty.admissible,false);
  assert.equal(empty.reason,'no-native-active-pair');
  const invented={...snapshot,activePairs:['away-10|home-10'],
   actualNativeStarts:1};
  assert.throws(()=>screenNativeBodyResponse(before,now,invented),
   /preceding real Rapier START/);
  assert.throws(()=>screenNativeBodyResponse(before,{
   ...now,tick:2
  },snapshot),TypeError);
  assert.throws(()=>screenNativeBodyResponse(before,now,{
   ...snapshot,physicalActors:snapshot.physicalActors.slice(1)
  }),TypeError);
  assert.throws(()=>screenNativeBodyResponse(before,now,{
   ...snapshot,controlledEncounter:true
  }),TypeError);
 }finally{world.dispose();}
});
