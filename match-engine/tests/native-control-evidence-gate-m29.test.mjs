// #628 M29 — solver-backed follow-through without an invented match result.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {createNativeControlEvidenceGateM29}
 from '../src/native-control-evidence-gate-m29.mjs';

test('M29 refuses absent, duplicated and forged original native sources',()=>{
 const observer=createNativeControlEvidenceGateM29();
 assert.throws(()=>observer.snapshot(),TypeError);
 assert.throws(()=>observer.observe({}),TypeError);
 const playerFrame={tick:0,players:INITIAL_PLAYERS.map(p=>({...p,vx:0,vy:0}))};
 const physics={tick:0,ball:{position:{x:0,y:0,z:0.12},velocity:{x:0,y:0,z:0}}};
 const foot={tick:0,started:[],ended:[],active:[]};
 const m28={tick:0,active:null,latestCompleted:null,readOnly:true,
  matchAuthority:false,verifiedControl:false,verifiedPossession:false};
 assert.equal(observer.observe({physics,playerFrame,foot,solver:null,m28}).active,null);
 assert.throws(()=>observer.observe({physics,playerFrame,foot,solver:null,m28}),TypeError);
 const fake={...m28,tick:1,active:{actorId:'home-9',team:'home',
  sourceDecisionTick:1,lastTick:1,observedTicks:1,genuineSecondShoeStart:true}};
 assert.throws(()=>observer.observe({
  physics:{...physics,tick:1},playerFrame:{...playerFrame,tick:1},
  foot:{...foot,tick:1},m28:fake,solver:{tick:1,pairs:[]}
 }),TypeError,'M28 proximity and invented solver events are not source authority');
 assert.equal(observer.snapshot().tick,0,'rejected tick may not commit state');
});

test('M29 genuine HOME/AWAY M28 follow-through distinguishes continuous pair from independent new touch',
 {timeout:120000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const lab=createControlledActionLab(R,'control',{controlScene:'receive-decide',controlSide:side});
  const replay=createControlledActionLab(R,'control',{controlScene:'receive-decide',controlSide:side});
  try{
   assert.equal(lab.snapshot().physicalControlEvidence.active,null);
   let completed=null;
   for(let t=1;t<=182;t++){
    const a=lab.step(),b=replay.step();
    assert.deepEqual(a,b,'M29 cannot change original physical results');
    assert.equal(a.physicalControlEvidence.tick,t);
    assert.equal(a.physicalControlEvidence.verifiedPossession,false);
    assert.equal(a.physicalControlEvidence.officialPossession,false);
    assert.equal(a.officialMatchPossession,false);
    if(t<63)assert.equal(a.physicalControlEvidence.active,null);
    if(t===63){
     assert.equal(a.physicalControlEvidence.active?.sourceDecisionTick,63);
     assert.equal(a.physicalControlEvidence.active?.observedTicks,1);
    }
    completed=a.physicalControlEvidence.latestCompleted??completed;
   }
   assert.ok(completed,'M28 original native follow-through must close');
   assert.equal(completed.observedTicks,120);
   assert.equal(completed.realActivePairTicks,120);
   assert.equal(completed.actualShoeReleaseEvents,0);
   assert.equal(completed.subsequentExclusiveShoeStarts,0);
   assert.equal(completed.genuineReleaseThenRecontact,0);
   assert.equal(completed.independentlyReacquiredAfterRelease,false);
   assert.equal(completed.continuousNativePairWithoutRelease,true);
   assert.equal(completed.physicalSequenceClassification,'continuous-native-contact-only');
   assert.ok(completed.maximumBallToRealShoeCentreXYM>=0);
   assert.ok(completed.actualBallTravelXYM>0);
   assert.ok(completed.actualReceiverTravelXYM>0);
   assert.ok(completed.realSolverContactTicks>=0&&completed.realManifoldTicks>=0);
   assert.ok(completed.derivedNetPairImpulseSumNs>=0);
   assert.equal(completed.verifiedControl,false);
   process.stdout.write('ME_628_M29_NATIVE_'+side.toUpperCase()+' '+JSON.stringify(completed)+'\\n');
  }finally{lab.dispose();replay.dispose();}
 }
});
test('M29 pressure-triggered real clearance cannot fabricate physical custody',
 {timeout:90000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const lab=createControlledActionLab(R,'control',{
   controlScene:'receive-pressure-decide',controlSide:side
  });
  try{
   for(let t=1;t<=90;t++){
    const s=lab.step();
    assert.equal(s.physicalControlEvidence.active,null);
    assert.equal(s.physicalControlEvidence.latestCompleted,null);
    assert.equal(s.physicalControlEvidence.verifiedPossession,false);
   }
   assert.equal(lab.snapshot().physicalReceiverChoice.decision,'release-original-clearance');
  }finally{lab.dispose();}
 }
});
