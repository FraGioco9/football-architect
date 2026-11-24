// #628 ACTIONS-B02: native goalkeeper parry + canonical lateral dive approach.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {INITIAL_PLAYERS,PLAYER_VERSION,PLAYER_MIN_SEPARATION_M}
 from '../src/player-movement.mjs';
import {SAVE_LAB_STARTS,ACTION_LAB_SCENARIOS}
 from '../src/action-lab-scenarios.mjs';
import {initialResearchGoalkeeperSaveLineup,chooseBasicGoalkeeperDiveTarget}
 from '../src/goalkeeper-save-foundation-b02.mjs';
import {eligibleLiveKeeperSave,selectUniformAutonomousContactAction}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';

function candidate(side,players,ball,active=[side+'-1'],started=active){
 return selectUniformAutonomousContactAction({
  tick:1,contactStarted:started,contactActive:active,
  playerFrame:{version:PLAYER_VERSION,tick:1,players},
  ballPosition:{x:ball.x,y:ball.y,z:0.11},
  ballVelocity:{x:ball.vx,y:ball.vy,z:ball.vz},
  ballRadiusM:0.11
 });
}
test('ACTIONS-B02 live original keeper computes grounded lateral approach, not automatic save',()=>{
 for(const side of ['home','away']){
  const ball=SAVE_LAB_STARTS[side];
  const players=initialResearchGoalkeeperSaveLineup(INITIAL_PLAYERS,side,ball);
  assert.equal(players.length,22);
  assert.deepEqual(players.map(p=>p.id),INITIAL_PLAYERS.map(p=>p.id));
  for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++)
   assert.ok(Math.hypot(players[i].x-players[j].x,
    players[i].y-players[j].y)>=PLAYER_MIN_SEPARATION_M-1e-8);
  const keeper=players.find(p=>p.id===side+'-1');
  const target=chooseBasicGoalkeeperDiveTarget({
   keeper,ballPosition:{...ball,z:0.11},
   ballVelocity:{x:ball.vx,y:ball.vy,z:0}
  });
  assert.ok(target,'live inbound ball must produce a goalkeeper movement target');
  assert.equal(target.attemptOnly,true);
  assert.equal(target.officialSave,false);
  assert.ok((target.y-keeper.y)*(side==='home'?1:-1)>0,
   'goalkeeper should actually change lateral heading toward predicted arrival');
  assert.equal(eligibleLiveKeeperSave(keeper,
   {x:ball.x,y:ball.y,z:0.11},
   {x:ball.vx,y:ball.vy,z:0}),true);
  const pick=candidate(side,players,ball);
  assert.equal(pick.action,'save');
  assert.equal(pick.playerId,keeper.id);
  assert.equal(pick.recipientId,null);
  assert.equal(pick.saveTarget.nativeExclusiveShoeRequired,true);
  assert.equal(pick.saveTarget.saveConfirmed,false);
  assert.equal(pick.saveTarget.officialSave,false);
  assert.equal(pick.officialMatchAction,false);
  assert.ok(pick.impulseNs.x*(side==='home'?1:-1)>0);
  assert.ok(pick.impulseNs.z>0);
 }
});
test('ACTIONS-B02 no fake save without real exclusive START or inbound goalkeeper threat',()=>{
 const side='home',ball=SAVE_LAB_STARTS[side];
 const p=initialResearchGoalkeeperSaveLineup(INITIAL_PLAYERS,side,ball);
 assert.equal(candidate(side,p,ball,['home-1','away-1']),null);
 assert.equal(candidate(side,p,{...ball,vx:3})?.action==='save',false);
 assert.equal(candidate(side,p,{...ball,y:14})?.action==='save',false);
 assert.equal(candidate(side,p,ball,['home-10'],['home-10'])?.action==='save',false);
 assert.equal(chooseBasicGoalkeeperDiveTarget({
  keeper:p[0],ballPosition:{x:ball.x,y:ball.y,z:0.11},
  ballVelocity:{x:3,y:0,z:0}
 }),null);
 assert.throws(()=>chooseBasicGoalkeeperDiveTarget({
  keeper:p[0],ballPosition:{x:NaN,y:0,z:0.11},
  ballVelocity:{x:-2,y:0,z:0}
 }),/original goalkeeper/);
 assert.throws(()=>initialResearchGoalkeeperSaveLineup(INITIAL_PLAYERS,'home',{
  ...ball,vx:2
 }),/Goalward/);
 assert.equal(ACTION_LAB_SCENARIOS.filter(s=>s.id==='save').length,1);
});
test('ACTIONS-B02 real HOME/AWAY original Rapier keeper shoe START, parry, dive approach and deterministic ball trajectory',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 for(const side of ['home','away']){
  const a=createControlledActionLab(R,'save',{shotSide:side});
  const b=createControlledActionLab(R,'save',{shotSide:side});
  let first=null,realDiveTicks=0,observedFlight=false;
  try{
   const zero=a.snapshot(),keeper0=zero.players.find(p=>p.id===side+'-1');
   assert.equal(zero.physicsTick,0);
   assert.equal(zero.action,null);
   assert.equal(zero.players.length,22);
   assert.equal(zero.goalkeeperDiveIntent,null);
   for(let t=1;t<=60;t++){
    const x=a.step(),y=b.step();
    assert.deepEqual(x.ball,y.ball);
    assert.deepEqual(x.starts,y.starts);
    assert.deepEqual(x.action,y.action);
    assert.deepEqual(x.goalkeeperDiveIntent,y.goalkeeperDiveIntent);
    assert.equal(x.officialMatchResult,null);
    assert.equal(x.officialMatchPossession,false);
    assert.equal(x.evidence.officialGoal,false);
    assert.equal(x.evidence.tackleConfirmed,null);
    realDiveTicks=Math.max(realDiveTicks,x.goalkeeperDiveIntentTicks);
    if(t===1){
     const keeper=x.observedMovementPlayers.find(p=>p.id===side+'-1');
     assert.ok((keeper.y-keeper0.y)*(side==='home'?1:-1)>0,
      'original accelerated keeper must begin moving laterally');
     assert.ok(Math.hypot(keeper.vx,keeper.vy)<=7+1e-8);
    }
    if(x.action?.action==='save'&&!first){
     first=x.action;
     assert.deepEqual(x.starts,[side+'-1']);
     assert.equal(x.evidence.witnessed,true);
     assert.equal(x.evidence.verifiedShoeImpulse,true);
     assert.equal(first.appliedByRapier,true);
     assert.equal(first.actualPhysicsImpulseApplied,true);
     assert.equal(first.saveTarget.actorId,side+'-1');
     assert.equal(first.saveTarget.saveConfirmed,false);
     assert.equal(first.saveTarget.officialSave,false);
    }
    if(x.shotFlight?.actionType==='save'&&
       x.shotFlight.observed3DFlight)
     observedFlight=true;
   }
   assert.ok(realDiveTicks>=1,'a live original keeper movement target is required');
   assert.ok(first,'genuine exclusive Rapier goalkeeper shoe START is required');
   assert.ok(observedFlight,'native keeper parry must move the original ball in real 3D');
   process.stdout.write('ME_628_KEEPER_SAVE_'+side.toUpperCase()+' '+
    JSON.stringify({tick:first.tick,actor:first.playerId,
     nativeExclusiveStart:true,impulse:first.impulseNs,
     lateralApproachTicks:realDiveTicks,real3DFlight:observedFlight,
     saveConfirmed:false,officialPossession:false})+'\\n');
  }finally{a.dispose();b.dispose();}
 }
});
