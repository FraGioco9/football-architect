// ME-PB-51 / B3: physical shoe-carried ball travel and natural release.
// No kick, ball teleport, ball-to-shoe constraint, or match possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RapierModule from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,canonicalSnapshot,createEngine}
 from '../src/core.mjs';
import {createLocalBallCarryReleaseSession,
 LOCAL_BALL_CARRY_RELEASE_VERSION}
 from '../src/player-ball-carry-release.mjs';
import {createLocalBallReceptionSession}
 from '../src/player-ball-local-reception.mjs';
import {readFileSync} from 'node:fs';

const Rapier=await initializeRapier(RapierModule);
const SCENE=Object.freeze({
 preset:'roll',seed:'me-pb-51-natural-release',
 x:4.96,y:0,z:0,vx:-0.3,vy:0,vz:0
});
const DISTANT=Object.freeze({
 preset:'roll',seed:'me-pb-51-far-from-shoes',
 x:30,y:20,z:0,vx:0,vy:0,vz:0
});
function run(scene=SCENE,{ticks=155,response=1}={}){
 const s=createLocalBallCarryReleaseSession(Rapier,scene,{
  globalResponse:response
 });
 const trace=[],samples={};
 try{
  assert.equal(s.snapshot().physicsTick,0);
  assert.equal(s.snapshot().ownerPlayerId,null);
  assert.equal(s.snapshot().episodeCount,0);
  for(let t=1;t<=ticks;t++){
   const f=s.step();
   assert.equal(f.physicsTick,t);
   assert.equal(f.footContact.tick,t);
   assert.equal(f.officialMatchPossession,false);
   assert.equal(f.ballForceApplied,false);
   assert.equal(f.ballAttachmentApplied,false);
   assert.equal(f.ballTeleportApplied,false);
   assert.equal(f.globalResponse,response);
   if(f.ownerPlayerId!==null){
    assert.equal(f.phase,'controlled');
    assert.ok(f.footContact.active.includes(f.ownerPlayerId));
    assert.ok(f.ownerState.candidateStreakTicks>=6);
   }
   assert.ok(Object.isFrozen(f)&&Object.isFrozen(f.episodes));
   assert.ok(f.episodes.every(e=>Object.isFrozen(e)&&
    Object.isFrozen(e.lastControlledBallPosition)));
   trace.push(Object.freeze({
    t,
    ball:canonicalSnapshot(f.ballSnapshot),
    owner:f.ownerPlayerId,
    phase:f.phase,
    start:[...f.footContact.started],
    end:[...f.footContact.ended],
    active:[...f.footContact.active],
    episodes:f.episodes
   }));
   if([1,7,8,14,18,19,20,26,126,127,130,141,145,146,155]
    .includes(t))samples[t]=f;
  }
  return Object.freeze({trace:Object.freeze(trace),
   samples:Object.freeze(samples),
   last:s.snapshot()});
 }finally{s.dispose();}
}

test('ME-PB-51 real 22-player physical escort measured before spontaneous loss and actual shoe END',()=>{
 const a=run(),replay=run();
 assert.deepEqual(a.trace,replay.trace,
  'actual ball, feet, owner, carry evidence replay from independent Rapier');
 assert.equal(a.last.version,LOCAL_BALL_CARRY_RELEASE_VERSION);
 const first=a.last.episodes[0];
 assert.ok(first);
 assert.equal(first.playerId,'away-10');
 assert.equal(first.physicalStartPhysicsTick,1);
 assert.equal(first.acquiredPhysicsTick,7);
 assert.ok(first.controlFrames>=2);
 assert.ok(first.controlledBallTravelM>0,
  'genuine ball travels while physically accompanied');
 assert.ok(first.controlledPlayerTravelM>0,
  'real player also moves during the same controlled contact episode');
 assert.equal(first.physicalAccompanimentObserved,true);
 assert.ok(first.controlLossPhysicsTick>first.acquiredPhysicsTick&&
  first.controlLossPhysicsTick<=19);
 assert.ok(['control-lost-unstable-or-contested',
  'control-released-or-shoe-ended'].includes(first.controlLossReason));
 assert.equal(first.shoeEndPhysicsTick,19,
  'physical shoe END need not equal earlier ownership loss');
 assert.ok(Object.isFrozen(first.shoeEndBallPosition));
 assert.equal(a.samples[7].ownerPlayerId,'away-10');
 assert.equal(a.samples[19].ownerPlayerId,null);
 assert.equal(a.last.physicalAccompanimentObserved,true);
 assert.equal(a.last.officialMatchPossession,false);
 assert.equal(a.last.ballForceApplied,false);
 process.stdout.write('ME_PB_51_REAL_PHYSICAL_ESCORT_RELEASE '+
  JSON.stringify({
   firstPhysicalStart:first.physicalStartPhysicsTick,
   localAcquired:first.acquiredPhysicsTick,
   controlFrames:first.controlFrames,
   controlledBallTravelM:first.controlledBallTravelM,
   controlledPlayerTravelM:first.controlledPlayerTravelM,
   controlLostTick:first.controlLossPhysicsTick,
   realShoeEnd:first.shoeEndPhysicsTick,
   cleanPostEndTicks:first.cleanPostEndTicks,
   postEndBallTravelM:first.freeBallTravelM,
   censoredByNewRealContactAt:first.censoredByNewContactPhysicsTick,
   distinctNewPlayerAcquired:a.last.episodes.at(-1)?.playerId,
   baselineReplay:true,officialMatchPossession:false,
   appliedExtraImpulse:false,ballAttached:false
  })+'\n');
});

test('ME-PB-51 release is the same free rolling physical ball, clean after END and censored at new shoe START',()=>{
 const {samples,trace,last}=run();
 const e=last.episodes[0];
 assert.equal(e.shoeEndPhysicsTick,19);
 assert.ok(trace.slice(19,126).every(f=>
  f.owner===null&&f.start.length===0&&
  f.end.length===0&&f.active.length===0));
 assert.equal(e.cleanPostEndTicks,107,
  'first END at19: precisely ticks20 through126 are fully no-contact');
 assert.equal(e.censoredByNewContactPhysicsTick,127,
  'real physical Home START, never a synthetic release, stops clean trail');
 assert.ok(e.freeBallTravelM>0.1);
 assert.equal(samples[19].footContact.ended.includes('away-10'),true);
 assert.equal(samples[127].footContact.started.includes('home-10'),true);
 assert.equal(samples[127].ownerPlayerId,null);
 assert.equal(samples[130].footContact.ended.includes('home-10'),true);
 assert.equal(samples[130].ownerPlayerId,null);
 assert.equal(samples[141].footContact.started.includes('home-10'),true);
 assert.equal(samples[145].ownerPlayerId,null);
 assert.equal(samples[146].ownerPlayerId,'home-10');
 assert.equal(last.episodes.at(-1).playerId,'home-10');
 assert.equal(last.episodes.at(-1).acquiredPhysicsTick,146);
 assert.ok(last.episodes.every(f=>f.controlFrames>=1&&
  f.controlledBallTravelM>=0&&f.controlledPlayerTravelM>=0));
});

test('ME-PB-51 independent trusted B2 and B3 have identical real ball/shoe/owner timelines',()=>{
 const b3=createLocalBallCarryReleaseSession(Rapier,SCENE);
 const b2=createLocalBallReceptionSession(Rapier,SCENE);
 try{
  for(let i=0;i<155;i++){
   const measured=b3.step(),raw=b2.step();
   assert.equal(canonicalSnapshot(measured.ballSnapshot),
    canonicalSnapshot(raw.ballSnapshot));
   assert.deepEqual(measured.footContact,raw.footContact);
   assert.equal(measured.ownerPlayerId,raw.ownerPlayerId);
   assert.equal(measured.phase,raw.phase);
   assert.deepEqual(measured.ownerState,raw.ownerState);
  }
 }finally{b3.dispose();b2.dispose();}
 const ordinary=createEngine(Rapier,SCENE);
 try{
  assert.equal(ordinary.footContactSnapshot,undefined,
   'default gameplay physics is still unchanged');
 }finally{ordinary.dispose();}
});

test('ME-PB-51 distant physically untouched ball cannot be escorted, released or given an owner',()=>{
 const a=run(DISTANT,{ticks:70});
 assert.equal(a.last.episodeCount,0);
 assert.deepEqual(a.last.episodes,[]);
 assert.equal(a.last.latestEpisode,null);
 assert.equal(a.last.physicalAccompanimentObserved,false);
 assert.ok(a.trace.every(f=>f.owner===null&&f.phase==='free'&&
  f.start.length===0&&f.end.length===0&&f.active.length===0));
});

test('ME-PB-51 frozen snapshots, deterministic reset, dispose and no injected actions',()=>{
 const s=createLocalBallCarryReleaseSession(Rapier,SCENE);
 try{
  const init=s.snapshot();
  assert.equal(init.physicsTick,0);
  assert.equal(init.episodeCount,0);
  assert.ok(Object.isFrozen(init));
  const trace=[];
  for(let i=0;i<155;i++){
   const frame=s.step();
   trace.push([canonicalSnapshot(frame.ballSnapshot),
    frame.ownerPlayerId,frame.episodes]);
  }
  const after=s.snapshot();
  assert.ok(Object.isFrozen(after));
  const next=s.reset();
  try{
   assert.equal(init.physicsTick,0);
   assert.equal(after.physicsTick,155);
   assert.throws(()=>s.step(),/Carry\/release session disposed/);
   assert.throws(()=>s.reset(),/Carry\/release session disposed/);
   const replay=[];
   for(let i=0;i<155;i++){
    const frame=next.step();
    replay.push([canonicalSnapshot(frame.ballSnapshot),
     frame.ownerPlayerId,frame.episodes]);
   }
   assert.deepEqual(replay,trace);
  }finally{next.dispose();}
 }finally{s.dispose();}
 const rejecting=createLocalBallCarryReleaseSession(Rapier,SCENE);
 try{
  const before=rejecting.snapshot();
  for(const fake of [
   {kick:true},{ownerPlayerId:'home-10'},
   {started:['home-10']},null,1,'release'
  ]){
   assert.throws(()=>rejecting.step(fake),
    /Carry\/release session does not accept injected physics or owner/);
   assert.equal(rejecting.snapshot(),before);
  }
  assert.throws(()=>rejecting.reset({ballForceApplied:true}),
   /Carry\/release session does not accept injected physics or owner/);
  assert.throws(()=>rejecting.snapshot({phase:'controlled'}),
   /Carry\/release session does not accept injected physics or owner/);
  assert.equal(rejecting.step().physicsTick,1);
 }finally{rejecting.dispose();}
 assert.throws(()=>createLocalBallCarryReleaseSession(Rapier,SCENE,
  {globalResponse:1,footRestitution:0.3}),
 /Only a single common ball response/);
});

test('ME-PB-51 single global scalar remains universal, with no new gameplay UI/forces',()=>{
 for(const factor of [0.85,1,1.15]){
  const a=run(SCENE,{response:factor,ticks:75});
  assert.equal(a.last.globalResponse,factor);
  assert.equal(a.last.sameForAllShoes,true);
  assert.equal(a.last.sameForAllPitches,true);
  assert.ok(a.last.episodes.every(e=>e.playerId==='away-10'));
  assert.equal(a.last.officialMatchPossession,false);
 }
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const core=readFileSync(new URL('../src/core.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(html,/me-pb-51|ball-carry-release/);
 assert.doesNotMatch(core,/createLocalBallCarryReleaseSession/);
});
