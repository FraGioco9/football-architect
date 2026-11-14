// C2.3w — strictly read-only, retrospective shoe/ball 60Hz
// kinematic window. No policy changes, new shoe contact, impulses,
// possession, inferred swept Rapier START or football result.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {PLAYER_DT,PLAYER_MAX_SPEED_MPS,PLAYER_TURN_RAD_PER_S,
 PLAYER_ACCEL_MPS2,PLAYER_BRAKE_MPS2,PLAYER_PITCH,PLAYER_RADIUS_M,
 INITIAL_PLAYERS,createPlayerMovement} from '../src/player-movement.mjs';
import {footProxyTransform} from '../src/player-foot-contact.mjs';
import {measureOrientedCarryShoeBallGeometry} from
 '../src/player-ball-carry-oriented-shoe-geometry.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';
import {SHOT_MAX_RANGE_M}
 from '../src/player-ball-uniform-autonomous-action.mjs';

const DT=PLAYER_DT;
const LOWER=655,UPPER=670;
const r=n=>Math.round(n*10000)/10000;
const wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
const xy=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const norm3=a=>Math.hypot(a.x,a.y,a.z);
const diff=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const lerp=(a,b,t)=>a+(b-a)*t;
const OPTIONS=Object.freeze({
 autonomousActions:true,autonomousCarry:true,
 autonomousCarrySupport:true,autonomousCarrySupportPressHandoff:true,
 autonomousCarrySupportBallAccess:true,
 autonomousCarrySupportLateralAlign:true,
 autonomousCarrySupportEarlyFacing:true
});
const options=mode=>mode==='center'?
 {...OPTIONS,autonomousCarrySupportShoeCenterTarget:true}:OPTIONS;
const moverOptions=mode=>({
 experimentalAiKickApproach:true,
 experimentalAutonomousFixtureContactChase:true,
 experimentalAutonomousFixtureCarry:true,
 experimentalAutonomousFixtureCarrySupport:true,
 experimentalAutonomousFixtureCarrySupportPressHandoff:true,
 experimentalAutonomousFixtureCarrySupportBallAccess:true,
 experimentalAutonomousFixtureCarrySupportLateralAlign:true,
 experimentalAutonomousFixtureCarrySupportEarlyFacing:true,
 ...(mode==='center'?{
  experimentalAutonomousFixtureCarrySupportShoeCenterTarget:true}:{})
});
const CASES=Object.freeze([
 {team:'home',country:'IT',x:-4.96,vx:0.3},
 {team:'away',country:'DE',x:4.96,vx:-0.3}
]);
const fixture=c=>({
 id:'season:1:'+c.country+'-1:N01:'+c.country+'-1:'+c.country+'-2',
 competitionId:c.country+'-1',marker:'N01',day:1,round:1,
 homeClubId:c.country+'-1',awayClubId:c.country+'-2'
});
const scene=c=>({
 preset:'roll',seed:'c2-3e-natural-physical-'+c.team+'-'+c.country,
 x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
});
const point=p=>({x:p.x,y:p.y,z:p.z});
function check(s){
 if(!s||!Number.isSafeInteger(s.tick)||s.tick<0||
    !s.actor||!s.ball||typeof s.actor.id!=='string'||
    !['home','away'].includes(s.actor.team)||
    ![s.actor.x,s.actor.y,s.actor.facingRad,
      s.ball.x,s.ball.y,s.ball.z].every(Number.isFinite)||
    s.ball.z<0||Math.abs(s.actor.facingRad)>Math.PI+1e-5)
  throw new TypeError('Canonical actual consecutive 60Hz sample required');
}
function retrospectSegment(before,after){
 check(before);check(after);
 if(after.tick!==before.tick+1||
    before.actor.id!==after.actor.id||
    before.actor.team!==after.actor.team||
    xy(before.actor,after.actor)>PLAYER_MAX_SPEED_MPS*DT+1e-5||
    Math.abs(wrap(after.actor.facingRad-before.actor.facingRad))>
     PLAYER_TURN_RAD_PER_S*DT+1e-5)
  throw new TypeError('Canonical bounded shoe movement and timestamps required');
 const preShoe=footProxyTransform(before.actor);
 const postShoe=footProxyTransform(after.actor);
 const preRel=diff(before.ball,preShoe);
 const postRel=diff(after.ball,postShoe);
 const velocity={
  ball:Object.freeze({
   x:(after.ball.x-before.ball.x)/DT,
   y:(after.ball.y-before.ball.y)/DT,
   z:(after.ball.z-before.ball.z)/DT
  }),
  shoe:Object.freeze({
   x:(postShoe.x-preShoe.x)/DT,
   y:(postShoe.y-preShoe.y)/DT,
   z:(postShoe.z-preShoe.z)/DT
  }),
  body:Object.freeze({
   x:(after.actor.x-before.actor.x)/DT,
   y:(after.actor.y-before.actor.y)/DT
  })
 };
 const relV=diff(velocity.ball,velocity.shoe);
 const separation=norm3(preRel);
 const signedClosing=separation>1e-10?
  -(preRel.x*relV.x+preRel.y*relV.y+
    preRel.z*relV.z)/separation:0;
 const start=measureOrientedCarryShoeBallGeometry(
  before.actor,before.ball);
 const end=measureOrientedCarryShoeBallGeometry(
  after.actor,after.ball);
 // Five hypothetical straight-line and shortest-angle intermediate poses.
 // These are merely discrete post-hoc visual estimates, NOT swept Rapier
 // solver distances or synthetic evidence of shoe-ball impact.
 const samples=[0,0.25,0.5,0.75,1].map(f=>{
  const actor={id:before.actor.id,team:before.actor.team,
   x:lerp(before.actor.x,after.actor.x,f),
   y:lerp(before.actor.y,after.actor.y,f),
   facingRad:wrap(before.actor.facingRad+
    f*wrap(after.actor.facingRad-before.actor.facingRad))};
  const ball={x:lerp(before.ball.x,after.ball.x,f),
   y:lerp(before.ball.y,after.ball.y,f),
   z:lerp(before.ball.z,after.ball.z,f)};
  return {fraction:f,gap:
   measureOrientedCarryShoeBallGeometry(
    actor,ball).estimatedStaticSurfaceClearanceM};
 });
 const min=samples.reduce((a,b)=>b.gap<a.gap?b:a);
 const target=after.target??null;
 const preTargetGap=target?xy(before.actor,target):null;
 const postTargetGap=target?xy(after.actor,target):null;
 const result={
  tick:after.tick,
  startGapM:start.estimatedStaticSurfaceClearanceM,
  endGapM:end.estimatedStaticSurfaceClearanceM,
  sampledMinGapM:min.gap,atFraction:min.fraction,
  bodyMps:Math.hypot(velocity.body.x,velocity.body.y),
  shoeMps:Math.hypot(velocity.shoe.x,velocity.shoe.y),
  ballMps:norm3(velocity.ball),
  relativeMps:norm3(relV),
  radialClosingMps:signedClosing,
  endRelativeForwardM:end.relativeBallForwardM,
  endRelativeLateralM:end.relativeBallLateralM,
  endBodyGapM:end.bodyBallXYGapM,
  bodyMovedM:xy(before.actor,after.actor),
  previousBallMovedM:Math.hypot(
   after.ball.x-before.ball.x,after.ball.y-before.ball.y),
  targetGapBeforeM:preTargetGap,targetGapAfterM:postTargetGap,
  targetAdvanceM:target?preTargetGap-postTargetGap:null,
  blockedBy:after.actor.blockedBy??null,
  estimatedInterpolatedGeometryOnly:true,
  rapierSweptContactInferred:false,
  realContactInferred:false
 };
 if(Object.values(result).some(x=>typeof x==='number'&&!Number.isFinite(x)))
  throw new TypeError('Non-finite retrospective diagnostic');
 return Object.freeze(result);
}

// C2.3x — independently reconstruct the SAME pre-step normal mover
// speed cap and acceleration vector. This is an observer, never used to
// steer the world or replace the real Rapier collision/foot feed.
function retrospectiveSteeringSlip(before,after){
 const measured=retrospectSegment(before,after);
 const pre=before.actor,post=after.actor,target=after.target;
 if(!target||![target.x,target.y,pre.vx,pre.vy,post.vx,post.vy]
    .every(Number.isFinite)||
    Math.abs(target.x)>PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M+1e-9||
    Math.abs(target.y)>PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M+1e-9)
  throw new TypeError('True bounded canonical target and velocities required');
 const beforeSpeed=Math.hypot(pre.vx,pre.vy);
 const afterSpeed=Math.hypot(post.vx,post.vy);
 const targetDist=xy(pre,target);
 const maxDesiredSpeed=Math.min(PLAYER_MAX_SPEED_MPS,
  Math.sqrt(2*PLAYER_BRAKE_MPS2*targetDist));
 const targetV=targetDist>1e-8?{
  x:(target.x-pre.x)/targetDist*maxDesiredSpeed,
  y:(target.y-pre.y)/targetDist*maxDesiredSpeed}:{x:0,y:0};
 const delta={x:targetV.x-pre.vx,y:targetV.y-pre.vy};
 const requestedDelta=Math.hypot(delta.x,delta.y);
 const accelCap=(maxDesiredSpeed<beforeSpeed?
  PLAYER_BRAKE_MPS2:PLAYER_ACCEL_MPS2)*DT;
 const factor=requestedDelta>accelCap?accelCap/requestedDelta:1;
 const forecast={x:pre.vx+delta.x*factor,y:pre.vy+delta.y*factor};
 const actualDelta=Math.hypot(post.vx-pre.vx,post.vy-pre.vy);
 const modelMismatch=Math.hypot(forecast.x-post.vx,forecast.y-post.vy);
 const preFoot=footProxyTransform(pre),postFoot=footProxyTransform(post);
 const preRel=diff(before.ball,preFoot),postRel=diff(after.ball,postFoot);
 const left={x:-Math.sin(pre.facingRad),y:Math.cos(pre.facingRad)};
 const preLocalLateral=preRel.x*left.x+preRel.y*left.y;
 const postInPreFrame=postRel.x*left.x+postRel.y*left.y;
 const worldMotionLateralM=postInPreFrame-preLocalLateral;
 const postLocalLateral=measured.endRelativeLateralM;
 const turnLateralM=postLocalLateral-postInPreFrame;
 const actualLateralDeltaM=postLocalLateral-preLocalLateral;
 const separation=Math.hypot(preRel.x,preRel.y,preRel.z);
 const rel3={
  x:(postRel.x-preRel.x)/DT,
  y:(postRel.y-preRel.y)/DT,
  z:(postRel.z-preRel.z)/DT
 };
 const approach=separation>1e-10?
  -(preRel.x*rel3.x+preRel.y*rel3.y+preRel.z*rel3.z)/
   separation:0;
 const tangentMps=Math.sqrt(Math.max(0,
  norm3(rel3)**2-approach**2));
 if(Math.abs(actualLateralDeltaM-
     (worldMotionLateralM+turnLateralM))>1e-10||
    Math.abs(approach-measured.radialClosingMps)>1e-9)
  throw new Error('Observed lateral or radial decomposition mismatch');
 const blocked=post.blockedBy!==null&&post.blockedBy!==undefined;
 const boundary= Math.abs(post.x)>=PLAYER_PITCH.lengthM/2-
  PLAYER_RADIUS_M-1e-9 ||
  Math.abs(post.y)>=PLAYER_PITCH.widthM/2-
  PLAYER_RADIUS_M-1e-9;
 if(!blocked&&!boundary&&modelMismatch>1e-8)
  throw new Error('Actual canonical movement diverges from normal 60Hz integrator');
 if(!blocked&&actualDelta>accelCap+1e-8)
  throw new Error('Actual velocity change exceeded normal 60Hz cap');
 return Object.freeze({
  tick:after.tick,
  preTargetGapM:targetDist,
  originalTargetSpeedCapMps:maxDesiredSpeed,
  sourceBeforeSpeedMps:beforeSpeed,
  actualAfterSpeedMps:afterSpeed,
  speedChangeMps:afterSpeed-beforeSpeed,
  distanceBrakeCapBelowMax:maxDesiredSpeed<PLAYER_MAX_SPEED_MPS-1e-9,
  distanceBrakeBranch:maxDesiredSpeed<beforeSpeed,
  appliedMaxVelocityDeltaMps:accelCap,
  velocityDeltaActualMps:actualDelta,
  expectedVelocityErrorMps:modelMismatch,
  targetUnitSpeedRequestedMps:Math.hypot(targetV.x,targetV.y),
  lateralByActualWorldMotionM:worldMotionLateralM,
  lateralByShoeFacingM:turnLateralM,
  observedLateralChangeM:actualLateralDeltaM,
  radialClosingMps:approach,
  tangentRelativeMps:tangentMps,
  beforeRelativeLateralM:preLocalLateral,
  afterRelativeLateralM:postLocalLateral,
  realPlayerHardBlocked:blocked,
  atPitchBoundary:boundary,
  readOnly:true,normalSpeedCapUnmodified:true,
  physicalCollisionInferred:false,
  officialMatchResult:null
 });
}

function run(R,c,mode){
 const engine=createPhysicalFixtureStepRuntime(
  R,fixture(c),scene(c),options(mode));
 const shadow=createPlayerMovement(moverOptions(mode));
 return {engine,shadow,mode,team:c.team,pass:null,carry:null,
  actions:[],physicalStarts:0,forwardPostInitialStarts:0,
  shots:0,sourceBoundFrames:0,window:[]};
}
function step(s){
 const before=s.engine.snapshot();
 const pre=s.shadow.snapshot();
 const tick=pre.tick+1;
 assert.equal(before.physicsTick,pre.tick);
 const moved=s.shadow.step(before.ball.position);
 const frame=s.engine.step();
 assert.equal(frame.physicsTick,tick);
 assert.equal(moved.tick,tick);
 assert.equal(frame.autonomousCarrySupportEarlyFacingMode,true);
 assert.equal(frame.autonomousCarrySupportShoeCenterTargetMode,
  s.mode==='center'?true:undefined);
 assert.equal(frame.officialMatchPossession,false);
 assert.equal(frame.productionScoringConnected,false);
 assert.equal(frame.physicalShotBoundary.goalScored,null);
 assert.equal(moved.players.length,22);
 assert.equal(frame.physicalPlayerPositions.length,22);
 for(let i=0;i<22;i++){
  const a=moved.players[i],b=pre.players[i],world=frame.physicalPlayerPositions[i];
  assert.equal(a.id,INITIAL_PLAYERS[i].id);
  assert.equal(world.engineId,a.id);
  assert.ok(Math.abs(a.x-world.x)<1e-9);
  assert.ok(Math.abs(a.y-world.y)<1e-9);
  assert.ok(xy(a,b)<=PLAYER_MAX_SPEED_MPS*DT+1e-5);
  assert.ok(Math.abs(wrap(a.facingRad-b.facingRad))<=
   PLAYER_TURN_RAD_PER_S*DT+1e-5);
 }
 const a=moved.players.find(p=>p.id===s.team+'-10');
 const b=pre.players.find(p=>p.id===a.id);
 const access=moved.provisionalCarrySupportBallAccess??null;
 if(access){
  assert.equal(access.team,s.team);
  assert.equal(access.playerId,a.id);
  assert.equal(access.sourcePassTick,s.pass?.tick);
  assert.equal(access.sourceCarryTick,s.carry?.tick);
  assert.ok(s.pass.tick<s.carry.tick&&s.carry.tick<tick);
  assert.ok(access.bodyBallGapM<=4+1e-9);
  assert.equal(access.officialMatchPossession,false);
  assert.equal(access.physicalShoeStartObserved,false);
  assert.ok(access.earlyFacing);
  if(s.mode==='center'){
   assert.ok(access.shoeCenterTarget);
   assert.ok(access.shoeCenterTarget.appliedCorrectionM<=0.3+1e-10);
   assert.deepEqual(access.shoeCenterTarget.realPreviousBall,
    {x:before.ball.position.x,y:before.ball.position.y});
   assert.equal(access.shoeCenterTarget.preStepFacingRad,b.facingRad);
  }else assert.equal(access.shoeCenterTarget,undefined);
  s.sourceBoundFrames++;
 }
 if(tick>=LOWER&&tick<=UPPER&&s.team==='away'){
  assert.ok(access,'diagnostic window must follow real physical PASS→CARRY');
  const pair={
   before:{tick:tick-1,actor:b,ball:point(before.ball.position)},
   after:{tick,actor:a,ball:point(frame.ball.position),
    target:access.target}
  };
  const measured=retrospectSegment(pair.before,pair.after);
  const steering=retrospectiveSteeringSlip(pair.before,pair.after);
  // No physics or predictor access to the measured future ball:
  // calculation happens AFTER frame.step, exclusively in tests.
  const realStarted=frame.physicalContactFeed.started
   .some(p=>p.engineId===a.id);
  assert.equal(measured.realContactInferred,false);
  const event=Object.freeze({
   tick,sourcePass:access.sourcePassTick,
   sourceCarry:access.sourceCarryTick,
   authenticShoeStart:realStarted,
   fromRealRapierFrame:true,
   ...measured,
   steering
  });
  s.window.push(event);
 }
 const starts=frame.physicalContactFeed.started;
 s.physicalStarts+=starts.length;
 for(const contact of starts){
  assert.ok(frame.physicalContactFeed.active.some(p=>
   p.engineId===contact.engineId&&p.team===contact.team));
  if(tick>1&&contact.engineId===a.id)s.forwardPostInitialStarts++;
 }
 const action=frame.localAutonomousAction;
 if(action){
  assert.equal(starts.length,1);
  assert.equal(starts[0].engineId,action.playerId);
  assert.equal(starts[0].team,action.team);
  assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
  assert.equal(action.appliedByRapier,true);
  assert.equal(action.officialMatchAction,false);
  if(action.action==='shot'){
   assert.equal(action.decisionContext.shotRange,true);
   s.shots++;
  }
  s.actions.push({tick,id:action.playerId,kind:action.action});
  if(action.action==='pass'){
   s.shadow.observeAuthenticFixturePass(action);
   s.pass=action;s.carry=null;
  }else if(action.action==='carry'){
   s.shadow.observeAuthenticFixtureCarry(action);
   s.carry=action;
  }else{
   s.shadow.clearFixtureCarryOnOtherAction(action);
   s.carry=null;
  }
 }
 for(const id of frame.footContact.ended)
  s.shadow.observeAuthenticFixtureCarryShoeEnd(id,tick);
 return frame;
}
const compact=s=>{
 const rows=s.window;
 const blocked=rows.filter(x=>x.blockedBy!==null);
 const approaching=rows.filter(x=>x.radialClosingMps>0);
 const receding=rows.filter(x=>x.radialClosingMps<0);
 const targetGapGrowing=rows.filter(x=>x.targetAdvanceM<0);
 const slowed=rows.filter(x=>x.steering.speedChangeMps<0);
 const brakeBound=rows.filter(x=>x.steering.distanceBrakeCapBelowMax);
 const brakeBranch=rows.filter(x=>x.steering.distanceBrakeBranch);
 const yawDominant=rows.filter(x=>Math.abs(x.steering.lateralByShoeFacingM)>
  Math.abs(x.steering.lateralByActualWorldMotionM));
 const minimum=rows.length?rows.reduce((a,b)=>
  b.sampledMinGapM<a.sampledMinGapM?b:a):null;
 return {
  mode:s.mode,team:s.team,frames:rows.length,
  sourceBoundFrames:s.sourceBoundFrames,
  physicalStarts:s.physicalStarts,
  postInitialForwardShoeStarts:s.forwardPostInitialStarts,
  shots:s.shots,
  blockedFrames:blocked.length,
  blockers:[...new Set(blocked.map(x=>x.blockedBy))],
  approachingFrames:approaching.length,
  recedingFrames:receding.length,
  targetGapGrowingFrames:targetGapGrowing.length,
  actualSlowdownFrames:slowed.length,
  targetDistanceSpeedCapFrames:brakeBound.length,
  brakeAccelerationBranchFrames:brakeBranch.length,
  yawDominantLateralFrames:yawDominant.length,
  minSampledClearanceM:minimum?r(minimum.sampledMinGapM):null,
  minSampledClearanceTick:minimum?.tick??null,
  rows:rows.map(x=>({
   tick:x.tick,blockedBy:x.blockedBy,
   speedBody:r(x.bodyMps),
   speedBall:r(x.ballMps),
   speedShoe:r(x.shoeMps),
   closing:r(x.radialClosingMps),
   relative:r(x.relativeMps),
   bodyGap:r(x.endBodyGapM),
   staticEndGap:r(x.endGapM),
   minSampleGap:r(x.sampledMinGapM),
   minFraction:x.atFraction,
   lateral:r(x.endRelativeLateralM),
   forward:r(x.endRelativeForwardM),
   targetAdvance:r(x.targetAdvanceM),
   cap:r(x.steering.originalTargetSpeedCapMps),
   previousSpeed:r(x.steering.sourceBeforeSpeedMps),
   speedChange:r(x.steering.speedChangeMps),
   brakeBranch:x.steering.distanceBrakeBranch,
   capBelowMax:x.steering.distanceBrakeCapBelowMax,
   modelError:r(x.steering.expectedVelocityErrorMps),
   tangential:r(x.steering.tangentRelativeMps),
   lateralWorld:r(x.steering.lateralByActualWorldMotionM),
   lateralYaw:r(x.steering.lateralByShoeFacingM),
   lateralTotal:r(x.steering.observedLateralChangeM),
   realShoeSTART:x.authenticShoeStart
  }))
 };
};
test('C2.3w pure retrospective 60Hz kinematics rejects invalid, forged and over-speed frames',()=>{
 const actor={id:'away-10',team:'away',x:0,y:0,facingRad:0,blockedBy:null};
 const ball={x:1,y:0,z:0.12};
 const b={tick:655,actor,ball};
 const a={tick:656,actor:{...actor,x:0.03,facingRad:0.05},ball:{x:1.01,y:0,z:0.12},target:{x:0.8,y:0}};
 const s=retrospectSegment(b,a);
 assert.equal(s.tick,656);
 assert.equal(s.realContactInferred,false);
 assert.equal(s.rapierSweptContactInferred,false);
 assert.equal(s.estimatedInterpolatedGeometryOnly,true);
 assert.ok(s.sampledMinGapM>=0);
 assert.ok(s.bodyMps>0);
 assert.throws(()=>retrospectSegment(b,{...a,tick:658}));
 assert.throws(()=>retrospectSegment(b,{...a,actor:{...actor,x:0.4}}));
 assert.throws(()=>retrospectSegment(b,{...a,actor:{...actor,facingRad:0.2}}));
 assert.throws(()=>retrospectSegment(b,{...a,ball:{...ball,z:-1}}));
 assert.throws(()=>retrospectSegment(b,{...a,ball:{...ball,x:NaN}}));
 assert.throws(()=>retrospectSegment(b,{...a,actor:{...actor,id:'home-10'}}));
});

test('C2.3x pure canonical mover reconstruction and lateral/yaw decomposition rejects forged input',()=>{
 const pre={id:'away-10',team:'away',x:0,y:0,facingRad:0,
  vx:1,vy:0,blockedBy:null};
 const goal={x:1,y:0.2};
 const targetGap=Math.hypot(goal.x-pre.x,goal.y-pre.y);
 const limit=Math.min(PLAYER_MAX_SPEED_MPS,
  Math.sqrt(2*PLAYER_BRAKE_MPS2*targetGap));
 const desired={x:goal.x/targetGap*limit,
  y:goal.y/targetGap*limit};
 const change={x:desired.x-pre.vx,y:desired.y-pre.vy};
 const magnitude=Math.hypot(change.x,change.y);
 const maxDelta=(limit<1?PLAYER_BRAKE_MPS2:
  PLAYER_ACCEL_MPS2)*DT;
 const f=Math.min(1,maxDelta/magnitude);
 const afterV={vx:pre.vx+change.x*f,vy:pre.vy+change.y*f};
 const post={...pre,x:pre.x+afterV.vx*DT,y:pre.y+afterV.vy*DT,
  ...afterV,facingRad:0.05};
 const before={tick:655,actor:pre,ball:{x:1.5,y:0.2,z:0.12}};
 const after={tick:656,actor:post,ball:{x:1.49,y:0.21,z:0.12},
  target:goal};
 const actual=retrospectiveSteeringSlip(before,after);
 assert.equal(actual.readOnly,true);
 assert.equal(actual.physicalCollisionInferred,false);
 assert.ok(actual.expectedVelocityErrorMps<1e-9);
 assert.ok(Math.abs(actual.observedLateralChangeM-
  actual.lateralByActualWorldMotionM-
  actual.lateralByShoeFacingM)<1e-10);
 assert.throws(()=>retrospectiveSteeringSlip(before,
  {...after,target:{...goal,x:NaN}}));
 assert.throws(()=>retrospectiveSteeringSlip(before,
  {...after,actor:{...post,vx:10}}));
 assert.throws(()=>retrospectiveSteeringSlip(before,
  {...after,actor:{...post,vy:Infinity}}));
 assert.throws(()=>retrospectiveSteeringSlip(before,
  {...after,actor:{...post,vx:post.vx+0.08}}));
 assert.throws(()=>retrospectiveSteeringSlip(before,
  {...after,target:{x:PLAYER_PITCH.lengthM,y:0}}));
});

test('C2.3w authentic 655-670 shoe/ball relative-motion audit HOME/AWAY and independent AWAY replay',async()=>{
 const R=await initializeRapier(rapier),all=[];
 for(const c of CASES){
  const trials=['early','center'].map(mode=>run(R,c,mode));
  const independent=c.team==='away'?
   createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),options('center')):null;
  try{
   for(let tick=1;tick<=720;tick++){
    const [a,b]=trials.map(step);
    if(c.team==='home'){
     assert.deepEqual(a.ball,b.ball);
     assert.deepEqual(a.physicalPlayerPositions,b.physicalPlayerPositions);
     assert.deepEqual(a.physicalContactFeed,b.physicalContactFeed);
     assert.deepEqual(a.localAutonomousAction,b.localAutonomousAction);
    }
    if(independent){
     const replay=independent.step();
     assert.deepEqual(b.ball,replay.ball);
     assert.deepEqual(b.physicalPlayerPositions,
      replay.physicalPlayerPositions);
     assert.deepEqual(b.physicalContactFeed,replay.physicalContactFeed);
     assert.deepEqual(b.localAutonomousAction,replay.localAutonomousAction);
    }
   }
   const [early,center]=trials;
   if(c.team==='home'){
    assert.equal(early.window.length,0);
    assert.equal(center.window.length,0);
    assert.equal(center.sourceBoundFrames,0);
   }else{
    for(const trial of trials){
     assert.equal(trial.window.length,UPPER-LOWER+1);
     assert.deepEqual(trial.window.map(x=>x.tick),
      Array.from({length:UPPER-LOWER+1},(_,i)=>LOWER+i));
     assert.ok(trial.window.every(x=>
      x.fromRealRapierFrame&&x.sourcePass===292&&
      x.sourceCarry===567&&x.realContactInferred===false&&
      x.rapierSweptContactInferred===false));
     assert.ok(trial.window.every(x=>x.steering.readOnly&&
      x.steering.physicalCollisionInferred===false&&
      !x.steering.realPlayerHardBlocked&&
      x.steering.expectedVelocityErrorMps<1e-8));
     assert.ok(trial.window.every(x=>!x.authenticShoeStart||
      trial.forwardPostInitialStarts>0));
     assert.ok(trial.sourceBoundFrames>=UPPER-LOWER+1);
    }
   }
   all.push({team:c.team,modes:trials.map(compact)});
  }finally{
   trials.forEach(s=>s.engine.dispose());
   independent?.dispose();
  }
 }
 console.log('C2_3W_REAL_RAPIER_RELATIVE_MOTION_WINDOW',
  JSON.stringify(all));
 console.log('C2_3X_REAL_RAPIER_BRAKE_LATERAL_DECOMPOSITION',
  JSON.stringify(all.map(x=>({team:x.team,
   modes:x.modes.map(m=>({mode:m.mode,
    actualSlowdownFrames:m.actualSlowdownFrames,
    targetDistanceSpeedCapFrames:m.targetDistanceSpeedCapFrames,
    brakeAccelerationBranchFrames:m.brakeAccelerationBranchFrames,
    yawDominantLateralFrames:m.yawDominantLateralFrames,
    rows:m.rows.map(row=>({tick:row.tick,cap:row.cap,
     previousSpeed:row.previousSpeed,speedChange:row.speedChange,
     brakeBranch:row.brakeBranch,capBelowMax:row.capBelowMax,
     lateralWorld:row.lateralWorld,lateralYaw:row.lateralYaw,
     lateralTotal:row.lateralTotal,tangential:row.tangential,
     modelError:row.modelError}))}))}))));
});
