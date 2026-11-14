// ME-PB-49 / B1: an authoritative LOCAL owner from real Rapier shoe
// START/ACTIVE/END and consecutive canonical 22-player co-motion.
// No football match ownership, passing, kicking, simulation or UI changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RapierModule from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier,canonicalSnapshot}
 from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,PLAYER_DT}
 from '../src/player-movement.mjs';
import {
 initialBallOwnershipState,advanceBallOwnership,
 BALL_OWNERSHIP_VERSION,BALL_OWNERSHIP_CONTROL_TICKS
} from '../src/player-ball-ownership.mjs';
import {readFileSync} from 'node:fs';

const Rapier=await initializeRapier(RapierModule);
const SCENE=Object.freeze({
 preset:'roll',seed:'me-pb-49-real-one-owner',
 x:4.96,y:0,z:0,vx:-0.3,vy:0,vz:0
});
function run({scenario=SCENE,ticks=155,withOwner=true,withFeet=true}={}){
 const e=createEngine(Rapier,scenario,
  withFeet?{diagnosticPlayerFootContactsEnabled:true}:{});
 const mover=createPlayerMovement({experimentalAiKickApproach:true});
 let state=initialBallOwnershipState(),tick1=null;
 const events=[],ownership=[],ballTrace=[],feetTrace=[];
 try {
  for(let tick=1;tick<=ticks;tick++){
   const input=mover.step(e.snapshot().ball.position);
   assert.equal(input.tick,tick);
   assert.equal(input.timeS,tick*PLAYER_DT);
   assert.equal(input.players.length,INITIAL_PLAYERS.length);
   const after=withFeet?e.step(input):e.step();
   const shoe=withFeet?e.footContactSnapshot():null;
   if(tick===1&&shoe)
    tick1=Object.freeze({previous:state,contactFrame:shoe,
     playerFrame:input,ballSnapshot:after});
   if(withOwner&&shoe)
    state=advanceBallOwnership({previous:state,contactFrame:shoe,
     playerFrame:input,ballSnapshot:after});
   ballTrace.push(canonicalSnapshot(after));
   if(shoe){
    events.push(Object.freeze({
     tick,started:Object.freeze([...shoe.started]),
     ended:Object.freeze([...shoe.ended]),
     active:Object.freeze([...shoe.active])
    }));
    feetTrace.push(JSON.stringify(events.at(-1)));
   }
   if(withOwner&&shoe)
    ownership.push(Object.freeze({
     tick,phase:state.phase,owner:state.ownerPlayerId,
     candidate:state.candidatePlayerId,streak:state.candidateStreakTicks,
     source:state.contactProvenanceStartTick,
     transition:state.lastTransition,
     acquisitions:state.controlAcquisitions
    }));
  }
  return Object.freeze({
   finalState:state,tick1,events:Object.freeze(events),
   ownership:Object.freeze(ownership),ballTrace:Object.freeze(ballTrace),
   feetTrace:Object.freeze(feetTrace)
  });
 }finally{e.dispose();}
}
const at=(run,tick)=>run.ownership.find(x=>x.tick===tick);

test('ME-PB-49 real 60Hz Away #10 contact obtains at most one local owner after sustained real motion then releases on actual END',()=>{
 const a=run(),b=run();
 assert.deepEqual(a,b,'real Rapier and the new pure local model replay exactly');
 assert.equal(BALL_OWNERSHIP_VERSION,'me-pb-49-exclusive-real-contact-state-v1');
 assert.equal(BALL_OWNERSHIP_CONTROL_TICKS,6);
 const firstStart=a.events.find(x=>x.started.includes('away-10'));
 const firstEnd=a.events.find(x=>x.ended.includes('away-10'));
 const secondStart=a.events.find(x=>x.started.includes('home-10'));
 assert.equal(firstStart?.tick,1);
 assert.equal(firstEnd?.tick,19);
 assert.equal(secondStart?.tick,127);
 const acquired=a.ownership.filter(x=>x.owner==='away-10');
 assert.ok(acquired.length>=1,'real authenticated co-motion must establish local owner');
 assert.ok(acquired[0].tick<firstEnd.tick);
 assert.ok(acquired[0].streak>=BALL_OWNERSHIP_CONTROL_TICKS);
 assert.equal(acquired[0].phase,'controlled');
 assert.equal(acquired[0].source,1);
 assert.equal(acquired[0].transition,'physically-acquired');
 // Every owner, including a LATER new player after a real recontact,
 // must be tied to a genuine Rapier START and >=6 measured valid frames.
 assert.ok(a.ownership.filter(x=>x.owner!==null).every(x=>
  x.phase==='controlled'&&
  x.streak>=BALL_OWNERSHIP_CONTROL_TICKS&&
  Number.isSafeInteger(x.source)&&
  x.tick>=x.source+BALL_OWNERSHIP_CONTROL_TICKS-1&&
  a.events.some(e=>e.tick===x.source&&e.started.includes(x.owner))),
  'physical provenance and a six-tick stable streak must precede ownership');
 assert.ok(a.ownership.filter(x=>x.tick<141).every(x=>
  x.owner===null||x.owner==='away-10'),
  'short physical Home #10 tick127-130 contact is NOT a reception');
 const laterHome=a.ownership.find(x=>x.owner==='home-10');
 if(laterHome){
  assert.ok(laterHome.source>=141&&
   laterHome.tick>=laterHome.source+BALL_OWNERSHIP_CONTROL_TICKS-1,
   'a new physical contact, not the brief tick127 graze, can later earn control');
 }
 assert.equal(at(a,19)?.owner,null,'real shoe END immediately clears ownership');
 assert.equal(at(a,19)?.phase,'free');
 assert.ok(['control-released-or-shoe-ended','uncontrolled-free-ball']
  .includes(at(a,19)?.transition),
  'loss may occur BEFORE actual shoe END when physical co-motion ends');
 assert.ok(acquired.at(-1).tick<19,
  'the owner must be gone before or at the real shoe END');
 assert.ok(a.ownership.filter(x=>x.tick>=19&&x.tick<127)
  .every(x=>x.owner===null),
  'no owner in the genuine physical clearance interval');
 assert.equal(at(a,127)?.phase,'contested',
  'fresh second shoe START without sustained co-motion is NOT a reception');
 assert.equal(at(a,127)?.owner,null);
 assert.equal(a.finalState.officialMatchPossession,false);
 assert.equal(a.finalState.ballForceApplied,false);
 assert.equal(a.finalState.passCreated,false);
 assert.ok(Object.isFrozen(a.finalState)&&
  Object.isFrozen(a.finalState.lastPlayerPositions)&&
  Object.isFrozen(a.finalState.activeShoeIds));
 const withoutObserver=run({withOwner:false});
 assert.deepEqual(a.ballTrace,withoutObserver.ballTrace,
  'observer must never alter the real ball physics');
 assert.deepEqual(a.feetTrace,withoutObserver.feetTrace,
  'observer must never alter physical shoe START/END/ACTIVE');
 process.stdout.write('ME_PB_49_REAL_ONE_OWNER '+
  JSON.stringify({firstShoeStart:1,firstShoeEnd:19,
   firstControlledTick:acquired[0].tick,
   controlledFrames:acquired.length,
   realSecondContactStart:127,
   laterHomeControlledTick:laterHome?.tick??null,
   ownerAtEnd:at(a,19).owner,
   atSecondStart:at(a,127).phase,
   canonicalReplay:true,physicsUnchanged:true,
   officialMatchPossession:false})+'\n');
});

test('ME-PB-49 genuine distant ball has no player owner, and default world without physical shoes cannot claim',()=>{
 const c=run({scenario:{preset:'roll',seed:'me-pb-49-distant',
  x:30,y:20,z:0,vx:0,vy:0,vz:0},ticks:70});
 assert.ok(c.events.every(f=>
  f.started.length===0&&f.ended.length===0&&f.active.length===0));
 assert.ok(c.ownership.every(o=>
  o.phase==='free'&&o.owner===null&&o.candidate===null));
 assert.equal(c.finalState.controlAcquisitions,0);
 const noShoe=run({withFeet:false,ticks:65});
 assert.deepEqual(noShoe.events,[]);
 assert.deepEqual(noShoe.ownership,[]);
 assert.equal(noShoe.finalState.phase,'free');
 assert.equal(noShoe.finalState.ownerPlayerId,null);
});

test('ME-PB-49 rejects forged/missing Rapier events, gaps, bad ids, illegal player motion and mismatched time',()=>{
 const sample=run({ticks:1}).tick1;
 const apply=x=>advanceBallOwnership(x);
 assert.ok(sample);
 assert.equal(apply(sample).phase,'contested',
  'a new shoe START is not immediate ownership');
 const invalid=[
  {...sample,contactFrame:null},
  {...sample,ballSnapshot:null},
  {...sample,contactFrame:{...sample.contactFrame,started:[]}},
  {...sample,contactFrame:{...sample.contactFrame,started:['fake-id']}},
  {...sample,contactFrame:{...sample.contactFrame,active:['away-10','away-10']}},
  {...sample,contactFrame:{...sample.contactFrame,tick:2}},
  {...sample,contactFrame:{...sample.contactFrame,
   active:['home-10']}},
  {...sample,playerFrame:{...sample.playerFrame,tick:2}},
  {...sample,playerFrame:{...sample.playerFrame,players:[]}},
  {...sample,playerFrame:{...sample.playerFrame,players:[
   {...sample.playerFrame.players[0],x:80},
   ...sample.playerFrame.players.slice(1)
  ]}},
  {...sample,ballSnapshot:{...sample.ballSnapshot,
   ball:{...sample.ballSnapshot.ball,velocity:{x:Infinity,y:0,z:0}}}},
  {...sample,ballSnapshot:{...sample.ballSnapshot,tick:2}},
  {...sample,previous:{...sample.previous,ownerPlayerId:'fake-id'}},
  {...sample,previous:{...sample.previous,
   phase:'controlled',ownerPlayerId:null}},
  {...sample,previous:{...sample.previous,
   physicsTick:5}},
  {...sample,previous:{...sample.previous,
   officialMatchPossession:true}},
  {...sample,previous:{...sample.previous,activeShoeIds:['away-10']}}
 ];
 for(const changed of invalid)
  assert.throws(()=>apply(changed),
   /Consecutive canonical 60Hz real Rapier/,
   'invalid physical input cannot change ownership');
 const untouched=apply(sample);
 assert.equal(sample.previous.physicsTick,0);
 assert.equal(untouched.physicsTick,1);
 assert.equal(sample.previous.phase,'free');
 assert.equal(sample.contactFrame.started[0],'away-10');
 assert.ok(Object.isFrozen(sample.previous));
});

test('ME-PB-49 two simultaneous physical shoe starts are disputed, never two owners or a fabricated exclusive winner',()=>{
 const sample=run({ticks:1}).tick1;
 // Unit-only, explicitly synthetic negative frame: NOT physical proof
 // of an actual two-shoe contact, checks conservative arbitration.
 const unitContact={...sample.contactFrame,
  started:['home-10','away-10'],active:['home-10','away-10']};
 const unit=advanceBallOwnership({...sample,contactFrame:unitContact});
 assert.equal(unit.phase,'contested');
 assert.equal(unit.ownerPlayerId,null);
 assert.equal(unit.candidatePlayerId,null);
 assert.equal(unit.contactProvenancePlayerId,null);
 assert.equal(unit.controlAcquisitions,0);
 assert.equal(unit.officialMatchPossession,false);
 assert.ok(Object.isFrozen(unit.activeShoeIds));
});

test('ME-PB-49 does not introduce new LAB UI, calibrated physics or game possession integration',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const core=readFileSync(new URL('../src/core.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(html,/me-pb-49|player-ball-ownership/);
 assert.doesNotMatch(core,/advanceBallOwnership|initialBallOwnershipState/);
});
