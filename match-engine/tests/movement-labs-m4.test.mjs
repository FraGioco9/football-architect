// #628 M4 — genuine mirrored AWAY CONTROL shoe action and receiver-run evidence.
// Never accept a target, side choice, or ball adjacency as a PASS witness.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine} from '../src/core.mjs';
import {INITIAL_PLAYERS,createPlayerMovement,PLAYER_MIN_SEPARATION_M,
 PLAYER_MAX_SPEED_MPS} from '../src/player-movement.mjs';
import {CONTROL_LAB_STARTS} from '../src/action-lab-scenarios.mjs';
import {initialResearchControlLineup} from '../src/research-control-initial-lineup.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {createControlledMovementLab} from '../src/movement-labs.mjs';
import {movementLabScenario} from '../src/movement-lab-scenarios.mjs';

test('M4 authentic AWAY initial CONTROL scenario mirrors ball and receiver positions',()=>{
 const h=CONTROL_LAB_STARTS.home,a=CONTROL_LAB_STARTS.away;
 assert.equal(h.x,-a.x);assert.equal(h.y,a.y);
 assert.equal(h.vx,-a.vx);assert.equal(h.vy,a.vy);
 assert.equal(a.z,0);
 const home=initialResearchControlLineup(INITIAL_PLAYERS,h,{side:'home'});
 const away=initialResearchControlLineup(INITIAL_PLAYERS,a,{side:'away'});
 const get=(players,id)=>players.find(p=>p.id===id);
 const homeReceiver=get(home,'home-9'),awayReceiver=get(away,'away-9');
 assert.equal(homeReceiver.x,-awayReceiver.x);
 assert.equal(homeReceiver.y,awayReceiver.y);
 assert.equal(homeReceiver.vx,0);
 assert.equal(awayReceiver.vx,0);
 assert.equal(homeReceiver.baseX,-awayReceiver.baseX);
 assert.equal(movementLabScenario('post-pass','away').focusId,'away-9');
 assert.equal(movementLabScenario('post-pass','away').initial,a);
 for(const side of ['home','away']){
  const v=initialResearchControlLineup(INITIAL_PLAYERS,CONTROL_LAB_STARTS[side],{side});
  for(let i=0;i<v.length;i++)for(let j=i+1;j<v.length;j++)
   assert.ok(Math.hypot(v[i].x-v[j].x,v[i].y-v[j].y)>=PLAYER_MIN_SEPARATION_M-1e-8);
 }
 assert.throws(()=>initialResearchControlLineup(INITIAL_PLAYERS,h,{side:'away'}),TypeError);
 assert.throws(()=>initialResearchControlLineup(INITIAL_PLAYERS,a,{side:'away',opponentFirst:true}),TypeError);
 assert.throws(()=>initialResearchControlLineup(INITIAL_PLAYERS,a,{side:'other'}),TypeError);
 assert.throws(()=>createPlayerMovement({researchControlSide:'away'}),TypeError);
 assert.throws(()=>createPlayerMovement({researchControlReceiver:true,
  researchControlBall:a,researchControlSide:'away',researchControlOpponentFirst:true}),TypeError);
});
test('M4 same Rapier physics world grants true AWAY shoe START and original policy PASS',
 {timeout:80000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const a=createControlledActionLab(R,'control',{controlSide:side});
  const b=createControlledActionLab(R,'control',{controlSide:side});
  try{
   const initial=a.snapshot();
   assert.equal(initial.physicsTick,0);
   assert.equal(initial.priorRealPass,null);
   assert.equal(initial.action,null);
   assert.deepEqual(initial.starts,[]);
   assert.equal(initial.players.length,22);
   assert.equal(initial.controlSide,side);
   let pass=null;
   for(let tick=1;tick<=130;tick++){
    const f=a.step(),g=b.step();
    assert.deepEqual(f,g,'canonical replay tick '+tick);
    assert.equal(f.physicsTick,tick);
    assert.equal(f.officialMatchResult,null);
    assert.equal(f.officialMatchPossession,false);
    assert.equal(f.scoreChanged,false);
    assert.equal(f.players.length,22);
    assert.equal(f.observedMovementPlayers.length,22);
    if(f.priorRealPass&&!pass){
     pass=f.priorRealPass;
     assert.equal(pass.tick,tick);
     assert.deepEqual(f.starts,[side+'-10']);
     assert.equal(f.action?.playerId,side+'-10');
     assert.equal(f.action?.team,side);
     assert.equal(f.action?.action,'pass');
     assert.equal(f.action?.appliedByRapier,true);
     assert.equal(f.action?.actualPhysicsImpulseApplied,true);
     assert.equal(pass.recipientId,side+'-9');
     assert.equal(pass.physicalImpulseApplied,true);
     assert.equal(f.action?.passTarget?.passCompleted,false);
    }
   }
   assert.ok(pass,'Only authentic same-world '+side+' Rapier PASS is accepted');
   assert.equal(pass.tick,1,'Genuine shoe START at tick one');
  }finally{a.dispose();b.dispose();}
  assert.throws(()=>a.step(),/disposed/);
 }
 assert.throws(()=>createControlledActionLab(R,'control',{controlSide:'away',controlScene:'opponent-first'}),TypeError);
 assert.throws(()=>createControlledActionLab(R,'pass',{controlSide:'away'}),TypeError);
 assert.throws(()=>createEngine(R,CONTROL_LAB_STARTS.away,{
  diagnosticResearchControlSide:'away'
 }),TypeError);
});
test('M4 AWAY receiver moves after original authenticated PASS with full replay and no outcome',
 {timeout:90000},async()=>{
 const R=await initializeRapier(wasm);
 const a=createControlledMovementLab(R,'post-pass',{side:'away'});
 const b=createControlledMovementLab(R,'post-pass',{side:'away'});
 try{
  assert.equal(a.snapshot().tick,0);
  assert.equal(a.snapshot().focusId,'away-9');
  assert.equal(a.snapshot().readout.authenticPassTick,null);
  let firstWitness=null;
  for(let tick=1;tick<=120;tick++){
   const f=a.step(),g=b.step();
   assert.deepEqual(f,g);
   assert.equal(f.tick,tick);
   assert.equal(f.focusId,'away-9');
   assert.equal(f.players.length,22);
   assert.equal(f.officialMatchAction,false);
   assert.equal(f.officialMatchResult,null);
   assert.equal(f.officialPossession,false);
   assert.equal(f.readout.authenticPassTick,1);
   assert.equal(f.verifiedFootContact,true);
   assert.ok(f.readout.minSpacingM>=PLAYER_MIN_SEPARATION_M-1e-8);
   assert.ok(f.readout.focusSpeedMps<=PLAYER_MAX_SPEED_MPS+1e-8);
   if(tick===1)assert.equal(f.readout.postPassDistanceM,0);
   if(f.readout.witnessed&&firstWitness===null)firstWitness=tick;
  }
  assert.ok(firstWitness>1,'AWAY receiving runner must actually move AFTER PASS');
  assert.ok(a.snapshot().readout.postPassDistanceM>0.25);
 }finally{a.dispose();b.dispose();}
 assert.throws(()=>a.step(),/disposed/);
});
