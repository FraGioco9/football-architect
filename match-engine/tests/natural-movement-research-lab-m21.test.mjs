// #628 M21 LAB catalog coverage and real physical source replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {MOVEMENT_LAB_SCENARIOS,movementLabScenario}
 from '../src/movement-lab-scenarios.mjs';
import {createControlledMovementLab} from '../src/movement-labs.mjs';
const ids=['native-roll-observe','native-roll-feedback','native-roll-control',
 'native-flank-left','native-flank-right','secondary-pressure-off',
 'secondary-pressure','secondary-pressure-observe'];
test('M21 all eight new original situations have real LAB menu entry and mirror',
 ()=>{
 const got=MOVEMENT_LAB_SCENARIOS.filter(s=>s.naturalSource);
 assert.deepEqual(got.map(x=>x.id),ids);
 assert.equal(MOVEMENT_LAB_SCENARIOS.length,30);
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 for(const id of ids){
  assert.match(html,new RegExp('<option value="'+id+'">'));
  for(const side of ['home','away']){
   const item=movementLabScenario(id,side);
   assert.equal(item.spec.naturalSource,true);
   assert.equal(item.spec.officialMatchResult,false);
   if(side==='away'){
    assert.equal(item.initial.x,-item.spec.home.x);
    assert.equal(item.initial.vx,-item.spec.home.vx);
   }
  }
 }
});
test('M21 all 8 original 22-player Rapier situations work with HOME/AWAY, deterministic',
 {timeout:120000},async()=>{
 const R=await initializeRapier(wasm);
 let selectedTicks=0,started=0;
 for(const id of ids)for(const side of ['home','away']){
  const a=createControlledMovementLab(R,id,{side});
  const b=createControlledMovementLab(R,id,{side});
  try{
   assert.deepEqual(a.snapshot(),b.snapshot());
   for(let t=1;t<=45;t++){
    const p=a.step(),q=b.step();
    assert.deepEqual(p,q,id+' / '+side+' / '+t);
    assert.equal(p.tick,t);
    assert.equal(p.players.length,22);
    assert.equal(p.readout.naturalSource,true);
    assert.ok(p.readout.minimumCanonicalGapM>=0.98-1e-8);
    assert.equal(p.officialMatchResult,null);
    assert.equal(p.officialPossession,false);
    assert.equal(p.officialMatchAction,false);
    assert.equal(p.readOnly,true);
    assert.ok(p.readout.activeNativeBodyPairs.length<=p.readout.nativeBodyStarts);
    if(p.readout.firstGenuineMultiPair)
     assert.ok(p.readout.firstGenuineMultiPair.pairs.length>=2);
    if(p.readout.secondaryPlayerId)selectedTicks++;
    if(t===45)started+=p.readout.nativeBodyStarts;
   }
  }finally{a.dispose();b.dispose();}
 }
 assert.ok(selectedTicks>0,'actual second marker should be visible in M20 scenes');
 process.stdout.write('ME_628_M21_LIVE_SITUATIONS '+JSON.stringify({
  scenes:ids.length,sideVariants:2,ticksEach:45,
  observedActualSecondaryTicks:selectedTicks,realBodyStarts:started
 })+'\n');
});
test('M21 second-defender live comparison at 240 ticks keeps native safety',
 {timeout:120000},async()=>{
 const R=await initializeRapier(wasm),finals=[];
 for(const id of ['secondary-pressure-off','secondary-pressure']){
  const lab=createControlledMovementLab(R,id,{side:'home'});
  try{
   let current=lab.snapshot();
   for(let t=1;t<=240;t++)current=lab.step();
   finals.push(current);
   assert.equal(current.tick,240);
   assert.equal(current.readout.feedbackEnabled,true);
   assert.ok(current.readout.minimumCanonicalGapM>=0.98-1e-8);
  }finally{lab.dispose();}
 }
 assert.equal(finals[0].readout.secondaryPlayerId,null);
 process.stdout.write('ME_628_M21_LIVE_240 '+JSON.stringify({
  baselineBodyStarts:finals[0].readout.nativeBodyStarts,
  secondaryBodyStarts:finals[1].readout.nativeBodyStarts,
  simultaneousNativePairs:finals[1].readout.firstGenuineMultiPair!==null
 })+'\n');
});
