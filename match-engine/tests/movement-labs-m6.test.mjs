import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {readFileSync} from 'node:fs';
import {initializeRapier,FIXED_DT} from '../src/core.mjs';
import {PLAYER_MIN_SEPARATION_M,PLAYER_RADIUS_M,PLAYER_MAX_SPEED_MPS} from '../src/player-movement.mjs';
import {createControlledMovementLab} from '../src/movement-labs.mjs';
import {movementLabScenario,MOVEMENT_LAB_SCENARIOS} from '../src/movement-lab-scenarios.mjs';
import {createIsolatedRapierBodyPairProbe} from '../src/rapier-body-pair-probe.mjs';

test('M6 support-lane is original movement intent, mirrored and never contact authority',()=>{
 const group=MOVEMENT_LAB_SCENARIOS.filter(s=>s.phase==='M6');
 assert.deepEqual(group.map(s=>s.id),['support-lane','support-neutral']);
 for(const scene of group){
  assert.equal(scene.shoeSourceEnabled,false);
  assert.equal(scene.officialMatchResult,false);
  const home=movementLabScenario(scene.id,'home'),
   away=movementLabScenario(scene.id,'away');
  assert.equal(home.initial.x,-away.initial.x);
  assert.equal(home.initial.y,away.initial.y);
 }
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 assert.match(html,/<option value="support-lane">M-09/);
 assert.match(html,/<option value="support-neutral">M-10/);
 const source=readFileSync(new URL('../src/movement-labs.mjs',import.meta.url),'utf8');
 assert.match(source,/supportNetAdvanceM/);
 assert.doesNotMatch(source,/diagnosticAutonomousFixtureActionEnabled:\s*true/);
});

test('M6 genuine 22-player HOME/AWAY support lanes have observed off-ball progress, and neutral has none',
 {timeout:90000},async()=>{
 const R=await initializeRapier(wasm);
 const results={};
 for(const side of ['home','away']){
  for(const id of ['support-lane','support-neutral']){
   const a=createControlledMovementLab(R,id,{side});
   const b=createControlledMovementLab(R,id,{side});
   let witnessed=false,realRun=false;
   try{
    for(let tick=1;tick<=300;tick++){
     const f=a.step(),g=b.step();
     assert.deepEqual(f,g,'real 60 Hz source replay '+side+' '+id+' '+tick);
     assert.equal(f.tick,tick);
     assert.equal(f.officialMatchAction,false);
     assert.equal(f.officialPossession,false);
     assert.equal(f.officialMatchResult,null);
     assert.equal(f.verifiedFootContact,false);
     assert.equal(f.players.length,22);
     assert.ok(f.readout.minSpacingM>=PLAYER_MIN_SEPARATION_M-1e-8);
     assert.ok(f.readout.focusSpeedMps<=PLAYER_MAX_SPEED_MPS+1e-8);
     if(id==='support-neutral'){
      assert.equal(f.readout.supportPlayerId,null);
      assert.equal(f.readout.supportLane,null);
      assert.equal(f.readout.supportTarget,null);
      assert.equal(f.readout.supportRunPathM,0);
      assert.equal(f.readout.supportNetAdvanceM,0);
      assert.equal(f.readout.witnessed,false);
     }else if(f.readout.supportPlayerId){
      realRun=true;
      assert.ok(f.readout.supportPlayerId.startsWith(side+'-'));
      assert.ok(['positive-y','negative-y'].includes(f.readout.supportLane));
      assert.ok(f.readout.supportOppClearanceM>=0);
      assert.ok(f.readout.supportTeammateClearanceM>=0);
      assert.ok(f.readout.supportTarget);
      if(f.readout.witnessed){
       witnessed=true;
       assert.ok(f.readout.supportRunPathM>0.5);
       assert.ok(f.readout.supportNetAdvanceM>0.35);
      }
     }
    }
    results[id+'-'+side]={
     witness:witnessed,
     actualRunner:a.snapshot().readout.supportPlayerId,
     progress:a.snapshot().readout.supportNetAdvanceM,
     realRun
    };
    if(id==='support-lane'){
     assert.equal(realRun,true);
     assert.equal(witnessed,true);
    }
   }finally{a.dispose();b.dispose();}
   assert.throws(()=>a.step(),/disposed/);
  }
 }
 process.stdout.write('ME_628_M6_SUPPORT '+JSON.stringify(results)+'\n');
});

test('M6 isolated native Rapier player-body impact is real and does not authorize match-body collision',
 {timeout:40000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  for(const scenario of ['impact','no-contact']){
   const a=createIsolatedRapierBodyPairProbe(R,{scenario,side}),
    b=createIsolatedRapierBodyPairProbe(R,{scenario,side});
   let first=null,afterContactSlowdown=false;
   try{
    assert.equal(a.initial.tick,0);
    assert.equal(a.initial.authenticatedRapierBodyContact,false);
    assert.equal(a.initial.isOriginalMatchWorld,false);
    assert.equal(a.initial.isCanonical22PlayerMovement,false);
    const initialRelative=a.initial.relativeSpeedMps;
    assert.ok(initialRelative>0);
    for(let tick=1;tick<=150;tick++){
     const f=a.step(),g=b.step();
     assert.deepEqual(f,g,'native Rapier deterministic pair '+side+' '+scenario);
     assert.equal(f.tick,tick);
     assert.equal(f.timeS,tick*FIXED_DT);
     assert.equal(f.actors.length,2);
     assert.equal(f.playerBodyMatchAuthority,false);
     assert.equal(f.officialTackle,false);
     assert.equal(f.officialPossession,false);
     assert.equal(f.officialResult,null);
     if(f.firstBodyContactStart&&first===null)first=f.firstBodyContactStart;
     if(f.authenticatedRapierBodyContact&&
        f.relativeSpeedMps<initialRelative-0.15)afterContactSlowdown=true;
    }
    if(scenario==='impact'){
     assert.ok(first&&first.source==='rapier-collision-start');
     assert.ok(first.tick>=30&&first.tick<=100);
     assert.ok(afterContactSlowdown,'actual Rapier solver reduced relative motion');
     assert.ok(a.snapshot().minGapM<=PLAYER_RADIUS_M*2+0.03);
     assert.ok(a.snapshot().minGapM>=PLAYER_RADIUS_M*2-0.06);
    }else{
     assert.equal(first,null);
     assert.equal(a.snapshot().authenticatedRapierBodyContact,false);
    }
   }finally{a.dispose();b.dispose();}
   assert.throws(()=>a.step(),/disposed/);
  }
 }
 assert.throws(()=>createIsolatedRapierBodyPairProbe(R,{side:'both'}),TypeError);
 assert.throws(()=>createIsolatedRapierBodyPairProbe(R,{scenario:'fake-hit'}),TypeError);
});
