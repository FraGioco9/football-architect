// ME-PB-26/32: observed-flight autonomous defender lane closure in opt-in DEV.
// The player starts in the ORIGINAL formation. NO initial pose rewrite,
// teleport, predicted future physics fact or fabricated shoe contact.
export const LOCAL_LANE_CLOSURE_VERSION='me-pb-26-observed-lane-closure-v1';
export const LOCAL_LANE_CLOSURE_CANDIDATES=Object.freeze([
 'away-9','away-10','away-11'
]);
export const LOCAL_LANE_CLOSURE_REACTION_MIN_SPEED_MPS=2;
export const LOCAL_LANE_CLOSURE_LOOKAHEAD_S=1.35;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const canonical=players=>Array.isArray(players)&&players.length===22&&
 players.every((p,i)=>p&&p.id===
  (i<11?'home-'+(i+1):'away-'+(i-10))&&
  ['x','y'].every(k=>finite(p[k]))&&
  p.team===(i<11?'home':'away'));
const distance=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
// Called with measured Rapier ball velocity, *after* the actual first pass,
// never with an intent, target prediction or a user-supplied controller claim.
export function chooseObservedLaneClosure({
 players,ballPosition,ballVelocity,passStage='pass',passSequence=
   passStage==='return-pass'?2:1
}){
 if(!canonical(players)||!ballPosition||!ballVelocity||
    !['x','y'].every(k=>finite(ballPosition[k])&&finite(ballVelocity[k])))
  throw new TypeError('Canonical 22-player observed ball position and velocity required');
 if(!['pass','return-pass'].includes(passStage)||
    !Number.isSafeInteger(passSequence)||passSequence<1||
    passSequence>LOCAL_LANE_PASS_MAX_EVENTS||
    passStage!==(passSequence%2===1?'pass':'return-pass'))
  throw new TypeError('Canonical alternating physical pass stage required');
 // Return passes can move diagonally or temporarily forward because the
 // receiving Home #7 has itself moved in the REAL 22-player exchange. Pick
 // direction from observed Rapier speed, never from a scripted label.
 const directionX=passSequence>1?
  (ballVelocity.x<0?-1:1):1;
 if(ballVelocity.x*directionX<LOCAL_LANE_CLOSURE_REACTION_MIN_SPEED_MPS)return null;
 const target=players.find(p=>p.id===
  (passStage==='return-pass'?'home-7':'home-10'));
 // The shorter lookahead accounts for rapid ground-ball friction and the
 // actual defender's 0.78s acceleration. Far-future extrapolation aimed
 // past the real crossing point, leaving 2.5m between ball and shoe.
 // A candidate can only defend a real ball moving into the observed
 // recipient's half-space. Don't chase impossible/lost or backward balls.
 if(!target||(passSequence===1&&target.x<=ballPosition.x+3))return null;
 // ME-PB-32: the second pass has a NEW actual physical trajectory and
 // the recipient has moved. Use a short measured-flight lane intent
 // without insisting on a stale fixed-direction recipient location.
 const horizon=passSequence>1?0.6:LOCAL_LANE_CLOSURE_LOOKAHEAD_S;
 const predicted={
  x:passSequence>1?
   clamp(ballPosition.x+ballVelocity.x*horizon,-51,51):
   clamp(ballPosition.x+ballVelocity.x*horizon,
    ballPosition.x+2,target.x-0.8),
  y:clamp(ballPosition.y+ballVelocity.y*horizon,-33,33)
 };
 const considered=LOCAL_LANE_CLOSURE_CANDIDATES.map(id=>{
  const player=players.find(p=>p.id===id);
  const reachM=distance(player,predicted);
  return Object.freeze({playerId:id,distanceToLaneWaypointM:reachM});
 }).sort((a,b)=>a.distanceToLaneWaypointM-b.distanceToLaneWaypointM||
  a.playerId.localeCompare(b.playerId,'en'));
 const chosen=considered[0];
 if(!chosen||chosen.distanceToLaneWaypointM>25)return null;
 return Object.freeze({
  version:LOCAL_LANE_CLOSURE_VERSION,
  defenderId:chosen.playerId,directionX,passStage,passSequence,
  waypoint:Object.freeze(predicted),
  observedBallVelocityMps:Object.freeze({
   x:ballVelocity.x,y:ballVelocity.y
  }),
  measuredAtBallPosition:Object.freeze({
   x:ballPosition.x,y:ballPosition.y
  }),
  selection:Object.freeze(considered),
  observedFlightOnly:true,
  interceptionProven:false,officialPossession:false
 });
}

// ME-PB-27: release only after the previous completed real Rapier shoe START.
// Never infer interception, possession or contact from observed proximity.
export const LOCAL_LANE_RELEASE_VERSION='me-pb-27-physical-release-v1';
const CANONICAL_FOOT_CONTACT_VERSION='me-pb-03-oriented-foot-contact-v1';
export function releaseObservedLaneClosure({plan,contactFrame,previousTick}){
 if(plan===null)return null;
 if(!plan||plan.version!==LOCAL_LANE_CLOSURE_VERSION||
   !Number.isSafeInteger(plan.activatedAtTick)||plan.activatedAtTick<1||
   !LOCAL_LANE_CLOSURE_CANDIDATES.includes(plan.defenderId)||
   !['closing','released-after-physical-contact',
     'released-after-observed-flight',
     'released-after-new-physical-pass'].includes(plan.phase))
   throw new TypeError('Canonical observed lane assignment required');
 if(contactFrame===null||contactFrame===undefined)return plan;
 if(!Number.isSafeInteger(previousTick)||previousTick<0||
    contactFrame.version!==CANONICAL_FOOT_CONTACT_VERSION||
    contactFrame.tick!==previousTick||!Array.isArray(contactFrame.started)||
    new Set(contactFrame.started).size!==contactFrame.started.length||
    contactFrame.started.some(id=>typeof id!=='string'||
      !/^(?:home|away)-(?:[1-9]|10|11)$/.test(id)))
   throw new TypeError('Synchronized canonical previous Rapier foot START required');
 if(plan.phase!=='closing'||previousTick<plan.activatedAtTick||
    !contactFrame.started.includes(plan.defenderId))return plan;
 return Object.freeze({...plan,
  phase:'released-after-physical-contact',
  releaseVersion:LOCAL_LANE_RELEASE_VERSION,
  observedRapierShoeStartTick:previousTick,
  releasedAtMovementTick:previousTick+1,
  interceptionProven:false,officialPossession:false
 });
}

// ME-PB-29: the SAME defender can adjust its aim only when a fresh,
// completed Rapier ball snapshot moves the measured lateral flight corridor.
// The prediction is a *waypoint intent*, not proof of a future interception,
// ownership or physical contact; the 60Hz movement integrator remains bounded.
export const LOCAL_LANE_RETARGET_VERSION='me-pb-29-observed-lateral-retarget-v1';
export const LOCAL_LANE_RETARGET_DEADBAND_M=0.65;
export const LOCAL_LANE_RETARGET_MAX_STEP_M=0.12;
export const LOCAL_LANE_RETARGET_MIN_INTERVAL_TICKS=3;
export function retargetObservedLaneClosure({
 plan,ballPosition,ballVelocity,movementTick
}){
 if(plan===null)return null;
 if(!plan||plan.version!==LOCAL_LANE_CLOSURE_VERSION||
    !LOCAL_LANE_CLOSURE_CANDIDATES.includes(plan.defenderId)||
    !Number.isSafeInteger(plan.activatedAtTick)||plan.activatedAtTick<1||
    !['closing','released-after-physical-contact',
     'released-after-observed-flight',
     'released-after-new-physical-pass'].includes(plan.phase)||
    !plan.waypoint||!['x','y'].every(k=>finite(plan.waypoint[k])))
   throw new TypeError('Canonical observed lane assignment required');
 if(!Number.isSafeInteger(movementTick)||
    movementTick<plan.activatedAtTick||
    (plan.lastRetargetMovementTick!==undefined&&
     (!Number.isSafeInteger(plan.lastRetargetMovementTick)||
      plan.lastRetargetMovementTick<plan.activatedAtTick||
      movementTick<=plan.lastRetargetMovementTick)))
   throw new TypeError('Fresh monotonic movement tick required');
 if(!ballPosition||!ballVelocity||
    !['x','y'].every(k=>finite(ballPosition[k])&&finite(ballVelocity[k])))
   throw new TypeError('Measured finite Rapier ball XY and velocity required');
 // A real physical shoe START released this assignment on the PREVIOUS
 // tick. Never revive it or move the waypoint after physical release.
 if(plan.phase!=='closing')return plan;
 if(movementTick===plan.activatedAtTick||
    ballVelocity.x*(plan.directionX??1)<
      LOCAL_LANE_CLOSURE_REACTION_MIN_SPEED_MPS)return plan;
 if(plan.lastRetargetMovementTick!==undefined&&
    movementTick-plan.lastRetargetMovementTick<
      LOCAL_LANE_RETARGET_MIN_INTERVAL_TICKS)return plan;
 const observedY=clamp(
   ballPosition.y+ballVelocity.y*LOCAL_LANE_CLOSURE_LOOKAHEAD_S,-33,33);
 const error=observedY-plan.waypoint.y;
 if(Math.abs(error)<LOCAL_LANE_RETARGET_DEADBAND_M)return plan;
 const adjustment=clamp(error,
   -LOCAL_LANE_RETARGET_MAX_STEP_M,LOCAL_LANE_RETARGET_MAX_STEP_M);
 const nextY=clamp(plan.waypoint.y+adjustment,-33,33);
 if(Math.abs(nextY-plan.waypoint.y)<1e-12)return plan;
 return Object.freeze({...plan,
   waypoint:Object.freeze({x:plan.waypoint.x,y:nextY}),
   retargetVersion:LOCAL_LANE_RETARGET_VERSION,
   retargetCount:(plan.retargetCount??0)+1,
   lastRetargetMovementTick:movementTick,
   observedLateralBallPositionM:ballPosition.y,
   observedLateralBallVelocityMps:ballVelocity.y,
   interceptionProven:false,officialPossession:false
 });
}

// ME-PB-30: abandon a stale/lost physical flight without inventing a touch.
// A single Rapier sample never ends the assignment: require consecutive
// completed 60Hz observations, then keep the terminal state immutable.
// The defender moves normally after release, with NO roster or score update.
export const LOCAL_LANE_ABANDON_VERSION='me-pb-30-observed-flight-abandon-v1';
export const LOCAL_LANE_ABANDON_SLOW_X_MPS=1.25;
export const LOCAL_LANE_ABANDON_REVERSE_X_MPS=-0.6;
export const LOCAL_LANE_ABANDON_PASSED_MARGIN_M=2.5;
export const LOCAL_LANE_ABANDON_CONFIRM_TICKS=Object.freeze({
 slowed:6,reversed:3,'passed-defender':4
});
export function abandonObservedLaneClosure({
 plan,ballPosition,ballVelocity,defender,movementTick
}){
 if(plan===null)return null;
 if(!plan||plan.version!==LOCAL_LANE_CLOSURE_VERSION||
    !LOCAL_LANE_CLOSURE_CANDIDATES.includes(plan.defenderId)||
    !Number.isSafeInteger(plan.activatedAtTick)||plan.activatedAtTick<1||
    !['closing','released-after-physical-contact',
      'released-after-observed-flight',
     'released-after-new-physical-pass'].includes(plan.phase)||
    !plan.waypoint||!['x','y'].every(k=>finite(plan.waypoint[k])))
   throw new TypeError('Canonical observed lane assignment required');
 if(!Number.isSafeInteger(movementTick)||
    movementTick<plan.activatedAtTick||
    (plan.lastFlightObservationMovementTick!==undefined&&
      (!Number.isSafeInteger(plan.lastFlightObservationMovementTick)||
       plan.lastFlightObservationMovementTick<plan.activatedAtTick||
       movementTick<=plan.lastFlightObservationMovementTick)))
   throw new TypeError('Fresh monotonic flight sample tick required');
 if(!ballPosition||!ballVelocity||
    !['x','y'].every(k=>finite(ballPosition[k])&&finite(ballVelocity[k]))||
    !defender||defender.id!==plan.defenderId||defender.team!=='away'||
    !['x','y'].every(k=>finite(defender[k])))
   throw new TypeError('Measured canonical ball and assigned defender required');
 // An already completed shoe START always wins. No observed-only verdict
 // may overwrite it; likewise a previously abandoned plan is terminal.
 if(plan.phase!=='closing')return plan;
 // A ball that has physically run >2.5m beyond the observed defender AND
 // beyond the original longitudinal crossing cannot be chased indefinitely.
 // Keep this check ahead of slow/reverse for an unambiguous priority.
 const direction=plan.directionX??1;
 const reason=(ballPosition.x-defender.x)*direction>
      LOCAL_LANE_ABANDON_PASSED_MARGIN_M&&
    (ballPosition.x-plan.waypoint.x)*direction>
      LOCAL_LANE_ABANDON_PASSED_MARGIN_M?
    'passed-defender':
    ballVelocity.x*direction<=LOCAL_LANE_ABANDON_REVERSE_X_MPS?'reversed':
    ballVelocity.x*direction<LOCAL_LANE_ABANDON_SLOW_X_MPS?'slowed':null;
 const evidenceTicks=reason===null?0:
    reason===plan.flightLossCandidate?
    (plan.flightLossEvidenceTicks??0)+1:1;
 const observed=Object.freeze({...plan,
    lastFlightObservationMovementTick:movementTick,
    flightLossCandidate:reason,
    flightLossEvidenceTicks:evidenceTicks});
 if(reason===null||evidenceTicks<LOCAL_LANE_ABANDON_CONFIRM_TICKS[reason])
   return observed;
 return Object.freeze({...observed,
    phase:'released-after-observed-flight',
    releaseVersion:LOCAL_LANE_ABANDON_VERSION,
    releaseReason:reason,
    releasedAtMovementTick:movementTick,
    confirmedFlightLossTicks:evidenceTicks,
    interceptionProven:false,officialPossession:false
 });
}

// ME-PB-31: observe the real defender's return to the CURRENT standard
// tactical target after a measured-flight or physical-contact release.
// This is read-only evidence after kinematic integration, not a command.
// No off-ball teleports, duty override, possession, touch or score claims.
export const LOCAL_LANE_REJOIN_VERSION='me-pb-31-observed-duty-rejoin-v1';
export const LOCAL_LANE_REJOIN_DISTANCE_M=1;
export const LOCAL_LANE_REJOIN_CONFIRM_TICKS=6;
export const LOCAL_LANE_REJOIN_BLOCKED_TICKS=6;
export function observeReleasedLaneRejoin({
 plan,previous,defenderBefore,defenderAfter,tacticalTarget,
 movementTick,maxStepM
}){
 if(plan===null||plan?.phase==='closing')return null;
 if(!plan||plan.version!==LOCAL_LANE_CLOSURE_VERSION||
    !LOCAL_LANE_CLOSURE_CANDIDATES.includes(plan.defenderId)||
    !['released-after-physical-contact','released-after-observed-flight',
      'released-after-new-physical-pass'].includes(plan.phase)||
    !Number.isSafeInteger(plan.releasedAtMovementTick)||
    plan.releasedAtMovementTick<plan.activatedAtTick)
   throw new TypeError('Terminal canonical defender assignment required');
 if(!Number.isSafeInteger(movementTick)||
    movementTick<plan.releasedAtMovementTick||
    (previous===null&&movementTick!==plan.releasedAtMovementTick)||
    (previous!==null&&(!previous||
      previous.version!==LOCAL_LANE_REJOIN_VERSION||
      previous.defenderId!==plan.defenderId||
      previous.releasedAtMovementTick!==plan.releasedAtMovementTick||
      previous.tick!==movementTick-1)))
   throw new TypeError('Contiguous observed recovery movement tick required');
 if(!defenderBefore||!defenderAfter||
    defenderBefore.id!==plan.defenderId||
    defenderAfter.id!==plan.defenderId||
    defenderBefore.team!=='away'||defenderAfter.team!=='away'||
    !tacticalTarget||![defenderBefore,defenderAfter,tacticalTarget]
      .every(p=>['x','y'].every(k=>finite(p[k])))||
    !finite(maxStepM)||maxStepM<=0||
    (defenderAfter.blockedBy!==null&&
     (typeof defenderAfter.blockedBy!=='string'||
      !/^(?:home|away)-(?:[1-9]|10|11)$/.test(defenderAfter.blockedBy)||
      defenderAfter.blockedBy===plan.defenderId)))
   throw new TypeError('Measured canonical defender trajectory and current duty required');
 const movementM=distance(defenderBefore,defenderAfter);
 if(movementM>maxStepM+1e-5)
   throw new RangeError('Unbounded observed recovery movement');
 const beforeDistanceM=distance(defenderBefore,tacticalTarget);
 const distanceToCurrentDutyM=distance(defenderAfter,tacticalTarget);
 const aligned=distanceToCurrentDutyM<=LOCAL_LANE_REJOIN_DISTANCE_M;
 const alignedTicks=aligned?(previous?.alignedTicks??0)+1:0;
 const blocked=defenderAfter.blockedBy!==null&&!aligned;
 const blockedTicks=blocked?(previous?.blockedTicks??0)+1:0;
 const status=alignedTicks>=LOCAL_LANE_REJOIN_CONFIRM_TICKS?
   'aligned-with-current-duty':
   blockedTicks>=LOCAL_LANE_REJOIN_BLOCKED_TICKS?
   'blocked-by-observed-player':'returning-to-current-duty';
 return Object.freeze({
  version:LOCAL_LANE_REJOIN_VERSION,tick:movementTick,
  defenderId:plan.defenderId,releasedAtMovementTick:plan.releasedAtMovementTick,
  releasePhase:plan.phase,status,
  tacticalTarget:Object.freeze({x:tacticalTarget.x,y:tacticalTarget.y}),
  beforeDistanceM,distanceToCurrentDutyM,
  actualAdvanceM:beforeDistanceM-distanceToCurrentDutyM,
  actualMovementM:movementM,blockedBy:defenderAfter.blockedBy,
  blockedTicks,alignedTicks,
  observedOnly:true,officialPossession:false,interceptionProven:false
 });
}

// ME-PB-32/33: a new defensive task requires a DISTINCT real Rapier
// shoe START and an ACTUALLY applied football impulse. The opt-in ledger
// accepts alternating Home #7/#10 stages, never an inferred third pass.
// A finite cap protects replay memory if the engine later grows more stages.
export const LOCAL_LANE_PASS_EPOCH_VERSION='me-pb-32-real-pass-epoch-v1';
export const LOCAL_LANE_SUPERSEDE_VERSION='me-pb-32-new-real-pass-supersedes-v1';
export const LOCAL_LANE_PASS_MAX_EVENTS=8;
export const LOCAL_LANE_PASS_CHAIN_VERSION='me-pb-33-bounded-pass-chain-v1';
const LOCAL_FIRST_PASS_VERSION='me-pb-25-dynamic-recipient-v1';
const LOCAL_RETURN_PASS_VERSION='me-pb-24-local-exchange-v1';
export function acceptObservedPhysicalPass({
 event,contactFrame,previousTick,lastAcceptedPassTick=null,previousEpoch=null
}){
 if(event===null||event===undefined)return null;
 if(!Number.isSafeInteger(previousTick)||previousTick<1||
    (lastAcceptedPassTick!==null&&
     (!Number.isSafeInteger(lastAcceptedPassTick)||
      lastAcceptedPassTick<1||lastAcceptedPassTick>previousTick)))
   throw new TypeError('Canonical observed pass epoch tick required');
 if(previousEpoch!==null&&(
    previousEpoch.version!==LOCAL_LANE_PASS_EPOCH_VERSION||
    previousEpoch.chainVersion!==LOCAL_LANE_PASS_CHAIN_VERSION||
    !Number.isSafeInteger(previousEpoch.tick)||previousEpoch.tick<1||
    !Number.isSafeInteger(previousEpoch.sequence)||previousEpoch.sequence<1||
    previousEpoch.sequence>LOCAL_LANE_PASS_MAX_EVENTS||
    !['pass','return-pass'].includes(previousEpoch.stage)||
    previousEpoch.stage!==
      (previousEpoch.sequence%2===1?'pass':'return-pass')||
    previousEpoch.playerId!==
      (previousEpoch.stage==='pass'?'home-7':'home-10')||
    previousEpoch.targetPlayerId!==
      (previousEpoch.stage==='pass'?'home-10':'home-7')||
    (previousEpoch.sequence===1?
      previousEpoch.previousPassTick!==null:
      (!Number.isSafeInteger(previousEpoch.previousPassTick)||
       previousEpoch.previousPassTick>=previousEpoch.tick-2))||
    previousEpoch.observedShoeStartTick!==previousEpoch.tick||
    previousEpoch.appliedByRealRapier!==true||
    (lastAcceptedPassTick!==null&&
      lastAcceptedPassTick!==previousEpoch.tick)))
   throw new TypeError('Verified previous physical pass epoch required');
 const priorTick=previousEpoch?.tick??lastAcceptedPassTick;
 // The engine keeps historical passes in snapshots. A repeated physical
 // event must be ignored and cannot trigger any second movement assignment.
 if(Number.isSafeInteger(event.tick)&&event.tick<=(priorTick??0))return null;
 const sequence=previousEpoch===null?
  (priorTick===null?1:2):previousEpoch.sequence+1;
 if(sequence>LOCAL_LANE_PASS_MAX_EVENTS)return null;
 const first=sequence%2===1;
 const expectedStage=first?'pass':'return-pass';
 if(event.stage!==expectedStage||event.version!==
    (first?LOCAL_FIRST_PASS_VERSION:LOCAL_RETURN_PASS_VERSION)||
    event.playerId!==(first?'home-7':'home-10')||
    event.targetPlayerId!==(first?'home-10':'home-7')||
    event.tick!==previousTick||
    event.physicalTrigger!=='real-rapier-foot-contact-start'||
    event.appliedByRealRapier!==true||
    event.officialMatchAction!==false||
    !event.impulseNs||!['x','y','z'].every(k=>finite(event.impulseNs[k]))||
    Math.hypot(event.impulseNs.x,event.impulseNs.y)<=0||
    !contactFrame||contactFrame.version!==CANONICAL_FOOT_CONTACT_VERSION||
    contactFrame.tick!==previousTick||
    !Array.isArray(contactFrame.started)||
    new Set(contactFrame.started).size!==contactFrame.started.length||
    contactFrame.started.some(id=>typeof id!=='string'||
      !/^(?:home|away)-(?:[1-9]|10|11)$/.test(id))||
    !contactFrame.started.includes(event.playerId)||
    (sequence>2&&previousEpoch===null)||
    (sequence===1&&event.previousPassTick!==undefined)||
    (sequence>1&&(event.previousPassTick!==priorTick||
      event.tick<=priorTick+2))||
    (previousEpoch!==null&&
      (previousEpoch.targetPlayerId!==event.playerId||
       previousEpoch.playerId!==event.targetPlayerId)))
   throw new TypeError('Verified new same-world Rapier pass and separate shoe START required');
 return Object.freeze({
  version:LOCAL_LANE_PASS_EPOCH_VERSION,
  chainVersion:LOCAL_LANE_PASS_CHAIN_VERSION,sequence,
  previousPassTick:priorTick,stage:event.stage,
  tick:event.tick,playerId:event.playerId,targetPlayerId:event.targetPlayerId,
  observedShoeStartTick:contactFrame.tick,appliedByRealRapier:true,
  officialPossession:false,passCompletionInferred:false
 });
}
export function supersedeObservedLaneClosure({plan,observedPass,movementTick}){
 if(!plan||plan.version!==LOCAL_LANE_CLOSURE_VERSION||
    !Number.isSafeInteger(plan.passEventTick)||plan.passEventTick<1||
    !Number.isSafeInteger(plan.activatedAtTick)||
    !['closing','released-after-physical-contact',
      'released-after-observed-flight'].includes(plan.phase)||
    !observedPass||observedPass.version!==LOCAL_LANE_PASS_EPOCH_VERSION||
    observedPass.chainVersion!==LOCAL_LANE_PASS_CHAIN_VERSION||
    !['pass','return-pass'].includes(observedPass.stage)||
    !Number.isSafeInteger(plan.passSequence)||plan.passSequence<1||
    observedPass.sequence!==plan.passSequence+1||
    observedPass.previousPassTick!==plan.passEventTick||
    observedPass.tick<=plan.passEventTick||
    !Number.isSafeInteger(movementTick)||movementTick!==observedPass.tick+1)
   throw new TypeError('Distinct verified later Rapier pass required to supersede');
 // Preserve prior terminal physical releases verbatim; do NOT overwrite an
 // already measured real shoe START or lost-flight result.
 if(plan.phase!=='closing')return plan;
 return Object.freeze({...plan,phase:'released-after-new-physical-pass',
  releaseVersion:LOCAL_LANE_SUPERSEDE_VERSION,
  newPhysicalPassTick:observedPass.tick,
  releasedAtMovementTick:movementTick,
  officialPossession:false,interceptionProven:false
 });
}
