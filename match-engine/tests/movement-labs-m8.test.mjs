// #628 M8: real positive native collision and bounded same-tick
// canonical XY feedback in the original 22-player Rapier ball World.
// Controlled before-tick-zero approach, not a natural 11v11 fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine} from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,PLAYER_DT,PLAYER_MAX_SPEED_MPS,
 PLAYER_MIN_SEPARATION_M} from '../src/player-movement.mjs';
import {initialResearchBodyEncounterLineup,BODY_ENCOUNTER_IDS} from '../src/research-body-encounter-initial-lineup.mjs';
import {movementLabScenario,MOVEMENT_LAB_SCENARIOS} from '../src/movement-lab-scenarios.mjs';
import {createControlledMovementLab} from '../src/movement-labs.mjs';

test('M8 before-tick-zero controlled 22-player encounter validates identities and guards',()=>{
 const ball=movementLabScenario('body-encounter','home').initial;
 assert.deepEqual(MOVEMENT_LAB_SCENARIOS.filter(s=>s.phase==='M8')
  .map(s=>s.id),['body-encounter','body-encounter-off']);
 assert.equal(ball.x,0);assert.equal(ball.y,0);assert.equal(ball.vx,0);
 const initial=initialResearchBodyEncounterLineup(INITIAL_PLAYERS,ball);
 assert.equal(initial.length,22);
 assert.equal(initial.find(p=>p.id==='home-10').x,-0.72);
 assert.equal(initial.find(p=>p.id==='away-10').x,0.72);
 assert.deepEqual(BODY_ENCOUNTER_IDS,['home-10','away-10']);
 for(let i=0;i<22;i++)for(let j=i+1;j<22;j++)
  assert.ok(Math.hypot(initial[i].x-initial[j].x,initial[i].y-initial[j].y)>=
   PLAYER_MIN_SEPARATION_M);
 assert.throws(()=>initialResearchBodyEncounterLineup(INITIAL_PLAYERS,
  {...ball,x:0.1}),TypeError);
 assert.throws(()=>createPlayerMovement({researchBodyEncounter:true,researchControlReceiver:true}),TypeError);
 assert.throws(()=>createPlayerMovement({researchBodyEncounter:false}),TypeError);
 const core=readFileSync(new URL('../src/core.mjs',import.meta.url),'utf8');
 assert.match(core,/diagnosticResearchBodyEncounter/);
 assert.match(core,/acknowledgeNativePlayerResponse/);
 assert.match(readFileSync(new URL('../lab/index.html',import.meta.url),'utf8'),
  /<option value="body-encounter">M-13/);
 assert.match(readFileSync(new URL('../lab/index.html',import.meta.url),'utf8'),
  /<option value="body-encounter-off">M-14/);
});
test('M8 same original Rapier ball world: genuine native contact and safe 22-player feedback',
 {timeout:95000},async()=>{
 const R=await initializeRapier(wasm);
 const witness={};
 for(const side of ['home','away']){
  for(const id of ['body-encounter','body-encounter-off']){
   const a=createControlledMovementLab(R,id,{side});
   const b=createControlledMovementLab(R,id,{side});
   let firstContact=null,firstAccepted=null,previous=null,maxSpeed=0,minSpacing=Infinity;
   try{
    assert.equal(a.snapshot().tick,0);
    assert.equal(a.snapshot().readout.nativeBodyStarts,0);
    for(let tick=1;tick<=110;tick++){
     const f=a.step(),g=b.step();
     assert.deepEqual(f,g,'one-world 60Hz mirrored replay '+side+' '+id+' tick '+tick);
     assert.equal(f.tick,tick);assert.equal(f.players.length,22);
     assert.equal(f.officialMatchResult,null);
     assert.equal(f.officialPossession,false);
     assert.equal(f.officialMatchAction,false);
     assert.equal(f.verifiedFootContact,false);
     assert.equal(f.readout.verifiedMatchBodyCollision,false);
     assert.ok(f.readout.minSpacingM>=PLAYER_MIN_SEPARATION_M-1e-8);
     minSpacing=Math.min(minSpacing,f.readout.minSpacingM);
     for(const p of f.players){
      const speed=Math.hypot(p.vx,p.vy);
      maxSpeed=Math.max(maxSpeed,speed);
      assert.ok(speed<=PLAYER_MAX_SPEED_MPS+1e-7);
      if(previous){
       const old=previous.find(q=>q.id===p.id);
       assert.ok(Math.hypot(p.x-old.x,p.y-old.y)<=
        PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-7);
      }
     }
     if(id==='body-encounter'){
      assert.equal(f.readout.nativeBodyCount,22);
      assert.equal(f.readout.isCurrentCanonical22BodyWorld,true);
      assert.equal(f.readout.nativeBodyControlledEncounter,true);
      assert.equal(f.readout.nativeBodyResearchColliderRadiusM,0.51);
      if(f.readout.nativeBodyStarts>0&&firstContact===null)firstContact=tick;
      if(f.readout.nativeBodyAcceptedResponses>0&&firstAccepted===null)
       firstAccepted=tick;
      if(f.readout.witnessed){
       assert.ok(firstContact!==null);
       assert.ok(firstAccepted!==null);
       assert.ok(f.readout.nativeBodyPositionsFedBack);
      }
     }else{
      assert.equal(f.readout.nativeBodyCount,0);
      assert.equal(f.readout.nativeBodyStarts,0);
      assert.equal(f.readout.nativeBodyAcceptedResponses,0);
      assert.equal(f.readout.nativeBodyPositionsFedBack,false);
      assert.equal(f.readout.witnessed,false);
     }
     previous=f.players;
    }
    witness[side+'-'+id]={
     firstContact,firstAccepted,minSpacing,maxSpeed,
     bodyStarts:a.snapshot().readout.nativeBodyStarts,
     responses:a.snapshot().readout.nativeBodyAcceptedResponses,
     endWitness:a.snapshot().readout.witnessed,
     lastReason:a.snapshot().readout.originalMoverResponseReason
    };
    if(id==='body-encounter'){
     assert.ok(firstContact!==null,'Real source native collision START mandatory');
     assert.ok(firstAccepted!==null,'At least one checked native response must reach mover');
     assert.ok(a.snapshot().readout.witnessed);
    }
   }finally{a.dispose();b.dispose();}
   assert.throws(()=>a.step(),/disposed/);
  }
 }
 process.stdout.write('ME_628_M8_CONTACT_RECONCILIATION '+JSON.stringify(witness)+'\n');
});

test('M8 exclusive physical authority and same original ball under native contact',
 {timeout:45000},async()=>{
 const R=await initializeRapier(wasm);
 const ball=movementLabScenario('body-encounter').initial;
 assert.throws(()=>createEngine(R,ball,{diagnosticResearchBodyEncounter:true}),TypeError);
 assert.throws(()=>createEngine(R,ball,{
  diagnosticResearchBodyEncounter:true,
  diagnosticPlayerBodyCollidersEnabled:true,
  diagnosticPlayerFootContactsEnabled:true
 }),TypeError);
 assert.throws(()=>createEngine(R,ball,{
  diagnosticResearchBodyEncounter:true,
  diagnosticPlayerBodyCollidersEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:true
 }),TypeError);
 assert.throws(()=>createEngine(R,{...ball,vx:1},{
  diagnosticResearchBodyEncounter:true,diagnosticPlayerBodyCollidersEnabled:true
 }),TypeError);
 const main=createEngine(R,ball,{diagnosticResearchBodyEncounter:true,
  diagnosticPlayerBodyCollidersEnabled:true});
 const ordinary=createEngine(R,ball);
 const mover=createPlayerMovement({researchBodyEncounter:true});
 try{
  assert.equal(typeof main.acknowledgeNativePlayerResponse,'function');
  assert.equal(ordinary.acknowledgeNativePlayerResponse,undefined);
  assert.throws(()=>main.step(),TypeError);
  const frame=mover.step(main.snapshot().ball.position);
  assert.equal(main.step(frame).tick,1);
  assert.deepEqual(main.snapshot(),ordinary.step(),
   'Body-only collisions cannot alter ball trajectory');
  assert.throws(()=>main.step({...frame,tick:2}),TypeError,
   'M8 must not step again before body feedback acknowledgment');
  assert.throws(()=>main.acknowledgeNativePlayerResponse({...frame,tick:0}),TypeError);
  const physical=main.nativePlayerBodySnapshot();
  mover.reconcileNativeBodyResponse(physical);
  const after=main.acknowledgeNativePlayerResponse(mover.snapshot());
  assert.equal(after.tick,1);
  assert.equal(after.physicalActors.length,22);
  const reset=main.reset();
  try{
   assert.equal(reset.snapshot().tick,0);
   assert.equal(reset.nativePlayerBodySnapshot().actualNativeStarts,0);
   assert.equal(reset.nativePlayerBodySnapshot().physicalActors.length,22);
  }finally{reset.dispose();}
 }finally{main.dispose();ordinary.dispose();}
});
