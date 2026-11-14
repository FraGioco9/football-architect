// C2.3y/z — source-bound real shoe-interception Rapier experiments.
// New C2.3z <=0.50m estimated-velocity tactical lead is derived from
// TWO consecutive previous real ball frames, after true PASS->CARRY.
// No future ball, invented shoe contact, shot or production scoring.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,BALL_RADIUS} from '../src/core.mjs';
import {PLAYER_DT,PLAYER_MAX_SPEED_MPS,PLAYER_TURN_RAD_PER_S,
 PLAYER_PITCH,PLAYER_RADIUS_M,INITIAL_PLAYERS,createPlayerMovement}
 from '../src/player-movement.mjs';
import {SHOT_MAX_RANGE_M}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {measureOrientedCarryShoeBallGeometry}
 from '../src/player-ball-carry-oriented-shoe-geometry.mjs';
import {footProxyTransform,FOOT_CONTACT_HALF_LENGTH_M,
 FOOT_CONTACT_HALF_WIDTH_M,FOOT_CONTACT_HALF_HEIGHT_M,
 FOOT_CONTACT_ROUNDING_M}
 from '../src/player-foot-contact.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const CASES=Object.freeze([
 Object.freeze({team:'home',country:'IT',x:-4.96,vx:0.3}),
 Object.freeze({team:'away',country:'DE',x:4.96,vx:-0.3})
]);
const BASE=Object.freeze({
 autonomousActions:true,autonomousCarry:true,autonomousCarrySupport:true,
 autonomousCarrySupportPressHandoff:true,
 autonomousCarrySupportBallAccess:true,
 autonomousCarrySupportLateralAlign:true
});
const CENTER=Object.freeze({...BASE,
 autonomousCarrySupportEarlyFacing:true,
 autonomousCarrySupportShoeCenterTarget:true
});
const LEAD=Object.freeze({...CENTER,
 autonomousCarrySupportFootLateralLead:true});
const VELOCITY=Object.freeze({...LEAD,
 autonomousCarrySupportObservedBallVelocityLead:true});
const TERMINAL=Object.freeze({...VELOCITY,
 autonomousCarrySupportTerminalFacingLead:true});
const OPT=Object.freeze({
 center:CENTER,lead:LEAD,velocity:VELOCITY,terminal:TERMINAL,
 runway:Object.freeze({...TERMINAL,
  autonomousCarrySupportTerminalRunThrough:true}),
 slip:Object.freeze({...TERMINAL,
  autonomousCarrySupportTerminalLateralSlip:true}),
 longitudinal:Object.freeze({...TERMINAL,
  autonomousCarrySupportLongitudinalLead:true})
});
const checkpoint=new Set([292,546,547,567,600,634,635,640,650,
 657,660,664,665,675,680,683,693,694,700,720]);
const r3=x=>Number(x.toFixed(3));
const xy=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
const fixture=c=>Object.freeze({
 id:'season:1:'+c.country+'-1:N01:'+c.country+'-1:'+c.country+'-2',
 competitionId:c.country+'-1',marker:'N01',day:1,round:1,
 homeClubId:c.country+'-1',awayClubId:c.country+'-2'
});
const scene=c=>Object.freeze({
 preset:'roll',seed:'c2-3e-natural-physical-'+c.team+'-'+c.country,
 x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
});
// C2.3ad: a POST-STEP read-only proxy. The inputs below are
// two consecutive actual Rapier ball samples and the two
// canonical facing/XY shoe poses that were delivered to Rapier.
// Linear/interpolated poses describe a retrospective hypothetical
// path, NOT a swept collision query or an actual shoe START.
const dot3=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const dist3=p=>Math.hypot(p.x,p.y,p.z);
const subtract3=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const lerp=(a,b,t)=>a+(b-a)*t;
const r4=n=>Number(n.toFixed(4));
function inspectConsecutivePhysicalShoePass(before,after){
 const valid=o=>o&&Number.isSafeInteger(o.tick)&&o.tick>=0&&
  o.actor&&typeof o.actor.id==='string'&&o.actor.id.length>0&&
  ['home','away'].includes(o.actor.team)&&o.ball&&
  [o.actor.x,o.actor.y,o.actor.facingRad,o.ball.x,
   o.ball.y,o.ball.z].every(Number.isFinite)&&o.ball.z>=0&&
  Math.abs(o.actor.facingRad)<=Math.PI+1e-5;
 if(!valid(before)||!valid(after)||
   after.tick!==before.tick+1||
   before.actor.id!==after.actor.id||
   before.actor.team!==after.actor.team||
   xy(before.actor,after.actor)>PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-5||
   Math.abs(wrap(after.actor.facingRad-before.actor.facingRad))>
    PLAYER_TURN_RAD_PER_S*PLAYER_DT+1e-5)
  throw new TypeError('Consecutive bounded actual 60Hz shoe and Rapier ball frames required');
 const startShoe=footProxyTransform(before.actor);
 const endShoe=footProxyTransform(after.actor);
 const startRel=subtract3(before.ball,startShoe);
 const endRel=subtract3(after.ball,endShoe);
 const relativeStep=subtract3(endRel,startRel);
 const normSq=dot3(relativeStep,relativeStep);
 const centerClosestFraction=normSq>1e-16?
  Math.max(0,Math.min(1,-dot3(startRel,relativeStep)/normSq)):0;
 const velocity={x:relativeStep.x/PLAYER_DT,
  y:relativeStep.y/PLAYER_DT,z:relativeStep.z/PLAYER_DT};
 const radialAt=(relative,sep)=>sep>1e-12?
  -dot3(relative,velocity)/sep:0;
 const radialClosingAtStart=radialAt(startRel,dist3(startRel));
 const radialClosingAtEnd=radialAt(endRel,dist3(endRel));
 const sample=f=>{
  const actor={id:before.actor.id,team:before.actor.team,
   x:lerp(before.actor.x,after.actor.x,f),
   y:lerp(before.actor.y,after.actor.y,f),
   facingRad:wrap(before.actor.facingRad+
    f*wrap(after.actor.facingRad-before.actor.facingRad))};
  const ball={x:lerp(before.ball.x,after.ball.x,f),
   y:lerp(before.ball.y,after.ball.y,f),
   z:lerp(before.ball.z,after.ball.z,f)};
  const measure=measureOrientedCarryShoeBallGeometry(actor,ball);
  const deficits={
   forward:Math.max(0,Math.abs(measure.relativeBallForwardM)-
    FOOT_CONTACT_HALF_LENGTH_M),
   lateral:Math.max(0,Math.abs(measure.relativeBallLateralM)-
    FOOT_CONTACT_HALF_WIDTH_M),
   vertical:Math.max(0,Math.abs(measure.relativeBallVerticalM)-
    FOOT_CONTACT_HALF_HEIGHT_M)
  };
  const limitingAxis=Object.entries(deficits)
   .sort((a,b)=>b[1]-a[1])[0];
  return {fraction:f,staticProxyGapM:measure.estimatedStaticSurfaceClearanceM,
   centerGap3DM:measure.shoeBallCenter3DGapM,
   localForwardM:measure.relativeBallForwardM,
   localLateralM:measure.relativeBallLateralM,
   localVerticalM:measure.relativeBallVerticalM,
   limitingAxis:limitingAxis[1]>1e-12?limitingAxis[0]:'inside-proxy'};
 };
 // Both actual endpoints, regular subframe samples, and the exact
 // closest approach of the LINEARIZED 3D shoe-centre trajectory.
 const fractions=[0,.125,.25,.375,.5,.625,.75,.875,1,
  centerClosestFraction];
 const samples=fractions.map(sample);
 const closestSurface=samples.reduce((a,b)=>
  b.staticProxyGapM<a.staticProxyGapM?b:a);
 const closestCenter=samples.reduce((a,b)=>
  b.centerGap3DM<a.centerGap3DM?b:a);
 const sideStart={
  x:-Math.sin(before.actor.facingRad),y:Math.cos(before.actor.facingRad)
 };
 const relativeLateralMps=(relativeStep.x*sideStart.x+
  relativeStep.y*sideStart.y)/PLAYER_DT;
 const relativeRadialMps=radialClosingAtStart;
 const tangentSpeedMps=Math.sqrt(Math.max(0,
  dist3(velocity)**2-relativeRadialMps**2));
 const result=Object.freeze({
  tick:after.tick,actorId:before.actor.id,
  actorTeam:before.actor.team,
  centerClosestFraction,centerClosest3DM:closestCenter.centerGap3DM,
  sampledProxyGapM:closestSurface.staticProxyGapM,
  sampledProxyAtFraction:closestSurface.fraction,
  limitingAxis:closestSurface.limitingAxis,
  relativeForwardM:closestSurface.localForwardM,
  relativeLateralM:closestSurface.localLateralM,
  relativeVerticalM:closestSurface.localVerticalM,
  radialClosingMpsAtStart:radialClosingAtStart,
  radialClosingMpsAtEnd:radialClosingAtEnd,
  lateralMpsInPreStepShoeFrame:relativeLateralMps,
  tangentRelativeMps:tangentSpeedMps,
  interiorCenterClosest:centerClosestFraction>0&&
   centerClosestFraction<1,
  radialTurnFromClosingToReceding:
   radialClosingAtStart>0&&radialClosingAtEnd<0,
  physicallyObservedFrames:true,
  intermediateFramesInterpolatedNotRapier:true,
  rapierSweptCollisionInferred:false,
  genuineShoeStartInferred:false,
  footballActionExecuted:false,officialMatchResult:null
 });
 if(Object.values(result).some(v=>
   typeof v==='number'&&!Number.isFinite(v)))
  throw new TypeError('Finite measured relative shoe/ball motion required');
 return result;
}
// C2.3ae: convert C2.3ad's authenticated *retrospective* sampled
// closest static shoe pose into a longitudinal-only timing lower bound.
// The assumption of a stationary ball, perfect forward acceleration and
// all 7m/s available immediately is intentionally optimistic; it is
// NEVER a true collision/feasibility/shot verdict.
function inspectOptimisticLongitudinalToeTiming(phase){
 if(!phase||phase.physicallyObservedFrames!==true||
    phase.intermediateFramesInterpolatedNotRapier!==true||
    ![phase.sampledProxyAtFraction,phase.relativeForwardM,
      phase.relativeLateralM,phase.relativeVerticalM]
     .every(Number.isFinite)||
    phase.sampledProxyAtFraction<0||phase.sampledProxyAtFraction>1)
  throw new TypeError('Authenticated finite retrospective physical phase required');
 const exteriorLateral=Math.max(0,Math.abs(phase.relativeLateralM)-
  FOOT_CONTACT_HALF_WIDTH_M);
 const exteriorVertical=Math.max(0,Math.abs(phase.relativeVerticalM)-
  FOOT_CONTACT_HALF_HEIGHT_M);
 const orthogonalExteriorM=Math.hypot(exteriorLateral,exteriorVertical);
 const roundedBallEnvelopeM=FOOT_CONTACT_ROUNDING_M+BALL_RADIUS;
 const forwardOnlyPossible=orthogonalExteriorM<=roundedBallEnvelopeM;
 const effectiveForwardReachM=FOOT_CONTACT_HALF_LENGTH_M+
  Math.sqrt(Math.max(0,roundedBallEnvelopeM**2-
   orthogonalExteriorM**2));
 const toeForwardDeficitM=Math.max(0,phase.relativeForwardM-
  effectiveForwardReachM);
 const heelBackwardDeficitM=Math.max(0,-phase.relativeForwardM-
  effectiveForwardReachM);
 const requestedAxialDisplacementM=toeForwardDeficitM+
  heelBackwardDeficitM;
 const optimisticForwardTravelRemainingM=PLAYER_MAX_SPEED_MPS*
  PLAYER_DT*(1-phase.sampledProxyAtFraction);
 const remainingFrameMs=(1-phase.sampledProxyAtFraction)*
  PLAYER_DT*1000;
 const optimisticFullSpeedCatchMs=1000*
  requestedAxialDisplacementM/PLAYER_MAX_SPEED_MPS;
 return Object.freeze({
  sampleFraction:phase.sampledProxyAtFraction,
  relativeForwardM:phase.relativeForwardM,
  orthogonalExteriorM,roundedBallEnvelopeM,
  effectiveForwardReachM,
  forwardOnlyPossible,
  toeForwardDeficitM,heelBackwardDeficitM,
  requestedAxialDisplacementM,
  optimisticForwardTravelRemainingM,remainingFrameMs,
  optimisticFullSpeedCatchMs,
  // This flag applies ONLY to a frozen ball and an already-available
  // maximum-speed shoe-forward translation in the interpolated frame.
  optimisticStaticBallAxialBudgetSufficient:forwardOnlyPossible&&
   requestedAxialDisplacementM<=optimisticForwardTravelRemainingM+1e-12,
  realRapierShoeContactInferred:false,
  naturalFootballShotInferred:false,
  trajectoryIsInterpolatedNotSwept:true
 });
}
function study(R,c,mode){
 const engine=createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),OPT[mode]);
 const shadow=createPlayerMovement({
  experimentalAiKickApproach:true,
  experimentalAutonomousFixtureContactChase:true,
  experimentalAutonomousFixtureCarry:true,
  experimentalAutonomousFixtureCarrySupport:true,
  experimentalAutonomousFixtureCarrySupportPressHandoff:true,
  experimentalAutonomousFixtureCarrySupportBallAccess:true,
  experimentalAutonomousFixtureCarrySupportLateralAlign:true,
  experimentalAutonomousFixtureCarrySupportEarlyFacing:true,
  experimentalAutonomousFixtureCarrySupportShoeCenterTarget:true,
  ...(mode!=='center'?{
   experimentalAutonomousFixtureCarrySupportFootLateralLead:true}:{}),
  ...(['velocity','terminal','runway','slip','longitudinal'].includes(mode)?{
   experimentalAutonomousFixtureCarrySupportObservedBallVelocityLead:true}:{}),
  ...(['terminal','runway','slip','longitudinal'].includes(mode)?{
   experimentalAutonomousFixtureCarrySupportTerminalFacingLead:true}:{}),
  ...(mode==='runway'?{
   experimentalAutonomousFixtureCarrySupportTerminalRunThrough:true}:{}),
  ...(mode==='slip'?{
   experimentalAutonomousFixtureCarrySupportTerminalLateralSlip:true}:{}),
  ...(mode==='longitudinal'?{
   experimentalAutonomousFixtureCarrySupportLongitudinalLead:true}:{})
 });
 return {mode,team:c.team,engine,shadow,pass:null,carry:null,
  lastMove:null,
  stats:{earlyFrames:0,firstEarly:null,lastEarly:null,
   centerFrames:0,firstCenter:null,lastCenter:null,
   maxCenterCorrectionM:0,
   leadFrames:0,firstLead:null,lastLead:null,maxLeadCorrectionM:0,
   velocityFrames:0,firstVelocity:null,lastVelocity:null,
   maxVelocityCorrectionM:0,
   terminalFrames:0,firstTerminal:null,lastTerminal:null,
   maxTerminalLeadM:0,
   runwayFrames:0,firstRunway:null,lastRunway:null,
   maxRunwayCorrectionM:0,
   slipFrames:0,firstSlip:null,lastSlip:null,
   maxSlipCorrectionM:0,maxLocalLateralSpeedMps:0,
   sourceBoundAccess:0,maxActualTurnRad:0,
   realShoeSTART:0,newForwardShoeSTART:0,
   physicalAction:[],naturalShots:[],
   minStaticClearanceM:Infinity,minStaticClearanceTick:null,
   maxBallAdvance:0,minShotRangeShortfall:Infinity,
   closest:{samples:0,interiorCenterFrames:0,radialTurningFrames:0,
    bestProxy:null,bestCenter:null,nearby:[]},
   longitudinal:{samples:0,otherAxisCannotClose:0,
    staticBallBudgetInsufficient:0,toeAheadMissSamples:0},
   checkpoints:[]}};
}
function replayStep(s,c){
 const before=s.engine.snapshot(),prior=s.shadow.snapshot();
 const tick=before.physicsTick+1;
 assert.equal(prior.tick,tick-1);
 const moved=s.shadow.step(before.ball.position);
 const frame=s.engine.step();
 s.lastMove=moved;
 assert.equal(frame.physicsTick,tick);
 assert.equal(moved.tick,tick);
 assert.equal(frame.officialMatchResult,null);
 assert.equal(frame.officialMatchPossession,false);
 assert.equal(frame.productionScoringConnected,false);
 assert.equal(frame.physicalShotBoundary.goalScored,null);
 assert.equal(frame.autonomousCarrySupportEarlyFacingMode,true);
 assert.equal(frame.autonomousCarrySupportShoeCenterTargetMode,true);
 assert.equal(frame.autonomousCarrySupportFootLateralLeadMode,
  s.mode==='center'?undefined:true);
 assert.equal(frame.autonomousCarrySupportObservedBallVelocityLeadMode,
  ['velocity','terminal','runway','slip','longitudinal'].includes(s.mode)?true:undefined);
 assert.equal(frame.autonomousCarrySupportTerminalFacingLeadMode,
  ['terminal','runway','slip','longitudinal'].includes(s.mode)?true:undefined);
 assert.equal(frame.autonomousCarrySupportTerminalRunThroughMode,
  s.mode==='runway'?true:undefined);
 assert.equal(frame.autonomousCarrySupportTerminalLateralSlipMode,
  s.mode==='slip'?true:undefined);
 assert.equal(frame.autonomousCarrySupportLongitudinalLeadMode,
  s.mode==='longitudinal'?true:undefined);
 assert.equal(frame.physicalPlayerPositions.length,22);
 assert.equal(moved.players.length,22);
 for(let i=0;i<22;i++){
  const p=moved.players[i],old=prior.players[i];
  const real=frame.physicalPlayerPositions[i];
  assert.equal(p.id,INITIAL_PLAYERS[i].id);
  assert.equal(real.engineId,p.id);
  assert.equal(real.team,p.team);
  assert.ok(Math.abs(p.x-real.x)<1e-9);
  assert.ok(Math.abs(p.y-real.y)<1e-9);
  assert.ok(xy(p,old)<=PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-5);
  const turned=Math.abs(wrap(p.facingRad-old.facingRad));
  assert.ok(turned<=PLAYER_TURN_RAD_PER_S*PLAYER_DT+1e-5,
   'no actor may turn faster than the real 6rad/s shoe limit');
  s.stats.maxActualTurnRad=Math.max(s.stats.maxActualTurnRad,turned);
 }
 const actor=moved.players.find(p=>p.id===s.team+'-10');
 const old=prior.players.find(p=>p.id===actor.id);
 assert.ok(old);
 const access=moved.provisionalCarrySupportBallAccess??null;
 const early=access?.earlyFacing??null;
 assert.equal(
  Object.hasOwn(moved,'provisionalCarrySupportBallAccess'),true);
 const center=access?.shoeCenterTarget??null;
 assert.equal(Boolean(center),Boolean(access));
 const lead=access?.footLateralLead??null;
 if(s.mode==='center')assert.equal(lead,null);
 if(s.mode!=='center')assert.equal(Boolean(lead),Boolean(access));
 const velocity=access?.observedBallVelocityLead??null;
 if(!['velocity','terminal','runway','slip','longitudinal'].includes(s.mode))
  assert.equal(velocity,null);
 else assert.equal(Boolean(velocity),Boolean(access));
 const terminal=access?.terminalFacingLead??null;
 if(!['terminal','runway','slip','longitudinal'].includes(s.mode))
  assert.equal(terminal,null);
 else assert.equal(Boolean(terminal),
  Boolean(access&&access.bodyBallGapM<=1.25));
 const runway=access?.terminalRunThrough??null;
 if(s.mode!=='runway')assert.equal(runway,null);
 else assert.equal(Boolean(runway),
  Boolean(access&&access.bodyBallGapM<=1.25));
 const slip=access?.terminalLateralSlip??null;
 if(s.mode!=='slip')assert.equal(slip,null);
 else assert.equal(Boolean(slip),
  Boolean(access&&access.bodyBallGapM<=1.25));
 const long=access?.terminalLongitudinalLead??null;
 if(s.mode==='longitudinal'){
  assert.equal(Boolean(long),Boolean(access&&access.bodyBallGapM<=1.25));
 }else assert.equal(long,null);
 if(long){
  assert.equal(long.source,'authenticated-two-previous-rapier-ball-forward-toe-lead');
  assert.equal(long.sourcePassTick,s.pass?.tick);
  assert.equal(long.sourceCarryTick,s.carry?.tick);
  assert.equal(long.latestSourcePhysicsTick,prior.tick);
  assert.equal(long.earlierSourcePhysicsTick,prior.tick-1);
  assert.deepEqual(long.earlierRealBall,prior.ball);
  assert.deepEqual(long.latestRealBall,
   {x:before.ball.position.x,y:before.ball.position.y});
  assert.deepEqual(long.projectedBallPosition,terminal.projectedBallPosition);
  assert.deepEqual(long.preStepActor,
   {x:old.x,y:old.y,facingRad:old.facingRad});
  assert.equal(long.bodyBallGapM,access.bodyBallGapM);
  assert.equal(long.existingToeReachFromBodyM,0.455);
  assert.equal(long.correctionCapM,0.40);
  const co=Math.cos(old.facingRad),si=Math.sin(old.facingRad);
  const projected=co*(long.projectedBallPosition.x-old.x)+
   si*(long.projectedBallPosition.y-old.y);
  assert.ok(Math.abs(long.projectedBallForwardM-projected)<1e-9);
  const requested=Math.max(0,Math.min(0.4,projected-0.455));
  assert.ok(Math.abs(long.requestedForwardCorrectionM-requested)<1e-9);
  assert.deepEqual(long.parentTarget,velocity.target);
  const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
  const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  assert.deepEqual(long.target,{
   x:clamp(velocity.target.x+co*requested,-halfX,halfX),
   y:clamp(velocity.target.y+si*requested,-halfY,halfY)
  });
  assert.deepEqual(access.target,long.target);
  assert.ok(long.appliedCorrectionM>=0&&long.appliedCorrectionM<=0.4+1e-9);
  assert.equal(long.previousRealBallOnly,true);
  assert.equal(long.forwardTacticalTargetOnly,true);
  assert.equal(long.normalMovementIntegratorUnchanged,true);
  assert.equal(long.rapierShoeUnchanged,true);
  assert.equal(long.physicalContactInferred,false);
  assert.equal(long.footballActionExecuted,false);
  assert.equal(long.officialMatchResult,null);
 }
 if(access){
  assert.equal(access.playerId,actor.id);
  assert.equal(access.team,s.team);
  assert.equal(access.sourcePassTick,s.pass?.tick);
  assert.equal(access.sourceCarryTick,s.carry?.tick);
  assert.ok(s.pass.tick<s.carry.tick&&s.carry.tick<tick);
  assert.ok(tick-s.carry.tick<=150&&tick-s.pass.tick<=480);
  assert.ok(access.bodyBallGapM<=4+1e-9);
  assert.equal(access.physicalShoeStartObserved,false);
  assert.equal(access.footballActionExecuted,false);
  assert.equal(access.officialMatchPossession,false);
  s.stats.sourceBoundAccess++;
 }
 assert.equal(!!early,!!access);
 if(center){
  assert.equal(center.source,
   'previous-real-ball-and-pre-step-physical-shoe-center');
  assert.equal(center.sourcePassTick,s.pass.tick);
  assert.equal(center.sourceCarryTick,s.carry.tick);
  assert.equal(center.preStepFacingRad,old.facingRad);
  assert.equal(center.correctionLimitM,0.30);
  assert.equal(center.boundedMovementTargetOnly,true);
  assert.equal(center.shoeColliderUnchanged,true);
  assert.equal(center.physicalContactInferred,false);
  assert.equal(center.footballActionExecuted,false);
  assert.equal(center.officialMatchResult,null);
  assert.deepEqual(center.realPreviousBall,
   {x:before.ball.position.x,y:before.ball.position.y});
  const attack=actor.team==='home'?1:-1;
  const boundX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
  const boundY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
  const clamp=(v,low,high)=>Math.max(low,Math.min(high,v));
  const lateralShift=access.lateralAlignment.lateralTargetShiftM;
  const original={x:clamp(before.ball.position.x-attack*0.26,
    -boundX,boundX),
   y:clamp(before.ball.position.y+lateralShift,-boundY,boundY)};
  const raw={x:clamp(before.ball.position.x-
    0.22*Math.cos(old.facingRad),-boundX,boundX),
   y:clamp(before.ball.position.y-
    0.22*Math.sin(old.facingRad),-boundY,boundY)};
  assert.deepEqual(center.originalTarget,original);
  assert.deepEqual(center.rawShoeCenterTarget,raw);
  const shift=xy(center.target,original);
  assert.ok(shift<=0.30+1e-9);
  assert.ok(Math.abs(shift-center.appliedCorrectionM)<1e-12);
  assert.deepEqual(center.target,
   lead?.parentTarget??access.target);
  if(xy(raw,original)<=0.30){
   assert.ok(xy(center.target,raw)<1e-9);
  }else{
   assert.ok(Math.abs(shift-0.30)<1e-9);
  }
  s.stats.centerFrames++;
  s.stats.maxCenterCorrectionM=Math.max(
   s.stats.maxCenterCorrectionM,shift);
  if(s.stats.firstCenter===null)s.stats.firstCenter=tick;
  s.stats.lastCenter=tick;
 }
 if(lead){
  assert.equal(lead.source,
   'authenticated-previous-real-ball-pre-step-shoe-lateral');
  assert.equal(lead.sourcePassTick,s.pass.tick);
  assert.equal(lead.sourceCarryTick,s.carry.tick);
  assert.deepEqual(lead.realPreviousBall,
   {x:before.ball.position.x,y:before.ball.position.y});
  assert.equal(lead.preStepFacingRad,old.facingRad);
  assert.equal(lead.gain,1.75);
  assert.equal(lead.correctionLimitM,0.45);
  assert.equal(lead.pureLateralIntentOnly,true);
  assert.equal(lead.normalBodyIntegratorUnchanged,true);
  assert.equal(lead.shoeColliderUnchanged,true);
  assert.equal(lead.physicalContactInferred,false);
  assert.equal(lead.footballActionExecuted,false);
  assert.equal(lead.officialMatchResult,null);
  const c=Math.cos(old.facingRad),si=Math.sin(old.facingRad);
  const lateral=-si*(before.ball.position.x-old.x)+
   c*(before.ball.position.y-old.y);
  const requested=Math.max(-0.45,Math.min(0.45,lateral*1.75));
  assert.ok(Math.abs(lead.measuredLocalLateralM-lateral)<1e-10);
  assert.ok(Math.abs(lead.requestedCorrectionM-requested)<1e-10);
  const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
  const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
  const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
  const expected={
   x:clamp(center.target.x-si*requested,-halfX,halfX),
   y:clamp(center.target.y+c*requested,-halfY,halfY)
  };
  assert.deepEqual(lead.parentTarget,center.target);
  assert.deepEqual(lead.target,expected);
  assert.deepEqual(lead.target,expected);
  assert.deepEqual(access.target,
   long?.target??slip?.target??runway?.target??velocity?.target??expected);
  const shifted=xy(lead.target,center.target);
  assert.ok(shifted<=0.45+1e-9);
  assert.ok(Math.abs(shifted-lead.appliedCorrectionM)<1e-10);
  // Except at field borders, the correction is genuinely lateral
  // to the pre-step shoe: no forward impulse or actor translation.
  if(Math.abs(lead.target.x)<halfX-1e-8&&
     Math.abs(lead.target.y)<halfY-1e-8){
   const dx=lead.target.x-center.target.x;
   const dy=lead.target.y-center.target.y;
   assert.ok(Math.abs(dx*c+dy*si)<1e-9);
  }
  s.stats.leadFrames++;
  s.stats.maxLeadCorrectionM=Math.max(
   s.stats.maxLeadCorrectionM,shifted);
  if(s.stats.firstLead===null)s.stats.firstLead=tick;
  s.stats.lastLead=tick;
 }
 if(velocity){
  assert.equal(velocity.source,
   'two-prior-consecutive-authentic-rapier-ball-samples');
  assert.equal(velocity.sourcePassTick,s.pass.tick);
  assert.equal(velocity.sourceCarryTick,s.carry.tick);
  assert.equal(velocity.latestSourcePhysicsTick,prior.tick);
  assert.equal(velocity.earlierSourcePhysicsTick,prior.tick-1);
  assert.ok(velocity.earlierSourcePhysicsTick>=0);
  const earlier={x:prior.ball.x,y:prior.ball.y};
  const latest={x:before.ball.position.x,y:before.ball.position.y};
  assert.deepEqual(velocity.earlierObservedBall,earlier);
  assert.deepEqual(velocity.latestObservedBall,latest);
  const delta={x:latest.x-earlier.x,y:latest.y-earlier.y};
  assert.deepEqual(velocity.observedDisplacementPerTickM,delta);
  assert.equal(velocity.horizonTicks,12);
  assert.equal(velocity.horizonSeconds,12*PLAYER_DT);
  assert.deepEqual(velocity.rawRequestedDisplacementM,
   {x:12*delta.x,y:12*delta.y});
  assert.equal(velocity.correctionLimitM,0.50);
  assert.equal(velocity.boundedTacticalDestinationOnly,true);
  assert.equal(velocity.futurePhysicalSampleRead,false);
  assert.equal(velocity.physicalContactInferred,false);
  assert.equal(velocity.shoeColliderUnchanged,true);
  assert.equal(velocity.footballActionExecuted,false);
  assert.equal(velocity.officialMatchResult,null);
  assert.deepEqual(velocity.parentTarget,lead.target);
  const requested={x:12*delta.x,y:12*delta.y};
  const length=Math.hypot(requested.x,requested.y);
  const scale=length>0.5?0.5/length:1;
  const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
  const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const expected={
   x:clamp(lead.target.x+requested.x*scale,-halfX,halfX),
   y:clamp(lead.target.y+requested.y*scale,-halfY,halfY)
  };
  assert.deepEqual(velocity.target,expected);
  assert.deepEqual(access.target,
   long?.target??slip?.target??runway?.target??expected);
  const correction=xy(expected,lead.target);
  assert.ok(correction<=0.50+1e-9);
  assert.ok(Math.abs(velocity.appliedCorrectionM-correction)<1e-10);
  s.stats.velocityFrames++;
  s.stats.maxVelocityCorrectionM=Math.max(
   s.stats.maxVelocityCorrectionM,correction);
  if(s.stats.firstVelocity===null)s.stats.firstVelocity=tick;
  s.stats.lastVelocity=tick;
 }
 if(terminal){
  assert.equal(terminal.source,
   'source-bound-two-observed-rapier-ball-terminal-shoe-facing');
  assert.equal(terminal.sourcePassTick,s.pass.tick);
  assert.equal(terminal.sourceCarryTick,s.carry.tick);
  assert.equal(terminal.earlierSourcePhysicsTick,prior.tick-1);
  assert.equal(terminal.latestSourcePhysicsTick,prior.tick);
  assert.deepEqual(terminal.earlierObservedBall,prior.ball);
  assert.deepEqual(terminal.latestObservedBall,
   {x:before.ball.position.x,y:before.ball.position.y});
  assert.deepEqual(terminal.observedBallDelta,
   {x:before.ball.position.x-prior.ball.x,
    y:before.ball.position.y-prior.ball.y});
  assert.equal(terminal.preStepFacingRad,old.facingRad);
  assert.ok(terminal.bodyBallGapM<=terminal.terminalRadiusM+1e-10);
  assert.equal(terminal.terminalRadiusM,1.25);
  assert.equal(terminal.predictionTicks,6);
  assert.equal(terminal.predictionSeconds,6*PLAYER_DT);
  assert.equal(terminal.predictionMaxDistanceM,0.30);
  assert.equal(terminal.maxTurnRad,PLAYER_TURN_RAD_PER_S*PLAYER_DT);
  assert.equal(terminal.normalBodyDestinationUnchanged,true);
  assert.equal(terminal.angularSteeringIntentOnly,true);
  assert.equal(terminal.futureActualBallRead,false);
  assert.equal(terminal.rapierShoeUnchanged,true);
  assert.equal(terminal.physicalContactInferred,false);
  assert.equal(terminal.footballActionExecuted,false);
  assert.equal(terminal.officialMatchResult,null);
  const raw={x:terminal.observedBallDelta.x*6,
   y:terminal.observedBallDelta.y*6};
  const length=Math.hypot(raw.x,raw.y),scale=length>0.30?
   0.30/length:1;
  const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
  const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const expected={x:clamp(before.ball.position.x+raw.x*scale,
   -halfX,halfX),y:clamp(before.ball.position.y+raw.y*scale,
   -halfY,halfY)};
  assert.deepEqual(terminal.projectedBallPosition,expected);
  assert.ok(xy(expected,before.ball.position)<=0.30+1e-9);
  assert.ok(Math.abs(wrap(terminal.desiredFacingRad-
   Math.atan2(expected.y-old.y,expected.x-old.x)))<1e-10);
  assert.ok(Math.abs(wrap(terminal.desiredFacingRad-
   early.desiredFacingRad))<1e-10);
  s.stats.terminalFrames++;
  s.stats.maxTerminalLeadM=Math.max(
   s.stats.maxTerminalLeadM,xy(expected,before.ball.position));
  if(s.stats.firstTerminal===null)s.stats.firstTerminal=tick;
  s.stats.lastTerminal=tick;
 }
 if(runway){
  assert.equal(runway.source,
   'authenticated-terminal-observed-ball-run-through-corridor');
  assert.equal(runway.sourcePassTick,s.pass.tick);
  assert.equal(runway.sourceCarryTick,s.carry.tick);
  assert.equal(runway.latestSourcePhysicsTick,prior.tick);
  assert.equal(runway.earlierSourcePhysicsTick,prior.tick-1);
  assert.deepEqual(runway.latestActualBall,
   {x:before.ball.position.x,y:before.ball.position.y});
  assert.deepEqual(runway.earlierActualBall,prior.ball);
  assert.deepEqual(runway.projectedBallPosition,
   terminal.projectedBallPosition);
  assert.deepEqual(runway.preStepActor,
   {x:old.x,y:old.y,facingRad:old.facingRad});
  assert.equal(runway.currentBodyGapM,access.bodyBallGapM);
  assert.equal(runway.maxEligibleBodyGapM,1.25);
  assert.ok(runway.currentBodyGapM<=1.25+1e-10);
  assert.equal(runway.beyondObservedBallM,0.55);
  assert.equal(runway.maximumTargetCorrectionM,0.90);
  assert.equal(runway.usualPlayerVelocityCapsUnchanged,true);
  assert.equal(runway.sameRapierShoeCollider,true);
  assert.equal(runway.tacticalTargetOnly,true);
  assert.equal(runway.futureActualBallRead,false);
  assert.equal(runway.physicalContactInferred,false);
  assert.equal(runway.footballActionExecuted,false);
  assert.equal(runway.officialMatchResult,null);
  assert.deepEqual(runway.parentTarget,velocity.target);
  const pd=runway.projectedBallPosition;
  const dd={x:pd.x-old.x,y:pd.y-old.y};
  const distance=Math.hypot(dd.x,dd.y);
  const unit=distance>1e-8?
   {x:dd.x/distance,y:dd.y/distance}:
   {x:Math.cos(old.facingRad),y:Math.sin(old.facingRad)};
  assert.deepEqual(runway.approachUnit,unit);
  const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
  const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const raw={x:clamp(pd.x+0.55*unit.x,-halfX,halfX),
   y:clamp(pd.y+0.55*unit.y,-halfY,halfY)};
  assert.deepEqual(runway.rawRunThroughTarget,raw);
  const dx=raw.x-velocity.target.x,dy=raw.y-velocity.target.y;
  const length=Math.hypot(dx,dy),scale=length>0.90?0.90/length:1;
  const expected={
   x:clamp(velocity.target.x+dx*scale,-halfX,halfX),
   y:clamp(velocity.target.y+dy*scale,-halfY,halfY)
  };
  assert.deepEqual(runway.target,expected);
  assert.deepEqual(access.target,expected);
  const correction=xy(expected,velocity.target);
  assert.ok(correction<=0.90+1e-9);
  assert.ok(Math.abs(runway.appliedTargetCorrectionM-correction)<1e-10);
  s.stats.runwayFrames++;
  s.stats.maxRunwayCorrectionM=Math.max(
   s.stats.maxRunwayCorrectionM,correction);
  if(s.stats.firstRunway===null)s.stats.firstRunway=tick;
  s.stats.lastRunway=tick;
 }
 if(slip){
  assert.equal(slip.source,
   'authenticated-prior-rapier-ball-relative-lateral-velocity');
  assert.equal(slip.sourcePassTick,s.pass.tick);
  assert.equal(slip.sourceCarryTick,s.carry.tick);
  assert.equal(slip.earlierSourcePhysicsTick,prior.tick-1);
  assert.equal(slip.latestSourcePhysicsTick,prior.tick);
  assert.deepEqual(slip.earlierRealBall,prior.ball);
  assert.deepEqual(slip.latestRealBall,
   {x:before.ball.position.x,y:before.ball.position.y});
  assert.deepEqual(slip.preStepActor,
   {x:old.x,y:old.y,vx:old.vx,vy:old.vy,
    facingRad:old.facingRad});
  assert.equal(slip.bodyBallGapM,access.bodyBallGapM);
  assert.equal(slip.terminalRadiusM,1.25);
  assert.ok(slip.bodyBallGapM<=1.25+1e-10);
  const delta={
   x:before.ball.position.x-prior.ball.x-old.vx*PLAYER_DT,
   y:before.ball.position.y-prior.ball.y-old.vy*PLAYER_DT
  };
  assert.deepEqual(slip.observedRelativeXYPerTick,delta);
  const si=Math.sin(old.facingRad),co=Math.cos(old.facingRad);
  const lateral=-si*delta.x+co*delta.y;
  assert.ok(Math.abs(slip.observedLocalLateralPerTick-lateral)<1e-10);
  assert.equal(slip.horizonTicks,6);
  assert.equal(slip.horizonSeconds,6*PLAYER_DT);
  assert.equal(slip.lateralCorrectionCapM,0.40);
  const correction=Math.max(-0.40,Math.min(0.40,lateral*6));
  assert.ok(Math.abs(slip.requestedLateralCorrectionM-
   correction)<1e-10);
  assert.deepEqual(slip.parentTarget,velocity.target);
  const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
  const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
  const clamp=(v,low,high)=>Math.max(low,Math.min(high,v));
  const expected={
   x:clamp(velocity.target.x-si*correction,-halfX,halfX),
   y:clamp(velocity.target.y+co*correction,-halfY,halfY)
  };
  assert.deepEqual(slip.target,expected);
  assert.deepEqual(access.target,expected);
  const actual=xy(expected,velocity.target);
  assert.ok(actual<=0.40+1e-9);
  assert.ok(Math.abs(slip.appliedCorrectionM-actual)<1e-10);
  assert.equal(slip.tacticalTargetOnly,true);
  assert.equal(slip.normalMovementIntegratorUnchanged,true);
  assert.equal(slip.shoeColliderUnchanged,true);
  assert.equal(slip.usesFutureBall,false);
  assert.equal(slip.physicalContactInferred,false);
  assert.equal(slip.footballActionExecuted,false);
  assert.equal(slip.officialMatchResult,null);
  s.stats.slipFrames++;
  s.stats.maxSlipCorrectionM=Math.max(
   s.stats.maxSlipCorrectionM,actual);
  s.stats.maxLocalLateralSpeedMps=Math.max(
   s.stats.maxLocalLateralSpeedMps,Math.abs(lateral)/PLAYER_DT);
  if(s.stats.firstSlip===null)s.stats.firstSlip=tick;
  s.stats.lastSlip=tick;
 }
 if(early){
  assert.equal(early.source,'previous-actual-rapier-ball-and-authentic-carry-support');
  assert.equal(early.sourcePassTick,s.pass.tick);
  assert.equal(early.sourceCarryTick,s.carry.tick);
  assert.equal(early.orientationOnly,true);
  assert.equal(early.bodyTargetUnchanged,true);
  assert.equal(early.futureBallSampleUsed,false);
  assert.equal(early.physicalContactInferred,false);
  assert.equal(early.footballActionExecuted,false);
  assert.equal(early.officialMatchResult,null);
  assert.equal(early.preStepFacingRad,old.facingRad);
  assert.ok(Math.abs(wrap(early.desiredFacingRad-
   (terminal?terminal.desiredFacingRad:
    Math.atan2(before.ball.position.y-old.y,
     before.ball.position.x-old.x))))<1e-10);
  assert.equal(early.maxTurnRad,PLAYER_TURN_RAD_PER_S*PLAYER_DT);
  const expected=wrap(old.facingRad+Math.max(-early.maxTurnRad,
   Math.min(early.maxTurnRad,
    wrap(early.desiredFacingRad-old.facingRad))));
  assert.ok(Math.abs(wrap(actor.facingRad-expected))<1e-9,
   'only rate-limited turn, never forced heading');
  s.stats.earlyFrames++;
  if(s.stats.firstEarly===null)s.stats.firstEarly=tick;
  s.stats.lastEarly=tick;
 }
 // All actions must be triggered by genuine same-step Rapier shoe
 // START+ACTIVE. Angular and static geometry never count as contact.
 const starts=frame.physicalContactFeed.started;
 s.stats.realShoeSTART+=starts.length;
 for(const start of starts){
  assert.ok(frame.physicalContactFeed.active.some(active=>
   active.engineId===start.engineId&&active.team===start.team));
  if(start.engineId===actor.id&&tick>1)
   s.stats.newForwardShoeSTART++;
 }
 const action=frame.localAutonomousAction;
 if(action){
  assert.equal(starts.length,1);
  assert.equal(frame.physicalContactFeed.active.length,1);
  assert.equal(starts[0].engineId,action.playerId);
  assert.equal(starts[0].team,action.team);
  assert.equal(action.tick,tick);
  assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
  assert.equal(action.appliedByRapier,true);
  assert.equal(action.actualPhysicsImpulseApplied,true);
  assert.equal(action.officialMatchAction,false);
  const record={tick,id:action.playerId,team:action.team,
   kind:action.action};
  s.stats.physicalAction.push(record);
  if(action.action==='shot'){
   assert.equal(action.decisionContext.shotRange,true);
   assert.equal(action.shotTarget?.physicsTick,tick);
   assert.equal(action.shotTarget?.shooterId,action.playerId);
   assert.ok(action.shotTarget.laneClearanceM>=2.4);
   s.stats.naturalShots.push(record);
  }
 }
 const shoe=measureOrientedCarryShoeBallGeometry(actor,
  frame.ball.position);
 assert.equal(shoe.actualRapierCollisionInferred,false);
 // Read ONLY after the genuine Rapier step, using the shadow mover
 // already asserted identical to the physics-fed player XY/heading,
 // and exact consecutive physics-ball positions. Reuse the same
 // twelve physical worlds and independent replay; no new simulation.
 if(s.team==='away'&&tick>=650&&tick<=690&&access){
  const witness=inspectConsecutivePhysicalShoePass({
   tick:tick-1,actor:old,ball:before.ball.position
  },{tick,actor,ball:frame.ball.position});
  const axial=inspectOptimisticLongitudinalToeTiming(witness);
  const diagnostic={toeDeficitM:r4(axial.toeForwardDeficitM),
   heelDeficitM:r4(axial.heelBackwardDeficitM),
   otherAxisExteriorM:r4(axial.orthogonalExteriorM),
   forwardOnlyPossible:axial.forwardOnlyPossible,
   optimisticCatchMs:r4(axial.optimisticFullSpeedCatchMs),
   remainingFrameMs:r4(axial.remainingFrameMs),
   optimisticAvailableTravelM:r4(axial.optimisticForwardTravelRemainingM),
   optimisticStaticBallBudgetSufficient:
    axial.optimisticStaticBallAxialBudgetSufficient};
  const axialCounts=s.stats.longitudinal;
  axialCounts.samples++;
  if(!axial.forwardOnlyPossible)axialCounts.otherAxisCannotClose++;
  if(!axial.optimisticStaticBallAxialBudgetSufficient)
   axialCounts.staticBallBudgetInsufficient++;
  if(axial.toeForwardDeficitM>0)axialCounts.toeAheadMissSamples++;
  const evidence={tick,axial:diagnostic,
   closestFraction:r4(witness.centerClosestFraction),
   proxyFraction:r4(witness.sampledProxyAtFraction),
   sampledProxyGapM:r4(witness.sampledProxyGapM),
   centerClosest3DM:r4(witness.centerClosest3DM),
   limitingAxis:witness.limitingAxis,
   localForwardM:r4(witness.relativeForwardM),
   localLateralM:r4(witness.relativeLateralM),
   localVerticalM:r4(witness.relativeVerticalM),
   radialStartMps:r4(witness.radialClosingMpsAtStart),
   radialEndMps:r4(witness.radialClosingMpsAtEnd),
   lateralMps:r4(witness.lateralMpsInPreStepShoeFrame),
   tangentMps:r4(witness.tangentRelativeMps),
   realForwardSTART:starts.some(x=>x.engineId===actor.id),
   realAction:action?.action??null};
  const closest=s.stats.closest;
  closest.samples++;
  if(witness.interiorCenterClosest)closest.interiorCenterFrames++;
  if(witness.radialTurnFromClosingToReceding)
   closest.radialTurningFrames++;
  if(!closest.bestProxy||
     evidence.sampledProxyGapM<closest.bestProxy.sampledProxyGapM)
   closest.bestProxy=evidence;
  if(!closest.bestCenter||
     evidence.centerClosest3DM<closest.bestCenter.centerClosest3DM)
   closest.bestCenter=evidence;
  if([658,662,665,667,668,670,673,678,683].includes(tick))
   closest.nearby.push(evidence);
  assert.equal(axial.realRapierShoeContactInferred,false);
  assert.equal(axial.naturalFootballShotInferred,false);
  assert.equal(axial.trajectoryIsInterpolatedNotSwept,true);
  assert.equal(witness.rapierSweptCollisionInferred,false);
  assert.equal(witness.genuineShoeStartInferred,false);
  assert.equal(witness.footballActionExecuted,false);
  assert.equal(witness.officialMatchResult,null);
 }

 if(tick>=600&&shoe.estimatedStaticSurfaceClearanceM<
    s.stats.minStaticClearanceM){
  s.stats.minStaticClearanceM=shoe.estimatedStaticSurfaceClearanceM;
  s.stats.minStaticClearanceTick=tick;
 }
 const direction=s.team==='home'?1:-1;
 s.stats.maxBallAdvance=Math.max(s.stats.maxBallAdvance,
  direction*(frame.ball.position.x-c.x));
 const goalX=direction*PLAYER_PITCH.lengthM/2;
 const shortfall=Math.max(0,
  Math.abs(goalX-frame.ball.position.x)-SHOT_MAX_RANGE_M);
 s.stats.minShotRangeShortfall=Math.min(
  s.stats.minShotRangeShortfall,shortfall);
 if(checkpoint.has(tick)||(early&&tick===s.stats.firstEarly)){
  s.stats.checkpoints.push({
   tick,early:!!early,center:!!center,lead:!!lead,
   terminal:!!terminal,runway:!!runway,slip:!!slip,
   slipLocalSpeed:slip?
    r3(slip.observedLocalLateralPerTick/PLAYER_DT):null,
   slipCorrection:slip?r3(slip.appliedCorrectionM):null,
   runwayTarget:runway?{x:r3(runway.target.x),
    y:r3(runway.target.y)}:null,
   terminalDesired:terminal?r3(terminal.desiredFacingRad):null,
   velocity:!!velocity,
   velocityShift:velocity?r3(velocity.appliedCorrectionM):null,
   leadShift:lead?r3(lead.appliedCorrectionM):null,
   centerTarget:center?{x:r3(center.target.x),y:r3(center.target.y)}:null,
   authenticated:!!access,
   desiredFacing:early?r3(early.desiredFacingRad):null,
   facing:r3(actor.facingRad),headingDelta:r3(
    Math.abs(wrap(actor.facingRad-old.facingRad))),
   bodyGap:r3(shoe.bodyBallXYGapM),
   staticShoeGap:r3(shoe.estimatedStaticSurfaceClearanceM),
   realForwardSTART:starts.some(x=>x.engineId===actor.id),
   source:access?{pass:access.sourcePassTick,
    carry:access.sourceCarryTick}:null,
   ball:{x:r3(frame.ball.position.x),y:r3(frame.ball.position.y)},
   realAction:action?{id:action.playerId,kind:action.action}:null
  });
 }
 if(action?.action==='pass'){
  s.shadow.observeAuthenticFixturePass(action);
  s.pass=action;s.carry=null;
 }else if(action?.action==='carry'){
  s.shadow.observeAuthenticFixtureCarry(action);
  s.carry=action;
 }else if(action){
  s.shadow.clearFixtureCarryOnOtherAction(action);
  s.carry=null;
 }
 for(const id of frame.footContact.ended)
  s.shadow.observeAuthenticFixtureCarryShoeEnd(id,tick);
 return frame;
}
const output=s=>({
 mode:s.mode,team:s.team,earlyFrames:s.stats.earlyFrames,
 firstEarly:s.stats.firstEarly,lastEarly:s.stats.lastEarly,
 centerFrames:s.stats.centerFrames,firstCenter:s.stats.firstCenter,
 lastCenter:s.stats.lastCenter,
 maxCenterCorrectionM:r3(s.stats.maxCenterCorrectionM),
 leadFrames:s.stats.leadFrames,
 firstLead:s.stats.firstLead,lastLead:s.stats.lastLead,
 maxLeadCorrectionM:r3(s.stats.maxLeadCorrectionM),
 velocityFrames:s.stats.velocityFrames,
 firstVelocity:s.stats.firstVelocity,lastVelocity:s.stats.lastVelocity,
 maxVelocityCorrectionM:r3(s.stats.maxVelocityCorrectionM),
 terminalFrames:s.stats.terminalFrames,
 firstTerminal:s.stats.firstTerminal,lastTerminal:s.stats.lastTerminal,
 maxTerminalLeadM:r3(s.stats.maxTerminalLeadM),
 runwayFrames:s.stats.runwayFrames,
 firstRunway:s.stats.firstRunway,lastRunway:s.stats.lastRunway,
 maxRunwayCorrectionM:r3(s.stats.maxRunwayCorrectionM),
 slipFrames:s.stats.slipFrames,
 firstSlip:s.stats.firstSlip,lastSlip:s.stats.lastSlip,
 maxSlipCorrectionM:r3(s.stats.maxSlipCorrectionM),
 maxLocalLateralSpeedMps:r3(s.stats.maxLocalLateralSpeedMps),
 authenticatedAccessFrames:s.stats.sourceBoundAccess,
 maxActualTurnRad:r3(s.stats.maxActualTurnRad),
 realShoeStarts:s.stats.realShoeSTART,
 postInitialForwardRealStarts:s.stats.newForwardShoeSTART,
 naturalShots:s.stats.naturalShots,physicalActions:s.stats.physicalAction,
 minShoeClearanceM:r3(s.stats.minStaticClearanceM),
 minShoeTick:s.stats.minStaticClearanceTick,
 closestApproach:s.stats.closest,
 longitudinalTiming:s.stats.longitudinal,
 maxAttackingBallAdvanceM:r3(s.stats.maxBallAdvance),
 minShotZoneShortfallM:r3(s.stats.minShotRangeShortfall),
 checkpoints:s.stats.checkpoints.filter(x=>
  [634,635,640,650,664,675,683,693,694,700].includes(x.tick))
});
test('C2.3y sealed lateral-intercept opt-in, reset, invalid injection, original center opt-out',async()=>{
 const R=await initializeRapier(rapier),c=CASES[1];
 const lead=createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),OPT.lead);
 try{
  assert.equal(lead.snapshot().autonomousCarrySupportFootLateralLeadMode,true);
  const reset=lead.reset();
  try{
   assert.equal(reset.snapshot().autonomousCarrySupportFootLateralLeadMode,true);
   for(let i=0;i<30;i++)reset.step();
   assert.equal(reset.snapshot().physicsTick,30);
  }finally{reset.dispose();}
 }finally{lead.dispose();}
 for(const invalid of [
  {autonomousCarrySupportFootLateralLead:true},
  {...BASE,autonomousCarrySupportFootLateralLead:true},
  {...OPT.center,autonomousCarrySupportFootLateralLead:false},
  {...OPT.lead,autonomousCarrySupportShoeCenterTarget:false},
  {...OPT.lead,autonomousCarrySupportEarlyFacing:false},
  {...OPT.lead,autonomousCarrySupportBallAccess:false},
  {...OPT.lead,autonomousCarrySupportLateralAlign:false},
  {...OPT.lead,autonomousCarrySupportPressHandoff:false},
  {...OPT.lead,autonomousActions:false},
  {...OPT.lead,researchShotAttacker:'away'}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(R,
  fixture(c),scene(c),invalid));
 for(const invalid of [
  {experimentalAutonomousFixtureCarrySupportFootLateralLead:true},
  {experimentalAiKickApproach:true,
   experimentalAutonomousFixtureContactChase:true,
   experimentalAutonomousFixtureCarry:true,
   experimentalAutonomousFixtureCarrySupport:true,
   experimentalAutonomousFixtureCarrySupportPressHandoff:true,
   experimentalAutonomousFixtureCarrySupportBallAccess:true,
   experimentalAutonomousFixtureCarrySupportLateralAlign:true,
   experimentalAutonomousFixtureCarrySupportEarlyFacing:true,
   experimentalAutonomousFixtureCarrySupportFootLateralLead:true}
 ])assert.throws(()=>createPlayerMovement(invalid));
 for(const opts of [{},OPT.center]){
  const engine=createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),opts);
  try{
   assert.equal(Object.hasOwn(engine.snapshot(),
    'autonomousCarrySupportFootLateralLeadMode'),false);
   for(let i=0;i<30;i++)engine.step();
  }finally{engine.dispose();}
 }
});
test('C2.3z strict velocity lead opt-in, reset, invalid injection and ordinary opt-out',async()=>{
 const R=await initializeRapier(rapier),c=CASES[1];
 const candidate=createPhysicalFixtureStepRuntime(R,
  fixture(c),scene(c),OPT.velocity);
 try{
  assert.equal(candidate.snapshot().
   autonomousCarrySupportObservedBallVelocityLeadMode,true);
  const reset=candidate.reset();
  try{
   assert.equal(reset.snapshot().
    autonomousCarrySupportObservedBallVelocityLeadMode,true);
   for(let t=0;t<30;t++)reset.step();
   assert.equal(reset.snapshot().physicsTick,30);
  }finally{reset.dispose();}
 }finally{candidate.dispose();}
 for(const invalid of [
  {autonomousCarrySupportObservedBallVelocityLead:true},
  {...CENTER,autonomousCarrySupportObservedBallVelocityLead:true},
  {...OPT.lead,autonomousCarrySupportObservedBallVelocityLead:false},
  {...OPT.velocity,autonomousCarrySupportFootLateralLead:false},
  {...OPT.velocity,autonomousCarrySupportShoeCenterTarget:false},
  {...OPT.velocity,autonomousCarrySupportEarlyFacing:false},
  {...OPT.velocity,autonomousCarrySupportBallAccess:false},
  {...OPT.velocity,autonomousCarrySupportPressHandoff:false},
  {...OPT.velocity,autonomousActions:false},
  {...OPT.velocity,researchShotAttacker:'away'}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(R,
  fixture(c),scene(c),invalid));
 for(const invalid of [
  {experimentalAutonomousFixtureCarrySupportObservedBallVelocityLead:true},
  {experimentalAiKickApproach:true,
   experimentalAutonomousFixtureContactChase:true,
   experimentalAutonomousFixtureCarry:true,
   experimentalAutonomousFixtureCarrySupport:true,
   experimentalAutonomousFixtureCarrySupportPressHandoff:true,
   experimentalAutonomousFixtureCarrySupportBallAccess:true,
   experimentalAutonomousFixtureCarrySupportLateralAlign:true,
   experimentalAutonomousFixtureCarrySupportEarlyFacing:true,
   experimentalAutonomousFixtureCarrySupportShoeCenterTarget:true,
   experimentalAutonomousFixtureCarrySupportObservedBallVelocityLead:true}
 ])assert.throws(()=>createPlayerMovement(invalid));
 for(const opts of [{},OPT.lead]){
  const ordinary=createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),opts);
  try{
   assert.equal(Object.hasOwn(ordinary.snapshot(),
    'autonomousCarrySupportObservedBallVelocityLeadMode'),false);
   for(let t=0;t<30;t++)ordinary.step();
  }finally{ordinary.dispose();}
 }
});
test('C2.3aa sealed terminal predicted facing opt-in and reset without future-ball leakage',async()=>{
 const R=await initializeRapier(rapier),c=CASES[1];
 const runner=createPhysicalFixtureStepRuntime(R,
  fixture(c),scene(c),OPT.terminal);
 try{
  assert.equal(runner.snapshot().
   autonomousCarrySupportTerminalFacingLeadMode,true);
  const reset=runner.reset();
  try{
   assert.equal(reset.snapshot().
    autonomousCarrySupportTerminalFacingLeadMode,true);
   for(let t=0;t<30;t++)reset.step();
   assert.equal(reset.snapshot().physicsTick,30);
  }finally{reset.dispose();}
 }finally{runner.dispose();}
 for(const invalid of [
  {autonomousCarrySupportTerminalFacingLead:true},
  {...OPT.velocity,autonomousCarrySupportTerminalFacingLead:false},
  {...OPT.terminal,autonomousCarrySupportObservedBallVelocityLead:false},
  {...OPT.terminal,autonomousCarrySupportFootLateralLead:false},
  {...OPT.terminal,autonomousCarrySupportShoeCenterTarget:false},
  {...OPT.terminal,autonomousCarrySupportEarlyFacing:false},
  {...OPT.terminal,autonomousCarrySupportBallAccess:false},
  {...OPT.terminal,autonomousActions:false},
  {...OPT.terminal,researchShotAttacker:'away'}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(
  R,fixture(c),scene(c),invalid));
 for(const invalid of [
  {experimentalAutonomousFixtureCarrySupportTerminalFacingLead:true},
  {experimentalAiKickApproach:true,
   experimentalAutonomousFixtureContactChase:true,
   experimentalAutonomousFixtureCarry:true,
   experimentalAutonomousFixtureCarrySupport:true,
   experimentalAutonomousFixtureCarrySupportPressHandoff:true,
   experimentalAutonomousFixtureCarrySupportBallAccess:true,
   experimentalAutonomousFixtureCarrySupportLateralAlign:true,
   experimentalAutonomousFixtureCarrySupportEarlyFacing:true,
   experimentalAutonomousFixtureCarrySupportShoeCenterTarget:true,
   experimentalAutonomousFixtureCarrySupportFootLateralLead:true,
   experimentalAutonomousFixtureCarrySupportTerminalFacingLead:true}
 ])assert.throws(()=>createPlayerMovement(invalid));
 const basic=createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),
  OPT.velocity);
 try{
  assert.equal(Object.hasOwn(basic.snapshot(),
   'autonomousCarrySupportTerminalFacingLeadMode'),false);
 }finally{basic.dispose();}
});
test('C2.3ab sealed terminal ball run-through, normal mover limits and strict opt-out',async()=>{
 const R=await initializeRapier(rapier),c=CASES[1];
 const runner=createPhysicalFixtureStepRuntime(R,
  fixture(c),scene(c),OPT.runway);
 try{
  assert.equal(runner.snapshot().
   autonomousCarrySupportTerminalRunThroughMode,true);
  const reset=runner.reset();
  try{
   assert.equal(reset.snapshot().
    autonomousCarrySupportTerminalRunThroughMode,true);
   for(let t=0;t<30;t++)reset.step();
   assert.equal(reset.snapshot().physicsTick,30);
  }finally{reset.dispose();}
 }finally{runner.dispose();}
 for(const invalid of [
  {autonomousCarrySupportTerminalRunThrough:true},
  {...OPT.terminal,autonomousCarrySupportTerminalRunThrough:false},
  {...OPT.runway,autonomousCarrySupportTerminalFacingLead:false},
  {...OPT.runway,autonomousCarrySupportObservedBallVelocityLead:false},
  {...OPT.runway,autonomousCarrySupportFootLateralLead:false},
  {...OPT.runway,autonomousCarrySupportShoeCenterTarget:false},
  {...OPT.runway,autonomousCarrySupportEarlyFacing:false},
  {...OPT.runway,autonomousCarrySupportBallAccess:false},
  {...OPT.runway,autonomousActions:false},
  {...OPT.runway,researchShotAttacker:'away'}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(R,
  fixture(c),scene(c),invalid));
 for(const invalid of [
  {experimentalAutonomousFixtureCarrySupportTerminalRunThrough:true},
  {experimentalAiKickApproach:true,
   experimentalAutonomousFixtureContactChase:true,
   experimentalAutonomousFixtureCarry:true,
   experimentalAutonomousFixtureCarrySupport:true,
   experimentalAutonomousFixtureCarrySupportPressHandoff:true,
   experimentalAutonomousFixtureCarrySupportBallAccess:true,
   experimentalAutonomousFixtureCarrySupportLateralAlign:true,
   experimentalAutonomousFixtureCarrySupportEarlyFacing:true,
   experimentalAutonomousFixtureCarrySupportShoeCenterTarget:true,
   experimentalAutonomousFixtureCarrySupportFootLateralLead:true,
   experimentalAutonomousFixtureCarrySupportObservedBallVelocityLead:true,
   experimentalAutonomousFixtureCarrySupportTerminalRunThrough:true}
 ])assert.throws(()=>createPlayerMovement(invalid));
 const ordinary=createPhysicalFixtureStepRuntime(R,
  fixture(c),scene(c),OPT.terminal);
 try{
  assert.equal(Object.hasOwn(ordinary.snapshot(),
   'autonomousCarrySupportTerminalRunThroughMode'),false);
 }finally{ordinary.dispose();}
});
test('C2.3ad retrospective moving shoe/ball centre nearest-phase rejects synthetic Rapier-contact authority',()=>{
 const actor={id:'away-10',team:'away',x:0,y:0,facingRad:0};
 const a={tick:5,actor,ball:{x:-0.78,y:0,z:0.12}};
 const b={tick:6,actor,ball:{x:1.22,y:0,z:0.12}};
 const crossing=inspectConsecutivePhysicalShoePass(a,b);
 assert.equal(crossing.centerClosestFraction,0.5);
 assert.equal(crossing.interiorCenterClosest,true);
 assert.equal(crossing.radialTurnFromClosingToReceding,true);
 assert.ok(crossing.sampledProxyGapM<=1e-10);
 assert.equal(crossing.genuineShoeStartInferred,false);
 assert.equal(crossing.rapierSweptCollisionInferred,false);
 assert.equal(crossing.footballActionExecuted,false);
 assert.equal(crossing.officialMatchResult,null);
 const still=inspectConsecutivePhysicalShoePass(a,{
  ...b,ball:{...a.ball}});
 assert.equal(still.centerClosestFraction,0);
 assert.equal(still.interiorCenterClosest,false);
 for(const invalid of [
  {...b,tick:7},
  {...b,actor:{...actor,id:'home-10'}},
  {...b,actor:{...actor,team:'home'}},
  {...b,actor:{...actor,x:2}},
  {...b,actor:{...actor,facingRad:1}},
  {...b,ball:{...b.ball,z:-0.1}},
  {...b,ball:{...b.ball,x:Infinity}}
 ])assert.throws(()=>inspectConsecutivePhysicalShoePass(a,invalid),
  TypeError);
});
test('C2.3ae pure frozen-ball forward reach timing is only an optimistic, non-contact bound',()=>{
 const phase=Object.freeze({
  physicallyObservedFrames:true,intermediateFramesInterpolatedNotRapier:true,
  sampledProxyAtFraction:0.625,
  relativeForwardM:0.335,relativeLateralM:0,
  relativeVerticalM:0
 });
 const timing=inspectOptimisticLongitudinalToeTiming(phase);
 assert.equal(timing.forwardOnlyPossible,true);
 assert.ok(Math.abs(timing.toeForwardDeficitM-0.100)<1e-12);
 assert.equal(timing.heelBackwardDeficitM,0);
 assert.ok(Math.abs(timing.optimisticFullSpeedCatchMs-
  (0.100/PLAYER_MAX_SPEED_MPS*1000))<1e-10);
 assert.ok(Math.abs(timing.remainingFrameMs-6.25)<1e-10);
 assert.equal(timing.optimisticStaticBallAxialBudgetSufficient,false);
 assert.equal(timing.realRapierShoeContactInferred,false);
 assert.equal(timing.naturalFootballShotInferred,false);
 assert.equal(timing.trajectoryIsInterpolatedNotSwept,true);
 const clear=inspectOptimisticLongitudinalToeTiming({...phase,
  relativeForwardM:0.10});
 assert.equal(clear.toeForwardDeficitM,0);
 assert.equal(clear.optimisticStaticBallAxialBudgetSufficient,true);
 const lateral=inspectOptimisticLongitudinalToeTiming({...phase,
  relativeLateralM:0.25});
 assert.equal(lateral.forwardOnlyPossible,false);
 assert.equal(lateral.optimisticStaticBallAxialBudgetSufficient,false);
 const behind=inspectOptimisticLongitudinalToeTiming({...phase,
  relativeForwardM:-0.335});
 assert.equal(behind.toeForwardDeficitM,0);
 assert.ok(behind.heelBackwardDeficitM>0);
 for(const invalid of [
  {...phase,physicallyObservedFrames:false},
  {...phase,intermediateFramesInterpolatedNotRapier:false},
  {...phase,sampledProxyAtFraction:-0.1},
  {...phase,sampledProxyAtFraction:1.1},
  {...phase,relativeLateralM:Infinity},
  {...phase,relativeForwardM:NaN}
 ])assert.throws(()=>inspectOptimisticLongitudinalToeTiming(invalid),
  TypeError);
});
test('C2.3ac genuine relative lateral slip sealed DEV-only, reset and mutual exclusion with failed runway',async()=>{
 const R=await initializeRapier(rapier),c=CASES[1];
 const runner=createPhysicalFixtureStepRuntime(R,
  fixture(c),scene(c),OPT.slip);
 try{
  assert.equal(runner.snapshot().
   autonomousCarrySupportTerminalLateralSlipMode,true);
  const reset=runner.reset();
  try{
   assert.equal(reset.snapshot().
    autonomousCarrySupportTerminalLateralSlipMode,true);
   for(let t=0;t<30;t++)reset.step();
   assert.equal(reset.snapshot().physicsTick,30);
  }finally{reset.dispose();}
 }finally{runner.dispose();}
 for(const invalid of [
  {autonomousCarrySupportTerminalLateralSlip:true},
  {...OPT.terminal,autonomousCarrySupportTerminalLateralSlip:false},
  {...OPT.slip,autonomousCarrySupportTerminalRunThrough:true},
  {...OPT.slip,autonomousCarrySupportTerminalFacingLead:false},
  {...OPT.slip,autonomousCarrySupportObservedBallVelocityLead:false},
  {...OPT.slip,autonomousCarrySupportFootLateralLead:false},
  {...OPT.slip,autonomousCarrySupportShoeCenterTarget:false},
  {...OPT.slip,autonomousCarrySupportEarlyFacing:false},
  {...OPT.slip,autonomousCarrySupportBallAccess:false},
  {...OPT.slip,autonomousActions:false},
  {...OPT.slip,researchShotAttacker:'away'}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(
  R,fixture(c),scene(c),invalid));
 for(const invalid of [
  {experimentalAutonomousFixtureCarrySupportTerminalLateralSlip:true},
  {experimentalAiKickApproach:true,
   experimentalAutonomousFixtureContactChase:true,
   experimentalAutonomousFixtureCarry:true,
   experimentalAutonomousFixtureCarrySupport:true,
   experimentalAutonomousFixtureCarrySupportPressHandoff:true,
   experimentalAutonomousFixtureCarrySupportBallAccess:true,
   experimentalAutonomousFixtureCarrySupportLateralAlign:true,
   experimentalAutonomousFixtureCarrySupportEarlyFacing:true,
   experimentalAutonomousFixtureCarrySupportShoeCenterTarget:true,
   experimentalAutonomousFixtureCarrySupportFootLateralLead:true,
   experimentalAutonomousFixtureCarrySupportObservedBallVelocityLead:true,
   experimentalAutonomousFixtureCarrySupportTerminalLateralSlip:true},
  {experimentalAiKickApproach:true,
   experimentalAutonomousFixtureContactChase:true,
   experimentalAutonomousFixtureCarry:true,
   experimentalAutonomousFixtureCarrySupport:true,
   experimentalAutonomousFixtureCarrySupportPressHandoff:true,
   experimentalAutonomousFixtureCarrySupportBallAccess:true,
   experimentalAutonomousFixtureCarrySupportLateralAlign:true,
   experimentalAutonomousFixtureCarrySupportEarlyFacing:true,
   experimentalAutonomousFixtureCarrySupportShoeCenterTarget:true,
   experimentalAutonomousFixtureCarrySupportFootLateralLead:true,
   experimentalAutonomousFixtureCarrySupportObservedBallVelocityLead:true,
   experimentalAutonomousFixtureCarrySupportTerminalFacingLead:true,
   experimentalAutonomousFixtureCarrySupportTerminalRunThrough:true,
   experimentalAutonomousFixtureCarrySupportTerminalLateralSlip:true}
 ])assert.throws(()=>createPlayerMovement(invalid));
 const ordinary=createPhysicalFixtureStepRuntime(R,
  fixture(c),scene(c),OPT.terminal);
 try{
  assert.equal(Object.hasOwn(ordinary.snapshot(),
   'autonomousCarrySupportTerminalLateralSlipMode'),false);
 }finally{ordinary.dispose();}
});
test('C2.3af longitudinal opt-in requires authentic prior-ball terminal support and survives reset',async()=>{
 const R=await initializeRapier(rapier),c=CASES[1];
 const session=createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),OPT.longitudinal);
 try{
  assert.equal(session.snapshot().autonomousCarrySupportLongitudinalLeadMode,true);
  const reset=session.reset();
  try{
   assert.equal(reset.snapshot().autonomousCarrySupportLongitudinalLeadMode,true);
  }finally{reset.dispose();}
 }finally{session.dispose();}
 for(const invalid of [
  {autonomousCarrySupportLongitudinalLead:true},
  {...OPT.longitudinal,autonomousCarrySupportTerminalFacingLead:false},
  {...OPT.longitudinal,autonomousCarrySupportTerminalRunThrough:true},
  {...OPT.longitudinal,autonomousCarrySupportTerminalLateralSlip:true},
  {...OPT.longitudinal,researchShotAttacker:'away'}
 ])assert.throws(()=>createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),invalid),TypeError);
 assert.throws(()=>createPlayerMovement({
  experimentalAutonomousFixtureCarrySupportLongitudinalLead:true
 }),TypeError);
});
test('C2.3af genuine HOME/AWAY 720-tick Rapier v/y/z/aa/ab vs lateral slip compensation and replay',async()=>{
 const R=await initializeRapier(rapier),reports=[];
 for(const c of CASES){
  const studies=['center','lead','velocity','terminal','runway','slip','longitudinal']
   .map(mode=>study(R,c,mode));
  const independent=c.team==='away'?
   createPhysicalFixtureStepRuntime(R,fixture(c),scene(c),OPT.longitudinal):null;
  let firstFacingDiff=null,firstBodyOrBallDiff=null;
  let firstVelocityFacingDiff=null,firstVelocityPhysicalDiff=null;
  let firstTerminalFacingDiff=null,firstTerminalPhysicalDiff=null;
  let firstRunwayFacingDiff=null,firstRunwayPhysicalDiff=null;
  let firstSlipFacingDiff=null,firstSlipPhysicalDiff=null;
  try{
   for(let t=1;t<=720;t++){
    const [a,b,v,tFrame,rFrame,sFrame,lFrame]=
     studies.map(st=>replayStep(st,c));
    if(c.team==='home'){
     assert.deepEqual(tFrame.ball,lFrame.ball);
     assert.deepEqual(tFrame.physicalPlayerPositions,lFrame.physicalPlayerPositions);
     assert.deepEqual(tFrame.physicalContactFeed,lFrame.physicalContactFeed);
    }
    const beforeFirstLead=studies[1].stats.firstLead===null;
    const beforeFirstVelocity=studies[2].stats.firstVelocity===null;
    if(beforeFirstLead){
     assert.deepEqual(a.ball,b.ball);
     assert.deepEqual(a.physicalPlayerPositions,b.physicalPlayerPositions);
     assert.deepEqual(a.physicalContactFeed,b.physicalContactFeed);
     assert.deepEqual(a.localAutonomousAction,b.localAutonomousAction);
    }
    if(beforeFirstVelocity){
     assert.deepEqual(b.ball,v.ball);
     assert.deepEqual(b.physicalPlayerPositions,v.physicalPlayerPositions);
     assert.deepEqual(b.physicalContactFeed,v.physicalContactFeed);
     assert.deepEqual(b.localAutonomousAction,v.localAutonomousAction);
    }
    const beforeTerminal=studies[3].stats.firstTerminal===null;
    if(beforeTerminal){
     assert.deepEqual(v.ball,tFrame.ball);
     assert.deepEqual(v.physicalPlayerPositions,
      tFrame.physicalPlayerPositions);
     assert.deepEqual(v.physicalContactFeed,tFrame.physicalContactFeed);
     assert.deepEqual(v.localAutonomousAction,
      tFrame.localAutonomousAction);
    }
    const beforeRunway=studies[4].stats.firstRunway===null;
    if(beforeRunway){
     assert.deepEqual(tFrame.ball,rFrame.ball);
     assert.deepEqual(tFrame.physicalPlayerPositions,
      rFrame.physicalPlayerPositions);
     assert.deepEqual(tFrame.physicalContactFeed,rFrame.physicalContactFeed);
     assert.deepEqual(tFrame.localAutonomousAction,
      rFrame.localAutonomousAction);
    }
    const beforeSlip=studies[5].stats.firstSlip===null;
    if(beforeSlip){
     assert.deepEqual(tFrame.ball,sFrame.ball);
     assert.deepEqual(tFrame.physicalPlayerPositions,
      sFrame.physicalPlayerPositions);
     assert.deepEqual(tFrame.physicalContactFeed,sFrame.physicalContactFeed);
     assert.deepEqual(tFrame.localAutonomousAction,
      sFrame.localAutonomousAction);
    }
    const x=studies[0].lastMove.players,y=studies[1].lastMove.players;
    const z=studies[2].lastMove.players;
    const u=studies[3].lastMove.players;
    const q=studies[4].lastMove.players;
    const j=studies[5].lastMove.players;
    if(firstSlipFacingDiff===null&&u.some((p,i)=>
      Math.abs(wrap(p.facingRad-j[i].facingRad))>1e-9))
     firstSlipFacingDiff=t;
    if(firstSlipPhysicalDiff===null&&(
     JSON.stringify(tFrame.ball)!==JSON.stringify(sFrame.ball)||
     JSON.stringify(tFrame.physicalPlayerPositions)!==
      JSON.stringify(sFrame.physicalPlayerPositions)))
     firstSlipPhysicalDiff=t;
    if(firstRunwayFacingDiff===null&&u.some((p,i)=>
      Math.abs(wrap(p.facingRad-q[i].facingRad))>1e-9))
     firstRunwayFacingDiff=t;
    if(firstRunwayPhysicalDiff===null&&(
     JSON.stringify(tFrame.ball)!==JSON.stringify(rFrame.ball)||
     JSON.stringify(tFrame.physicalPlayerPositions)!==
      JSON.stringify(rFrame.physicalPlayerPositions)))
     firstRunwayPhysicalDiff=t;
    if(firstTerminalFacingDiff===null&&z.some((p,i)=>
      Math.abs(wrap(p.facingRad-u[i].facingRad))>1e-9))
     firstTerminalFacingDiff=t;
    if(firstTerminalPhysicalDiff===null&&(
     JSON.stringify(v.ball)!==JSON.stringify(tFrame.ball)||
     JSON.stringify(v.physicalPlayerPositions)!==
      JSON.stringify(tFrame.physicalPlayerPositions)))
     firstTerminalPhysicalDiff=t;
    if(firstVelocityFacingDiff===null&&y.some((p,i)=>
      Math.abs(wrap(p.facingRad-z[i].facingRad))>1e-9))
     firstVelocityFacingDiff=t;
    if(firstVelocityPhysicalDiff===null&&(
     JSON.stringify(b.ball)!==JSON.stringify(v.ball)||
     JSON.stringify(b.physicalPlayerPositions)!==
      JSON.stringify(v.physicalPlayerPositions)))
     firstVelocityPhysicalDiff=t;
    if(firstFacingDiff===null&&x.some((p,i)=>
      Math.abs(wrap(p.facingRad-y[i].facingRad))>1e-9))
     firstFacingDiff=t;
    if(firstBodyOrBallDiff===null&&(
     JSON.stringify(a.ball)!==JSON.stringify(b.ball)||
     JSON.stringify(a.physicalPlayerPositions)!==
      JSON.stringify(b.physicalPlayerPositions)))
     firstBodyOrBallDiff=t;
    if(independent){
     const replay=independent.step();
     assert.deepEqual(lFrame.ball,replay.ball);
     assert.deepEqual(lFrame.physicalPlayerPositions,
      replay.physicalPlayerPositions);
     assert.deepEqual(lFrame.physicalContactFeed,replay.physicalContactFeed);
     assert.deepEqual(lFrame.localAutonomousAction,
      replay.localAutonomousAction);
    }
   }
   const [center,lead,velocity,terminal,runway,slip,longitudinal]=studies;
   if(c.team==='home'){
    assert.equal(firstFacingDiff,null);
    assert.equal(firstBodyOrBallDiff,null);
    assert.equal(lead.stats.leadFrames,0);
    assert.equal(lead.stats.sourceBoundAccess,0);
    assert.equal(velocity.stats.velocityFrames,0);
    assert.equal(velocity.stats.sourceBoundAccess,0);
    assert.equal(firstVelocityFacingDiff,null);
    assert.equal(firstVelocityPhysicalDiff,null);
    assert.equal(firstTerminalFacingDiff,null);
    assert.equal(firstTerminalPhysicalDiff,null);
    assert.equal(terminal.stats.terminalFrames,0);
    assert.equal(terminal.stats.sourceBoundAccess,0);
    assert.equal(runway.stats.runwayFrames,0);
    assert.equal(runway.stats.sourceBoundAccess,0);
    assert.equal(firstRunwayFacingDiff,null);
    assert.equal(firstRunwayPhysicalDiff,null);
    assert.equal(firstSlipFacingDiff,null);
    assert.equal(firstSlipPhysicalDiff,null);
    assert.equal(slip.stats.slipFrames,0);
    assert.equal(slip.stats.sourceBoundAccess,0);
    assert.deepEqual(terminal.stats.physicalAction,
     slip.stats.physicalAction);
    assert.deepEqual(terminal.stats.physicalAction,
     longitudinal.stats.physicalAction);
    assert.deepEqual(terminal.stats.physicalAction,
     runway.stats.physicalAction);
    assert.deepEqual(velocity.stats.physicalAction,
     terminal.stats.physicalAction);
    assert.deepEqual(center.stats.physicalAction,
     lead.stats.physicalAction);
    assert.deepEqual(lead.stats.physicalAction,
     velocity.stats.physicalAction);
   }else{
    assert.ok(lead.stats.leadFrames>0,
     'only genuine physical PASS→CARRY grants lateral interception');
    assert.equal(lead.stats.leadFrames,
     lead.stats.sourceBoundAccess);
    assert.ok(lead.stats.maxLeadCorrectionM>0);
    assert.ok(firstFacingDiff===null||
     firstFacingDiff>=lead.stats.firstLead);
    assert.ok(firstBodyOrBallDiff===null||
     firstBodyOrBallDiff>=lead.stats.firstLead,
     'first different physics must follow authenticated PASS→CARRY');
    assert.equal(center.stats.sourceBoundAccess,60);
    assert.ok(velocity.stats.velocityFrames>0,
     'real PASS and CARRY must authenticate the observed-speed lead');
    assert.equal(velocity.stats.velocityFrames,
     velocity.stats.sourceBoundAccess);
    assert.ok(velocity.stats.maxVelocityCorrectionM>0);
    assert.ok(firstVelocityFacingDiff===null||
     firstVelocityFacingDiff>=velocity.stats.firstVelocity);
    assert.ok(firstVelocityPhysicalDiff===null||
     firstVelocityPhysicalDiff>=velocity.stats.firstVelocity,
     'physical changes follow prior real-ball evidence, never lead it');
    assert.ok(terminal.stats.terminalFrames>0,
     'actual near-ball terminal facing must be source qualified');
    assert.ok(terminal.stats.firstTerminal>=terminal.stats.firstVelocity);
    assert.ok(terminal.stats.terminalFrames<=
     terminal.stats.sourceBoundAccess);
    assert.ok(terminal.stats.maxTerminalLeadM<=0.30+1e-8);
    assert.ok(firstTerminalFacingDiff===null||
     firstTerminalFacingDiff>=terminal.stats.firstTerminal);
    assert.ok(firstTerminalPhysicalDiff===null||
     firstTerminalPhysicalDiff>=terminal.stats.firstTerminal);
    assert.ok(runway.stats.runwayFrames>0,
     'verified PASS→CARRY must authorize the last-metre true-body run');
    assert.ok(runway.stats.firstRunway>=runway.stats.firstTerminal);
    assert.ok(runway.stats.runwayFrames<=runway.stats.sourceBoundAccess);
    assert.ok(runway.stats.maxRunwayCorrectionM>0);
    assert.ok(runway.stats.maxRunwayCorrectionM<=0.90+1e-8);
    assert.ok(firstRunwayFacingDiff===null||
     firstRunwayFacingDiff>=runway.stats.firstRunway);
    assert.ok(firstRunwayPhysicalDiff===null||
     firstRunwayPhysicalDiff>=runway.stats.firstRunway);
    assert.ok(slip.stats.slipFrames>0,
     'source-eligible AWAY player must receive measured lateral slip');
    assert.ok(slip.stats.firstSlip>=terminal.stats.firstTerminal);
    assert.ok(slip.stats.slipFrames<=slip.stats.sourceBoundAccess);
    assert.ok(slip.stats.maxSlipCorrectionM>0);
    assert.ok(slip.stats.maxSlipCorrectionM<=0.40+1e-9);
    assert.equal(longitudinal.stats.sourceBoundAccess,60);
    assert.ok(firstSlipFacingDiff===null||
     firstSlipFacingDiff>=slip.stats.firstSlip);
    assert.ok(firstSlipPhysicalDiff===null||
     firstSlipPhysicalDiff>=slip.stats.firstSlip);
   }
   reports.push({team:c.team,firstFacingDifferenceTick:firstFacingDiff,
    firstBallOrBodyPhysicalDifferenceTick:firstBodyOrBallDiff,
    firstVelocityFacingDifferenceTick:firstVelocityFacingDiff,
    firstVelocityPhysicalDifferenceTick:firstVelocityPhysicalDiff,
    firstTerminalFacingDifferenceTick:firstTerminalFacingDiff,
    firstTerminalPhysicalDifferenceTick:firstTerminalPhysicalDiff,
    firstRunwayFacingDifferenceTick:firstRunwayFacingDiff,
    firstRunwayPhysicalDifferenceTick:firstRunwayPhysicalDiff,
    firstSlipFacingDifferenceTick:firstSlipFacingDiff,
    firstSlipPhysicalDifferenceTick:firstSlipPhysicalDiff,
    modes:studies.map(output)});
  }finally{
   studies.forEach(st=>st.engine.dispose());
   independent?.dispose();
  }
 }
 // Keep the measured witness details in the in-memory test, but
 // emit compact structured evidence so GitHub Actions logs cannot
 // truncate the last AWAY candidate before its real START/SHOT fields.
 const compact=reports.map(({team,modes,...diff})=>({
  team,...diff,
  modes:modes.map(({checkpoints,closestApproach,...metrics})=>({
   ...metrics,
   closestApproach:closestApproach.samples?{
    ...closestApproach,nearby:closestApproach.nearby.filter(x=>
     [658,665,668,670,673].includes(x.tick))
   }:closestApproach
  }))
 }));
 console.log('C2_3AD_REAL_RAPIER_RETROSPECTIVE_CLOSEST_PHASE',
  JSON.stringify(compact));
});
