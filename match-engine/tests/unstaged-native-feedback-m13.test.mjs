// #628 M13 — source-authenticated, native, unstaged 22-body feedback.
// Every accepted solver correction must satisfy all 22 original identities,
// actual native Rapier START, 0.98m hard clearance and <=7m/s 60Hz.
// No staged pair, football tackle, possession, or official match authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier} from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_MIN_SEPARATION_M,
 PLAYER_MAX_SPEED_MPS,PLAYER_DT,createPlayerMovement}
 from '../src/player-movement.mjs';
import {createControlledMovementLab} from '../src/movement-labs.mjs';
import {MOVEMENT_LAB_SCENARIOS} from '../src/movement-lab-scenarios.mjs';

const scene={preset:'roll',seed:'m13-real-centre',x:0,y:0,z:0,
 vx:0,vy:0,vz:0};
const physicsOptions={
 diagnosticPlayerFootContactsEnabled:true,
 diagnosticPlayerBodyCollidersEnabled:true,
 diagnosticSharedContactEventsEnabled:true,
 diagnosticUnstagedBodyFeedbackEnabled:true
};
const moverOptions={
 researchOpposingPressConvergence:true,
 researchUnstagedNativeBodyFeedback:true
};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('M13 strict independent two-sided feedback gate, original initial 22 and no ordinary authority',async()=>{
 assert.deepEqual(MOVEMENT_LAB_SCENARIOS.filter(x=>x.phase==='M13')
  .map(x=>x.id),['opposing-feedback','opposing-feedback-off']);
 assert.match(readFileSync(new URL('../lab/index.html',import.meta.url),'utf8'),
  /<option value="opposing-feedback">M-21/);
 assert.match(readFileSync(new URL('../lab/index.html',import.meta.url),'utf8'),
  /<option value="opposing-feedback-off">M-22/);
 const a=createPlayerMovement(),b=createPlayerMovement(moverOptions);
 assert.deepEqual(a.snapshot().players,b.snapshot().players,
  'M13 cannot stage any player before tick zero');
 assert.equal(a.reconcileUnstagedNativeBodyResponse,undefined);
 assert.equal(typeof b.reconcileUnstagedNativeBodyResponse,'function');
 assert.equal(a.snapshot().lastPhysicalReconciliation,undefined);
 assert.equal(b.snapshot().actualNativeResponseCount,0);
 for(const options of [
  {researchUnstagedNativeBodyFeedback:true},
  {researchOpposingPressConvergence:false,
   researchUnstagedNativeBodyFeedback:true},
  {researchOpposingPressConvergence:true,
   researchUnstagedNativeBodyFeedback:false},
  {...moverOptions,researchBodyEncounter:true},
  {...moverOptions,researchControlReceiver:true},
  {...moverOptions,researchCarrySide:'home'},
  {...moverOptions,researchShotAttacker:'home'}
 ])assert.throws(()=>createPlayerMovement(options),TypeError);
 const R=await initializeRapier(wasm);
 for(const opts of [
  {diagnosticUnstagedBodyFeedbackEnabled:true},
  {diagnosticUnstagedBodyFeedbackEnabled:true,
   diagnosticPlayerBodyCollidersEnabled:true},
  {...physicsOptions,diagnosticSharedContactEventsEnabled:false},
  {...physicsOptions,diagnosticResearchBodyEncounter:true},
  {...physicsOptions,diagnosticAutonomousFixtureActionEnabled:true}
 ])assert.throws(()=>createEngine(R,scene,opts),TypeError);
 const ordinary=createEngine(R,scene);
 const physics=createEngine(R,scene,physicsOptions);
 try{
  assert.equal(ordinary.acknowledgeNativePlayerResponse,undefined);
  assert.equal(typeof physics.acknowledgeNativePlayerResponse,'function');
  assert.throws(()=>physics.step(),TypeError);
 }finally{ordinary.dispose();physics.dispose();}
});

test('M13 genuine native event and accepted canonical physical response, mirrored with OFF negative',
 {timeout:95000},async()=>{
 const R=await initializeRapier(wasm);
 const witnesses={};
 for(const side of ['home','away']){
  for(const id of ['opposing-feedback','opposing-feedback-off']){
   const a=createControlledMovementLab(R,id,{side});
   const b=createControlledMovementLab(R,id,{side});
   let firstNative=null,firstAccepted=null;
   let last=null,maxSpeed=0,minClearance=Infinity;
   try{
    assert.equal(a.snapshot().tick,0);
    for(let t=1;t<=160;t++){
     const f=a.step(),g=b.step();
     assert.deepEqual(f,g,'original single Rapier World repeat '+side+' '+id+' tick '+t);
     assert.equal(f.tick,t);
     assert.equal(f.readOnly,true);
     assert.equal(f.officialMatchAction,false);
     assert.equal(f.officialPossession,false);
     assert.equal(f.officialMatchResult,null);
     assert.equal(f.readout.verifiedMatchBodyCollision,false);
     assert.equal(f.readout.nativeBodyCount,22);
     assert.equal(f.readout.nativeSharedOneQueue,true);
     assert.equal(f.readout.nativeBodyControlledEncounter,false);
     assert.equal(f.readout.nativeBodyResearchColliderRadiusM,
      PLAYER_MIN_SEPARATION_M/2);
     assert.ok(f.readout.minSpacingM>=PLAYER_MIN_SEPARATION_M-1e-8);
     assert.equal(f.players.length,22);
     minClearance=Math.min(minClearance,f.readout.minSpacingM);
     for(let i=0;i<22;i++){
      const p=f.players[i],o=INITIAL_PLAYERS[i];
      assert.equal(p.id,o.id);
      assert.equal(p.team,o.team);
      const speed=Math.hypot(p.vx,p.vy);
      maxSpeed=Math.max(maxSpeed,speed);
      assert.ok(speed<=PLAYER_MAX_SPEED_MPS+1e-7);
      if(last)
       assert.ok(distance(p,last.players[i])<=
        PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-7,
        'every authentic 60Hz player displacement bounded');
     }
     if(f.readout.nativeBodyStarts>0&&firstNative===null)firstNative=t;
     if(f.readout.nativeBodyAcceptedResponses>0&&firstAccepted===null)
      firstAccepted=t;
     if(id==='opposing-feedback-off'){
      assert.equal(f.readout.nativeBodyAcceptedResponses,0);
      assert.equal(f.readout.nativeBodyPositionsFedBack,false);
      assert.equal(f.readout.observedOriginalFeedbackCount,0);
      assert.equal(f.readout.witnessed,false);
     }else{
      assert.equal(f.readout.researchUnstagedFeedbackEnabled,true);
      assert.equal(f.readout.observedOriginalFeedbackCount,
       f.readout.nativeBodyAcceptedResponses);
      if(f.readout.witnessed){
       assert.ok(firstNative!==null);
       assert.ok(firstAccepted!==null);
       assert.equal(f.readout.nativeBodyPositionsFedBack,true);
       assert.equal(f.readout.observedOriginalFeedbackAccepted,true);
      }
     }
     last=f;
    }
    assert.equal(firstNative,67,
     'original M12 simultaneous 22-player contact remains native at tick 67');
    if(id==='opposing-feedback'){
     assert.ok(firstAccepted!==null,
      'source-authenticated solver XY must be actually applied');
     assert.ok(a.snapshot().readout.nativeBodyAcceptedResponses>0);
    }else assert.equal(firstAccepted,null,
     'same native contact without authorization is NEVER applied');
    witnesses[side+'-'+id]={firstNative,firstAccepted,maxSpeed,
     minClearance,accepted:a.snapshot().readout.nativeBodyAcceptedResponses,
     bodyStarts:a.snapshot().readout.nativeBodyStarts,
     nativeFootStarts:a.snapshot().readout.authenticSharedShoeStarts};
   }finally{a.dispose();b.dispose();}
   assert.throws(()=>a.step(),/disposed/);
  }
 }
 process.stdout.write('ME_628_M13_NATIVE_APPLIED_VS_READONLY '+JSON.stringify(witnesses)+'\n');
});

test('M13 rejects fabricated active pair, stale tick, forged body, missing queue and duplicate acknowledgment',
 {timeout:12000},async()=>{
 const R=await initializeRapier(wasm);
 const mover=createPlayerMovement(moverOptions);
 const engine=createEngine(R,scene,physicsOptions);
 try{
  const before=mover.snapshot(),f=mover.step(engine.snapshot().ball.position);
  assert.equal(before.tick,0);
  assert.equal(f.tick,1);
  const world=engine.step(f);
  assert.equal(world.tick,1);
  const real=engine.nativePlayerBodySnapshot();
  assert.equal(real.unstagedFeedbackEnabled,true);
  assert.equal(real.controlledEncounter,false);
  assert.equal(real.activePairs.length,0);
  assert.throws(()=>mover.step(world.ball.position),/feedback acknowledgment/);
  assert.throws(()=>mover.reconcileUnstagedNativeBodyResponse({
   ...real,tick:0
  }),TypeError);
  assert.throws(()=>mover.reconcileUnstagedNativeBodyResponse({
   ...real,activePairs:['away-10|home-10']
  }),/authenticated Rapier START/);
  assert.throws(()=>mover.reconcileUnstagedNativeBodyResponse({
   ...real,physicalActors:real.physicalActors.slice(1)
  }),TypeError);
  assert.throws(()=>mover.reconcileUnstagedNativeBodyResponse({
   ...real,unstagedFeedbackEnabled:false
  }),TypeError);
  const ack=mover.reconcileUnstagedNativeBodyResponse(real);
  assert.equal(ack.accepted,false);
  assert.equal(ack.reason,'no-native-active-pair');
  assert.throws(()=>mover.reconcileUnstagedNativeBodyResponse(real),TypeError);
  assert.throws(()=>engine.step({...f,tick:2}),TypeError,
   'M13 cannot step a new Rapier tick without prior current-tick acknowledgment');
  const confirmed=engine.acknowledgeNativePlayerResponse(mover.snapshot());
  assert.equal(confirmed.tick,1);
  assert.equal(confirmed.appliedMoverResponses,0);
  assert.throws(()=>engine.acknowledgeNativePlayerResponse(mover.snapshot()),
   TypeError);
  assert.equal(mover.step(engine.snapshot().ball.position).tick,2);
 }finally{engine.dispose();}
});
