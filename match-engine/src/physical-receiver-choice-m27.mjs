// #628 M27 — bounded REAL second-touch decision in closed CONTROL research.
// Pure tactical decision about an existing genuine shoe START + existing
// clearance candidate. This NEVER authenticates physics or awards possession.
export const M27_IMMEDIATE_DEFENDER_M=2.5;
export const M27_RETAIN_MAX_BALL_GAP_M=1;
export const M27_RETAIN_MAX_RELATIVE_SPEED_MPS=8;
const finite=Number.isFinite;
const freeze=Object.freeze;
export function choosePhysicalReceiverSecondTouch({
 tick,actorId,originalChoice,realNativeStarts,realNativeActive,
 ballPosition,ballVelocity,receiver,realOpponents,
 verifiedEarlierCushion
}={}){
 if(!Number.isSafeInteger(tick)||tick<=0||
    !['home-9','away-9'].includes(actorId)||
    !originalChoice||originalChoice.action!=='clearance'||
    originalChoice.playerId!==actorId||
    originalChoice.team!==actorId.split('-')[0]||
    !Array.isArray(realNativeStarts)||!Array.isArray(realNativeActive)||
    realNativeStarts.length!==1||realNativeActive.length!==1||
    realNativeStarts[0]!==actorId||realNativeActive[0]!==actorId||
    !verifiedEarlierCushion||
    verifiedEarlierCushion.actorId!==actorId||
    verifiedEarlierCushion.nativeExclusiveShoeStart!==true||
    verifiedEarlierCushion.actualPhysicsImpulseApplied!==true||
    !Number.isSafeInteger(verifiedEarlierCushion.tick)||
    verifiedEarlierCushion.tick>=tick||
    !ballPosition||!ballVelocity||!receiver||
    ![ballPosition.x,ballPosition.y,ballPosition.z,
      ballVelocity.x,ballVelocity.y,ballVelocity.z,
      receiver.x,receiver.y,receiver.vx,receiver.vy].every(finite)||
    receiver.id!==actorId||
    receiver.team!==actorId.split('-')[0]||
    !Array.isArray(realOpponents)||realOpponents.length!==11||
    new Set(realOpponents.map(x=>x.id)).size!==11||
    realOpponents.some(x=>x.team===receiver.team||
      ![x.x,x.y].every(finite)))
   throw new TypeError('M27 requires authentic same-tick second clearance shoe START');
 const nearestM=Math.min(...realOpponents.map(p=>
  Math.hypot(p.x-receiver.x,p.y-receiver.y)));
 const ballGapM=Math.hypot(ballPosition.x-receiver.x,
  ballPosition.y-receiver.y);
 const relativeSpeedMps=Math.hypot(ballVelocity.x-receiver.vx,
  ballVelocity.y-receiver.vy);
 const underImmediatePressure=nearestM<=M27_IMMEDIATE_DEFENDER_M;
 const ballInReach=ballGapM<=M27_RETAIN_MAX_BALL_GAP_M;
 const relativeManageable=relativeSpeedMps<=M27_RETAIN_MAX_RELATIVE_SPEED_MPS;
 const choice=underImmediatePressure||!ballInReach||!relativeManageable?
  'release-original-clearance':'defer-clearance-to-keep-ball-near';
 return freeze({
  version:'m27-real-native-second-touch-choice-v1',
  tick,actorId,team:receiver.team,
  previousRealCushionTick:verifiedEarlierCushion.tick,
  genuineNativeSecondShoeStart:true,
  originalUniformAction:'clearance',
  decision:choice,
  nearestRealDefenderM:Math.round(nearestM*1e4)/1e4,
  actualBallReceiverGapM:Math.round(ballGapM*1e4)/1e4,
  actualBallReceiverRelativeSpeedMps:Math.round(relativeSpeedMps*1e4)/1e4,
  underImmediatePressure,ballInReach,relativeManageable,
  physicalImpulseAllowed:choice==='release-original-clearance',
  retentionObservedNotProven:true,
  verifiedReception:false,verifiedControl:false,
  officialPossession:false,matchAuthority:false
 });
}
