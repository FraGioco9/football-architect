// #628 M3: no new football policy, same Rapier CONTROL pass source and
// current-opponent-driven canonical recovery. Observer only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {PLAYER_MIN_SEPARATION_M,PLAYER_MAX_SPEED_MPS} from '../src/player-movement.mjs';
import {MOVEMENT_LAB_SCENARIOS,movementLabScenario} from '../src/movement-lab-scenarios.mjs';
import {createControlledMovementLab} from '../src/movement-labs.mjs';

test('#628 M3 includes source-bound post-PASS and actual-opponent recovery without expanding tactics',()=>{
 const m3=MOVEMENT_LAB_SCENARIOS.filter(x=>x.phase==='M3');
 assert.deepEqual(m3.map(x=>x.id),
  ['recovery-response','recovery-empty','post-pass']);
 assert.equal(m3.filter(x=>x.shoeSourceEnabled).length,1);
 assert.equal(movementLabScenario('post-pass','home').focusId,'home-9');
 assert.throws(()=>movementLabScenario('post-pass','away'),/Only physically verified HOME/);
 for(const id of ['recovery-response','recovery-empty']){
  const a=movementLabScenario(id,'home');
  const b=movementLabScenario(id,'away');
  assert.equal(a.initial.x,-b.initial.x);
  assert.equal(a.initial.y,b.initial.y);
  assert.equal(a.spec.shoeSourceEnabled,false);
  assert.equal(a.spec.officialMatchResult,false);
 }
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 for(const item of m3)assert.match(html,new RegExp('<option value="'+item.id+'">'));
 const code=readFileSync(new URL('../src/movement-labs.mjs',import.meta.url),'utf8');
 assert.match(code,/createControlledActionLab\(RAPIER,'control'\)/);
 assert.doesNotMatch(code,/setTranslation|setLinvel|player-ball-universal-world/);
});
test('#628 M3 genuine physical PASS tick 1 precedes measured actual HOME receiver motion',
 {timeout:75000},async()=>{
 const R=await initializeRapier(wasm);
 const a=createControlledMovementLab(R,'post-pass',{side:'home'});
 const b=createControlledMovementLab(R,'post-pass',{side:'home'});
 try{
  assert.equal(a.snapshot().tick,0);
  assert.equal(a.snapshot().verifiedFootContact,false);
  assert.equal(a.snapshot().readout.authenticPassTick,null);
  assert.equal(a.snapshot().readout.postPassDistanceM,0);
  let witnessTick=null,passTick=null,contactSeen=false;
  for(let tick=1;tick<=120;tick++){
   const f=a.step(),g=b.step();
   assert.deepEqual(f,g,'Source-bound replay at tick '+tick);
   assert.equal(f.tick,tick);
   assert.equal(f.players.length,22);
   assert.equal(f.focusId,'home-9');
   assert.equal(f.officialMatchResult,null);
   assert.equal(f.officialMatchAction,false);
   assert.equal(f.officialPossession,false);
   assert.ok(f.readout.minSpacingM>=PLAYER_MIN_SEPARATION_M-1e-8);
   assert.ok(f.readout.focusSpeedMps<=PLAYER_MAX_SPEED_MPS+1e-8);
   if(tick===1){
    assert.equal(f.readout.authenticPassTick,1);
    assert.equal(f.verifiedFootContact,true);
    assert.equal(f.readout.postPassDistanceM,0);
   }
   if(f.readout.authenticPassTick!==null)passTick=f.readout.authenticPassTick;
   if(f.readout.observedReceivingShoeContact)contactSeen=true;
   if(f.readout.witnessed&&witnessTick===null)witnessTick=tick;
  }
  assert.equal(passTick,1);
  assert.ok(witnessTick>passTick,'Only actual movement AFTER the source PASS counts');
  assert.ok(a.snapshot().readout.postPassDistanceM>0.25);
  assert.equal(contactSeen,true,'Only the existing authentic receiver shoe witness is accepted');
  assert.throws(()=>createControlledMovementLab(R,'post-pass',{side:'away'}),
   /Only physically verified HOME/);
 }finally{a.dispose();b.dispose();}
 assert.throws(()=>a.step(),/disposed/);
});
test('#628 M3 current-opponent recovery reports goal-side motion only with actual assignment',
 {timeout:75000},async()=>{
 const R=await initializeRapier(wasm);
 const results={};
 for(const side of ['home','away']){
  for(const id of ['recovery-response','recovery-empty']){
   const a=createControlledMovementLab(R,id,{side});
   const b=createControlledMovementLab(R,id,{side});
   let seenActor=false,seenResponse=false;
   try{
    for(let tick=1;tick<=180;tick++){
     const f=a.step(),g=b.step();
     assert.deepEqual(f,g,side+' '+id+' deterministic tick '+tick);
     assert.equal(f.officialMatchAction,false);
     assert.equal(f.officialPossession,false);
     assert.equal(f.verifiedFootContact,false);
     assert.ok(f.readout.minSpacingM>=PLAYER_MIN_SEPARATION_M-1e-8);
     if(id==='recovery-empty'){
      assert.equal(f.readout.recoveryObserved,false);
      assert.equal(f.readout.observedOpponentId,null);
      assert.equal(f.readout.goalSideTravelM,0);
      assert.equal(f.readout.witnessed,false);
     }else{
      if(f.readout.assignedRecoveryPlayer){
       seenActor=true;
       assert.ok(f.readout.observedOpponentId?.startsWith(
        side==='home'?'away-':'home-'));
      }
      if(f.readout.witnessed){
       seenResponse=true;
       assert.ok(f.readout.assignedRecoveryPlayer);
       assert.ok(f.readout.goalSideTravelM>0.15);
      }
     }
    }
    results[id+'-'+side]={
     seenActor,seenResponse,
     goalSideTravelM:a.snapshot().readout.goalSideTravelM,
     minSpacingM:a.snapshot().readout.minSpacingM
    };
    if(id==='recovery-response')assert.equal(seenActor,true);
   }finally{a.dispose();b.dispose();}
  }
 }
 process.stdout.write('ME_628_M3_RECOVERY '+JSON.stringify(results)+'\n');
});
