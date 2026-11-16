// #628 M26 — no staged collision or inferred football outcome.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {INITIAL_PLAYERS,PLAYER_MIN_SEPARATION_M}
 from '../src/player-movement.mjs';
import {CONTROL_LAB_STARTS} from '../src/action-lab-scenarios.mjs';
import {initialResearchControlLineup}
 from '../src/research-control-initial-lineup.mjs';
import {initializeRapier,createEngine}
 from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {createRealPressuredFirstTouchObserver}
 from '../src/real-pressured-first-touch-m26.mjs';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
test('M26 sealed bounded starting formation has all original 22 and no manufactured collision',()=>{
 for(const side of ['home','away']){
  const initial=initialResearchControlLineup(
   INITIAL_PLAYERS,CONTROL_LAB_STARTS[side],
   {side,closeDefender:true}
  );
  assert.deepEqual(initial.map(p=>p.id),INITIAL_PLAYERS.map(p=>p.id));
  const receiver=initial.find(p=>p.id===side+'-9');
  const opp=initial.find(p=>p.id===(side==='home'?'away':'home')+'-7');
  assert.ok(dist(opp,receiver)>1.8&&dist(opp,receiver)<3);
  for(let i=0;i<22;i++)for(let j=i+1;j<22;j++)
   assert.ok(dist(initial[i],initial[j])>=PLAYER_MIN_SEPARATION_M-1e-8);
  assert.throws(()=>initialResearchControlLineup(
   INITIAL_PLAYERS,CONTROL_LAB_STARTS[side],
   {side,opponentFirst:true,closeDefender:true}
  ),TypeError);
 }
});
test('M26 only true private CONTROL source can use original close-defender research switch',
 {timeout:20000},async()=>{
 const R=await initializeRapier(wasm);
 assert.throws(()=>createEngine(R,CONTROL_LAB_STARTS.home,{
  diagnosticResearchControlCloseDefender:true
 }),TypeError);
 assert.throws(()=>createEngine(R,CONTROL_LAB_STARTS.home,{
  diagnosticResearchControlCloseDefender:true,
  diagnosticResearchControlReceiver:true,
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:true
 }),TypeError);
 const observer=createRealPressuredFirstTouchObserver();
 assert.throws(()=>observer.snapshot(),TypeError);
 assert.throws(()=>observer.observe({}),TypeError);
});
test('M26 genuine same-ball pressure traces, mirrored HOME/AWAY and replay',
 {timeout:120000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const base=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-cushion'
  });
  const pressured=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-pressure'
  });
  const replay=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-pressure'
  });
  try{
   const first=pressured.snapshot();
   assert.equal(first.pressureEvidence.tick,0);
   assert.equal(first.physicalFirstTouch,null);
   assert.equal(first.officialMatchPossession,false);
   let physical=null,atTouch=null,after=null,minOpponent=Infinity;
   let originalCushion=null;
   const nativeTimeline=[];
   let firstActualPass=null;
   for(let t=1;t<=125;t++){
    const control=base.step(),now=pressured.step(),again=replay.step();
    assert.deepEqual(now,again,'real autonomous players and Rapier must replay');
    assert.equal(now.physicsTick,t);
    assert.equal(now.pressureEvidence.tick,t);
    assert.equal(now.pressureEvidence.readOnly,true);
    assert.equal(now.pressureEvidence.verifiedControl,false);
    assert.equal(now.pressureEvidence.verifiedPossession,false);
    assert.equal(now.contactContinuity.verifiedPossession,false);
    assert.equal(now.officialMatchPossession,false);
    if(control.physicalFirstTouch&&!originalCushion)
     originalCushion=control.physicalFirstTouch;
    if(now.priorRealPass&&!firstActualPass)firstActualPass=now.priorRealPass;
    if(now.starts.length)nativeTimeline.push({tick:t,started:now.starts,action:now.action?.action??null});
    const receiver=now.observedMovementPlayers.find(p=>p.id===side+'-9');
    const opponents=now.observedMovementPlayers.filter(p=>p.team!==side);
    const nearest=Math.min(...opponents.map(p=>dist(receiver,p)));
    minOpponent=Math.min(minOpponent,nearest);
    if(now.physicalFirstTouch&&!physical){
     physical=now.physicalFirstTouch;
     atTouch=now.pressureEvidence.active;
     assert.equal(physical.nativeExclusiveShoeStart,true);
     assert.equal(physical.actualPhysicsImpulseApplied,true);
     assert.equal(now.starts.includes(side+'-9'),true);
     assert.equal(physical.officialPossession,false);
     assert.ok(atTouch&&atTouch.actorId===side+'-9');
     assert.ok(Math.abs(atTouch.nearestOpponentAtOnsetM-nearest)<1e-4);
    }
    if(now.pressureEvidence.completed&&!after)
     after=now.pressureEvidence.completed;
   }
   process.stdout.write('ME_628_M26_RAW_NATIVE_SOURCE_'+side.toUpperCase()+' '+
    JSON.stringify({pass:firstActualPass,timeline:nativeTimeline,
     minOpponent,firstCushion:physical?.tick??null,
     end:after?.endReason??null})+'\\n');
   assert.ok(originalCushion,'unpressured original M25 must remain intact');
   assert.ok(minOpponent<3,'a real unforced defender must actually approach within 3m');
   assert.ok(physical,'pressured source must generate an exclusive REAL receiver shoe START');
   assert.ok(atTouch?.nearestOpponentAtOnsetM<=3,
    'real opponent must be within the actual pressure threshold on native START');
   assert.ok(after,'real pressured observation must either finish or be interrupted');
   assert.equal(after.officialReception,false);
   assert.equal(after.claimedPossession,false);
   assert.ok(after.realOpponentWithin3MTicks>0);
   assert.ok(after.genuineSameReceiverRecontacts>=0);
   assert.ok(after.receiverBallWithin1MTicks>=0);
   assert.ok(after.receiverBallWithin1MTicks<=after.observedTicks);
   process.stdout.write('ME_628_M26_REAL_DEFENDER_'+side.toUpperCase()+' '+
    JSON.stringify({onsetTick:physical.tick,
     actualDefenderGapM:atTouch.nearestOpponentAtOnsetM,
     closestDefenderM:after.minimumRealOpponentGapM,
     pressureTicks:after.realOpponentWithin3MTicks,
     ballNear1MTicks:after.receiverBallWithin1MTicks,
     realRepeatShoeStarts:after.genuineSameReceiverRecontacts,
     traceEnd:after.endReason,observedTicks:after.observedTicks,
     awardedPossession:false})+'\n');
  }finally{base.dispose();pressured.dispose();replay.dispose();}
 }
});
