// ME-PB-53 / B5.3 — adversarial anti-fake physical ownership matrix.
// Real 22-shoe Rapier observations are expressly separated from synthetic
// unit-only invalid ledgers; no invented two-foot encounter is claimed.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as module from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot,FIXED_DT}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS}
 from '../src/player-movement.mjs';
import {initialBallOwnershipState,advanceBallOwnership,
 BALL_OWNERSHIP_MAX_BALL_HEIGHT_M,BALL_OWNERSHIP_CONTROL_TICKS}
 from '../src/player-ball-ownership.mjs';
import {createLocalBallContestSession}
 from '../src/player-ball-contest.mjs';
import {createLocalBallAmbiguityGuardSession}
 from '../src/player-ball-ambiguity-guard.mjs';
import {readFileSync} from 'node:fs';

const Rapier=await initializeRapier(module);
const ROLL=Object.freeze({preset:'roll',seed:'me-pb-52-distinct-opponent-owner',
 x:4.96,y:0,z:0,vx:-0.3,vy:0,vz:0});
const UNTOUCHED=Object.freeze({preset:'roll',seed:'me-pb-53-untouched-70',
 x:30,y:20,z:0,vx:0,vy:0,vz:0});
const BOUNCE=Object.freeze({preset:'bounce',seed:'me-pb-53-actual-rapier-bounce'});

// A real-time witness records only what came from the trusted private Rapier
// source, not an independently fabricated foot event or player action.
function witness(f){
 return Object.freeze({
  tick:f.physicsTick,ball:canonicalSnapshot(f.ballSnapshot),
  owner:f.ownerPlayerId,phase:f.phase,
  started:Object.freeze([...f.footContact.started]),
  ended:Object.freeze([...f.footContact.ended]),
  active:Object.freeze([...f.footContact.active]),
  streak:f.ownerState.candidateStreakTicks,
  provenance:f.ownerState.contactProvenanceStartTick,
  acquisitions:f.acquisitions,losses:f.losses,later:f.subsequentOwners,
  classification:f.contactClassification,reason:f.noOwnerReason
 });
}
function physicalTrace(scene=ROLL,ticks=155,response=1){
 const session=createLocalBallAmbiguityGuardSession(Rapier,scene,
  {globalResponse:response});
 const frames=[];
 try{
  for(let t=1;t<=ticks;t++)frames.push(witness(session.step()));
  return Object.freeze(frames);
 }finally{session.dispose();}
}

test('B5.3 real Rapier 60Hz: brief START, loss before END, restarted streak, 130-tick gap and later opponent never imply tackle',()=>{
 assert.equal(INITIAL_PLAYERS.length,22);
 assert.equal(BALL_OWNERSHIP_CONTROL_TICKS,6);
 const guard=createLocalBallAmbiguityGuardSession(Rapier,ROLL),
  raw=createLocalBallContestSession(Rapier,ROLL);
 let unqualified=0,realMultiple=0;
 const frames=[];
 try{
  for(let tick=1;tick<=155;tick++){
   const g=guard.step(),b=raw.step();
   assert.equal(g.physicsTick,tick);
   assert.ok(Math.abs(g.ballSnapshot.time-tick*FIXED_DT)<1e-8);
   assert.equal(canonicalSnapshot(g.ballSnapshot),
    canonicalSnapshot(b.ballSnapshot),
    'B5.3 guard must be read-only over an independent true B4 Rapier world');
   assert.deepEqual(g.footContact,b.footContact);
   assert.deepEqual(g.ownerState,b.ownerState);
   assert.deepEqual(g.losses,b.losses);
   assert.deepEqual(g.acquisitions,b.acquisitions);
   assert.equal(g.officialMatchPossession,false);
   assert.equal(g.interceptionProven,false);
   assert.equal(g.tackleProven,false);
   assert.equal(g.passCreated,false);
   assert.equal(g.ballForceApplied,false);
   assert.equal(g.ballTeleportApplied,false);
   assert.equal(g.ballAttachmentApplied,false);
   assert.ok(Object.isFrozen(g)&&Object.isFrozen(g.ownerState));
   assert.ok(Object.isFrozen(g.physicalStarts)&&
    g.physicalStarts.every(Object.isFrozen));
   if(g.phase==='controlled'){
    assert.equal(g.footContact.active.length,1);
    assert.equal(g.ownerPlayerId,g.footContact.active[0]);
    assert.ok(g.ownerState.candidateStreakTicks>=6);
    assert.ok(g.physicalStarts.some(e=>e.id===g.ownerPlayerId&&
     e.tick===g.ownerState.contactProvenanceStartTick));
   }else assert.equal(g.ownerPlayerId,null);
   if(g.footContact.active.length>1){
    assert.equal(g.phase,'contested');
    realMultiple++;
   }
   if(g.contactClassification==='unqualified-physical-contact')
    unqualified++;
   frames.push(witness(g));
  }
 }finally{guard.dispose();raw.dispose();}
 const at=t=>frames[t-1];
 assert.ok(at(1).started.includes('away-10'));
 assert.equal(at(1).owner,null,'START is not automatic possession');
 assert.equal(at(6).owner,null,'five prior frames are not six');
 assert.equal(at(7).owner,'away-10');
 assert.equal(at(7).provenance,1);
 assert.ok(at(15).losses.some(e=>e.id==='away-10'&&
  e.reason==='control-lost-unstable-or-contested'&&
  e.shoeEndedThisTick===false));
 assert.equal(at(15).owner,null);
 assert.ok(at(19).ended.includes('away-10'));
 assert.equal(at(19).owner,null);
 assert.ok(frames.slice(19,126).every(f=>f.owner===null&&
  f.active.length===0&&f.started.length===0&&f.ended.length===0));
 assert.ok(at(127).started.includes('home-10'));
 assert.equal(at(127).owner,null);
 assert.equal(at(130).owner,null);
 assert.ok(at(130).ended.includes('home-10'),
  'short real touch does not earn a control state');
 assert.ok(at(141).started.includes('home-10'));
 assert.equal(at(141).provenance,141);
 assert.equal(at(145).owner,null,'recontact restarts a six-frame counter');
 assert.equal(at(146).owner,'home-10');
 const changed=at(146).later;
 assert.equal(changed.length,1);
 assert.equal(changed[0].previousOwnerId,'away-10');
 assert.equal(changed[0].previousLostTick,15);
 assert.equal(changed[0].newPhysicalStartTick,141);
 assert.equal(changed[0].freeOrContestedTicks,130);
 assert.equal(changed[0].classification,
  'later-owner-after-prior-control-loss');
 assert.equal(changed[0].directInterceptionProven,false);
 assert.equal(changed[0].tackleProven,false);
 assert.ok(unqualified>0,'real contact without owner must be recorded');
 process.stdout.write('ME_PB_53_B5_REAL_CONTEST '+
  JSON.stringify({firstRealStart:1,controlAway:7,loss:15,
   physicalEnd:19,shortHomeStart:127,shortHomeEnd:130,
   newRealStart:141,controlHome:146,
   freeOrContestedTicks:changed[0].freeOrContestedTicks,
   unqualifiedRealTicks:unqualified,realMultiContactTicks:realMultiple,
   multiShoePhysicalEvidence:realMultiple>0,
   opponentDirectInterceptionProven:false,officialPossession:false})+'\n');
});

test('B5.3 real 22-player distant no-touch stays free at every 60Hz frame',()=>{
 const frames=physicalTrace(UNTOUCHED,70);
 assert.equal(frames.length,70);
 assert.ok(frames.every(f=>f.owner===null&&f.phase==='free'&&
  f.active.length===0&&f.started.length===0&&f.ended.length===0&&
  f.acquisitions.length===0&&f.losses.length===0&&
  f.classification==='no-active-shoe'));
 assert.deepEqual(physicalTrace(UNTOUCHED,70),frames,
  'independent physical no-touch worlds must replay identically');
});

test('B5.3 real bounce: B1 22-shoe Rapier height guard refuses airborne ownership, never fakes shoe evidence',()=>{
 // B2/B3/B4/B5 private sessions intentionally accept GROUNDED ROLL only.
 // This separate real independent Rapier bounce probes the SAME B1 owner
 // arbitration, not a forged bounce frame smuggled into the B5 guard.
 assert.throws(()=>createLocalBallAmbiguityGuardSession(Rapier,BOUNCE),
  /requires grounded roll/);
 const one=createEngine(Rapier,BOUNCE,
  {diagnosticPlayerFootContactsEnabled:true});
 const two=createEngine(Rapier,BOUNCE,
  {diagnosticPlayerFootContactsEnabled:true});
 const movementA=createPlayerMovement({experimentalAiKickApproach:true});
 const movementB=createPlayerMovement({experimentalAiKickApproach:true});
 let ownerA=initialBallOwnershipState(),ownerB=initialBallOwnershipState();
 let airborne=0,grounded=0,peak=0,realStarts=0;
 try{
  for(let tick=1;tick<=115;tick++){
   const mA=movementA.step(one.snapshot().ball.position);
   const mB=movementB.step(two.snapshot().ball.position);
   const fA=one.step(mA),fB=two.step(mB);
   const cA=one.footContactSnapshot(),cB=two.footContactSnapshot();
   ownerA=advanceBallOwnership({
    previous:ownerA,playerFrame:mA,ballSnapshot:fA,contactFrame:cA
   });
   ownerB=advanceBallOwnership({
    previous:ownerB,playerFrame:mB,ballSnapshot:fB,contactFrame:cB
   });
   assert.equal(canonicalSnapshot(fA),canonicalSnapshot(fB));
   assert.deepEqual(cA,cB);
   assert.deepEqual(ownerA,ownerB);
   assert.equal(ownerA.officialMatchPossession,false);
   assert.equal(ownerA.ballForceApplied,false);
   realStarts+=cA.started.length;
   const z=fA.ball.position.z;
   peak=Math.max(peak,z);
   if(z>BALL_OWNERSHIP_MAX_BALL_HEIGHT_M){
    airborne++;
    assert.equal(ownerA.ownerPlayerId,null,
     'real elevated Rapier ball cannot have a ground shoe owner');
   }else grounded++;
  }
 }finally{one.dispose();two.dispose();}
 assert.ok(airborne>10&&grounded>0&&peak>0.5);
 process.stdout.write('ME_PB_53_B5_REAL_BOUNCE '+
  JSON.stringify({airborneFrames:airborne,nearGroundFrames:grounded,
   highestBallCenterM:peak,realShoeStarts:realStarts,
   airborneOwnerCount:0,physicalReplayIdentical:true,
   source:'independent-real-Rapier-B1-not-B5-roll-session'})+'\n');
});

test('B5.3 synthetic-only negative same-tick transient and dual shoe contacts never generate an owner',()=>{
 const engine=createEngine(Rapier,ROLL,
  {diagnosticPlayerFootContactsEnabled:true});
 const mover=createPlayerMovement({experimentalAiKickApproach:true});
 let sample;
 try{
  const playerFrame=mover.step(engine.snapshot().ball.position);
  const ballSnapshot=engine.step(playerFrame);
  const contactFrame=engine.footContactSnapshot();
  assert.ok(contactFrame.started.includes('away-10'),
   'the baseline input is a genuine Rapier tick-1 shoe START');
  sample={previous:initialBallOwnershipState(),playerFrame,ballSnapshot,
   contactFrame};
  const transient=advanceBallOwnership({...sample,contactFrame:{
   ...contactFrame,started:['away-10'],ended:['away-10'],active:[]
  }});
  assert.equal(transient.phase,'free');
  assert.equal(transient.ownerPlayerId,null);
  assert.equal(transient.candidateStreakTicks,0);
  assert.equal(transient.controlAcquisitions,0);
  const dual=advanceBallOwnership({...sample,contactFrame:{
   ...contactFrame,started:['home-10','away-10'],
   ended:[],active:['home-10','away-10']
  }});
  assert.equal(dual.phase,'contested');
  assert.equal(dual.ownerPlayerId,null);
  assert.equal(dual.candidatePlayerId,null);
  assert.equal(dual.controlAcquisitions,0);
  // These two altered ledgers are SYNTHETIC NEGATIVE UNIT TESTS.
  // They do NOT demonstrate observed simultaneous Rapier shoe contacts.
  const bad=[
   {...sample,contactFrame:{...contactFrame,started:[]}},
   {...sample,contactFrame:{...contactFrame,started:['ghost-2']}},
   {...sample,contactFrame:{...contactFrame,
    started:['away-10','away-10']}},
   {...sample,contactFrame:{...contactFrame,tick:2}},
   {...sample,contactFrame:{...contactFrame,version:'fake'}},
   {...sample,playerFrame:{...playerFrame,tick:2}},
   {...sample,playerFrame:{...playerFrame,timeS:3}},
   {...sample,playerFrame:{...playerFrame,players:[
    {...playerFrame.players[0],x:Infinity},
    ...playerFrame.players.slice(1)
   ]}},
   {...sample,ballSnapshot:{...ballSnapshot,
    ball:{...ballSnapshot.ball,
     velocity:{...ballSnapshot.ball.velocity,x:NaN}}}},
   {...sample,ballSnapshot:{...ballSnapshot,tick:2}},
   {...sample,previous:{...sample.previous,
    phase:'controlled',ownerPlayerId:'home-10'}},
   {...sample,previous:{...sample.previous,
    physicsTick:5}},
   {...sample,previous:{...sample.previous,
    officialMatchPossession:true}}
  ];
  for(const invalid of bad)
   assert.throws(()=>advanceBallOwnership(invalid),
    /Consecutive canonical 60Hz real Rapier/,
    'fake ID, clock, velocity, ownership and mismatched shoe event rejected');
  assert.equal(sample.previous.ownerPlayerId,null);
  assert.equal(sample.previous.physicsTick,0);
  assert.equal(sample.contactFrame.started.includes('away-10'),true);
 }finally{engine.dispose();}
});

test('B5.3 real Rapier replay/reset preserves immutable full contest trace and no injected actions',()=>{
 const s=createLocalBallAmbiguityGuardSession(Rapier,ROLL);
 try{
  const original=s.snapshot();
  const trace=[];
  for(let t=1;t<=155;t++)trace.push(witness(s.step()));
  const completed=s.snapshot();
  assert.equal(completed.ownerPlayerId,'home-10');
  assert.ok(Object.isFrozen(completed)&&Object.isFrozen(completed.losses));
  const copy=s.reset();
  try{
   assert.throws(()=>s.step(),/Ambiguity guard disposed/);
   assert.throws(()=>s.reset(),/Ambiguity guard disposed/);
   assert.equal(original.physicsTick,0);
   assert.equal(completed.physicsTick,155);
   const replay=[];
   for(let t=1;t<=155;t++)replay.push(witness(copy.step()));
   assert.deepEqual(replay,trace,
    'actual Rapier ball/foot/candidate/loss/owner replay is deterministic');
  }finally{copy.dispose();}
 }finally{s.dispose();}
 const guard=createLocalBallAmbiguityGuardSession(Rapier,ROLL);
 try{
  for(const fake of [null,0,'away-10',[],{},{
   ownerPlayerId:'home-10',footContact:{started:['home-10']}
  },{physicsTick:2,ballForceApplied:true}]){
   assert.throws(()=>guard.step(fake),/cannot accept injected owner/);
   assert.equal(guard.snapshot().physicsTick,0);
  }
  assert.throws(()=>guard.snapshot({ownerPlayerId:'away-10'}),
   /cannot accept injected owner/);
  assert.throws(()=>guard.reset({fakeContact:true}),
   /cannot accept injected owner/);
  assert.equal(guard.step().physicsTick,1);
 }finally{guard.dispose();}
 assert.throws(()=>createLocalBallAmbiguityGuardSession(Rapier,ROLL,
  {globalResponse:1,footFriction:0.5}),
 /Only a single common ball response/);
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const core=readFileSync(new URL('../src/core.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(html,/ME-PB-53|player-ball-ambiguity/);
 assert.doesNotMatch(core,/createLocalBallAmbiguityGuardSession/);
});

test('B5.3 real global response sensitivity uses one universal parameter and still rejects unqualified ownership',()=>{
 for(const value of [0.85,1,1.15]){
  const a=createLocalBallAmbiguityGuardSession(Rapier,ROLL,{
   globalResponse:value});
  const b=createLocalBallContestSession(Rapier,ROLL,{
   globalResponse:value});
  try{
   for(let tick=1;tick<=70;tick++){
    const g=a.step(),c=b.step();
    assert.equal(g.globalResponse,value);
    assert.equal(g.sameForAllShoes,true);
    assert.equal(g.sameForAllPlayers,true);
    assert.equal(g.sameForAllPitches,true);
    assert.equal(canonicalSnapshot(g.ballSnapshot),
     canonicalSnapshot(c.ballSnapshot));
    assert.deepEqual(g.footContact,c.footContact);
    assert.equal(g.ownerPlayerId,c.ownerPlayerId);
    if(g.footContact.active.length!==1||
       g.ownerState.candidateStreakTicks<6)
      assert.equal(g.ownerPlayerId,null);
   }
  }finally{a.dispose();b.dispose();}
 }
});
