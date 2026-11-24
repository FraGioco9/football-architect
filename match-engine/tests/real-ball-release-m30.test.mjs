// #628 M30: one real same-world bounded tap; all collision events are Rapier.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine} from '../src/core.mjs';
import {CONTROL_LAB_STARTS} from '../src/action-lab-scenarios.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {calculatePhysicalReceiverReleaseTap,M30_TAP_MAX_IMPULSE_NS}
 from '../src/physical-receiver-tap-m30.mjs';
import {createRealBallReleaseAuditM30,M30_OBSERVATION_TICKS}
 from '../src/real-ball-release-audit-m30.mjs';

const fixture=()=>({
 choice:{tick:63,actorId:'home-9',team:'home',
  previousRealCushionTick:30,
  decision:'defer-clearance-to-keep-ball-near',
  physicalImpulseAllowed:false,genuineNativeSecondShoeStart:true,
  matchAuthority:false,officialPossession:false},
 earlierCushion:{actorId:'home-9',tick:30,
  nativeExclusiveShoeStart:true,actualPhysicsImpulseApplied:true},
 nativeStarts:['home-9'],nativeActive:['home-9'],
 ballPosition:{x:-5.3,y:-3.2,z:0.11},
 ballVelocity:{x:3,y:0.1,z:0},
 receiver:{id:'home-9',team:'home',x:-5,y:-3.2,
  vx:2.8,vy:0,facingRad:0},
 opponents:Array.from({length:11},(_,i)=>({
  id:'away-'+(i+1),team:'away',x:3+i,y:-3
 })),ballRadiusM:0.11
});
test('M30 pure candidate is bounded, fail closed and not a contact authenticator',()=>{
 const good=fixture(),candidate=calculatePhysicalReceiverReleaseTap(good);
 assert.ok(candidate);
 assert.ok(Math.abs(Math.hypot(candidate.impulseNs.x,
  candidate.impulseNs.y)-M30_TAP_MAX_IMPULSE_NS)<1e-9);
 assert.equal(candidate.officialPossession,false);
 assert.equal(candidate.matchAuthority,false);
 assert.equal(candidate.originalRapierBallBody,true);
 for(const bad of [
  {...good,nativeStarts:[]},
  {...good,nativeActive:['away-7']},
  {...good,earlierCushion:null},
  {...good,choice:{...good.choice,physicalImpulseAllowed:true}},
  {...good,receiver:{...good.receiver,id:'away-9'}}
 ])assert.throws(()=>calculatePhysicalReceiverReleaseTap(bad),TypeError);
 assert.equal(calculatePhysicalReceiverReleaseTap({...good,
  opponents:good.opponents.map((p,i)=>i===0?{...p,x:-4,y:-3.2}:p)}),null,
  'a nearby genuine defender must block the optional tap');
});
test('M30 source observer rejects absent/fake and duplicate native physics ticks',()=>{
 const x=createRealBallReleaseAuditM30();
 assert.throws(()=>x.snapshot(),TypeError);
 assert.throws(()=>x.observe({}),TypeError);
 assert.throws(()=>x.observe({
  physics:{tick:0,ball:{position:{x:0,y:0,z:0.11},velocity:{x:0,y:0,z:0}}},
  playerFrame:{tick:0,players:[]},foot:{tick:0,started:[],active:[],ended:[]}
 }),TypeError);
 assert.throws(()=>x.snapshot(),TypeError,'rejected frame must not commit');
});
test('M30 experiment requires explicit original M27 closed-world research opt-in',
 {timeout:20000},async()=>{
 const R=await initializeRapier(wasm);
 assert.throws(()=>createEngine(R,CONTROL_LAB_STARTS.home,{
  diagnosticResearchReceiverTapEnabled:true
 }),TypeError);
 const baseline=createControlledActionLab(R,'control',{controlScene:'receive-decide'});
 try{assert.equal(baseline.snapshot().physicalReceiverTap,undefined);}
 finally{baseline.dispose();}
});
test('M30 native HOME/AWAY physical release: source-matched A/B and replay',
 {timeout:120000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const original=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-decide'
  });
  const adapted=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-release'
  });
  const replay=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-release'
  });
  try{
   assert.equal(adapted.snapshot().realReleaseSequence.active,null);
   assert.equal(original.snapshot().realReleaseSequence,undefined);
   let end=null,tap=null,ballChanged=false;
   for(let tick=1;tick<=63+M30_OBSERVATION_TICKS;tick++){
    const a=adapted.step(),b=original.step(),c=replay.step();
    assert.deepEqual(a,c,'all results come from one deterministic Rapier world');
    assert.equal(a.realReleaseSequence.tick,tick);
    assert.equal(a.realReleaseSequence.verifiedPossession,false);
    assert.equal(a.realReleaseSequence.verifiedDribble,false);
    assert.equal(a.officialMatchPossession,false);
    assert.equal(a.action?.officialMatchAction??false,false);
    assert.equal(b.physicalReceiverTap,undefined);
    if(tick<63)assert.deepEqual(a.ball,b.ball,
     'M30 must not change the original ball before genuine second START');
    if(tick===63){
     tap=a.physicalReceiverTap;
     assert.equal(a.physicalReceiverChoice.decision,
      'defer-clearance-to-keep-ball-near');
     assert.ok(tap,'the original receiver must physically tap after M27 hold');
     assert.equal(tap.tick,63);
     assert.equal(tap.originalDecisionTick,63);
     assert.equal(tap.nativeExclusiveShoeStart,true);
     assert.equal(tap.actualPhysicsImpulseApplied,true);
     assert.equal(tap.originalClearanceSuppressed,true);
     assert.equal(a.action,null);
     assert.deepEqual(a.starts,[side+'-9']);
     assert.ok(tap.impulseMagnitudeNs>0&&
      tap.impulseMagnitudeNs<=M30_TAP_MAX_IMPULSE_NS+1e-8);
     assert.notDeepEqual(a.ball,b.ball,
      'actual same-world post-solver impulse must change real ball velocity');
    }
    if(tick>63&&JSON.stringify(a.ball)!==JSON.stringify(b.ball))
     ballChanged=true;
    end=a.realReleaseSequence.latestCompleted??end;
   }
   assert.ok(tap&&ballChanged);
   assert.ok(end,'original shoe release audit must end from native evidence');
   assert.equal(end.actorId,side+'-9');
   assert.ok(end.observedTicks>=1&&end.observedTicks<=M30_OBSERVATION_TICKS);
   // The original source ACTUALLY demonstrated a release then an
   // independently reacquired genuine shoe START on both mirrored sides.
   // This is a physics gate, not an official dribble/possession award.
   assert.equal(end.genuineNativeReleaseObserved,true);
   assert.equal(end.genuineNativeRecontactAfterRelease,true);
   assert.equal(end.exclusiveNativeRecontact,true);
   assert.ok(end.firstTrueShoeEndTick>63);
   assert.ok(end.firstTrueSubsequentShoeStartTick>end.firstTrueShoeEndTick);
   assert.ok(end.actualOpposingPressureTicks>0);
   assert.ok(end.nearestActualDefenderM<3);
   assert.equal(end.realOpponentFirstShoeStartTick,null);
   assert.equal(end.actualActionAfterTap?.action,'clearance',
    'a real later original action is not a successful possession claim');
   assert.equal(end.readOnly,true);
   assert.equal(end.verifiedPossession,false);
   assert.ok(end.originalShoeManifoldTicks>=0);
   assert.ok(end.originalShoeSolverTicks>=0);
   assert.ok(end.observedBallTravelXYM>0);
   assert.ok(end.maxActualBallReceiverGapM>=0);
   if(end.genuineNativeRecontactAfterRelease)
    assert.ok(end.firstTrueShoeEndTick<end.firstTrueSubsequentShoeStartTick);
   process.stdout.write('ME_628_M30_NATIVE_'+side.toUpperCase()+
    ' '+JSON.stringify(end)+'\\n');
  }finally{original.dispose();adapted.dispose();replay.dispose();}
 }
});
