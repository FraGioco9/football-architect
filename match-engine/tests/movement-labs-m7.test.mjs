// #628 Phase M7. Native 22-body dynamic colliders in ORIGINAL Rapier ball
// world, but their physical XY is not yet reconciled into canonical mover.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,ENGINE_VERSION,FIXED_DT} from '../src/core.mjs';
import {createPlayerMovement,PLAYER_MIN_SEPARATION_M,
 PLAYER_MAX_SPEED_MPS,PLAYER_DT} from '../src/player-movement.mjs';
import {createControlledMovementLab} from '../src/movement-labs.mjs';
import {movementLabScenario,MOVEMENT_LAB_SCENARIOS} from '../src/movement-lab-scenarios.mjs';

test('M7 research opt-in only; same accepted ball World and never shoe/action authority',
 {timeout:45000},async()=>{
 const R=await initializeRapier(wasm);
 const initial=movementLabScenario('body-world').initial;
 assert.equal(MOVEMENT_LAB_SCENARIOS.filter(s=>s.phase==='M7').length,2);
 assert.equal(initial.x,movementLabScenario('body-off').initial.x);
 assert.equal(initial.y,movementLabScenario('body-off').initial.y);
 assert.throws(()=>createEngine(R,initial,{diagnosticPlayerBodyCollidersEnabled:'on'}),TypeError);
 assert.throws(()=>createEngine(R,initial,{
  diagnosticPlayerBodyCollidersEnabled:true,
  diagnosticPlayerFootContactsEnabled:true
 }),TypeError);
 assert.throws(()=>createEngine(R,initial,{
  diagnosticPlayerBodyCollidersEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:true
 }),TypeError);
 const source=createEngine(R,initial,{diagnosticPlayerBodyCollidersEnabled:true});
 const normal=createEngine(R,initial);
 const mover=createPlayerMovement();
 try{
  assert.equal(typeof source.nativePlayerBodySnapshot,'function');
  assert.equal(normal.nativePlayerBodySnapshot,undefined);
  assert.equal(source.nativePlayerBodySnapshot().physicalActors.length,22);
  assert.equal(source.nativePlayerBodySnapshot().tick,0);
  assert.equal(source.nativePlayerBodySnapshot().sameOriginalRapierBallWorld,true);
  assert.equal(source.nativePlayerBodySnapshot().physicallyAuthoritativeMatchWorld,false);
  assert.equal(source.nativePlayerBodySnapshot().physicalPositionsFedBackIntoMover,false);
  assert.throws(()=>source.step(),/requires original current player frame/);
  assert.throws(()=>source.step(mover.snapshot()),/One ordered current 60 Hz canonical frame/);
  for(let tick=1;tick<=95;tick++){
   const before=source.snapshot();
   const frame=mover.step(before.ball.position);
   const physical=source.step(frame);
   const baseline=normal.step();
   assert.deepEqual(physical,baseline,
    'native player bodies are collision-group isolated from the original ball');
   assert.equal(physical.version,ENGINE_VERSION);
   const body=source.nativePlayerBodySnapshot();
   assert.equal(body.tick,tick);
   assert.equal(body.physicalActors.length,22);
   assert.ok(Number.isFinite(body.minPhysicalGapM)&&body.minPhysicalGapM>0);
   assert.ok(Number.isFinite(body.maxCanonicalDriftM));
   assert.equal(body.playerBodyMatchAuthority,false);
   assert.equal(body.verifiedMatchBodyCollision,false);
   assert.equal(body.officialTackle,false);
   assert.equal(body.officialPossession,false);
   for(const event of body.events){
    assert.ok(event.tick<=tick&&event.tick>0);
    assert.ok(['rapier-body-start','rapier-body-end'].includes(event.type));
    assert.equal(event.source,'native-rapier-collision-event');
    assert.match(event.pair,/^(?:away|home)-[0-9]+\|(?:away|home)-[0-9]+$/);
   }
  }
  assert.equal(normal.snapshot().tick,95);
 }finally{source.dispose();normal.dispose();}
 assert.throws(()=>source.nativePlayerBodySnapshot(),/disposed/);
});

test('M7 sampled canonical velocity only; rejects forged teleport/identity and preserves reset',
 {timeout:30000},async()=>{
 const R=await initializeRapier(wasm);
 const ball=movementLabScenario('body-world').initial;
 const physics=createEngine(R,ball,{diagnosticPlayerBodyCollidersEnabled:true});
 const mover=createPlayerMovement();
 try{
  const sample=mover.step(physics.snapshot().ball.position);
  const stale={...sample,tick:0};
  assert.throws(()=>physics.step(stale),TypeError);
  const forged={...sample,players:sample.players.map((p,i)=>
   i===0?{...p,x:p.x+1}:p)};
  assert.throws(()=>physics.step(forged),TypeError);
  const swapped={...sample,players:[
   sample.players[1],sample.players[0],...sample.players.slice(2)]};
  assert.throws(()=>physics.step(swapped),TypeError);
  assert.equal(physics.step(sample).tick,1);
  const newer=physics.reset();
  try{
   assert.equal(newer.snapshot().tick,0);
   assert.equal(newer.nativePlayerBodySnapshot().actualNativeStarts,0);
   assert.equal(newer.nativePlayerBodySnapshot().physicalActors.length,22);
  }finally{newer.dispose();}
 }finally{physics.dispose();}
});

test('M7 HOME/AWAY deterministic original-mover control and OFF negative',
 {timeout:95000},async()=>{
 const R=await initializeRapier(wasm);
 const matrix={};
 for(const side of ['home','away']){
  for(const id of ['body-world','body-off']){
   const a=createControlledMovementLab(R,id,{side});
   const b=createControlledMovementLab(R,id,{side});
   let startsSeen=false;
   try{
    for(let tick=1;tick<=140;tick++){
     const frame=a.step(),replay=b.step();
     assert.deepEqual(frame,replay,'native same-world replay '+side+' '+id+' tick '+tick);
     assert.equal(frame.tick,tick);
     assert.equal(frame.timeS,tick*PLAYER_DT);
     assert.equal(frame.players.length,22);
     assert.equal(frame.officialMatchAction,false);
     assert.equal(frame.officialPossession,false);
     assert.equal(frame.officialMatchResult,null);
     assert.equal(frame.readout.verifiedMatchBodyCollision,false);
     assert.equal(frame.readout.nativeBodyPositionsFedBack,false);
     assert.equal(frame.verifiedFootContact,false);
     assert.ok(frame.readout.minSpacingM>=PLAYER_MIN_SEPARATION_M-1e-8);
     assert.ok(frame.readout.focusSpeedMps<=PLAYER_MAX_SPEED_MPS+1e-8);
     if(id==='body-world'){
      assert.equal(frame.readout.nativeBodyCount,22);
      assert.equal(frame.readout.isCurrentCanonical22BodyWorld,true);
      assert.equal(frame.readout.nativeBodyEventSource,'native-rapier-collision-event');
      assert.ok(Number.isFinite(frame.readout.nativeBodyMinPhysicalGapM));
      assert.ok(Number.isFinite(frame.readout.nativeBodyMaxMoverDriftM));
      if(frame.readout.nativeBodyStarts>0)startsSeen=true;
      assert.equal(frame.readout.witnessed,startsSeen);
     }else{
      assert.equal(frame.readout.nativeBodyCount,0);
      assert.equal(frame.readout.nativeBodyStarts,0);
      assert.equal(frame.readout.nativeBodyMinPhysicalGapM,null);
      assert.equal(frame.readout.isCurrentCanonical22BodyWorld,false);
      assert.equal(frame.readout.witnessed,false);
     }
    }
    matrix[id+'-'+side]={
     actualNativeStarts:a.snapshot().readout.nativeBodyStarts,
     bodyCount:a.snapshot().readout.nativeBodyCount,
     maxCanonicalDriftM:a.snapshot().readout.nativeBodyMaxMoverDriftM
    };
   }finally{a.dispose();b.dispose();}
   assert.throws(()=>a.snapshot(),/disposed/);
  }
 }
 process.stdout.write('ME_628_M7_CANONICAL_BODY '+JSON.stringify(matrix)+'\n');
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 assert.match(html,/<option value="body-world">M-11/);
 assert.match(html,/<option value="body-off">M-12/);
});
