// #628 M25: candidate first-touch damping ONLY, not a contact authenticator.
export const M25_CUSHION_MAX_IMPULSE_NS=2.7;
export const M25_CUSHION_RELATIVE_FRACTION=0.57;
const finite=Number.isFinite;
export function calculateRealReceivingCushion({
 ballVelocity,playerVelocity,ballCentreZ,ballRadiusM,
 realBallPlayerGapM,nearestOpponentM
}={}){
 if(!ballVelocity||!playerVelocity||
    ![ballVelocity.x,ballVelocity.y,ballVelocity.z,
      playerVelocity.x,playerVelocity.y,
      ballCentreZ,ballRadiusM,realBallPlayerGapM,nearestOpponentM]
      .every(finite)||
    ballRadiusM<0.05||ballRadiusM>0.2||
    realBallPlayerGapM<0||realBallPlayerGapM>110||
    nearestOpponentM<0||nearestOpponentM>200)
  throw new TypeError('M25 requires true original ball and player motion');
 const speed=Math.hypot(ballVelocity.x,ballVelocity.y);
 const rx=ballVelocity.x-playerVelocity.x;
 const ry=ballVelocity.y-playerVelocity.y;
 const relative=Math.hypot(rx,ry);
 if(speed<0.4||speed>14||relative<0.4||
    realBallPlayerGapM>0.85||
    ballCentreZ<ballRadiusM-0.015||
    ballCentreZ>ballRadiusM+0.4)return null;
 const magnitude=Math.min(0.43*M25_CUSHION_RELATIVE_FRACTION*relative,
  M25_CUSHION_MAX_IMPULSE_NS);
 return Object.freeze({
  impulseNs:Object.freeze({x:-rx/relative*magnitude,y:-ry/relative*magnitude,z:0}),
  actualBallHorizontalSpeedMps:speed,actualRelativeSpeedMps:relative,
  measuredGapM:realBallPlayerGapM,
  measuredNearestOpponentM:nearestOpponentM,
  underImmediatePressure:nearestOpponentM<3,
  maximumImpulseNs:M25_CUSHION_MAX_IMPULSE_NS,
  researchOnly:true,officialPossession:false
 });
}

 // CROSS-02: M25 relative-motion counter-impulse, including vertical
 // rebound. Separate provisional cap for measured 12–14.4m/s low crosses.
 export const M25_CROSS_CUSHION_MAX_IMPULSE_NS=6.5;
 export function calculateLowCrossReceivingCushion({
  ballVelocity,playerVelocity,ballCentreZ,ballRadiusM,realBallPlayerGapM,ballMassKg
 }={}){
  if(!ballVelocity||!playerVelocity||
     ![ballVelocity.x,ballVelocity.y,ballVelocity.z,playerVelocity.x,playerVelocity.y,
       ballCentreZ,ballRadiusM,realBallPlayerGapM,ballMassKg].every(finite)||
     ballRadiusM<0.05||ballRadiusM>0.2||ballMassKg<=0||realBallPlayerGapM<0)
   throw new TypeError('Cross cushion requires measured original motion and mass');
  const relative={x:ballVelocity.x-playerVelocity.x,y:ballVelocity.y-playerVelocity.y,z:ballVelocity.z};
  const speed=Math.hypot(relative.x,relative.y,relative.z);
  if(speed<=0.35||speed>18||realBallPlayerGapM>0.85||
     ballCentreZ<ballRadiusM-0.015||ballCentreZ>ballRadiusM+0.4)return null;
  const residualTargetMps=0.25;
  const magnitude=Math.min(M25_CROSS_CUSHION_MAX_IMPULSE_NS,
   ballMassKg*(speed-residualTargetMps));
  return Object.freeze({
   impulseNs:Object.freeze({x:-relative.x/speed*magnitude,
    y:-relative.y/speed*magnitude,z:-relative.z/speed*magnitude}),
   actualRelativeSpeedMps:speed,residualTargetMps,
   measuredGapM:realBallPlayerGapM,
   maximumImpulseNs:M25_CROSS_CUSHION_MAX_IMPULSE_NS,
   researchOnly:true,officialPossession:false
  });
 }

 // CROSS-02b: a low receiving touch can dissipate residual spin as
 // well as translation. This spherical-ball torque candidate is bounded,
 // opposes only measured angular velocity, and cannot reverse spin.
 export const M25_CROSS_MAX_ANGULAR_IMPULSE_NMS=0.15;
 export function calculateLowCrossSpinCushion({angularVelocity,principalInertia,ballRadiusM,linearImpulseNs}={}){
  if(!angularVelocity||!principalInertia||
     ![angularVelocity.x,angularVelocity.y,angularVelocity.z,
       principalInertia.x,principalInertia.y,principalInertia.z,ballRadiusM,linearImpulseNs].every(finite)||
     principalInertia.x<=0||Math.abs(principalInertia.x-principalInertia.y)>1e-5||
     Math.abs(principalInertia.x-principalInertia.z)>1e-5||
     ballRadiusM<0.05||ballRadiusM>0.2||linearImpulseNs<0)
   throw new TypeError('Cross spin cushion requires observed spherical ball inertia and contact impulse');
  const speed=Math.hypot(angularVelocity.x,angularVelocity.y,angularVelocity.z);
  const residualTargetRadS=1.5;
  if(speed<=residualTargetRadS)return null;
  const magnitude=Math.min(M25_CROSS_MAX_ANGULAR_IMPULSE_NMS,
   ballRadiusM*linearImpulseNs,principalInertia.x*(speed-residualTargetRadS));
  if(magnitude<=0)return null;
  return Object.freeze({
   torqueImpulseNms:Object.freeze({x:-angularVelocity.x/speed*magnitude,
    y:-angularVelocity.y/speed*magnitude,z:-angularVelocity.z/speed*magnitude}),
   residualTargetRadS,maximumAngularImpulseNms:M25_CROSS_MAX_ANGULAR_IMPULSE_NMS,
   measuredAngularSpeedRadS:speed,readOnlyCandidate:true
  });
 }
