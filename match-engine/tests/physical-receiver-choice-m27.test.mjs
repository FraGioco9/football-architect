// #628 M27 — real shoe START → measured tactical choice; no false possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine} from '../src/core.mjs';
import {CONTROL_LAB_STARTS} from '../src/action-lab-scenarios.mjs';
import {createControlledActionLab as createCurrentActionLab} from '../src/action-labs.mjs';
 // Historical M/B evidence comparator only. Current gameplay uses the default.
 const createControlledActionLab=(R,id,options={})=>createCurrentActionLab(R,id,{
  ...options,historicalEvidenceBaseline:!['pass-pair','cross-pair','carry-solo','dribble-1v1','keeper-1v1','defender-1v1','overload-2v1','duel-2v2','duel-3v3'].includes(id)
 });

import {choosePhysicalReceiverSecondTouch}
 from '../src/physical-receiver-choice-m27.mjs';
const fixtures=(defenderX)=>({
 tick:63,actorId:'home-9',
 originalChoice:{action:'clearance',playerId:'home-9',team:'home'},
 realNativeStarts:['home-9'],realNativeActive:['home-9'],
 ballPosition:{x:-5,y:-3.2,z:0.12},
 ballVelocity:{x:1,y:0,z:0},
 receiver:{id:'home-9',team:'home',x:-5,y:-3.2,vx:0,vy:0},
 realOpponents:Array.from({length:11},(_,i)=>({
  id:'away-'+(i+1),team:'away',
  x:defenderX+(i===0?0:i+15),y:-3.2
 })),
 verifiedEarlierCushion:{actorId:'home-9',tick:30,
  actualPhysicsImpulseApplied:true,nativeExclusiveShoeStart:true}
});
test('M27 pure second-touch policy never invents action or possession',()=>{
 const open=choosePhysicalReceiverSecondTouch(fixtures(4));
 const close=choosePhysicalReceiverSecondTouch(fixtures(-3.1));
 assert.equal(open.decision,'defer-clearance-to-keep-ball-near');
 assert.equal(open.physicalImpulseAllowed,false);
 assert.equal(open.officialPossession,false);
 assert.equal(close.decision,'release-original-clearance');
 assert.equal(close.physicalImpulseAllowed,true);
 assert.equal(close.verifiedControl,false);
 const bad=fixtures(4);bad.realNativeStarts=[];
 assert.throws(()=>choosePhysicalReceiverSecondTouch(bad),TypeError);
 const bad2=fixtures(4);bad2.verifiedEarlierCushion=null;
 assert.throws(()=>choosePhysicalReceiverSecondTouch(bad2),TypeError);
 const far=fixtures(4);far.ballPosition={x:0,y:0,z:0.12};
 assert.equal(choosePhysicalReceiverSecondTouch(far).decision,
  'release-original-clearance');
});
test('M27 opts in only with actual M25 closed receiver source',
 {timeout:20000},async()=>{
 const R=await initializeRapier(wasm);
 const ball=CONTROL_LAB_STARTS.home;
 for(const opts of [
  {diagnosticResearchReceivingDecisionEnabled:true},
  {diagnosticResearchReceivingDecisionEnabled:true,
   diagnosticResearchControlReceiver:true,
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true},
  {diagnosticResearchReceivingDecisionEnabled:true,
   diagnosticResearchReceivingCushionEnabled:true,
   diagnosticResearchControlReceiver:true,
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true,
   diagnosticAutonomousCarryEnabled:true}
 ])assert.throws(()=>createEngine(R,ball,opts),TypeError);
 const ordinary=createEngine(R,ball);
 try{
  assert.equal(ordinary.researchReceiverChoiceSnapshot,undefined);
  assert.equal(ordinary.step().tick,1);
 }finally{ordinary.dispose();}
});
test('M27 authentic HOME/AWAY close pressure keeps source original clearance',
 {timeout:110000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const base=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-pressure'
  });
  const adapted=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-pressure-decide'
  });
  const replay=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-pressure-decide'
  });
  try{
   let decision=null;
   for(let tick=1;tick<=100;tick++){
    const a=base.step(),b=adapted.step(),c=replay.step();
    assert.deepEqual(b,c,'M27 must be exactly deterministic');
    assert.deepEqual(a.ball,b.ball,
     'original physical clearance must be unchanged under genuine close pressure');
    assert.equal(b.officialMatchPossession,false);
    assert.equal(b.decisionEvidence.officialPossession,false);
    if(tick===63){
     decision=b.physicalReceiverChoice;
     assert.ok(decision,'same original native second START required');
     assert.equal(decision.tick,63);
     assert.equal(decision.actorId,side+'-9');
     assert.equal(decision.genuineNativeSecondShoeStart,true);
     assert.equal(decision.decision,'release-original-clearance');
     assert.equal(decision.physicalImpulseAllowed,true);
     assert.equal(a.action?.action,'clearance');
     assert.equal(b.action?.action,'clearance');
     assert.ok(decision.nearestRealDefenderM<=2.5);
    }
   }
   assert.ok(decision);
   assert.equal(adapted.snapshot().pressureEvidence.completed.endReason,
    'new-same-player-physical-action');
   process.stdout.write('ME_628_M27_GENUINE_PRESSURED_'+side.toUpperCase()+' '+
    JSON.stringify({sourceTick:decision.tick,
     defenderGapM:decision.nearestRealDefenderM,decision:decision.decision,
     officialPossession:false})+'\n');
  }finally{base.dispose();adapted.dispose();replay.dispose();}
 }
});
test('M27 authentic HOME/AWAY open-side second shoe can defer a clearance',
 {timeout:110000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const base=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-decide',
   controlDecisionEnabled:false
  });
  const adapted=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-decide'
  });
  const replay=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-decide'
  });
  try{
   let decision=null,physicalMatch=true;
   for(let tick=1;tick<=95;tick++){
    const a=base.step(),b=adapted.step(),c=replay.step();
    assert.deepEqual(b,c,'no scripted outcomes, replay entire real world');
    assert.equal(b.officialMatchPossession,false);
    assert.equal(b.decisionEvidence.officialPossession,false);
    if(tick<63)
     assert.deepEqual(a.ball,b.ball,'before second native shoe no changed physics');
    if(tick===63){
     decision=b.physicalReceiverChoice;
     assert.ok(decision,'original physical second shoe candidate must exist');
     assert.equal(decision.tick,63);
     process.stdout.write('ME_628_M27_REAL_SPACE_DECISION_'+side.toUpperCase()+' '+JSON.stringify(decision)+'\\n');
     assert.ok(decision.nearestRealDefenderM>2.5);
     assert.equal(decision.decision,'defer-clearance-to-keep-ball-near');
     assert.equal(decision.physicalImpulseAllowed,false);
     assert.equal(a.action?.action,'clearance');
     assert.equal(b.action,null);
     assert.ok(b.starts.includes(side+'-9'));
     assert.notDeepEqual(a.ball,b.ball,
      'the authentic second shoe is unchanged, but original impulse is omitted');
    }
    if(tick>63&&JSON.stringify(a.ball)!==JSON.stringify(b.ball))
     physicalMatch=false;
   }
   assert.ok(decision);
   assert.equal(physicalMatch,false,
    'deferred true clearance must change subsequent original ball trajectory');
   assert.equal(adapted.snapshot().pressureEvidence.verifiedPossession,false);
   process.stdout.write('ME_628_M27_GENUINE_OPEN_'+side.toUpperCase()+' '+
    JSON.stringify({sourceTick:decision.tick,defenderGapM:decision.nearestRealDefenderM,
     decision:decision.decision,ballChangedAfterDecision:true,
     officialPossession:false})+'\n');
  }finally{base.dispose();adapted.dispose();replay.dispose();}
 }
});
