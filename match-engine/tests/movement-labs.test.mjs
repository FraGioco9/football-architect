import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {PLAYER_DT,PLAYER_MIN_SEPARATION_M,PLAYER_MAX_SPEED_MPS,
 PLAYER_TURN_RAD_PER_S} from '../src/player-movement.mjs';
import {MOVEMENT_LAB_SCENARIOS,movementLabScenario} from '../src/movement-lab-scenarios.mjs';
import {createControlledMovementLab} from '../src/movement-labs.mjs';

test('#628 M2 scenario catalog is bounded, mirrored, DEV-only and non-authoritative',()=>{
 assert.deepEqual(MOVEMENT_LAB_SCENARIOS.filter(x=>x.phase==='M2').map(x=>x.id),
  ['approach','brake','turn','recovery']);
 assert.equal(new Set(MOVEMENT_LAB_SCENARIOS.filter(x=>x.phase==='M2').map(x=>x.home.seed)).size,4);
 for(const spec of MOVEMENT_LAB_SCENARIOS.filter(x=>x.phase==='M2')){
  assert.ok(Object.isFrozen(spec)&&Object.isFrozen(spec.home));
  assert.equal(spec.officialMatchResult,false);
  assert.equal(spec.shoeSourceEnabled,false);
  const home=movementLabScenario(spec.id,'home');
  const away=movementLabScenario(spec.id,'away');
  assert.equal(home.focusId,'home-'+spec.focusNumber);
  assert.equal(away.focusId,'away-'+spec.focusNumber);
  assert.equal(home.initial.x,-away.initial.x);
  assert.equal(home.initial.y,away.initial.y);
  assert.equal(home.initial.vx,0);
  assert.equal(home.initial.vy,0);
  assert.notEqual(home.initial.seed,away.initial.seed);
 }
 assert.throws(()=>movementLabScenario('teleport'),RangeError);
 assert.throws(()=>movementLabScenario('turn','both'),TypeError);
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const dev=readFileSync(new URL('../../tools/dev-standings-preview.mjs',import.meta.url),'utf8');
 const client=readFileSync(new URL('../src/movement-labs.mjs',import.meta.url),'utf8');
 for(const spec of MOVEMENT_LAB_SCENARIOS)
  assert.match(html,new RegExp('<option value="'+spec.id+'">'));
 for(const source of ['movement-labs.mjs','movement-lab-scenarios.mjs'])
  assert.match(dev,new RegExp('__fa_match_engine__/'+source.replace('.','\\.')));
 assert.match(html,/id="movement-labs-open"/);
 assert.match(html,/id="movement-labs-dialog"/);
 assert.doesNotMatch(client,/diagnosticAutonomousFixtureActionEnabled:\s*true/);
 assert.doesNotMatch(client,/diagnosticPlayerFootContactsEnabled:\s*true/);
});

test('#628 M2 actual 22-player and Rapier ball scenarios have no synthetic touch or official outcome',
 {timeout:95000},async()=>{
 const R=await initializeRapier(wasm);
 const summary={};
 for(const spec of MOVEMENT_LAB_SCENARIOS.filter(x=>x.phase==='M2')){
  for(const side of ['home','away']){
   const a=createControlledMovementLab(R,spec.id,{side});
   const b=createControlledMovementLab(R,spec.id,{side});
   const key=spec.id+'-'+side;
   try{
    const zero=a.snapshot();
    assert.equal(zero.tick,0);
    assert.equal(zero.players.length,22);
    assert.equal(zero.verifiedFootContact,false);
    assert.equal(zero.officialMatchAction,false);
    assert.equal(zero.officialPossession,false);
    assert.equal(zero.officialMatchResult,null);
    const iterations=spec.id==='brake'?165:spec.id==='recovery'?180:95;
    let witnessed=false;
    for(let i=0;i<iterations;i++){
     const f=a.step(),g=b.step();
     assert.deepEqual(f,g,key+' deterministic replay tick '+(i+1));
     assert.equal(f.tick,i+1);
     assert.equal(f.timeS,(i+1)*PLAYER_DT);
     assert.equal(f.players.length,22);
     assert.equal(f.verifiedFootContact,false);
     assert.equal(f.officialMatchAction,false);
     assert.equal(f.officialPossession,false);
     assert.equal(f.officialMatchResult,null);
     assert.ok(f.readout.minSpacingM>=PLAYER_MIN_SEPARATION_M-1e-8);
     assert.ok(f.readout.focusSpeedMps<=PLAYER_MAX_SPEED_MPS+1e-8);
     assert.ok(f.readout.maxObservedBrakeMps2>=0);
     if(f.readout.witnessed)witnessed=true;
    }
    summary[key]={tick:iterations,witnessed,
     pathM:a.snapshot().readout.pathM,
     minSpacingM:a.snapshot().readout.minSpacingM};
   }finally{a.dispose();b.dispose();}
   assert.throws(()=>a.step(),/disposed/);
   assert.throws(()=>a.snapshot(),/disposed/);
  }
 }
 process.stdout.write('ME_628_M2_OBSERVED '+JSON.stringify(summary)+'\n');
});

test('#628 M2 a movement goal cannot authorize a shoe collision, tackle or outcome',
 {timeout:30000},async()=>{
 const R=await initializeRapier(wasm);
 const trial=createControlledMovementLab(R,'approach');
 try{
  let change=0,last=trial.snapshot();
  for(let i=0;i<90;i++){
   const now=trial.step();
   const previous=last.players.find(x=>x.id===now.focusId);
   const player=now.players.find(x=>x.id===now.focusId);
   const diff=Math.atan2(Math.sin(player.facingRad-previous.facingRad),
    Math.cos(player.facingRad-previous.facingRad));
   assert.ok(Math.abs(diff)<=PLAYER_TURN_RAD_PER_S*PLAYER_DT+1e-8);
   change+=now.readout.pathM-last.readout.pathM;
   assert.equal(now.verifiedFootContact,false);
   assert.equal(now.officialMatchAction,false);
   assert.equal(now.officialPossession,false);
   last=now;
  }
  assert.ok(change>0.2,'Canonical player must really move');
 }finally{trial.dispose();}
});
