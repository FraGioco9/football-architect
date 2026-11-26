// #628 Phase M2 — read-only evidence from the one canonical 22-player
// kinematic mover and the one accepted Rapier ball world. The movement
// runner explicitly disables foot colliders, physical action authority and
// official match mutations. Do not infer a tackle/touch from proximity.
import {createEngine,FIXED_DT} from './core.mjs';
import {createControlledActionLab} from './action-labs.mjs';
import {createPlayerMovement,PLAYER_MIN_SEPARATION_M} from './player-movement.mjs';
import {drawPitchMarkings} from './pitch-markings.mjs';
import {createNaturalMovementResearchLab}
 from './natural-movement-research-lab-m21.mjs';
import {MOVEMENT_LAB_SCENARIOS,movementLabScenario} from './movement-lab-scenarios.mjs';
const two=n=>n.toFixed(2);
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const encounterOrOff=id=>['body-encounter','body-encounter-off',
 'shared-contacts','shared-contacts-off'].includes(id);
const pressureSceneLabel=id=>id==='pressure-support'||id==='pressure-neutral';
const opposingConvergenceLabel=id=>id==='opposing-convergence'||
 id==='opposing-convergence-off';
const opposingFeedbackLabel=id=>id==='opposing-feedback'||
 id==='opposing-feedback-off';

export function createControlledMovementLab(RAPIER,id,{side='home'}={}){
 if(!RAPIER||typeof RAPIER.World!=='function')
  throw new TypeError('Rapier required for movement LAB');
 const scene=movementLabScenario(id,side);
 if(scene.spec.naturalSource===true)
  return createNaturalMovementResearchLab(RAPIER,scene);
 const postPass=scene.spec.id==='post-pass';
 const physicalContest=scene.spec.id==='opponent-contact';
 const usesOriginalControl=postPass||physicalContest;
 // Both controlled options delegate to the exact original authentic
 // Rapier CONTROL world. No duplicate shoe bridge or autonomous policy.
 const actionSession=usesOriginalControl?
  createControlledActionLab(RAPIER,'control',{
   // Archived M4/M5 measurement of the original pass, not current gameplay.
   historicalEvidenceBaseline:true,
   controlSide:side,
   ...(physicalContest?{controlScene:'opponent-first'}:{})
  }):null;
 // M10 keeps the ordinary 22-player lineup and original autonomous
 // support/press assignments. No scripted player encounter or target.
 const pressureScene=scene.spec.id==='pressure-support'||
  scene.spec.id==='pressure-neutral';
 const opposingConvergence=scene.spec.id==='opposing-convergence';
 const opposingConvergenceOff=scene.spec.id==='opposing-convergence-off';
 const opposingConvergenceScene=opposingConvergence||opposingConvergenceOff;
 const opposingFeedback=scene.spec.id==='opposing-feedback';
 const opposingFeedbackOff=scene.spec.id==='opposing-feedback-off';
 const opposingFeedbackScene=opposingFeedback||opposingFeedbackOff;
 const sharedContacts=scene.spec.id==='shared-contacts'||
  pressureScene||opposingConvergenceScene||opposingFeedbackScene;
 const sharedOff=scene.spec.id==='shared-contacts-off';
 // M9 alone stages its controlled encounter; M10 only shares the
 // authentic event queue and NEVER opts into fixture player positions.
 const encounter=scene.spec.id==='body-encounter'||
  scene.spec.id==='body-encounter-off'||
  scene.spec.id==='shared-contacts'||sharedOff;
 const nativeBodies=scene.spec.id==='body-world'||
  scene.spec.id==='body-encounter'||sharedContacts;
 const engine=usesOriginalControl?null:createEngine(RAPIER,scene.initial,
  nativeBodies?{
   diagnosticPlayerBodyCollidersEnabled:true,
   ...(encounter?{diagnosticResearchBodyEncounter:true}:{}),
   ...(opposingFeedback?{diagnosticUnstagedBodyFeedbackEnabled:true}:{}),
   ...(sharedContacts?{
    diagnosticPlayerFootContactsEnabled:true,
    diagnosticSharedContactEventsEnabled:true
   }:{})
  }:{});
 const mover=usesOriginalControl?null:createPlayerMovement(
  encounter?{researchBodyEncounter:true}:
  opposingFeedback?{
   researchOpposingPressConvergence:true,
   researchUnstagedNativeBodyFeedback:true
  }:
  opposingConvergence||opposingFeedbackOff?
   {researchOpposingPressConvergence:true}:{}
 );
 let disposed=false,latest=null,origin=null,previous=null;
 let pathM=0,maxSpeedMps=0,maxBrakeMps2=0,totalTurnRad=0;
 let postPassDistanceM=0,goalSideTravelM=0;
 let measuredOpponentPathM=0,minContestedPlayerGapM=Infinity;
 let supportRunPathM=0,supportNetAdvanceM=0;
 let observedSharedFootStarts=0;
 let nearestNativeOpposingContestGapM=Infinity;
 let genuineOpposingConvergenceBodyStarts=0;
 let opposingPresserPathM=0,opposingPresserMovedTicks=0;
 let maxSupportClearanceReadoutErrorM=0;
 const contestedOpponentId=physicalContest?'away-7':null;
 const toPhysical=(f)=>Object.freeze({tick:f.physicsTick,ball:f.ball});
 const toMovement=(f)=>Object.freeze({
  tick:f.physicsTick,players:f.observedMovementPlayers,
  recoveries:Object.freeze({home:null,away:null}),
  screens:Object.freeze({home:null,away:null}),
  supports:Object.freeze({home:null,away:null})
 });
 function record(physics,frame,pass=null,receivingContact=null,
  opposingShoe=null,bodySample=null,sharedSample=null){
  if(sharedSample&&(
      !sharedContacts||!bodySample||
      sharedSample.tick!==physics.tick||
      sharedSample.oneNativeRapierWorld!==true||
      sharedSample.oneNativeEventQueue!==true||
      !Array.isArray(sharedSample.genuineFootStarts)||
      !Number.isSafeInteger(sharedSample.nativeCollisionEventsLastTick)||
      sharedSample.officialMatchAction!==false))
   throw new Error('Shared collision data must come from one original tick');
  if(sharedSample&&physics.tick>0)
   observedSharedFootStarts+=sharedSample.genuineFootStarts.length;
  if(bodySample&&(
      bodySample.tick!==physics.tick||
      bodySample.physicalActors.length!==22||
      bodySample.sameOriginalRapierBallWorld!==true||
      bodySample.physicalActors.some((p,i)=>p.id!==frame.players[i].id)))
   throw new Error('Only this-tick original 22-body Rapier event source accepted');
  if(physics.tick!==frame.tick)throw new Error('Canonical 60 Hz movement and Rapier tick mismatch');
  const actualPressContest=opposingConvergence?
   frame.originalOpposingPressConvergence:null;
  if(opposingConvergence&&physics.tick>0&&
     (!actualPressContest||typeof actualPressContest.active!=='boolean'))
   throw new Error('M12 requires the two actual source pressers');
  if(opposingConvergenceScene&&(
     !bodySample||!sharedSample?.oneNativeEventQueue||
     bodySample.controlledEncounter!==false||
     bodySample.collisionColliderRadiusM!==PLAYER_MIN_SEPARATION_M/2))
   throw new Error('M12 requires unstaged original 0.49m native bodies');
  if(opposingConvergence&&actualPressContest?.active){
   const ids=actualPressContest.playerIds;
   const a=bodySample.physicalActors.find(p=>p.id===ids[0]);
   const b=bodySample.physicalActors.find(p=>p.id===ids[1]);
   if(!a||!b||a.team===b.team)
    throw new Error('M12 true opposing identities missing from Rapier world');
   nearestNativeOpposingContestGapM=Math.min(
    nearestNativeOpposingContestGapM,
    Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y));
   const pair=[...ids].sort().join('|');
   genuineOpposingConvergenceBodyStarts+=bodySample.events.filter(e=>
    e.tick===physics.tick&&e.type==='rapier-body-start'&&
    e.source==='native-rapier-collision-event'&&e.pair===pair).length;
  }
  const supportScene=scene.spec.id==='support-lane'||
   scene.spec.id==='support-neutral'||pressureScene;
  const support=supportScene?frame.supports?.[scene.side]??null:null;
  const p=frame.players.find(x=>x.id===(support?.playerId??scene.focusId));
  if(!p)throw new Error('Missing canonical movement focus');
  if(support&&(!frame.players.some(x=>x.id===support.playerId&&
      x.team===scene.side)||!support.target||
      !Number.isFinite(support.target.x)||
      !Number.isFinite(support.target.y)||
      !Number.isFinite(support.clearanceM)||
      !Number.isFinite(support.teammateClearanceM)))
   throw new Error('Original support assignment must come from real XY');
  const ball=physics.ball.position;
  // M10: independently sample the opponent's ACTUAL assigned presser and
  // all opposing current XY from the same original 22-player frame.
  // A press assignment is not a marking event, tackle or possession.
  const oppositeSide=scene.side==='home'?'away':'home';
  const pressId=pressureScene?frame.pressers?.[oppositeSide]??null:null;
  const presser=pressId?frame.players.find(other=>
   other.id===pressId&&other.team===oppositeSide&&
   other.role!=='goalkeeper'):null;
  if(pressId&&!presser)
   throw new Error('M10 opposing presser must be current original actor');
  const actualLaneClearanceM=support&&pressureScene?Math.min(
   ...frame.players.filter(other=>other.team===oppositeSide).map(other=>
    Math.hypot(other.x-support.target.x,other.y-support.target.y))):null;
  if(actualLaneClearanceM!==null){
   const error=Math.abs(actualLaneClearanceM-support.clearanceM);
   // The original lane scores the START-of-step positions; this
   // observation uses END-of-step positions, up to 7m/s * 1/60 apart.
   if(error>7*FIXED_DT+1e-5)
    throw new Error('M10 support clearance must derive from actual opponents');
   maxSupportClearanceReadoutErrorM=Math.max(
    maxSupportClearanceReadoutErrorM,error);
  }
  if(support&&presser&&previous?.pressId===presser.id&&
     previous.supportPlayerId===support.playerId&&
     previous.tick+1===physics.tick&&previous.pressXY){
   const moved=Math.hypot(
    presser.x-previous.pressXY.x,presser.y-previous.pressXY.y);
   opposingPresserPathM+=moved;
   if(moved>1e-6)opposingPresserMovedTicks++;
  }
  const pressToSupportM=presser&&support?
   Math.hypot(presser.x-p.x,presser.y-p.y):null;
  const pressToLaneM=presser&&support?
   Math.hypot(presser.x-support.target.x,
    presser.y-support.target.y):null;
  const gapM=Math.hypot(p.x-ball.x,p.y-ball.y);
  if(origin===null)origin=Object.freeze({x:p.x,y:p.y,gapM});
  const contestedOpponent=physicalContest?
   frame.players.find(other=>other.id===contestedOpponentId&&
    other.team!==scene.side):null;
  if(physicalContest&&!contestedOpponent)
   throw new Error('Actual canonical opposing player missing');
  if(physicalContest&&opposingShoe&&(
     opposingShoe.realShoeStart!==true||
     opposingShoe.playerId!==contestedOpponentId||
     opposingShoe.passingTick!==pass?.tick||
     !Number.isSafeInteger(opposingShoe.tick)||
     opposingShoe.tick<=pass.tick||
     opposingShoe.tick>physics.tick||
     opposingShoe.officialInterception!==false))
   throw new Error('Only original later authentic opponent Rapier shoe START is accepted');
  if(physicalContest&&previous?.opponentXY&&
     physics.tick===previous.tick+1&&pass&&
     physics.tick>pass.tick&&
     (!opposingShoe||physics.tick<=opposingShoe.tick)){
   measuredOpponentPathM+=Math.hypot(
    contestedOpponent.x-previous.opponentXY.x,
    contestedOpponent.y-previous.opponentXY.y);
  }
  const contestedGapM=contestedOpponent?
   Math.hypot(p.x-contestedOpponent.x,p.y-contestedOpponent.y):null;
  if(contestedGapM!==null)
   minContestedPlayerGapM=Math.min(minContestedPlayerGapM,contestedGapM);
  // Only continuous real XY of the SAME chosen player in the SAME lane
  // is measurable support progress. The current target alone is intent.
  if(support&&previous?.supportPlayerId===p.id&&
     previous.supportLane===support.lane&&
     previous.tick+1===physics.tick){
   const movement=Math.hypot(p.x-previous.x,p.y-previous.y);
   const priorDistance=Math.hypot(previous.x-support.target.x,
    previous.y-support.target.y);
   const currentDistance=Math.hypot(p.x-support.target.x,
    p.y-support.target.y);
   supportRunPathM+=movement;
   supportNetAdvanceM+=Math.max(0,priorDistance-currentDistance);
  }
  const speedMps=Math.hypot(p.vx,p.vy);
  if(pass&&(pass.physicalImpulseApplied!==true||
     pass.recipientId!==scene.focusId||pass.team!==scene.side||
     !Number.isSafeInteger(pass.tick)||pass.tick>=physics.tick+1))
   throw new Error('Only authenticated original physical PASS is admissible');
  if(previous&&postPass&&pass&&
     previous.tick>=pass.tick&&physics.tick>pass.tick)
   postPassDistanceM+=Math.hypot(p.x-previous.x,p.y-previous.y);
  if(previous){
   pathM+=Math.hypot(p.x-previous.x,p.y-previous.y);
   if(!p.blockedBy&&!previous.blockedBy)
    maxBrakeMps2=Math.max(maxBrakeMps2,
     (previous.speedMps-speedMps)/FIXED_DT);
   totalTurnRad+=Math.abs(delta(p.facingRad,previous.facingRad));
  }
  maxSpeedMps=Math.max(maxSpeedMps,speedMps);
  const pairs=frame.players;
  let minSpacingM=Infinity;
  for(let i=0;i<pairs.length;i++)for(let j=i+1;j<pairs.length;j++)
   minSpacingM=Math.min(minSpacingM,Math.hypot(
    pairs[i].x-pairs[j].x,pairs[i].y-pairs[j].y));
  if(minSpacingM<PLAYER_MIN_SEPARATION_M-1e-8)
   throw new Error('Canonical 0.98 m separation violated');
  // Recovery observation requires the ORIGINAL screen and recovery
  // assignment resulting from current actual opponent XY, never ball
  // territory or a guessed opponent.
  const recovery=frame.recoveries[scene.side];
  const screen=frame.screens[scene.side];
  const recoveryObserved=Boolean(screen&&recovery&&
    recovery.opponentId===screen.opponentId&&
    recovery.playerIds.length>0);
  const currentOpponent=recoveryObserved?
   frame.players.find(other=>other.id===screen.opponentId&&
    other.team!==scene.side&&other.role!=='goalkeeper'):null;
  const assigned=Boolean(currentOpponent&&recovery.playerIds.includes(p.id));
  // Count only consecutive, source-confirmed goalward movement of the
  // SAME assigned player against the SAME currently sampled opponent.
  if(assigned&&previous?.assignedOpponentId===currentOpponent.id&&
    physics.tick===previous.tick+1&&!p.blockedBy){
   const actualGoalSide=(p.x-previous.x)*(scene.side==='home'?-1:1);
   if(actualGoalSide>0)goalSideTravelM+=actualGoalSide;
  }
  const witnessed=scene.spec.id==='approach'?
   origin.gapM-gapM>0.25&&pathM>0.3:
   scene.spec.id==='brake'?
    !p.blockedBy&&maxSpeedMps>0.75&&
    maxSpeedMps-speedMps>0.35&&maxBrakeMps2>0:
   scene.spec.id==='turn'?totalTurnRad>0.4:
   scene.spec.id==='recovery'?recoveryObserved:
   scene.spec.id==='recovery-response'?assigned&&goalSideTravelM>0.15:
   scene.spec.id==='post-pass'?Boolean(pass&&postPassDistanceM>0.25):
   physicalContest?Boolean(pass&&opposingShoe&&
    measuredOpponentPathM>0.25):
   scene.spec.id==='support-lane'?Boolean(support&&
    supportRunPathM>0.5&&supportNetAdvanceM>0.35):
   pressureScene?Boolean(scene.spec.id==='pressure-support'&&support&&
    presser&&supportRunPathM>0.5&&supportNetAdvanceM>0.35&&
    opposingPresserPathM>0.25&&opposingPresserMovedTicks>0&&
    bodySample?.physicalActors.length===22&&
    sharedSample?.oneNativeEventQueue===true):
   opposingConvergenceScene?Boolean(opposingConvergence&&
    genuineOpposingConvergenceBodyStarts>0&&
    sharedSample?.oneNativeEventQueue===true):
   opposingFeedbackScene?Boolean(opposingFeedback&&
    bodySample?.actualNativeStarts>0&&
    bodySample?.appliedMoverResponses>0&&
    frame.actualNativeResponseCount>0&&
    sharedSample?.oneNativeEventQueue===true):
   nativeBodies?Boolean(bodySample&&bodySample.actualNativeStarts>0&&
    (!encounter||bodySample.appliedMoverResponses>0)&&
    (!sharedContacts||(sharedSample?.oneNativeEventQueue===true&&
     observedSharedFootStarts>0))):false;
  previous=Object.freeze({
   tick:physics.tick,x:p.x,y:p.y,speedMps,facingRad:p.facingRad,
   blockedBy:p.blockedBy,assignedOpponentId:assigned?currentOpponent.id:null,
   opponentXY:contestedOpponent?Object.freeze({
    x:contestedOpponent.x,y:contestedOpponent.y
   }):null,
   supportPlayerId:support?.playerId??null,
   supportLane:support?.lane??null,
   pressId:presser?.id??null,
   pressXY:presser?Object.freeze({x:presser.x,y:presser.y}):null
  });
  latest=Object.freeze({
   scenarioId:scene.spec.id,side:scene.side,focusId:p.id,
   tick:physics.tick,timeS:physics.tick*FIXED_DT,
   ball:physics.ball,
   players:frame.players,
   readout:Object.freeze({
    focusSpeedMps:speedMps,maxSpeedMps,pathM,
    distanceToBallM:gapM,distanceClosedM:origin.gapM-gapM,
    maxObservedBrakeMps2:maxBrakeMps2,totalTurnRad,
    minSpacingM,recoveryObserved,witnessed,
    observedOpponentId:currentOpponent?.id??null,
    assignedRecoveryPlayer:assigned,goalSideTravelM,
    postPassDistanceM,authenticPassTick:pass?.tick??null,
    observedReceivingShoeContact:Boolean(receivingContact),
    contestedOpponentId,measuredOpponentPathM,
    contestedPlayerGapM:contestedGapM,
    minContestedPlayerGapM:physicalContest?minContestedPlayerGapM:null,
    actualOpposingShoeTick:opposingShoe?.tick??null,
    verifiedRapierOpponentShoeStart:Boolean(opposingShoe),
    verifiedRapierPlayerBodyContact:false,
    supportPlayerId:support?.playerId??null,
    supportLane:support?.lane??null,
    supportTarget:support?.target??null,
    supportOppClearanceM:support?.clearanceM??null,
    supportTeammateClearanceM:support?.teammateClearanceM??null,
    supportRunPathM,supportNetAdvanceM,
    supportDistanceToTargetM:support?
     Math.hypot(p.x-support.target.x,p.y-support.target.y):null,
    actualOpposingPresserId:presser?.id??null,
    actualOpposingPresserSpeedMps:presser?
     Math.hypot(presser.vx,presser.vy):null,
    actualOpposingPresserPathM:opposingPresserPathM,
    actualOpposingPresserMovedTicks:opposingPresserMovedTicks,
    actualPressToRunnerM:pressToSupportM,
    actualPressToLaneM:pressToLaneM,
    actualSupportLaneOpponentClearanceM:actualLaneClearanceM,
    maxSupportClearanceReadoutErrorM,
    unstagedOriginalPlayers:pressureScene,
    authenticatedDynamicOpposition:pressureScene&&
     opposingPresserPathM>0.25&&opposingPresserMovedTicks>0,
    unstagedOpposingConvergence:opposingConvergenceScene,
    observedOpposingConvergenceActive:Boolean(actualPressContest?.active),
    observedOpposingConvergencePair:actualPressContest?.playerIds??null,
    observedOpposingConvergenceTicks:frame.actualContestActiveTicks??0,
    observedOpposingConvergenceStarts:frame.actualContestStarts??0,
    observedOpposingPresserGapM:actualPressContest?.opponentGapM??null,
    minimumNativeOpposingContestGapM:
     nearestNativeOpposingContestGapM===Infinity?
      null:nearestNativeOpposingContestGapM,
    genuineOpposingConvergenceBodyStarts,
    researchUnstagedFeedbackEnabled:opposingFeedback,
    observedOriginalFeedbackCount:frame.actualNativeResponseCount??0,
    observedOriginalFeedbackAccepted:
     frame.lastPhysicalReconciliation?.accepted===true,
    nativeBodyCount:bodySample?.physicalActors.length??0,
    nativeBodyStarts:bodySample?.actualNativeStarts??0,
    nativeBodyEnds:bodySample?.actualNativeEnds??0,
    nativeBodyLastStarts:bodySample?.currentTickStarts??0,
    nativeBodyMinPhysicalGapM:bodySample?.minPhysicalGapM??null,
    nativeBodyMaxMoverDriftM:bodySample?.maxCanonicalDriftM??null,
    nativeBodyEventSource:bodySample?
     'native-rapier-collision-event':null,
    nativeBodyPositionsFedBack:Boolean(bodySample?.physicalPositionsFedBackIntoMover),
    nativeBodyAcceptedResponses:bodySample?.appliedMoverResponses??0,
    nativeBodyActivePairs:bodySample?.activePairs??Object.freeze([]),
    nativeBodyControlledEncounter:Boolean(bodySample?.controlledEncounter),
    nativeBodyResearchColliderRadiusM:bodySample?.collisionColliderRadiusM??null,
    originalMoverResponseReason:frame.lastPhysicalReconciliation?.reason??null,
    nativeSharedOneQueue:Boolean(sharedSample?.oneNativeEventQueue),
    nativeSharedCollisionEventsLastTick:sharedSample?.nativeCollisionEventsLastTick??0,
    nativeSharedForceEventsLastTick:sharedSample?.nativeForceEventsLastTick??0,
    authenticSharedShoeStarts:observedSharedFootStarts,
    actualSharedShoeStartedIds:sharedSample?.genuineFootStarts??Object.freeze([]),
    // Foot contact is an authentic physical START but NOT an action,
    // awarded reception, a dribble or official match possession.
    verifiedSharedShoeBallStarts:observedSharedFootStarts>0,
    isCurrentCanonical22BodyWorld:Boolean(bodySample),
    // Even when a real research collider event occurs, there is no
    // authoritative player-body collision in an accepted football match.
    verifiedMatchBodyCollision:false
   }),
   readOnly:true,verifiedFootContact:Boolean(pass),
   officialMatchAction:false,officialPossession:false,
   officialMatchResult:null
  });
  return latest;
 }
 if(usesOriginalControl){
  const f=actionSession.snapshot();
  record(toPhysical(f),toMovement(f),f.priorRealPass,f.receivingContact,
   f.firstOpposingShoe);
 }else record(engine.snapshot(),mover.snapshot(),null,null,null,
  nativeBodies?engine.nativePlayerBodySnapshot():null,
  sharedContacts?engine.sharedNativeContactSnapshot():null);
 function snapshot(){if(disposed)throw new Error('Movement LAB disposed');return latest;}
 function step(){
  if(disposed)throw new Error('Movement LAB disposed');
  if(usesOriginalControl){
   const previousTick=latest.tick;
   const f=actionSession.step();
   if(f.physicsTick!==previousTick+1)
    throw new Error('Original CONTROL Rapier and mover ticks must align');
   return record(toPhysical(f),toMovement(f),f.priorRealPass,
    f.receivingContact,f.firstOpposingShoe);
  }
  const prior=engine.snapshot();
  const frame=mover.step(prior.ball.position);
  const after=nativeBodies?engine.step(frame):engine.step();
  if(after.tick!==prior.tick+1||frame.tick!==after.tick)
   throw new Error('Only current synchronized real physical ticks');
  if(opposingFeedback){
   const source=engine.nativePlayerBodySnapshot();
   mover.reconcileUnstagedNativeBodyResponse(source);
   const reconciled=mover.snapshot();
   const acknowledged=engine.acknowledgeNativePlayerResponse(reconciled);
   return record(after,reconciled,null,null,null,acknowledged,
    engine.sharedNativeContactSnapshot());
  }
  if(encounter&&nativeBodies){
   const physicalSource=engine.nativePlayerBodySnapshot();
   mover.reconcileNativeBodyResponse(physicalSource);
   const reconciled=mover.snapshot();
   const verified=engine.acknowledgeNativePlayerResponse(reconciled);
   return record(after,reconciled,null,null,null,verified,
    sharedContacts?engine.sharedNativeContactSnapshot():null);
  }
  return record(after,frame,null,null,null,
   nativeBodies?engine.nativePlayerBodySnapshot():null,
   sharedContacts?engine.sharedNativeContactSnapshot():null);
 }
 function dispose(){if(!disposed){
  disposed=true;engine?.dispose();actionSession?.dispose();
 }}
 return Object.freeze({scene,snapshot,step,dispose});
}

export function mountControlledMovementLabs({getRapier,onOpen,onClose}){
 const by=id=>document.getElementById(id);
 const dialog=by('movement-labs-dialog'),
  open=by('movement-labs-open'),close=by('movement-labs-close'),
  choice=by('movement-labs-choice'),side=by('movement-labs-side'),
  canvas=by('movement-labs-pitch'),status=by('movement-labs-status'),
  readout=by('movement-labs-readout'),description=by('movement-labs-description'),
  play=by('movement-labs-play'),pause=by('movement-labs-pause'),
  step=by('movement-labs-step'),reset=by('movement-labs-reset');
 if([dialog,open,close,choice,side,canvas,status,readout,description,
  play,pause,step,reset].some(x=>!x))
  throw new Error('Movement LAB controls are missing');
 if(choice.options.length!==MOVEMENT_LAB_SCENARIOS.length||
    MOVEMENT_LAB_SCENARIOS.some((s,i)=>choice.options[i].value!==s.id))
  throw new Error('Movement menu must match the source catalog');
 let session=null,playing=false,lastTime=0,accumulator=0;
 function stop(){playing=false;play.disabled=false;pause.disabled=true;}
 function draw(frame){
  const ctx=canvas.getContext('2d');
  const {X,Y}=drawPitchMarkings(ctx,canvas.width,canvas.height);
  for(const p of frame.players){
   const selected=p.id===frame.focusId;
   const actualOpponent=frame.scenarioId==='opponent-contact'&&
    p.id===frame.readout.contestedOpponentId;
   ctx.beginPath();ctx.arc(X(p.x),Y(p.y),selected?8:4,0,2*Math.PI);
   ctx.fillStyle=p.team==='home'?'#a8dfff':'#ffb39a';ctx.fill();
   if(actualOpponent){
    ctx.lineWidth=2;ctx.strokeStyle='#ffffff';ctx.stroke();
    ctx.beginPath();ctx.arc(X(p.x),Y(p.y),11,0,Math.PI*2);
    ctx.strokeStyle='#ffb39a';ctx.stroke();
   }
   if(selected){
    ctx.lineWidth=2;ctx.strokeStyle='#162e29';ctx.stroke();
    const fx=X(p.x)+Math.cos(p.facingRad)*16;
    const fy=Y(p.y)+Math.sin(p.facingRad)*16;
    ctx.beginPath();ctx.moveTo(X(p.x),Y(p.y));ctx.lineTo(fx,fy);
    ctx.lineWidth=2;ctx.strokeStyle='#ffffff';ctx.stroke();
   }
  }
  const p=frame.ball.position;
  ctx.beginPath();ctx.arc(X(p.x),Y(p.y),6,0,2*Math.PI);
  ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=1.5;
  ctx.strokeStyle='#102d2e';ctx.stroke();
 }
 function render(){
  if(!session)return;
  const f=session.snapshot(),m=f.readout;
  draw(f);
  if(m.naturalSource===true){
   readout.textContent='Tick '+f.tick+' · '+two(f.timeS)+'s'+
    ' · real 22-player Rapier'+
    ' · ball ('+two(f.ball.position.x)+', '+two(f.ball.position.y)+') m'+
    ' · primary press '+(m.primaryPressId??'none')+
    ' · secondary marking '+(m.secondaryPlayerId??'OFF')+
    (m.secondaryOpponentId?' vs '+m.secondaryOpponentId:'')+
    ' · genuine body STARTs '+m.nativeBodyStarts+
    ' · ENDs '+m.nativeBodyEnds+
    ' · active body pairs '+m.activeNativeBodyPairs.length+
    ' · shoe STARTs '+m.nativeShoeStarts+
    ' · applied solver responses '+m.nativeFeedbackResponses+
    ' · minimum canonical spacing '+two(m.minimumCanonicalGapM)+' m';
   status.textContent=m.firstGenuineMultiPair?
    'Verified: '+m.firstGenuineMultiPair.pairs.length+
    ' simultaneous TRUE Rapier body pairs at tick '+
    m.firstGenuineMultiPair.tick+'. Research only — no football outcome.':
    'Live '+(m.feedbackEnabled?'bounded physical feedback':'observation-only')+
    ' · native body pairs at this tick: '+m.activeNativeBodyPairs.length+
    ' · '+(m.secondaryEnabled?
     (m.secondaryPlayerId?'real second defensive marker assigned':'no eligible second marker this tick'):
     'secondary marking OFF')+
    '. Proximity is NOT a verified collision. No official tackle, possession or score.';
   return;
  }
  readout.textContent='Tick '+f.tick+' · '+two(f.timeS)+'s · '+
   f.focusId.replace('-', ' #')+' · speed '+two(m.focusSpeedMps)+' m/s'+
   ' · path '+two(m.pathM)+' m · heading change '+
   two(m.totalTurnRad)+' rad · brake peak '+two(m.maxObservedBrakeMps2)+
   ' m/s² · min 22-body gap '+two(m.minSpacingM)+' m'+
   (f.scenarioId==='post-pass'?' · Physical PASS tick '+
    (m.authenticPassTick??'none')+' · post-pass path '+
    two(m.postPassDistanceM)+' m':'')+
   (f.scenarioId==='recovery-response'?' · goal-side path '+
    two(m.goalSideTravelM)+' m · opponent '+
    (m.observedOpponentId??'none'):'')+
   (f.scenarioId==='opponent-contact'?' · real opponent '+m.contestedOpponentId+
    ' · observed path '+two(m.measuredOpponentPathM)+' m'+
    ' · opponent shoe START '+(m.actualOpposingShoeTick??'none')+
    ' · closest player gap '+two(m.minContestedPlayerGapM)+' m':'')+
   (['support-lane','support-neutral','pressure-support',
      'pressure-neutral'].includes(f.scenarioId)?
    ' · support '+(m.supportPlayerId??'none')+
    ' · lane '+(m.supportLane??'none')+
    ' · observed path '+two(m.supportRunPathM)+' m'+
    ' · target advance '+two(m.supportNetAdvanceM)+' m'+
    ' · observed opponent clearance '+
      (m.supportOppClearanceM===null?'none':two(m.supportOppClearanceM))+' m'+
    ' · teammate clearance '+
      (m.supportTeammateClearanceM===null?'none':two(m.supportTeammateClearanceM))+' m'+
     (pressureSceneLabel(f.scenarioId)?
      ' · real opposing presser '+(m.actualOpposingPresserId??'none')+
      ' · actual presser path '+two(m.actualOpposingPresserPathM)+' m'+
      ' · actual lane clearance '+
      (m.actualSupportLaneOpponentClearanceM===null?'none':
       two(m.actualSupportLaneOpponentClearanceM))+' m':''):'')+
   (['body-world','body-off','body-encounter','body-encounter-off',
     'shared-contacts','shared-contacts-off','pressure-support',
     'pressure-neutral','opposing-convergence',
     'opposing-convergence-off','opposing-feedback',
     'opposing-feedback-off'].includes(f.scenarioId)?
    ' · Rapier native bodies '+m.nativeBodyCount+
    ' · genuine starts '+m.nativeBodyStarts+
    ' · min physical gap '+
     (m.nativeBodyMinPhysicalGapM===null?'none':
      two(m.nativeBodyMinPhysicalGapM))+' m'+
    ' · max mover difference '+
     (m.nativeBodyMaxMoverDriftM===null?'none':
      two(m.nativeBodyMaxMoverDriftM))+' m'+
     (encounterOrOff(f.scenarioId)?
      ' · actual mover responses '+m.nativeBodyAcceptedResponses+
      ' · active native pairs '+m.nativeBodyActivePairs.length:'')+
     (f.scenarioId==='shared-contacts'||f.scenarioId==='shared-contacts-off'||
      pressureSceneLabel(f.scenarioId)||opposingConvergenceLabel(f.scenarioId)||
      opposingFeedbackLabel(f.scenarioId)?
      ' · single native queue '+m.nativeSharedOneQueue+
      ' · genuine shoe STARTs '+m.authenticSharedShoeStarts+
      ' · shared collision events last tick '+m.nativeSharedCollisionEventsLastTick:'')+
     (opposingConvergenceLabel(f.scenarioId)?
      ' · original convergence active '+m.observedOpposingConvergenceActive+
      ' · native opposing STARTs '+m.genuineOpposingConvergenceBodyStarts+
      ' · closest observed opposing pair '+
      (m.minimumNativeOpposingContestGapM===null?'none':
       two(m.minimumNativeOpposingContestGapM))+' m':'')+
     (opposingFeedbackLabel(f.scenarioId)?
      ' · accepted native corrections '+m.nativeBodyAcceptedResponses+
      ' · last mover correction '+(m.originalMoverResponseReason??'none')+
      ' · corrected mover '+m.nativeBodyPositionsFedBack:''):'');
  if(opposingFeedbackLabel(f.scenarioId)){
   status.textContent=f.scenarioId==='opposing-feedback-off'?
    'Negative: same original spontaneous Rapier body contact; no physical solver XY applied to canonical mover.':
    m.witnessed?
     'Verified: source-authenticated unstaged Rapier body START, bounded 22-player solver XY feedback accepted and applied to canonical mover.':
     'Original contact and bounded same-tick physical feedback not both verified yet.';
   status.textContent+=' Native body starts '+m.nativeBodyStarts+
    ', accepted native mover responses '+m.nativeBodyAcceptedResponses+
    '. Research only: no official tackle, possession or pass.';
   return;
  }
  if(opposingConvergenceLabel(f.scenarioId)){
   status.textContent=f.scenarioId==='opposing-convergence-off'?
    'Negative: source-grounded press-to-ball convergence OFF; no invented body contact witness.':
    m.witnessed?
     'Verified: two original opposing pressers converged naturally on actual ball; genuine native Rapier body START recorded.':
     'Original pressers observed; no genuine native Rapier body START proven yet.';
   status.textContent+=' Original 0.98m guard; native body STARTs '+
    m.nativeBodyStarts+', actual opposing STARTs '+
    m.genuineOpposingConvergenceBodyStarts+
    '. Read-only physics: no tackle, official possession or body feedback.';
   return;
  }
  if(pressureSceneLabel(f.scenarioId)){
   status.textContent=m.witnessed?
    'Verified: original unstaged support run with actual moving opposing presser under one native Rapier queue.':
    m.supportPlayerId===null?
    'No original support assignment: no support or pressure witness.':
    'Original unstaged movement under observation; dynamic opponent and support progress not both verified yet.';
   status.textContent+=' Native body STARTs '+m.nativeBodyStarts+
    ', shoe STARTs '+m.authenticSharedShoeStarts+
    '. Neither proximity nor presser motion certifies a tackle, possession or pass.';
   return;
  }
  if(f.scenarioId==='shared-contacts'||f.scenarioId==='shared-contacts-off'){
   status.textContent=m.nativeBodyCount===0?
    'Negative: shared physics OFF; no shoe or body collider witness.':
    m.witnessed?
    'Verified: native body START and canonical feedback in one shared Rapier queue.':
    'Single original Rapier queue active; no verified body response yet.';
   status.textContent+=' Actual shoe-ball START count '+m.authenticSharedShoeStarts+
    ' (independent). No official pass, tackle or possession.';
   return;
  }
  if(encounterOrOff(f.scenarioId)){
   status.textContent=m.nativeBodyCount===0?
    'Negative: the same 22-player approach has native bodies OFF. No physical collision or feedback.':
    m.witnessed?
    'Observed: real original-world Rapier collision START with bounded same-tick XY response accepted by canonical mover.':
    m.nativeBodyStarts>0?
    'Original native collision witnessed but mover feedback rejected by safety gates.':
    'Controlled original 22-body approach; no native collision START witnessed yet.';
   status.textContent+=' Research only: no simultaneous foot contact, official tackle or possession.';
   return;
  }
  if(f.scenarioId==='body-world'||f.scenarioId==='body-off'){
   status.textContent=(m.nativeBodyCount===22?
    (m.nativeBodyStarts>0?
     'Observed: original-world native Rapier body collider START(s).':
     'All 22 native Rapier body colliders active; no actual START witnessed yet.'):
    'Negative control: native body colliders OFF.')+
    ' Physical XY is not reconciled to canonical mover; no tackle, ball contact or possession.';
   return;
  }
  if(f.scenarioId==='support-lane'||f.scenarioId==='support-neutral'){
   status.textContent=(m.witnessed?
    'Observed: real original support-runner progress toward sampled open lane.':
    'No current support movement witness.')+
    ' Position only: playable PASS, reception and possession unverified.';
   return;
  }
  if(f.scenarioId==='opponent-contact'){
   status.textContent=(m.witnessed?
    'Observed: original opposing Rapier shoe-ball START after genuine PASS and actual opponent motion.':
    'No opponent physical shoe witness yet.')+
    ' Body collision, tackle, interception, possession and completed pass NOT verified.';
   return;
  }
  if(f.scenarioId==='post-pass'){
   status.textContent=(m.witnessed?
    'Observed: actual receiver movement after authentic Rapier PASS.':
    'No post-PASS movement witness yet.')+
    ' No official pass completion, possession or goal.';
   return;
  }
  if(f.scenarioId==='recovery-response'){
   status.textContent=(m.witnessed?
    'Observed: real assigned goal-side movement against a currently sampled opponent.':
    'No goal-side recovery witness yet.')+
    ' No certified interception, tackle or possession.';
   return;
  }
  if(f.scenarioId==='recovery-empty'){
   status.textContent='Negative control: no current-opponent recovery witness yet. No tackle or possession.';
   return;
  }
  status.textContent=(m.witnessed?'Observed: ':'No movement witness yet: ')+
   (f.scenarioId==='approach'?'actual player approach':
    f.scenarioId==='brake'?'actual measured deceleration':
    f.scenarioId==='turn'?'actual gradual heading rotation':
    'actual current-opponent recovery assignment')+
   '. Motion-only: no shoe collider, touch, possession or result.';
 }
 function resetSession(){
  stop();session?.dispose();
  if(choice.value==='opponent-contact')side.value='home';
  side.disabled=choice.value==='opponent-contact';
  by('movement-labs-title').textContent=choice.selectedOptions[0].textContent.trim();
  session=createControlledMovementLab(getRapier(),choice.value,{
   side:side.value});
  description.textContent=session.scene.spec.description;
  accumulator=0;lastTime=0;render();
 }
 function advance(){session.step();render();}
 function loop(now){
  if(!dialog.open)return;
  if(playing&&session&&lastTime){
   accumulator+=Math.min((now-lastTime)/1000,0.08);
   let count=0;
   while(accumulator>=FIXED_DT&&count<12){
    advance();accumulator-=FIXED_DT;count++;
   }
   if(count===12)accumulator=0;
  }
  lastTime=now;requestAnimationFrame(loop);
 }
 open.addEventListener('click',()=>{
  if(!getRapier())return;
  onOpen();dialog.showModal();
  try{resetSession();requestAnimationFrame(loop);}
  catch(e){stop();status.textContent='Cannot start: '+e.message;}
 });
 close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{
  stop();session?.dispose();session=null;onClose();
 });
 for(const control of [choice,side])
  control.addEventListener('change',()=>{if(dialog.open)try{resetSession();}
   catch(e){stop();status.textContent=e.message;}});
 play.addEventListener('click',()=>{playing=true;play.disabled=true;pause.disabled=false;});
 pause.addEventListener('click',stop);
 step.addEventListener('click',()=>{stop();try{advance();}
  catch(e){status.textContent=e.message;}});
 reset.addEventListener('click',()=>{try{resetSession();}
  catch(e){stop();status.textContent=e.message;}});
 stop();
 return Object.freeze({isOpen:()=>dialog.open});
}
