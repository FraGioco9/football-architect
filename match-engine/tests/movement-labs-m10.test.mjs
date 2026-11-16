// #628 M10 — SOURCE-only non-staged 22-player support and actual
// opposing press movement, with both Rapier contact sources enabled.
// No player lineup substitutions, forced targets, fake actions or contact.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,FIXED_DT} from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_DT,PLAYER_MAX_SPEED_MPS,
 PLAYER_MIN_SEPARATION_M} from '../src/player-movement.mjs';
import {createControlledMovementLab} from '../src/movement-labs.mjs';
import {movementLabScenario,MOVEMENT_LAB_SCENARIOS}
 from '../src/movement-lab-scenarios.mjs';

test('M10 scenario contract: ordinary unstaged 22-player formation and no fake pressure',()=>{
 const specs=MOVEMENT_LAB_SCENARIOS.filter(s=>s.phase==='M10');
 assert.deepEqual(specs.map(s=>s.id),['pressure-support','pressure-neutral']);
 for(const spec of specs){
  assert.equal(spec.officialMatchResult,false);
  assert.equal(spec.shoeSourceEnabled,false);
  for(const side of ['home','away']){
   const f=movementLabScenario(spec.id,side);
   assert.equal(f.side,side);
   assert.equal(f.initial.x,(side==='home'?1:-1)*spec.home.x);
   assert.equal(f.initial.vx,0);
   assert.equal(f.initial.vy,0);
   assert.equal(f.initial.vz,0);
  }
 }
 const source=readFileSync(new URL('../src/movement-labs.mjs',import.meta.url),'utf8');
 assert.match(source,/const pressureScene=scene\.spec\.id==='pressure-support'/);
 assert.match(source,/sharedContacts=scene\.spec\.id==='shared-contacts'\|\|pressureScene/);
 assert.match(source,/encounter\?\{researchBodyEncounter:true\}:\{\}/);
 assert.match(source,/const pressId=pressureScene\?frame\.pressers\?\.\[oppositeSide\]/);
 assert.doesNotMatch(source,/diagnosticAutonomousFixtureActionEnabled:\s*true/);
 assert.match(readFileSync(new URL('../lab/index.html',import.meta.url),'utf8'),
  /<option value="pressure-support">M-17/);
 assert.match(readFileSync(new URL('../lab/index.html',import.meta.url),'utf8'),
  /<option value="pressure-neutral">M-18/);
});
test('M10 real unstaged physical runner, opposition and native 22-body observers — mirrored replay',
 {timeout:100000},async()=>{
 const R=await initializeRapier(wasm);
 const evidence={};
 for(const side of ['home','away']){
  for(const id of ['pressure-support','pressure-neutral']){
   const trial=createControlledMovementLab(R,id,{side});
   const replay=createControlledMovementLab(R,id,{side});
   let observed=false,actualRunner=false,last=null;
   let movedOpposition=false;
   let maxMovingPath=0,maxRun=0,maxAdvance=0,physicalStarts=0;
   try{
    for(let tick=1;tick<=230;tick++){
     const f=trial.step(),g=replay.step();
     assert.deepEqual(f,g,'original 60Hz source replay '+side+' '+id+' '+tick);
     assert.equal(f.tick,tick);
     assert.equal(f.timeS,tick*PLAYER_DT);
     assert.equal(f.players.length,22);
     assert.equal(f.readOnly,true);
     assert.equal(f.officialMatchAction,false);
     assert.equal(f.officialPossession,false);
     assert.equal(f.officialMatchResult,null);
     assert.equal(f.verifiedFootContact,false);
     assert.equal(f.readout.verifiedMatchBodyCollision,false);
     assert.equal(f.readout.nativeBodyCount,22);
     assert.equal(f.readout.nativeSharedOneQueue,true);
     assert.equal(f.readout.nativeBodyControlledEncounter,false);
     assert.equal(f.readout.nativeBodyPositionsFedBack,false);
     assert.equal(f.readout.nativeBodyAcceptedResponses,0);
     assert.equal(f.readout.unstagedOriginalPlayers,true);
     assert.ok(f.readout.minSpacingM>=PLAYER_MIN_SEPARATION_M-1e-8);
     assert.ok(f.readout.maxSupportClearanceReadoutErrorM<=
      PLAYER_MAX_SPEED_MPS*FIXED_DT+1e-5);
     for(let i=0;i<22;i++){
      const p=f.players[i];
      assert.equal(p.id,INITIAL_PLAYERS[i].id);
      assert.equal(p.team,INITIAL_PLAYERS[i].team);
      assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
      if(last){
       const prior=last.players[i];
       assert.ok(Math.hypot(p.x-prior.x,p.y-prior.y)<=
        PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-7);
      }
     }
     if(f.readout.supportPlayerId){
      actualRunner=true;
      assert.ok(f.readout.supportPlayerId.startsWith(side+'-'));
      assert.ok(['positive-y','negative-y'].includes(f.readout.supportLane));
      assert.ok(f.readout.supportOppClearanceM>=0);
      assert.ok(f.readout.actualSupportLaneOpponentClearanceM>=0);
      assert.ok(f.readout.actualOpposingPresserId?.startsWith(
       (side==='home'?'away':'home')+'-'));
      assert.ok(Number.isFinite(f.readout.actualPressToLaneM));
      assert.ok(Number.isFinite(f.readout.actualPressToRunnerM));
     }
     if(f.readout.authenticatedDynamicOpposition){
      movedOpposition=true;
      assert.ok(f.readout.actualOpposingPresserPathM>0.25);
      assert.ok(f.readout.actualOpposingPresserMovedTicks>0);
     }
     if(f.readout.witnessed){
      observed=true;
      assert.equal(id,'pressure-support');
      assert.ok(f.readout.supportRunPathM>0.5);
      assert.ok(f.readout.supportNetAdvanceM>0.35);
      assert.ok(f.readout.authenticatedDynamicOpposition);
     }
     maxMovingPath=Math.max(maxMovingPath,
      f.readout.actualOpposingPresserPathM);
     maxRun=Math.max(maxRun,f.readout.supportRunPathM);
     maxAdvance=Math.max(maxAdvance,f.readout.supportNetAdvanceM);
     physicalStarts=Math.max(physicalStarts,f.readout.nativeBodyStarts);
     last=f;
    }
    evidence[id+'-'+side]={witness:observed,actualRunner,
     movingOpponent:movedOpposition,maxMovingPath,maxRun,maxAdvance,
     nativeBodyStarts:physicalStarts,
     finalShoeStarts:trial.snapshot().readout.authenticSharedShoeStarts};
    if(id==='pressure-support'){
     assert.equal(actualRunner,true,
      'Original opponent-aware support selected only from observed 22 XY');
     assert.equal(movedOpposition,true,
      'Original opposing presser must physically move, no fake opponent');
     assert.equal(observed,true,
      'Consecutive actual support-runner and opponent XY must both advance');
    }else{
     assert.equal(actualRunner,false,'Neutral ball cannot invent support');
     assert.equal(observed,false,'No support means no positive witness');
     assert.equal(maxRun,0);
     assert.equal(maxAdvance,0);
     assert.equal(movedOpposition,false,
      'Without chosen support we cannot claim pressure on that runner');
    }
   }finally{trial.dispose();replay.dispose();}
   assert.throws(()=>trial.step(),/disposed/);
  }
 }
 process.stdout.write('ME_628_M10_UNSTAGED_PRESSURE '+
  JSON.stringify(evidence)+'\n');
});
