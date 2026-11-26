// #628 M23: real one-World Rapier action source, no false football awards.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab as createCurrentActionLab} from '../src/action-labs.mjs';
 // Historical M/B evidence comparator only. Current gameplay uses the default.
 const createControlledActionLab=(R,id,options={})=>createCurrentActionLab(R,id,{
  ...options,historicalEvidenceBaseline:!['pass-pair','cross-pair','carry-solo','dribble-1v1','keeper-1v1','defender-1v1','overload-2v1','duel-2v2','duel-3v3'].includes(id)
 });

import {createPhysicalFootballDecisionObserver}
 from '../src/physical-football-decision-evidence-m23.mjs';

test('M23 cannot mint a contact or award a football decision from arbitrary data',()=>{
 const observer=createPhysicalFootballDecisionObserver();
 assert.throws(()=>observer.snapshot(),TypeError);
 assert.throws(()=>observer.observe({}),TypeError);
 assert.throws(()=>observer.observe({
  physics:{tick:1},playerFrame:{tick:1,players:[]},
  foot:{tick:1,started:['home-10'],active:['home-10'],ended:[]}
 }),TypeError);
});
test('M23 matches genuine first pass and actual later HOME receiving shoe START',
 {timeout:60000},async()=>{
 const R=await initializeRapier(wasm);
 const a=createControlledActionLab(R,'control');
 const b=createControlledActionLab(R,'control');
 try{
  assert.deepEqual(a.snapshot().decisionEvidence,b.snapshot().decisionEvidence);
  let receipt=null;
  for(let tick=1;tick<=90;tick++){
   const x=a.step(),y=b.step(),d=x.decisionEvidence;
   assert.deepEqual(d,y.decisionEvidence);
   assert.equal(d.tick,tick);
   assert.equal(d.nativeSourceObserverOnly,true);
   assert.equal(d.readOnly,true);
   assert.equal(d.officialPossession,false);
   assert.equal(d.verifiedInterception,false);
   assert.equal(d.verifiedTackle,false);
   assert.equal(d.verifiedReception,false);
   assert.equal(x.officialMatchPossession,false);
   if(tick===1){
    assert.equal(d.actualPriorPass.tick,1);
    assert.equal(d.actualPriorPass.recipientId,'home-9');
    assert.equal(d.current.actualRapierImpulseOnTick,true);
   }
   if(tick===30){
    assert.equal(d.current.kind,'possible-post-pass-receiver-contact');
    assert.equal(d.current.actorId,'home-9');
    assert.equal(d.firstPossibleReception.tick,30);
    assert.equal(d.firstPossibleReception.passCompleted,false);
    assert.equal(d.firstPossibleOpponentInterruption,null);
    receipt=tick;
   }
  }
  assert.equal(receipt,30);
  assert.equal(a.snapshot().decisionEvidence.potentialReceiverContactTicks>=1,true);
  process.stdout.write('ME_628_M23_GENUINE_RECEIVER '+
   JSON.stringify({passTick:1,receiverTick:receipt,officialPossession:false})+'\n');
 }finally{a.dispose();b.dispose();}
});
test('M23 real opposing shoe #7 before later intended recipient forbids reception',
 {timeout:80000},async()=>{
 const R=await initializeRapier(wasm);
 const a=createControlledActionLab(R,'control',{controlScene:'opponent-first'});
 try{
  let opposing=null,recipient=null;
  for(let tick=1;tick<=220;tick++){
   const f=a.step(),d=f.decisionEvidence;
   assert.equal(d.tick,tick);
   assert.equal(d.matchAuthority,false);
   if(tick===91){
    assert.equal(d.current.kind,'possible-opponent-pass-interruption');
    assert.equal(d.current.actorId,'away-7');
    assert.equal(d.firstPossibleOpponentInterruption.tick,91);
    assert.equal(d.firstPossibleOpponentInterruption.officialInterception,false);
    opposing=d.current;
   }
   if(tick===204){
    assert.equal(d.current.kind,'unclaimed-shoe-contact');
    assert.equal(d.current.actorId,'home-9');
    assert.equal(d.firstPossibleReception,null);
    recipient=d.current;
   }
  }
  assert.equal(opposing.tick,91);
  assert.equal(recipient.tick,204);
  assert.equal(a.snapshot().decisionEvidence.verifiedInterception,false);
  process.stdout.write('ME_628_M23_GENUINE_OPPONENT_FIRST '+
   JSON.stringify({opponentTick:opposing.tick,laterReceiverTick:recipient.tick,
    officialInterception:false,officialReception:false})+'\n');
 }finally{a.dispose();}
});
test('M23 original mirrored CHALLENGE is genuine touch, never proven tackle',
 {timeout:50000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const lab=createControlledActionLab(R,'challenge',{challengeSide:side});
  const empty=createControlledActionLab(R,'challenge',{
   challengeSide:side,challengeScene:'no-contact'
  });
  try{
   const contact=lab.step(),noTouch=empty.step();
   assert.equal(contact.decisionEvidence.current.kind,'unclaimed-shoe-contact');
   assert.equal(contact.decisionEvidence.current.actorId,side+'-10');
   assert.equal(contact.decisionEvidence.current.actualRapierImpulseOnTick,true);
   assert.equal(contact.decisionEvidence.verifiedTackle,false);
   assert.equal(noTouch.decisionEvidence.current.kind,'none');
   assert.equal(noTouch.decisionEvidence.nativeShoeStarts,0);
   assert.equal(noTouch.decisionEvidence.officialPossession,false);
  }finally{lab.dispose();empty.dispose();}
 }
});
