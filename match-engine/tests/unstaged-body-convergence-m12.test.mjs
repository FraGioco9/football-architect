// #628 M12: source-driven, opt-in, non-staged opposing convergence.
// Only the independently assigned original pressers can advance toward
// the real Rapier ball. A positive requires genuine Rapier native START.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,PLAYER_MIN_SEPARATION_M,
 observedOpposingPressConvergence,PLAYER_MAX_SPEED_MPS,
 PLAYER_CONTEST_START_BALL_RANGE_M,PLAYER_CONTEST_START_OPPONENT_RANGE_M}
 from '../src/player-movement.mjs';
import {auditUnstagedBodyContacts,M11_BALL_STARTS}
 from '../src/unstaged-body-contact-audit.mjs';

test('M12 source-only opposing presser convergence has strict research-only opt-in',()=>{
 const baseline=createPlayerMovement();
 const contender=createPlayerMovement({researchOpposingPressConvergence:true});
 assert.deepEqual(contender.snapshot().players,baseline.snapshot().players,
  'M12 must never stage, offset or change original 22 spawn positions');
 assert.deepEqual(contender.snapshot().players.map(p=>p.id),
  INITIAL_PLAYERS.map(p=>p.id));
 assert.equal(baseline.snapshot().originalOpposingPressConvergence,undefined);
 assert.ok(Object.isFrozen(contender.snapshot().players));
 assert.equal(PLAYER_CONTEST_START_BALL_RANGE_M,6);
 assert.equal(PLAYER_CONTEST_START_OPPONENT_RANGE_M,12);
 for(const bad of [
  {researchOpposingPressConvergence:false},
  {researchOpposingPressConvergence:null},
  {researchOpposingPressConvergence:'yes'},
  {researchOpposingPressConvergence:true,researchBodyEncounter:true},
  {researchOpposingPressConvergence:true,researchControlReceiver:true},
  {researchOpposingPressConvergence:true,unknown:true}
 ])assert.throws(()=>createPlayerMovement(bad),TypeError);
 const zero=observedOpposingPressConvergence(INITIAL_PLAYERS,{
  home:'home-10',away:'away-10'
 },{x:0,y:0});
 assert.equal(zero.active,true);
 assert.deepEqual(zero.playerIds,['home-10','away-10']);
 assert.equal(zero.homeBallGapM,5);
 assert.equal(zero.awayBallGapM,5);
 assert.equal(zero.opponentGapM,10);
 const noOpp=observedOpposingPressConvergence(INITIAL_PLAYERS,{
  home:'home-10',away:null
 },{x:0,y:0});
 assert.equal(noOpp.active,false);
 const far=observedOpposingPressConvergence(INITIAL_PLAYERS,{
  home:'home-10',away:'away-10'
 },{x:28,y:0});
 assert.equal(far.active,false);
 const actual=contender.step({x:0,y:0});
 assert.equal(actual.originalOpposingPressConvergence.active,true);
 assert.equal(actual.actualContestActiveTicks,1);
 assert.equal(actual.actualContestStarts,1);
 for(let i=0;i<22;i++){
  assert.equal(actual.players[i].id,INITIAL_PLAYERS[i].id);
  assert.ok(Math.hypot(actual.players[i].vx,actual.players[i].vy)<
   PLAYER_MAX_SPEED_MPS+1e-7);
 }
});
test('M12 real Rapier 22-body pressure convergence sweep, HOME/AWAY, native contact source only',
 {timeout:95000},async()=>{
 const R=await initializeRapier(wasm);
 const cases=['centre','middle-halfspace','attacking-third',
  'attacking-halfspace','defending-third','defending-halfspace'];
 for(const id of cases)assert.ok(M11_BALL_STARTS.some(s=>s.id===id));
 const matrix=[];
 let totalBody=0,positiveSeeds=0,sourceEngaged=0,shoePositive=0;
 for(const side of ['home','away'])for(const stateId of cases){
  const x=auditUnstagedBodyContacts(R,{stateId,side,
   movementPolicy:'contested-press',mode:'native',ticks:225});
  assert.equal(x.version,'m11-original-unstaged-body-audit-v1');
  assert.equal(x.movementPolicy,'contested-press');
  assert.equal(x.original22Unstaged,true);
  assert.equal(x.nativePlayerBodiesEnabled,true);
  assert.equal(x.oneNativeEventQueue,true);
  assert.equal(x.actualMoverFeedbackCount,0);
  assert.equal(x.officialAction,false);
  assert.equal(x.officialTackle,false);
  assert.equal(x.officialPossession,false);
  assert.equal(x.officialResult,null);
  assert.ok(x.nearestCanonicalGapM>=PLAYER_MIN_SEPARATION_M-1e-8);
  assert.ok(x.nearestPhysicalPair.gapM>0);
  assert.ok(x.nearestOpposingPhysicalPair.gapM>0);
  assert.ok(Number.isSafeInteger(x.actualOpposingContestTicks));
  assert.ok(x.actualOpposingContestTicks>=0);
  assert.ok(x.actualOpposingContestTicks<=225);
  if(x.actualOpposingContestTicks>0){
   sourceEngaged++;
   assert.ok(x.firstActualOpposingContest?.tick>0);
   assert.ok(x.firstActualOpposingContest.tick<=225);
   assert.ok(x.minActiveOpposingPressGapM>0);
   assert.ok(x.firstActualOpposingContest.playerIds[0].startsWith('home-'));
   assert.ok(x.firstActualOpposingContest.playerIds[1].startsWith('away-'));
  }else{
   assert.equal(x.firstActualOpposingContest,null);
   assert.equal(x.minActiveOpposingPressGapM,null);
  }
  if(x.bodyCollisionStarts>0){
   positiveSeeds++;
   assert.equal(x.firstNativeBodyStart.source,
    'native-rapier-collision-event');
   assert.ok(x.firstNativeBodyStart.tick<=225);
  }else{
   assert.equal(x.firstNativeBodyStart,null);
   assert.equal(x.eligibleResponseFrames,0);
   assert.equal(x.firstReadOnlyAdmissibleResponse,null);
  }
  if(x.footCollisionStarts>0)shoePositive++;
  totalBody+=x.bodyCollisionStarts;
  matrix.push({
   side,stateId,contestTicks:x.actualOpposingContestTicks,
   earliestContestTick:x.firstActualOpposingContest?.tick??null,
   minContestGap:x.minActiveOpposingPressGapM,
   nativeBodyStarts:x.bodyCollisionStarts,
   bodyStartTick:x.firstNativeBodyStart?.tick??null,
   bodyStartPairs:x.firstNativeBodyStart?.pairs??[],
   screenedFrames:x.eligibleResponseFrames,
   firstAdmissible:x.firstReadOnlyAdmissibleResponse,
   closestOpposingGap:x.nearestOpposingPhysicalPair.gapM,
   minCanonicalGap:x.nearestCanonicalGapM,
   nativeShoeStarts:x.footCollisionStarts
  });
 }
 process.stdout.write('ME_628_M12_CONVERGENCE_MATRIX '+JSON.stringify({
  states:matrix.length,ticks:225,totalBody,positiveSeeds,
  sourceEngaged,shoePositive,matrix
 })+'\n');
 assert.equal(matrix.length,12);
 assert.ok(sourceEngaged>0,
  'Real source press duties must converge from ordinary 22-player formation');
 assert.ok(positiveSeeds>0,
  'M12 positive requires genuine native Rapier body START without staging');
});
test('M12 unchanged normal policy and no native-physics negative cannot certify body events',
 {timeout:40000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const original=auditUnstagedBodyContacts(R,{side,stateId:'centre',
   mode:'native',ticks:200});
  const control=auditUnstagedBodyContacts(R,{side,stateId:'centre',
   movementPolicy:'contested-press',mode:'off',ticks:200});
  assert.equal(original.bodyCollisionStarts,0,
   'Default M11 original tactical behavior must remain intact');
  assert.equal(original.movementPolicy,undefined);
  assert.equal(original.firstActualOpposingContest,undefined);
  assert.equal(control.bodyCollisionStarts,0);
  assert.equal(control.footCollisionStarts,0);
  assert.equal(control.nativePlayerBodiesEnabled,false);
  assert.equal(control.oneNativeEventQueue,false);
  assert.ok(control.actualOpposingContestTicks>0,
   'M12 opposing press assignment is independent of native body colliders');
  assert.equal(control.firstNativeBodyStart,null);
  assert.equal(control.actualMoverFeedbackCount,0);
  assert.ok(control.nearestCanonicalGapM>=PLAYER_MIN_SEPARATION_M-1e-8);
  const x=auditUnstagedBodyContacts(R,{side,stateId:'centre',
   movementPolicy:'contested-press',mode:'native',ticks:120});
  const y=auditUnstagedBodyContacts(R,{side,stateId:'centre',
   movementPolicy:'contested-press',mode:'native',ticks:120});
  assert.deepEqual(x,y,'true 60Hz Rapier and original pressure source replay');
 }
 assert.throws(()=>auditUnstagedBodyContacts(R,{
  movementPolicy:'fake-opponent'}),TypeError);
});
