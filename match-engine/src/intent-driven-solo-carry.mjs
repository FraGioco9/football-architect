// #628 — DEV-only intentional dribble. This is a GAMEPLAY touch at genuine
// 60Hz player/ball proximity, not a Rapier shoe-contact observation.
// The sole football remains the original unmodified Rapier dynamic body.
// Other scenarios retain their original physical shoe contact authority.
import {validateSoloCarryAttributes,uniformSoloCarryAttributes,
 calibrateSoloCarryTouch}
 from './solo-carry-attribute-calibration.mjs';
export const INTENT_SOLO_CARRY_VERSION='me-628-intent-solo-carry-v1';
const finite=Number.isFinite;
export function chooseIntentSoloCarryTouch({
 tick,lastTouchTick,attackingSide,phase,player,ballPosition,ballVelocity,
 ballRadiusM,fixedPhaseLab=false,playerAttributes=null
}={}){
 if(!Number.isSafeInteger(tick)||tick<1||
    !Number.isSafeInteger(lastTouchTick)||lastTouchTick>=tick||
    typeof fixedPhaseLab!=='boolean'||
    (!fixedPhaseLab&&playerAttributes!==null)||
    !['home','away'].includes(attackingSide)||
    !['control','moderate','sprint'].includes(phase)||
    player?.id!==attackingSide+'-10'||player?.team!==attackingSide||
    !ballPosition||!ballVelocity||!finite(ballRadiusM)||
    ballRadiusM<0.05||ballRadiusM>0.2||
    ![player.x,player.y,player.vx,player.vy,ballPosition.x,
      ballPosition.y,ballPosition.z,ballVelocity.x,ballVelocity.y,
      ballVelocity.z].every(finite))
  throw new TypeError('A current canonical solo runner and real grounded Rapier ball are required');
 const forward=attackingSide==='home'?1:-1;
 const dx=forward*(ballPosition.x-player.x),dy=ballPosition.y-player.y;
 const gapM=Math.hypot(dx,dy);
 const speedMps=forward*ballVelocity.x;
 // Purposeful push then follow: spacing is perceptible at 60Hz.
 // Control is still more responsive than a longer Sprint push.
 const baseSpacingTicks=fixedPhaseLab?
  (phase==='sprint'?82:phase==='moderate'?32:48):
  phase==='sprint'?70:phase==='moderate'?58:48;
 // DEV fixed-phase trials distinguish ball pace. Automatic Carry is unchanged.
 const baseTargetSpeedMps=fixedPhaseLab&&phase==='sprint'?5.8:
  fixedPhaseLab&&phase==='moderate'?3.55:
  phase==='sprint'?3.35:phase==='moderate'?3.05:2.6;
 const baseMaxImpulseNs=fixedPhaseLab&&phase==='sprint'?2.55:
  fixedPhaseLab&&phase==='moderate'?1.5:1.10;
 const attributeInputs=fixedPhaseLab?
  validateSoloCarryAttributes(playerAttributes??uniformSoloCarryAttributes(50)):null;
 const calibration=attributeInputs===null?{
  spacingTicks:baseSpacingTicks,targetSpeedMps:baseTargetSpeedMps,
  maxImpulseNs:baseMaxImpulseNs
 }:calibrateSoloCarryTouch({
  spacingTicks:baseSpacingTicks,targetSpeedMps:baseTargetSpeedMps,
  maxImpulseNs:baseMaxImpulseNs
 },attributeInputs);
 const {spacingTicks,targetSpeedMps,maxImpulseNs}=calibration;
 // A purposeful push cannot happen while the ball is far away, behind,
 // airborne, moving already faster than needed, or the player just pushed.
 // The common executor starts at -12 ticks: enforcing 44-55 ticks before
 // the first fixed-phase push lets the runner overrun a stationary ball.
 const firstFixedTouch=fixedPhaseLab&&phase!=='control'&&lastTouchTick<0;
 if((!firstFixedTouch&&tick-lastTouchTick<spacingTicks)||
    gapM>1.25||dx<0.08||
    dx>1.25||Math.abs(dy)>0.45||
    Math.abs(ballPosition.z-ballRadiusM)>0.017||
    Math.abs(ballVelocity.z)>0.5||speedMps>=targetSpeedMps-0.2)
  return null;
 // An ordinary football has mass ~0.43kg; this is a genuine Rapier impulse,
 // not a setLinvel, scripted ball attachment or fake native shoe START.
 const magnitudeNs=Math.min(maxImpulseNs,Math.max(0.09,
  (targetSpeedMps-Math.max(0,speedMps))*0.43));
 const sidewaysNs=Math.max(-0.07,Math.min(0.07,-dy*0.16));
 return Object.freeze({
  version:INTENT_SOLO_CARRY_VERSION,tick,playerId:player.id,
  team:attackingSide,action:'carry',phase,spacingTicks,
  ...(fixedPhaseLab?{fixedPhaseLab:true,
   carryPlayerAttributes:attributeInputs}:{}),
  ballGapM:gapM,ballSpeedMps:speedMps,
  intendedTargetSpeedMps:targetSpeedMps,
  impulseNs:Object.freeze({x:forward*magnitudeNs,y:sidewaysNs,z:0}),
  trigger:'canonical-player-ball-proximity-and-pacing',
  nativeShoeContactVerified:false,actualRapierBallRequired:true,
  officialMatchAction:false,officialPossession:false,
  dribbleCompleted:false
 });
}
