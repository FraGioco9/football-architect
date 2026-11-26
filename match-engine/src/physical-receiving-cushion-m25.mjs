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

// CROSS-02c: oriented low first touch, NOT a stop or automatic possession.
// Direction is derived from live ball / canonical receiver / original
// shoe pose. Prefer goalward space while separating from both player and
// shoe. The first native contact is the executor's sole authority.
export const M25_CROSS_CUSHION_MAX_IMPULSE_NS=6.5;
export const M25_CROSS_CONTROL_SPEED_MPS=1.25;
const unitXY=(x,y)=>{
 const n=Math.hypot(x,y);
 return n>1e-6?{x:x/n,y:y/n}:null;
};
export const CURRENT_LAB_DYNAMICS_VERSION='lab-current-oriented-delivery-v1';
export function calculateOrientedReceivingCushion({
 ballVelocity,playerVelocity,ballCentreZ,ballRadiusM,realBallPlayerGapM,ballMassKg,
 ballPosition,receiverPosition,shoePosition,attackingSide,
 deliveryKind='cross',opponents=[]
}={}){
 if(!ballVelocity||!playerVelocity||!ballPosition||!receiverPosition||!shoePosition||
    !['home','away'].includes(attackingSide)||!['pass','cross'].includes(deliveryKind)||
    !Array.isArray(opponents)||opponents.some(p=>!p||![p.x,p.y].every(finite))||
    ![ballVelocity.x,ballVelocity.y,ballVelocity.z,playerVelocity.x,playerVelocity.y,
      ballCentreZ,ballRadiusM,realBallPlayerGapM,ballMassKg,
      ballPosition.x,ballPosition.y,receiverPosition.x,receiverPosition.y,
      shoePosition.x,shoePosition.y].every(finite)||
    ballRadiusM<0.05||ballRadiusM>0.2||ballMassKg<=0||realBallPlayerGapM<0)
  throw new TypeError('Cross control requires measured ball, receiver, shoe and mass');
 const relative={x:ballVelocity.x-playerVelocity.x,y:ballVelocity.y-playerVelocity.y,z:ballVelocity.z};
 const speed=Math.hypot(relative.x,relative.y,relative.z);
 const horizontal=Math.hypot(relative.x,relative.y);
 if(speed<=(deliveryKind==='cross'?2:0.4)||speed>18||realBallPlayerGapM>0.85||
    ballCentreZ<ballRadiusM-0.015||ballCentreZ>ballRadiusM+0.4)return null;
 const outward=unitXY(ballPosition.x-receiverPosition.x,ballPosition.y-receiverPosition.y);
 const shoeOut=unitXY(ballPosition.x-shoePosition.x,ballPosition.y-shoePosition.y);
 if(!outward||!shoeOut)return null;
 const attack=attackingSide==='home'?1:-1;
 const targetSpeed=deliveryKind==='cross'?M25_CROSS_CONTROL_SPEED_MPS:
  Math.min(M25_CROSS_CONTROL_SPEED_MPS,horizontal*0.8);
 if(targetSpeed<0.20)return null;
 const nearestOpponent=opponents.length?Math.min(...opponents.map(p=>
  Math.hypot(p.x-receiverPosition.x,p.y-receiverPosition.y))):null;
 // Small fixed set of mirrored directional candidates. No random
 // direction, aim towards goal only if it does not go through the foot
 // or player's centre. With no safe forward route, allow a side touch.
 let best=null;
 for(const angle of [0,15,-15,30,-30,45,-45,60,-60,75,-75,90,-90,105,-105,120,-120,135,-135,150,-150,165,-165,180]){
  const a=angle*Math.PI/180;
  const d={x:attack*Math.cos(a),y:Math.sin(a)};
  const bodyProjection=d.x*outward.x+d.y*outward.y;
  const shoeProjection=d.x*shoeOut.x+d.y*shoeOut.y;
  if(bodyProjection<0.15||shoeProjection<0.15)continue;
  const tx=ballPosition.x+d.x*1.5,ty=ballPosition.y+d.y*1.5;
  if(Math.abs(tx)>52.5-ballRadiusM||Math.abs(ty)>34-ballRadiusM)continue;
  const laneGap=opponents.length?Math.min(...opponents.map(p=>{
   const along=Math.max(0,Math.min(1.5,(p.x-ballPosition.x)*d.x+(p.y-ballPosition.y)*d.y));
   return Math.hypot(p.x-ballPosition.x-along*d.x,p.y-ballPosition.y-along*d.y);
  })):Infinity;
  if(laneGap<0.45)continue;
  const score=attack*d.x+0.75*bodyProjection+0.45*shoeProjection+
   (nearestOpponent!==null&&nearestOpponent<3?Math.min(laneGap,3)*0.7:0);
  if(!best||score>best.score)best={direction:d,bodyProjection,shoeProjection,score};
 }
 if(!best)return null;
 const targetVelocity=Object.freeze({x:playerVelocity.x+best.direction.x*targetSpeed,
  y:playerVelocity.y+best.direction.y*targetSpeed,z:0});
 const desired={x:ballMassKg*(targetVelocity.x-ballVelocity.x),
  y:ballMassKg*(targetVelocity.y-ballVelocity.y),z:ballMassKg*(targetVelocity.z-ballVelocity.z)};
 const magnitude=Math.hypot(desired.x,desired.y,desired.z);
 const scale=Math.min(1,M25_CROSS_CUSHION_MAX_IMPULSE_NS/magnitude);
 const impulseNs=Object.freeze({x:desired.x*scale,y:desired.y*scale,z:desired.z*scale});
 return Object.freeze({impulseNs,actualRelativeSpeedMps:speed,
  targetVelocity,controlDirection:Object.freeze(best.direction),targetSpeedMps:targetSpeed,deliveryKind,
  actualBallHorizontalSpeedMps:Math.hypot(ballVelocity.x,ballVelocity.y),
  measuredNearestOpponentM:nearestOpponent,noActiveOpponents:opponents.length===0,
  underImmediatePressure:nearestOpponent!==null&&nearestOpponent<3,
  bodyProjection:best.bodyProjection,shoeProjection:best.shoeProjection,
  measuredGapM:realBallPlayerGapM,maximumImpulseNs:M25_CROSS_CUSHION_MAX_IMPULSE_NS,
  controlKind:'goalward-outward-first-touch',researchOnly:true,officialPossession:false});
}

// Compatibility name for original cross evidence, not a second model.
export const calculateLowCrossReceivingCushion=calculateOrientedReceivingCushion;

// Align residual spin towards rolling in the chosen outgoing direction
// instead of killing all rotation. A bounded impulse on the same contact,
// no direct angular velocity assignment or later ground correction.
export const M25_CROSS_MAX_ANGULAR_IMPULSE_NMS=0.15;
export function calculateLowCrossSpinCushion({angularVelocity,principalInertia,ballRadiusM,linearImpulseNs,outgoingVelocity}={}){
 if(!angularVelocity||!principalInertia||!outgoingVelocity||
    ![angularVelocity.x,angularVelocity.y,angularVelocity.z,
      principalInertia.x,principalInertia.y,principalInertia.z,ballRadiusM,linearImpulseNs,
      outgoingVelocity.x,outgoingVelocity.y].every(finite)||
    principalInertia.x<=0||Math.abs(principalInertia.x-principalInertia.y)>1e-5||
    Math.abs(principalInertia.x-principalInertia.z)>1e-5||
    ballRadiusM<0.05||ballRadiusM>0.2||linearImpulseNs<0)
  throw new TypeError('Cross spin control requires observed spherical inertia and outgoing motion');
 const targetAngularVelocity=Object.freeze({x:-outgoingVelocity.y/ballRadiusM,
  y:outgoingVelocity.x/ballRadiusM,z:0});
 const delta={x:targetAngularVelocity.x-angularVelocity.x,
  y:targetAngularVelocity.y-angularVelocity.y,z:targetAngularVelocity.z-angularVelocity.z};
 const n=Math.hypot(delta.x,delta.y,delta.z);
 if(n<=1e-6||linearImpulseNs===0)return null;
 const magnitude=Math.min(M25_CROSS_MAX_ANGULAR_IMPULSE_NMS,
  ballRadiusM*linearImpulseNs,principalInertia.x*n);
 return Object.freeze({
  torqueImpulseNms:Object.freeze({x:delta.x/n*magnitude,y:delta.y/n*magnitude,z:delta.z/n*magnitude}),
  targetAngularVelocity,maximumAngularImpulseNms:M25_CROSS_MAX_ANGULAR_IMPULSE_NMS,
  measuredAngularSpeedRadS:Math.hypot(...Object.values(angularVelocity)),readOnlyCandidate:true
 });
}
