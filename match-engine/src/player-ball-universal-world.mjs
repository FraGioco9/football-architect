// ME-PB-54 / A1.2: closed Rapier universal-ball candidate.
// One 430g physical ball, 22 canonical feet, 60Hz, one global response.
// This is NOT the backend's official temporary-score-v1 match runtime.
import {createUniversalBallCoreEngine,createUniformAutonomousBallCoreEngine,
 normalizeScenario,FIXED_DT}
 from './core.mjs';
import {resolveGlobalBallResponse,DEFAULT_GLOBAL_BALL_RESPONSE}
 from './player-ball-global-response.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,PLAYER_DT,PLAYER_VERSION}
 from './player-movement.mjs';
import {measureOrientedCarryShoeBallGeometry}
 from './player-ball-carry-oriented-shoe-geometry.mjs';

export const UNIVERSAL_MATCH_BALL_SESSION_VERSION=
 'me-pb-54-universal-ball-world-candidate-v1';

// ME-PB-55 / A4.2a: the actual autonomous 22-player movement decision
// chosen BEFORE Rapier advances this same tick. No new AI physics knobs.
export const AUTONOMOUS_MOVEMENT_DUTIES_VERSION=
 'me-pb-55-same-step-autonomous-duty-observation-v1';

function actualMovementDuties(frame){
 if(!frame||frame.version!==PLAYER_VERSION||
    !Number.isSafeInteger(frame.tick)||frame.tick<0||
    !Array.isArray(frame.players)||frame.players.length!==INITIAL_PLAYERS.length)
  throw new TypeError('Trusted canonical autonomous player tick required');
 const duties=Object.freeze(frame.players.map((p,i)=>{
  const canonical=INITIAL_PLAYERS[i],team=p?.team;
  if(!p||p.id!==canonical.id||team!==canonical.team||
     p.role!==canonical.role)
   throw new TypeError('Canonical ordered 22-player autonomous duties required');
  const kind=p.role==='goalkeeper'?'goalkeeper-position':
   frame.provisionalCarryPursuit?.playerId===p.id?'carry-follow-intent':
   frame.provisionalChallengeCarryRunnerId===p.id?'challenge-carry-intent':
   frame.provisionalReceivePassRunnerId===p.id?'receive-pass-intent':
   frame.provisionalChallengePassRunnerId===p.id?'challenge-pass-intent':
   frame.provisionalAttackSupportRun?.playerId===p.id?'attack-support-intent':
   frame.pressers[team]===p.id?'press':
   frame.coverers[team]===p.id?'cover':
   frame.screens[team]?.defenderId===p.id?'screen':
   frame.supports[team]?.playerId===p.id?'support':
   frame.balances[team]?.playerId===p.id?'balance':
   frame.recoveries[team]?.playerIds?.includes(p.id)?'recover':'formation';
  return Object.freeze({
   engineId:p.id,team,role:p.role,movementDuty:kind,
   dutySource:'actual-60hz-autonomous-movement-assignment',
   ballActionSelected:false,footballActionExecuted:false
  });
 }));
 return Object.freeze({
  version:AUTONOMOUS_MOVEMENT_DUTIES_VERSION,
  physicsTick:frame.tick,
  dutySource:'internal-canonical-autonomous-player-mover',
  players:duties,
  playerCount:22,
  attackSupportRun:frame.provisionalAttackSupportRun??null,
  carryPursuit:frame.provisionalCarryPursuit??null,
  carryChallengerId:frame.provisionalChallengeCarryRunnerId??null,
  carryChallengerFlank:frame.provisionalCarryChallengeFlank??null,
  carryChallengerBlockedBy:frame.players.find(p=>
   p.id===frame.provisionalChallengeCarryRunnerId)?.blockedBy??null,
  actualMotionAssignmentsOnly:true,
  physicalContactInferred:false,
  officialMatchAction:false,officialMatchPossession:false
 });
}

// Read-only positions from the SAME autonomous mover tick that drives Rapier feet.
// This is a visualization projection, not a second mover or physics input.
function projectPhysicalPlayerPositions(frame){
 if(!frame||frame.version!==PLAYER_VERSION||!Array.isArray(frame.players)||
    frame.players.length!==INITIAL_PLAYERS.length)
  throw new TypeError('Canonical 22-player position frame required');
 return Object.freeze(frame.players.map((p,i)=>{
  const actor=INITIAL_PLAYERS[i];
  if(!p||p.id!==actor.id||p.team!==actor.team||p.role!==actor.role||
     !Number.isFinite(p.x)||!Number.isFinite(p.y))
   throw new TypeError('Invalid canonical player position projection');
  return Object.freeze({engineId:p.id,team:p.team,role:p.role,x:p.x,y:p.y});
 }));
}

const reject=()=>{throw new TypeError(
 'Universal ball session accepts only one global response and trusted Rapier physics'
);};

export function createUniversalMatchBallSession(RAPIER,scenario,options={}){
 if(!options||typeof options!=='object'||Array.isArray(options)||
    Reflect.ownKeys(options).some(key=>key!=='globalResponse'&&
    key!=='autonomousActions'&&key!=='researchShotAttacker'&&
    key!=='autonomousCarry'&&key!=='autonomousCarrySupport'&&
     key!=='autonomousCarrySupportPressHandoff'&&
     key!=='autonomousCarryAttackContinuity'&&
     key!=='autonomousCarrySupportBallAccess'&&
     key!=='autonomousCarrySupportLateralAlign'&&
     key!=='autonomousCarrySupportEarlyFacing'&&
     key!=='autonomousCarrySupportShoeCenterTarget'&&
     key!=='autonomousCarrySupportFootLateralLead'&&
     key!=='autonomousCarrySupportObservedBallVelocityLead'&&
     key!=='autonomousCarrySupportTerminalFacingLead'&&
     key!=='autonomousCarrySupportTerminalRunThrough'&&
     key!=='autonomousCarrySupportTerminalLateralSlip'&&
     key!=='autonomousCarrySupportLongitudinalLead'))reject();
 if(Object.hasOwn(options,'autonomousActions')&&options.autonomousActions!==true)
  reject();
 const value=Object.hasOwn(options,'globalResponse')?
  options.globalResponse:DEFAULT_GLOBAL_BALL_RESPONSE;
 const response=resolveGlobalBallResponse(value);
 const initial=normalizeScenario(scenario);
 const autonomousActions=options.autonomousActions===true;
 if(Object.hasOwn(options,'autonomousCarry')&&
   (options.autonomousCarry!==true||!autonomousActions||
    Object.hasOwn(options,'researchShotAttacker')))reject();
 const autonomousCarry=options.autonomousCarry===true;
 if(Object.hasOwn(options,'autonomousCarrySupport')&&
    (options.autonomousCarrySupport!==true||!autonomousCarry||
     Object.hasOwn(options,'researchShotAttacker')))reject();
 const autonomousCarrySupport=options.autonomousCarrySupport===true;
 if(Object.hasOwn(options,'autonomousCarrySupportPressHandoff')&&
    (options.autonomousCarrySupportPressHandoff!==true||
     !autonomousCarrySupport||
     Object.hasOwn(options,'researchShotAttacker')))reject();
 const autonomousCarrySupportPressHandoff=
  options.autonomousCarrySupportPressHandoff===true;
 if(Object.hasOwn(options,'autonomousCarryAttackContinuity')&&
    (options.autonomousCarryAttackContinuity!==true||
     !autonomousCarrySupportPressHandoff||
     Object.hasOwn(options,'researchShotAttacker')))reject();
 const autonomousCarryAttackContinuity=
  options.autonomousCarryAttackContinuity===true;
 if(Object.hasOwn(options,'autonomousCarrySupportBallAccess')&&
    (options.autonomousCarrySupportBallAccess!==true||
     !autonomousCarrySupportPressHandoff||
     Object.hasOwn(options,'researchShotAttacker')))reject();
 const autonomousCarrySupportBallAccess=
  options.autonomousCarrySupportBallAccess===true;
 if(Object.hasOwn(options,'autonomousCarrySupportLateralAlign')&&
    (options.autonomousCarrySupportLateralAlign!==true||
     !autonomousCarrySupportBallAccess||
     Object.hasOwn(options,'researchShotAttacker')))reject();
 const autonomousCarrySupportLateralAlign=
  options.autonomousCarrySupportLateralAlign===true;
 if(Object.hasOwn(options,'autonomousCarrySupportEarlyFacing')&&
    (options.autonomousCarrySupportEarlyFacing!==true||
     !autonomousCarrySupportLateralAlign||
     Object.hasOwn(options,'researchShotAttacker')))reject();
 const autonomousCarrySupportEarlyFacing=
  options.autonomousCarrySupportEarlyFacing===true;
 if(Object.hasOwn(options,'autonomousCarrySupportShoeCenterTarget')&&
    (options.autonomousCarrySupportShoeCenterTarget!==true||
     !autonomousCarrySupportEarlyFacing||
     Object.hasOwn(options,'researchShotAttacker')))reject();
 const autonomousCarrySupportShoeCenterTarget=
  options.autonomousCarrySupportShoeCenterTarget===true;
 if(Object.hasOwn(options,'autonomousCarrySupportFootLateralLead')&&
    (options.autonomousCarrySupportFootLateralLead!==true||
     !autonomousCarrySupportShoeCenterTarget||
     Object.hasOwn(options,'researchShotAttacker')))reject();
 const autonomousCarrySupportFootLateralLead=
  options.autonomousCarrySupportFootLateralLead===true;
 if(Object.hasOwn(options,'autonomousCarrySupportObservedBallVelocityLead')&&
    (options.autonomousCarrySupportObservedBallVelocityLead!==true||
     !autonomousCarrySupportFootLateralLead||
     Object.hasOwn(options,'researchShotAttacker')))reject();
 const autonomousCarrySupportObservedBallVelocityLead=
  options.autonomousCarrySupportObservedBallVelocityLead===true;
 if(Object.hasOwn(options,'autonomousCarrySupportTerminalFacingLead')&&
    (options.autonomousCarrySupportTerminalFacingLead!==true||
     !autonomousCarrySupportObservedBallVelocityLead||
     Object.hasOwn(options,'researchShotAttacker')))reject();
 const autonomousCarrySupportTerminalFacingLead=
  options.autonomousCarrySupportTerminalFacingLead===true;
 if(Object.hasOwn(options,'autonomousCarrySupportTerminalRunThrough')&&
    (options.autonomousCarrySupportTerminalRunThrough!==true||
     !autonomousCarrySupportTerminalFacingLead||
     Object.hasOwn(options,'researchShotAttacker')))reject();
 const autonomousCarrySupportTerminalRunThrough=
  options.autonomousCarrySupportTerminalRunThrough===true;
 if(Object.hasOwn(options,'autonomousCarrySupportTerminalLateralSlip')&&
    (options.autonomousCarrySupportTerminalLateralSlip!==true||
     !autonomousCarrySupportTerminalFacingLead||
     autonomousCarrySupportTerminalRunThrough||
     Object.hasOwn(options,'researchShotAttacker')))reject();
 const autonomousCarrySupportTerminalLateralSlip=
  options.autonomousCarrySupportTerminalLateralSlip===true;
 if(Object.hasOwn(options,'autonomousCarrySupportLongitudinalLead')&&
    (options.autonomousCarrySupportLongitudinalLead!==true||
     !autonomousCarrySupportTerminalFacingLead||
     autonomousCarrySupportTerminalRunThrough||
     autonomousCarrySupportTerminalLateralSlip||
     Object.hasOwn(options,'researchShotAttacker')))reject();
 const autonomousCarrySupportLongitudinalLead=
  options.autonomousCarrySupportLongitudinalLead===true;
 const researchShotAttacker=options.researchShotAttacker??null;
 if(Object.hasOwn(options,'researchShotAttacker')&&(
   !['home','away'].includes(researchShotAttacker)||
   !autonomousActions||initial.preset!=='roll'||
   initial.z!==0||initial.vz!==0))reject();
 const engine=autonomousActions?
  createUniformAutonomousBallCoreEngine(RAPIER,initial,response.value,
   researchShotAttacker,autonomousCarry):
  createUniversalBallCoreEngine(RAPIER,initial,response.value);
 // C1.2b: only the explicit autonomousActions opt-in may let every
 // current presser from both teams reach genuine Rapier shoe distance.
 // Ordinary physics retains the original LAB/one-player approach.
 const mover=createPlayerMovement({
  experimentalAiKickApproach:true,
  ...(autonomousActions?{experimentalAutonomousFixtureContactChase:true}:{}),
  ...(autonomousCarry?{experimentalAutonomousFixtureCarry:true}:{}),
  ...(autonomousCarrySupport?{
   experimentalAutonomousFixtureCarrySupport:true}:{}),
  ...(autonomousCarrySupportPressHandoff?{
   experimentalAutonomousFixtureCarrySupportPressHandoff:true}:{}),
  ...(autonomousCarryAttackContinuity?{
   experimentalAutonomousFixtureCarryAttackContinuity:true}:{}),
  ...(autonomousCarrySupportBallAccess?{
   experimentalAutonomousFixtureCarrySupportBallAccess:true}:{}),
  ...(autonomousCarrySupportLateralAlign?{
   experimentalAutonomousFixtureCarrySupportLateralAlign:true}:{}),
  ...(autonomousCarrySupportEarlyFacing?{
   experimentalAutonomousFixtureCarrySupportEarlyFacing:true}:{}),
  ...(autonomousCarrySupportShoeCenterTarget?{
   experimentalAutonomousFixtureCarrySupportShoeCenterTarget:true}:{}),
  ...(autonomousCarrySupportFootLateralLead?{
   experimentalAutonomousFixtureCarrySupportFootLateralLead:true}:{}),
  ...(autonomousCarrySupportObservedBallVelocityLead?{
   experimentalAutonomousFixtureCarrySupportObservedBallVelocityLead:true}:{}),
  ...(autonomousCarrySupportTerminalFacingLead?{
   experimentalAutonomousFixtureCarrySupportTerminalFacingLead:true}:{}),
  ...(autonomousCarrySupportTerminalRunThrough?{
   experimentalAutonomousFixtureCarrySupportTerminalRunThrough:true}:{}),
  ...(autonomousCarrySupportTerminalLateralSlip?{
   experimentalAutonomousFixtureCarrySupportTerminalLateralSlip:true}:{}),
   ...(autonomousCarrySupportLongitudinalLead?{
    experimentalAutonomousFixtureCarrySupportLongitudinalLead:true}:{}),
  ...(researchShotAttacker?{researchShotAttacker,researchShotBall:initial}:{})
 });
 let closed=false;
 const ensureOpen=()=>{if(closed)throw new Error('Universal ball session disposed');};
 function record(physics,contacts,movement){
  const action=autonomousActions?engine.uniformAutonomousActionSnapshot():null;
  const localAction=action?.tick===physics.tick?action:null;
  if(localAction&&(!contacts.started.includes(localAction.playerId)||
     contacts.started.length!==1||contacts.active.length!==1||
     contacts.active[0]!==localAction.playerId||
     !localAction.appliedByRapier||localAction.officialMatchAction!==false))
   throw new Error('Real shoe START and actual Rapier impulse required');
  if(movement?.tick!==physics.tick)throw new Error(
   'Autonomous movement and physical tick must match');
  // C3.3g: sample EXACTLY the same 60Hz canonical facing/XY that was
  // delivered to Rapier's kinematic shoe this step. No new motion input.
  const challengerId=autonomousCarry?
   movement.provisionalChallengeCarryRunnerId??null:null;
  const challenger=challengerId===null?null:
   movement.players.find(p=>p.id===challengerId);
  if(challengerId!==null&&!challenger)
   throw new Error('Untrusted missing physical carry challenger facing');
  const actualCarryChallengerShoeGeometry=challenger?Object.freeze({
   ...measureOrientedCarryShoeBallGeometry(challenger,physics.ball.position),
   physicsTick:physics.tick,
   source:'same-60hz-moved-rapier-shoe-transform',
   readOnly:true
  }):null;
  return Object.freeze({
   version:UNIVERSAL_MATCH_BALL_SESSION_VERSION,
   physicsTick:physics.tick,timeS:physics.time,
   ballSnapshot:physics,ball:physics.ball,footContact:contacts,
   autonomousMovement:actualMovementDuties(movement),
   physicalPlayerPositions:projectPhysicalPlayerPositions(movement),
   ...(autonomousCarry?{actualCarryChallengerShoeGeometry}:{}),
   localAutonomousAction:localAction,
   autonomousActionMode:autonomousActions,
   autonomousCarryMode:autonomousCarry,
   ...(autonomousCarrySupport?{autonomousCarrySupportMode:true}:{}),
   ...(autonomousCarrySupportPressHandoff?{
    autonomousCarrySupportPressHandoffMode:true}:{}),
   ...(autonomousCarryAttackContinuity?{
    autonomousCarryAttackContinuityMode:true}:{}),
   ...(autonomousCarrySupportBallAccess?{
    autonomousCarrySupportBallAccessMode:true}:{}),
   ...(autonomousCarrySupportLateralAlign?{
    autonomousCarrySupportLateralAlignMode:true}:{}),
   ...(autonomousCarrySupportEarlyFacing?{
    autonomousCarrySupportEarlyFacingMode:true}:{}),
   ...(autonomousCarrySupportShoeCenterTarget?{
    autonomousCarrySupportShoeCenterTargetMode:true}:{}),
   ...(autonomousCarrySupportFootLateralLead?{
    autonomousCarrySupportFootLateralLeadMode:true}:{}),
   ...(autonomousCarrySupportObservedBallVelocityLead?{
    autonomousCarrySupportObservedBallVelocityLeadMode:true}:{}),
   ...(autonomousCarrySupportTerminalFacingLead?{
    autonomousCarrySupportTerminalFacingLeadMode:true}:{}),
   ...(autonomousCarrySupportTerminalRunThrough?{
    autonomousCarrySupportTerminalRunThroughMode:true}:{}),
   ...(autonomousCarrySupportTerminalLateralSlip?{
    autonomousCarrySupportTerminalLateralSlipMode:true}:{}),
    ...(autonomousCarrySupportLongitudinalLead?{
     autonomousCarrySupportLongitudinalLeadMode:true}:{}),
   localFootballActionExecuted:localAction!==null,
   playerCount:INITIAL_PLAYERS.length,contactSource:'internal-real-rapier-60hz',
   responseVersion:response.version,globalResponse:response.value,
   sameForAllPlayers:true,sameForAllShoes:true,sameForAllPitches:true,
   experimentalLocalOnly:true,matchRuntimeIntegrated:false,
   officialMatchPossession:false,officialMatchAction:false,
   passCreated:false,tackleProven:false,interceptionProven:false,
   ballForceApplied:localAction!==null,ballTeleportApplied:false,
   ballAttachmentApplied:false
  });
 }
 let latest=record(engine.snapshot(),engine.footContactSnapshot(),
  mover.snapshot());
 function dispose(){if(!closed){closed=true;engine.dispose();}}
 function snapshot(...args){ensureOpen();if(args.length)reject();return latest;}
 function step(...args){
  ensureOpen();if(args.length)reject();
  try{
   const before=engine.snapshot();
   const players=mover.step(before.ball.position);
   if(players.tick!==before.tick+1||
      players.players.length!==INITIAL_PLAYERS.length||
      Math.abs(players.timeS-players.tick*PLAYER_DT)>1e-8)
    throw new Error('Canonical 22-player input tick missing');
   const after=engine.step(players),contact=engine.footContactSnapshot();
   if(after.tick!==before.tick+1||contact?.tick!==after.tick||
      Math.abs(after.time-after.tick*FIXED_DT)>1e-8)
    throw new Error('Nonconsecutive trusted Rapier ball/foot frame');
   latest=record(after,contact,players);
   // C1.2b: closed, verified handoff AFTER the real Rapier impulse.
   // Before any authentic pass the mover remains byte-equivalent to
   // accepted ordinary session movement and no-contact behavior.
   if(latest.localAutonomousAction?.action==='pass')
    mover.observeAuthenticFixturePass(latest.localAutonomousAction);
   else if(autonomousCarry&&latest.localAutonomousAction?.action==='carry')
    mover.observeAuthenticFixtureCarry(latest.localAutonomousAction);
   else if(autonomousCarry&&latest.localAutonomousAction)
    mover.clearFixtureCarryOnOtherAction(latest.localAutonomousAction);
   // Replay only the just-completed INTERNAL real Rapier END to the mover.
   if(autonomousCarry)
    for(const shoeId of latest.footContact.ended)
     mover.observeAuthenticFixtureCarryShoeEnd(shoeId,latest.physicsTick);
   return latest;
  }catch(error){dispose();throw error;}
 }
 function reset(...args){
  ensureOpen();if(args.length)reject();
  const fresh=createUniversalMatchBallSession(RAPIER,initial,{
   globalResponse:response.value,
   ...(autonomousActions?{autonomousActions:true}:{}),
   ...(autonomousCarry?{autonomousCarry:true}:{}),
   ...(autonomousCarrySupport?{autonomousCarrySupport:true}:{}),
   ...(autonomousCarrySupportPressHandoff?{
    autonomousCarrySupportPressHandoff:true}:{}),
   ...(autonomousCarryAttackContinuity?{
    autonomousCarryAttackContinuity:true}:{}),
   ...(autonomousCarrySupportBallAccess?{
    autonomousCarrySupportBallAccess:true}:{}),
   ...(autonomousCarrySupportLateralAlign?{
    autonomousCarrySupportLateralAlign:true}:{}),
   ...(autonomousCarrySupportEarlyFacing?{
    autonomousCarrySupportEarlyFacing:true}:{}),
   ...(autonomousCarrySupportShoeCenterTarget?{
    autonomousCarrySupportShoeCenterTarget:true}:{}),
   ...(autonomousCarrySupportFootLateralLead?{
    autonomousCarrySupportFootLateralLead:true}:{}),
   ...(autonomousCarrySupportObservedBallVelocityLead?{
    autonomousCarrySupportObservedBallVelocityLead:true}:{}),
   ...(autonomousCarrySupportTerminalFacingLead?{
    autonomousCarrySupportTerminalFacingLead:true}:{}),
   ...(autonomousCarrySupportTerminalRunThrough?{
    autonomousCarrySupportTerminalRunThrough:true}:{}),
   ...(autonomousCarrySupportTerminalLateralSlip?{
    autonomousCarrySupportTerminalLateralSlip:true}:{}),
    ...(autonomousCarrySupportLongitudinalLead?{
     autonomousCarrySupportLongitudinalLead:true}:{}),
   ...(researchShotAttacker?{researchShotAttacker}:{})
  });
  dispose();
  return fresh;
 }
 return Object.freeze({step,snapshot,reset,dispose});
}
