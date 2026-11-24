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
