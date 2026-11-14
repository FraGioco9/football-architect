// C2.3o — physical shot-range / lane / oriented-shoe triage, NO new AI.
// Independent witness movers reproduce every Rapier kinematic shoe pose.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_PITCH,createPlayerMovement}
 from '../src/player-movement.mjs';
import {SHOT_MAX_RANGE_M,SHOT_HALF_GOAL_AIM_Y_M}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {measureOrientedCarryShoeBallGeometry}
 from '../src/player-ball-carry-oriented-shoe-geometry.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const TICKS=720;
const SHOT_LANE_CLEARANCE_M=2.4; // Exact current closed policy threshold
const CHECKS=new Set([292,532,533,546,547,567,599,600,601,
 620,640,680,692,693,694,695,700,720]);
const CASES=Object.freeze([
 Object.freeze({team:'home',country:'IT',x:-4.96,vx:0.3}),
 Object.freeze({team:'away',country:'DE',x:4.96,vx:-0.3})
]);
const BASE=Object.freeze({autonomousActions:true,autonomousCarry:true,
 autonomousCarrySupport:true});
const HANDOFF=Object.freeze({...BASE,
 autonomousCarrySupportPressHandoff:true});
const fixture=c=>Object.freeze({
 id:'season:1:'+c.country+'-1:N01:'+c.country+'-1:'+c.country+'-2',
 competitionId:c.country+'-1',marker:'N01',day:1,round:1,
 homeClubId:c.country+'-1',awayClubId:c.country+'-2'
});
const scene=c=>Object.freeze({
 preset:'roll',seed:'c2-3e-natural-physical-'+c.team+'-'+c.country,
 x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
});
const round=n=>Number(n.toFixed(3));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function laneClearance(ball,target,team,players){
 const dx=target.x-ball.x,dy=target.y-ball.y;
 const length2=dx*dx+dy*dy;
 if(length2<=1e-8)return 0;
 return Math.min(...players.filter(p=>p.team!==team).map(p=>{
  const t=Math.max(0,Math.min(1,
   ((p.x-ball.x)*dx+(p.y-ball.y)*dy)/length2));
  return Math.hypot(p.x-ball.x-dx*t,p.y-ball.y-dy*t);
 }));
}
function policyGeometry(team,ball,players){
 const goalX=(team==='home'?1:-1)*PLAYER_PITCH.lengthM/2;
 const signedToGoal=goalX-ball.x;
 // Keep the actual uniform contact policy's ABSOLUTE range check.
 const distanceToGoal=Math.abs(signedToGoal);
 const rangeOK=distanceToGoal<=SHOT_MAX_RANGE_M&&
  Math.abs(ball.y)<=20;
 const targets=[0,-SHOT_HALF_GOAL_AIM_Y_M,SHOT_HALF_GOAL_AIM_Y_M];
 const lanes=targets.map(y=>({
  targetY:y,clearance:laneClearance(ball,{x:goalX,y},team,players)
 }));
 const geometricallyOpenLane=lanes.find(p=>
  p.clearance>=SHOT_LANE_CLEARANCE_M)??null;
 const lane=rangeOK?geometricallyOpenLane:null;
 return Object.freeze({
  goalDistanceM:distanceToGoal,rangeShortfallM:Math.max(0,
   distanceToGoal-SHOT_MAX_RANGE_M),
  lateralInBounds:Math.abs(ball.y)<=20,
  rangeOK,eligibleLaneY:lane?.targetY??null,
  openLane:lane!==null,
  geometricOpenLaneRegardlessOfRange:geometricallyOpenLane!==null,
  geometricOpenLaneY:geometricallyOpenLane?.targetY??null,
  centreLaneClearanceM:lanes[0].clearance,
  bestLaneClearanceM:Math.max(...lanes.map(p=>p.clearance)),
  // No geometry alone authorizes an action.
  realRapierShoeRequired:true,
  geometricEligibilityIsNotFootballAction:true
 });
}
function newSession(R,c,mode){
 const opts=mode==='handoff'?HANDOFF:BASE;
 const runtime=createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),opts);
 const witness=createPlayerMovement({
  experimentalAiKickApproach:true,
  experimentalAutonomousFixtureContactChase:true,
  experimentalAutonomousFixtureCarry:true,
  experimentalAutonomousFixtureCarrySupport:true,
  ...(mode==='handoff'?{
   experimentalAutonomousFixtureCarrySupportPressHandoff:true}: {})
 });
 return {runtime,witness,mode,team:c.team,latestPass:null,latestCarry:null,
  stats:{tickCount:0,shotRangeFrames:0,openShotLaneFrames:0,
   minShotShortfallM:Infinity,minShortfallTick:null,
   geometryOnlyOpenLaneFrames:0,
   minBodyGapFrom600M:Infinity,minBodyGapFrom600Tick:null,
   minShoeClearanceFrom600M:Infinity,minShoeClearanceFrom600Tick:null,
   minStaticShoeClearanceAllFramesM:Infinity,
   authenticStarts:0,authenticActions:[],naturalShots:[],
   supportFrames:0,postCarrySupportFrames:0,
   supportEndedAt:null,checkpoints:[]},previousRelay:false};
}
function inspect(session){
 const {runtime,witness,team,stats}=session;
 const before=runtime.snapshot(),prior=witness.snapshot();
 const tick=before.physicsTick+1;
 assert.equal(prior.tick,tick-1);
 const moved=witness.step(before.ball.position);
 const frame=runtime.step();
 assert.equal(frame.physicsTick,tick);
 assert.equal(moved.tick,tick);
 assert.equal(frame.officialMatchResult,null);
 assert.equal(frame.officialMatchPossession,false);
 assert.equal(frame.productionScoringConnected,false);
 assert.equal(frame.physicalShotBoundary.goalScored,null);
 assert.equal(frame.physicalBallVolumeBoundary.goalScored,null);
 assert.equal(moved.players.length,22);
 for(let i=0;i<22;i++){
  const p=moved.players[i],body=frame.physicalPlayerPositions[i];
  assert.equal(p.id,INITIAL_PLAYERS[i].id);
  assert.equal(body.engineId,p.id);
  assert.equal(body.team,p.team);
  assert.ok(Math.abs(body.x-p.x)<1e-9);
  assert.ok(Math.abs(body.y-p.y)<1e-9);
 }
 const ball=frame.ball.position;
 const teamGeometry=policyGeometry(team,ball,moved.players);
 const priorGeometry=policyGeometry(team,before.ball.position,
  prior.players);
 stats.tickCount++;
 if(teamGeometry.rangeOK)stats.shotRangeFrames++;
 if(teamGeometry.openLane)stats.openShotLaneFrames++;
 if(teamGeometry.geometricOpenLaneRegardlessOfRange)
  stats.geometryOnlyOpenLaneFrames++;
 if(teamGeometry.rangeShortfallM<stats.minShotShortfallM){
  stats.minShotShortfallM=teamGeometry.rangeShortfallM;
  stats.minShortfallTick=tick;
 }
 const support=frame.contactDecisionObservation.attackSupportRun;
 const relay=support?.team===team&&support.phase==='post-carry-support';
 if(support?.team===team)stats.supportFrames++;
 if(relay){
  stats.postCarrySupportFrames++;
  // Genuine support comes strictly from completed earlier shoe events.
  assert.equal(support.sourcePassTick,session.latestPass?.tick);
  assert.equal(support.carryContinuation.sourceCarryTick,
   session.latestCarry?.tick);
  assert.ok(tick>session.latestCarry.tick);
  assert.ok(tick-session.latestCarry.tick<=150);
  assert.ok(tick-session.latestPass.tick<=480);
  assert.equal(support.shotExecuted,false);
 }
 if(session.previousRelay&&!relay&&stats.supportEndedAt===null)
  stats.supportEndedAt=tick;
 session.previousRelay=Boolean(relay);
 const supported=moved.players.find(p=>p.id===team+'-10');
 assert.ok(supported);
 const foot=measureOrientedCarryShoeBallGeometry(supported,ball);
 assert.equal(foot.actualRapierCollisionInferred,false);
 assert.equal(foot.officialMatchPossession,false);
 const bodyGap=foot.bodyBallXYGapM;
 if(foot.estimatedStaticSurfaceClearanceM<
    stats.minStaticShoeClearanceAllFramesM)
  stats.minStaticShoeClearanceAllFramesM=
   foot.estimatedStaticSurfaceClearanceM;
 if(tick>=600){
  if(bodyGap<stats.minBodyGapFrom600M){
   stats.minBodyGapFrom600M=bodyGap;
   stats.minBodyGapFrom600Tick=tick;
  }
  if(foot.estimatedStaticSurfaceClearanceM<
      stats.minShoeClearanceFrom600M){
   stats.minShoeClearanceFrom600M=foot.estimatedStaticSurfaceClearanceM;
   stats.minShoeClearanceFrom600Tick=tick;
  }
 }
 const starts=frame.physicalContactFeed.started;
 stats.authenticStarts+=starts.length;
 for(const contact of starts)assert.ok(frame.physicalContactFeed.active.some(
  p=>p.engineId===contact.engineId&&p.team===contact.team));
 const action=frame.localAutonomousAction;
 if(action){
  assert.equal(starts.length,1);
  assert.equal(frame.physicalContactFeed.active.length,1);
  assert.equal(starts[0].engineId,action.playerId);
  assert.equal(starts[0].team,action.team);
  assert.equal(action.tick,tick);
  assert.equal(action.appliedByRapier,true);
  assert.equal(action.actualPhysicsImpulseApplied,true);
  assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
  assert.equal(action.officialMatchAction,false);
  assert.equal(action.decisionContext.outcomeNotYetObserved,true);
  stats.authenticActions.push(Object.freeze({
   tick,team:action.team,id:action.playerId,kind:action.action,
   actualPolicyShotRange:action.decisionContext.shotRange,
   policyShotLaneClearanceM:round(action.decisionContext.shotLaneClearanceM)
  }));
  if(action.action==='shot'){
   assert.equal(action.decisionContext.shotRange,true);
   assert.equal(action.shotTarget.shooterId,action.playerId);
   assert.equal(action.shotTarget.physicsTick,tick);
   assert.ok(action.shotTarget.laneClearanceM>=SHOT_LANE_CLEARANCE_M);
   stats.naturalShots.push({tick,team:action.team,id:action.playerId});
  }
 }
 const actualDuty=frame.contactDecisionObservation.duties.find(d=>
  d.engineId===supported.id)?.movementDuty;
 if(CHECKS.has(tick)){
  const other=team==='home'?'away':'home';
  const competitor=other+'-7';
  const rival=moved.players.find(p=>p.id===competitor);
  assert.ok(rival&&actualDuty);
  const rivalFoot=measureOrientedCarryShoeBallGeometry(rival,ball);
  const spot=Object.freeze({
   tick,
   ballXY:Object.freeze({x:round(ball.x),y:round(ball.y)}),
   preStepRangeShortfallM:round(priorGeometry.rangeShortfallM),
   postStepRangeShortfallM:round(teamGeometry.rangeShortfallM),
   postStepShotRange:teamGeometry.rangeOK,
   postStepLaneAvailable:teamGeometry.openLane,
   geometricLaneRegardlessOfRange:
    teamGeometry.geometricOpenLaneRegardlessOfRange,
   geometricLaneY:teamGeometry.geometricOpenLaneY,
   postStepCentreLaneClearanceM:round(
    teamGeometry.centreLaneClearanceM),
   postStepBestLaneClearanceM:round(
    teamGeometry.bestLaneClearanceM),
   postStepOpenLaneY:teamGeometry.eligibleLaneY,
   supportedActor:Object.freeze({
    id:supported.id,duty:actualDuty,
    bodyGapM:round(bodyGap),
    shoeStaticGapM:round(foot.estimatedStaticSurfaceClearanceM),
    shoeCentreGapM:round(foot.shoeBallCenter3DGapM),
    facingRad:round(foot.actualFacingRad),
    relativeBallForwardM:round(foot.relativeBallForwardM),
    relativeBallLateralM:round(foot.relativeBallLateralM),
    blockedBy:supported.blockedBy??null,
    attackSupportTarget:support?.playerId===supported.id?
     Object.freeze({x:round(support.target.x),
      y:round(support.target.y)}):null,
    realRapierStart:starts.some(s=>s.engineId===supported.id)
   }),
   rivalActor:Object.freeze({
    id:rival.id,bodyGapM:round(rivalFoot.bodyBallXYGapM),
    shoeStaticGapM:round(rivalFoot.estimatedStaticSurfaceClearanceM),
    realRapierStart:starts.some(s=>s.engineId===rival.id)
   }),
   supportSource:relay?Object.freeze({passTick:support.sourcePassTick,
    carryTick:support.carryContinuation.sourceCarryTick}):null,
   authenticStarted:Object.freeze(starts.map(s=>s.engineId)),
   authenticAction:action?Object.freeze({
    team:action.team,id:action.playerId,kind:action.action,
    shotRange:action.decisionContext.shotRange}):null,
   geometryCannotGrantContactOrShot:true
  });
  stats.checkpoints.push(spot);
 }
 // Feed genuine physics events into the OBSERVATION-ONLY movement witness
 // AFTER this tick's movement, never before or fabricated.
 if(action?.action==='pass'){
  witness.observeAuthenticFixturePass(action);
  session.latestPass=action;session.latestCarry=null;
 }else if(action?.action==='carry'){
  witness.observeAuthenticFixtureCarry(action);
  session.latestCarry=action;
 }else if(action){
  witness.clearFixtureCarryOnOtherAction(action);
  session.latestCarry=null;
 }
 for(const shoeId of frame.footContact.ended)
  witness.observeAuthenticFixtureCarryShoeEnd(shoeId,frame.physicsTick);
 return frame;
}
function report(session){
 const s=session.stats;
 return Object.freeze({
  team:session.team,mode:session.mode,
  shotRangeFrames:s.shotRangeFrames,
  openShotLaneFrames:s.openShotLaneFrames,
  geometricOnlyOpenLaneFrames:s.geometryOnlyOpenLaneFrames,
  minRangeShortfallM:round(s.minShotShortfallM),
  minRangeShortfallTick:s.minShortfallTick,
  minBodyGapFromTick600M:round(s.minBodyGapFrom600M),
  minBodyGapFromTick600Tick:s.minBodyGapFrom600Tick,
  minShoeStaticClearanceFromTick600M:
   round(s.minShoeClearanceFrom600M),
  minShoeStaticClearanceTick:s.minShoeClearanceFrom600Tick,
  authenticShoeStarts:s.authenticStarts,
  naturalShots:s.naturalShots,
  genuineActions:s.authenticActions,
  totalSupportFrames:s.supportFrames,
  postCarrySupportFrames:s.postCarrySupportFrames,
  firstPostCarrySupportEndTick:s.supportEndedAt,
  checkpoints:s.checkpoints.filter(c=>
   [547,567,599,600,601,640,680,692,693,694,695,700,720]
    .includes(c.tick))
 });
}
test('C2.3o real 22-shoe HOME/AWAY A/B: shot boundary, clear lanes, actual oriented shoe accessibility',async()=>{
 const R=await initializeRapier(rapier),data=[];
 assert.equal(SHOT_MAX_RANGE_M,35);
 assert.equal(SHOT_HALF_GOAL_AIM_Y_M,3.1);
 assert.equal(INITIAL_PLAYERS.length,22);
 for(const c of CASES){
  const a=newSession(R,c,'baseline');
  const b=newSession(R,c,'handoff');
  let firstDivergence=null;
  try{
   assert.deepEqual(a.runtime.snapshot().ball,b.runtime.snapshot().ball);
   assert.deepEqual(a.runtime.snapshot().physicalPlayerPositions,
    b.runtime.snapshot().physicalPlayerPositions);
   for(let tick=1;tick<=TICKS;tick++){
    const x=inspect(a),y=inspect(b);
    assert.equal(x.physicsTick,tick);
    assert.equal(y.physicsTick,tick);
    if(firstDivergence===null&&(
     JSON.stringify(x.ball)!==JSON.stringify(y.ball)||
     JSON.stringify(x.physicalPlayerPositions)!==
       JSON.stringify(y.physicalPlayerPositions)))
     firstDivergence=tick;
    if(firstDivergence===null){
     assert.deepEqual(x.physicalContactFeed,y.physicalContactFeed);
     assert.deepEqual(x.localAutonomousAction,y.localAutonomousAction);
    }
   }
   assert.equal(a.stats.tickCount,720);
   assert.equal(b.stats.tickCount,720);
   assert.deepEqual(a.stats.checkpoints.map(x=>x.tick),[...CHECKS]);
   assert.deepEqual(b.stats.checkpoints.map(x=>x.tick),[...CHECKS]);
   assert.equal(a.stats.naturalShots.length,0);
   assert.equal(b.stats.naturalShots.length,0);
   if(c.team==='home'){
    assert.equal(firstDivergence,null);
    assert.equal(a.stats.postCarrySupportFrames,0);
    assert.equal(b.stats.postCarrySupportFrames,0);
    assert.equal(a.stats.minShotShortfallM,
     b.stats.minShotShortfallM);
   }else{
    assert.equal(firstDivergence,600);
    assert.equal(a.stats.postCarrySupportFrames,53);
    assert.equal(b.stats.postCarrySupportFrames,148);
    assert.ok(Math.abs(a.stats.minShotShortfallM-0.681)<0.002);
    assert.equal(a.stats.minShotShortfallM,b.stats.minShotShortfallM);
    assert.equal(a.stats.shotRangeFrames,0);
    assert.equal(b.stats.shotRangeFrames,0);
    assert.ok(distance(
     a.runtime.snapshot().physicalPlayerPositions.find(p=>p.engineId==='away-10'),
     b.runtime.snapshot().physicalPlayerPositions.find(p=>p.engineId==='away-10')
    )>0);
    const near=a.stats.checkpoints.find(p=>p.tick===693);
    const improved=b.stats.checkpoints.find(p=>p.tick===693);
    assert.ok(improved.supportedActor.bodyGapM<
      near.supportedActor.bodyGapM);
    assert.equal(near.supportedActor.realRapierStart,false);
    assert.equal(improved.supportedActor.realRapierStart,false);
    const oldAction=a.stats.authenticActions.find(p=>p.tick===694);
    const newAction=b.stats.authenticActions.find(p=>p.tick===694);
    assert.deepEqual({id:oldAction?.id,kind:oldAction?.kind},
     {id:'home-7',kind:'pass'});
    assert.deepEqual({id:newAction?.id,kind:newAction?.kind},
     {id:'home-7',kind:'carry'});
   }
   data.push(Object.freeze({
    team:c.team,firstPhysicalDivergenceTick:firstDivergence,
    baseline:report(a),handoff:report(b),
    delta:Object.freeze({
     postCarrySupportFrames:b.stats.postCarrySupportFrames-
      a.stats.postCarrySupportFrames,
     shotRangeFrames:b.stats.shotRangeFrames-a.stats.shotRangeFrames,
     openShotLaneFrames:b.stats.openShotLaneFrames-
      a.stats.openShotLaneFrames,
     geometryOnlyOpenLaneFrames:b.stats.geometryOnlyOpenLaneFrames-
      a.stats.geometryOnlyOpenLaneFrames,
     minShoeGapFrom600M:round(b.stats.minShoeClearanceFrom600M-
      a.stats.minShoeClearanceFrom600M),
     authenticStarts:b.stats.authenticStarts-a.stats.authenticStarts,
     realShots:b.stats.naturalShots.length-a.stats.naturalShots.length
    })
   }));
  }finally{a.runtime.dispose();b.runtime.dispose();}
 }
 console.log('C2_3O_REAL_SHOT_RANGE_LANE_SHOE_DIAGNOSIS',
  JSON.stringify(data));
});
