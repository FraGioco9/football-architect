// ME-PB-54 A1.2: real Rapier 60Hz universal-ball world candidate.
// Research-to-match ADAPTER only; no official match result or possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot,
 createUniversalBallCoreEngine,resolveUniversalBallTechnicalParams,
 BALL_MASS_KG,BALL_RADIUS,FIXED_DT}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS}
 from '../src/player-movement.mjs';
import {resolveGlobalBallResponse,createGlobalResponseResearchEngine}
 from '../src/player-ball-global-response.mjs';
import {createUniversalMatchBallSession,
 UNIVERSAL_MATCH_BALL_SESSION_VERSION,AUTONOMOUS_MOVEMENT_DUTIES_VERSION}
 from '../src/player-ball-universal-world.mjs';
import {readFileSync} from 'node:fs';

const R=await initializeRapier(mod);
const scenes=Object.freeze([
 Object.freeze({preset:'roll',seed:'me-pb-54-roll',
  x:4.96,y:0,z:0,vx:-0.3,vy:0,vz:0}),
 Object.freeze({preset:'drop',seed:'me-pb-54-drop'}),
 Object.freeze({preset:'launch',seed:'me-pb-54-launch'}),
 Object.freeze({preset:'bounce',seed:'me-pb-54-bounce'})
]);
const far=Object.freeze({preset:'roll',seed:'me-pb-54-no-touch',
 x:30,y:20,z:0,vx:0,vy:0,vz:0});

test('A1.2 one response scalar owns all shared technical coefficients, with 430g/11cm and fixed 60Hz',()=>{
 assert.equal(INITIAL_PLAYERS.length,22);
 assert.equal(BALL_MASS_KG,0.43);
 assert.equal(BALL_RADIUS,0.11);
 assert.equal(FIXED_DT,1/60);
 for(const x of [0.75,0.85,1,1.15,1.25]){
  const a=resolveUniversalBallTechnicalParams(x);
  const b=resolveGlobalBallResponse(x);
  assert.equal(a.response,b.value);
  assert.equal(a.footRestitution,b.internalFootRestitution);
  assert.equal(a.grassRollDecelerationMps2,b.internalGrassRollDecelerationMps2);
  assert.equal(a.footFriction,b.internalFootFriction);
  assert.equal(b.sameForAllPlayers,true);
  assert.equal(b.sameForAllShoes,true);
  assert.equal(b.sameForAllPitches,true);
  assert.equal(b.calibratedForGameplay,false);
  assert.ok(Object.isFrozen(a)&&Object.isFrozen(b));
 }
 for(const x of [0,NaN,Infinity,-1,1.251,'1',null,{}])
  assert.throws(()=>resolveUniversalBallTechnicalParams(x),
   /One bounded global ball response/);
});

test('A1.2 one default 1.00 ball for roll, drop, launch, bounce is EXACT genuine 22-shoe core Rapier A/B',()=>{
 for(const scene of scenes){
  const s=createUniversalMatchBallSession(R,scene);
  const ref=createEngine(R,scene,{diagnosticPlayerFootContactsEnabled:true});
  const mover=createPlayerMovement({experimentalAiKickApproach:true});
  try{
   assert.equal(s.snapshot().physicsTick,0);
   assert.equal(s.snapshot().version,UNIVERSAL_MATCH_BALL_SESSION_VERSION);
   assert.equal(s.snapshot().playerCount,22);
   assert.equal(s.snapshot().globalResponse,1);
   for(let t=1;t<=105;t++){
    const players=mover.step(ref.snapshot().ball.position);
    const physical=ref.step(players);
    const f=s.step();
    assert.equal(f.physicsTick,t);
    assert.ok(Math.abs(f.timeS-t/60)<1e-8);
    assert.equal(canonicalSnapshot(f.ballSnapshot),
     canonicalSnapshot(physical),'no ball trajectory drift '+scene.preset);
    assert.deepEqual(f.footContact,ref.footContactSnapshot());
    assert.equal(f.footContact.tick,t);
    assert.equal(f.playerCount,22);
    assert.equal(f.ballForceApplied,false);
    assert.equal(f.passCreated,false);
    assert.equal(f.officialMatchAction,false);
    assert.equal(f.matchRuntimeIntegrated,false);
    assert.ok(Object.isFrozen(f)&&Object.isFrozen(f.footContact));
   }
  }finally{s.dispose();ref.dispose();}
 }
});

test('A1.2 0.85/1.15 ground/air responses are real deterministic independent Rapier worlds, reset exact',()=>{
 for(const scene of scenes){
  for(const response of [0.85,1.15]){
   const a=createUniversalMatchBallSession(R,scene,{globalResponse:response});
   const b=createUniversalMatchBallSession(R,scene,{globalResponse:response});
   try{
    const trace=[];
    let airborne=0;
    for(let t=1;t<=110;t++){
     const fa=a.step(),fb=b.step();
     assert.equal(canonicalSnapshot(fa.ballSnapshot),
      canonicalSnapshot(fb.ballSnapshot));
     assert.deepEqual(fa.footContact,fb.footContact);
     assert.equal(fa.globalResponse,response);
     trace.push(canonicalSnapshot(fa.ballSnapshot));
     if(fa.ball.position.z>BALL_RADIUS+0.2)airborne++;
    }
    if(scene.preset!=='roll')
     assert.ok(airborne>15,'real flight '+scene.preset);
    const prior=a.snapshot(),replay=a.reset();
    try{
     assert.throws(()=>a.step(),/session disposed/);
     const check=[];
     for(let t=1;t<=110;t++)
      check.push(canonicalSnapshot(replay.step().ballSnapshot));
     assert.deepEqual(check,trace);
     assert.equal(prior.physicsTick,110);
    }finally{replay.dispose();}
   }finally{a.dispose();b.dispose();}
  }
 }
});

test('A1.2 authentic Rapier START/END and no-contact 22-shoe worlds cannot invent possession',()=>{
 const s=createUniversalMatchBallSession(R,scenes[0]);
 const started=[],ended=[];
 try{
  for(let t=1;t<=155;t++){
   const f=s.step();
   for(const id of f.footContact.started)started.push([t,id]);
   for(const id of f.footContact.ended)ended.push([t,id]);
   assert.equal(f.officialMatchPossession,false);
   assert.equal(f.interceptionProven,false);
   assert.equal(f.tackleProven,false);
  }
 }finally{s.dispose();}
 assert.ok(started.some(([t,id])=>t===1&&id==='away-10'));
 assert.ok(ended.some(([t,id])=>t===19&&id==='away-10'));
 assert.ok(started.some(([t,id])=>t===127&&id==='home-10'));
 const a=createUniversalMatchBallSession(R,far);
 const b=createUniversalMatchBallSession(R,far);
 try{
  for(let t=1;t<=70;t++){
   const x=a.step(),y=b.step();
   assert.equal(canonicalSnapshot(x.ballSnapshot),
    canonicalSnapshot(y.ballSnapshot));
   assert.deepEqual(x.footContact,y.footContact);
   assert.deepEqual(x.footContact.started,[]);
   assert.deepEqual(x.footContact.ended,[]);
   assert.deepEqual(x.footContact.active,[]);
  }
 }finally{a.dispose();b.dispose();}
});

test('A1.2 reject forged knobs and external frames; old core, B2 and backend boundaries stay intact',()=>{
 for(const bad of [
  {globalResponse:0.6},{globalResponse:NaN},{globalResponse:null},
  {globalResponse:1,playerId:'home-10'}, {playerFrame:{}},
  {footRestitution:0.15},{pitchType:'synthetic'},
  {globalResponse:1,ownerPlayerId:'away-10'},
  {globalResponse:1,force:{x:9}},[],null,'1'
 ]){
  assert.throws(()=>createUniversalMatchBallSession(R,scenes[0],bad),
   /only one global response|One bounded global ball response/);
 }
 assert.throws(()=>createUniversalMatchBallSession(R,{
  ...scenes[0],shoeMaterial:'x'
 }),/Unknown scenario field/);
 assert.throws(()=>createEngine(R,scenes[2],{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticGrassRollDecelerationMps2:1.0
 }),/Grass resistance sensitivity requires grounded roll/);
 assert.throws(()=>createGlobalResponseResearchEngine(R,scenes[2],1),
  /Shared response research requires grounded roll/);
 const legacy=createEngine(R,scenes[0]);
 try{
  assert.equal(legacy.footContactSnapshot,undefined);
 }finally{legacy.dispose();}
 const direct=createUniversalBallCoreEngine(R,scenes[3],0.85);
 try{
  assert.ok(direct.ballProperties.massKg>0.42);
  assert.equal(direct.footContactSnapshot().tick,0);
 }finally{direct.dispose();}
 const s=createUniversalMatchBallSession(R,scenes[0]);
 try{
  for(const bad of [{owner:'away-10'},null,0]){
   assert.throws(()=>s.step(bad),/accepts only one global response/);
   assert.equal(s.snapshot().physicsTick,0);
  }
  assert.throws(()=>s.snapshot({started:['away-10']}),
   /accepts only one global response/);
  assert.throws(()=>s.reset({ballForceApplied:true}),
   /accepts only one global response/);
  assert.equal(s.step().physicsTick,1);
 }finally{s.dispose();}
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../../backend/src/temporary-simulation.ts',
  import.meta.url),'utf8');
 assert.doesNotMatch(html,/player-ball-universal-world/);
 assert.match(backend,/temporary-score-v1/);
 assert.doesNotMatch(backend,/createUniversalMatchBallSession/);
});


test('A4.2a duty projection uses the independent real canonical mover each tick, not a contact-inferred role',()=>{
 const scene=scenes[0];
 const session=createUniversalMatchBallSession(R,scene);
 const independent=createPlayerMovement({experimentalAiKickApproach:true});
 try{
  for(let i=0;i<=155;i++){
   const before=session.snapshot();
   const observed=i===0?before:session.step();
   const reference=i===0?independent.snapshot():
    independent.step(before.ball.position);
   assert.equal(observed.physicsTick,i);
   assert.equal(observed.autonomousMovement.version,
    AUTONOMOUS_MOVEMENT_DUTIES_VERSION);
   assert.equal(observed.autonomousMovement.physicsTick,reference.tick);
   const duties=observed.autonomousMovement.players;
   assert.equal(duties.length,22);
   assert.ok(Object.isFrozen(observed.autonomousMovement));
   assert.ok(Object.isFrozen(duties));
   for(let j=0;j<22;j++){
    const d=duties[j],p=reference.players[j];
    assert.equal(d.engineId,p.id);
    assert.equal(d.team,p.team);
    assert.equal(d.role,p.role);
    if(reference.pressers[d.team]===p.id)
     assert.equal(d.movementDuty,'press');
    if(p.role==='goalkeeper')
     assert.equal(d.movementDuty,'goalkeeper-position');
    assert.equal(d.ballActionSelected,false);
    assert.equal(d.footballActionExecuted,false);
    assert.ok(Object.isFrozen(d));
   }
   assert.equal(observed.autonomousMovement.officialMatchAction,false);
   assert.equal(observed.autonomousMovement.physicalContactInferred,false);
  }
 }finally{session.dispose();}
});
