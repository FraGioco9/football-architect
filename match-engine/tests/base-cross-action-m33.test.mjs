// #628 ACTIONS-B01: complete a basic CROSS attempt before tuning numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {INITIAL_PLAYERS,PLAYER_VERSION,PLAYER_MIN_SEPARATION_M}
 from '../src/player-movement.mjs';
import {selectUniformAutonomousContactAction}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {initialResearchShotLineup}
 from '../src/research-shot-initial-lineup.mjs';
import {CROSS_LAB_STARTS,ACTION_LAB_SCENARIOS}
 from '../src/action-lab-scenarios.mjs';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';

const frame=(players,tick=1)=>Object.freeze({
 version:PLAYER_VERSION,tick,
 players:Object.freeze(players)
});
const choose=(side,players,ball)=>selectUniformAutonomousContactAction({
 tick:1,contactStarted:[side+'-10'],contactActive:[side+'-10'],
 playerFrame:frame(players),ballPosition:{x:ball.x,y:ball.y,z:0.11},
 ballVelocity:{x:0,y:0,z:0},ballRadiusM:0.11
});
test('ACTIONS-B01 original uniform policy selects a genuine wide CROSS candidate for both teams',()=>{
 for(const side of ['home','away']){
  const start=CROSS_LAB_STARTS[side];
  const staged=initialResearchShotLineup(INITIAL_PLAYERS,side,start,{wideCross:true});
  assert.deepEqual(staged.map(x=>x.id),INITIAL_PLAYERS.map(x=>x.id));
  for(let i=0;i<staged.length;i++)for(let j=i+1;j<staged.length;j++)
   assert.ok(Math.hypot(staged[i].x-staged[j].x,
    staged[i].y-staged[j].y)>=PLAYER_MIN_SEPARATION_M-1e-8);
  const action=choose(side,staged,start);
  assert.equal(action.action,'cross');
  assert.equal(action.playerId,side+'-10');
  assert.equal(action.recipientId,side+'-9');
  assert.equal(action.team,side);
  assert.equal(action.passTarget,null);
  assert.equal(action.shotTarget,null);
  assert.equal(action.crossTarget.recipientId,side+'-9');
  assert.equal(action.crossTarget.physicsTick,1);
  assert.equal(action.crossTarget.physicalCrossAttemptOnly,true);
  assert.equal(action.crossTarget.crossCompleted,false);
  assert.ok(action.crossTarget.distanceM>=8);
  assert.ok(action.crossTarget.laneClearanceM>=1.4);
  assert.equal(action.decisionContext.rule,'wide-live-teammate-lofted-cross');
  assert.ok(action.impulseNs.x*(side==='home'?1:-1)>0);
  assert.ok(action.impulseNs.y*(side==='home'?-1:1)>0);
  assert.ok(action.impulseNs.z>0);
  assert.ok(Math.abs(Math.hypot(...Object.values(action.impulseNs))-2.7)<1e-8);
  assert.equal(action.appliedByRapier,false,
   'pure decision is never its own physical authorization');
  assert.equal(action.officialMatchAction,false);
  assert.equal(action.officialMatchPossession,false);
 }
});
test('ACTIONS-B01 no live teammate or no exclusive shoe START means no cross',()=>{
 const side='home',start=CROSS_LAB_STARTS.home;
 const staged=initialResearchShotLineup(INITIAL_PLAYERS,side,start,{wideCross:true});
 const noTarget=staged.map(p=>p.id==='home-9'?
  Object.freeze({...p,x:-5,y:-18}):p);
 const nonCross=choose(side,noTarget,start);
 assert.notEqual(nonCross?.action,'cross');
 assert.equal(selectUniformAutonomousContactAction({
  tick:1,contactStarted:['home-10','away-10'],
  contactActive:['home-10','away-10'],
  playerFrame:frame(staged),
  ballPosition:{x:start.x,y:start.y,z:0.11},
  ballVelocity:{x:0,y:0,z:0},ballRadiusM:0.11
 }),null);
 const center=choose('home',staged,{x:30,y:0});
 assert.notEqual(center?.action,'cross');
 assert.throws(()=>initialResearchShotLineup(INITIAL_PLAYERS,'home',start,{
  blockedLane:true,wideCross:true}),TypeError);
 assert.equal(ACTION_LAB_SCENARIOS.filter(s=>s.id==='cross').length,1);
});
test('ACTIONS-B01 real HOME/AWAY canonical Rapier shoe START, lofted CROSS impulse and 3D ball flight',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 for(const side of ['home','away']){
  const a=createControlledActionLab(R,'cross',{shotSide:side});
  const b=createControlledActionLab(R,'cross',{shotSide:side});
  try{
   const zero=a.snapshot();
   assert.equal(zero.physicsTick,0);
   assert.equal(zero.action,null);
   assert.equal(zero.starts.length,0);
   assert.equal(zero.players.length,22);
   let first=null,flight=false;
   for(let t=1;t<=100;t++){
    const x=a.step(),y=b.step();
    assert.deepEqual(x,y,'HOME/AWAY physical replay must be deterministic');
    assert.equal(x.officialMatchPossession,false);
    assert.equal(x.officialMatchResult,null);
    assert.equal(x.evidence.officialGoal,false);
    assert.equal(x.evidence.passCompleted,null);
    if(x.action?.action==='cross'&&!first){
     first=x.action;
     assert.deepEqual(x.starts,[side+'-10']);
     assert.equal(x.evidence.verifiedShoeImpulse,true);
     assert.equal(x.action.appliedByRapier,true);
     assert.equal(x.action.actualPhysicsImpulseApplied,true);
     assert.equal(x.action.crossTarget.physicalCrossAttemptOnly,true);
     assert.equal(x.action.crossTarget.crossCompleted,false);
     assert.equal(x.action.officialMatchAction,false);
     assert.ok(x.action.impulseNs.z>0);
    }
    if(x.shotFlight?.actionType==='cross'&&
       x.shotFlight.observed3DFlight){
     flight=true;
     assert.ok(x.shotFlight.maxCenterZM>x.shotFlight.origin.z+0.02);
     assert.ok(x.shotFlight.path3DM>0);
    }
   }
   assert.ok(first,'CROSS requires a true native Rapier shoe START on '+side);
   assert.ok(flight,'cross must produce actual measured ball flight on '+side);
   process.stdout.write('ME_628_ACTION_CROSS_'+side.toUpperCase()+' '+
    JSON.stringify({actionTick:first.tick,
     actor:first.playerId,recipient:first.crossTarget.recipientId,
     trueRapierImpulse:first.impulseNs,observed3DFlight:flight,
     officialPossession:false,crossCompleted:false})+'\\n');
  }finally{a.dispose();b.dispose();}
 }
});


test('CROSS-01 isolated native lofted cross measures first low arrival for both sides',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 assert.throws(()=>createControlledActionLab(R,'cross-pair',{bodyGuardEnabled:true}),TypeError);
 for(const side of ['home','away'])for(const variantIndex of [0,1,9,21,29]){
  const lab=createControlledActionLab(R,'cross-pair',{shotSide:side,variantIndex});
  try{
   let frame=lab.snapshot(),count=0;
   assert.equal(frame.genuinePhysicalPlayerCount,2);
   assert.deepEqual(lab.focus,[side+'-9',side+'-10']);
   for(let t=1;t<=240;t++){
    frame=lab.step();
    assert.equal(frame.officialMatchPossession,false);
    assert.equal(frame.officialMatchResult,null);
    assert.ok(frame.starts.every(id=>lab.focus.includes(id)));
    if(frame.action){
     count++;
     assert.equal(frame.action.action,'cross');
     assert.equal(frame.action.playerId,side+'-10');
     assert.equal(frame.action.crossTarget.recipientId,side+'-9');
     assert.deepEqual(frame.starts,[side+'-10']);
     assert.equal(frame.action.actualPhysicsImpulseApplied,true);
     const c=frame.action.isolatedCrossCalibration;
     assert.ok(c.scale>=1&&c.scale<=3.8);
     for(const axis of ['x','y','z'])
      assert.equal(frame.action.impulseNs[axis],c.originalImpulseNs[axis]*c.scale);
     assert.ok(frame.action.impulseNs.z>0);
    }
   }
   assert.equal(count,1);
   rows.push({side,variantIndex,...frame.crossPairAudit});
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_CROSS_PAIR '+JSON.stringify(rows)+'\n');
 assert.equal(rows.length,10);
 for(const row of rows){
  assert.equal(row.airborne,true,JSON.stringify(row));
  assert.ok(row.peakClearanceM>=1&&row.peakClearanceM<=5,JSON.stringify(row));
  assert.ok(row.arrival&&row.arrival.timeS>0.5&&row.arrival.timeS<=3,JSON.stringify(row));
  assert.ok(['native-ground-solver-pair','native-receiving-shoe-start'].includes(row.arrival.source),JSON.stringify(row));
  assert.ok(row.arrival.targetGapM<=3,JSON.stringify(row));
  assert.ok(row.firstLowSample,JSON.stringify(row));
  if(row.firstGroundContact)assert.ok(row.firstGroundContact.ground.solverContacts>0);
  if(row.firstReceivingShoeStart)assert.equal(row.firstReceivingShoeStart.realRapierShoeStart,true);
  assert.equal(row.officialReception,false);
  assert.equal(row.officialCrossCompleted,false);
 }
});
