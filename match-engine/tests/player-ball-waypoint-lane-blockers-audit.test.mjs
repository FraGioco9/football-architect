// C2.3p — DEV-only forensic: source-authenticated moving ball, 22 true
// kinematic players, support WAYPOINT, real shoe and actual lane blockers.
// Read-only; never steers a player, applies an impulse, or awards a shot.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,PLAYER_PITCH}
 from '../src/player-movement.mjs';
import {SHOT_MAX_RANGE_M,SHOT_HALF_GOAL_AIM_Y_M}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {measureOrientedCarryShoeBallGeometry}
 from '../src/player-ball-carry-oriented-shoe-geometry.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const CASES=Object.freeze([
 Object.freeze({team:'home',country:'IT',x:-4.96,vx:0.3}),
 Object.freeze({team:'away',country:'DE',x:4.96,vx:-0.3})
]);
const CHECKS=new Set([546,547,567,599,600,601,640,657,680,
 683,692,693,694,695,700,717,720]);
const MODE=Object.freeze({
 baseline:Object.freeze({autonomousActions:true,autonomousCarry:true,
  autonomousCarrySupport:true}),
 handoff:Object.freeze({autonomousActions:true,autonomousCarry:true,
  autonomousCarrySupport:true,autonomousCarrySupportPressHandoff:true})
});
const rounded=x=>Number(x.toFixed(3));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const fixture=c=>Object.freeze({
 id:'season:1:'+c.country+'-1:N01:'+c.country+'-1:'+c.country+'-2',
 competitionId:c.country+'-1',marker:'N01',day:1,round:1,
 homeClubId:c.country+'-1',awayClubId:c.country+'-2'
});
const scene=c=>Object.freeze({
 preset:'roll',seed:'c2-3e-natural-physical-'+c.team+'-'+c.country,
 x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
});
function blocker(segmentStart,segmentEnd,team,players){
 const sx=segmentEnd.x-segmentStart.x;
 const sy=segmentEnd.y-segmentStart.y;
 const length2=sx*sx+sy*sy;
 assert.ok(length2>0);
 const blockers=players.filter(p=>p.team!==team).map(p=>{
  const fraction=Math.max(0,Math.min(1,
   ((p.x-segmentStart.x)*sx+(p.y-segmentStart.y)*sy)/length2));
  const x=segmentStart.x+fraction*sx;
  const y=segmentStart.y+fraction*sy;
  return {id:p.id,role:p.role,fraction,
   clearanceM:Math.hypot(p.x-x,p.y-y),
   distanceToBallM:dist(p,segmentStart)};
 });
 blockers.sort((a,b)=>a.clearanceM-b.clearanceM||
  INITIAL_PLAYERS.findIndex(p=>p.id===a.id)-
  INITIAL_PLAYERS.findIndex(p=>p.id===b.id));
 return blockers[0];
}
function lanes(ball,team,players){
 const goalX=(team==='home'?1:-1)*PLAYER_PITCH.lengthM/2;
 return [0,-SHOT_HALF_GOAL_AIM_Y_M,SHOT_HALF_GOAL_AIM_Y_M]
  .map(y=>{
   const n=blocker(ball,{x:goalX,y},team,players);
   return Object.freeze({goalY:y,blockerId:n.id,
    blockerRole:n.role,clearanceM:rounded(n.clearanceM),
    projectionFraction:rounded(n.fraction)});
  });
}
function witness(mode){
 return createPlayerMovement({
  experimentalAiKickApproach:true,
  experimentalAutonomousFixtureContactChase:true,
  experimentalAutonomousFixtureCarry:true,
  experimentalAutonomousFixtureCarrySupport:true,
  ...(mode==='handoff'?{
   experimentalAutonomousFixtureCarrySupportPressHandoff:true}:{})
 });
}
function sourceEvent(sidecar,frame){
 const action=frame.localAutonomousAction;
 if(action){
  const starts=frame.physicalContactFeed.started;
  assert.equal(starts.length,1);
  assert.equal(frame.physicalContactFeed.active.length,1);
  assert.equal(starts[0].engineId,action.playerId);
  assert.equal(starts[0].team,action.team);
  assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
  assert.equal(action.appliedByRapier,true);
  assert.equal(action.actualPhysicsImpulseApplied,true);
  assert.equal(action.officialMatchAction,false);
  if(action.action==='pass')sidecar.observeAuthenticFixturePass(action);
  else if(action.action==='carry')sidecar.observeAuthenticFixtureCarry(action);
  else sidecar.clearFixtureCarryOnOtherAction(action);
 }
 for(const id of frame.footContact.ended)
  sidecar.observeAuthenticFixtureCarryShoeEnd(id,frame.physicsTick);
}
function newStudy(R,c,mode){
 return {fixture:createPhysicalFixtureStepRuntime(
  R,fixture(c),scene(c),MODE[mode]),
  sidecar:witness(mode),
  team:c.team,mode,
  stats:{relayFrames:0,unobstructedLaneFrames:0,shooterZoneFrames:0,
   bodyProgressToBall:0,bodyRegressFromBall:0,
   bodyProgressToTarget:0,bodyRegressFromTarget:0,
   ballDistanceMovedM:0,peakBallSpeedMps:0,
   supportTargetDistanceFromPreBallM:[],
   supportTargetDistanceFromPostBallM:[],
   bodyVelocityToBallPositive:0,bodyVelocityToBallNonPositive:0,
   supportBallBehindOrSideFrames:0,
   startCount:0,realActions:[],shotCount:0,
   sample:[],firstRelayTick:null,lastRelayTick:null,
   firstNonRelayAfterStart:null,nearestFootGapFrom600M:Infinity,
   nearestFootGapTick:null,closestLaneClearanceM:Infinity,
   leastObstructedLane:null,nearestObstacleAt693:null},
  hadRelay:false};
}
function inspect(study){
 const {fixture:engine,sidecar,team,stats}=study;
 const before=engine.snapshot(),earlier=sidecar.snapshot();
 const next=before.physicsTick+1;
 assert.equal(earlier.tick,next-1);
 const preBall=before.ball.position;
 const priorActor=earlier.players.find(p=>p.id===team+'-10');
 const moved=sidecar.step(preBall);
 const frame=engine.step();
 const postBall=frame.ball.position;
 assert.equal(frame.physicsTick,next);
 assert.equal(frame.officialMatchResult,null);
 assert.equal(frame.officialMatchPossession,false);
 assert.equal(frame.productionScoringConnected,false);
 assert.equal(moved.tick,next);
 assert.equal(moved.players.length,22);
 assert.equal(frame.physicalPlayerPositions.length,22);
 for(let i=0;i<22;i++){
  const p=moved.players[i],physical=frame.physicalPlayerPositions[i];
  assert.equal(p.id,INITIAL_PLAYERS[i].id);
  assert.equal(physical.engineId,p.id);
  assert.ok(Math.abs(physical.x-p.x)<1e-9);
  assert.ok(Math.abs(physical.y-p.y)<1e-9);
 }
 const actor=moved.players.find(p=>p.id===team+'-10');
 assert.ok(priorActor&&actor);
 const foot=measureOrientedCarryShoeBallGeometry(actor,postBall);
 assert.equal(foot.actualRapierCollisionInferred,false);
 assert.equal(foot.officialMatchPossession,false);
 const ballDelta=dist(preBall,postBall);
 stats.ballDistanceMovedM+=ballDelta;
 stats.peakBallSpeedMps=Math.max(stats.peakBallSpeedMps,
  ballDelta*60);
 const goalX=(team==='home'?1:-1)*PLAYER_PITCH.lengthM/2;
 const gapToShot=Math.max(0,Math.abs(goalX-postBall.x)-
  SHOT_MAX_RANGE_M);
 if(gapToShot===0&&Math.abs(postBall.y)<=20)stats.shooterZoneFrames++;
 const allLanes=lanes(postBall,team,moved.players);
 const best=allLanes.reduce((a,b)=>a.clearanceM>b.clearanceM?a:b);
 if(best.clearanceM>=2.4)stats.unobstructedLaneFrames++;
 const closest=allLanes.reduce((a,b)=>a.clearanceM<b.clearanceM?a:b);
 stats.closestLaneClearanceM=Math.min(
  stats.closestLaneClearanceM,closest.clearanceM);
 if(!stats.leastObstructedLane||best.clearanceM>
   stats.leastObstructedLane.clearanceM)
  stats.leastObstructedLane={tick:next,...best};
 const run=moved.provisionalAttackSupportRun;
 const relay=run?.team===team&&
  run.phase==='post-carry-support'&&run.playerId===actor.id;
 assert.equal(frame.contactDecisionObservation.attackSupportRun?.playerId??
  null,run?.playerId??null);
 const duty=frame.contactDecisionObservation.duties.find(p=>
  p.engineId===actor.id)?.movementDuty;
 if(relay){
  stats.relayFrames++;
  if(stats.firstRelayTick===null)stats.firstRelayTick=next;
  stats.lastRelayTick=next;
  assert.equal(duty,'attack-support-intent');
  assert.equal(run.officialMatchResult,null);
  assert.equal(run.shotExecuted,false);
  const targetPre=dist(run.target,preBall);
  const targetPost=dist(run.target,postBall);
  stats.supportTargetDistanceFromPreBallM.push(targetPre);
  stats.supportTargetDistanceFromPostBallM.push(targetPost);
  // Existing post-CARRY waypoint is 2m forward and 2.5m lateral,
  // never a target for a Rapier shoe START.
  assert.ok(Math.abs(targetPre-Math.hypot(2,2.5))<1e-7,
   'support waypoint is intentionally off-ball, not a real kick target');
  if(dist(actor,run.target)<dist(priorActor,run.target))
   stats.bodyProgressToTarget++;
  else stats.bodyRegressFromTarget++;
  const vx=actor.x-priorActor.x,vy=actor.y-priorActor.y;
  const bx=preBall.x-priorActor.x,by=preBall.y-priorActor.y;
  if(vx*bx+vy*by>0)stats.bodyVelocityToBallPositive++;
  else stats.bodyVelocityToBallNonPositive++;
  if(foot.relativeBallForwardM<=0||
     Math.abs(foot.relativeBallLateralM)>=0.75)
   stats.supportBallBehindOrSideFrames++;
 }
 if(study.hadRelay&&!relay&&stats.firstNonRelayAfterStart===null)
  stats.firstNonRelayAfterStart=next;
 study.hadRelay=Boolean(relay);
 if(next>=600){
  if(dist(actor,postBall)<dist(priorActor,preBall))
   stats.bodyProgressToBall++;
  else stats.bodyRegressFromBall++;
  if(foot.estimatedStaticSurfaceClearanceM<
     stats.nearestFootGapFrom600M){
   stats.nearestFootGapFrom600M=
    foot.estimatedStaticSurfaceClearanceM;
   stats.nearestFootGapTick=next;
  }
 }
 const starts=frame.physicalContactFeed.started;
 stats.startCount+=starts.length;
 if(frame.localAutonomousAction){
  const action=frame.localAutonomousAction;
  stats.realActions.push({tick:next,id:action.playerId,
   team:action.team,action:action.action});
  if(action.action==='shot')stats.shotCount++;
 }
 if(CHECKS.has(next)){
  const target=relay?run.target:null;
  const info=Object.freeze({
   tick:next,
   ball:Object.freeze({x:rounded(postBall.x),y:rounded(postBall.y)}),
   ballDeltaM:rounded(ballDelta),
   ballZoneShortfallM:rounded(gapToShot),
   actorId:actor.id,duty,
   support:relay,
   target:target?Object.freeze({
    x:rounded(target.x),y:rounded(target.y),
    distanceFromPreBallM:rounded(dist(target,preBall)),
    distanceFromPostBallM:rounded(dist(target,postBall)),
    distanceFromActorM:rounded(dist(target,actor))}):null,
   actualBodyBallM:rounded(dist(actor,postBall)),
   actualFootStaticGapM:rounded(
    foot.estimatedStaticSurfaceClearanceM),
   shoeForwardM:rounded(foot.relativeBallForwardM),
   shoeLateralM:rounded(foot.relativeBallLateralM),
   facingRad:rounded(foot.actualFacingRad),
   physicalBlockerId:actor.blockedBy??null,
   allLanes:Object.freeze(allLanes),
   bestLane:Object.freeze(best),
   actualStartedShoes:Object.freeze(starts.map(s=>s.engineId)),
   actualAction:frame.localAutonomousAction?
    Object.freeze({id:frame.localAutonomousAction.playerId,
     action:frame.localAutonomousAction.action}):null,
   observerCanNeverAwardContactOrGoal:true
  });
  stats.sample.push(info);
 }
 sourceEvent(sidecar,frame);
 return frame;
}
function summarize(study){
 const s=study.stats;
 const mean=arr=>arr.length?
  rounded(arr.reduce((a,b)=>a+b,0)/arr.length):null;
 return Object.freeze({
  team:study.team,mode:study.mode,
  relayFrames:s.relayFrames,
  supportTicks:Object.freeze({
   first:s.firstRelayTick,last:s.lastRelayTick,
   ended:s.firstNonRelayAfterStart}),
  meanWaypointDistanceFromPreBallM:
   mean(s.supportTargetDistanceFromPreBallM),
  meanWaypointDistanceFromPostBallM:
   mean(s.supportTargetDistanceFromPostBallM),
  supportCloserToTargetTicks:s.bodyProgressToTarget,
  supportNotCloserToTargetTicks:s.bodyRegressFromTarget,
  supportVelocityTowardPreBallTicks:
   s.bodyVelocityToBallPositive,
  supportVelocityAwayOrPerpendicularTicks:
   s.bodyVelocityToBallNonPositive,
  supportShoeBehindOrLateralTicks:
   s.supportBallBehindOrSideFrames,
  bodyBallGapShrinksPost600Ticks:s.bodyProgressToBall,
  bodyBallGapNotShrinkingPost600Ticks:s.bodyRegressFromBall,
  nearestFootGapFromTick600M:rounded(s.nearestFootGapFrom600M),
  nearestFootGapTick:s.nearestFootGapTick,
  ballDistanceTraveledM:rounded(s.ballDistanceMovedM),
  peakBallStepSpeedMps:rounded(s.peakBallSpeedMps),
  shotZoneFrames:s.shooterZoneFrames,
  geometricallyUnobstructedLaneFrames:s.unobstructedLaneFrames,
  maximumGoalLaneClearance:s.leastObstructedLane,
  shoeStarts:s.startCount,actions:s.realActions,
  naturalShots:s.shotCount,
  samples:s.sample.filter(x=>[547,599,600,601,640,657,
   680,683,693,694,695,720].includes(x.tick))
 });
}
test('C2.3p HOME/AWAY true Rapier waypoint-vs-live-ball trajectory and goal-lane blocking A/B',async()=>{
 const R=await initializeRapier(rapier),data=[];
 for(const c of CASES){
  const baseline=newStudy(R,c,'baseline');
  const handoff=newStudy(R,c,'handoff');
  let changed=null;
  try{
   assert.deepEqual(baseline.fixture.snapshot().ball,
    handoff.fixture.snapshot().ball);
   for(let tick=1;tick<=720;tick++){
    const a=inspect(baseline),b=inspect(handoff);
    assert.equal(a.physicsTick,tick);
    assert.equal(b.physicsTick,tick);
    const equal=JSON.stringify(a.ball)===JSON.stringify(b.ball)&&
     JSON.stringify(a.physicalPlayerPositions)===
      JSON.stringify(b.physicalPlayerPositions);
    if(!equal&&changed===null)changed=tick;
    if(changed===null){
     assert.deepEqual(a.physicalContactFeed,b.physicalContactFeed);
     assert.deepEqual(a.localAutonomousAction,b.localAutonomousAction);
    }
   }
   assert.deepEqual(baseline.stats.sample.map(s=>s.tick),[...CHECKS]);
   assert.deepEqual(handoff.stats.sample.map(s=>s.tick),[...CHECKS]);
   assert.equal(baseline.stats.shotCount,0);
   assert.equal(handoff.stats.shotCount,0);
   if(c.team==='home'){
    assert.equal(changed,null);
    assert.equal(handoff.stats.relayFrames,0);
    assert.equal(baseline.stats.relayFrames,0);
    assert.deepEqual(summarize(baseline).actions,
     summarize(handoff).actions);
   }else{
    assert.equal(changed,600);
    assert.equal(baseline.stats.relayFrames,53);
    assert.equal(handoff.stats.relayFrames,148);
    assert.equal(handoff.stats.firstRelayTick,547);
    assert.equal(baseline.stats.firstNonRelayAfterStart,600);
    assert.equal(handoff.stats.firstNonRelayAfterStart,695);
    assert.equal(baseline.stats.shooterZoneFrames,0);
    assert.equal(handoff.stats.shooterZoneFrames,0);
    assert.equal(baseline.stats.startCount,16);
    assert.equal(handoff.stats.startCount,16);
    assert.equal(baseline.stats.unobstructedLaneFrames,9);
    assert.equal(handoff.stats.unobstructedLaneFrames,0);
    const old=baseline.stats.sample.find(x=>x.tick===693);
    const now=handoff.stats.sample.find(x=>x.tick===693);
    assert.ok(now.actualBodyBallM<old.actualBodyBallM);
    assert.ok(now.actualFootStaticGapM<old.actualFootStaticGapM);
    assert.equal(now.support,true);
    assert.equal(old.support,false);
    assert.equal(now.bestLane.clearanceM,0.225);
    assert.equal(now.actualStartedShoes.length,0);
    const p=baseline.stats.sample.find(x=>x.tick===694);
    const q=handoff.stats.sample.find(x=>x.tick===694);
    assert.deepEqual(p.actualAction,{id:'home-7',action:'pass'});
    assert.deepEqual(q.actualAction,{id:'home-7',action:'carry'});
   }
   data.push(Object.freeze({
    team:c.team,firstPhysicalDivergenceTick:changed,
    baseline:summarize(baseline),handoff:summarize(handoff)
   }));
  }finally{baseline.fixture.dispose();handoff.fixture.dispose();}
 }
 console.log('C2_3P_AUTHENTIC_WAYPOINT_BALL_LANE_BLOCKERS',
  JSON.stringify(data));
});
