// #628 LAB-DRIBBLE-FIRST: read-only current-tick evidence. Never writes Rapier,
// changes player intent, awards possession or infers successful dribbling.
// Receives only the original closed Action LAB shoe/ball/current mover frames.
import {FOOT_CONTACT_VERSION} from './player-foot-contact.mjs';
import {BALL_RADIUS} from './core.mjs';
import {PLAYER_VERSION,PLAYER_MAX_SPEED_MPS,PLAYER_MIN_SEPARATION_M}
 from './player-movement.mjs';
export const ISOLATED_DRIBBLE_AUDIT_VERSION='me-628-d01-native-touches-audit-v1';
const freeze=Object.freeze;
const finite=Number.isFinite;
export function createIsolatedDribbleNativeAudit({side,variantIndex,solo=false}={}){
 if(!['home','away'].includes(side)||!Number.isSafeInteger(variantIndex)||
    variantIndex<0||variantIndex>29||typeof solo!=='boolean')
  throw new TypeError('Only D-01 paired HOME/AWAY variant may audit Rapier');
 const actor=side+'-10',opponent=solo?null:(side==='home'?'away':'home')+'-2';
 let tick=-1,priorBall=null,firstBall=null,sourceEnds=0,
  nativeStarts=0,recontacts=0,opposingStarts=0,actions=0;
 let lastEnd=-1,hasEnded=false,ballPath=0,minimumGap=Infinity,
  totalAttackerBallGapM=0,maxAttackerBallGapM=0,
  minPlayerGap=Infinity,maxActualPlayerSpeed=0,pressureTicks=0,
  nativeBodyBallTicks=0,nativeBodyPairsTicks=0,
  peakGroundClearanceM=0,airborneFramesAbove2Cm=0,peakBallSpeedMps=0,
  peakBallSpeedWitness=null;
 const touchTicks=[],actionTicks=[],actionMagnitudes=[],directions=[];
 let latest=null;
 function observe({physics,playerFrame,foot,action,physicalBodies=null}={}){
  if(physics?.tick!==tick+1||playerFrame?.version!==PLAYER_VERSION||
     playerFrame.tick!==physics.tick||foot?.version!==FOOT_CONTACT_VERSION||
     foot.tick!==physics.tick||!Array.isArray(playerFrame.players)||
     playerFrame.players.length!==22||!Array.isArray(foot.started)||
     !Array.isArray(foot.ended)||!Array.isArray(foot.active)||
     !physics.ball?.position||
     ![physics.ball.position.x,physics.ball.position.y,physics.ball.position.z]
      .every(finite)||foot.started.some(id=>id!==actor&&id!==opponent)||
     foot.ended.some(id=>id!==actor&&id!==opponent)||
     foot.active.some(id=>id!==actor&&id!==opponent)||
     (physicalBodies!==null&&physicalBodies.tick!==physics.tick))
   throw new TypeError('D-01 audit requires exact original Rapier source tick');
  const p=playerFrame.players.find(x=>x.id===actor),
   d=solo?null:playerFrame.players.find(x=>x.id===opponent);
  if(!p||(!solo&&!d))throw new TypeError('Genuine isolated player source required');
  for(let i=0;i<22;i++){
   const a=playerFrame.players[i];
   if(![a.x,a.y,a.vx,a.vy].every(finite))
    throw new TypeError('Canonical finite player source required');
   const speed=Math.hypot(a.vx,a.vy);
   maxActualPlayerSpeed=Math.max(maxActualPlayerSpeed,speed);
   if(speed>PLAYER_MAX_SPEED_MPS+1e-6)
    throw new TypeError('Original 7m/s speed guard was violated');
   for(let j=i+1;j<22;j++){
    const b=playerFrame.players[j];
    minPlayerGap=Math.min(minPlayerGap,Math.hypot(a.x-b.x,a.y-b.y));
   }
  }
  if(minPlayerGap<PLAYER_MIN_SEPARATION_M-1e-6)
   throw new TypeError('Original 0.98m hard separation was violated');
  const b=physics.ball.position;
  if(priorBall)ballPath+=Math.hypot(b.x-priorBall.x,b.y-priorBall.y);
  else firstBall=freeze({x:b.x,y:b.y});
  priorBall={x:b.x,y:b.y};
  const clearance=Math.max(0,b.z-BALL_RADIUS);
  peakGroundClearanceM=Math.max(peakGroundClearanceM,clearance);
  if(clearance>0.02)airborneFramesAbove2Cm++;
  const bv=physics.ball.velocity;
  const ballSpeedMps=Math.hypot(bv.x,bv.y);
  const attackerGap=Math.hypot(b.x-p.x,b.y-p.y);
  totalAttackerBallGapM+=attackerGap;
  maxAttackerBallGapM=Math.max(maxAttackerBallGapM,attackerGap);
  const distance=solo?null:Math.hypot(b.x-d.x,b.y-d.y);
  if(ballSpeedMps>peakBallSpeedMps){
   peakBallSpeedMps=ballSpeedMps;
   // A source timestamp and CO-OCCURRING real native contacts, not an
   // attribution of the resulting acceleration or a physics intervention.
   peakBallSpeedWitness=freeze({
    tick:physics.tick,source:'original-post-step-rapier-ball-velocity',
    ballSpeedMps,ballX:b.x,ballY:b.y,
    ballVx:bv.x,ballVy:bv.y,
    attackerGapM:attackerGap,defenderGapM:distance,
    authenticShoeStarts:freeze([...foot.started]),
    authenticShoeActive:freeze([...foot.active]),
    appliedRealCarryThisTick:action?.action==='carry'&&
     action.appliedByRapier===true,
    nativeLegBallContacts:physicalBodies?.lowerLegBallContacts.length??null,
    nativeTorsoPairs:physicalBodies?.nativeOpposingTorsoPairs.length??null,
    causalAttribution:false,readOnly:true
   });
  }
  if(!solo){
   minimumGap=Math.min(minimumGap,distance);
   if(distance<3)pressureTicks++;
  }
  if(physicalBodies?.lowerLegBallContacts.length)nativeBodyBallTicks++;
  if(physicalBodies?.nativeOpposingTorsoPairs.length)nativeBodyPairsTicks++;
  if(foot.ended.includes(actor)){sourceEnds++;lastEnd=physics.tick;hasEnded=true;}
  if(foot.started.includes(opponent))opposingStarts++;
  if(foot.started.includes(actor)){
   nativeStarts++;touchTicks.push(physics.tick);
   if(hasEnded&&lastEnd<physics.tick)recontacts++;
  }
  if(action){
   if(action.tick!==physics.tick||action.playerId!==actor||
      action.action!=='carry'||action.appliedByRapier!==true||
      action.actualPhysicsImpulseApplied!==true||
      !foot.started.includes(actor)||foot.started.length!==1||
      foot.active.length!==1||foot.active[0]!==actor||
      action.decisionContext?.isolatedDribbleTouch?.tick!==physics.tick)
    throw new TypeError('Only actual exclusive native D-01 carry impulses qualify');
   actions++;actionTicks.push(physics.tick);
   actionMagnitudes.push(Math.hypot(action.impulseNs.x,action.impulseNs.y));
   directions.push(Math.atan2(action.impulseNs.y,
    (side==='home'?1:-1)*action.impulseNs.x));
  }
  tick=physics.tick;
  latest=freeze({version:ISOLATED_DRIBBLE_AUDIT_VERSION,tick,
   side,variantIndex,soloCarry:solo,originalRapierShoeSource:true,oneWorldActionSource:true,
   attackerShoeStarts:nativeStarts,attackerShoeEnds:sourceEnds,
   independentRecontacts:recontacts,defenderShoeStarts:opposingStarts,
   appliedCarryActions:actions,actionTicks:freeze([...actionTicks]),
   nativeAttackerStartTicks:freeze([...touchTicks]),
   realImpulseMagnitudesNs:freeze([...actionMagnitudes]),
   actualImpulseDirectionRad:freeze([...directions]),
   minimumRealDefenderBallGapM:solo?null:minimumGap,
   averageRealAttackerBallGapM:totalAttackerBallGapM/(tick+2),
   maximumRealAttackerBallGapM:maxAttackerBallGapM,
   measuredPressureTicks:solo?null:pressureTicks,ballPath2DM:ballPath,
   peakGroundClearanceM,airborneFramesAbove2Cm,peakBallSpeedMps,
   peakBallSpeedWitness,
   meanAppliedTouchIntervalTicks:actionTicks.length<2?null:
    (actionTicks[actionTicks.length-1]-actionTicks[0])/(actionTicks.length-1),
   ballForwardDistanceM:(b.x-firstBall.x)*(side==='home'?1:-1),
   ballLateralDisplacementM:b.y-firstBall.y,
   nativeBodyBallContactTicks:nativeBodyBallTicks,
   nativeOpposingTorsoContactTicks:nativeBodyPairsTicks,
   minimumCanonicalSeparationM:minPlayerGap,
   maximumObservedCanonicalPlayerSpeedMps:maxActualPlayerSpeed,
   physicalRecontactAfterReleaseObserved:recontacts>0,
   multiTouchCarryObserved:actions>=2&&recontacts>0,
   dribbleCompleted:false,ballProtectionProven:false,
   officialPossession:false,officialMatchAction:false,
   officialMatchResult:null,readOnly:true});
  return latest;
 }
 return freeze({observe,snapshot:()=>latest});
}
