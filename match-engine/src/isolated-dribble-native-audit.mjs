import {hasExclusiveNativeShoeStart} from './rapier-foot-contact-bridge.mjs';
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
// Observational categories, not diagnoses of intent or interventions.
// A Rapier START is solver-level contact, even without a Carry impulse.
const soloNoActionReasons=freeze([
 'simultaneousFootStarts','otherFootAlreadyActive',
 'exclusiveActorStartNoImpulse','unreleasedSingleFootStart'
]);
const soloCarryPhases=freeze(['control','moderate','sprint']);
// Observed discrete-tick END/START arrangements, not a sub-tick ordering
// or proof that both shoes were out of contact between the two events.
const singleFootHandoffKinds=freeze([
 'oppositeFootEndStartSameTick',
 'sameFootEndRestartSameTick',
 'multipleFootEndStartSameTick',
 'startWithoutMatchingSameTickEnd'
]);
const zeroHandoffs=()=>Object.fromEntries(
 singleFootHandoffKinds.map(k=>[k,0]));
const zeroReasons=()=>Object.fromEntries(soloNoActionReasons.map(k=>[k,0]));
const zeroPhase=()=>({nativeShoeStarts:0,appliedCarry:0,withoutCarry:0});
export function createIsolatedDribbleNativeAudit({side,variantIndex,solo=false,directed=false}={}){
 if(!['home','away'].includes(side)||!Number.isSafeInteger(variantIndex)||
    variantIndex<0||variantIndex>29||typeof solo!=='boolean')
  throw new TypeError('Only D-01 paired HOME/AWAY variant may audit Rapier');
 const actor=side+'-10',opponent=solo?null:(side==='home'?'away':'home')+'-2';
 const validCarrySource=(a,foot,tick)=>foot.nativePairedFeet!==undefined?
  hasExclusiveNativeShoeStart(foot,a.playerId)&&a.decisionContext?.nativeCarryTouch?.version==='me-628-native-carry-geometry-v1'&&a.decisionContext.nativeCarryTouch.tick===tick&&a.decisionContext.nativeCarryTouch.genuineRapierShoeStartRequired===true:
  a.decisionContext?.isolatedDribbleTouch?.tick===tick;
 if(typeof directed!=='boolean'||(directed&&solo))throw new TypeError('Directed evidence only for 1v1');
 let tackles=0,interceptions=0,recoveryTouches=0;
 const perPlayer=Object.fromEntries([actor,opponent].filter(Boolean).map(id=>[id,{carry:0,tackle:0,interception:0}]));
 let tick=-1,priorBall=null,firstBall=null,sourceEnds=0,
  nativeStarts=0,recontacts=0,opposingStarts=0,actions=0;
 let lastEnd=-1,hasEnded=false,ballPath=0,minimumGap=Infinity,
  totalAttackerBallGapM=0,maxAttackerBallGapM=0,
  minPlayerGap=Infinity,maxActualPlayerSpeed=0,pressureTicks=0,
  nativeBodyBallTicks=0,nativeBodyPairsTicks=0,
  peakGroundClearanceM=0,airborneFramesAbove2Cm=0,peakBallSpeedMps=0,
  peakBallSpeedWitness=null;
 const touchTicks=[],actionTicks=[],actionMagnitudes=[],directions=[];
 const genuineSoloFootTouches={left:0,right:0},realSoloActionFeet=[];
 const nativeNonActionStarts=[],nativeContactEvidence=[];
 const contactDutyTicks={left:0,right:0};
 let bothFeetTouchTicks=0,alternatingRealActionFeet=0,lastActionFoot=null;
 let nonActionStartsWithNativeForceEvents=0,nonActionStartsWithSolverContacts=0,
  nonActionStartsWithGeometricContacts=0,peakNonActionWorldStepDelta=0;
 let largestNonActionWorldStepDeltaWitness=null;
 // Same-tick original actor START/END and per-shoe START/END are distinct.
 // Track completed releases so a later shoe start cannot be misidentified as
 // an actor re-contact while the opposite real shoe remained planted.
 const soloNoActionBreakdown=zeroReasons();
 const soloNoActionByPhase=Object.fromEntries(soloCarryPhases.map(x=>[
  x,zeroReasons()
 ]));
 const soloStartsByPhase=Object.fromEntries(soloCarryPhases.map(x=>[
  x,zeroPhase()
 ]));
 const unreleasedHandoffKinds=zeroHandoffs();
 const unreleasedHandoffsByPhase=Object.fromEntries(
  soloCarryPhases.map(x=>[x,zeroHandoffs()]));
 const recentUnreleasedHandoffs=[];
 let priorSoloPhysicalActive=freeze([]),nativeActorContactOnsets=0,
  nativeActorFullReleaseEvents=0,nativeActorStartsAfterFullRelease=0,
  lastNativeFullReleaseTick=null,releaseToActorStartGapTotal=0,
  releaseToActorStartGapMax=0;
 const releaseToActorStartGapWitnesses=[];
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
  const physicalSoloFeet=solo&&physics.tick>0?foot.nativeSoloFeet:null;
  if(solo&&physics.tick>0&&(!physicalSoloFeet||
      physicalSoloFeet.actorId!==actor||
      physicalSoloFeet.source!=='rapier-physical-collider-events'||
      physicalSoloFeet.independentColliders!==2||
      !['started','ended','active'].every(k=>
       Array.isArray(physicalSoloFeet[k])&&
       physicalSoloFeet[k].every(f=>f==='left'||f==='right')&&
       new Set(physicalSoloFeet[k]).size===physicalSoloFeet[k].length)||
      physicalSoloFeet.exclusivePhysicalStart!==(
       physicalSoloFeet.started.length===1&&
       physicalSoloFeet.active.length===1)))
   throw new TypeError('Solo requires independently observed native Rapier left/right shoes');
  if(physicalSoloFeet){
   const phase=playerFrame.soloCarryPhase?.phase;
   if(!soloCarryPhases.includes(phase))
    throw new TypeError('Solo contact phase must be canonical original mover phase');
   // The original actor-level gate deliberately observes a transition from
   // ZERO active shoes to at least one. A second shoe START during an
   // existing overlap is not a new actor START and is never synthesized.
   const actorNewStart=foot.started.includes(actor);
   const actorFullRelease=foot.ended.includes(actor);
   const previousCount=priorSoloPhysicalActive.length;
   const currentCount=physicalSoloFeet.active.length;
   if(actorNewStart!==(previousCount===0&&currentCount>0)||
      actorFullRelease!==(previousCount>0&&currentCount===0))
    throw new TypeError('Native actor contact transitions must match per-foot release source');
   if(actorNewStart){
    nativeActorContactOnsets++;
    if(lastNativeFullReleaseTick!==null){
     const gap=physics.tick-lastNativeFullReleaseTick;
     if(!Number.isSafeInteger(gap)||gap<=0)
      throw new TypeError('An actor recontact must follow a genuine full release');
     nativeActorStartsAfterFullRelease++;
     releaseToActorStartGapTotal+=gap;
     releaseToActorStartGapMax=Math.max(releaseToActorStartGapMax,gap);
     releaseToActorStartGapWitnesses.push(freeze({
      releaseTick:lastNativeFullReleaseTick,startTick:physics.tick,
      emptyToActorStartGapTicks:gap,phase
     }));
     if(releaseToActorStartGapWitnesses.length>16)
      releaseToActorStartGapWitnesses.shift();
    }
   }
   if(actorFullRelease){
    nativeActorFullReleaseEvents++;
    lastNativeFullReleaseTick=physics.tick;
   }
   const dynamics=physicalSoloFeet.dynamics;
   if(!dynamics||
      dynamics.source!=='native-rapier-world-step-before-carry-action'||
      dynamics.tick!==physics.tick||dynamics.causalAttribution!==false||
      dynamics.readOnly!==true||
      !['left','right'].every(side=>{
       const evidence=dynamics.feet?.[side];
       return evidence&&typeof evidence.started==='boolean'&&
        typeof evidence.active==='boolean'&&
        evidence.started===physicalSoloFeet.started.includes(side)&&
        evidence.active===physicalSoloFeet.active.includes(side)&&
        [evidence.nativeForceEventCount,evidence.totalReportedForceMagnitudeN,
         evidence.peakReportedForceMagnitudeN,evidence.nativeManifoldCount,
         evidence.geometricContacts,evidence.solverContacts].every(x=>
         Number.isFinite(x)&&x>=0);
      })||
      !Number.isFinite(dynamics.worldStepBallVelocityDeltaMps?.magnitude)||
      Math.abs(Math.hypot(
       dynamics.worldStepBallVelocityDeltaMps.x,
       dynamics.worldStepBallVelocityDeltaMps.y,
       dynamics.worldStepBallVelocityDeltaMps.z)-
       dynamics.worldStepBallVelocityDeltaMps.magnitude)>1e-9)
    throw new TypeError('Solo per-foot dynamics must be native same-step pre-action Rapier evidence');
   for(const footSide of physicalSoloFeet.started){
    genuineSoloFootTouches[footSide]++;
    const converted=Boolean(action?.action==='carry'&&
     action?.appliedByRapier===true&&
     action?.actualPhysicsImpulseApplied===true&&
     physicalSoloFeet.exclusivePhysicalStart&&
     footSide===physicalSoloFeet.started[0]);
    // These are real native COLLISION START events, not necessarily ball
    // impulses, intentional touches, completed dribbles, or possession.
    // Even an unconverted collision can influence the Rapier ball solver.
    const footPhysics=dynamics.feet[footSide];
    const worldDelta=dynamics.worldStepBallVelocityDeltaMps.magnitude;
    const reason=converted?null:
     physicalSoloFeet.started.length===2?'simultaneousFootStarts':
     physicalSoloFeet.active.some(f=>f!==footSide)?
      'otherFootAlreadyActive':
     actorNewStart?'exclusiveActorStartNoImpulse':
      'unreleasedSingleFootStart';
    const otherSide=footSide==='left'?'right':'left';
    const priorOther=priorSoloPhysicalActive.includes(otherSide);
    const priorOwn=priorSoloPhysicalActive.includes(footSide);
    const otherEnd=physicalSoloFeet.ended.includes(otherSide)&&priorOther;
    const ownEnd=physicalSoloFeet.ended.includes(footSide)&&priorOwn;
    // Classification uses only source-observed discrete Rapier events.
    // END and START in the SAME simulation tick are co-occurring events:
    // their physical sub-tick order, and any transient no-contact gap,
    // cannot be inferred from the event queue.
    const unreleasedSubtype=reason==='unreleasedSingleFootStart'?
     otherEnd&&ownEnd?'multipleFootEndStartSameTick':
     otherEnd&&!priorOwn?'oppositeFootEndStartSameTick':
     ownEnd?'sameFootEndRestartSameTick':
     'startWithoutMatchingSameTickEnd':null;
    if(unreleasedSubtype!==null){
     unreleasedHandoffKinds[unreleasedSubtype]++;
     unreleasedHandoffsByPhase[phase][unreleasedSubtype]++;
     recentUnreleasedHandoffs.push(freeze({
      tick:physics.tick,foot:footSide,phase,
      kind:unreleasedSubtype,
      priorActive:freeze([...priorSoloPhysicalActive]),
      nativeEnds:freeze([...physicalSoloFeet.ended]),
      nativeStarts:freeze([...physicalSoloFeet.started]),
      afterActive:freeze([...physicalSoloFeet.active]),
      solverContacts:dynamics.feet[footSide].solverContacts,
      nativeForceEventCount:dynamics.feet[footSide].nativeForceEventCount,
      originalRapierEvent:true,causalAttribution:false,
      subTickOrderingKnown:false
     }));
     if(recentUnreleasedHandoffs.length>16)
      recentUnreleasedHandoffs.shift();
    }
    const phaseSource=soloStartsByPhase[phase];
    phaseSource.nativeShoeStarts++;
    if(converted)phaseSource.appliedCarry++;
    else phaseSource.withoutCarry++;
    if(!converted){
     soloNoActionBreakdown[reason]++;
     soloNoActionByPhase[phase][reason]++;
     nativeNonActionStarts.push({tick:physics.tick,
      foot:footSide,reason,phase,
      priorShoeActive:freeze([...priorSoloPhysicalActive]),
      nativeActorStart:actorNewStart,
      otherFootActive:physicalSoloFeet.active.some(f=>f!==footSide)});
     if(footPhysics.nativeForceEventCount>0)
      nonActionStartsWithNativeForceEvents++;
     if(footPhysics.solverContacts>0)
      nonActionStartsWithSolverContacts++;
     if(footPhysics.geometricContacts>0)
      nonActionStartsWithGeometricContacts++;
     if(worldDelta>peakNonActionWorldStepDelta){
      peakNonActionWorldStepDelta=worldDelta;
      largestNonActionWorldStepDeltaWitness=freeze({
       tick:physics.tick,foot:footSide,
       worldStepBallVelocityDeltaMps:worldDelta,
       nativeForceEventCount:footPhysics.nativeForceEventCount,
       peakReportedForceMagnitudeN:footPhysics.peakReportedForceMagnitudeN,
       solverContacts:footPhysics.solverContacts,
       causalAttribution:false
      });
     }
    }
    nativeContactEvidence.push(freeze({tick:physics.tick,foot:footSide,
     nativeStart:true,appliedCarryImpulse:converted,
     classification:reason??'native-exclusive-actor-carry',
     unreleasedHandoffKind:unreleasedSubtype,
     nativeShoeEnds:freeze([...physicalSoloFeet.ended]),
     nativeShoeStarts:freeze([...physicalSoloFeet.started]),
     observedCarryPhase:phase,nativeActorStart:actorNewStart,
     priorShoeActive:freeze([...priorSoloPhysicalActive]),
     concurrentOtherShoe:physicalSoloFeet.active.some(f=>f!==footSide),
     nativeForceEventCount:footPhysics.nativeForceEventCount,
     totalReportedForceMagnitudeN:footPhysics.totalReportedForceMagnitudeN,
     peakReportedForceMagnitudeN:footPhysics.peakReportedForceMagnitudeN,
     nativeManifoldCount:footPhysics.nativeManifoldCount,
     geometricContacts:footPhysics.geometricContacts,
     solverContacts:footPhysics.solverContacts,
     worldStepBallVelocityDeltaMps:worldDelta,
     causalAttribution:false}));
    if(nativeContactEvidence.length>16)nativeContactEvidence.shift();
   }
   for(const footSide of physicalSoloFeet.active)contactDutyTicks[footSide]++;
   if(physicalSoloFeet.active.length===2)bothFeetTouchTicks++;
   priorSoloPhysicalActive=freeze([...physicalSoloFeet.active]);
  }
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
    // In solo research only the real selected actor can collide; no
    // phantom "22-player" overlap is meaningful with zero other bodies.
    if(!solo)minPlayerGap=Math.min(minPlayerGap,
     Math.hypot(a.x-b.x,a.y-b.y));
   }
  }
  if(!solo&&minPlayerGap<PLAYER_MIN_SEPARATION_M-1e-6)
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
    ...(solo?{physicalSoloFeet:foot.nativeSoloFeet??null}:{}),
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
  if(action&&directed){
   const id=action.playerId;
   if(action.tick!==physics.tick||![actor,opponent].includes(id)||!['tackle','interception','carry'].includes(action.action)||
      action.appliedByRapier!==true||action.actualPhysicsImpulseApplied!==true||
      foot.started.length!==1||foot.started[0]!==id||foot.active.length!==1||foot.active[0]!==id||
      (action.action==='carry'?!validCarrySource(action,foot,physics.tick):
       action.defensiveTarget?.version!=='me-628-duel-defensive-touch-v1'||action.defensiveTarget.physicsTick!==physics.tick))
    throw new TypeError('Only native exclusive shared duel actions qualify');
   perPlayer[id][action.action]++;
   if(action.action==='tackle')tackles++;
   else if(action.action==='interception')interceptions++;
   else if(id===opponent)recoveryTouches++;
   else{
    actions++;actionTicks.push(physics.tick);
    actionMagnitudes.push(Math.hypot(action.impulseNs.x,action.impulseNs.y));
    directions.push(Math.atan2(action.impulseNs.y,(side==='home'?1:-1)*action.impulseNs.x));
   }
  }else if(action){
   if(action.tick!==physics.tick||action.playerId!==actor||
      action.action!=='carry'||action.appliedByRapier!==true||
      action.actualPhysicsImpulseApplied!==true||
      !foot.started.includes(actor)||foot.started.length!==1||
      foot.active.length!==1||foot.active[0]!==actor||
      !validCarrySource(action,foot,physics.tick)||
      (solo&&!physicalSoloFeet.exclusivePhysicalStart))
    throw new TypeError('Only actual exclusive native D-01 carry impulses qualify');
   if(solo){
    const realFoot=physicalSoloFeet.started[0];
    realSoloActionFeet.push(realFoot);
    if(lastActionFoot!==null&&lastActionFoot!==realFoot)
     alternatingRealActionFeet++;
    lastActionFoot=realFoot;
   }
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
   ...(directed?{defensiveTackleAttempts:tackles,defensiveInterceptionAttempts:interceptions,defensiveRecoveryTouches:recoveryTouches,actionsByPlayer:freeze(Object.fromEntries(Object.entries(perPlayer).map(([id,counts])=>[id,freeze({...counts})])))}:{}),
   ...(solo?{
    nativePhysicalShoeColliders:2,
    nativeLeftFootStarts:genuineSoloFootTouches.left,
    nativeRightFootStarts:genuineSoloFootTouches.right,
    nativeBothFeetActiveTicks:bothFeetTouchTicks,
    nativePhysicalShoeStarts:genuineSoloFootTouches.left+
     genuineSoloFootTouches.right,
    nativeShoeStartsWithoutCarryImpulse:nativeNonActionStarts.length,
    nonActionStartsWithNativeForceEvents,
    nonActionStartsWithSolverContacts,
    nonActionStartsWithGeometricContacts,
    // Counts are per genuine shoe START, not per actor, contact frame or
    // inferred intention. Only source-observed arrangements are asserted.
    nonActionStartReasons:freeze({...soloNoActionBreakdown}),
    unreleasedSingleFootEndStartKinds:freeze({...unreleasedHandoffKinds}),
    unreleasedHandoffKindsByPhase:freeze(Object.fromEntries(
     soloCarryPhases.map(phase=>[phase,
      freeze({...unreleasedHandoffsByPhase[phase]})]))),
    recentUnreleasedSingleFootEvents:freeze([
     ...recentUnreleasedHandoffs
    ]),
    nonActionReasonsByPhase:freeze(Object.fromEntries(
     soloCarryPhases.map(phase=>[phase,
      freeze({...soloNoActionByPhase[phase]})]))),
    nativeStartsByPhase:freeze(Object.fromEntries(
     soloCarryPhases.map(phase=>[phase,
      freeze({...soloStartsByPhase[phase]})]))),
    nativeActorContactOnsets,nativeActorFullReleaseEvents,
    nativeActorStartsAfterFullRelease,
    releaseToActorStartGapMaxTicks:releaseToActorStartGapMax,
    releaseToActorStartGapMeanTicks:nativeActorStartsAfterFullRelease?
     releaseToActorStartGapTotal/nativeActorStartsAfterFullRelease:null,
    recentFullReleaseToActorStartGaps:freeze([
     ...releaseToActorStartGapWitnesses
    ]),
    peakNonActionWorldStepBallDeltaMps:peakNonActionWorldStepDelta,
    peakNonActionWorldStepBallDeltaWitness:largestNonActionWorldStepDeltaWitness,
    nativeLeftShoeContactTicks:contactDutyTicks.left,
    nativeRightShoeContactTicks:contactDutyTicks.right,
    recentNativeShoeStarts:freeze([...nativeContactEvidence]),
    realActionFeet:freeze([...realSoloActionFeet]),
    verifiedFootAlternations:alternatingRealActionFeet
   }:{}),
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
   minimumCanonicalSeparationM:solo?null:minPlayerGap,
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
