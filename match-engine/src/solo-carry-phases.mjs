// #628 solo Carry: evidence-only phase selection at fixed 60Hz.
// No timed script, fake collision, possession, teleport or ball speed clamp.
import {validateSoloCarryAttributes,uniformSoloCarryAttributes,
 calibrateSoloCarryKinematics,calibrateSoloCarryTouch} from './solo-carry-attribute-calibration.mjs';
import {attackDirection} from './match-directions.mjs';
export const SOLO_CARRY_PHASES=Object.freeze(['control','moderate','sprint']);
const profiles=Object.freeze({
 control:Object.freeze({
  label:'Control',maxSpeedMps:3.0,accelerationMps2:6,brakingMps2:10,
  ballTargetOffsetM:-0.14,shoeFrequencyBaseHz:1.25,
  shoeFrequencySpeedHz:0.08,shoeForwardStrokeM:0.075
 }),
 moderate:Object.freeze({
  label:'Moderate',maxSpeedMps:4.0,accelerationMps2:6,brakingMps2:9,
  ballTargetOffsetM:-0.10,shoeFrequencyBaseHz:1.35,
  shoeFrequencySpeedHz:0.35,shoeForwardStrokeM:0.075
 }),
 sprint:Object.freeze({
  label:'Sprint',maxSpeedMps:4.5,accelerationMps2:8,brakingMps2:11,
  ballTargetOffsetM:-0.07,shoeFrequencyBaseHz:1.17,
  shoeFrequencySpeedHz:0.24,shoeForwardStrokeM:0.055
 })
});
export function soloCarryPhaseConfiguration(phase){
 if(!SOLO_CARRY_PHASES.includes(phase))
  throw new TypeError('Unknown solo Carry physical phase');
 return profiles[phase];
}
export function advanceSoloCarryPhase({previousPhase='control',tick,
 playerSpeedMps,ballSpeedMps,ballGapM,lockedPhase=null,playerAttributes=null,historicalKinematics=false}={}){
 if(typeof historicalKinematics!=='boolean'||!SOLO_CARRY_PHASES.includes(previousPhase)||
    (lockedPhase!==null&&!SOLO_CARRY_PHASES.includes(lockedPhase))||
    (lockedPhase===null&&playerAttributes!==null)||
    !Number.isSafeInteger(tick)||tick<1||
    ![playerSpeedMps,ballSpeedMps,ballGapM].every(n=>
     typeof n==='number'&&Number.isFinite(n)&&n>=0))
  throw new TypeError('Solo Carry phase requires original nonnegative 60Hz speed/gap');
 // Locked research constrains the available pace; automatic movement shares
 // the same observed transition policy as continuing collective carry.
 const phase=lockedPhase??selectNativeOpenCarryPhase({previousPhase,playerSpeedMps,ballSpeedMps,ballGapM});
 const attributeInputs=lockedPhase===null?null:
  playerAttributes===null?uniformSoloCarryAttributes(50):
   validateSoloCarryAttributes(playerAttributes);
 const calibrated=historicalKinematics&&attributeInputs===null?profiles[phase]:nativeReferenceCarryKinematics(phase,attributeInputs??uniformSoloCarryAttributes(50));
 return Object.freeze({
  tick,phase,previousPhase,changed:phase!==previousPhase,
  ...(lockedPhase!==null?{lockedPhase}:{}),
  playerSpeedMps,ballSpeedMps,ballGapM,...calibrated,
  ...(attributeInputs!==null?{carryPlayerAttributes:attributeInputs}:{}),
  originalCanonicalPlayer:true,originalRapierBall:true,
  nativeShoeEventCreated:false,ballImpulseCreated:false,
  officialPossession:false
 });
}

// The accepted reference pace profiles define intent, not a LAB identity.
const CARRY_TOUCH_PROFILES=Object.freeze({
 control:Object.freeze({targetSpeedMps:2.6,maxImpulseNs:1.10,
  spacingTicks:48}),
 moderate:Object.freeze({targetSpeedMps:3.55,maxImpulseNs:1.50,
  spacingTicks:32}),
 sprint:Object.freeze({targetSpeedMps:5.8,maxImpulseNs:2.55,
  spacingTicks:82})
});

export function selectNativeOpenCarryPhase({playerSpeedMps,ballSpeedMps,ballGapM,previousPhase=null}={}){
 if(![playerSpeedMps,ballSpeedMps,ballGapM].every(n=>Number.isFinite(n)&&n>=0)||
    previousPhase!==null&&!SOLO_CARRY_PHASES.includes(previousPhase))throw new TypeError('Observed carry phase geometry required');
 const sprint=playerSpeedMps>=2.58&&ballSpeedMps>=2.20&&ballGapM>=0.46;
 const moderate=playerSpeedMps>=1.45&&ballSpeedMps>=0.90&&ballGapM>=0.40;
 // A newly selected carry may already be at speed; only consecutive
 // same-actor carry decisions inherit the preceding phase.
 if(previousPhase===null)return sprint?'sprint':moderate?'moderate':'control';
 if(previousPhase==='control')return moderate?'moderate':'control';
 if(previousPhase==='moderate')return playerSpeedMps<1.0||ballSpeedMps<0.55||ballGapM<0.31?'control':sprint?'sprint':'moderate';
 return playerSpeedMps<2.45||ballSpeedMps<1.75||ballGapM<0.38?'moderate':'sprint';
}
// The previous phase is evidence, not a persistent entitlement to carry.
export function previousNativeCarryPhase(decisions,actorId,tick){
 const d=decisions?.find(d=>d.id===actorId&&d.tick===tick&&d.kind==='carry-ball');
 return SOLO_CARRY_PHASES.includes(d?.carryPhase)?d.carryPhase:null;
}
// Pure physical proposal. Caller must authenticate the exclusive contact;
// this helper neither applies an impulse nor certifies a shoe event.
export function planNativeCarryPhaseImpulse({phase,playerAttributes=uniformSoloCarryAttributes(50),player,attackingSide,ballVelocity,attackPolarity=1,nativeFixedSprintLongStride=false}={}){
 if(!Object.hasOwn(CARRY_TOUCH_PROFILES,phase)||player?.team!==attackingSide||
    ![player.vx,player.vy,ballVelocity?.x,ballVelocity?.y].every(Number.isFinite)||
    typeof nativeFixedSprintLongStride!=='boolean'||nativeFixedSprintLongStride&&phase!=='sprint')throw new TypeError('Live carry phase state required');
 const attrs=validateSoloCarryAttributes(playerAttributes),config=calibrateSoloCarryTouch(CARRY_TOUCH_PROFILES[phase],attrs);
 const forward=attackDirection(attackingSide,attackPolarity);
 const playerForward=Math.max(0,forward*player.vx),ballForward=forward*ballVelocity.x;
 const aheadAllowance=phase==='sprint'?(nativeFixedSprintLongStride?1.40:1.05):phase==='moderate'?0.85:0.48;
 const controlledTarget=Math.min(config.targetSpeedMps,Math.max(0.8,playerForward+aheadAllowance));
 const requiredDelta=controlledTarget-ballForward;
 const impulseNs=requiredDelta<=0.12?null:Object.freeze({x:forward*Math.min(config.maxImpulseNs,0.43*requiredDelta),y:0,z:0});
 return Object.freeze({phase,attributes:attrs,nativeFixedSprintLongStride,playerForwardSpeedMps:playerForward,
  observedPreImpulseBallForwardMps:ballForward,calibratedTargetSpeedMps:config.targetSpeedMps,
  controlledTargetSpeedMps:controlledTarget,impulseNs});
}

export function nativeReferenceCarryKinematics(phase,playerAttributes=uniformSoloCarryAttributes(50)){
 if(!SOLO_CARRY_PHASES.includes(phase))throw new TypeError('Unknown native Carry phase');
 const override=phase==='moderate'?{maxSpeedMps:4.7,accelerationMps2:9,brakingMps2:11,ballTargetOffsetM:-0.30}:
  phase==='sprint'?{maxSpeedMps:7.0,accelerationMps2:14,brakingMps2:14,ballTargetOffsetM:-0.62}:null;
 const tuned=override===null?profiles[phase]:Object.freeze({...profiles[phase],...override});
 return Object.freeze({...tuned,...calibrateSoloCarryKinematics(tuned,playerAttributes)});
}
// Common conservative pressure boundary, candidate pending physical QA.
export const NATIVE_OPEN_CARRY_GAP_M=6;
export function hasNativeOpenCarrySpace(ball,opponent=null){
 if(![ball?.x,ball?.y].every(Number.isFinite)||opponent!==null&&![opponent.x,opponent.y].every(Number.isFinite))
  throw new TypeError('Live carry space geometry required');
 return opponent===null||Math.hypot(opponent.x-ball.x,opponent.y-ball.y)>NATIVE_OPEN_CARRY_GAP_M;
}
// Both movement and contact policy use the same live, active participants.
// Sorting a copy preserves canonical actor ordering and deterministic ties.
export function nearestNativeCarryOpponent(player,ball,activePlayers){
 return activePlayers.filter(p=>p.team!==player.team).sort((a,b)=>
  Math.hypot(a.x-ball.x,a.y-ball.y)-Math.hypot(b.x-ball.x,b.y-ball.y)||a.id.localeCompare(b.id))[0]??null;
}
// A carry phase is a movement intent, not permission to override recovery,
// an already selected physical intervention, a delivery or a restart.
export function nativeCarryMotionHasPriority({movementKind,restartPlacement=null,recoveryLocked=false,balance=null,slide=null,shoulder=null,deliveryPlan=null}={}){
 return movementKind==='carry-ball'&&!restartPlacement&&!recoveryLocked&&!balance&&!slide&&!shoulder&&!deliveryPlan;
}
export function planNativeOpenCarryMotion({player,ball,velocity,opponent=null,phase=null,previousPhase=null,attackPolarity=1,playerAttributes=uniformSoloCarryAttributes(50),sprintLeadM=0.25}={}){
 if(!player||!hasNativeOpenCarrySpace(ball,opponent))return null;
 const selected=phase??selectNativeOpenCarryPhase({previousPhase,playerSpeedMps:Math.hypot(player.vx,player.vy),
  ballSpeedMps:Math.hypot(velocity.x,velocity.y),ballGapM:Math.hypot(player.x-ball.x,player.y-ball.y)});
 const configuration=nativeReferenceCarryKinematics(selected,playerAttributes);
 const dir=attackDirection(player.team,attackPolarity);
 const offset=nativeCarryPursuitOffset({phase:selected,configuration,player,ball,velocity,attackPolarity,sprintLeadM});
 return Object.freeze({phase:selected,configuration,target:Object.freeze({x:Math.max(-52.06,Math.min(52.06,ball.x+dir*offset)),y:Math.max(-33.56,Math.min(33.56,ball.y))})});
}
export function nativeCarryPursuitOffset({phase,configuration,player,ball,velocity,attackPolarity=1,sprintLeadM=0.25}={}){
 if(!SOLO_CARRY_PHASES.includes(phase)||![configuration?.ballTargetOffsetM,player?.x,ball?.x,velocity?.x,velocity?.y,sprintLeadM].every(Number.isFinite)||sprintLeadM<0||sprintLeadM>0.25)throw new TypeError('Live carry pursuit geometry required');
 const ahead=(ball.x-player.x)*attackDirection(player.team,attackPolarity);
 const scale=Math.max(0,Math.min(1,(ahead-0.44)/0.16));
 return phase==='sprint'?(Math.hypot(velocity.x,velocity.y)<0.45?-0.18:0.08+sprintLeadM*scale):
  phase==='moderate'?-0.06:configuration.ballTargetOffsetM;
}
