// C2.3r: physical-only forensic of actual oriented shoe MISS geometry.
// It never modifies AI/physics, infers contacts or awards a football action.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,BALL_RADIUS} from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_MAX_SPEED_MPS,PLAYER_MIN_SEPARATION_M,
 PLAYER_PITCH,createPlayerMovement} from '../src/player-movement.mjs';
import {footProxyTransform,FOOT_CONTACT_HALF_LENGTH_M,
 FOOT_CONTACT_HALF_WIDTH_M,FOOT_CONTACT_HALF_HEIGHT_M,
 FOOT_CONTACT_ROUNDING_M} from '../src/player-foot-contact.mjs';
import {measureOrientedCarryShoeBallGeometry}
 from '../src/player-ball-carry-oriented-shoe-geometry.mjs';
import {SHOT_MAX_RANGE_M}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const STEPS=720;
const TICKS=new Set([546,547,567,599,600,630,635,640,
 645,650,655,657,660,662,664,665,667,670,675,680,683,693,694,695,720]);
const CASES=Object.freeze([
 Object.freeze({team:'home',country:'IT',x:-4.96,vx:0.3}),
 Object.freeze({team:'away',country:'DE',x:4.96,vx:-0.3})
]);
const BASE=Object.freeze({autonomousActions:true,autonomousCarry:true,
 autonomousCarrySupport:true});
const CONFIG=Object.freeze({
 baseline:BASE,
 handoff:Object.freeze({...BASE,autonomousCarrySupportPressHandoff:true}),
 access:Object.freeze({...BASE,autonomousCarrySupportPressHandoff:true,
  autonomousCarrySupportBallAccess:true})
});
const r=x=>Number(x.toFixed(3));
const dst=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const fix=c=>Object.freeze({
 id:'season:1:'+c.country+'-1:N01:'+c.country+'-1:'+c.country+'-2',
 competitionId:c.country+'-1',marker:'N01',day:1,round:1,
 homeClubId:c.country+'-1',awayClubId:c.country+'-2'
});
const seed=c=>Object.freeze({
 preset:'roll',seed:'c2-3e-natural-physical-'+c.team+'-'+c.country,
 x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
});
function make(R,c,mode){
 const engine=createPhysicalFixtureStepRuntime(R,fix(c),seed(c),
  CONFIG[mode]);
 const witness=createPlayerMovement({
  experimentalAiKickApproach:true,
  experimentalAutonomousFixtureContactChase:true,
  experimentalAutonomousFixtureCarry:true,
  experimentalAutonomousFixtureCarrySupport:true,
  ...(mode!=='baseline'?{
   experimentalAutonomousFixtureCarrySupportPressHandoff:true}:{}),
  ...(mode==='access'?{
   experimentalAutonomousFixtureCarrySupportBallAccess:true}:{})
 });
 return {engine,witness,team:c.team,mode,lastPass:null,lastCarry:null,
  stats:{physicalShoeStarts:0,forwardPostFirstShoeStarts:0,
   trueActions:[],naturalShots:[],relayTicks:0,ballAccessTicks:0,
   minStaticGapFrom600M:Infinity,minTick:null,
   actorGuardStallsFrom600:0,actorObservedGuardBelowMin:0,
   candidateNearWindowFrames:0,candidateFootLateralBeyondFrames:0,
   candidateFootForwardBeyondFrames:0,
   candidateFootVerticalBeyondFrames:0,
   captured:[],firstAccessTick:null,ballInShotRangeFrames:0,
   minShotShortfallM:Infinity}};
}
function nearest(players,actor,team){
 const all=players.filter(p=>p.id!==actor.id&&
  (team==='same'?p.team===actor.team:p.team!==actor.team))
  .map(p=>({id:p.id,team:p.team,role:p.role,dist:dst(p,actor)}));
 all.sort((a,b)=>a.dist-b.dist||
  INITIAL_PLAYERS.findIndex(p=>p.id===a.id)-
  INITIAL_PLAYERS.findIndex(p=>p.id===b.id));
 assert.ok(all.length>0);
 return all[0];
}
// Independently decompose the shoe-local rounded-cuboid + actual ball
// sphere distance, which is an estimate, NEVER a Rapier START verdict.
function decompose(actor,ball){
 const phys=measureOrientedCarryShoeBallGeometry(actor,ball);
 const foot=footProxyTransform(actor),prev=Math.cos(actor.facingRad),
  sin=Math.sin(actor.facingRad);
 const dx=ball.x-foot.x,dy=ball.y-foot.y,dz=ball.z-foot.z;
 const f=dx*prev+dy*sin,l=-dx*sin+dy*prev;
 const excessF=Math.max(0,Math.abs(f)-FOOT_CONTACT_HALF_LENGTH_M);
 const excessL=Math.max(0,Math.abs(l)-FOOT_CONTACT_HALF_WIDTH_M);
 const excessV=Math.max(0,Math.abs(dz)-FOOT_CONTACT_HALF_HEIGHT_M);
 const effectiveReach=FOOT_CONTACT_ROUNDING_M+BALL_RADIUS;
 const remainder=Math.max(0,Math.hypot(excessF,excessL,excessV)-
  effectiveReach);
 assert.ok(Math.abs(phys.estimatedStaticSurfaceClearanceM-remainder)<1e-9);
 assert.ok(Math.abs(phys.relativeBallForwardM-f)<1e-9);
 assert.ok(Math.abs(phys.relativeBallLateralM-l)<1e-9);
 assert.ok(Math.abs(phys.relativeBallVerticalM-dz)<1e-9);
 assert.ok(Math.abs(phys.shoeCenter.x-foot.x)<1e-9);
 assert.ok(Math.abs(phys.shoeCenter.y-foot.y)<1e-9);
 assert.ok(Math.abs(phys.shoeCenter.z-foot.z)<1e-9);
 assert.equal(phys.actualRapierCollisionInferred,false);
 assert.equal(phys.officialMatchPossession,false);
 const primary=excessF>=excessL&&excessF>=excessV?
  'forward':excessL>=excessV?'lateral':'vertical';
 return {phys,foot,raw:{forward:f,lateral:l,vertical:dz},
  excess:{forward:excessF,lateral:excessL,vertical:excessV},
  primary,effectiveReach,staticGap:remainder};
}
function sample(st,frame,move,previous,priorBall){
 const {stats,team,mode}=st,t=frame.physicsTick;
 const actor=move.players.find(p=>p.id===team+'-10');
 const before=previous.players.find(p=>p.id===actor.id);
 const ball=frame.ball.position;
 assert.ok(actor&&before);
 const foot=decompose(actor,ball);
 const prior=decompose(before,priorBall);
 const nearMate=nearest(move.players,actor,'same');
 const nearRival=nearest(move.players,actor,'opposite');
 const carrier=move.players.find(p=>p.id===team+'-9');
 assert.ok(carrier);
 const actual=frame.physicalContactFeed;
 assert.equal(actual.physicsTick,t);
 const started=actual.started.some(p=>p.engineId===actor.id);
 const active=actual.active.some(p=>p.engineId===actor.id);
 const ended=actual.ended.some(p=>p.engineId===actor.id);
 const support=move.provisionalAttackSupportRun;
 const relay=support?.team===team&&support.phase==='post-carry-support'&&
  support.playerId===actor.id;
 const access=move.provisionalCarrySupportBallAccess??null;
 if(mode==='access')
  assert.equal(Object.hasOwn(move,'provisionalCarrySupportBallAccess'),true);
 else
  assert.equal(Object.hasOwn(move,'provisionalCarrySupportBallAccess'),false);
 if(relay){
  stats.relayTicks++;
  assert.equal(support.sourcePassTick,st.lastPass?.tick);
  assert.equal(support.carryContinuation.sourceCarryTick,st.lastCarry?.tick);
  assert.ok(st.lastPass.tick<st.lastCarry.tick&&st.lastCarry.tick<t);
  assert.ok(t-st.lastCarry.tick<=150);
 }
 if(access){
  stats.ballAccessTicks++;
  if(stats.firstAccessTick===null)stats.firstAccessTick=t;
  assert.equal(mode,'access');
  assert.ok(relay);
  assert.ok(access.bodyBallGapM<=4);
  assert.equal(access.sourcePassTick,st.lastPass.tick);
  assert.equal(access.sourceCarryTick,st.lastCarry.tick);
  assert.equal(access.movementIntentOnly,true);
  assert.equal(access.footballActionExecuted,false);
  assert.equal(access.officialMatchPossession,false);
 }
 if(t>1&&started)stats.forwardPostFirstShoeStarts++;
 if(t>=600){
  if(actor.blockedBy)stats.actorGuardStallsFrom600++;
  if(nearMate.dist<PLAYER_MIN_SEPARATION_M-1e-5)
   stats.actorObservedGuardBelowMin++;
  if(foot.staticGap<stats.minStaticGapFrom600M){
   stats.minStaticGapFrom600M=foot.staticGap;stats.minTick=t;
  }
 }
 if(t>=635&&t<=675){
  stats.candidateNearWindowFrames++;
  if(foot.excess.lateral>0)stats.candidateFootLateralBeyondFrames++;
  if(foot.excess.forward>0)stats.candidateFootForwardBeyondFrames++;
  if(foot.excess.vertical>0)stats.candidateFootVerticalBeyondFrames++;
 }
 const goal=(team==='home'?1:-1)*PLAYER_PITCH.lengthM/2;
 const shortfall=Math.max(0,Math.abs(goal-ball.x)-SHOT_MAX_RANGE_M);
 stats.minShotShortfallM=Math.min(stats.minShotShortfallM,shortfall);
 if(shortfall===0&&Math.abs(ball.y)<=20)stats.ballInShotRangeFrames++;
 stats.physicalShoeStarts+=actual.started.length;
 for(const start of actual.started)
  assert.ok(actual.active.some(p=>p.engineId===start.engineId&&
   p.team===start.team));
 if(frame.localAutonomousAction){
  const action=frame.localAutonomousAction;
  assert.equal(actual.started.length,1);
  assert.equal(actual.active.length,1);
  assert.equal(actual.started[0].engineId,action.playerId);
  assert.equal(action.tick,t);
  assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
  assert.equal(action.appliedByRapier,true);
  assert.equal(action.actualPhysicsImpulseApplied,true);
  assert.equal(action.officialMatchAction,false);
  const rec=Object.freeze({tick:t,actor:action.playerId,
   team:action.team,action:action.action,
   shotRange:action.decisionContext.shotRange});
  stats.trueActions.push(rec);
  if(action.action==='shot'){
   assert.equal(action.shotTarget.shooterId,action.playerId);
   assert.equal(action.shotTarget.physicsTick,t);
   stats.naturalShots.push(rec);
  }
 }
 if(TICKS.has(t)){
  const curr=foot.phys;
  stats.captured.push(Object.freeze({
   tick:t,mode,team,
   physicalBall:Object.freeze({x:r(ball.x),y:r(ball.y),z:r(ball.z)}),
   physicalBallMovementM:r(dst(ball,priorBall)),
   actor:Object.freeze({id:actor.id,role:actor.role,duty:
    frame.contactDecisionObservation.duties.find(d=>
     d.engineId===actor.id)?.movementDuty,
    x:r(actor.x),y:r(actor.y),
    headingRad:r(actor.facingRad),
    actualMoveStepM:r(dst(before,actor)),
    blockedBy:actor.blockedBy??null,
    nearestTeammateId:nearMate.id,
    nearestTeammateDistanceM:r(nearMate.dist),
    nearestOpponentId:nearRival.id,
    nearestOpponentDistanceM:r(nearRival.dist),
    actualCarrierId:carrier.id,
    distanceToActualCarrierM:r(dst(actor,carrier))}),
   sourceSupport:relay,
   authenticatedBallAccess:Boolean(access),
   shoe:Object.freeze({
    center:Object.freeze({x:r(foot.foot.x),y:r(foot.foot.y),
     z:r(foot.foot.z)}),
    worldCenterGap3dM:r(curr.shoeBallCenter3DGapM),
    bodyBallGapM:r(curr.bodyBallXYGapM),
    localForwardM:r(foot.raw.forward),
    localLateralM:r(foot.raw.lateral),
    localVerticalM:r(foot.raw.vertical),
    beyondForwardHalfBoxM:r(foot.excess.forward),
    beyondLateralHalfBoxM:r(foot.excess.lateral),
    beyondVerticalHalfBoxM:r(foot.excess.vertical),
    effectiveRoundPlusBallRadiusM:r(foot.effectiveReach),
    primaryMissAxis:foot.primary,
    staticClearanceM:r(foot.staticGap),
    priorTickStaticClearanceM:r(prior.staticGap),
    withinStepGapChangeM:r(foot.staticGap-prior.staticGap),
    realRapierStart:started,realRapierActive:active,
    realRapierEnd:ended}),
   realFootStarts:Object.freeze(actual.started.map(p=>p.engineId)),
   genuineFootballAction:frame.localAutonomousAction?
    Object.freeze({actor:frame.localAutonomousAction.playerId,
     action:frame.localAutonomousAction.action}):null,
   ballShotRangeShortfallM:r(shortfall),
   noGeometricContactInference:true
  }));
 }
 const action=frame.localAutonomousAction;
 if(action?.action==='pass'){
  st.witness.observeAuthenticFixturePass(action);st.lastPass=action;
  st.lastCarry=null;
 }else if(action?.action==='carry'){
  st.witness.observeAuthenticFixtureCarry(action);st.lastCarry=action;
 }else if(action){
  st.witness.clearFixtureCarryOnOtherAction(action);st.lastCarry=null;
 }
 for(const id of frame.footContact.ended)
  st.witness.observeAuthenticFixtureCarryShoeEnd(id,t);
}
function execute(st){
 const prev=st.engine.snapshot(),w0=st.witness.snapshot();
 assert.equal(prev.physicsTick+1,w0.tick+1);
 const moved=st.witness.step(prev.ball.position);
 const frame=st.engine.step();
 assert.equal(moved.tick,frame.physicsTick);
 assert.equal(frame.officialMatchResult,null);
 assert.equal(frame.officialMatchPossession,false);
 assert.equal(frame.productionScoringConnected,false);
 assert.equal(moved.players.length,22);
 assert.equal(frame.physicalPlayerPositions.length,22);
 for(let j=0;j<22;j++){
  const p=moved.players[j],physics=frame.physicalPlayerPositions[j];
  assert.equal(p.id,INITIAL_PLAYERS[j].id);
  assert.equal(physics.engineId,p.id);
  assert.equal(physics.team,p.team);
  assert.ok(Math.abs(p.x-physics.x)<1e-9);
  assert.ok(Math.abs(p.y-physics.y)<1e-9);
  assert.ok(dst(p,w0.players[j])<=PLAYER_MAX_SPEED_MPS/60+1e-5);
 }
 sample(st,frame,moved,w0,prev.ball.position);
 return frame;
}
const brief=st=>Object.freeze({
 team:st.team,mode:st.mode,
 minStaticShoeClearanceFromTick600M:r(st.stats.minStaticGapFrom600M),
 minShoeTick:st.stats.minTick,
 laterGenuineForwardShoeStarts:st.stats.forwardPostFirstShoeStarts,
 actualRapierShoeStarts:st.stats.physicalShoeStarts,
 supportFrames:st.stats.relayTicks,accessFrames:st.stats.ballAccessTicks,
 firstAccessTick:st.stats.firstAccessTick,
 guardStallFramesFromTick600:st.stats.actorGuardStallsFrom600,
 physicalTeammateGuardBelowMinimumFrames:
  st.stats.actorObservedGuardBelowMin,
 nearWindowTick635to675: Object.freeze({
  frames:st.stats.candidateNearWindowFrames,
  shoeOutsideLocalForwardBoxFrames:
   st.stats.candidateFootForwardBeyondFrames,
  shoeOutsideLocalLateralBoxFrames:
   st.stats.candidateFootLateralBeyondFrames,
  shoeOutsideVerticalBoxFrames:
   st.stats.candidateFootVerticalBeyondFrames}),
 trueFootballActions:st.stats.trueActions,
 trueShotAttempts:st.stats.naturalShots,
 ballIn35mShotRangeFrames:st.stats.ballInShotRangeFrames,
 min35mShotRangeShortfallM:r(st.stats.minShotShortfallM),
 samples:st.stats.captured.filter(x=>[635,650,657,660,662,664,
 665,667,670,675,693,694].includes(x.tick))
});
test('C2.3r independent real 3D oriented shoe MISS, guard and contact proof',async()=>{
 const R=await initializeRapier(rapier),results=[];
 assert.equal(PLAYER_MIN_SEPARATION_M,0.98);
 assert.equal(BALL_RADIUS,0.11);
 assert.equal(FOOT_CONTACT_ROUNDING_M,0.02);
 for(const c of CASES){
  const studies=Object.keys(CONFIG).map(mode=>make(R,c,mode));
  let firstHandoffDiff=null,firstAccessDiff=null;
  try{
   for(let tick=1;tick<=STEPS;tick++){
    const [a,b,d]=studies.map(execute);
    assert.equal(a.physicsTick,tick);
    assert.equal(b.physicsTick,tick);
    assert.equal(d.physicsTick,tick);
    const equals=(x,y)=>JSON.stringify(x.ball)===JSON.stringify(y.ball)&&
     JSON.stringify(x.physicalPlayerPositions)===
      JSON.stringify(y.physicalPlayerPositions);
    if(!equals(a,b)&&firstHandoffDiff===null)firstHandoffDiff=tick;
    if(!equals(b,d)&&firstAccessDiff===null)firstAccessDiff=tick;
    if(firstAccessDiff===null){
     assert.deepEqual(b.physicalContactFeed,d.physicalContactFeed);
     assert.deepEqual(b.localAutonomousAction,d.localAutonomousAction);
    }
   }
   const [baseline,handoff,access]=studies;
   for(const s of studies){
    assert.deepEqual(s.stats.captured.map(x=>x.tick),[...TICKS]);
    assert.equal(s.stats.naturalShots.length,0);
    assert.equal(s.stats.forwardPostFirstShoeStarts,0,
     'no later candidate shoe START can be inferred from static geometry');
   }
   if(c.team==='home'){
    assert.equal(firstHandoffDiff,null);
    assert.equal(firstAccessDiff,null);
    assert.deepEqual(baseline.stats.trueActions,
     access.stats.trueActions);
    assert.equal(access.stats.ballAccessTicks,0);
    assert.equal(access.stats.physicalShoeStarts,5);
   }else{
    assert.equal(firstHandoffDiff,600);
    assert.equal(firstAccessDiff,635);
    assert.equal(baseline.stats.relayTicks,53);
    assert.equal(handoff.stats.relayTicks,148);
    assert.equal(access.stats.relayTicks,148);
    assert.equal(access.stats.ballAccessTicks,60);
    assert.equal(access.stats.firstAccessTick,635);
    for(const s of studies){
     assert.equal(s.stats.physicalShoeStarts,16);
     assert.ok(Math.abs(s.stats.minShotShortfallM-0.681)<0.002);
    }
    assert.equal(baseline.stats.minTick,657);
    assert.equal(handoff.stats.minTick,683);
    assert.equal(access.stats.minTick,664);
    assert.ok(Math.abs(baseline.stats.minStaticGapFrom600M-0.250)<0.002);
    assert.ok(Math.abs(handoff.stats.minStaticGapFrom600M-2.060)<0.002);
    assert.ok(Math.abs(access.stats.minStaticGapFrom600M-0.470)<0.002);
    for(const [s,t] of [[baseline,657],[access,664]]){
     const p=s.stats.captured.find(x=>x.tick===t);
     assert.equal(p.shoe.realRapierStart,false);
     assert.equal(p.shoe.realRapierActive,false);
     assert.ok(p.shoe.staticClearanceM>0.24);
     assert.equal(p.noGeometricContactInference,true);
     assert.ok(p.actor.nearestTeammateDistanceM>0);
     assert.ok(p.actor.nearestOpponentDistanceM>0);
    }
   }
   results.push(Object.freeze({
    team:c.team,firstHandoffPhysicalDifferenceTick:firstHandoffDiff,
    firstNearBallAccessPhysicalDifferenceTick:firstAccessDiff,
    modes:studies.map(brief)
   }));
  }finally{for(const s of studies)s.engine.dispose();}
 }
 // GitHub Actions truncates an individual stdout line at 64KiB.
 // Keep the physical assertions on ALL 720 ticks and ALL captured
 // checkpoints, but log only the important AWAY shoe windows. Never
 // discard measured values from the in-memory regression assertions.
 const compact=results.map(c=>Object.freeze({
  team:c.team,
  firstHandoffPhysicalDifferenceTick:
   c.firstHandoffPhysicalDifferenceTick,
  firstNearBallAccessPhysicalDifferenceTick:
   c.firstNearBallAccessPhysicalDifferenceTick,
  modes:c.modes.map(m=>Object.freeze({
   ...m,
   samples:c.team==='away'?m.samples.filter(p=>
    [635,657,660,664,665,693].includes(p.tick)):[]
  }))
 }));
 console.log('C2_3R_REAL_SHOE_MISS_GUARD_DECOMPOSITION',
  JSON.stringify(compact));
});
