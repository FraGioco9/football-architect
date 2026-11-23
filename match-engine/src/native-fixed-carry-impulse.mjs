// #628 — ISOLATED DEV native fixed-phase counterfactual.
// Can change the impulse of an already-selected ORIGINAL action *only*
// following the same-world authentic exclusive Rapier shoe START. It never
// creates shoe events, applies impulses, sets ball velocity or possession.
import {calibrateSoloCarryTouch,validateSoloCarryAttributes}
 from './solo-carry-attribute-calibration.mjs';

const PHASES=Object.freeze({
 control:Object.freeze({targetSpeedMps:2.6,maxImpulseNs:1.10,
  spacingTicks:48}),
 moderate:Object.freeze({targetSpeedMps:3.55,maxImpulseNs:1.50,
  spacingTicks:32}),
 sprint:Object.freeze({targetSpeedMps:5.8,maxImpulseNs:2.55,
  spacingTicks:82})
});
export function chooseNativeFixedCarryImpulse({
 phase,playerAttributes,player,attackingSide,ballVelocity,
 verifiedNativeExclusiveShoeStart,nativeFixedSprintLongStride=false,
 nativeFixedSprintLeadExtraMps=0
}={}){
 if(![0,0.20,0.35].includes(nativeFixedSprintLeadExtraMps)||
    (nativeFixedSprintLeadExtraMps!==0&&
     (phase!=='sprint'||nativeFixedSprintLongStride)))
  throw new TypeError('Sprint lead boost requires isolated canonical native Sprint');
 if(typeof nativeFixedSprintLongStride!=='boolean'||
    (nativeFixedSprintLongStride&&phase!=='sprint'))
  throw new TypeError('Long stride requires fixed native Sprint');
 if(!Object.hasOwn(PHASES,phase)||
    !['home','away'].includes(attackingSide)||
    verifiedNativeExclusiveShoeStart!==true||
    player?.team!==attackingSide||
    player?.id!==attackingSide+'-10'||
    ![player.vx,player.vy,player.x,player.y,
      ballVelocity?.x,ballVelocity?.y,ballVelocity?.z]
      .every(Number.isFinite))
  throw new TypeError('Real exclusive Rapier shoe and current canonical player required');
 const attrs=validateSoloCarryAttributes(playerAttributes);
 const config=calibrateSoloCarryTouch(PHASES[phase],attrs);
 const forward=attackingSide==='home'?1:-1;
 const playerForward=Math.max(0,forward*player.vx);
 const ballForward=forward*ballVelocity.x;
 // A sprinting footballer must accelerate before a long push. At each
 // native shoe START the ball target is bounded above the measured runner
 // speed, preventing first-tick rocket kicks.
 // Moderate has a longer controlled nudge than Control; a real Sprint
 // stride can let the ball run farther. Neither changes hit frequency:
 // no native shoe START means no selected action.
 // Optional isolated genuine-shoe A/B: a longer stride allows +0.35m/s
 // extra lead only AFTER a real exclusive Rapier shoe START.
 const aheadAllowance=phase==='sprint'?
  (nativeFixedSprintLongStride?1.40:1.05+nativeFixedSprintLeadExtraMps):
  phase==='moderate'?0.85:0.48;
 const controlledTarget=Math.min(config.targetSpeedMps,
  Math.max(0.8,playerForward+aheadAllowance));
 const requiredDelta=controlledTarget-ballForward;
 const impulseNs=requiredDelta<=0.12?null:Object.freeze({
  x:forward*Math.min(config.maxImpulseNs,0.43*requiredDelta),
  y:0,z:0
 });
 return Object.freeze({
  source:'authentic-native-two-shoe-calibrated-impulse',
  phase,attributes:attrs,
  nativeFixedSprintLongStride,nativeFixedSprintLeadExtraMps,
  nativeShoeContactVerified:true,
  playerForwardSpeedMps:playerForward,
  observedPreImpulseBallForwardMps:ballForward,
  calibratedTargetSpeedMps:config.targetSpeedMps,
  controlledTargetSpeedMps:controlledTarget,
  impulseNs,
  // One native-foot-start may be deliberately left to its true Rapier
  // solver collision without a second independently scripted impulse.
  originalFootEventOnly:impulseNs===null,
  noExtraShoeEvent:true,officialPossession:false,
  originalRapierBall:true
 });
}
