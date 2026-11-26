// #628 ACTIONS-B02: native goalkeeper parry + canonical lateral dive approach.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {INITIAL_PLAYERS,PLAYER_VERSION,PLAYER_MIN_SEPARATION_M,PLAYER_TURN_RAD_PER_S}
 from '../src/player-movement.mjs';
import {SAVE_LAB_STARTS,ACTION_LAB_SCENARIOS}
 from '../src/action-lab-scenarios.mjs';
import {initialResearchGoalkeeperSaveLineup,chooseBasicGoalkeeperDiveTarget,createKeeperShotObserver}
 from '../src/goalkeeper-save-foundation-b02.mjs';
import {eligibleLiveKeeperSave,selectUniformAutonomousContactAction}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {initializeRapier,FIXED_DT} from '../src/core.mjs';
import {advanceGoalkeeperBallOrientation} from '../src/individual-kinematics.mjs';
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

 test('SHOT-06 witness does not award saves for contact or parry, and records actual full-ball crossing only',()=>{
  const witness=createKeeperShotObserver('home'),ball={velocity:{x:20,y:0,z:0}};
  const real=(tick,playerId,action)=>({tick,playerId,action,appliedByRapier:true,actualPhysicsImpulseApplied:true});
  const step=(tick,starts=[],action=null,event=null)=>witness.observe({tick,ball,starts,action,event});
  assert.equal(step(1,[],real(1,'home-10','shot')).shots,0);
  assert.equal(step(2,['home-10'],real(2,'home-10','shot')).shots,1);
  assert.equal(step(3,['away-1']).keeperContactTick,3);
  assert.equal(step(4,['away-1'],real(4,'away-1','save')).parryTick,4);
  assert.equal(step(5,[],null,{tick:5,kind:'goal',crossing:{fullBallCrossed:false}}).crossing,null);
  const goal=step(6,[],null,{tick:6,kind:'goal',scoringTeam:'home',crossing:{fullBallCrossed:true}});
  assert.equal(goal.crossing.kind,'goal');assert.equal(goal.officialSave,false);
  assert.equal(goal.officialGoal,false);
 });
 test('SHOT-06 real keeper duel baseline across 30 mirrored variants', {timeout:240000},async()=>{
  const R=await initializeRapier(rapier),counts={shots:0,contacts:0,parries:0,goals:0,otherExit:0,unresolved:0,noShot:0};
  for(const side of ['home','away'])for(let variantIndex=0;variantIndex<30;variantIndex++){
   const scene=createControlledActionLab(R,'keeper-1v1',{shotSide:side,variantIndex,bodyGuardEnabled:true});
   try{
    let f=scene.snapshot();assert.equal(f.keeperShotAudit.shots,0);
    const shots=new Set(),contacts=new Set(),parries=new Set();
    let previousFacing=f.observedMovementPlayers.find(p=>p.id===f.keeperShotAudit.keeperId).facingRad;
    for(let n=0;n<600;n++){
     f=scene.step();const audit=f.keeperShotAudit;
     const keeper=f.observedMovementPlayers.find(p=>p.id===audit.keeperId);
     const change=Math.atan2(Math.sin(keeper.facingRad-previousFacing),Math.cos(keeper.facingRad-previousFacing));
     assert.ok(Math.abs(change)<=PLAYER_TURN_RAD_PER_S*FIXED_DT+1e-8,'one capped keeper turn per tick');
     assert.ok(Math.cos(keeper.facingRad)*(side==='home'?-1:1)>=-1e-8,'keeper faces the field, not its own goal');
     previousFacing=keeper.facingRad;
     if(f.action?.action==='shot'&&f.action.team===side&&f.action.actualPhysicsImpulseApplied)shots.add(f.physicsTick);
     if(f.starts.includes(audit.keeperId))contacts.add(f.physicsTick);
     if(f.action?.playerId===audit.keeperId&&f.action.action==='save'&&f.action.actualPhysicsImpulseApplied)parries.add(f.physicsTick);
     assert.equal(audit.officialSave,false);assert.equal(audit.officialGoal,false);
     assert.equal(f.officialMatchResult,null);
     if(f.refereeEvidence?.lastEvent)break;
    }
    const audit=f.keeperShotAudit;assert.equal(audit.shots,shots.size);
    if(audit.shots===0)counts.noShot++;
    else{
     counts.shots+=audit.shots;assert.ok(shots.has(audit.shotTick));
     if(audit.keeperContactTick!==null){assert.ok(contacts.has(audit.keeperContactTick));counts.contacts++;}
     if(audit.parryTick!==null){assert.ok(parries.has(audit.parryTick));counts.parries++;}
     if(audit.crossing){assert.equal(f.refereeEvidence.lastEvent.crossing.fullBallCrossed,true);
      assert.equal(audit.crossing.tick,f.refereeEvidence.lastEvent.tick);
      counts[audit.crossing.kind==='goal'?'goals':'otherExit']++;
     }else counts.unresolved++;
    }
   }finally{scene.dispose();}
  }
  assert.ok(counts.shots>0,'existing live context must generate genuine shots');
  process.stdout.write('ME_628_SHOT_06_BASELINE '+JSON.stringify(counts)+'\n');
 });

 test('GK-01 keeper watches the ball instead of spinning with lateral or backward velocity',()=>{
  const limits={dt:FIXED_DT,maxSpeed:7,acceleration:8,braking:8,turnRate:PLAYER_TURN_RAD_PER_S,maxX:51.99,maxY:33.49};
  const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  for(const team of ['home','away']){
   const dir=team==='home'?1:-1;
   const keeper={team,x:-dir*48,y:0,facingRad:team==='home'?0:Math.PI,vx:-dir,vy:2};
   const target={x:keeper.x+dir*15,y:4};
   const ideal=Math.atan2(4,dir*15);
   for(let tick=0;tick<60;tick++){
    const prior=keeper.facingRad;
    keeper.facingRad=advanceGoalkeeperBallOrientation(keeper,target,limits);
    assert.ok(Math.abs(delta(keeper.facingRad,prior))<=PLAYER_TURN_RAD_PER_S*FIXED_DT+1e-9);
   }
   assert.ok(Math.abs(delta(keeper.facingRad,ideal))<1e-9);
   // Ball passing behind the keeper must not cause a 180-degree reversal.
   for(let tick=0;tick<60;tick++){
    const prior=keeper.facingRad;
    keeper.facingRad=advanceGoalkeeperBallOrientation(keeper,{x:keeper.x-dir,y:0},limits);
    assert.ok(Math.abs(delta(keeper.facingRad,prior))<=PLAYER_TURN_RAD_PER_S*FIXED_DT+1e-9);
    assert.ok(Math.cos(keeper.facingRad)*dir>=-1e-9);
   }
  }
 });
