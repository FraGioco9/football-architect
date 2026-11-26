// #628 Phase M5 — read-only movement evidence under a genuine opponent
// shoe-ball contest, never authority for player-body collision or tackle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {PLAYER_DT,PLAYER_MIN_SEPARATION_M,PLAYER_MAX_SPEED_MPS} from '../src/player-movement.mjs';
import {movementLabScenario,MOVEMENT_LAB_SCENARIOS} from '../src/movement-lab-scenarios.mjs';
import {createControlledMovementLab} from '../src/movement-labs.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';

test('M5 source catalog gates contest to authenticated original HOME opponent-first',()=>{
 const scene=movementLabScenario('opponent-contact','home');
 assert.equal(scene.spec.phase,'M5');
 assert.equal(scene.spec.shoeSourceEnabled,true);
 assert.equal(scene.spec.officialMatchResult,false);
 assert.equal(scene.focusId,'home-9');
 assert.equal(scene.initial.x,-4.96);
 assert.equal(MOVEMENT_LAB_SCENARIOS.filter(s=>s.phase==='M5').length,1);
 assert.throws(()=>movementLabScenario('opponent-contact','away'),
  /Only original genuine HOME opponent-first/);
 assert.throws(()=>movementLabScenario('opponent-contact','unknown'),TypeError);
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 assert.match(html,/<option value="opponent-contact">M-08/);
 const sourceCode=readFileSync(new URL('../src/movement-labs.mjs',import.meta.url),'utf8');
 assert.match(sourceCode,/controlScene:'opponent-first'/);
 assert.doesNotMatch(sourceCode,/setTranslation|setLinvel|fakeShoeStart/);
});

test('M5 first actual opponent Rapier START follows HOME PASS and measured 22-player motion',
 {timeout:95000},async()=>{
 const R=await initializeRapier(wasm);
 const a=createControlledMovementLab(R,'opponent-contact',{side:'home'});
 const b=createControlledMovementLab(R,'opponent-contact',{side:'home'});
 try{
  const first=a.snapshot();
  assert.equal(first.tick,0);
  assert.equal(first.readout.actualOpposingShoeTick,null);
  assert.equal(first.readout.measuredOpponentPathM,0);
  assert.equal(first.readout.witnessed,false);
  assert.equal(first.readout.verifiedRapierPlayerBodyContact,false);
  let contactTick=null,receiverShoe=false;
  for(let tick=1;tick<=220;tick++){
   const f=a.step(),g=b.step();
   assert.deepEqual(f,g,'same canonical Rapier and 22-player ticks '+tick);
   assert.equal(f.tick,tick);
   assert.equal(f.players.length,22);
   assert.equal(f.focusId,'home-9');
   assert.equal(f.readout.contestedOpponentId,'away-7');
   assert.ok(f.readout.minSpacingM>=PLAYER_MIN_SEPARATION_M-1e-8);
   assert.ok(f.readout.minContestedPlayerGapM>=PLAYER_MIN_SEPARATION_M-1e-8);
   assert.ok(f.readout.focusSpeedMps<=PLAYER_MAX_SPEED_MPS+1e-8);
   assert.equal(f.readout.verifiedRapierPlayerBodyContact,false);
   assert.equal(f.officialMatchAction,false);
   assert.equal(f.officialPossession,false);
   assert.equal(f.officialMatchResult,null);
   if(tick===1){
    assert.equal(f.readout.authenticPassTick,1);
    assert.equal(f.verifiedFootContact,true);
    assert.equal(f.readout.actualOpposingShoeTick,null);
    assert.equal(f.readout.witnessed,false);
   }
   if(tick<91){
    assert.equal(f.readout.actualOpposingShoeTick,null);
    assert.equal(f.readout.verifiedRapierOpponentShoeStart,false);
    assert.equal(f.readout.witnessed,false,
     'neither opposition proximity nor target motion is a shoe event');
   }
   if(tick===91){
    assert.equal(f.readout.actualOpposingShoeTick,91);
    assert.equal(f.readout.verifiedRapierOpponentShoeStart,true);
    assert.ok(f.readout.measuredOpponentPathM>0.25);
    assert.equal(f.readout.witnessed,true);
    contactTick=tick;
   }
   if(tick>91){
    assert.equal(f.readout.actualOpposingShoeTick,91);
    assert.equal(f.readout.verifiedRapierOpponentShoeStart,true);
   }
   if(f.readout.observedReceivingShoeContact)receiverShoe=true;
  }
  assert.equal(contactTick,91);
  assert.equal(receiverShoe,false,
   'later receiver START must not become credited reception after opponent');
  const end=a.snapshot();
  assert.ok(end.readout.measuredOpponentPathM>0.25);
  assert.equal(end.readout.actualOpposingShoeTick,91);
  process.stdout.write('ME_628_M5_REAL_CONTEST '+JSON.stringify({
   passTick:end.readout.authenticPassTick,
   opponentTick:end.readout.actualOpposingShoeTick,
   observedOpposingPathM:end.readout.measuredOpponentPathM,
   minimumPlayerSpacingM:end.readout.minSpacingM,
   minimumContestedGapM:end.readout.minContestedPlayerGapM,
   officialResult:end.officialMatchResult
  })+'\n');
 }finally{a.dispose();b.dispose();}
 assert.throws(()=>a.step(),/disposed/);
 assert.throws(()=>b.snapshot(),/disposed/);
});
test('M5 negative: same authentic HOME PASS without opponent-first cannot earn contest witness',
 {timeout:45000},async()=>{
 const R=await initializeRapier(wasm);
 const plain=createControlledMovementLab(R,'post-pass',{side:'home'});
 const positive=createControlledActionLab(R,'control',{controlScene:'opponent-first',historicalEvidenceBaseline:true});
 try{
  for(let tick=1;tick<=105;tick++){
   const f=plain.step();
   const c=positive.step();
   assert.equal(f.tick,tick);
   assert.equal(f.readout.contestedOpponentId,null);
   assert.equal(f.readout.actualOpposingShoeTick,null);
   assert.equal(f.readout.verifiedRapierOpponentShoeStart,false);
   assert.equal(f.readout.verifiedRapierPlayerBodyContact,false);
   assert.equal(f.officialPossession,false);
   if(tick===91){
    assert.equal(c.firstOpposingShoe?.realShoeStart,true);
    assert.equal(c.firstOpposingShoe?.playerId,'away-7');
    assert.equal(c.firstOpposingShoe?.tick,91);
    assert.equal(c.firstOpposingShoe?.officialInterception,false);
   }
  }
  assert.ok(plain.snapshot().readout.postPassDistanceM>0.25);
 }finally{plain.dispose();positive.dispose();}
});
