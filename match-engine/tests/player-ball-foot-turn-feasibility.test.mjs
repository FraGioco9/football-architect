// C2.3t: retrospective, read-only turn/translation bounds against actual
// 60Hz Rapier ball trajectories. Bounds are necessary/optimistic only:
// neither a predicted interception nor an invented shoe contact or SHOT.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_MAX_SPEED_MPS,PLAYER_ACCEL_MPS2,
 PLAYER_TURN_RAD_PER_S,PLAYER_DT,PLAYER_PITCH,createPlayerMovement}
 from '../src/player-movement.mjs';
import {FOOT_CONTACT_FORWARD_OFFSET_M,FOOT_CONTACT_HALF_LENGTH_M,
 FOOT_CONTACT_ROUNDING_M} from '../src/player-foot-contact.mjs';
import {BALL_RADIUS} from '../src/core.mjs';
import {measureOrientedCarryShoeBallGeometry}
 from '../src/player-ball-carry-oriented-shoe-geometry.mjs';
import {SHOT_MAX_RANGE_M}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const N=720,HORIZONS=Object.freeze([6,12,24]);
const ANCHORS=Object.freeze([635,650,664,675,683,693]);
const CASES=Object.freeze([
 Object.freeze({team:'home',country:'IT',x:-4.96,vx:0.3}),
 Object.freeze({team:'away',country:'DE',x:4.96,vx:-0.3})
]);
const OPT=Object.freeze({
 access:Object.freeze({autonomousActions:true,autonomousCarry:true,
  autonomousCarrySupport:true,autonomousCarrySupportPressHandoff:true,
  autonomousCarrySupportBallAccess:true}),
 aligned:Object.freeze({autonomousActions:true,autonomousCarry:true,
  autonomousCarrySupport:true,autonomousCarrySupportPressHandoff:true,
  autonomousCarrySupportBallAccess:true,
  autonomousCarrySupportLateralAlign:true})
});
const R3=x=>Number(x.toFixed(3));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleDiff=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
const fixture=c=>Object.freeze({
 id:'season:1:'+c.country+'-1:N01:'+c.country+'-1:'+c.country+'-2',
 competitionId:c.country+'-1',marker:'N01',day:1,round:1,
 homeClubId:c.country+'-1',awayClubId:c.country+'-2'
});
const initial=c=>Object.freeze({
 preset:'roll',seed:'c2-3e-natural-physical-'+c.team+'-'+c.country,
 x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
});

// Pure post-hoc UPPER bound: even optimal acceleration/turn cannot
// displace the body farther than the sum of these speed-limited ticks.
// Positive feasibility is NOT proof of reachability: opposing bodies,
// momentum, the shoe's width/height and actual Rapier contact are omitted.
function optimisticEnvelope(p,actualFutureBall,horizon){
 if(!p||!actualFutureBall||!Number.isInteger(horizon)||
  horizon<1||horizon>30||
  ![p.x,p.y,p.vx,p.vy,p.facingRad,
    actualFutureBall.x,actualFutureBall.y,actualFutureBall.z]
   .every(n=>typeof n==='number'&&Number.isFinite(n))||
  actualFutureBall.z<0)
  throw new TypeError('Finite measured pose, ball and 1..30 tick horizon required');
 const currentSpeed= Math.hypot(p.vx,p.vy);
 if(currentSpeed>PLAYER_MAX_SPEED_MPS+1e-6)
  throw new TypeError('Untrusted player speed');
 let upperTranslation=0;
 for(let k=1;k<=horizon;k++)
  upperTranslation+=Math.min(PLAYER_MAX_SPEED_MPS,
   currentSpeed+PLAYER_ACCEL_MPS2*k*PLAYER_DT)*PLAYER_DT;
 const bodyToFutureBall=dist(p,actualFutureBall);
 const shoeLongitudinalXYUpper=FOOT_CONTACT_FORWARD_OFFSET_M+
  FOOT_CONTACT_HALF_LENGTH_M+FOOT_CONTACT_ROUNDING_M+BALL_RADIUS;
 const translationNecessaryLower=Math.max(0,
  bodyToFutureBall-shoeLongitudinalXYUpper);
 const bearing=Math.atan2(actualFutureBall.y-p.y,
  actualFutureBall.x-p.x);
 const fixedBodyTurn=angleDiff(bearing,p.facingRad);
 const maxTurn=PLAYER_TURN_RAD_PER_S*horizon*PLAYER_DT;
 return Object.freeze({
  bodyToFutureBallM:bodyToFutureBall,
  upperBodyTravelM:upperTranslation,
  necessaryBodyTravelLowerM:translationNecessaryLower,
  speedBoundAllowsContact:translationNecessaryLower<=upperTranslation+1e-10,
  requiredFixedBodyBearingTurnRad:fixedBodyTurn,
  maxPossibleTurnRad:maxTurn,
  fixedBodyTurnBoundAllowsFacing:fixedBodyTurn<=maxTurn+1e-10,
  // Merely an optimistic geometric screen, not a physics/contact claim.
  actualRapierContactInferred:false,shotInferred:false,
  outcomeAdjudicated:false
 });
}
function make(R,c,mode){
 return {
  mode,team:c.team,
  engine:createPhysicalFixtureStepRuntime(R,fixture(c),initial(c),
   OPT[mode]),
  mover:createPlayerMovement({
   experimentalAiKickApproach:true,
   experimentalAutonomousFixtureContactChase:true,
   experimentalAutonomousFixtureCarry:true,
   experimentalAutonomousFixtureCarrySupport:true,
   experimentalAutonomousFixtureCarrySupportPressHandoff:true,
   experimentalAutonomousFixtureCarrySupportBallAccess:true,
   ...(mode==='aligned'?{
    experimentalAutonomousFixtureCarrySupportLateralAlign:true}:{})
  }),
  lastPass:null,lastCarry:null,records:[],
  stats:{sourceAccessFrames:0,starts:0,forwardStarts:0,
   actions:[],naturalShots:[],minShotShortfall:Infinity}
 };
}
function verifyAndRecord(s,c){
 const prior=s.engine.snapshot(),old=s.mover.snapshot();
 const tick=prior.physicsTick+1;
 assert.equal(old.tick,tick-1);
 const moved=s.mover.step(prior.ball.position);
 const frame=s.engine.step();
 assert.equal(moved.tick,tick);
 assert.equal(frame.physicsTick,tick);
 assert.equal(frame.officialMatchResult,null);
 assert.equal(frame.officialMatchPossession,false);
 assert.equal(frame.productionScoringConnected,false);
 assert.equal(frame.physicalShotBoundary.goalScored,null);
 assert.equal(moved.players.length,22);
 assert.equal(frame.physicalPlayerPositions.length,22);
 for(let i=0;i<22;i++){
  const p=moved.players[i],real=frame.physicalPlayerPositions[i],
   previous=old.players[i];
  assert.equal(p.id,INITIAL_PLAYERS[i].id);
  assert.equal(real.engineId,p.id);
  assert.equal(real.team,p.team);
  assert.ok(Math.abs(p.x-real.x)<1e-9);
  assert.ok(Math.abs(p.y-real.y)<1e-9);
  assert.ok(dist(p,previous)<=PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-5);
  assert.ok(angleDiff(p.facingRad,previous.facingRad)<=
   PLAYER_TURN_RAD_PER_S*PLAYER_DT+1e-5);
 }
 const actor=moved.players.find(p=>p.id===s.team+'-10');
 assert.ok(actor);
 const access=moved.provisionalCarrySupportBallAccess??null;
 if(access){
  assert.equal(access.team,s.team);
  assert.equal(access.playerId,actor.id);
  assert.equal(access.sourcePassTick,s.lastPass?.tick);
  assert.equal(access.sourceCarryTick,s.lastCarry?.tick);
  assert.ok(s.lastPass.tick<s.lastCarry.tick&&
   s.lastCarry.tick<tick);
  assert.ok(tick-s.lastCarry.tick<=150&&
   tick-s.lastPass.tick<=480);
  assert.ok(access.bodyBallGapM<=4);
  assert.equal(access.movementIntentOnly,true);
  assert.equal(access.physicalShoeStartObserved,false);
  assert.equal(access.footballActionExecuted,false);
  s.stats.sourceAccessFrames++;
 }
 const realStarts=frame.physicalContactFeed.started;
 s.stats.starts+=realStarts.length;
 for(const event of realStarts){
  assert.ok(frame.physicalContactFeed.active.some(a=>
   a.engineId===event.engineId&&a.team===event.team));
  // Tick 1 may carry an original shoe START; audit *subsequent* touches.
  if(event.engineId===actor.id&&tick>1)s.stats.forwardStarts++;
 }
 const act=frame.localAutonomousAction;
 if(act){
  assert.equal(realStarts.length,1);
  assert.equal(realStarts[0].engineId,act.playerId);
  assert.equal(realStarts[0].team,act.team);
  assert.equal(act.physicalTrigger,'same-tick-real-rapier-shoe-start');
  assert.equal(act.appliedByRapier,true);
  assert.equal(act.actualPhysicsImpulseApplied,true);
  assert.equal(act.officialMatchAction,false);
  s.stats.actions.push({tick,team:act.team,playerId:act.playerId,
   action:act.action});
  if(act.action==='shot'){
   assert.equal(act.decisionContext.shotRange,true);
   assert.equal(act.shotTarget?.physicsTick,tick);
   s.stats.naturalShots.push(tick);
  }
 }
 const foot=measureOrientedCarryShoeBallGeometry(actor,
  frame.ball.position);
 assert.equal(foot.actualRapierCollisionInferred,false);
 const goalX=(s.team==='home'?1:-1)*PLAYER_PITCH.lengthM/2;
 s.stats.minShotShortfall=Math.min(s.stats.minShotShortfall,
  Math.max(0,Math.abs(goalX-frame.ball.position.x)-SHOT_MAX_RANGE_M));
 s.records.push(Object.freeze({
  tick,ball:Object.freeze({...frame.ball.position}),
  actor:Object.freeze({id:actor.id,team:actor.team,x:actor.x,
   y:actor.y,vx:actor.vx,vy:actor.vy,facingRad:actor.facingRad}),
  shoeGap:foot.estimatedStaticSurfaceClearanceM,
  realForwardSTART:realStarts.some(x=>x.engineId===actor.id),
  source:access?Object.freeze({pass:access.sourcePassTick,
   carry:access.sourceCarryTick}):null,
  lateral:access?.lateralAlignment?.lateralTargetShiftM??null
 }));
 // Provenance is consumed only AFTER this true Rapier step, never
 // from a future position or an invented football event.
 if(act?.action==='pass'){
  s.mover.observeAuthenticFixturePass(act);s.lastPass=act;
  s.lastCarry=null;
 }else if(act?.action==='carry'){
  s.mover.observeAuthenticFixtureCarry(act);s.lastCarry=act;
 }else if(act){
  s.mover.clearFixtureCarryOnOtherAction(act);
  s.lastCarry=null;
 }
 for(const id of frame.footContact.ended)
  s.mover.observeAuthenticFixtureCarryShoeEnd(id,tick);
 return frame;
}
function reportHorizon(s,anchorTick,horizon){
 const start=s.records[anchorTick-1];
 const end=s.records[anchorTick+horizon-1];
 assert.equal(start.tick,anchorTick);
 assert.equal(end.tick,anchorTick+horizon);
 assert.ok(start.source,'only authentic prior PASS→CARRY support is studied');
 const bound=optimisticEnvelope(start.actor,end.ball,horizon);
 const actualTravel=s.records.slice(anchorTick,anchorTick+horizon)
  .reduce((sum,record,i)=>{
   const prev=s.records[anchorTick+i-1];
   return sum+dist(record.actor,prev.actor);
  },0);
 const realStarts=s.records.slice(anchorTick,anchorTick+horizon)
  .filter(r=>r.realForwardSTART).map(r=>r.tick);
 assert.ok(actualTravel<=PLAYER_MAX_SPEED_MPS*PLAYER_DT*horizon+1e-4);
 assert.ok(actualTravel<=bound.upperBodyTravelM+1e-4,
  'actual Rapier/witness path must be inside speed/acceleration envelope');
 return {
  fromTick:anchorTick,toTick:end.tick,horizonTicks:horizon,
  passSourceTick:start.source.pass,carrySourceTick:start.source.carry,
  preShoeStaticGapM:R3(start.shoeGap),
  measuredFutureBallDisplacementM:R3(dist(start.ball,end.ball)),
  actualBodyTravelM:R3(actualTravel),
  actualEndShoeStaticGapM:R3(end.shoeGap),
  optimisticNecessaryBodyTravelM:R3(bound.necessaryBodyTravelLowerM),
  optimisticMaxBodyTravelM:R3(bound.upperBodyTravelM),
  speedBoundAllowsContact:bound.speedBoundAllowsContact,
  fixedBodyRequiredTurnRad:R3(bound.requiredFixedBodyBearingTurnRad),
  maximalTurnRad:R3(bound.maxPossibleTurnRad),
  fixedBodyTurnBoundAllowsFacing:bound.fixedBodyTurnBoundAllowsFacing,
  actualNewForwardShoeStarts:realStarts,
  genuineContactObserved:realStarts.length>0,
  contactInferred:false,shotInferred:false
 };
}
test('C2.3t pure retrospective lower/upper kinematic envelope rejects forged samples',()=>{
 const p={x:0,y:0,vx:0,vy:0,facingRad:0};
 const b={x:0.5,y:0,z:0};
 const e=optimisticEnvelope(p,b,12);
 assert.ok(e.upperBodyTravelM>0);
 assert.equal(e.fixedBodyTurnBoundAllowsFacing,true);
 assert.equal(e.actualRapierContactInferred,false);
 assert.equal(e.shotInferred,false);
 for(const [actor,ball,horizon] of [
  [p,b,0],[p,b,31],[{...p,x:NaN},b,6],
  [{...p,vx:99},b,6],[p,{...b,z:-1},6],
  [p,{...b,y:Infinity},6]
 ])assert.throws(()=>optimisticEnvelope(actor,ball,horizon));
});
test('C2.3t real 720-tick HOME/AWAY physical future-ball turn feasibility + separate replay',async()=>{
 const R=await initializeRapier(rapier),reports=[];
 for(const c of CASES){
  const studies=['access','aligned'].map(mode=>make(R,c,mode));
  const independent=c.team==='away'?
   createPhysicalFixtureStepRuntime(R,fixture(c),initial(c),
    OPT.aligned):null;
  let firstPhysicalDiff=null;
  try{
   for(let t=1;t<=N;t++){
    const frames=studies.map(s=>verifyAndRecord(s,c));
    assert.equal(frames[0].physicsTick,t);
    const same=JSON.stringify(frames[0].ball)===
     JSON.stringify(frames[1].ball)&&
     JSON.stringify(frames[0].physicalPlayerPositions)===
     JSON.stringify(frames[1].physicalPlayerPositions);
    if(!same&&firstPhysicalDiff===null)firstPhysicalDiff=t;
    if(firstPhysicalDiff===null){
     assert.deepEqual(frames[0].physicalContactFeed,
      frames[1].physicalContactFeed);
     assert.deepEqual(frames[0].localAutonomousAction,
      frames[1].localAutonomousAction);
    }
    if(independent){
     const replay=independent.step();
     assert.deepEqual(frames[1].ball,replay.ball);
     assert.deepEqual(frames[1].physicalPlayerPositions,
      replay.physicalPlayerPositions);
     assert.deepEqual(frames[1].physicalContactFeed,
      replay.physicalContactFeed);
     assert.deepEqual(frames[1].localAutonomousAction,
      replay.localAutonomousAction);
    }
   }
   const [access,aligned]=studies;
   assert.equal(access.records.length,N);
   assert.equal(aligned.records.length,N);
   assert.equal(aligned.stats.naturalShots.length,0);
   if(c.team==='home'){
    assert.equal(firstPhysicalDiff,null);
    assert.equal(access.stats.sourceAccessFrames,0);
    assert.equal(aligned.stats.sourceAccessFrames,0);
    assert.deepEqual(access.stats.actions,aligned.stats.actions);
   }else{
    assert.equal(firstPhysicalDiff,635);
    assert.equal(access.stats.sourceAccessFrames,60);
    assert.equal(aligned.stats.sourceAccessFrames,60);
    assert.equal(access.stats.forwardStarts,0);
    assert.equal(aligned.stats.forwardStarts,0);
    for(const s of studies){
     assert.equal(s.stats.starts,16);
     for(const tick of ANCHORS){
      const record=s.records[tick-1];
      assert.ok(record.source,'anchor must remain genuine carry-bound');
      assert.equal(record.source.pass,292);
      assert.ok(record.source.carry>=546&&record.source.carry<tick);
     }
    }
   }
   const windows=c.team==='away'?studies.map(s=>({
    mode:s.mode,windows:ANCHORS.flatMap(t=>
     HORIZONS.map(h=>reportHorizon(s,t,h)))
   })):[];
   reports.push({
    team:c.team,firstAccessVsAlignedPhysicalDiff:firstPhysicalDiff,
    sourceAccessFrames:studies.map(s=>({
     mode:s.mode,count:s.stats.sourceAccessFrames})),
    genuineShoeSTARTs:studies.map(s=>({
     mode:s.mode,count:s.stats.starts,
     forward:s.stats.forwardStarts})),
    genuineShots:studies.map(s=>s.stats.naturalShots.length),
    shotZoneShortfallsM:studies.map(s=>R3(s.stats.minShotShortfall)),
    windows
   });
  }finally{
   for(const s of studies)s.engine.dispose();
   independent?.dispose();
  }
 }
 console.log('C2_3T_REAL_POSTHOC_FOOT_TURN_HORIZON',
  JSON.stringify(reports));
});
