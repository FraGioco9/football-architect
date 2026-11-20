// #628 M9 — one genuine Rapier event queue for body-body and shoe-ball,
// never proxy-distance attribution, duplicate worlds or official actions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier} from '../src/core.mjs';
import {createPlayerMovement,PLAYER_MIN_SEPARATION_M,
 PLAYER_MAX_SPEED_MPS} from '../src/player-movement.mjs';
import {createControlledMovementLab} from '../src/movement-labs.mjs';
import {movementLabScenario,MOVEMENT_LAB_SCENARIOS} from '../src/movement-lab-scenarios.mjs';

const opts=Object.freeze({
 diagnosticPlayerBodyCollidersEnabled:true,
 diagnosticPlayerFootContactsEnabled:true,
 diagnosticSharedContactEventsEnabled:true
});

test('M9 one native queue only with closed opt-ins, DEV-only and no action authority',async()=>{
 const R=await initializeRapier(wasm);
 const initial=movementLabScenario('shared-contacts').initial;
 assert.deepEqual(MOVEMENT_LAB_SCENARIOS.filter(s=>s.phase==='M9')
  .map(s=>s.id),['shared-contacts','shared-contacts-off']);
 assert.throws(()=>createEngine(R,initial,{
  diagnosticPlayerBodyCollidersEnabled:true,diagnosticPlayerFootContactsEnabled:true
 }),TypeError);
 assert.throws(()=>createEngine(R,initial,{
  diagnosticSharedContactEventsEnabled:true,diagnosticPlayerBodyCollidersEnabled:true
 }),TypeError);
 assert.throws(()=>createEngine(R,initial,{
  ...opts,diagnosticAutonomousFixtureActionEnabled:true
 }),TypeError);
 assert.throws(()=>createEngine(R,initial,{
  ...opts,diagnosticAutonomousCarryEnabled:true
 }),TypeError);
 assert.throws(()=>createEngine(R,initial,{
  ...opts,diagnosticResearchBodyEncounter:true,
  diagnosticResearchShotAttacker:'home'
 }),TypeError);
 const core=readFileSync(new URL('../src/core.mjs',import.meta.url),'utf8');
 assert.equal((core.match(/world\.step\(sharedContactQueue\)/g)||[]).length,1);
 assert.match(core,/sharedContactQueue\.drainCollisionEvents/);
 assert.match(core,/sharedContactQueue\.drainContactForceEvents/);
 assert.match(core,/officialMatchAction:false,officialTackle:false/);
 const foot=readFileSync(new URL('../src/rapier-foot-contact-bridge.mjs',import.meta.url),'utf8');
 const bodies=readFileSync(new URL('../src/rapier-22-body-bridge.mjs',import.meta.url),'utf8');
 assert.match(foot,/sharedQueue!==null/);
 assert.match(foot,/shoeShape\.setCollisionGroups\(0x00010001\)/);
 assert.match(core,/ballShape\.setCollisionGroups\(0x00010001\)/);
 assert.match(bodies,/BODY_INTERACTION_GROUP=0x00200020/);
 assert.match(bodies,/sharedEvents\.collisions/);
 for(const p of ['core.mjs','rapier-22-body-bridge.mjs',
   'rapier-foot-contact-bridge.mjs','movement-labs.mjs'])
  assert.doesNotMatch(readFileSync(new URL('../src/'+p,import.meta.url),'utf8'),
   /fabricateContact|fakeShoeStart|officialTackle:true/);
 const page=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 assert.match(page,/<option value="shared-contacts">M-15/);
 assert.match(page,/<option value="shared-contacts-off">M-16/);
});
test('M9 original genuine shoe START survives a shared queue with native 22-body colliders',
 {timeout:60000},async()=>{
 const R=await initializeRapier(wasm);
 // One original Rapier stationary ball at a real current original shoe,
 // not a fabricated contact, extra second ball or forced shoe event.
 const ball={
  preset:'roll',seed:'me-628-m9-native-foot-source',
  x:-4.78,y:0,z:0,vx:0,vy:0,vz:0
 };
 const mixed=createEngine(R,ball,opts);
 const shoesOnly=createEngine(R,ball,{diagnosticPlayerFootContactsEnabled:true});
 const mover=createPlayerMovement();
 const controlMover=createPlayerMovement();
 let positiveFootTick=null;
 try{
  for(let tick=1;tick<=65;tick++){
   const frame=mover.step(mixed.snapshot().ball.position);
   const controlFrame=controlMover.step(shoesOnly.snapshot().ball.position);
   const a=mixed.step(frame),b=shoesOnly.step(controlFrame);
   assert.equal(a.tick,tick);
   assert.deepEqual(a,b,'body-only group cannot alter shoe-to-ball trajectory');
   assert.deepEqual(mixed.footContactSnapshot(),shoesOnly.footContactSnapshot(),
    'same native foot-ball evidence, with and without body-only colliders');
   const data=mixed.sharedNativeContactSnapshot();
   const body=mixed.nativePlayerBodySnapshot();
   assert.equal(data.tick,tick);assert.equal(body.tick,tick);
   assert.equal(data.oneNativeEventQueue,true);
   assert.equal(data.oneNativeRapierWorld,true);
   assert.equal(data.officialMatchAction,false);
   assert.equal(data.officialTackle,false);
   assert.equal(data.officialPossession,false);
   assert.equal(data.officialResult,null);
   assert.equal(data.genuineBodyStarts,body.currentTickStarts);
   assert.equal(body.physicalActors.length,22);
   if(data.genuineFootStarts.length&&!positiveFootTick){
    positiveFootTick=tick;
    assert.ok(data.genuineFootStarts.some(x=>x==='home-10'));
    assert.ok(data.nativeCollisionEventsLastTick>=1);
   }
  }
  assert.ok(positiveFootTick!==null,
   'A physical shoe-ball START must be received through the ONE shared queue');
  process.stdout.write('ME_628_M9_REAL_SHOE '+JSON.stringify({
   tick:positiveFootTick,bodyCount:mixed.nativePlayerBodySnapshot().physicalActors.length,
   oneQueue:mixed.sharedNativeContactSnapshot().oneNativeEventQueue
  })+'\n');
 }finally{mixed.dispose();shoesOnly.dispose();}
 assert.throws(()=>mixed.sharedNativeContactSnapshot(),/disposed/);
});
test('M9 real original body collision/feedback with live shoes through one queue and independent OFF negative',
 {timeout:100000},async()=>{
 const R=await initializeRapier(wasm);
 const homeScene=movementLabScenario('shared-contacts','home');
 const awayScene=movementLabScenario('shared-contacts','away');
 assert.equal(homeScene.initial.x,-0.25);
 assert.equal(awayScene.initial.x,0.25);
 const outcomes={};
 for(const side of ['home','away']){
  for(const scene of ['shared-contacts','shared-contacts-off']){
   const a=createControlledMovementLab(R,scene,{side});
   const b=createControlledMovementLab(R,scene,{side});
   let firstBody=null,firstFeedback=null,firstShoe=null;
   try{
    assert.equal(a.snapshot().tick,0);
    for(let tick=1;tick<=110;tick++){
     const f=a.step(),g=b.step();
     assert.deepEqual(f,g,'same original Rapier world replay '+side+' '+scene+' '+tick);
     assert.equal(f.tick,tick);
     assert.equal(f.players.length,22);
     assert.equal(f.readOnly,true);
     assert.equal(f.officialMatchAction,false);
     assert.equal(f.officialPossession,false);
     assert.equal(f.officialMatchResult,null);
     assert.equal(f.verifiedFootContact,false,'no action PASS authority');
     assert.equal(f.readout.verifiedMatchBodyCollision,false);
     assert.ok(f.readout.minSpacingM>=PLAYER_MIN_SEPARATION_M-1e-8);
     for(const p of f.players)
      assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-7);
     if(scene==='shared-contacts'){
      assert.equal(f.readout.nativeBodyCount,22);
      assert.equal(f.readout.nativeSharedOneQueue,true);
      assert.equal(f.readout.nativeBodyControlledEncounter,true);
      assert.ok(Number.isSafeInteger(f.readout.nativeSharedCollisionEventsLastTick));
      assert.ok(Number.isSafeInteger(f.readout.authenticSharedShoeStarts));
      if(f.readout.nativeBodyStarts>0&&firstBody===null)firstBody=tick;
      if(f.readout.nativeBodyAcceptedResponses>0&&firstFeedback===null)
       firstFeedback=tick;
      if(f.readout.authenticSharedShoeStarts>0&&firstShoe===null)
       firstShoe=tick;
      if(f.readout.witnessed){
       assert.ok(firstBody!==null&&firstFeedback!==null&&firstShoe!==null,
        'M9 positive requires genuine shoe and body from ONE native queue');
       assert.equal(f.readout.nativeBodyPositionsFedBack,true);
      }
     }else{
      assert.equal(f.readout.nativeBodyCount,0);
      assert.equal(f.readout.nativeSharedOneQueue,false);
      assert.equal(f.readout.nativeBodyStarts,0);
      assert.equal(f.readout.nativeBodyAcceptedResponses,0);
      assert.equal(f.readout.authenticSharedShoeStarts,0);
      assert.equal(f.readout.witnessed,false);
     }
    }
    if(scene==='shared-contacts'){
     assert.ok(firstBody!==null,'genuine native body START required');
     assert.ok(firstFeedback!==null,'source-valid same-tick physical response required');
     assert.ok(firstShoe!==null,'genuine shoe-ball START in the SAME original ball World required');
     assert.equal(a.snapshot().readout.witnessed,true);
    }
    outcomes[side+'-'+scene]={
     bodyTick:firstBody,feedbackTick:firstFeedback,shoeTick:firstShoe,
     bodyStarts:a.snapshot().readout.nativeBodyStarts,
     acceptedResponses:a.snapshot().readout.nativeBodyAcceptedResponses,
     shoeStarts:a.snapshot().readout.authenticSharedShoeStarts,
     minimumGap:a.snapshot().readout.minSpacingM
    };
   }finally{a.dispose();b.dispose();}
   assert.throws(()=>a.step(),/disposed/);
  }
 }
 process.stdout.write('ME_628_M9_SINGLE_QUEUE '+JSON.stringify(outcomes)+'\n');
});
