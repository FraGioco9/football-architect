// #628 M32 — original opposing midfielder can dynamically pursue the
// ORIGINAL ball, but only after the authenticated real M30 release tap.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {createPlayerMovement,INITIAL_PLAYERS,PLAYER_MAX_SPEED_MPS,
 PLAYER_MIN_SEPARATION_M} from '../src/player-movement.mjs';
import {CONTROL_LAB_STARTS} from '../src/action-lab-scenarios.mjs';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab as createCurrentActionLab} from '../src/action-labs.mjs';
 // Historical M/B evidence comparator only. Current gameplay uses the default.
 const createControlledActionLab=(R,id,options={})=>createCurrentActionLab(R,id,{
  ...options,historicalEvidenceBaseline:!['pass-pair','cross-pair','carry-solo','dribble-1v1','keeper-1v1','defender-1v1','overload-2v1','duel-2v2','duel-3v3'].includes(id)
 });

import {chooseOriginalOpponentBallReachM32,
 M32_CHALLENGE_START_BALL_RANGE_M}
 from '../src/original-challenger-ball-reach-m32.mjs';
import {M31_CONTEST_TICKS} from '../src/real-opponent-ball-contest-m31.mjs';

const authenticated=()=>({
 actorId:'home-9',team:'home',tick:63,originalDecisionTick:63,
 originalRapierBallBody:true,nativeExclusiveShoeStart:true,
 actualPhysicsImpulseApplied:true,originalClearanceSuppressed:true,
 matchAuthority:false,officialPossession:false,impulseMagnitudeNs:1.35
});
const passed=()=>({tick:1,playerId:'home-10',team:'home',
 action:'pass',passTarget:{recipientId:'home-9'},
 appliedByRapier:true,actualPhysicsImpulseApplied:true});
const player=()=>({...INITIAL_PLAYERS.find(p=>p.id==='away-7'),
 x:0,y:-3.8});
test('M32 pure reach uses only real same-source tap and current live ball',()=>{
 const f={challenger:player(),ball:{x:-5,y:-3},
  receiverTeam:'home',actualReceiverTap:authenticated(),actualPass:passed()};
 const got=chooseOriginalOpponentBallReachM32(f);
 assert.deepEqual([got.x,got.y],[-5,-3]);
 assert.equal(got.playerId,'away-7');
 assert.equal(got.officialPossession,false);
 assert.equal(got.verifiedContact,false);
 assert.equal(chooseOriginalOpponentBallReachM32({...f,
  actualReceiverTap:null}),null);
 assert.equal(chooseOriginalOpponentBallReachM32({...f,
  ball:{x:10+M32_CHALLENGE_START_BALL_RANGE_M,y:3}}),null);
 for(const wrong of [
  {...f,actualReceiverTap:{...authenticated(),nativeExclusiveShoeStart:false}},
  {...f,actualReceiverTap:{...authenticated(),impulseMagnitudeNs:100}},
  {...f,actualPass:{...passed(),actualPhysicsImpulseApplied:false}},
  {...f,challenger:{...player(),id:'home-7'}},
  {...f,challenger:{...player(),x:Infinity}}
 ])assert.throws(()=>chooseOriginalOpponentBallReachM32(wrong),TypeError);
});
test('M32 mover rejects reach without original M31 fixture',()=>{
 for(const side of ['home','away']){
  assert.throws(()=>createPlayerMovement({
   researchControlReceiver:true,researchControlBall:CONTROL_LAB_STARTS[side],
   researchControlSide:side,researchControlChallengerReach:true
  }),TypeError);
  assert.throws(()=>createPlayerMovement({
   researchControlReceiver:true,researchControlBall:CONTROL_LAB_STARTS[side],
   researchControlSide:side,researchControlContestDefender:true,
   researchControlChallengerReach:true,researchControlSpaceDefender:true
  }),TypeError);
 }
});
test('M32 natural HOME/AWAY pursuit after M30, original Rapier force and deterministic replay',
 {timeout:120000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const base=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-contest'
  });
  const lab=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-challenge'
  });
  const replay=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-challenge'
  });
  try{
   assert.equal(base.snapshot().realBallReachM32,undefined);
   assert.equal(lab.snapshot().realBallReachM32.activeTicks,0);
   let closest=Infinity,sourceEnd=null,sourceTap=null,opponentStart=null;
   let earliestReach=null,firstOriginalDefenderGap=null,changed=false;
   for(let tick=1;tick<=63+M31_CONTEST_TICKS;tick++){
    const a=lab.step(),b=base.step(),c=replay.step();
    assert.deepEqual(a,c,'M32 same-world source replay must be deterministic');
    assert.equal(a.officialMatchPossession,false);
    assert.equal(a.realOpponentContest.officialPossession,false);
    assert.equal(a.realOpponentContest.verifiedTackle,false);
    assert.equal(a.realOpponentContest.verifiedInterception,false);
    assert.equal(a.realBallReachM32.verifiedOpponentShoeContact,false);
    assert.equal(a.realBallReachM32.officialPossession,false);
    assert.equal(a.realBallReachM32.readOnly,true);
    assert.equal(b.realBallReachM32,undefined);
    const def=a.observedMovementPlayers.find(p=>p.id===
     (side==='home'?'away-7':'home-7'));
    const defenderBallGap=Math.hypot(def.x-a.ball.position.x,
     def.y-a.ball.position.y);
    closest=Math.min(closest,defenderBallGap);
    assert.ok(Math.hypot(def.vx,def.vy)<=PLAYER_MAX_SPEED_MPS+1e-7);
    const ps=a.observedMovementPlayers;
    for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)
     assert.ok(Math.hypot(ps[i].x-ps[j].x,ps[i].y-ps[j].y)>=
      PLAYER_MIN_SEPARATION_M-1e-6);
    if(tick<=63){
     assert.deepEqual(a.ball,b.ball,'no pursuit until authentic M30 tap');
     assert.equal(a.realBallReachM32.activeTicks,0);
    }
    if(a.physicalReceiverTap?.tick===tick)sourceTap=tick;
    if(a.realBallReachM32.firstActiveTick!==null&&earliestReach===null){
     earliestReach=a.realBallReachM32.firstActiveTick;
     firstOriginalDefenderGap=defenderBallGap;
    }
    if(tick>63&&JSON.stringify(a.ball)!==JSON.stringify(b.ball))changed=true;
    const episode=a.realOpponentContest.latestCompleted;
    if(episode)sourceEnd=episode;
    if(a.realOpponentContest.active?.opposingShoeContactIsNative&&
       opponentStart===null){
     const ac=a.realOpponentContest.active;
     opponentStart={tick:ac.firstOpposingNativeShoeStartTick,
      id:ac.firstOpposingNativeShoeStartPlayerId};
     assert.ok(a.starts.includes(opponentStart.id),
      'only a genuine current original native Rapier START can be a touch');
    }
   }
   assert.equal(sourceTap,63);
   assert.equal(earliestReach,64,'do not steer before physical tap');
   assert.ok(lab.snapshot().realBallReachM32.activeTicks>0);
   assert.ok(lab.snapshot().realBallReachM32.minObservedPlayerBallGapM>=0);
   assert.ok(sourceEnd,'native 240-tick duel observation must complete');
   assert.equal(sourceEnd.observationComplete,true);
   assert.equal(sourceEnd.verifiedPossession,false);
   assert.equal(sourceEnd.verifiedTackle,false);
   assert.equal(sourceEnd.verifiedInterception,false);
   assert.equal(sourceEnd.opposingShoeContactIsNative,opponentStart!==null);
   if(opponentStart){
    assert.equal(sourceEnd.firstOpposingNativeShoeStartPlayerId,opponentStart.id);
    assert.equal(sourceEnd.firstOpposingNativeShoeStartTick,opponentStart.tick);
   }
   process.stdout.write('ME_628_M32_REAL_REACH_'+side.toUpperCase()+' '+
    JSON.stringify({earliestReach,realReachTicks:
     lab.snapshot().realBallReachM32.activeTicks,
     closestOriginalDefenderBallGapM:closest,
     firstOriginalDefenderGap,ballChangedAfterM30Tap:changed,
     opponentStart,episode:sourceEnd,officialPossession:false})+'\\n');
  }finally{base.dispose();lab.dispose();replay.dispose();}
 }
});
