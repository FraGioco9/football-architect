// #624 - opt-in private 22-shoe Rapier bridge for the EXISTING ball world.
// This module creates no world, assigns no player movement and never kicks.
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {soloCarryPhaseConfiguration,SOLO_CARRY_PHASES} from './solo-carry-phases.mjs';
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
  const cue=carryPhase!==null?
   soloCarryPhaseConfiguration(carryPhase):null;
  const baseFrequencyHz=solo||cue?
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
  const forwardM=(solo||cue?(cue?.shoeForwardStrokeM??0.075):0.105)*stroke+
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

 
// #628: two independently positioned native shoes, shared by current Carry.
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

// Conservative rounded-box proximity estimate for a Sprint support foot.
// Target geometry only: actual START/END and all impulses remain native.
export function nativeSprintSupportTargets(stance,player,ball,activeFeet,profile,ballRadiusM){
 if(!stance?.left||!stance?.right||!Array.isArray(activeFeet)||
    activeFeet.some(f=>f!=='left'&&f!=='right')||new Set(activeFeet).size!==activeFeet.length||
    ![player?.facingRad,ball?.x,ball?.y,ball?.z,profile?.halfLengthM,profile?.halfWidthM,profile?.halfHeightM,profile?.roundingM,ballRadiusM].every(Number.isFinite)||
    ballRadiusM<=0||profile.halfLengthM<=0||profile.halfWidthM<=0||profile.halfHeightM<=0||profile.roundingM<0)
  throw new TypeError('Live paired Sprint support geometry required');
 const c=Math.cos(player.facingRad),si=Math.sin(player.facingRad);
 const metrics=Object.fromEntries(['left','right'].map(foot=>{
  const pose=footProxyTransform(stance[foot]),dx=ball.x-pose.x,dy=ball.y-pose.y;
  const ahead=dx*c+dy*si,lateral=-dx*si+dy*c;
  const distance=Math.hypot(Math.max(0,Math.abs(ahead)-profile.halfLengthM),
   Math.max(0,Math.abs(lateral)-profile.halfWidthM),
   Math.max(0,Math.abs(ball.z-pose.z)-profile.halfHeightM));
  return [foot,{ahead,distance,reachable:distance<=ballRadiusM+profile.roundingM}];
 }));
 const near=foot=>metrics[foot].reachable&&metrics[foot].ahead>=0;
 let support=[];
 if(activeFeet.length===2){
  // Both already physically active: propose release, not a new lead.
  support=activeFeet.filter(near);
 }else if(activeFeet.length===1){
  const other=activeFeet[0]==='left'?'right':'left';
  if(near(other))support=[other];
 }else if(near('left')&&near('right')){
  const delta=metrics.left.distance-metrics.right.distance;
  const lead=Math.abs(delta)<=1e-9?(c>=0?'right':'left'):delta<0?'left':'right';
  support=[lead==='left'?'right':'left'];
 }
 if(!support.length)return stance;
 const target=foot=>{
  const p=stance[foot];
  // Existing neutral stance's rearward 0.20m offset. Real travel remains
  // governed by the same per-tick continuous native shoe limits.
  return Object.freeze({...p,x:p.x-.20*c,y:p.y-.20*si});
 };
 return Object.freeze({...stance,...Object.fromEntries(support.map(f=>[f,target(f)]))});
}

// Shared neutral striking stance: retain the original forward shoe proxy
// on the centreline and keep the second, supporting foot behind it.
// Both shoes remain real, continuously moving colliders; exclusivity is
// still determined only by Rapier events, not this geometric proposal.
export function nativeNeutralShoePositions(player){
 if(!player||![player.x,player.y,player.facingRad].every(Number.isFinite))
  throw new TypeError('Canonical neutral shoe stance required');
 const c=Math.cos(player.facingRad),s=Math.sin(player.facingRad);
 // Reflection of X exchanges anatomical left/right. For the same
 // world-Y flank use the opposite leading foot on a reflected heading.
 const lead=c>=0?'right':'left',supportSide=lead==='right'?1:-1;
 const front=Object.freeze({...player});
 const support=Object.freeze({...player,
  x:player.x-.20*c-supportSide*.14*s,
  y:player.y-.20*s+supportSide*.14*c});
 return Object.freeze({left:lead==='left'?front:support,
  right:lead==='right'?front:support,leadFoot:lead,
  source:'native-neutral-striking-stance-v1'});
}

// A low descending delivery is met with a small withdrawal of the
// forward shoe along its measured incoming trajectory. This is a bounded
// target adjustment, not a ball correction or contact authorization.
export function nativeLowDeliveryShoeTarget(pose,player,ball){
 const p=ball?.position,v=ball?.velocity;
 if(![p?.x,p?.y,p?.z,v?.x,v?.y,v?.z,player?.x,player?.y].every(Number.isFinite))return pose;
 const speed=Math.hypot(v.x,v.y);
 if(p.z<0.22||p.z>0.65||v.z>=-0.15||speed<2||
    Math.hypot(p.x-player.x,p.y-player.y)>1.25)return pose;
 // Move with the inbound ball, leaving the supporting foot unchanged.
 // Existing per-tick whole-shoe and lateral motion limits still apply.
 const travel=0.06;
 return Object.freeze({...pose,x:pose.x+v.x/speed*travel,y:pose.y+v.y/speed*travel});
}

// Native pace is selected by the same-tick common movement policy, not a
// LAB identity, possession award, or shoe event.
export function selectNativeCarryStridePhase(player,decisions,tick,activeIds){
 if(player.role==='goalkeeper'||!activeIds.has(player.id))return null;
 const d=decisions?.find(d=>d.id===player.id&&d.tick===tick&&d.kind==='carry-ball');
 return SOLO_CARRY_PHASES.includes(d?.carryPhase)?d.carryPhase:null;
}

// One material/geometry descriptor for both native shoes. Legacy ground
// diagnostics keep their historical values until common physics acceptance.
export function nativeShoeContactProfile({legacyGround=false,widthScale=1,lengthScale=1,researchScale=false}={}){
 if(typeof legacyGround!=='boolean'||typeof researchScale!=='boolean'||![0.9,1,1.1].includes(widthScale)||![0.9,1,1.05,1.075,1.1].includes(lengthScale)||
    !legacyGround&&!researchScale&&(widthScale!==1||lengthScale!==1))throw new TypeError('Valid native shoe geometry required');
 return Object.freeze({halfLengthM:FOOT_CONTACT_HALF_LENGTH_M*lengthScale,halfWidthM:FOOT_CONTACT_HALF_WIDTH_M*widthScale,
  halfHeightM:legacyGround?0.015:FOOT_CONTACT_HALF_HEIGHT_M,roundingM:legacyGround?0.01:FOOT_CONTACT_ROUNDING_M,
  friction:FOOT_CONTACT_FRICTION,restitution:legacyGround?0:FOOT_CONTACT_RESTITUTION});
}
// Physical foot events are reduced to canonical actor transitions only
// after the whole native queue has been consumed. An overlapping change
// of foot is not a new START; two simultaneous feet are not exclusive.
export function summarizeNativeFootTransition(previous,next,starts){
 for(const feet of [previous,next,starts])if(!(feet instanceof Set)||[...feet].some(f=>f!=='left'&&f!=='right'))
  throw new TypeError('Native left/right foot sets required');
 return Object.freeze({actorStarted:previous.size===0&&next.size>0,
  actorEnded:previous.size>0&&next.size===0,
  exclusivePhysicalStart:starts.size===1&&next.size===1&&[...starts].every(f=>next.has(f))});
}

// A canonical actor START alone is insufficient when two feet exist.
export function hasExclusiveNativeShoeStart(contact,id){
 if(!id||contact?.started?.length!==1||contact?.active?.length!==1||
    contact.started[0]!==id||contact.active[0]!==id)return false;
 if(contact.nativePairedFeet!==undefined){
  const pair=contact.nativePairedFeet?.[id];
  return pair?.actorId===id&&pair.independentColliders===2&&pair.exclusivePhysicalStart===true&&
   Array.isArray(pair.started)&&Array.isArray(pair.active)&&pair.started.length===1&&pair.active.length===1&&
   ['left','right'].includes(pair.started[0])&&pair.started[0]===pair.active[0];
 }
 if(contact.nativeSoloFeet!==undefined){
  const pair=contact.nativeSoloFeet;
  return pair.actorId===id&&pair.exclusivePhysicalStart===true&&pair.started.length===1&&pair.active.length===1&&pair.started[0]===pair.active[0];
 }
 return true;
}
// All current selected participants use the paired bridge. Only the
// archived ground-carry comparator retains its original topology.
export function usesNativePairedShoeBridge({activePlayerIds,legacyGroundCarry=false}={}){
 return Array.isArray(activePlayerIds)&&activePlayerIds.length>0&&!legacyGroundCarry;
}
export function nativePairedCarryReadout(pair,metadata){
 if(!pair||pair.actorId!==metadata.actorId||pair.independentColliders!==2)
  throw new TypeError('Actual paired carry evidence required');
 return Object.freeze({...metadata,...pair,source:'rapier-physical-collider-events'});
}
// Recover only the physical foot that actually struck. The six-tick
// offset is an existing target profile, never a contact or ball impulse.
export function planNativeFirstTimeFootRecovery({contact,actorId,ballPosition,ballVelocity=null,legacyPose=null}={}){
 if(!hasExclusiveNativeShoeStart(contact,actorId)||![ballPosition?.x,ballPosition?.y].every(Number.isFinite))return null;
 const paired=contact.nativePairedFeet!==undefined;
 const evidence=paired?contact.nativePairedFeet[actorId]:null;
 const pose=paired?evidence.exclusiveFootPosition:legacyPose;
 if(![pose?.x,pose?.y,pose?.z].every(Number.isFinite))return null;
 // Paired feet withdraw away from the actual outgoing ball ray, rather
 // than merely from its present centre. Preserve the archived single-shoe
 // projection and bounded six-tick trajectory when no velocity is supplied.
 let direction=Math.sign(pose.y-ballPosition.y);
 if(paired&&ballVelocity!==null){
  if(![ballVelocity.x,ballVelocity.y].every(Number.isFinite))return null;
  const speed2=ballVelocity.x**2+ballVelocity.y**2;
  if(speed2>1e-8){
   const dx=pose.x-ballPosition.x,dy=pose.y-ballPosition.y;
   const eta=Math.max(0,(dx*ballVelocity.x+dy*ballVelocity.y)/speed2);
   const offset=dy-ballVelocity.y*eta;
   if(Math.abs(offset)>1e-8)direction=Math.sign(offset);
   else if(direction===0)direction=evidence.started[0]==='left'?1:-1;
  }
 }
 return Object.freeze({foot:paired?evidence.started[0]:null,direction});
}
export function nativeFirstTimeRecoveryTarget(pose,foot,release,age){
 if(!release||release.foot!==foot||!Number.isSafeInteger(age)||age<1||age>6)return pose;
 const offset=[0,0.10,0.20,0.20,0.10,0,0][age]*release.direction;
 return Object.freeze({...pose,y:pose.y+offset});
}
export function createPrivateRapierFootContactBridge(R,world,ballCollider,
 initialPlayers=INITIAL_PLAYERS,{sharedQueue=null,activePlayerIds=null,
 isolatedPhysicalBodies=false,isolatedGroundDribbleBallCentreZ=null,
 dribbleAttackerId=null,soloCarry=false,soloShoeWidthScale=1,
 soloShoeLengthScale=1,soloRecoveryStepScale=1,
 soloSprintCadenceScale=1,soloSprintLateralTrackScale=1,
 soloSprintActiveFootReleaseM=0,intentDrivenSoloCarry=false,
 firstTimeShotReleaseId=null,sharedDuelStride=false,fullFieldNative=false,nativeCarryStride=false,historicalCarryMaterial=isolatedGroundDribbleBallCentreZ!==null,pairedCarryReadoutId=null}={}){
 if(typeof historicalCarryMaterial!=='boolean'||historicalCarryMaterial&&isolatedGroundDribbleBallCentreZ===null)throw new TypeError('Historical shoe materials require original ground carry');
 const carryShoeCenterZ=historicalCarryMaterial?isolatedGroundDribbleBallCentreZ+0.018:null;
 if(pairedCarryReadoutId!==null&&(!nativeCarryStride||activePlayerIds?.length!==1||activePlayerIds[0]!==pairedCarryReadoutId||soloCarry||historicalCarryMaterial))throw new TypeError('Paired carry readout requires one current native actor');
 const carryReadoutId=soloCarry?dribbleAttackerId:pairedCarryReadoutId;
 const carryResearch=carryReadoutId!==null;
 if(typeof nativeCarryStride!=='boolean'||nativeCarryStride&&(activePlayerIds===null||dribbleAttackerId!==null||sharedQueue!==null))throw new TypeError('Paired native stride requires selected physical participants without legacy overrides');
 if(typeof fullFieldNative!=='boolean'||fullFieldNative&&(activePlayerIds?.length!==22||!isolatedPhysicalBodies||isolatedGroundDribbleBallCentreZ!==null||sharedQueue!==null))throw new TypeError('Full field requires all 22 guarded physical shoe identities');
 if(firstTimeShotReleaseId!==null&&(
    activePlayerIds?.length!==1||activePlayerIds[0]!==firstTimeShotReleaseId||
    !/^(home|away)-10$/.test(firstTimeShotReleaseId)||dribbleAttackerId!==null||
    isolatedPhysicalBodies||sharedQueue!==null))
  throw new TypeError('First-time release requires the isolated original shooter');
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
   activePlayerIds.length<1||activePlayerIds.length>(fullFieldNative?22:7)||
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
    (soloShoeWidthScale!==1&&!carryResearch))
  throw new TypeError('DEV counterfactual shoe widths require genuine solo Carry');
 if(![0.9,1,1.05,1.075,1.1].includes(soloShoeLengthScale)||
    ![0.85,0.925,1,1.15].includes(soloRecoveryStepScale)||
    ((soloShoeLengthScale!==1||soloRecoveryStepScale!==1)&&!carryResearch))
  throw new TypeError('DEV longitudinal toe/recovery variants require genuine solo Carry');
 if(![0,0.06,0.1].includes(soloSprintActiveFootReleaseM)||
     (soloSprintActiveFootReleaseM!==0&&!carryResearch))
  throw new TypeError('Real active-foot release requires Solo Carry shoes');
 if(![0.9,1,1.1].includes(soloSprintCadenceScale)||
    ![0.9,1,1.1].includes(soloSprintLateralTrackScale)||
    ((soloSprintCadenceScale!==1||soloSprintLateralTrackScale!==1)&&!carryResearch))
  throw new TypeError('DEV Sprint cadence and tracks require genuine solo Carry');
 if(typeof sharedDuelStride!=='boolean'||sharedDuelStride&&(!isolatedPhysicalBodies||soloCarry||activePlayerIds?.length!==2||dribbleAttackerId===null))
  throw new TypeError('Shared stride requires original guarded duel');
 const strideIds=new Set(sharedDuelStride?activePlayerIds:dribbleAttackerId===null?[]:[dribbleAttackerId]);
 const baseShoeProfile=nativeShoeContactProfile({legacyGround:historicalCarryMaterial});
 const soloShoeProfile=carryResearch?nativeShoeContactProfile({legacyGround:historicalCarryMaterial,widthScale:soloShoeWidthScale,lengthScale:soloShoeLengthScale,researchScale:true}):baseShoeProfile;
 const soloShoeHalfWidthM=soloShoeProfile.halfWidthM;
 const soloShoeHalfLengthM=soloShoeProfile.halfLengthM;
 const shoeColliderDesc=profile=>R.ColliderDesc.roundCuboid(profile.halfLengthM,profile.halfWidthM,profile.halfHeightM,profile.roundingM)
  .setFriction(profile.friction).setRestitution(profile.restitution)
  .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS|R.ActiveEvents.CONTACT_FORCE_EVENTS);
 const physicalIds=activePlayerIds===null?null:new Set(activePlayerIds);
 const eventQueue=sharedQueue??new R.EventQueue(true);
 const ownsEventQueue=sharedQueue===null;
 const colliders=[],bodies=[],idsByCollider=new Map();
 // D-01 retains its original single shoe. Solo Carry stages TWO native
 // kinematic shoes whose lateral tracks and opposing strides remain distinct.
 function shoeFeet(frame,stepTick,gait=null,duelGaits=null){
  if(dribbleAttackerId===null)return frame;
  return Object.freeze(frame.map((p,i)=>{
   if(!strideIds.has(initialPlayers[i].id))return p;
   const chosen=duelGaits?.[initialPlayers[i].id]??gait;
   const swingM=chosen?.forwardM??-0.105*Math.cos(2*Math.PI*stepTick/24);
   const lateralM=chosen?.sideM??0;
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
 const nativePairs=new Map();
 const pairGeometry=(p,gait=null,activeFeet=empty)=>gait===null?nativeNeutralShoePositions(p):soloCarryTwoFootPositions(p,gait,p.id===pairedCarryReadoutId?{recoveryStepScale:soloRecoveryStepScale,sprintLateralTrackScale:soloSprintLateralTrackScale,nativeActiveFeet:activeFeet,sprintActiveFootReleaseM:gait?.carryPhase==='sprint'?soloSprintActiveFootReleaseM:0}:{});
 const stagedFeet=nativeCarryStride?Object.freeze(initialPlayers.map(p=>physicalIds.has(p.id)?pairGeometry(p).left:p)):shoeFeet(initialPlayers,0);
 for(const p of stagedFeet){
  const pose=footProxyTransform(p);
  const groundPose=carryShoeCenterZ===null?pose:{...pose,z:carryShoeCenterZ};
  const body=world.createRigidBody(
   R.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(groundPose.x,groundPose.y,groundPose.z)
     .setRotation(pose.rotation));
  const shoeShape=shoeColliderDesc(p.id===carryReadoutId?soloShoeProfile:baseShoeProfile);
  if(intentDrivenSoloCarry&&soloCarry&&p.id===dribbleAttackerId)
   shoeShape.setCollisionGroups(0);
  else if(sharedQueue!==null||isolatedPhysicalBodies||nativeCarryStride)
   shoeShape.setCollisionGroups(0x00010001);
  const collider=physicalIds===null||physicalIds.has(p.id)?
   world.createCollider(shoeShape,body):null;
  bodies.push(body);colliders.push(collider);
  if(collider)idsByCollider.set(collider.handle,
   Object.freeze({id:p.id,foot:nativeCarryStride||soloCarry&&p.id===dribbleAttackerId?'left':null}));
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
    .setTranslation(pose.x,pose.y,carryShoeCenterZ??pose.z)
    .setRotation(pose.rotation));
  rightCollider=world.createCollider(shoeColliderDesc(soloShoeProfile)
    .setCollisionGroups(intentDrivenSoloCarry?0:0x00010001),rightBody);
  idsByCollider.set(rightCollider.handle,
   Object.freeze({id:dribbleAttackerId,foot:'right'}));
 }
 // All physically active open-play actors receive an independent right
 // shoe in the same world. Inactive schema placeholders have no collider.
 if(nativeCarryStride)for(const p of initialPlayers.filter(p=>physicalIds.has(p.id))){
  const actual=pairGeometry(p).right,pose=footProxyTransform(actual);
  const body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()
   .setTranslation(pose.x,pose.y,pose.z).setRotation(pose.rotation));
  const collider=world.createCollider(shoeColliderDesc(p.id===carryReadoutId?soloShoeProfile:baseShoeProfile).setCollisionGroups(0x00010001),body);
  idsByCollider.set(collider.handle,Object.freeze({id:p.id,foot:'right'}));
  nativePairs.set(p.id,{body,collider,actual,active:new Set()});
 }
 const timeline=createFootContactTimeline(stagedFeet);
 let positions=Object.freeze(initialPlayers.map(p=>
  Object.freeze({x:p.x,y:p.y,facingRad:p.facingRad}))),
  tick=0,disposed=false;
 let actualShoeFeet=stagedFeet;
 let gaitPhaseRad=0,lastGaitFrequencyHz=null;
 const duelPhases=Object.fromEntries([...strideIds].map(id=>[id,0]));
 const nativeStridePhases=new Map();
 let pairedPreviousPoses=null;
 const shotReleaseIndex=firstTimeShotReleaseId===null?-1:
  initialPlayers.findIndex(p=>p.id===firstTimeShotReleaseId);
 let shotRelease=null,releasePreviousNativePose=null;
 const releaseBody=()=>shotRelease?.foot==='right'?nativePairs.get(firstTimeShotReleaseId).body:bodies[shotReleaseIndex];
 let active=new Set(),activeSoloFeet=new Set(),solver=null;
 let current=Object.freeze({
  version:FOOT_CONTACT_VERSION,tick:0,
  started:empty,ended:empty,active:empty,
  onsetBallDeltaVelocityMps:null
 });
 const live=()=>{if(disposed)throw new Error('Rapier contact bridge disposed');};
 function prepare(playerFrame,nextTick,preStepBall=null,previousStrike=null){
  live();
  if(nextTick!==tick+1)throw new RangeError('Nonconsecutive physical shoe tick');
  // Validate ALL actors, headings and physical displacement before mutation.
  const next=validateFootContactFrame(playerFrame,nextTick,positions);
  // Recover the real shoe after a side-on strike without leaving a stationary
  // obstacle in the redirected ball's path. Only after genuine native START.
  // Direction uses actual contact geometry, not goal position or seed.
  if(previousStrike!==null){
   if(shotReleaseIndex<0||shotRelease!==null||!preStepBall?.position||
      previousStrike.tick!==tick||previousStrike.playerId!==firstTimeShotReleaseId||
      previousStrike.action!=='shot'||previousStrike.actualPhysicsImpulseApplied!==true||
      previousStrike.firstTimeShotEvidence?.nativeExclusiveShoeStart!==true||
      !hasExclusiveNativeShoeStart(current,firstTimeShotReleaseId))
    throw new TypeError('First-time recovery needs the immediately preceding real strike');
   const plan=planNativeFirstTimeFootRecovery({contact:current,actorId:firstTimeShotReleaseId,
    ballPosition:preStepBall.position,ballVelocity:preStepBall.velocity,legacyPose:bodies[shotReleaseIndex].translation()});
   if(!plan||nativeCarryStride&&previousStrike.firstTimeShotEvidence.contactFoot!==plan.foot)
    throw new TypeError('First-time recovery needs the actual exclusive striking shoe');
   shotRelease=Object.freeze({strikeTick:tick,...plan});
  }
  releasePreviousNativePose=shotRelease&&nextTick<=shotRelease.strikeTick+6?
   vector(releaseBody().translation()):null;
  const actor=dribbleAttackerId===null?null:
   playerFrame.players.find(p=>p.id===dribbleAttackerId);
  const gait=actor?advanceD01LiveShoeGait({
   phaseRad:gaitPhaseRad,player:actor,ball:preStepBall,tick:nextTick,solo:soloCarry,
   carryPhase:soloCarry?playerFrame.soloCarryPhase?.phase:null,
   sprintCadenceScale:soloCarry?soloSprintCadenceScale:1
  }):null;
  const duelGaits=sharedDuelStride?Object.fromEntries(playerFrame.players.filter(p=>strideIds.has(p.id)).map(p=>[p.id,
   advanceD01LiveShoeGait({phaseRad:duelPhases[p.id],player:p,ball:preStepBall,tick:nextTick,solo:false})])):null;
  if(soloCarry)lastGaitFrequencyHz=gait.frequencyHz;
  // Separate stride cadence from contact frequency without turning the
  // foot into a 7 m/s lateral paddle. Genuine side-step motion is limited
  // to 1.6 m/s in the solo research source; forward running retains the
  // original 7 m/s whole-shoe continuity bound and Rapier collision solver.
  const limitSoloFootLateralMotion=(desired,previous)=>{
   if(!soloCarry&&!nativeCarryStride)return desired;
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
  let proposed=experimentalFeet?
   Object.freeze(shoeFeet(next,nextTick,gait).map((p,i)=>
    initialPlayers[i].id===dribbleAttackerId?experimentalFeet.left:p)):
   shoeFeet(next,nextTick,gait,duelGaits);
  if(releasePreviousNativePose!==null&&!nativeCarryStride){
   proposed=Object.freeze(proposed.map((p,i)=>i===shotReleaseIndex?
    nativeFirstTimeRecoveryTarget(p,null,shotRelease,nextTick-shotRelease.strikeTick):p));
  }
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
  let newFeet=dribbleAttackerId===null?proposed:
   Object.freeze(proposed.map((rawFoot,i)=>{
    if(!strideIds.has(initialPlayers[i].id))return rawFoot;
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
  // Paired open-play shoes use the same live phase-dependent geometry
  // as Solo Carry, and return to a neutral two-foot stance otherwise.
  if(nativeCarryStride){
   pairedPreviousPoses=Object.fromEntries([...nativePairs].map(([id,pair])=>[id,{left:vector(bodies[initialPlayers.findIndex(p=>p.id===id)].translation()),right:vector(pair.body.translation())}]));
   newFeet=Object.freeze(newFeet.map((foot,i)=>{
    const p=playerFrame.players[i],pair=nativePairs.get(p.id);
    if(!pair)return foot;
    const phase=selectNativeCarryStridePhase(p,playerFrame.smallSidedMovementDecisions,nextTick,physicalIds);
    let gait=null;
    if(phase!==null){
     gait=advanceD01LiveShoeGait({phaseRad:nativeStridePhases.get(p.id)??0,player:p,ball:preStepBall,tick:nextTick,carryPhase:phase,solo:p.id===pairedCarryReadoutId,sprintCadenceScale:p.id===pairedCarryReadoutId?soloSprintCadenceScale:1});
     nativeStridePhases.set(p.id,gait.phaseRad);
    }else nativeStridePhases.delete(p.id);
    if(p.id===pairedCarryReadoutId)lastGaitFrequencyHz=gait?.frequencyHz??null;
    const stride=pairGeometry(p,gait,[...pair.active]);
    const neutral=phase==='sprint'?nativeSprintSupportTargets(stride,p,preStepBall.position,[...pair.active],p.id===carryReadoutId?soloShoeProfile:baseShoeProfile,ballCollider.radius()):stride;
    const desired=gait===null&&p.role!=='goalkeeper'&&pair.active.size===0?
     Object.freeze({...neutral,[neutral.leadFoot]:nativeLowDeliveryShoeTarget(neutral[neutral.leadFoot],p,preStepBall)}):neutral;
    const recovering=releasePreviousNativePose!==null&&p.id===firstTimeShotReleaseId;
    const age=recovering?nextTick-shotRelease.strikeTick:0;
    const leftTarget=recovering?nativeFirstTimeRecoveryTarget(desired.left,'left',shotRelease,age):desired.left;
    const rightTarget=recovering?nativeFirstTimeRecoveryTarget(desired.right,'right',shotRelease,age):desired.right;
    // Preserve the existing first-time release profile's 6 m/s lateral
    // intent, but retain the 7 m/s total native shoe continuity limit.
    const right=clampActualFoot(recovering&&shotRelease.foot==='right'?rightTarget:limitSoloFootLateralMotion(rightTarget,pair.actual),pair.actual);
    const pose=footProxyTransform(right);
    pair.body.setNextKinematicTranslation({x:pose.x,y:pose.y,z:pose.z});
    pair.body.setNextKinematicRotation(pose.rotation);
    pair.actual=right;
    return clampActualFoot(recovering&&shotRelease.foot==='left'?leftTarget:limitSoloFootLateralMotion(leftTarget,actualShoeFeet[i]),actualShoeFeet[i]);
   }));
  }
  const rightFoot=rightDesired?
   clampActualFoot(rightDesired,actualRightFoot):null;
  const poses=newFeet.map(footProxyTransform);
  for(let i=0;i<poses.length;i++){
   const p=poses[i];
   if(strideIds.has(initialPlayers[i].id)||nativePairs.has(initialPlayers[i].id)||i===shotReleaseIndex){
    const previous=footProxyTransform(actualShoeFeet[i]);
    if(Math.hypot(p.x-previous.x,p.y-previous.y)>7/60+1e-5)
     throw new TypeError('D-01 real shoe exceeds original 7m/s continuity');
   }
   bodies[i].setNextKinematicTranslation({x:p.x,y:p.y,
    z:carryShoeCenterZ??p.z});
   bodies[i].setNextKinematicRotation(p.rotation);
  }
  if(rightFoot){
   const current=footProxyTransform(actualRightFoot);
   const target=footProxyTransform(rightFoot);
   if(Math.hypot(target.x-current.x,target.y-current.y)>7/60+1e-5)
    throw new TypeError('Solo right shoe exceeds actual 7m/s bound');
   rightBody.setNextKinematicTranslation({
    x:target.x,y:target.y,z:carryShoeCenterZ??target.z
   });
   rightBody.setNextKinematicRotation(target.rotation);
   actualRightFoot=rightFoot;
  }
  positions=next;actualShoeFeet=newFeet;
  if(gait)gaitPhaseRad=gait.phaseRad;
  if(duelGaits)for(const id of strideIds)duelPhases[id]=duelGaits[id].phaseRad;
 }
 function observe(nextTick,priorBall,postBall,sharedEvents=null){
  live();
  if(nextTick!==tick+1||!priorBall?.position||!priorBall?.velocity||
     !postBall?.position||!postBall?.velocity)
   throw new RangeError('Consecutive actual pre/post Rapier states required');
  const started=new Set(),ended=new Set(),next=new Set(active);
  const footStarts=new Set(),footEnds=new Set();
  const nextSoloFeet=new Set(activeSoloFeet);
  const pairEvents=new Map([...nativePairs].map(([id,pair])=>[id,{next:new Set(pair.active),starts:new Set(),ends:new Set()}]));
  const visitCollision=(a,b,began)=>{
   const other=a===ballCollider.handle?b:
    b===ballCollider.handle?a:null;
   const physical=idsByCollider.get(other);
   if(!physical)return; // no turf, no proxy-to-proxy contact
   const events=pairEvents.get(physical.id);
   if(events){
    if(began){events.starts.add(physical.foot);events.next.add(physical.foot);}
    else{events.ends.add(physical.foot);events.next.delete(physical.foot);}
    return;
   }
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
  const soloTransition=soloCarry?summarizeNativeFootTransition(activeSoloFeet,nextSoloFeet,footStarts):null;
  if(soloTransition?.actorStarted){
   started.add(dribbleAttackerId);next.add(dribbleAttackerId);
  }else if(soloTransition?.actorEnded){
   ended.add(dribbleAttackerId);next.delete(dribbleAttackerId);
  }
  const pairedEvidence={};
  for(const [id,events] of pairEvents){
   const pair=nativePairs.get(id),transition=summarizeNativeFootTransition(pair.active,events.next,events.starts);
   if(transition.actorStarted){started.add(id);next.add(id);}
   if(transition.actorEnded){ended.add(id);next.delete(id);}
   pair.active=events.next;
   if(id===pairedCarryReadoutId||events.next.size||events.starts.size||events.ends.size){
    const foot=transition.exclusivePhysicalStart?[...events.starts][0]:null;
    const leftIndex=initialPlayers.findIndex(p=>p.id===id);
    pairedEvidence[id]=Object.freeze({actorId:id,independentColliders:2,
     started:Object.freeze(['left','right'].filter(f=>events.starts.has(f))),
     ended:Object.freeze(['left','right'].filter(f=>events.ends.has(f))),
     active:Object.freeze(['left','right'].filter(f=>events.next.has(f))),
     exclusivePhysicalStart:transition.exclusivePhysicalStart,
     exclusiveFootPosition:foot===null?null:vector((foot==='left'?bodies[leftIndex]:pair.body).translation())});
   }
  }
  const carryEvents=pairedCarryReadoutId===null?null:pairEvents.get(pairedCarryReadoutId);
  const readoutStarts=carryEvents?.starts??footStarts,readoutActive=carryEvents?.next??nextSoloFeet;
  const dv=Math.hypot(
   postBall.velocity.x-priorBall.velocity.x,
   postBall.velocity.y-priorBall.velocity.y,
   postBall.velocity.z-priorBall.velocity.z
  );
  const collision=Object.freeze({
   version:FOOT_CONTACT_VERSION,tick:nextTick,
   started:ordered(started),ended:ordered(ended),active:ordered(next),
   ...(nativeCarryStride?{nativePairedFeet:Object.freeze(pairedEvidence)}:{}),
   ...(carryResearch?{nativeSoloFeet:(pairedCarryReadoutId===null?Object.freeze:n=>nativePairedCarryReadout(pairedEvidence[pairedCarryReadoutId],n))({
    actorId:carryReadoutId,source:'rapier-physical-collider-events',
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
    exclusivePhysicalStart:soloTransition?.exclusivePhysicalStart??pairedEvidence[pairedCarryReadoutId].exclusivePhysicalStart
   })}:{}),
   // Whole-ball delta includes gravity/turf; never shoe attribution.
   onsetBallDeltaVelocityMps:started.size?dv:null
  });
  const pairedTrajectories=nativeCarryStride?Object.fromEntries([...nativePairs].map(([id,pair])=>[id,{left:{before:pairedPreviousPoses[id].left,after:vector(bodies[initialPlayers.findIndex(p=>p.id===id)].translation())},right:{before:pairedPreviousPoses[id].right,after:vector(pair.body.translation())}}])):null;
  const observedTimeline=timeline.observe(collision,priorBall,actualShoeFeet,pairedTrajectories);
  const forcePairs=new Map(),soloFootForces=new Map();
  const visitForce=(a,b,f,d,totalMagnitude,maxMagnitude)=>{
   const other=a===ballCollider.handle?b:
    b===ballCollider.handle?a:null;
   const physical=idsByCollider.get(other);
   if(!physical)return;
   if(carryResearch&&physical.id===carryReadoutId){
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
    if(carryResearch&&id===carryReadoutId)
     soloFootManifolds.push({foot:'left',geometricContacts,solverContacts});
   });
  }
  for(const [id,pair] of nativePairs)if(relevant.has(id)){
   world.contactPair(ballCollider,pair.collider,(m,flipped)=>{
    const geometricContacts=m.numContacts(),solverContacts=m.numSolverContacts();
    if(!geometricContacts&&!solverContacts)return;
    manifolds.push({id,flipped,normalWorld:vector(m.normal()),geometricContacts,solverContacts});
    if(id===pairedCarryReadoutId)soloFootManifolds.push({foot:'right',geometricContacts,solverContacts});
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
  const footDynamics=carryResearch?Object.freeze({
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
     started:readoutStarts.has(foot),active:readoutActive.has(foot),
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
  const nativeShotRelease=releasePreviousNativePose===null?null:(()=>{
   const position=vector(releaseBody().translation());
   const speedMps=60*Math.hypot(position.x-releasePreviousNativePose.x,
    position.y-releasePreviousNativePose.y,position.z-releasePreviousNativePose.z);
   if(speedMps>7+1e-3)throw new Error('Native first-time shoe recovery exceeded continuity');
   return Object.freeze({source:'native-shoe-recovery-v1',strikeTick:shotRelease.strikeTick,
    tick:nextTick,actorId:firstTimeShotReleaseId,position,speedMps,
    ...(shotRelease.foot!==null?{contactFoot:shotRelease.foot}:{}),
    colliderRetained:true,officialGoal:false});
  })();
  current=footDynamics?Object.freeze({...collision,
   nativeSoloFeet:Object.freeze({...collision.nativeSoloFeet,
    dynamics:footDynamics})}):nativeShotRelease?
    Object.freeze({...collision,nativeShotRelease}):collision;
  solver=observedSolver;
  return Object.freeze({collision:current,timeline:observedTimeline,solver});
 }
 function dispose(){if(!disposed){
  disposed=true;
  if(ownsEventQueue)eventQueue.free();
 }}
 return Object.freeze({
  eventQueue,prepare,observe,dispose,
  contactMaterialProfile:soloShoeProfile,
  physicalColliderIds:Object.freeze(initialPlayers.filter(p=>
   physicalIds===null||physicalIds.has(p.id)).map(p=>p.id)),
  physicalShoeColliderCount:colliders.filter(Boolean).length+
   (rightCollider?1:0)+nativePairs.size,
  snapshot:()=>{live();return current;},
  timeline:()=>{live();return timeline.snapshot();},
  solver:()=>{live();return solver;}
 });
}
