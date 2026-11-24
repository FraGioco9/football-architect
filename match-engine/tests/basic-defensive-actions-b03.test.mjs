// #628 ACTIONS-B03: first physical TACKLE and inbound INTERCEPTION
// ATTEMPTS only. No possession, ball recovery, or confirmed pass interception.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {INITIAL_PLAYERS,PLAYER_VERSION,PLAYER_MIN_SEPARATION_M,
 PLAYER_MAX_SPEED_MPS} from '../src/player-movement.mjs';
import {DEFENSE_LAB_STARTS,ACTION_LAB_SCENARIOS}
 from '../src/action-lab-scenarios.mjs';
import {BASIC_DEFENSIVE_ACTION_VERSION,initialResearchDefensiveLineup,
 chooseBasicDefensiveAttempt} from '../src/basic-defensive-physical-actions-b03.mjs';
import {selectUniformAutonomousContactAction}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {initializeRapier} from '../src/core.mjs';

function candidate(side,players,ball,active=[side+'-7'],started=active){
 return selectUniformAutonomousContactAction({
  tick:1,contactStarted:started,contactActive:active,
  playerFrame:{version:PLAYER_VERSION,tick:1,players},
  ballPosition:{x:ball.x,y:ball.y,z:0.11},
  ballVelocity:{x:ball.vx,y:ball.vy,z:ball.vz},
  ballRadiusM:0.11
 });
}
test('B03 selects distinct authentic physical TACKLE / INTERCEPTION intents on both teams',()=>{
 assert.equal(ACTION_LAB_SCENARIOS.filter(s=>
  ['tackle','interception'].includes(s.id)).length,2);
 for(const kind of ['tackle','interception'])
  for(const side of ['home','away']){
   const ball=DEFENSE_LAB_STARTS[kind][side];
   const players=initialResearchDefensiveLineup(
    INITIAL_PLAYERS,side,ball,{kind});
   assert.equal(players.length,22);
   assert.deepEqual(players.map(p=>p.id),INITIAL_PLAYERS.map(p=>p.id));
   for(let i=0;i<22;i++)for(let j=i+1;j<22;j++)
    assert.ok(Math.hypot(players[i].x-players[j].x,
     players[i].y-players[j].y)>=PLAYER_MIN_SEPARATION_M-1e-8);
   const defender=players.find(p=>p.id===side+'-7');
   const intent=chooseBasicDefensiveAttempt({
    actor:defender,players,ball,
    velocity:{x:ball.vx,y:ball.vy}
   });
   assert.equal(intent.kind,kind);
   assert.equal(intent.version,BASIC_DEFENSIVE_ACTION_VERSION);
   assert.equal(intent.actorId,side+'-7');
   assert.equal(intent.opponentId,(side==='home'?'away':'home')+'-10');
   assert.equal(intent.nativeRapierShoeStartRequired,true);
   assert.equal(intent.actualOpposingPlayerObserved,true);
   assert.equal(intent.tackleWon,false);
   assert.equal(intent.interceptionConfirmed,false);
   assert.equal(intent.officialPossession,false);
   const action=candidate(side,players,ball);
   assert.equal(action.action,kind);
   assert.equal(action.playerId,side+'-7');
   assert.equal(action.defensiveTarget.actorId,side+'-7');
   assert.equal(action.defensiveTarget.kind,kind);
   assert.equal(action.defensiveTarget.physicsTick,1);
   assert.equal(action.defensiveTarget.officialPossession,false);
   assert.equal(action.officialMatchAction,false);
   assert.equal(action.appliedByRapier,false);
   assert.ok(action.impulseNs.x*(side==='home'?1:-1)>0);
   assert.ok(action.impulseNs.z>0);
  }
});
test('B03 never invents a defensive action from velocity, proximity or absent native shoe START',()=>{
 const side='home',ball=DEFENSE_LAB_STARTS.tackle.home;
 const players=initialResearchDefensiveLineup(INITIAL_PLAYERS,
  side,ball,{kind:'tackle'});
 assert.equal(candidate(side,players,ball,['home-7','away-10']),null);
 assert.equal(candidate(side,players,ball,[],[])?.action==='tackle',false);
 const wrongOpponent=players.map(p=>p.id==='away-10'?
   Object.freeze({...p,x:12,y:22}):p);
 assert.equal(chooseBasicDefensiveAttempt({
  actor:players.find(p=>p.id==='home-7'),players:wrongOpponent,
  ball,velocity:{x:ball.vx,y:ball.vy}
 }),null);
 const wrongSpeed=DEFENSE_LAB_STARTS.interception.home;
 assert.equal(chooseBasicDefensiveAttempt({
  actor:players.find(p=>p.id==='home-7'),players,ball:wrongSpeed,
  velocity:{x:2,y:0}
 }),null);
 const attacker=players.find(p=>p.id==='away-10');
 assert.equal(chooseBasicDefensiveAttempt({
  actor:attacker,players,ball,velocity:{x:0.2,y:0}
 }),null);
 assert.throws(()=>initialResearchDefensiveLineup(
  INITIAL_PLAYERS,'home',ball,{kind:'interception'}),TypeError);
 assert.throws(()=>initialResearchDefensiveLineup(
  INITIAL_PLAYERS,'home',{...ball,x:0},{kind:'tackle'}),TypeError);
});
test('B03 mirrored HOME/AWAY true original Rapier shoe START, real defensive impulse, genuine 3D ball travel',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 for(const kind of ['tackle','interception'])
  for(const side of ['home','away']){
   const a=createControlledActionLab(R,kind,{shotSide:side});
   const b=createControlledActionLab(R,kind,{shotSide:side});
   try{
    const initial=a.snapshot();
    assert.equal(initial.physicsTick,0);
    assert.equal(initial.action,null);
    assert.equal(initial.starts.length,0);
    assert.equal(initial.players.length,22);
    let first=null,maxTravel=0,firstHitTick=null;
    for(let t=1;t<=50;t++){
     const x=a.step(),y=b.step();
     assert.deepEqual(x.ball,y.ball);
     assert.deepEqual(x.action,y.action);
     assert.deepEqual(x.starts,y.starts);
     assert.deepEqual(x.evidence,y.evidence);
     assert.equal(x.officialMatchResult,null);
     assert.equal(x.officialMatchPossession,false);
     assert.equal(x.evidence.officialGoal,false);
     assert.equal(x.evidence.tackleConfirmed,null);
     assert.equal(x.evidence.officialPossession,false);
     for(const p of x.observedMovementPlayers)
      assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
     if(x.action?.action===kind&&first===null){
      first=x.action;firstHitTick=t;
      assert.deepEqual(x.starts,[side+'-7']);
      assert.equal(first.actualPhysicsImpulseApplied,true);
      assert.equal(first.appliedByRapier,true);
      assert.equal(x.evidence.witnessed,true);
      assert.equal(x.evidence.verifiedShoeImpulse,true);
      assert.equal(first.defensiveTarget.nativeRapierShoeStartRequired,true);
      assert.equal(first.defensiveTarget.tackleWon,false);
      assert.equal(first.defensiveTarget.interceptionConfirmed,false);
      assert.equal(first.defensiveTarget.officialPossession,false);
     }
     if(x.shotFlight?.actionType===kind)
      maxTravel=Math.max(maxTravel,x.shotFlight.path3DM);
    }
    assert.ok(first,kind+' must originate from actual original '+side+' shoe START');
    assert.ok(maxTravel>0.15,kind+' must physically change original ball trajectory');
    process.stdout.write('ME_628_B03_'+kind.toUpperCase()+'_'+side.toUpperCase()+' '+
     JSON.stringify({tick:firstHitTick,actor:first.playerId,
      opponent:first.defensiveTarget.opponentId,
      nativeRapierImpulse:first.impulseNs,
      traveledM:maxTravel,officialInterception:false,
      tackleWon:false,officialPossession:false})+'\\n');
   }finally{a.dispose();b.dispose();}
  }
});
