// Extracted #481 A4.2b.1 physical impulse boundary.
// A private, opt-in adapter for the SAME Rapier ball body and canonical
// 22-shoe event source. No world, policy/mover override or official results.
import {inspectPhysicalActionRejection,selectUniformAutonomousContactAction,
 UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS}
 from './player-ball-uniform-autonomous-action.mjs';
import {FOOT_CONTACT_VERSION} from './player-foot-contact.mjs';
import {chooseIntentSoloCarryTouch} from './intent-driven-solo-carry.mjs';
import {calculateRealReceivingCushion}
 from './physical-receiving-cushion-m25.mjs';
import {choosePhysicalReceiverSecondTouch}
 from './physical-receiver-choice-m27.mjs';
import {calculatePhysicalReceiverReleaseTap} from './physical-receiver-tap-m30.mjs';

export const PRIVATE_PHYSICAL_ACTION_EXECUTOR_VERSION=
 'me-action-foundation-real-shoe-impulse-v1';

export function createPrivatePhysicalActionExecutor({
 ballBody,shoeBridge,ballRadiusM,allowPhysicalCarry=false,
 researchReceivingCushionSide=null,researchReceivingDecisionSide=null,
 researchReceiverTapSide=null,activePlayerIds=null,
 smallSidedDecisionContext=null,isolatedDribbleContext=null,
 physicalBodyGuardEnabled=false,intentDrivenSoloCarry=false
}={}){
 if(typeof intentDrivenSoloCarry!=='boolean'||
    (intentDrivenSoloCarry&&(
     isolatedDribbleContext?.situationId!=='carry-solo'||
     physicalBodyGuardEnabled||researchReceivingCushionSide!==null||
     researchReceivingDecisionSide!==null||researchReceiverTapSide!==null)))
  throw new TypeError('Intent gameplay touch is exclusive to unopposed DEV Carry Solo');
 if(activePlayerIds!==null&&(!Array.isArray(activePlayerIds)||
    activePlayerIds.length<1||activePlayerIds.length>7||
    new Set(activePlayerIds).size!==activePlayerIds.length))
  throw new TypeError('Small-sided active physical shoe set is invalid');
 if(typeof physicalBodyGuardEnabled!=='boolean'||
    (physicalBodyGuardEnabled&&activePlayerIds===null))
  throw new TypeError('Native body contact requires genuine small-sided shoe source');
 if(smallSidedDecisionContext!==null&&(
    activePlayerIds===null||allowPhysicalCarry!==true||
    typeof smallSidedDecisionContext!=='object'||
    !['home','away'].includes(smallSidedDecisionContext.attackingSide)||
    typeof smallSidedDecisionContext.situationId!=='string'||
    !Number.isSafeInteger(smallSidedDecisionContext.variantIndex)||
    smallSidedDecisionContext.variantIndex<1||
    smallSidedDecisionContext.variantIndex>29))
  throw new TypeError('Seeded contextual LAB choice needs an active real physical shoe set');
 if(isolatedDribbleContext!==null&&(
    !['home','away'].includes(isolatedDribbleContext?.attackingSide)||
    !['dribble-1v1','carry-solo'].includes(isolatedDribbleContext?.situationId)||
    !Number.isSafeInteger(isolatedDribbleContext?.variantIndex)||
    isolatedDribbleContext.variantIndex<0||isolatedDribbleContext.variantIndex>29||
    activePlayerIds===null||activePlayerIds.length!==(isolatedDribbleContext.situationId==='carry-solo'?1:2)||
    !activePlayerIds.includes(isolatedDribbleContext.attackingSide+'-10')||
    (isolatedDribbleContext.situationId==='dribble-1v1'&&!activePlayerIds.includes((isolatedDribbleContext.attackingSide==='home'?'away':'home')+'-2'))||
    allowPhysicalCarry!==true))
  throw new TypeError('Isolated dribble requires paired genuine Rapier shoes');
 if(!ballBody||typeof ballBody.translation!=='function'||
    typeof ballBody.linvel!=='function'||
    typeof ballBody.applyImpulse!=='function'||
    !shoeBridge||typeof shoeBridge.snapshot!=='function'||
    typeof ballRadiusM!=='number'||!Number.isFinite(ballRadiusM)||
    ballRadiusM<0.05||ballRadiusM>0.2||
    typeof allowPhysicalCarry!=='boolean'||
    (researchReceivingCushionSide!==null&&
     !['home','away'].includes(researchReceivingCushionSide))||
    (researchReceivingCushionSide!==null&&allowPhysicalCarry)||
    (researchReceivingDecisionSide!==null&&(
     !['home','away'].includes(researchReceivingDecisionSide)||
     researchReceivingDecisionSide!==researchReceivingCushionSide))||
    (researchReceiverTapSide!==null&&(
     !['home','away'].includes(researchReceiverTapSide)||
     researchReceiverTapSide!==researchReceivingDecisionSide)))
  throw new TypeError('Private Rapier body and live shoe source required');
 let tick=0,lastActionTick=-UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS;
 let action=null,audit=null,closed=false;
 let actualPriorPass=null,interrupted=false,firstCushion=null;
 let firstReceiverChoice=null,firstReceiverTap=null;
 const ensureOpen=()=>{if(closed)throw new Error('Physical action executor disposed');};
 function apply(nextTick,playerFrame,{
  suppressOriginalAction=false,suppressPhysicalBodyContact=false
 }={}){
  ensureOpen();
  if(typeof suppressOriginalAction!=='boolean'||
     typeof suppressPhysicalBodyContact!=='boolean'||
     (suppressPhysicalBodyContact&&!physicalBodyGuardEnabled))
   throw new TypeError('Physical body-contact guard only in opt-in small-sided source');
  const contact=shoeBridge.snapshot();
  if(!Number.isSafeInteger(nextTick)||nextTick!==tick+1||
     !contact||contact.version!==FOOT_CONTACT_VERSION||
     contact.tick!==nextTick)
   throw new RangeError('Current genuine shoe event tick required');
  // This is called solely by the core after its single Rapier world.step().
  // In the optional GAMEPLAY intent mode, the football remains dynamic but
  // native shoe colliders are non-interacting and cannot masquerade as START.
  if(intentDrivenSoloCarry){
   if(contact.started.length!==0||contact.active.length!==0||
      contact.nativeSoloFeet?.started.length!==0||
      contact.nativeSoloFeet?.active.length!==0||
      suppressPhysicalBodyContact)
    throw new Error('Intent-driven Solo Carry must not count native shoe contacts');
   const actor=playerFrame?.players?.find(p=>
    p.id===isolatedDribbleContext.attackingSide+'-10');
   if(playerFrame?.tick!==nextTick)
    throw new TypeError('Same-tick original canonical movement required');
   const proposed=suppressOriginalAction?null:chooseIntentSoloCarryTouch({
    tick:nextTick,lastTouchTick:lastActionTick,
    attackingSide:isolatedDribbleContext.attackingSide,
    phase:playerFrame.soloCarryPhase?.phase,
    fixedPhaseLab:playerFrame.soloCarryPhase?.lockedPhase!==undefined,
    playerAttributes:playerFrame.soloCarryPhase?.carryPlayerAttributes??null,
    player:actor,
    ballPosition:ballBody.translation(),ballVelocity:ballBody.linvel(),
    ballRadiusM
   });
   let result=null;
   if(proposed){
    ballBody.applyImpulse(proposed.impulseNs,true);
    result=Object.freeze({...proposed,appliedByRapier:true,
     actualPhysicsImpulseApplied:true,
     actionSource:'internal-solo-gameplay-intent',
     physicalTrigger:'live-player-ball-gap-no-shoe-claim',
     decisionContext:Object.freeze({
      intentDrivenSoloCarry:true,nativeShoeStart:false,
      officialMatchAction:false
     })});
    lastActionTick=nextTick;
   }
   tick=nextTick;action=result;
   audit=Object.freeze({
    tick:nextTick,intentDrivenSoloCarry:true,
    originalRapierBall:true,authenticNativeShoeStarts:0,
    selectedIntent:result!==null,officialMatchAction:false,
    noActionReason:result?null:'not-close-or-not-time-for-next-push'
   });
   return Object.freeze({tick,action,audit});
  }
  // No caller-selected action, injected START, custom impulse or player ID.
  const input={
   tick:nextTick,
   contactStarted:contact.started,contactActive:contact.active,
   playerFrame,ballPosition:ballBody.translation(),
   ballVelocity:ballBody.linvel(),ballRadiusM,lastActionTick,
   allowPhysicalCarry,isolatedDribbleContext
  };
  const gates=inspectPhysicalActionRejection(input);
  // When the private B06b match is PAUSED for a real referee-issued
  // restart, advance this same original executor's tick but do not
  // apply an unrelated uniform impulse over the authentic kickoff.
  // Solo Carry has two REAL native collider sources. The actor-level START
  // is insufficient for an impulse when both shoes touch simultaneously:
  // require one (and only one) actual native foot START and active shoe.
  const solo=isolatedDribbleContext?.situationId==='carry-solo';
  const isolatedNativeShoeSourceValid=!solo||(
   contact.nativeSoloFeet?.actorId===isolatedDribbleContext.attackingSide+'-10'&&
   contact.nativeSoloFeet?.independentColliders===2&&
   contact.nativeSoloFeet?.exclusivePhysicalStart===true);
  const originalChoice=suppressOriginalAction||suppressPhysicalBodyContact||
   !isolatedNativeShoeSourceValid?null:
   selectUniformAutonomousContactAction({...input,activePlayerIds,
    smallSidedDecisionContext,isolatedDribbleContext});
  let researchCandidate=null;
  const side=researchReceivingCushionSide;
  const receiverId=side===null?null:side+'-9';
  if(side!==null){
   const opposite=side==='home'?'away':'home';
   // An earlier real shoe touch by ANY other player interrupts the original
   // physical pass before this receiver may try a first-touch cushion.
   if(actualPriorPass&&nextTick>actualPriorPass.tick&&
      contact.started.some(id=>id!==receiverId))
    interrupted=true;
   if(actualPriorPass&&!interrupted&&!firstCushion&&
      nextTick>actualPriorPass.tick&&
      contact.started.length===1&&contact.active.length===1&&
      contact.started[0]===receiverId&&
      contact.active[0]===receiverId&&
      (originalChoice===null||originalChoice.playerId===receiverId)){
    const p=playerFrame?.players?.find(x=>x.id===receiverId);
    const opponents=playerFrame?.players?.filter(x=>x.team===opposite);
    if(!p||p.team!==side||!Array.isArray(opponents)||
       opponents.length!==11||![p.x,p.y,p.vx,p.vy].every(Number.isFinite)||
       opponents.some(x=>![x.x,x.y].every(Number.isFinite)))
     throw new TypeError('M25 requires original 22-player current source');
    const position=ballBody.translation(),velocity=ballBody.linvel();
    researchCandidate=calculateRealReceivingCushion({
     ballVelocity:velocity,playerVelocity:p,
     ballCentreZ:position.z,ballRadiusM,
     realBallPlayerGapM:Math.hypot(position.x-p.x,position.y-p.y),
     nearestOpponentM:Math.min(...opponents.map(x=>
      Math.hypot(x.x-p.x,x.y-p.y)))
    });
   }
  }
  // M27 is triggered ONLY on an existing genuine second shoe START with
  // an existing original clearance selected by the unchanged policy.
  // It changes whether to APPLY that impulse; never manufactures one.
  if(researchReceivingDecisionSide===side&&
     firstCushion&&!firstReceiverChoice&&
     nextTick>firstCushion.tick&&
     originalChoice?.action==='clearance'&&
     originalChoice.playerId===receiverId&&
     contact.started.length===1&&contact.active.length===1&&
     contact.started[0]===receiverId&&contact.active[0]===receiverId){
   const receiver=playerFrame?.players?.find(p=>p.id===receiverId);
   const opposition=playerFrame?.players?.filter(p=>p.team!==side);
   firstReceiverChoice=choosePhysicalReceiverSecondTouch({
    tick:nextTick,actorId:receiverId,originalChoice,
    realNativeStarts:contact.started,realNativeActive:contact.active,
    ballPosition:ballBody.translation(),ballVelocity:ballBody.linvel(),
    receiver,realOpponents:opposition,verifiedEarlierCushion:firstCushion
   });
  }
  const deferOriginal=firstReceiverChoice?.tick===nextTick&&
   firstReceiverChoice.decision==='defer-clearance-to-keep-ball-near';
  // M30 exclusively uses this real second Rapier START after M27 defers.
  const tapCandidate=researchReceiverTapSide===side&&deferOriginal?
   calculatePhysicalReceiverReleaseTap({
    choice:firstReceiverChoice,earlierCushion:firstCushion,
    nativeStarts:contact.started,nativeActive:contact.active,
    ballPosition:ballBody.translation(),ballVelocity:ballBody.linvel(),
    receiver:playerFrame?.players?.find(p=>p.id===receiverId),
    opponents:playerFrame?.players?.filter(p=>p.team!==side),
    ballRadiusM
   }):null;
  // M25 preempts same-tick action for cushioning. M27 may instead
  // defer an ORIGINAL second-touch clearance with zero additional impulse.
  const chosen=researchCandidate||deferOriginal?null:originalChoice;
  if(chosen&&(!gates.passedInputGates||
     gates.actorId!==chosen.playerId||
     !contact.started.includes(chosen.playerId)||
     contact.started.length!==1||contact.active.length!==1||
     contact.active[0]!==chosen.playerId))
   throw new Error('Rapier exclusive START and original action gates disagree');
  const currentAudit=Object.freeze({
   ...gates,actionSelected:chosen!==null,
   noActionReason:chosen?null:suppressPhysicalBodyContact?
    'small-sided-native-body-ball-contact-no-extra-shoe-impulse':
    suppressOriginalAction?
    'b06b-referee-physical-dead-ball-original-action-suppressed':
    !isolatedNativeShoeSourceValid?'solo-ambiguous-real-foot-contact':researchCandidate?
    'experimental-receiving-cushion-preempts-uniform-action':
    deferOriginal?'m27-native-decision-defers-original-clearance':
    (gates.firstFailedGate??'not-selected-after-input-gates')
  });
  let applied=null;
  if(chosen){
   // The only new physics write; same body and SAME post-collision tick
   // as the original #481, never a future/replayed intent.
   ballBody.applyImpulse(chosen.impulseNs,true);
   applied=Object.freeze({
    ...chosen,appliedByRapier:true,
    actionSource:'internal-uniform-22-player-ai',
    actualPhysicsImpulseApplied:true
   });
   lastActionTick=nextTick;
  }
  if(side!==null){
   if(researchCandidate!==null){
    const before=Object.freeze({...ballBody.linvel()});
    // Exactly one bounded REAL counter-impulse on existing Rapier ball.
    // Original uniform response was not applied this tick.
    ballBody.applyImpulse(researchCandidate.impulseNs,true);
    firstCushion=Object.freeze({
     version:'m25-research-first-touch-impulse-v1',
     tick:nextTick,actorId:receiverId,team:side,
     originalPassTick:actualPriorPass.tick,
     originalPassActorId:actualPriorPass.playerId,
     nativeExclusiveShoeStart:true,originalRapierBallBody:true,
     uniformActionSuppressedForSameRealContact:originalChoice!==null,
     actualPhysicsImpulseApplied:true,...researchCandidate,
     realPreBallVelocity:before,
     realPostBallVelocity:Object.freeze({...ballBody.linvel()}),
     officialMatchAction:false,officialPossession:false,
     verifiedReception:false,verifiedBallControl:false
    });
   }
   if(applied?.action==='pass'&&applied.team===side&&
      applied.playerId===side+'-10'&&
      applied.passTarget?.recipientId===receiverId&&!actualPriorPass)
    actualPriorPass=Object.freeze({tick:nextTick,playerId:applied.playerId});
  }
  if(tapCandidate){
   if(applied!==null||researchCandidate!==null||firstReceiverTap||
      !deferOriginal||!gates.passedInputGates||
      gates.actorId!==receiverId)
    throw new TypeError('M30 cannot double-apply an original physical action');
   const before=Object.freeze({...ballBody.linvel()});
   ballBody.applyImpulse(tapCandidate.impulseNs,true);
   const after=Object.freeze({...ballBody.linvel()});
   firstReceiverTap=Object.freeze({
    version:'m30-research-native-release-tap-v1',
    tick:nextTick,originalDecisionTick:firstReceiverChoice.tick,
    actorId:receiverId,team:side,priorCushionTick:firstCushion.tick,
    nativeExclusiveShoeStart:true,actualPhysicsImpulseApplied:true,
    originalClearanceSuppressed:true,...tapCandidate,
    impulseMagnitudeNs:Math.hypot(
     tapCandidate.impulseNs.x,tapCandidate.impulseNs.y),
    realPreBallVelocity:before,realPostBallVelocity:after,
    officialMatchAction:false,verifiedReception:false,
    verifiedControl:false,officialPossession:false,matchAuthority:false
   });
  }
  tick=nextTick;action=applied;audit=currentAudit;
  return Object.freeze({tick,action,audit});
 }
 return Object.freeze({
  apply,
  actionSnapshot:()=>{ensureOpen();return action;},
  rejectionSnapshot:()=>{ensureOpen();return audit;},
  cushionSnapshot:()=>{ensureOpen();return firstCushion;},
  receiverChoiceSnapshot:()=>{ensureOpen();return firstReceiverChoice;},
  receiverTapSnapshot:()=>{ensureOpen();return firstReceiverTap;},
  dispose:()=>{closed=true;}
 });
}
