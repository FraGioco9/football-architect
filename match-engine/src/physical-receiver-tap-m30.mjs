// #628 M30: bounded REAL ball tap after genuine second original Rapier shoe START.
// Pure candidate; the closed executor is the only authority allowed to apply it.
// This may separate ball and shoe, but cannot award dribble or possession.
export const M30_TAP_MAX_IMPULSE_NS=1.35;
export const M30_BALL_MASS_KG=0.43;
const finite=Number.isFinite;
const freeze=Object.freeze;
export function calculatePhysicalReceiverReleaseTap({
 choice,earlierCushion,nativeStarts,nativeActive,
 ballPosition,ballVelocity,receiver,opponents,ballRadiusM
}={}){
 if(!choice||!['home-9','away-9'].includes(choice.actorId)||
    choice.team!==choice.actorId.split('-')[0]||
    choice.decision!=='defer-clearance-to-keep-ball-near'||
    choice.physicalImpulseAllowed!==false||
    choice.genuineNativeSecondShoeStart!==true||
    choice.matchAuthority!==false||choice.officialPossession!==false||
    !earlierCushion||earlierCushion.actorId!==choice.actorId||
    earlierCushion.tick!==choice.previousRealCushionTick||
    earlierCushion.nativeExclusiveShoeStart!==true||
    earlierCushion.actualPhysicsImpulseApplied!==true||
    !Array.isArray(nativeStarts)||nativeStarts.length!==1||
    nativeStarts[0]!==choice.actorId||
    !Array.isArray(nativeActive)||nativeActive.length!==1||
    nativeActive[0]!==choice.actorId||
    !receiver||receiver.id!==choice.actorId||receiver.team!==choice.team||
    !ballPosition||!ballVelocity||
    ![receiver.x,receiver.y,receiver.vx,receiver.vy,receiver.facingRad,
      ballPosition.x,ballPosition.y,ballPosition.z,
      ballVelocity.x,ballVelocity.y,ballVelocity.z,ballRadiusM].every(finite)||
    ballRadiusM<0.05||ballRadiusM>0.2||
    !Array.isArray(opponents)||opponents.length!==11||
    new Set(opponents.map(x=>x.id)).size!==11||
    opponents.some(x=>x.team===choice.team||![x.x,x.y].every(finite)))
  throw new TypeError('M30 requires M25 → M27 and exclusive original second shoe START');
 const nearest=Math.min(...opponents.map(x=>Math.hypot(x.x-receiver.x,x.y-receiver.y)));
 const ballGap=Math.hypot(ballPosition.x-receiver.x,ballPosition.y-receiver.y);
 const relative=Math.hypot(ballVelocity.x-receiver.vx,ballVelocity.y-receiver.vy);
 if(nearest<=2.5||ballGap>0.7||relative>3.5||
    ballPosition.z<ballRadiusM-0.015||
    ballPosition.z>ballRadiusM+0.18)
  return null;
 // Accelerate along the CURRENT real receiver's motion if moving; otherwise
 // use the CURRENT real ball movement. No preselected target/teleport.
 const speed=Math.hypot(receiver.vx,receiver.vy);
 const ballSpeed=Math.hypot(ballVelocity.x,ballVelocity.y);
 const ux=speed>0.8?receiver.vx/speed:
  ballSpeed>0.8?ballVelocity.x/ballSpeed:Math.cos(receiver.facingRad);
 const uy=speed>0.8?receiver.vy/speed:
  ballSpeed>0.8?ballVelocity.y/ballSpeed:Math.sin(receiver.facingRad);
 const impulse=M30_TAP_MAX_IMPULSE_NS;
 return freeze({
  impulseNs:freeze({x:ux*impulse,y:uy*impulse,z:0}),
  maximumImpulseNs:M30_TAP_MAX_IMPULSE_NS,
  realBallReceiverGapM:ballGap,
  realBallReceiverRelativeSpeedMps:relative,
  measuredNearestOpponentM:nearest,
  measuredReceiverSpeedMps:speed,
  originalRapierBallBody:true,physicalCandidate:true,
  verifiedControl:false,officialPossession:false,matchAuthority:false
 });
}
