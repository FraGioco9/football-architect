// #624 - opt-in private 22-shoe Rapier bridge for the EXISTING ball world.
// This module creates no world, assigns no player movement and never kicks.
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {soloCarryPhaseConfiguration} from './solo-carry-phases.mjs';
import {FOOT_CONTACT_VERSION,FOOT_CONTACT_HALF_LENGTH_M,
 FOOT_CONTACT_FORWARD_OFFSET_M,
 FOOT_CONTACT_HALF_WIDTH_M,FOOT_CONTACT_HALF_HEIGHT_M,
 FOOT_CONTACT_ROUNDING_M,FOOT_CONTACT_FRICTION,
 FOOT_CONTACT_RESTITUTION,footProxyTransform,
 validateFootContactFrame} from './player-foot-contact.mjs';
import {createFootContactTimeline} from './player-foot-contact-timeline.mjs';
import {summarizeFootSolverEvidence} from './player-foot-contact-solver.mjs';

const empty=Object.freeze([]);
const ordered=set=>Object.freeze(INITIAL_PLAYERS
 .filter(p=>set.has(p.id)).map(p=>p.id));
const vector=p=>Object.freeze({x:p.x,y:p.y,z:p.z});
 // #628 D01-GAIT-01: current 60Hz canonical stride + REAL pre-step Rapier
 // ball position/velocity. This is a foot target only, never a collision,
 // impulse, synthetic START/END, possession or ball correction.
 const gaitClamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 export function advanceD01LiveShoeGait({phaseRad,player,ball,tick,solo=false,
  carryPhase=null,sprintCadenceScale=1}={}){
  if(![0.9,1,1.1].includes(sprintCadenceScale)||
     (sprintCadenceScale!==1&&!solo)||
     typeof solo!=='boolean'||!Number.isInteger(tick)||tick<1||
     !Number.isFinite(phaseRad)||phaseRad<0||phaseRad>=2*Math.PI||
     !player||!ball?.position||!ball?.velocity||
     ![player.x,player.y,player.vx,player.vy,player.facingRad,
       ball.position.x,ball.position.y,ball.position.z,
       ball.velocity.x,ball.velocity.y,ball.velocity.z]
       .every(Number.isFinite))
   throw new TypeError('Only real consecutive 60Hz canonical player and Rapier ball may cue D-01 shoe');
  const cos=Math.cos(player.facingRad),sin=Math.sin(player.facingRad);
  const relX=ball.position.x-player.x,relY=ball.position.y-player.y;
  const aheadM=relX*cos+relY*sin;
  const lateralM=-relX*sin+relY*cos;

  const speedMps=Math.hypot(player.vx,player.vy);
  const playerForwardMps=player.vx*cos+player.vy*sin;
  const ballForwardMps=ball.velocity.x*cos+ball.velocity.y*sin;
  // Do not increase the fixed mechanical frequency blindly. Respond smoothly
  // to REAL observed speed and preserve a true full release stroke.
  const cue=solo&&carryPhase!==null?
   soloCarryPhaseConfiguration(carryPhase):null;
  const baseFrequencyHz=solo?
   (cue?cue.shoeFrequencyBaseHz+cue.shoeFrequencySpeedHz*
    gaitClamp(speedMps/4,0,1):1.35+0.35*gaitClamp(speedMps/4,0,1)):
   2.45+0.25*gaitClamp(speedMps/4,0,1);
  // The physical swing phase is integrated at the same canonical 60Hz.
  // Research opt-in only during observed Sprint, never timer-driven touches.
  const frequencyHz=baseFrequencyHz*
   (solo&&carryPhase==='sprint'?sprintCadenceScale:1);
  const nextPhase=(phaseRad+2*Math.PI*frequencyHz/60)%(2*Math.PI);
  const stroke=-Math.cos(nextPhase);
  // At the original .50–.70m player/ball gap, a modest forward approach
  // reduces missed shoes; backing stroke remains unchanged for native END.
  const approachM=gaitClamp((aheadM-0.53)*0.40,0,0.055)*
   Math.max(0,stroke);
  const forwardM=(solo?(cue?.shoeForwardStrokeM??0.075):0.105)*stroke+
   approachM;
  const sideM=gaitClamp(lateralM*0.20,-0.03,0.03)*
   Math.max(0,stroke);
  return Object.freeze({
   phaseRad:nextPhase,frequencyHz,forwardM,sideM,
   ...(cue?{carryPhase}:{}),
   observedSpeedMps:speedMps,observedAheadM:aheadM,
   observedLateralM:lateralM,observedBallSpeedMps:
    Math.hypot(ball.velocity.x,ball.velocity.y),
   observedPlayerForwardMps:playerForwardMps,
   observedBallForwardMps:ballForwardMps,
   nativeShoeEventCreated:false,ballImpulseCreated:false,
   possessionAssigned:false
  });
 }

 
// #628: two independently positioned native shoes, only for solo Carry.
// A cyclic target NEVER creates Rapier START/END or applies a ball impulse.
export function soloCarryTwoFootPositions(player,gait=null,{
 recoveryStepScale=1,sprintLateralTrackScale=1,
 nativeActiveFeet=empty,sprintActiveFootReleaseM=0
}={}){
 if(![0.85,0.925,1,1.15].includes(recoveryStepScale)||
    ![0.9,1,1.1].includes(sprintLateralTrackScale)||
    ![0,0.06,0.1].includes(sprintActiveFootReleaseM)||
    !Array.isArray(nativeActiveFeet)||
    nativeActiveFeet.some(foot=>!['left','right'].includes(foot))||
    new Set(nativeActiveFeet).size!==nativeActiveFeet.length||
    (sprintActiveFootReleaseM!==0&&gait?.carryPhase!=='sprint')||
    !player||![player.x,player.y,player.facingRad].every(Number.isFinite)||
    (gait!==null&&(!Number.isFinite(gait.phaseRad)||
     !Number.isFinite(gait.observedAheadM)||!Number.isFinite(gait.observedLateralM)||
     !Number.isFinite(gait.observedPlayerForwardMps)||
     !Number.isFinite(gait.observedBallForwardMps)||
     !Number.isFinite(gait.observedBallSpeedMps)||
     !Number.isFinite(gait.forwardM))))
  throw new TypeError('Two-foot Carry requires canonical player and live stride');
 const angle=gait?.phaseRad??0;
 const stroke=-Math.cos(angle);
 const forwardStroke=gait?.carryPhase?
  soloCarryPhaseConfiguration(gait.carryPhase).shoeForwardStrokeM:0.075;
 const ahead=gait?.observedAheadM??0.55;
 const lateral=gait?.observedLateralM??0;
 const sideAdjust=gaitClamp(lateral*0.20,-0.03,0.03);
 // Control needs an actual early foot approach. Once the observed native
 // speed/gap promotes Moderate/Sprint, use shorter physical forward reach
 // to prevent two authentic shoes from over-driving the original ball.
 // These are kinematic pad trajectories, NOT ball speed clamps or timed taps.
 const twoFootPhysicalReach=gait?.carryPhase==='sprint'?0.75:
  gait?.carryPhase==='moderate'?0.85:1.0;
 // A runner's boots need not repeatedly strike the ball. Sprinting feet
 // step to EITHER SIDE of a freely rolling ball. Once the canonical runner
 // catches up or the original Rapier ball approaches the toes, both tracks
 // smoothly narrow for an actual native shoe-ball collision.
 // No synthetic contact, impulse, possession or post-step ball correction.
 const playerCatchingBall=gait===null?0:
  gaitClamp((gait.observedPlayerForwardMps-
   gait.observedBallForwardMps+0.25)/0.75,0,1);
 const approachingBall=gait===null?0:
  gaitClamp((0.43-ahead)/0.12,0,1);
 const catchupNeed=gait===null?0:
  playerCatchingBall*gaitClamp((0.58-ahead)/0.18,0,1);
 const realRecoveryNeed=Math.max(approachingBall,catchupNeed);
 const openRun=gait?.carryPhase==='sprint'?1-realRecoveryNeed:0;
 const sprintTrackM=(0.145-0.055*realRecoveryNeed)*
  sprintLateralTrackScale;
 const lateralTrackM=gait?.carryPhase==='sprint'?sprintTrackM:
  gait?.carryPhase==='moderate'?0.11:0.085;
 // Shift the two-foot gait together when the ball is on one side, keeping
 // both actual shoe pads outside the rolling sphere. During a recovery,
 // release the shift so a shoe can approach and genuinely make contact.
 const runningLateralCenterM=gait?.carryPhase==='sprint'?
  gaitClamp(lateral,-0.10,0.10)*openRun:0;
 // A planted foot must also LEAVE the ball: a deeper genuine recovery
 // step (never a forward hit) avoids both physical shoes touching at once.
 const rearwardRecovery=(gait?.carryPhase==='sprint'?1.45:
  gait?.carryPhase==='moderate'?1.15:1)*
  (gait===null?1:recoveryStepScale);
 const leftStep=gait?.forwardM??forwardStroke*stroke;
 const rightStep=-forwardStroke*stroke+
  gaitClamp((ahead-0.53)*0.40,0,0.055)*Math.max(0,-stroke);
 // Experimental true-source release: an actually touching shoe moves
 // laterally AWAY from the ball on the following physical tick. A forward
 // stroke alone never initiates it; no START/END, ball force, or cooldown is
 // invented. The bridge still enforces <=1.6m/s lateral + <=7m/s travel.
 const releasingLeft=nativeActiveFeet.includes('left')?
  sprintActiveFootReleaseM:0;
 const releasingRight=nativeActiveFeet.includes('right')?
  sprintActiveFootReleaseM:0;
 const leftForward=leftStep*twoFootPhysicalReach*
  (leftStep<0?rearwardRecovery:1);
 const rightForward=rightStep*twoFootPhysicalReach*
  (rightStep<0?rearwardRecovery:1);
 const make=(forward,side)=>{
  const c=Math.cos(player.facingRad),si=Math.sin(player.facingRad);
  return Object.freeze({...player,
   x:player.x+forward*c-side*si,
   y:player.y+forward*si+side*c});
 };
 return Object.freeze({
  left:make(leftForward,runningLateralCenterM+lateralTrackM+
   (gait?.sideM??0)+releasingLeft),
  right:make(rightForward,runningLateralCenterM-lateralTrackM+
   sideAdjust*Math.max(0,-stroke)-releasingRight),
  source:'original-canonical-stride-targets',
  realContactsOnly:true,physicsImposed:false
 });
}

export function createPrivateRapierFootContactBridge(R,world,ballCollider,
 initialPlayers=INITIAL_PLAYERS,{sharedQueue=null,activePlayerIds=null,
 isolatedPhysicalBodies=false,isolatedGroundDribbleBallCentreZ=null,
 dribbleAttackerId=null,soloCarry=false,soloShoeWidthScale=1,
 soloShoeLengthScale=1,soloRecoveryStepScale=1,
 soloSprintCadenceScale=1,soloSprintLateralTrackScale=1,
 soloSprintActiveFootReleaseM=0,intentDrivenSoloCarry=false}={}){
 if(typeof intentDrivenSoloCarry!=='boolean'||
    (intentDrivenSoloCarry&&(!soloCarry||dribbleAttackerId===null)))
  throw new TypeError('Intent dribble may only isolate the original Solo Carry shoes');
 if(!R||typeof R.EventQueue!=='function'||!world||
    typeof world.createRigidBody!=='function'||
    !ballCollider||ballCollider.handle===undefined||
    ballCollider.handle===null)
  throw new TypeError('Existing private Rapier ball world and collider required');
 if(!Array.isArray(initialPlayers)||initialPlayers.length!==INITIAL_PLAYERS.length||
    initialPlayers.some((p,i)=>!p||p.id!==INITIAL_PLAYERS[i].id||
     p.team!==INITIAL_PLAYERS[i].team||p.role!==INITIAL_PLAYERS[i].role||
     ![p.x,p.y,p.facingRad].every(Number.isFinite)||
     Math.abs(p.x)>52.5||Math.abs(p.y)>34))
  throw new TypeError('Ordered canonical 22-player initial shoes required');
 if(sharedQueue!==null&&
    (typeof sharedQueue.drainCollisionEvents!=='function'||
     typeof sharedQueue.drainContactForceEvents!=='function'))
  throw new TypeError('Native shared Rapier event queue required');
 // A small-sided study must exclude unused Rapier shoe COLLIDERS,
 // rather than merely hiding them on the canvas. The canonical 22-person
 // motion frame still undergoes the same validation on every physics tick.
 if(typeof isolatedPhysicalBodies!=='boolean'||
    (isolatedPhysicalBodies&&activePlayerIds===null))
  throw new TypeError('Body-isolated shoe groups require selected small-sided players');
 if(activePlayerIds!==null&&(!Array.isArray(activePlayerIds)||
   activePlayerIds.length<1||activePlayerIds.length>7||
   new Set(activePlayerIds).size!==activePlayerIds.length||
   activePlayerIds.some(id=>!INITIAL_PLAYERS.some(p=>p.id===id))))
  throw new TypeError('Genuine small-sided source needs 2–7 unique physical shoes');
 if(isolatedGroundDribbleBallCentreZ!==null&&(
    !Number.isFinite(isolatedGroundDribbleBallCentreZ)||
    isolatedGroundDribbleBallCentreZ<0.09||
    isolatedGroundDribbleBallCentreZ>0.13||
    ![1,2].includes(activePlayerIds?.length)))
  throw new TypeError('Only isolated 1v1 original ground-ball shoe height');
 if((dribbleAttackerId===null)!==(isolatedGroundDribbleBallCentreZ===null)||
   (dribbleAttackerId!==null&&(
    !activePlayerIds?.includes(dribbleAttackerId)||
    !/^(home|away)-10$/.test(dribbleAttackerId))))
  throw new TypeError('Original D-01 attacker only for native Rapier foot stride');
 if(typeof soloCarry!=='boolean'||(soloCarry&&(
    activePlayerIds?.length!==1||dribbleAttackerId===null||
    activePlayerIds[0]!==dribbleAttackerId)))
  throw new TypeError('Solo shoe stride needs exactly one original actor');
 if(![0.9,1,1.1].includes(soloShoeWidthScale)||
    (soloShoeWidthScale!==1&&!soloCarry))
  throw new TypeError('DEV counterfactual shoe widths require genuine solo Carry');
 if(![0.9,1,1.05,1.075,1.1].includes(soloShoeLengthScale)||
    ![0.85,0.925,1,1.15].includes(soloRecoveryStepScale)||
    ((soloShoeLengthScale!==1||soloRecoveryStepScale!==1)&&!soloCarry))
  throw new TypeError('DEV longitudinal toe/recovery variants require genuine solo Carry');
 if(![0,0.06,0.1].includes(soloSprintActiveFootReleaseM)||
     (soloSprintActiveFootReleaseM!==0&&!soloCarry))
  throw new TypeError('Real active-foot release requires Solo Carry shoes');
 if(![0.9,1,1.1].includes(soloSprintCadenceScale)||
    ![0.9,1,1.1].includes(soloSprintLateralTrackScale)||
    ((soloSprintCadenceScale!==1||soloSprintLateralTrackScale!==1)&&!soloCarry))
  throw new TypeError('DEV Sprint cadence and tracks require genuine solo Carry');
 const soloShoeHalfWidthM=FOOT_CONTACT_HALF_WIDTH_M*soloShoeWidthScale;
 const soloShoeHalfLengthM=FOOT_CONTACT_HALF_LENGTH_M*soloShoeLengthScale;
 const physicalIds=activePlayerIds===null?null:new Set(activePlayerIds);
 const eventQueue=sharedQueue??new R.EventQueue(true);
 const ownsEventQueue=sharedQueue===null;
 const colliders=[],bodies=[],idsByCollider=new Map();
 // D-01 retains its original single shoe. Solo Carry stages TWO native
 // kinematic shoes whose lateral tracks and opposing strides remain distinct.
 function shoeFeet(frame,stepTick,gait=null){
  if(dribbleAttackerId===null)return frame;
  const swingM=gait?.forwardM??-0.105*Math.cos(2*Math.PI*stepTick/24);
  const lateralM=gait?.sideM??0;
  return Object.freeze(frame.map((p,i)=>{
   if(initialPlayers[i].id!==dribbleAttackerId)return p;
   if(soloCarry)return soloCarryTwoFootPositions(p,gait,{
    recoveryStepScale:soloRecoveryStepScale,
    sprintLateralTrackScale:soloSprintLateralTrackScale
   }).left;
   const c=Math.cos(p.facingRad),s=Math.sin(p.facingRad);
   return Object.freeze({...p,
    x:p.x+swingM*c-lateralM*s,
    y:p.y+swingM*s+lateralM*c});
  }));
 }
 const stagedFeet=shoeFeet(initialPlayers,0);
 for(const p of stagedFeet){
  const pose=footProxyTransform(p);
  const groundPose=isolatedGroundDribbleBallCentreZ===null?pose:
   {...pose,z:isolatedGroundDribbleBallCentreZ+0.018};
  const body=world.createRigidBody(
   R.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(groundPose.x,groundPose.y,groundPose.z)
     .setRotation(pose.rotation));
  const shoeShape=R.ColliderDesc.roundCuboid(
   soloCarry&&p.id===dribbleAttackerId?
    soloShoeHalfLengthM:FOOT_CONTACT_HALF_LENGTH_M,
   soloCarry&&p.id===dribbleAttackerId?
    soloShoeHalfWidthM:FOOT_CONTACT_HALF_WIDTH_M,
   isolatedGroundDribbleBallCentreZ===null?FOOT_CONTACT_HALF_HEIGHT_M:0.015,
   isolatedGroundDribbleBallCentreZ===null?FOOT_CONTACT_ROUNDING_M:0.01)
   .setFriction(FOOT_CONTACT_FRICTION)
   .setRestitution(isolatedGroundDribbleBallCentreZ===null?
    FOOT_CONTACT_RESTITUTION:0)
   .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS|
    R.ActiveEvents.CONTACT_FORCE_EVENTS);
  if(intentDrivenSoloCarry&&soloCarry&&p.id===dribbleAttackerId)
   shoeShape.setCollisionGroups(0);
  else if(sharedQueue!==null||isolatedPhysicalBodies)
   shoeShape.setCollisionGroups(0x00010001);
  const collider=physicalIds===null||physicalIds.has(p.id)?
   world.createCollider(shoeShape,body):null;
  bodies.push(body);colliders.push(collider);
  if(collider)idsByCollider.set(collider.handle,
   Object.freeze({id:p.id,foot:soloCarry&&p.id===dribbleAttackerId?'left':null}));
 }
 // Add exactly one additional REAL Rapier kinematic shoe/collider for the
 // selected solo player. It shares the ball world and native event queue.
 const soloActor=soloCarry?
  initialPlayers.find(p=>p.id===dribbleAttackerId):null;
 let actualRightFoot=soloActor?
  soloCarryTwoFootPositions(soloActor,null,{
   recoveryStepScale:soloRecoveryStepScale,
   sprintLateralTrackScale:soloSprintLateralTrackScale
  }).right:null;
 let rightBody=null,rightCollider=null;
 if(soloActor){
  const pose=footProxyTransform(actualRightFoot);
  rightBody=world.createRigidBody(
   R.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(pose.x,pose.y,isolatedGroundDribbleBallCentreZ+0.018)
    .setRotation(pose.rotation));
  rightCollider=world.createCollider(R.ColliderDesc.roundCuboid(
   soloShoeHalfLengthM,soloShoeHalfWidthM,0.015,0.01)
    .setFriction(FOOT_CONTACT_FRICTION).setRestitution(0)
    .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS|
     R.ActiveEvents.CONTACT_FORCE_EVENTS)
    .setCollisionGroups(intentDrivenSoloCarry?0:0x00010001),rightBody);
  idsByCollider.set(rightCollider.handle,
   Object.freeze({id:dribbleAttackerId,foot:'right'}));
 }
 const timeline=createFootContactTimeline(stagedFeet);
 let positions=Object.freeze(initialPlayers.map(p=>
  Object.freeze({x:p.x,y:p.y,facingRad:p.facingRad}))),
  tick=0,disposed=false;
 let actualShoeFeet=stagedFeet;
 let gaitPhaseRad=0,lastGaitFrequencyHz=null;
 let active=new Set(),activeSoloFeet=new Set(),solver=null;
 let current=Object.freeze({
  version:FOOT_CONTACT_VERSION,tick:0,
  started:empty,ended:empty,active:empty,
  onsetBallDeltaVelocityMps:null
 });
 const live=()=>{if(disposed)throw new Error('Rapier contact bridge disposed');};
 function prepare(playerFrame,nextTick,preStepBall=null){
  live();
  if(nextTick!==tick+1)throw new RangeError('Nonconsecutive physical shoe tick');
  // Validate ALL actors, headings and physical displacement before mutation.
  const next=validateFootContactFrame(playerFrame,nextTick,positions);
  const actor=dribbleAttackerId===null?null:
   playerFrame.players.find(p=>p.id===dribbleAttackerId);
  const gait=actor?advanceD01LiveShoeGait({
   phaseRad:gaitPhaseRad,player:actor,ball:preStepBall,tick:nextTick,solo:soloCarry,
   carryPhase:soloCarry?playerFrame.soloCarryPhase?.phase:null,
   sprintCadenceScale:soloCarry?soloSprintCadenceScale:1
  }):null;
  if(soloCarry)lastGaitFrequencyHz=gait.frequencyHz;
  // Separate stride cadence from contact frequency without turning the
  // foot into a 7 m/s lateral paddle. Genuine side-step motion is limited
  // to 1.6 m/s in the solo research source; forward running retains the
  // original 7 m/s whole-shoe continuity bound and Rapier collision solver.
  const limitSoloFootLateralMotion=(desired,previous)=>{
   if(!soloCarry)return desired;
   const before=footProxyTransform(previous);
   const after=footProxyTransform(desired);
   const si=Math.sin(desired.facingRad),c=Math.cos(desired.facingRad);
   const lateralDelta=-(after.x-before.x)*si+(after.y-before.y)*c;
   const clipped=gaitClamp(lateralDelta,-1.6/60,1.6/60);
   const excess=lateralDelta-clipped;
   if(Math.abs(excess)<=1e-12)return desired;
   return Object.freeze({...desired,
    x:desired.x+excess*si,y:desired.y-excess*c});
  };
  const experimentalFeet=soloCarry&&soloSprintActiveFootReleaseM!==0?
   soloCarryTwoFootPositions(actor,gait,{
    recoveryStepScale:soloRecoveryStepScale,
    sprintLateralTrackScale:soloSprintLateralTrackScale,
    nativeActiveFeet:[...activeSoloFeet],
    sprintActiveFootReleaseM:soloSprintActiveFootReleaseM
   }):null;
  const proposed=experimentalFeet?
   Object.freeze(shoeFeet(next,nextTick,gait).map((p,i)=>
    initialPlayers[i].id===dribbleAttackerId?experimentalFeet.left:p)):
   shoeFeet(next,nextTick,gait);
  const rightDesired=soloCarry?
   limitSoloFootLateralMotion((experimentalFeet??
    soloCarryTwoFootPositions(actor,gait,{
     recoveryStepScale:soloRecoveryStepScale,
     sprintLateralTrackScale:soloSprintLateralTrackScale
    })).right,
    actualRightFoot):null;
  // The whole shoe also moves when its owner turns or advances. Clamp the
  // actual Rapier kinematic collider trajectory, NOT the canonical player,
  // to the original physical 7m/s ceiling (one 60Hz tick = 0.1167m).
  // This is a real, continuous shoe pose: no new START/END, impulse, or ball
  // ownership is synthesized.
  const newFeet=dribbleAttackerId===null?proposed:
   Object.freeze(proposed.map((rawFoot,i)=>{
    if(initialPlayers[i].id!==dribbleAttackerId)return rawFoot;
    const foot=limitSoloFootLateralMotion(rawFoot,actualShoeFeet[i]);
    const prior=footProxyTransform(actualShoeFeet[i]);
    const desired=footProxyTransform(foot);
    const dx=desired.x-prior.x,dy=desired.y-prior.y;
    const travelled=Math.hypot(dx,dy);
    const maxM=7/60-1e-6;
    if(travelled<=maxM)return foot;
    const fraction=maxM/travelled;
    return Object.freeze({...foot,
     x:prior.x+dx*fraction-
      FOOT_CONTACT_FORWARD_OFFSET_M*Math.cos(foot.facingRad),
     y:prior.y+dy*fraction-
      FOOT_CONTACT_FORWARD_OFFSET_M*Math.sin(foot.facingRad)});
   }));
  const clampActualFoot=(desired,previous)=>{
   const prior=footProxyTransform(previous);
   const target=footProxyTransform(desired);
   const dx=target.x-prior.x,dy=target.y-prior.y;
   const travelled=Math.hypot(dx,dy);
   const maxM=7/60-1e-6;
   if(travelled<=maxM)return desired;
   const ratio=maxM/travelled;
   return Object.freeze({...desired,
    x:prior.x+dx*ratio-
     FOOT_CONTACT_FORWARD_OFFSET_M*Math.cos(desired.facingRad),
    y:prior.y+dy*ratio-
     FOOT_CONTACT_FORWARD_OFFSET_M*Math.sin(desired.facingRad)});
  };
  const rightFoot=rightDesired?
   clampActualFoot(rightDesired,actualRightFoot):null;
  const poses=newFeet.map(footProxyTransform);
  for(let i=0;i<poses.length;i++){
   const p=poses[i];
   if(initialPlayers[i].id===dribbleAttackerId){
    const previous=footProxyTransform(actualShoeFeet[i]);
    if(Math.hypot(p.x-previous.x,p.y-previous.y)>7/60+1e-5)
     throw new TypeError('D-01 real shoe exceeds original 7m/s continuity');
   }
   bodies[i].setNextKinematicTranslation({x:p.x,y:p.y,
    z:isolatedGroundDribbleBallCentreZ===null?p.z:
      isolatedGroundDribbleBallCentreZ+0.018});
   bodies[i].setNextKinematicRotation(p.rotation);
  }
  if(rightFoot){
   const current=footProxyTransform(actualRightFoot);
   const target=footProxyTransform(rightFoot);
   if(Math.hypot(target.x-current.x,target.y-current.y)>7/60+1e-5)
    throw new TypeError('Solo right shoe exceeds actual 7m/s bound');
   rightBody.setNextKinematicTranslation({
    x:target.x,y:target.y,z:isolatedGroundDribbleBallCentreZ+0.018
   });
   rightBody.setNextKinematicRotation(target.rotation);
   actualRightFoot=rightFoot;
  }
  positions=next;actualShoeFeet=newFeet;
  if(gait)gaitPhaseRad=gait.phaseRad;
 }
 function observe(nextTick,priorBall,postBall,sharedEvents=null){
  live();
  if(nextTick!==tick+1||!priorBall?.position||!priorBall?.velocity||
     !postBall?.position||!postBall?.velocity)
   throw new RangeError('Consecutive actual pre/post Rapier states required');
  const started=new Set(),ended=new Set(),next=new Set(active);
  const footStarts=new Set(),footEnds=new Set();
  const nextSoloFeet=new Set(activeSoloFeet);
  const visitCollision=(a,b,began)=>{
   const other=a===ballCollider.handle?b:
    b===ballCollider.handle?a:null;
   const physical=idsByCollider.get(other);
   if(!physical)return; // no turf, no proxy-to-proxy contact
   if(soloCarry&&physical.id===dribbleAttackerId){
    if(began){footStarts.add(physical.foot);nextSoloFeet.add(physical.foot);}
    else{footEnds.add(physical.foot);nextSoloFeet.delete(physical.foot);}
    return;
   }
   if(began){started.add(physical.id);next.add(physical.id);}
   else{ended.add(physical.id);next.delete(physical.id);}
  };
  if(sharedEvents===null)eventQueue.drainCollisionEvents(visitCollision);
  else{
   if(!Array.isArray(sharedEvents.collisions))
    throw new TypeError('One genuine native shared collision sample required');
   for(const e of sharedEvents.collisions)
    visitCollision(e.a,e.b,e.started);
  }
  // Actor-level START only at the first REAL shoe contact after both
  // shoes were released. Foot-to-foot overlap does not fabricate a recontact.
  if(soloCarry){
   if(activeSoloFeet.size===0&&nextSoloFeet.size>0){
    started.add(dribbleAttackerId);next.add(dribbleAttackerId);
   }else if(activeSoloFeet.size>0&&nextSoloFeet.size===0){
    ended.add(dribbleAttackerId);next.delete(dribbleAttackerId);
   }
  }
  const dv=Math.hypot(
   postBall.velocity.x-priorBall.velocity.x,
   postBall.velocity.y-priorBall.velocity.y,
   postBall.velocity.z-priorBall.velocity.z
  );
  const collision=Object.freeze({
   version:FOOT_CONTACT_VERSION,tick:nextTick,
   started:ordered(started),ended:ordered(ended),active:ordered(next),
   ...(soloCarry?{nativeSoloFeet:Object.freeze({
    actorId:dribbleAttackerId,source:'rapier-physical-collider-events',
    started:Object.freeze(['left','right'].filter(x=>footStarts.has(x))),
    ended:Object.freeze(['left','right'].filter(x=>footEnds.has(x))),
    active:Object.freeze(['left','right'].filter(x=>nextSoloFeet.has(x))),
    independentColliders:2,
    physicalColliderHalfWidthM:soloShoeHalfWidthM,
    physicalColliderHalfLengthM:soloShoeHalfLengthM,
    recoveryStepScale:soloRecoveryStepScale,
    sprintCadenceScale:soloSprintCadenceScale,
    sprintLateralTrackScale:soloSprintLateralTrackScale,
    sprintActiveFootReleaseM:soloSprintActiveFootReleaseM,
    nativeObservedGaitFrequencyHz:lastGaitFrequencyHz,
    geometrySource:'native-rapier-collider-width',
    exclusivePhysicalStart:footStarts.size===1&&nextSoloFeet.size===1
   })}:{}),
   // Whole-ball delta includes gravity/turf; never shoe attribution.
   onsetBallDeltaVelocityMps:started.size?dv:null
  });
  const observedTimeline=timeline.observe(collision,priorBall,actualShoeFeet);
  const forcePairs=new Map(),soloFootForces=new Map();
  const visitForce=(a,b,f,d,totalMagnitude,maxMagnitude)=>{
   const other=a===ballCollider.handle?b:
    b===ballCollider.handle?a:null;
   const physical=idsByCollider.get(other);
   if(!physical)return;
   if(soloCarry&&physical.id===dribbleAttackerId){
    const foot=physical.foot;
    const old=soloFootForces.get(foot);
    soloFootForces.set(foot,{
     eventCount:(old?.eventCount??0)+1,
     totalReportedMagnitudeN:(old?.totalReportedMagnitudeN??0)+totalMagnitude,
     maxReportedMagnitudeN:Math.max(old?.maxReportedMagnitudeN??0,maxMagnitude)
    });
   }
   const id=physical.id,existing=forcePairs.get(id);
   if(!existing){
    forcePairs.set(id,{id,totalForceWorldN:{...vector(f)},
     totalForceMagnitudeN:totalMagnitude,
     maxContactForceMagnitudeN:maxMagnitude,
     maxContactForceDirectionWorld:vector(d)});
   }else{
    // Two genuine Rapier shoe reports may belong to one canonical actor.
    // Aggregate physical pair forces, never synthesize a second action.
    existing.totalForceWorldN.x+=f.x;
    existing.totalForceWorldN.y+=f.y;
    existing.totalForceWorldN.z+=f.z;
    existing.totalForceMagnitudeN+=totalMagnitude;
    if(maxMagnitude>existing.maxContactForceMagnitudeN){
     existing.maxContactForceMagnitudeN=maxMagnitude;
     existing.maxContactForceDirectionWorld=vector(d);
    }
   }
  };
  if(sharedEvents===null)eventQueue.drainContactForceEvents(e=>
   visitForce(e.collider1(),e.collider2(),e.totalForce(),
    e.maxForceDirection(),e.totalForceMagnitude(),e.maxForceMagnitude()));
  else{
   if(!Array.isArray(sharedEvents.forces))
    throw new TypeError('One genuine native shared force sample required');
   for(const e of sharedEvents.forces)
    visitForce(e.a,e.b,e.force,e.direction,
     e.magnitude,e.maxMagnitude);
  }
  const forces=[...forcePairs.values()];
  const relevant=new Set([...next,...started,...ended,...forces.map(x=>x.id)]);
  const manifolds=[],soloFootManifolds=[];
  for(let i=0;i<INITIAL_PLAYERS.length;i++){
   const id=INITIAL_PLAYERS[i].id;
   if(!relevant.has(id)||colliders[i]===null)continue;
   world.contactPair(ballCollider,colliders[i],(m,flipped)=>{
    const geometricContacts=m.numContacts(),solverContacts=m.numSolverContacts();
    if(!geometricContacts&&!solverContacts)return;
    manifolds.push({id,flipped,normalWorld:vector(m.normal()),
     geometricContacts,solverContacts});
    if(soloCarry&&id===dribbleAttackerId)
     soloFootManifolds.push({foot:'left',geometricContacts,solverContacts});
   });
  }
  if(rightCollider&&relevant.has(dribbleAttackerId)){
   world.contactPair(ballCollider,rightCollider,(m,flipped)=>{
    const geometricContacts=m.numContacts(),solverContacts=m.numSolverContacts();
    if(!geometricContacts&&!solverContacts)return;
    manifolds.push({id:dribbleAttackerId,flipped,
     normalWorld:vector(m.normal()),geometricContacts,solverContacts});
    soloFootManifolds.push({foot:'right',geometricContacts,solverContacts});
   });
  }
  const observedSolver=summarizeFootSolverEvidence(
   collision,forces,manifolds);
  // Exact source tick: these per-foot force reports and contact manifolds
  // come from the SAME native world.step as the shoe STARTs. The ball
  // velocity delta is measured BEFORE the later autonomous action impulse.
  // World-step delta includes gravity, grass and all collisions; co-occurrence
  // is NOT a causal attribution to either shoe, even for an exclusive START.
  const footDynamics=soloCarry?Object.freeze({
   source:'native-rapier-world-step-before-carry-action',tick:nextTick,
   preStepBallVelocityMps:vector(priorBall.velocity),
   postStepBallVelocityMps:vector(postBall.velocity),
   worldStepBallVelocityDeltaMps:Object.freeze({
    x:postBall.velocity.x-priorBall.velocity.x,
    y:postBall.velocity.y-priorBall.velocity.y,
    z:postBall.velocity.z-priorBall.velocity.z,
    magnitude:dv
   }),
   feet:Object.freeze(Object.fromEntries(['left','right'].map(foot=>{
    const force=soloFootForces.get(foot);
    const contact=soloFootManifolds.filter(x=>x.foot===foot);
    return [foot,Object.freeze({
     started:footStarts.has(foot),active:nextSoloFeet.has(foot),
     nativeForceEventCount:force?.eventCount??0,
     totalReportedForceMagnitudeN:force?.totalReportedMagnitudeN??0,
     peakReportedForceMagnitudeN:force?.maxReportedMagnitudeN??0,
     nativeManifoldCount:contact.length,
     geometricContacts:contact.reduce((n,x)=>n+x.geometricContacts,0),
     solverContacts:contact.reduce((n,x)=>n+x.solverContacts,0)
    })];
   }))),
   causalAttribution:false,readOnly:true
  }):null;
  tick=nextTick;active=next;activeSoloFeet=nextSoloFeet;
  current=footDynamics?Object.freeze({...collision,
   nativeSoloFeet:Object.freeze({...collision.nativeSoloFeet,
    dynamics:footDynamics})}):collision;
  solver=observedSolver;
  return Object.freeze({collision:current,timeline:observedTimeline,solver});
 }
 function dispose(){if(!disposed){
  disposed=true;
  if(ownsEventQueue)eventQueue.free();
 }}
 return Object.freeze({
  eventQueue,prepare,observe,dispose,
  physicalColliderIds:Object.freeze(initialPlayers.filter(p=>
   physicalIds===null||physicalIds.has(p.id)).map(p=>p.id)),
  physicalShoeColliderCount:colliders.filter(Boolean).length+
   (rightCollider?1:0),
  snapshot:()=>{live();return current;},
  timeline:()=>{live();return timeline.snapshot();},
  solver:()=>{live();return solver;}
 });
}
