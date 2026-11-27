// Extracted #481 A4.2b.1 physical impulse boundary.
// A private, opt-in adapter for the SAME Rapier ball body and canonical
// 22-shoe event source. No world, policy/mover override or official results.
import {inspectPhysicalActionRejection,selectUniformAutonomousContactAction,
 UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS}
 from './player-ball-uniform-autonomous-action.mjs';
import {FOOT_CONTACT_VERSION,footProxyTransform} from './player-foot-contact.mjs';
import {chooseIntentSoloCarryTouch} from './intent-driven-solo-carry.mjs';
import {chooseNativeFixedCarryImpulse}
 from './native-fixed-carry-impulse.mjs';
import {calculateRealReceivingCushion,calculateOrientedReceivingCushion,calculateLowCrossSpinCushion,CURRENT_LAB_DYNAMICS_VERSION}
 from './physical-receiving-cushion-m25.mjs';
import {calculateCurrentLabShotCalibration,LAB_SHOT_PROFILES} from './lab-shot-calibration.mjs';
import {choosePhysicalReceiverSecondTouch}
 from './physical-receiver-choice-m27.mjs';
import {calculatePhysicalReceiverReleaseTap} from './physical-receiver-tap-m30.mjs';

export const PRIVATE_PHYSICAL_ACTION_EXECUTOR_VERSION=
 'me-action-foundation-real-shoe-impulse-v1';

// UME-05E: an experiment may restrict an existing decision, never create
// one. The restriction is generic actor/action/recipient/trajectory data;
// it neither knows a fixture ID nor grants native contact authority.
export function createNativeActionRestriction({action,actorId,recipientId=null,vertical='any',maxActions=1}={}){
 if(!['pass','cross','shot'].includes(action)||
    typeof actorId!=='string'||!actorId||
    !(recipientId===null||typeof recipientId==='string'&&recipientId&&recipientId!==actorId)||
    (action==='shot'?recipientId!==null:recipientId===null)||
    !['any','ground','lofted'].includes(vertical)||maxActions!==1)
  throw new TypeError('Bounded single native action restriction required');
 return Object.freeze({action,actorId,recipientId,vertical,maxActions});
}
export function evaluateNativeActionRestriction(restriction,choice,appliedActions){
 if(restriction===null)return true;
 if(!Number.isSafeInteger(appliedActions)||appliedActions<0||appliedActions>=restriction.maxActions||
    !choice||choice.action!==restriction.action||choice.playerId!==restriction.actorId)return false;
 if(restriction.recipientId!==null){
  const target=choice.action==='pass'?choice.passTarget:choice.crossTarget;
  if(target?.recipientId!==restriction.recipientId)return false;
 }
 if(restriction.vertical==='ground'&&choice.impulseNs?.z!==0)return false;
 if(restriction.vertical==='lofted'&&!(choice.impulseNs?.z>0))return false;
 return true;
}
export function createPrivatePhysicalActionExecutor({
 ballBody,shoeBridge,ballRadiusM,allowPhysicalCarry=false,
 researchReceivingCushionSide=null,researchReceivingDecisionSide=null,
 researchReceiverTapSide=null,activePlayerIds=null,
 smallSidedDecisionContext=null,isolatedDribbleContext=null,isolatedPassSide=null,interceptionPassSide=null,isolatedCrossSide=null,isolatedShotSide=null,isolatedShotProfile='power',firstTimeShot=false,
 physicalBodyGuardEnabled=false,intentDrivenSoloCarry=false,keeperSingleShotSide=null,blockShotSide=null,
 nativeFixedCarryResearch=false,nativeFixedSprintLongStride=false,latestLabDynamics=false,nativeActionPolicy=false
}={}){
 if(typeof nativeActionPolicy!=='boolean'||(nativeActionPolicy&&(!allowPhysicalCarry||!physicalBodyGuardEnabled||!Array.isArray(activePlayerIds)||smallSidedDecisionContext!==null||isolatedDribbleContext!==null||isolatedPassSide!==null||isolatedCrossSide!==null||isolatedShotSide!==null||keeperSingleShotSide!==null||blockShotSide!==null||interceptionPassSide!==null||researchReceivingCushionSide!==null||researchReceivingDecisionSide!==null||researchReceiverTapSide!==null)))throw new TypeError('Native action policy requires guarded physical participants without isolated overrides');
 if(typeof nativeFixedSprintLongStride!=='boolean'||
     (nativeFixedSprintLongStride&&!nativeFixedCarryResearch))
  throw new TypeError('Long stride requires isolated real-shoe calibration');
 if(typeof nativeFixedCarryResearch!=='boolean'||
    (nativeFixedCarryResearch&&(
     intentDrivenSoloCarry||
     isolatedDribbleContext?.situationId!=='carry-solo'||
     physicalBodyGuardEnabled)))
  throw new TypeError('Native fixed Carry is limited to genuine isolated shoe input');
 if(typeof intentDrivenSoloCarry!=='boolean'||
    (intentDrivenSoloCarry&&(
     isolatedDribbleContext?.situationId!=='carry-solo'||
     physicalBodyGuardEnabled||researchReceivingCushionSide!==null||
     researchReceivingDecisionSide!==null||researchReceiverTapSide!==null)))
  throw new TypeError('Intent gameplay touch is exclusive to unopposed DEV Carry Solo');
 if(activePlayerIds!==null&&(!Array.isArray(activePlayerIds)||
    activePlayerIds.length<1||(activePlayerIds.length>7&&!(nativeActionPolicy&&activePlayerIds.length===22))||
    new Set(activePlayerIds).size!==activePlayerIds.length))
  throw new TypeError('Small-sided active physical shoe set is invalid');
 if(interceptionPassSide!==null&&(!['home','away'].includes(interceptionPassSide)||activePlayerIds?.length!==3||
   !activePlayerIds.includes(interceptionPassSide+'-10')||!activePlayerIds.includes(interceptionPassSide+'-9')||
   !activePlayerIds.includes((interceptionPassSide==='home'?'away':'home')+'-2')||isolatedPassSide!==null||isolatedCrossSide!==null||isolatedShotSide!==null||isolatedDribbleContext!==null||smallSidedDecisionContext!==null||allowPhysicalCarry||physicalBodyGuardEnabled||researchReceivingCushionSide!==null||researchReceivingDecisionSide!==null||researchReceiverTapSide!==null))throw new TypeError('Interception pass requires exactly two teammates and one opponent');
 if(isolatedPassSide!==null&&(
    !['home','away'].includes(isolatedPassSide)||
    activePlayerIds?.length!==2||
    !activePlayerIds.includes(isolatedPassSide+'-10')||
    !activePlayerIds.includes(isolatedPassSide+'-9')||
    allowPhysicalCarry||smallSidedDecisionContext!==null||
    isolatedDribbleContext!==null||researchReceivingCushionSide!==null||
    researchReceivingDecisionSide!==null||researchReceiverTapSide!==null))
  throw new TypeError('Isolated pass requires exactly two original teammates');
 if(typeof firstTimeShot!=='boolean'||(firstTimeShot&&isolatedShotSide===null))
  throw new TypeError('First-time shot requires native isolated shooter');
 if(!LAB_SHOT_PROFILES.includes(isolatedShotProfile)||(isolatedShotProfile!=='power'&&isolatedShotSide===null))
  throw new TypeError('Locked shot profile requires isolated native shooter');
 if(isolatedShotSide!==null&&(
    !['home','away'].includes(isolatedShotSide)||activePlayerIds?.length!==1||
    !activePlayerIds.includes(isolatedShotSide+'-10')||isolatedPassSide!==null||
    isolatedCrossSide!==null||allowPhysicalCarry||smallSidedDecisionContext!==null||
    isolatedDribbleContext!==null||researchReceivingCushionSide!==null||
    researchReceivingDecisionSide!==null||researchReceiverTapSide!==null||physicalBodyGuardEnabled))
  throw new TypeError('Isolated shot requires one original shooter and no opponents');
 if(isolatedCrossSide!==null&&(
    !['home','away'].includes(isolatedCrossSide)||activePlayerIds?.length!==2||
    !activePlayerIds.includes(isolatedCrossSide+'-10')||
    !activePlayerIds.includes(isolatedCrossSide+'-9')||
    isolatedPassSide!==null||allowPhysicalCarry||smallSidedDecisionContext!==null||
    isolatedDribbleContext!==null||researchReceivingCushionSide!==null||
    researchReceivingDecisionSide!==null||researchReceiverTapSide!==null||
    physicalBodyGuardEnabled))
  throw new TypeError('Isolated cross requires exactly two original teammates');
 if(blockShotSide!==null&&(!['home','away'].includes(blockShotSide)||!physicalBodyGuardEnabled||activePlayerIds?.length!==3||!activePlayerIds.includes(blockShotSide+'-10')||!activePlayerIds.includes((blockShotSide==='home'?'away':'home')+'-2')||!activePlayerIds.includes((blockShotSide==='home'?'away':'home')+'-1')||keeperSingleShotSide!==null||isolatedPassSide!==null||interceptionPassSide!==null||isolatedDribbleContext!==null||smallSidedDecisionContext!==null||isolatedShotSide!==null||isolatedCrossSide!==null))throw new TypeError('Block exercise requires original guarded shooter, defender and keeper');
 if(keeperSingleShotSide!==null&&(!['home','away'].includes(keeperSingleShotSide)||
    !physicalBodyGuardEnabled||activePlayerIds?.length!==2||!activePlayerIds.includes(keeperSingleShotSide+'-10')||
    !activePlayerIds.includes((keeperSingleShotSide==='home'?'away':'home')+'-1')))
  throw new TypeError('Directed keeper duel requires original guarded 1v1 actors');
 if(typeof physicalBodyGuardEnabled!=='boolean'||
    (physicalBodyGuardEnabled&&activePlayerIds===null))
  throw new TypeError('Native body contact requires genuine small-sided shoe source');
 if(smallSidedDecisionContext!==null&&(
    activePlayerIds===null||allowPhysicalCarry!==true||
    typeof smallSidedDecisionContext!=='object'||
    !['home','away'].includes(smallSidedDecisionContext.attackingSide)||
    typeof smallSidedDecisionContext.situationId!=='string'||
    !Number.isSafeInteger(smallSidedDecisionContext.variantIndex)||
    smallSidedDecisionContext.variantIndex<1||smallSidedDecisionContext.collective!==undefined||
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
 // Legacy fixture options are validated above and translated once into
 // a common constraint. Calibration, receiving cushion, and the original
 // exclusive physical impulse gate remain shared and unchanged.
 const restriction=isolatedPassSide!==null?createNativeActionRestriction({action:'pass',actorId:isolatedPassSide+'-10',recipientId:isolatedPassSide+'-9',vertical:'ground'}):
  isolatedCrossSide!==null?createNativeActionRestriction({action:'cross',actorId:isolatedCrossSide+'-10',recipientId:isolatedCrossSide+'-9',vertical:'lofted'}):
  isolatedShotSide!==null?createNativeActionRestriction({action:'shot',actorId:isolatedShotSide+'-10'}):null;
 let tick=0,lastActionTick=-UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS;
 let action=null,audit=null,closed=false;
 let actualPriorPass=null,interrupted=false,firstCushion=null;
 if(typeof latestLabDynamics!=='boolean')throw new TypeError('Boolean current LAB dynamics required');
 const sharedDynamics=latestLabDynamics||interceptionPassSide!==null||isolatedPassSide!==null||isolatedCrossSide!==null||isolatedShotSide!==null;
 let pendingDelivery=null,latestCushion=null,interceptionPhase='ready',blockShotTaken=false;
 let firstReceiverChoice=null,firstReceiverTap=null;
 const ensureOpen=()=>{if(closed)throw new Error('Physical action executor disposed');};
 function apply(nextTick,playerFrame,{
  suppressOriginalAction=false,suppressPhysicalBodyContact=false,priorNativeBallVelocity=null,duelTransition=null,collectiveControl=null,keeperDistribution=null
 }={}){
  ensureOpen();
  if(firstTimeShot&&(!priorNativeBallVelocity||!['x','y','z'].every(k=>Number.isFinite(priorNativeBallVelocity[k]))))
   throw new TypeError('First-time shot requires real pre-step velocity');
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
    smallSidedDecisionContext,isolatedDribbleContext,keeperSingleShotSide,duelTransition,collectiveControl,nativeActionPolicy,
    interceptionContext:interceptionPassSide===null?null:{side:interceptionPassSide,phase:interceptionPhase},
    blockContext:blockShotSide===null?null:{side:blockShotSide,shotTaken:blockShotTaken}});
  let orientedCandidate=null,orientedDelivery=null;
  if(sharedDynamics&&pendingDelivery&&nextTick>pendingDelivery.tick){
   const d=pendingDelivery,pos=ballBody.translation(),v=ballBody.linvel();
   const eligible=d.kind==='pass'||(d.airborne&&d.descending);
   if(contact.started.length){
    // First subsequent native contact consumes the delivery, even an
    // interruption or ambiguous contact. No later assisted trap.
    pendingDelivery=null;
    if(eligible&&!suppressOriginalAction&&!suppressPhysicalBodyContact&&
       contact.started.length===1&&contact.active.length===1&&
       contact.started[0]===d.recipientId&&contact.active[0]===d.recipientId){
     const p=playerFrame.players.find(x=>x.id===d.recipientId);
     const opponents=playerFrame.players.filter(x=>x.team!==p.team&&
      (activePlayerIds===null||activePlayerIds.includes(x.id)));
     orientedCandidate=calculateOrientedReceivingCushion({
      ballVelocity:v,playerVelocity:{x:p.vx,y:p.vy},ballCentreZ:pos.z,
      ballRadiusM,ballMassKg:ballBody.mass(),
      realBallPlayerGapM:Math.hypot(pos.x-p.x,pos.y-p.y),
      ballPosition:pos,receiverPosition:p,shoePosition:footProxyTransform(p),
      attackingSide:p.team,deliveryKind:d.kind,opponents
     });
     if(orientedCandidate)orientedDelivery=d;
    }
   }else{
    d.airborne=d.airborne||pos.z-ballRadiusM>0.20;
    d.descending=d.descending||(d.airborne&&v.z<0);
   }
  }
  let researchCandidate=null;
  const side=researchReceivingCushionSide;
  const receiverId=side===null?null:side+'-9';
  if(side!==null&&!sharedDynamics){
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
  if(!orientedCandidate&&researchReceivingDecisionSide===side&&
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
  // Filter existing action authority; never invent a contact or impulse.
  const restrictionRejected=!evaluateNativeActionRestriction(restriction,originalChoice,lastActionTick>=0?1:0);
  const originalChosen=orientedCandidate||researchCandidate||deferOriginal||restrictionRejected?null:originalChoice;
  // The *existing* uniform policy and Rapier exclusive shoe START remain
  // the only action authority. Native phase calibration can adjust that
  // action's impulse or decline it, never generate an extra contact/action.
  const nativeTune=nativeFixedCarryResearch&&originalChosen?.action==='carry'?
   chooseNativeFixedCarryImpulse({
    phase:playerFrame.soloCarryPhase?.lockedPhase,
    playerAttributes:playerFrame.soloCarryPhase?.carryPlayerAttributes,
    player:playerFrame.players.find(p=>p.id===originalChosen.playerId),
    attackingSide:isolatedDribbleContext.attackingSide,
    ballVelocity:ballBody.linvel(),
    verifiedNativeExclusiveShoeStart:
     contact.nativeSoloFeet?.exclusivePhysicalStart===true,
    contactActorId:contact.started[0],
    nativeFixedSprintLongStride
   }):null;
  const chosen=nativeTune?.impulseNs===null?null:originalChosen;
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
    !isolatedNativeShoeSourceValid?'solo-ambiguous-real-foot-contact':orientedCandidate?
    'current-lab-oriented-first-touch-preempts-uniform-action':researchCandidate?
    'experimental-receiving-cushion-preempts-uniform-action':
    deferOriginal?'m27-native-decision-defers-original-clearance':
    restrictionRejected?(restriction.action==='pass'?'isolated-pass-one-original-ground-pass-only':
     restriction.action==='cross'?'isolated-cross-one-original-lofted-cross-only':'isolated-shot-one-original-shot-only'):
    nativeTune?.impulseNs===null?
     'native-shoe-contact-no-extra-ball-impulse-needed':
    (gates.firstFailedGate??'not-selected-after-input-gates')
  });
  let applied=null;
  if(chosen){
   // The only new physics write; same body and SAME post-collision tick
   // as the original #481, never a future/replayed intent.
   // PASS-01 DEV-only pace candidate after owner visual QA. The prior
   // arrival times 1.77/2.37/3.45s at 6/12/20m were too conservative.
   // Use a simple continuous distance-based boost, bounded even outside
   // the three staged distances. Direction, native START, ground/ball
   // properties and simulation clock are unchanged. This is provisional.
   const passCalibration=sharedDynamics&&chosen.action==='pass'&&chosen.passTarget?Object.freeze({
    source:'isolated-ground-pass-distance-candidate-v3',
    distanceM:chosen.passTarget.distanceM,
    scale:Math.max(1.25,Math.min(3.30,1.25+0.10*chosen.passTarget.distanceM)),
    originalImpulseNs:chosen.impulseNs,
    officialMatchAction:false
   }):null;
   // CROSS-01: preserve M33 direction and loft; ideal range estimates
   // only the initial impulse. Never steer or teleport the live ball.
   const crossCalibration=sharedDynamics&&chosen.action==='cross'&&chosen.crossTarget?(()=>{
    const i=chosen.impulseNs,horizontal=Math.hypot(i.x,i.y);
    const desiredHorizontal=Math.sqrt(9.81*chosen.crossTarget.distanceM/(2*i.z/horizontal));
    return Object.freeze({source:'isolated-cross-range-candidate-v1',
     distanceM:chosen.crossTarget.distanceM,originalImpulseNs:i,
     scale:Math.max(1,Math.min(3.8,ballBody.mass()*desiredHorizontal/horizontal)),
     officialMatchAction:false});
   })():null;
   const shotCalibration=sharedDynamics&&chosen.action==='shot'&&chosen.shotTarget?
     calculateCurrentLabShotCalibration({target:chosen.shotTarget,position:ballBody.translation(),
      velocity:ballBody.linvel(),massKg:ballBody.mass(),ballRadiusM,originalImpulseNs:chosen.impulseNs,
       profile:blockShotSide===chosen.team?'low':isolatedShotProfile,
       ...(keeperSingleShotSide===chosen.team&&chosen.shotTarget.keeperDuelMinimumLaneClearanceM!==undefined?
        {minimumPowerLaneClearanceM:chosen.shotTarget.keeperDuelMinimumLaneClearanceM}:{}),
       opponents:playerFrame.players.filter(p=>p.team!==chosen.team&&
         (activePlayerIds===null||activePlayerIds.includes(p.id))&&
         (blockShotSide!==chosen.team||p.role==='goalkeeper'))}):null;
    if(isolatedShotProfile==='tap-in'&&!shotCalibration)throw new Error('Tap-in contact outside calibrated low finishing envelope');
     const impulse=shotCalibration?shotCalibration.impulseNs:crossCalibration?Object.freeze({
    x:chosen.impulseNs.x*crossCalibration.scale,
    y:chosen.impulseNs.y*crossCalibration.scale,
    z:chosen.impulseNs.z*crossCalibration.scale
   }):passCalibration?Object.freeze({
    x:chosen.impulseNs.x*passCalibration.scale,
    y:chosen.impulseNs.y*passCalibration.scale,z:0
   }):nativeTune?.impulseNs??chosen.impulseNs;
   ballBody.applyImpulse(impulse,true);
   let shotSpin=null;
   if(shotCalibration?.targetAngularVelocity){
    const before=ballBody.angvel(),inertia=ballBody.principalInertia(),target=shotCalibration.targetAngularVelocity;
    const torque={x:(target.x-before.x)*inertia.x,y:(target.y-before.y)*inertia.y,z:(target.z-before.z)*inertia.z};
    const norm=Math.hypot(...Object.values(torque)),limit=shotCalibration.profile==='low'?1.2:shotCalibration.profile==='tap-in'?0.40:0.25;
    const scale=norm>limit?limit/norm:1;
    const torqueImpulseNms=Object.freeze({x:torque.x*scale,y:torque.y*scale,z:torque.z*scale});
    ballBody.applyTorqueImpulse(torqueImpulseNms,true);
    shotSpin=Object.freeze({torqueImpulseNms,angularVelocity:Object.freeze({...ballBody.angvel()}),nativeContactOnly:true});
   }
   applied=Object.freeze({
    ...chosen,
    impulseNs:impulse,
    ...(passCalibration?{isolatedGroundPassCalibration:passCalibration}:{}),
    ...(crossCalibration?{isolatedCrossCalibration:crossCalibration}:{}),
    ...(shotCalibration?{labShotCalibration:shotCalibration,labShotSpin:shotSpin}:{}),
     ...(firstTimeShot&&shotCalibration?{firstTimeShotEvidence:Object.freeze({
      source:'first-time-native-shoe-v1',priorNativeBallVelocity:Object.freeze({...priorNativeBallVelocity}),
      postSolverVelocity:shotCalibration.preImpulseVelocity,
      appliedImpulseNs:impulse,postStrikeVelocity:Object.freeze({...ballBody.linvel()}),
      ballMassKg:ballBody.mass(),nativeExclusiveShoeStart:true,officialGoal:false
     })}:{}),
    ...(nativeTune?{
     nativeShoeContactVerified:true,
     nativeFixedPhaseCalibration:nativeTune,
     originalNativeActionImpulseNs:chosen.impulseNs,
     carryTarget:Object.freeze({
      ...chosen.carryTarget,
      source:'original-real-shoe-phase-calibrated-impulse',
      impulseMagnitudeNs:Math.hypot(impulse.x,impulse.y,impulse.z),
      nativeShoeContactVerified:true
     }),
     decisionContext:Object.freeze({
      ...chosen.decisionContext,
      nativeRealShoeVerified:true,
      nativeFixedPhaseResearch:playerFrame.soloCarryPhase.lockedPhase,
      noSyntheticContact:true,
      officialMatchAction:false
     })
    }:{}),
    appliedByRapier:true,
    actionSource:nativeTune?
     'native-original-shoe-start-phase-calibration':
     'internal-uniform-22-player-ai',
    actualPhysicsImpulseApplied:true
   });
   lastActionTick=nextTick;
  }
  if(orientedCandidate){
   const d=orientedDelivery,before=Object.freeze({...ballBody.linvel()});
   const preSpin=Object.freeze({...ballBody.angvel()});
   ballBody.applyImpulse(orientedCandidate.impulseNs,true);
   const spinCushion=calculateLowCrossSpinCushion({
    angularVelocity:preSpin,principalInertia:ballBody.principalInertia(),
    ballRadiusM,linearImpulseNs:Math.hypot(...Object.values(orientedCandidate.impulseNs)),
    outgoingVelocity:ballBody.linvel()
   });
   if(spinCushion)ballBody.applyTorqueImpulse(spinCushion.torqueImpulseNms,true);
   latestCushion=Object.freeze({...orientedCandidate,
    version:CURRENT_LAB_DYNAMICS_VERSION,tick:nextTick,actorId:d.recipientId,team:d.team,
    ...(d.kind==='pass'?{originalPassTick:d.tick,originalPassActorId:d.actorId}:
     {originalCrossTick:d.tick,originalCrossActorId:d.actorId}),
    spinCushion,realPreAngularVelocity:preSpin,realPostAngularVelocity:Object.freeze({...ballBody.angvel()}),
    nativeExclusiveShoeStart:true,originalRapierBallBody:true,
    actualPhysicsImpulseApplied:true,realPreBallVelocity:before,
    realPostBallVelocity:Object.freeze({...ballBody.linvel()}),
    officialMatchAction:false,officialPossession:false,
    verifiedReception:false,verifiedBallControl:false});
   if(!firstCushion&&(isolatedPassSide!==null||isolatedCrossSide!==null||
      (side===d.team&&d.kind==='pass'&&d.actorId===side+'-10'&&d.recipientId===side+'-9')))
    firstCushion=latestCushion;
  }
  if(sharedDynamics&&applied&&['pass','cross'].includes(applied.action)){
   const target=applied.action==='pass'?applied.passTarget:applied.crossTarget;
   if(target?.recipientId)pendingDelivery={kind:applied.action,tick:nextTick,
    actorId:applied.playerId,recipientId:target.recipientId,team:applied.team,
    airborne:false,descending:false};
  }
  if(keeperDistribution!==null){
   const d=keeperDistribution;
   const actor=playerFrame.players.find(p=>p.id===d.keeperId&&p.role==='goalkeeper'&&p.team===d.team);
   if(!nativeActionPolicy||!suppressPhysicalBodyContact||applied||d.tick!==nextTick||d.appliedByRapier!==true||d.actualPhysicsImpulseApplied!==true||d.nativeGripReleased!==true||!actor||!activePlayerIds.includes(actor.id)||collectiveControl?.keeperHold?.keeperId!==actor.id||collectiveControl.keeperHold.confirmedTick!==d.confirmedGripTick)throw new TypeError('Current confirmed native keeper release required');
   pendingDelivery=null;
   if(d.kind==='pass'&&playerFrame.players.some(p=>p.id===d.recipientId&&p.team===actor.team&&activePlayerIds.includes(p.id)&&p.id!==actor.id))
    pendingDelivery={kind:'pass',tick:nextTick,actorId:actor.id,recipientId:d.recipientId,team:actor.team,airborne:true,descending:false,source:'native-keeper-grip-release'};
  }
  if(side!==null&&!sharedDynamics){
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
  if(blockShotSide!==null&&applied?.action==='shot')blockShotTaken=true;
  if(interceptionPassSide!==null){
   if(applied?.action==='pass'&&interceptionPhase==='ready')interceptionPhase='flight';
   else if(applied?.action==='interception'&&interceptionPhase==='flight')interceptionPhase='intercepted';
   else if(applied?.action==='carry'&&interceptionPhase==='intercepted')interceptionPhase='collected';
   else if(interceptionPhase==='flight'&&contact.started.includes(interceptionPassSide+'-9'))interceptionPhase='received';
  }
  tick=nextTick;action=applied;audit=currentAudit;
  return Object.freeze({tick,action,audit});
 }
 return Object.freeze({
  apply,
  actionSnapshot:()=>{ensureOpen();return action;},
  rejectionSnapshot:()=>{ensureOpen();return audit;},
  cushionSnapshot:()=>{ensureOpen();return firstCushion;},
  latestReceptionSnapshot:()=>{ensureOpen();return latestCushion;},
  receiverChoiceSnapshot:()=>{ensureOpen();return firstReceiverChoice;},
  receiverTapSnapshot:()=>{ensureOpen();return firstReceiverTap;},
  dispose:()=>{closed=true;}
 });
}
