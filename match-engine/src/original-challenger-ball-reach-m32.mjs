// #628 M32: source-gated original opposing midfielder's ball pursuit.
// Returns a current physical-ball target only. The canonical 60Hz mover
// alone decides displacement, orientation, 0.98m spacing and real shoe reach.
const finite=Number.isFinite;
export const M32_CHALLENGE_START_BALL_RANGE_M=10;
export const M32_CHALLENGE_HOLD_BALL_RANGE_M=12;
export function chooseOriginalOpponentBallReachM32({
 challenger,ball,actualReceiverTap,actualPass,receiverTeam,active=false
}={}){
 if(!['home','away'].includes(receiverTeam)||
   !challenger||challenger.id!==(receiverTeam==='home'?'away-7':'home-7')||
   challenger.team===receiverTeam||challenger.role!=='midfielder'||
   !ball||![ball.x,ball.y,challenger.x,challenger.y].every(finite)||
   typeof active!=='boolean')
  throw new TypeError('M32 requires original live opponent #7 and ball XY');
 if(actualReceiverTap===null)return null;
 if(!actualReceiverTap||
    actualReceiverTap.actorId!==receiverTeam+'-9'||
    actualReceiverTap.team!==receiverTeam||
    !Number.isSafeInteger(actualReceiverTap.tick)||actualReceiverTap.tick<1||
    actualReceiverTap.originalDecisionTick!==actualReceiverTap.tick||
    actualReceiverTap.originalRapierBallBody!==true||
    actualReceiverTap.nativeExclusiveShoeStart!==true||
    actualReceiverTap.actualPhysicsImpulseApplied!==true||
    actualReceiverTap.originalClearanceSuppressed!==true||
    actualReceiverTap.matchAuthority!==false||
    actualReceiverTap.officialPossession!==false||
    !finite(actualReceiverTap.impulseMagnitudeNs)||
    actualReceiverTap.impulseMagnitudeNs<=0||
    actualReceiverTap.impulseMagnitudeNs>1.35+1e-8||
    actualPass?.playerId!==receiverTeam+'-10'||
    actualPass.action!=='pass'||actualPass.team!==receiverTeam||
    actualPass.passTarget?.recipientId!==receiverTeam+'-9'||
    actualPass.appliedByRapier!==true||
    actualPass.actualPhysicsImpulseApplied!==true||
    !Number.isSafeInteger(actualPass.tick)||actualPass.tick<1||
    actualPass.tick>=actualReceiverTap.tick)
  throw new TypeError('M32 cannot chase without original physical PASS→M30 tap');
 const gap=Math.hypot(challenger.x-ball.x,challenger.y-ball.y);
 if(gap>(active?M32_CHALLENGE_HOLD_BALL_RANGE_M:
    M32_CHALLENGE_START_BALL_RANGE_M))return null;
 return Object.freeze({x:ball.x,y:ball.y,observedBallGapM:gap,
  sourceTapTick:actualReceiverTap.tick,playerId:challenger.id,
  original22PlayerIntent:true,officialInterception:false,
  verifiedContact:false,officialPossession:false});
}
