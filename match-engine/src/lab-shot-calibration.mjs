// SHOT-01 current DEV shot candidate shared by every gameplay Action LAB.
// Preserve the real selector's XY goal lane. Calculate a single bounded
// impulse from current ball motion; no steering, position/velocity setters,
// extra impulse, or goal inference. The engine's original gravity/solver
// and B05 read-only full-ball crossing decide what actually happens.
export const LAB_SHOT_CALIBRATION_VERSION='lab-shot-ballistic-candidate-v1';
export function calculateCurrentLabShotCalibration({target,position,velocity,massKg,ballRadiusM,originalImpulseNs}={}){
 if(!target||!position||!velocity||!originalImpulseNs||
    ![target.targetX,target.targetY,position.x,position.y,position.z,velocity.x,velocity.y,velocity.z,
      massKg,ballRadiusM,originalImpulseNs.x,originalImpulseNs.y,originalImpulseNs.z].every(Number.isFinite)||
    massKg<=0||ballRadiusM<=0)throw new TypeError('Shot calibration requires measured original motion and goal lane');
 const dx=target.targetX-position.x,dy=target.targetY-position.y;
 const distanceM=Math.hypot(dx,dy);
 if(distanceM<0.25)return null;
 const dir=Math.sign(dx),fullDx=dx+dir*ballRadiusM;
 const fullDistance=Math.hypot(fullDx,dy);
 const horizontalSpeedMps=Math.max(20,Math.min(28,18+0.30*distanceM));
 const timeS=fullDistance/horizontalSpeedMps;
 const targetCentreZM=0.90;
 const targetV={x:fullDx/fullDistance*horizontalSpeedMps,y:dy/fullDistance*horizontalSpeedMps,
  z:(targetCentreZM-position.z)/timeS+0.5*9.81*timeS};
 const impulse={x:massKg*(targetV.x-velocity.x),y:massKg*(targetV.y-velocity.y),z:massKg*(targetV.z-velocity.z)};
 const norm=Math.hypot(...Object.values(impulse)),scale=norm>13?13/norm:1;
 return Object.freeze({source:LAB_SHOT_CALIBRATION_VERSION,distanceM,targetY:target.targetY,targetCentreZM,
  plannedHorizontalSpeedMps:horizontalSpeedMps,plannedFlightTimeS:timeS,
  originalImpulseNs,impulseNs:Object.freeze({x:impulse.x*scale,y:impulse.y*scale,z:impulse.z*scale}),
  officialMatchAction:false});
}
