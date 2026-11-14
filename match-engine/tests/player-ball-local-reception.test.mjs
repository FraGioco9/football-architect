// ME-PB-50 / B2: sealed local 22-player reception session.
// Every accepted acquisition comes from the session's actual internal
// Rapier collider START/ACTIVE/END and measured same-tick ball motion.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapierModule from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,canonicalSnapshot,createEngine}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS}
 from '../src/player-movement.mjs';
import {createGlobalResponseResearchEngine}
 from '../src/player-ball-global-response.mjs';
import {BALL_OWNERSHIP_CONTROL_TICKS}
 from '../src/player-ball-ownership.mjs';
import {createLocalBallReceptionSession,LOCAL_BALL_RECEPTION_VERSION}
 from '../src/player-ball-local-reception.mjs';
import {readFileSync} from 'node:fs';

const Rapier=await initializeRapier(rapierModule);
const SCENE=Object.freeze({
 preset:'roll',seed:'me-pb-50-authentic-reception',
 x:4.96,y:0,z:0,vx:-0.3,vy:0,vz:0
});
const DISTANT=Object.freeze({
 preset:'roll',seed:'me-pb-50-no-contact',
 x:30,y:20,z:0,vx:0,vy:0,vz:0
});
function sessionTrace(scene=SCENE,{ticks=155,response=1}={}){
 const s=createLocalBallReceptionSession(Rapier,scene,{
  globalResponse:response
 });
 const frames=[];
 try{
  const initial=s.snapshot();
  assert.equal(initial.physicsTick,0);
  assert.equal(initial.phase,'free');
  assert.equal(initial.ownerPlayerId,null);
  assert.equal(initial.officialMatchPossession,false);
  for(let tick=1;tick<=ticks;tick++){
   const frame=s.step();
   assert.equal(frame.physicsTick,tick);
   assert.equal(frame.timeS,frame.ballSnapshot.time,
    'local session time must come from the actual real Rapier snapshot');
   assert.ok(Math.abs(frame.timeS-tick/60)<1e-12,
    'two equivalent 60Hz time formulas can differ at the final float bit');
   assert.equal(frame.footContact.tick,tick);
   assert.equal(frame.playerCount,INITIAL_PLAYERS.length);
   assert.equal(frame.contactSource,'internal-real-rapier-60hz');
   assert.equal(frame.officialMatchPossession,false);
   assert.equal(frame.ballForceApplied,false);
   assert.equal(frame.passCreated,false);
   if(frame.phase==='controlled'){
    assert.equal(frame.ownerPlayerId,frame.ownerState.candidatePlayerId);
    assert.equal(frame.ownerPlayerId,frame.ownerState.contactProvenancePlayerId);
    assert.ok(frame.ownerState.candidateStreakTicks>=
     BALL_OWNERSHIP_CONTROL_TICKS);
    assert.ok(frame.footContact.active.includes(frame.ownerPlayerId));
   }else assert.equal(frame.ownerPlayerId,null);
   assert.ok(Object.isFrozen(frame));
   assert.ok(Object.isFrozen(frame.ownerState));
   assert.ok(Object.isFrozen(frame.footContact));
   frames.push(Object.freeze({
    tick,
    ball:canonicalSnapshot(frame.ballSnapshot),
    started:Object.freeze([...frame.footContact.started]),
    ended:Object.freeze([...frame.footContact.ended]),
    active:Object.freeze([...frame.footContact.active]),
    phase:frame.phase,owner:frame.ownerPlayerId,
    candidate:frame.candidatePlayerId,
    streak:frame.ownerState.candidateStreakTicks,
    source:frame.ownerState.contactProvenanceStartTick,
    acquisitions:frame.controlAcquisitions
   }));
  }
  return Object.freeze(frames);
 }finally{s.dispose();}
}
const at=(a,t)=>a[t-1];

test('ME-PB-50 actual integrated 22-player Rapier reception requires real START plus six stable frames, not a graze',()=>{
 const a=sessionTrace(),b=sessionTrace();
 assert.deepEqual(a,b,'two independent genuine engine instances replay identically');
 assert.equal(LOCAL_BALL_RECEPTION_VERSION,
  'me-pb-50-closed-trusted-rapier-reception-v1');
 assert.ok(at(a,1).started.includes('away-10'));
 assert.equal(at(a,1).phase,'contested');
 assert.equal(at(a,1).owner,null);
 assert.equal(at(a,6).owner,null);
 assert.equal(at(a,7).owner,'away-10');
 assert.equal(at(a,7).source,1);
 assert.equal(at(a,7).streak,6);
 assert.equal(at(a,7).acquisitions,1);
 assert.ok(at(a,19).ended.includes('away-10'));
 assert.equal(at(a,19).phase,'free');
 assert.equal(at(a,19).owner,null);
 assert.ok(a.slice(19,126).every(x=>x.owner===null));
 assert.ok(at(a,127).started.includes('home-10'));
 assert.equal(at(a,127).phase,'contested');
 assert.equal(at(a,127).owner,null);
 assert.ok(at(a,130).ended.includes('home-10'));
 assert.equal(at(a,130).owner,null);
 assert.ok(at(a,141).started.includes('home-10'));
 assert.equal(at(a,141).owner,null);
 assert.equal(at(a,145).owner,null);
 assert.equal(at(a,146).owner,'home-10');
 assert.equal(at(a,146).source,141);
 assert.equal(at(a,146).streak,6);
 assert.ok(a.every(frame=>frame.owner===null||
  a.some(start=>start.tick===frame.source&&
   start.started.includes(frame.owner))));
 assert.ok(a.every(frame=>frame.phase!=='controlled'||
  frame.active.length===1));
 process.stdout.write('ME_PB_50_TRUSTED_REAL_RECEPTION '+
  JSON.stringify({firstStart:1,firstAcquire:7,firstEnd:19,
   shortStart:127,shortEnd:130,shortQualified:false,
   newStart:141,secondAcquire:146,
   allCanonicalFrames:155,independentReplay:true,
   officialMatchPossession:false,extraPhysicsImpulse:false})+'\n');
});

test('ME-PB-50 session read-only observer exactly matches a separately driven Rapier+22-player world',()=>{
 const session=createLocalBallReceptionSession(Rapier,SCENE);
 const e=createGlobalResponseResearchEngine(Rapier,SCENE,1);
 const mover=createPlayerMovement({experimentalAiKickApproach:true});
 try{
  for(let tick=1;tick<=155;tick++){
   const step=session.step();
   const input=mover.step(e.snapshot().ball.position);
   const raw=e.step(input),contact=e.footContactSnapshot();
   assert.equal(canonicalSnapshot(step.ballSnapshot),canonicalSnapshot(raw));
   assert.deepEqual(step.footContact,contact);
   assert.equal(step.physicsTick,raw.tick);
  }
 }finally{session.dispose();e.dispose();}
 const normal=createEngine(Rapier,SCENE);
 try{
  assert.equal(normal.footContactSnapshot,undefined,
   'ordinary gameplay physics must NOT be toggled by B2');
  assert.equal(normal.snapshot().tick,0);
 }finally{normal.dispose();}
});

test('ME-PB-50 empty/rapidly unqualified real ball never fabricates reception',()=>{
 const frames=sessionTrace(DISTANT,{ticks:70});
 assert.ok(frames.every(x=>x.phase==='free'&&
  x.owner===null&&x.candidate===null&&
  x.started.length===0&&x.ended.length===0&&
  x.active.length===0&&x.acquisitions===0));
 const a=sessionTrace(SCENE,{ticks:130});
 assert.ok(a.filter(x=>x.tick>=127&&x.tick<=130).every(x=>
  x.owner===null),'a four-tick Home shoe contact is not six-tick control');
});

test('ME-PB-50 reset and dispose enforce immutable read-only snapshots and exact deterministic recreation',()=>{
 const s=createLocalBallReceptionSession(Rapier,SCENE);
 const copy=Object.freeze({...SCENE});
 try{
  const first=s.snapshot();
  assert.equal(first.physicsTick,0);
  assert.equal(first.footContact,null);
  assert.ok(Object.isFrozen(first)&&Object.isFrozen(first.ownerState));
  assert.ok(Object.isFrozen(s));
  const trace=[];
  for(let i=0;i<155;i++){
   const frame=s.step();
   trace.push([canonicalSnapshot(frame.ballSnapshot),frame.phase,
    frame.ownerPlayerId,[...frame.footContact.started],
    [...frame.footContact.ended]]);
  }
  const frozen=s.snapshot();
  assert.equal(frozen.physicsTick,155);
  assert.equal(frozen.officialMatchPossession,false);
  const next=s.reset();
  try{
   assert.throws(()=>s.step(),/Reception session disposed/);
   assert.throws(()=>s.snapshot(),/Reception session disposed/);
   assert.throws(()=>s.reset(),/Reception session disposed/);
   assert.equal(next.snapshot().physicsTick,0);
   const replay=[];
   for(let i=0;i<155;i++){
    const frame=next.step();
    replay.push([canonicalSnapshot(frame.ballSnapshot),frame.phase,
     frame.ownerPlayerId,[...frame.footContact.started],
     [...frame.footContact.ended]]);
   }
   assert.deepEqual(replay,trace);
   assert.equal(frozen.physicsTick,155,
    'old immutable snapshot must not mutate during reset');
  }finally{next.dispose();}
 }finally{s.dispose();}
 assert.deepEqual(SCENE,copy);
});

test('ME-PB-50 closes external injection surface; only universal response value is adjustable',()=>{
 for(const invalid of [
  {globalResponse:1,diagnosticFootRestitution:0.22},
  {globalResponse:1,playerFrame:{}},
  {globalResponse:1,contactFrame:{}},
  {globalResponse:1,ownerPlayerId:'away-10'},
  {globalResponse:1,pitchFriction:0.5},
  {globalResponse:1,omittedShoeId:'away-10'},
  {globalResponse:0.5},
  {globalResponse:NaN},
  [],
  false,
  'test'
 ]){
  assert.throws(()=>createLocalBallReceptionSession(
   Rapier,SCENE,invalid),/Only a single common ball response|One bounded global ball response/);
 }
 assert.throws(()=>createLocalBallReceptionSession(
  Rapier,{preset:'launch',z:1,vz:3}),/Shared response research requires grounded roll/);
 const s=createLocalBallReceptionSession(Rapier,SCENE);
 try{
  const start=s.snapshot();
  for(const forged of [
   {started:['away-10'],tick:1,active:['away-10']},
   {ownerPlayerId:'away-10'},null,1,'step'
  ]){
   assert.throws(()=>s.step(forged),
    /Only a single common ball response/);
   assert.equal(s.snapshot(),start,
    'rejected external injection must not advance genuine Rapier tick');
  }
  assert.throws(()=>s.snapshot({ownerPlayerId:'away-10'}),
   /Only a single common ball response/);
  assert.throws(()=>s.reset({globalResponse:1.25}),
   /Only a single common ball response/);
  assert.equal(s.snapshot().physicsTick,0);
  assert.equal(s.step().physicsTick,1);
 }finally{s.dispose();}
});

test('ME-PB-50 one global scalar also works under bounded real physical perturbations, never confers authority by option',()=>{
 for(const v of [0.85,1,1.15]){
  const s=createLocalBallReceptionSession(Rapier,SCENE,{globalResponse:v});
  let seenActualStart=false;
  try{
   for(let tick=1;tick<=145;tick++){
    const frame=s.step();
    assert.equal(frame.globalResponse,v);
    assert.equal(frame.sameForAllShoes,true);
    assert.equal(frame.sameForAllPitches,true);
    assert.equal(frame.officialMatchPossession,false);
    if(frame.footContact.started.length)seenActualStart=true;
    if(frame.ownerPlayerId!==null)
     assert.ok(frame.ownerState.candidateStreakTicks>=6);
   }
   assert.equal(seenActualStart,true);
  }finally{s.dispose();}
 }
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const core=readFileSync(new URL('../src/core.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(html,/ME-PB-50|local-ball-reception-session/);
 assert.doesNotMatch(core,/createLocalBallReceptionSession/);
});
