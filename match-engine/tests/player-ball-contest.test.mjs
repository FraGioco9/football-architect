// ME-PB-52 / B4 — only real Rapier may create control, release,
// an unqualified contested touch, or later opponent acquisition.
// A delayed other-team owner is NOT proven interception or tackle.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as module from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,canonicalSnapshot,createEngine}
 from '../src/core.mjs';
import {createLocalBallContestSession,LOCAL_BALL_CONTEST_VERSION}
 from '../src/player-ball-contest.mjs';
import {createLocalBallCarryReleaseSession}
 from '../src/player-ball-carry-release.mjs';
import {createPlayerMovement} from '../src/player-movement.mjs';
import {initialBallOwnershipState,advanceBallOwnership,
 BALL_OWNERSHIP_MAX_BALL_HEIGHT_M}
 from '../src/player-ball-ownership.mjs';
import {readFileSync} from 'node:fs';

const Rapier=await initializeRapier(module);
const PITCH=Object.freeze({
 preset:'roll',seed:'me-pb-52-distinct-opponent-owner',
 x:4.96,y:0,z:0,vx:-0.3,vy:0,vz:0
});
const FAR=Object.freeze({
 preset:'roll',seed:'me-pb-52-distant-negative',
 x:30,y:20,z:0,vx:0,vy:0,vz:0
});
function run(scene=PITCH,{ticks=155,response=1}={}){
 const s=createLocalBallContestSession(Rapier,scene,{
  globalResponse:response
 });
 const trace=[];
 try{
  const initial=s.snapshot();
  assert.equal(initial.physicsTick,0);
  assert.equal(initial.lastConfirmedOwnerId,null);
  assert.deepEqual(initial.physicalStarts,[]);
  for(let tick=1;tick<=ticks;tick++){
   const f=s.step();
   assert.equal(f.physicsTick,tick);
   assert.equal(f.footContact.tick,tick);
   assert.equal(f.officialMatchPossession,false);
   assert.equal(f.interceptionProven,false);
   assert.equal(f.tackleProven,false);
   assert.equal(f.directPlayerToPlayerHandoffProven,false);
   assert.equal(f.ballForceApplied,false);
   assert.equal(f.ballTeleportApplied,false);
   assert.ok(Object.isFrozen(f)&&Object.isFrozen(f.acquisitions));
   assert.ok(f.acquisitions.every(e=>Object.isFrozen(e)));
   if(f.phase==='controlled'){
    assert.equal(f.footContact.active.length,1);
    assert.equal(f.footContact.active[0],f.ownerPlayerId);
    assert.ok(f.ownerState.candidateStreakTicks>=6);
   }else assert.equal(f.ownerPlayerId,null);
   if(f.footContact.active.length>1){
    assert.equal(f.phase,'contested');
    assert.equal(f.ownerPlayerId,null);
   }
   trace.push(Object.freeze({
    tick,ball:canonicalSnapshot(f.ballSnapshot),
    owner:f.ownerPlayerId,phase:f.phase,
    start:Object.freeze([...f.footContact.started]),
    end:Object.freeze([...f.footContact.ended]),
    active:Object.freeze([...f.footContact.active]),
    losses:f.losses,acquisitions:f.acquisitions,
    later:f.subsequentOwners,
    unqualifiedContactTicks:f.contactOnlyTicks
   }));
  }
  return Object.freeze({trace:Object.freeze(trace),last:s.snapshot()});
 }finally{s.dispose();}
}
const at=(run,t)=>run.trace[t-1];

test('ME-PB-52 real opponent next-owner transition after true loss and new Rapier START; no fabricated interception',()=>{
 const a=run(),b=run();
 assert.deepEqual(a,b,'complete real 22-player Rapier replay including dispute logs');
 assert.equal(a.last.version,LOCAL_BALL_CONTEST_VERSION);
 assert.ok(at(a,1).start.includes('away-10'));
 assert.equal(at(a,1).owner,null);
 assert.equal(at(a,7).owner,'away-10');
 assert.equal(at(a,7).acquisitions.length,1);
 assert.equal(at(a,7).acquisitions[0].physicalStartTick,1);
 assert.equal(at(a,7).acquisitions[0].stableTicks,6);
 assert.equal(at(a,15).owner,null);
 assert.ok(at(a,15).losses.some(e=>e.id==='away-10'&&
  e.reason==='control-lost-unstable-or-contested'&&
  e.shoeEndedThisTick===false));
 assert.ok(at(a,19).end.includes('away-10'));
 assert.equal(at(a,19).owner,null);
 assert.ok(a.trace.slice(19,126).every(x=>x.owner===null&&
  x.start.length===0&&x.end.length===0&&x.active.length===0));
 assert.ok(at(a,127).start.includes('home-10'));
 assert.equal(at(a,127).phase,'contested');
 assert.equal(at(a,127).owner,null);
 assert.ok(at(a,130).end.includes('home-10'));
 assert.equal(at(a,130).owner,null);
 assert.ok(at(a,141).start.includes('home-10'));
 assert.equal(at(a,141).owner,null);
 assert.equal(at(a,145).owner,null);
 assert.equal(at(a,146).owner,'home-10');
 assert.equal(at(a,146).acquisitions.length,2);
 const later=at(a,146).later;
 assert.equal(later.length,1);
 assert.equal(later[0].previousOwnerId,'away-10');
 assert.equal(later[0].previousOwnerTeam,'away');
 assert.equal(later[0].previousLostTick,15);
 assert.equal(later[0].newOwnerId,'home-10');
 assert.equal(later[0].newOwnerTeam,'home');
 assert.equal(later[0].newPhysicalStartTick,141);
 assert.equal(later[0].acquiredTick,146);
 assert.equal(later[0].crossTeam,true);
 assert.equal(later[0].freeOrContestedTicks,130);
 assert.equal(later[0].classification,
  'later-owner-after-prior-control-loss');
 assert.equal(later[0].directInterceptionProven,false);
 assert.equal(later[0].tackleProven,false);
 assert.ok(a.last.contactOnlyTicks>0,
  'a genuine shoe contact without stable control must be contested');
 assert.equal(a.last.subsequentOwners.length,1);
 process.stdout.write('ME_PB_52_REAL_OPPONENT_NEXT_OWNER '+
  JSON.stringify({
   originalControl:7,lostForInstability:15,physicalEnd:19,
   opponentBriefContact:[127,130],ownerAfterBriefContact:null,
   genuineNewStart:141,opponentAcquired:146,
   freeOrContestedTicks:later[0].freeOrContestedTicks,
   classification:later[0].classification,
   realUnqualifiedContactTicks:a.last.contactOnlyTicks,
   physicalReplayIdentical:true,
   exclusiveOwner:true,officialMatchPossession:false,
   directInterceptionProven:false,passCreated:false
  })+'\n');
});

test('ME-PB-52 separate real Rapier B3 world and B4 observe identical ball/foot/owner every tick',()=>{
 const b3=createLocalBallCarryReleaseSession(Rapier,PITCH);
 const b4=createLocalBallContestSession(Rapier,PITCH);
 try{
  for(let t=1;t<=155;t++){
   const a=b3.step(),b=b4.step();
   assert.equal(canonicalSnapshot(a.ballSnapshot),
    canonicalSnapshot(b.ballSnapshot));
   assert.deepEqual(a.footContact,b.footContact);
   assert.equal(a.ownerPlayerId,b.ownerPlayerId);
   assert.deepEqual(a.ownerState,b.ownerState);
  }
 }finally{b3.dispose();b4.dispose();}
});

test('ME-PB-52 real rebound in canonical Rapier 22-shoe world never awards airborne ball ownership',()=>{
 const engine=createEngine(Rapier,
  {preset:'bounce',seed:'me-pb-52-airborne-bounce'},
  {diagnosticPlayerFootContactsEnabled:true});
 const mover=createPlayerMovement({experimentalAiKickApproach:true});
 let owner=initialBallOwnershipState(),raised=0,returned=0,highest=0;
 let previousVz=engine.snapshot().ball.velocity.z;
 try{
  for(let t=1;t<=115;t++){
   const playerFrame=mover.step(engine.snapshot().ball.position);
   const ballSnapshot=engine.step(playerFrame),
    contactFrame=engine.footContactSnapshot();
   owner=advanceBallOwnership({
    previous:owner,contactFrame,playerFrame,ballSnapshot
   });
   const z=ballSnapshot.ball.position.z;
   highest=Math.max(highest,z);
   if(z>BALL_OWNERSHIP_MAX_BALL_HEIGHT_M){
    raised++;
    assert.equal(owner.ownerPlayerId,null,
     'a genuine ball above the foot-control height is never owned');
    assert.notEqual(owner.phase,'controlled');
   }else returned++;
   previousVz=ballSnapshot.ball.velocity.z;
  }
  assert.ok(raised>10,'real ball stayed airborne for multiple 60Hz frames');
  assert.ok(returned>0,'the same real ball reached the pitch');
  assert.ok(highest>0.5);
  assert.ok(Number.isFinite(previousVz));
  process.stdout.write('ME_PB_52_REAL_RAPIER_BOUNCE_NO_AIR_OWNER '+
   JSON.stringify({airborneFrames:raised,nearGroundFrames:returned,
    highestBallCenterM:highest,ownershipWhileAirborne:false})+'\n');
 }finally{engine.dispose();}
});

test('ME-PB-52 real distant no-shoe world cannot produce a contested phase, false owner, loss or subsequent opponent',()=>{
 const a=run(FAR,{ticks:70});
 assert.ok(a.trace.every(x=>x.phase==='free'&&x.owner===null&&
  x.start.length===0&&x.end.length===0&&x.active.length===0));
 assert.deepEqual(a.last.physicalStarts,[]);
 assert.deepEqual(a.last.losses,[]);
 assert.deepEqual(a.last.acquisitions,[]);
 assert.deepEqual(a.last.subsequentOwners,[]);
 assert.equal(a.last.contactOnlyTicks,0);
 assert.equal(a.last.multiContactTicks,0);
});

test('ME-PB-52 synthetic multiple-shoe frame is ONLY a negative arbitration unit test, NOT physical evidence',()=>{
 const engine=createEngine(Rapier,PITCH,
  {diagnosticPlayerFootContactsEnabled:true});
 const mover=createPlayerMovement({experimentalAiKickApproach:true});
 try{
  const playerFrame=mover.step(engine.snapshot().ball.position);
  const ballSnapshot=engine.step(playerFrame);
  const contact=engine.footContactSnapshot();
  assert.ok(contact.started.includes('away-10'));
  // This TWO-shoe ledger is intentionally fabricated ONLY to test
  // fail-closed ownership arbitration; no actual dual physical
  // contact, challenge or interception is claimed.
  const synthetic={...contact,
   started:['home-10','away-10'],
   active:['home-10','away-10']};
  const result=advanceBallOwnership({
   previous:initialBallOwnershipState(),
   playerFrame,ballSnapshot,contactFrame:synthetic
  });
  assert.equal(result.phase,'contested');
  assert.equal(result.ownerPlayerId,null);
  assert.equal(result.candidatePlayerId,null);
  assert.equal(result.officialMatchPossession,false);
  assert.equal(result.controlAcquisitions,0);
 }finally{engine.dispose();}
});

test('ME-PB-52 deterministic reset, frozen evidence, strict no-injection and one global scalar',()=>{
 const s=createLocalBallContestSession(Rapier,PITCH);
 try{
  const old=s.snapshot();
  const saved=[];
  for(let i=0;i<155;i++){
   const f=s.step();
   saved.push([canonicalSnapshot(f.ballSnapshot),f.ownerPlayerId,
    f.losses,f.acquisitions,f.subsequentOwners]);
  }
  assert.equal(s.snapshot().subsequentOwners.length,1);
  assert.ok(Object.isFrozen(s.snapshot().subsequentOwners[0]));
  const replay=s.reset();
  try{
   assert.throws(()=>s.step(),/Contest session disposed/);
   assert.equal(old.physicsTick,0);
   const got=[];
   for(let i=0;i<155;i++){
    const f=replay.step();
    got.push([canonicalSnapshot(f.ballSnapshot),f.ownerPlayerId,
     f.losses,f.acquisitions,f.subsequentOwners]);
   }
   assert.deepEqual(got,saved);
  }finally{replay.dispose();}
 }finally{s.dispose();}
 const noFake=createLocalBallContestSession(Rapier,PITCH);
 try{
  const before=noFake.snapshot();
  for(const fake of [{ownerPlayerId:'home-10'},
   {challenge:true},{started:['home-10']},null,1]){
   assert.throws(()=>noFake.step(fake),
    /A local contest cannot accept injected physical evidence/);
   assert.equal(noFake.snapshot(),before);
  }
  assert.throws(()=>noFake.reset({globalResponse:1.25}),
   /A local contest cannot accept injected physical evidence/);
  assert.throws(()=>noFake.snapshot({ownership:true}),
   /A local contest cannot accept injected physical evidence/);
  assert.equal(noFake.step().physicsTick,1);
 }finally{noFake.dispose();}
 assert.throws(()=>createLocalBallContestSession(Rapier,PITCH,
  {globalResponse:1,playerFootRestitution:0.2}),
 /Only a single common ball response/);
 for(const response of [0.85,1,1.15]){
  const a=run(PITCH,{ticks:70,response});
  assert.equal(a.last.globalResponse,response);
  assert.equal(a.last.sameForAllShoes,true);
  assert.equal(a.last.officialMatchPossession,false);
 }
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const core=readFileSync(new URL('../src/core.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(html,/ME-PB-52|player-ball-contest/);
 assert.doesNotMatch(core,/createLocalBallContestSession/);
});
