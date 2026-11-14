// ME-PB-54 / A1.3a — executable per-fixture physical MATCH STEP PRODUCER.
// A1.2 owns the real Rapier world and canonical 22-foot movement.
// Fixture identity is structurally validated, NOT attested to official schedule.
// No goals, scores, roster identity, gameplay decisions, or D1 mutations.
import {createUniversalMatchBallSession} from './player-ball-universal-world.mjs';
import {CARRY_ORIENTED_SHOE_GEOMETRY_VERSION}
 from './player-ball-carry-oriented-shoe-geometry.mjs';
import {FOOT_CONTACT_FORWARD_OFFSET_M,FOOT_CONTACT_CENTER_HEIGHT_M}
 from './player-foot-contact.mjs';
import {createPhysicalCarryContactSequenceObserver,
 PHYSICAL_CARRY_SEQUENCE_VERSION}
 from './player-ball-physical-carry-sequence.mjs';
import {createPhysicalCarryProximityObserver,CARRY_PROXIMITY_VERSION,
 PROXIMITY_INTERRUPTION_REASONS}
 from './player-ball-physical-carry-proximity.mjs';
import {normalizeScenario,canonicalSnapshot,FIXED_DT} from './core.mjs';
import {createPhysicalShotBoundaryObserver}
 from './player-ball-shot-boundary-observer.mjs';
import {createPhysicalBallVolumeBoundaryObserver,
 PHYSICAL_BALL_VOLUME_BOUNDARY_VERSION}
 from './player-ball-volume-boundary.mjs';
import {createTemporaryUniformFixtureSquad}
 from './temporary-uniform-fixture-squad.mjs';
import {createProvisionalActionOutcomeObserver,
 PROVISIONAL_ACTION_OBSERVATION_TICKS}
 from './player-ball-action-outcome-observation.mjs';

export const PHYSICAL_FIXTURE_RUNTIME_VERSION=
 'me-pb-54-universal-ball-fixture-step-runtime-v1';
const countries='IT|ENG|ES|DE|FR|PT|NL|BR';
const clubPattern=new RegExp('^(?:'+countries+')-(?:[1-9]|[1-3][0-9]|40)$');
const competitionPattern=new RegExp('^(?:(?:'+countries+')-[12]|int-[12])$');
const markerPattern=/^(?:[NI](?:0[1-9]|[12][0-9]|3[0-3])|FEDERATION-FINAL|SOVEREIGN-FINAL)$/;
const fixtureKeys=Object.freeze([
 'awayClubId','competitionId','day','homeClubId','id','marker','round'
]);
const reject=()=>{throw new TypeError(
 'Only a canonical-shaped fixture and one universal physical ball are allowed'
);};
const noArgs=()=>{throw new TypeError(
 'Physical match step runtime never accepts injected match actions or frames'
);};

export function normalizePhysicalFixture(fixture){
 if(!fixture||typeof fixture!=='object'||Array.isArray(fixture)||
    Reflect.ownKeys(fixture).length!==fixtureKeys.length||
    Reflect.ownKeys(fixture).some(key=>
     typeof key!=='string'||!fixtureKeys.includes(key)))reject();
 const {id,competitionId,marker,day,round,homeClubId,awayClubId}=fixture;
 const match=typeof id==='string'?
  /^season:([1-9][0-9]{0,6}):/.exec(id):null;
 if(!match||!competitionPattern.test(competitionId)||
    !markerPattern.test(marker)||!clubPattern.test(homeClubId)||
    !clubPattern.test(awayClubId)||homeClubId===awayClubId||
    !Number.isSafeInteger(day)||day<1||day>56||
    !Number.isSafeInteger(round)||round<1||round>33)reject();
 const season=Number(match[1]);
 const international=competitionId.startsWith('int-');
 if((international&&marker.startsWith('N'))||
    (!international&&!marker.startsWith('N'))||
    (!international&&(
     !homeClubId.startsWith(competitionId.slice(0,competitionId.indexOf('-'))+'-')||
     !awayClubId.startsWith(competitionId.slice(0,competitionId.indexOf('-'))+'-')
    ))||
    id!==`season:${season}:${competitionId}:${marker}:${homeClubId}:${awayClubId}`)
  reject();
 return Object.freeze({id,season,competitionId,marker,day,round,
  homeClubId,awayClubId});
}


// ME-PB-55 / A4.1: sealed match-step event feed from the very same Rapier
// shoe/ball collision state. This mapping is NOT an action, possession,
// interception, tackle or score classifier. No caller can inject events.
export const PHYSICAL_FIXTURE_CONTACT_FEED_VERSION=
 'me-pb-55-fixture-shoe-collision-feed-v1';
function createClosedFixtureContactFeed(temporarySquad){
 const actors=temporarySquad.players;
 const index=new Map(actors.map((p,i)=>[p.engineId,i]));
 let nextTick=0,previousActive=new Set();
 const events=(ids,label)=>{
  if(!Array.isArray(ids))throw new TypeError('Real Rapier '+label+' IDs required');
  let last=-1;
  return Object.freeze(ids.map(id=>{
   const order=index.get(id);
   if(order===undefined||order<=last)throw new TypeError(
    'Only canonical ordered known Rapier shoe IDs are allowed');
   last=order;
   const p=actors[order];
   return Object.freeze({
    engineId:p.engineId,team:p.team,clubId:p.clubId,
    squadNumber:p.squadNumber,tacticalRole:p.tacticalRole,
    playerId:null,generatedPlayerId:null,temporary:true
   });
  }));
 };
 return function observe(contact){
  if(!contact||contact.tick!==nextTick||!Number.isSafeInteger(nextTick))
   throw new Error('Nonconsecutive internal Rapier contact feed');
  const started=events(contact.started,'START');
  const ended=events(contact.ended,'END');
  const active=events(contact.active,'ACTIVE');
  const starts=new Set(started.map(p=>p.engineId));
  const ends=new Set(ended.map(p=>p.engineId));
  const actual=new Set(active.map(p=>p.engineId));
  const expected=new Set(previousActive);
  if(nextTick===0&&(starts.size||ends.size||actual.size))
   throw new Error('Tick-zero Rapier contact cannot be invented');
  for(const id of starts){
   if(expected.has(id)||ends.has(id))throw new Error(
    'Rapier contact START cannot duplicate an already active shoe');
   expected.add(id);
  }
  for(const id of ends){
   if(!expected.delete(id))throw new Error(
    'Rapier contact END requires prior active shoe');
  }
  if(expected.size!==actual.size||[...expected].some(id=>!actual.has(id)))
   throw new Error('Rapier START/END/ACTIVE transition mismatch');
  previousActive=expected;
  nextTick++;
  return Object.freeze({
   version:PHYSICAL_FIXTURE_CONTACT_FEED_VERSION,
   physicsTick:contact.tick,fixtureId:temporarySquad.fixtureId,
   contactSource:'same-step-real-rapier-shoe-ball-collider',
   started,ended,active,
   anyActive:active.length>0,multipleActive:active.length>1,
   shoesInPhysics:actors.length,
   temporaryPlayersOnly:true,generatedPlayersUsed:false,
   realPlayerRosterBound:false,realFootEventsOnly:true,
   independentContactInjection:false,
   officialMatchAction:false,officialMatchPossession:false,
   officialGoalEvidence:false,scoreAuthority:'external-temporary-score-v1',
   lifecycleIntegrated:false
  });
 };
}


// ME-PB-55 / A4.2a: the normal autonomous movement decision of every
// temporary player consumes a genuine same-tick Rapier contact event.
// This is a read-only decision observation, not game-action execution.
export const PHYSICAL_FIXTURE_DUTY_CONTACT_VERSION=
 'me-pb-55-physical-contact-autonomous-duty-observation-v1';
function createClosedAutonomousContactReader(squad,carryMode=false,carrySupportMode=false){
 const players=squad.players,byId=new Map(players.map(p=>[p.engineId,p]));
 const kinds=new Set(['press','cover','screen','support','balance',
  'recover','formation','goalkeeper-position','receive-pass-intent',
  'challenge-pass-intent','attack-support-intent','carry-follow-intent',
  'challenge-carry-intent']);
 let expectedTick=0,lastAuthenticatedPass=null,lastAuthenticatedCarry=null;
 let lastAuthenticatedCarryShoeEndTick=null;
 return function observe(feed,movement,action,actionMode){
  if(!feed||!movement||feed.physicsTick!==expectedTick||
     movement.physicsTick!==expectedTick||
     movement.dutySource!=='internal-canonical-autonomous-player-mover'||
     !Array.isArray(movement.players)||movement.players.length!==22||
     feed.fixtureId!==squad.fixtureId||
     feed.officialMatchAction!==false||
     movement.officialMatchAction!==false)
   throw new Error('Untrusted or mismatched same-tick movement/contact decision');
  if(typeof actionMode!=='boolean'||(action&&!actionMode))
   throw new Error('Untrusted fixture action opt-in');
  if(action&&(!feed.started.some(a=>a.engineId===action.playerId)||
     feed.started.length!==1||feed.active.length!==1||
     feed.active[0].engineId!==action.playerId||
     action.tick!==expectedTick||action.appliedByRapier!==true||
     action.actualPhysicsImpulseApplied!==true||
     action.officialMatchAction!==false||
     !['pass','shot','clearance','carry'].includes(action.action)||
     (action.action==='carry'&&!carryMode)))
   throw new Error('Local action has no authenticated real shoe contact');
  const duties=Object.freeze(movement.players.map((d,i)=>{
   const player=players[i];
   if(!d||d.engineId!==player.engineId||d.team!==player.team||
      d.role!==player.tacticalRole||!kinds.has(d.movementDuty)||
      d.dutySource!=='actual-60hz-autonomous-movement-assignment'||
      d.ballActionSelected!==false||d.footballActionExecuted!==false)
    throw new Error('Autonomous player duty not backed by canonical mover');
   return Object.freeze({
    engineId:player.engineId,team:player.team,
    clubId:player.clubId,movementDuty:d.movementDuty,
    tacticalRole:player.tacticalRole,temporary:true,playerId:null,
    intendedFootballAction:null,actionExecuted:false
   });
  }));
  const attackSupportRun=movement.attackSupportRun??null;
  const supportAge=attackSupportRun&&lastAuthenticatedPass?
   expectedTick-lastAuthenticatedPass.tick:0;
  const carryLink=attackSupportRun?.carryContinuation??null;
  const extendedSupportValid=Boolean(carrySupportMode&&carryMode&&
   supportAge>240&&supportAge<=480&&
   attackSupportRun?.phase==='post-carry-support'&&
   attackSupportRun?.possibleShotWindow===false&&
   attackSupportRun?.liveBallGapM<=12&&lastAuthenticatedCarry&&
   lastAuthenticatedCarry.tick>lastAuthenticatedPass.tick&&
   lastAuthenticatedCarry.tick<expectedTick&&
   expectedTick-lastAuthenticatedCarry.tick<=150&&
   lastAuthenticatedCarry.team===lastAuthenticatedPass.team&&
   carryLink?.source==='later-exclusive-real-rapier-ground-carry'&&
   carryLink?.movementIntentOnly===true&&
   carryLink?.sourceCarryTick===lastAuthenticatedCarry.tick&&
   carryLink?.carrierId===lastAuthenticatedCarry.playerId&&
   carryLink?.team===lastAuthenticatedCarry.team);
  if(attackSupportRun&&(
    !actionMode||!lastAuthenticatedPass||
    attackSupportRun.source!=='prior-authenticated-exclusive-rapier-pass'||
    attackSupportRun.sourcePassTick!==lastAuthenticatedPass.tick||
    attackSupportRun.team!==lastAuthenticatedPass.team||
    attackSupportRun.physicsTick!==expectedTick||
    !Number.isSafeInteger(attackSupportRun.sourcePassTick)||
    expectedTick<=attackSupportRun.sourcePassTick||
    (supportAge>240&&!extendedSupportValid)||
    (supportAge<=240&&carryLink!==null)||
    (supportAge<=240&&attackSupportRun.phase==='post-carry-support')||
    attackSupportRun.movementIntentOnly!==true||
    attackSupportRun.footballActionExecuted!==false||
    attackSupportRun.officialMatchPossession!==false||
    attackSupportRun.officialMatchResult!==null||
    !['off-ball-support','live-shot-window-ball-approach','post-carry-support'].includes(
      attackSupportRun.phase)||
    attackSupportRun.possibleShotWindow!==
     (attackSupportRun.phase==='live-shot-window-ball-approach')||
    !Number.isFinite(attackSupportRun.liveBallGapM)||
    attackSupportRun.liveBallGapM<0||
    (attackSupportRun.possibleShotWindow&&
      attackSupportRun.liveBallGapM>12)||
    attackSupportRun.physicalShoeStartObserved!==false||
    attackSupportRun.shotExecuted!==false||
    !Number.isFinite(attackSupportRun.target?.x)||
    !Number.isFinite(attackSupportRun.target?.y)||
    duties.filter(d=>d.movementDuty==='attack-support-intent').length!==1||
    !duties.some(d=>d.engineId===attackSupportRun.playerId&&
      d.team===attackSupportRun.team&&d.tacticalRole==='forward'&&
      d.movementDuty==='attack-support-intent')))
   throw new Error('Attacking run without preceding authentic Rapier pass');
  if(!attackSupportRun&&duties.some(d=>
    d.movementDuty==='attack-support-intent'))
   throw new Error('Phantom attacking run not backed by mover');
  const carryPursuit=movement.carryPursuit??null;
  if(carryPursuit&&(
    !carryMode||!actionMode||!lastAuthenticatedCarry||
    carryPursuit.source!=='prior-exclusive-real-rapier-short-ground-touch'||
    carryPursuit.sourceCarryTick!==lastAuthenticatedCarry.tick||
    carryPursuit.playerId!==lastAuthenticatedCarry.playerId||
    carryPursuit.team!==lastAuthenticatedCarry.team||
    carryPursuit.physicsTick!==expectedTick||
    expectedTick-carryPursuit.sourceCarryTick<1||
    expectedTick-carryPursuit.sourceCarryTick>150||
    carryPursuit.physicalShoeEndTick!==lastAuthenticatedCarryShoeEndTick||
    carryPursuit.approachPhase!==(
     lastAuthenticatedCarryShoeEndTick===null?
      'shoe-release-spacing':'live-ball-recontact')||
    !Number.isFinite(carryPursuit.actualBallGapM)||
    carryPursuit.actualBallGapM<0||
    carryPursuit.actualBallGapM>14||
    !Number.isFinite(carryPursuit.target?.x)||
    !Number.isFinite(carryPursuit.target?.y)||
    carryPursuit.movementIntentOnly!==true||
    carryPursuit.newShoeStartObserved!==false||
    carryPursuit.dribbleConfirmed!==null||
    carryPursuit.officialMatchPossession!==false||
    carryPursuit.officialMatchResult!==null||
    duties.filter(d=>d.movementDuty==='carry-follow-intent').length!==1||
    !duties.some(d=>d.engineId===carryPursuit.playerId&&
      d.team===carryPursuit.team&&
      d.movementDuty==='carry-follow-intent')))
   throw new Error('Same-player carry pursuit without authenticated prior Rapier touch');
  if(!carryPursuit&&duties.some(d=>
     d.movementDuty==='carry-follow-intent'))
   throw new Error('Fabricated physical carry pursuit movement duty');
  // C3.3d: sealed carry-only movement intention, never physical-contact
  // evidence or an official football assignment. The trusted mover can
  // select a rival ONLY after the previous real Rapier END was observed.
  const carryChallengerId=movement.carryChallengerId??null;
  const challengerActor=carryChallengerId===null?null:
   byId.get(carryChallengerId);
  const carryBlockedBy=movement.carryChallengerBlockedBy??null;
  if((carryChallengerId===null&&carryBlockedBy!==null)||
     (carryChallengerId!==null&&carryBlockedBy!==null&&
      (!byId.has(carryBlockedBy)||carryBlockedBy===carryChallengerId)))
   throw new Error('Untrusted same-tick canonical carry defender blocker');
  // Keep EVERY integrity guard. A rejected source should state exactly
  // which independent provenance check failed, without dumping user data.
  const challengerViolations=[];
  if(carryChallengerId!==null){
   if(!actionMode||!carryMode)challengerViolations.push('not-opted-in');
   if(!lastAuthenticatedCarry)challengerViolations.push('no-prior-carry');
   if(lastAuthenticatedCarryShoeEndTick===null)
    challengerViolations.push('no-real-shoe-end');
   if(lastAuthenticatedCarryShoeEndTick!==null&&
      expectedTick<=lastAuthenticatedCarryShoeEndTick)
    challengerViolations.push('end-not-in-past');
   if(lastAuthenticatedCarry&&
      expectedTick-lastAuthenticatedCarry.tick>150)
    challengerViolations.push('expired');
   if(!challengerActor)challengerViolations.push('not-canonical-player');
   if(challengerActor&&lastAuthenticatedCarry&&
      challengerActor.team===lastAuthenticatedCarry.team)
    challengerViolations.push('not-opposing-team');
   if(challengerActor?.tacticalRole==='goalkeeper')
    challengerViolations.push('keeper');
   if(duties.filter(d=>d.movementDuty==='challenge-carry-intent').length!==1)
    challengerViolations.push('duty-count');
   if(!duties.some(d=>d.engineId===carryChallengerId&&
       d.movementDuty==='challenge-carry-intent'))
    challengerViolations.push('duty-identity');
  }else if(duties.some(d=>d.movementDuty==='challenge-carry-intent'))
   challengerViolations.push('phantom-duty');
  if(challengerViolations.length)
   throw new Error('Untrusted opponent carry challenger: '+
    challengerViolations.join(','));
  const flank=movement.carryChallengerFlank??null;
  if(flank&&(
    !carryChallengerId||!lastAuthenticatedCarry||
    lastAuthenticatedCarryShoeEndTick===null||
    flank.source!=='observed-carrier-hard-step-rejection'||
    flank.sourceCarryTick!==lastAuthenticatedCarry.tick||
    flank.physicsTick!==expectedTick||
    flank.carrierId!==lastAuthenticatedCarry.playerId||
    flank.challengerId!==carryChallengerId||
    ![1,-1].includes(flank.side)||
    !['lateral-bypass','along-carrier-flank',
     'ball-side-shoe-approach'].includes(flank.phase)||
    !Number.isFinite(flank.target?.x)||
    !Number.isFinite(flank.target?.y)||
    !Number.isFinite(flank.carrierBallGapM)||
    flank.carrierBallGapM<0||
    !Number.isFinite(flank.waypointCarrierClearanceM)||
    flank.waypointCarrierClearanceM<1.10||
    !Number.isFinite(flank.segmentCarrierClearanceM)||
    ![true,false].includes(flank.bodySafeShortArc)||
    (flank.bodySafeShortArc&&(
     !flank.carrierId.startsWith('away-')||
     flank.phase!=='lateral-bypass'||
     flank.carrierBallGapM<=1.10||
     flank.segmentCarrierClearanceM<0.98-1e-9))||
    flank.movementIntentOnly!==true||
    flank.physicalShoeContactObserved!==false||
    flank.ballControlConfirmed!==null||
    flank.dribbleConfirmed!==null||
    flank.officialMatchPossession!==false||
    flank.officialMatchResult!==null))
   throw new Error('Untrusted lateral opponent carry waypoint');
  const carryChallenger=challengerActor?Object.freeze({
   source:'previous-authenticated-rapier-carry-with-physical-shoe-end',
   sourceCarrierId:lastAuthenticatedCarry.playerId,
   sourceCarrierTeam:lastAuthenticatedCarry.team,
   sourceCarryTick:lastAuthenticatedCarry.tick,
   physicalShoeEndTick:lastAuthenticatedCarryShoeEndTick,
   challengerId:carryChallengerId,challengerTeam:challengerActor.team,
   physicsTick:expectedTick,
   selectedByObservedLive22Players:true,movementIntentOnly:true,
   blockedBy:carryBlockedBy,realMoverStepRejected:carryBlockedBy!==null,
   flank:flank?Object.freeze({...flank}):null,
   actualRapierShoeActive:feed.active.some(p=>
    p.engineId===carryChallengerId),
   ballControlConfirmed:null,dribbleConfirmed:null,
   officialMatchPossession:false,officialMatchResult:null
  }):null;
  const dutyById=new Map(duties.map(p=>[p.engineId,p]));
  const paired=phase=>Object.freeze(feed[phase].map(actor=>{
   const assignment=dutyById.get(actor.engineId);
   if(!assignment||assignment.team!==actor.team||
      assignment.clubId!==actor.clubId)
    throw new Error('Rapier shoe has no corresponding autonomous duty');
   return Object.freeze({
    ...assignment,contactPhase:phase,contactTick:feed.physicsTick,
    contactSource:'real-rapier-collider',
    footballActionAuthorized:false,ballOwnershipConfirmed:false
   });
  }));
  const readout=Object.freeze({
   version:PHYSICAL_FIXTURE_DUTY_CONTACT_VERSION,
   fixtureId:squad.fixtureId,physicsTick:expectedTick,
   source:'same-physics-tick-real-mover-and-rapier',
   playerCount:22,duties,
   started:paired('started'),active:paired('active'),ended:paired('ended'),
   allPlayersHomogeneous:true,
   matchesPhysicalContactFeed:true,
   physicalFootContactsObserved:feed.anyActive,
   tacticalMovementObserved:true,
   attackSupportRun,carryPursuit,carryChallenger,
   actionPolicyConnected:actionMode,
   localAutonomousAction:action??null,
   footballActionExecuted:action!==null,officialMatchPossession:false,
   officialGoalEvidence:false,productionScoringConnected:false
  });
  if(action?.action==='carry'){
   lastAuthenticatedCarry=Object.freeze({
    tick:action.tick,playerId:action.playerId,team:action.team
   });
   lastAuthenticatedCarryShoeEndTick=null;
  }else if(action){
   lastAuthenticatedCarry=null;
   lastAuthenticatedCarryShoeEndTick=null;
  }
  // Independently verify that the SAME physical feed has an actual END.
  if(lastAuthenticatedCarry&&lastAuthenticatedCarryShoeEndTick===null&&
     feed.ended.some(s=>s.engineId===lastAuthenticatedCarry.playerId)&&
     expectedTick>lastAuthenticatedCarry.tick)
   lastAuthenticatedCarryShoeEndTick=expectedTick;
  if(action?.action==='pass')lastAuthenticatedPass=Object.freeze({
   tick:action.tick,team:action.team,playerId:action.playerId,
   recipientId:action.recipientId
  });
  expectedTick++;
  return readout;
 };
}

export function createPhysicalFixtureStepRuntime(
 RAPIER,fixture,scenario,options={}
){
 const identity=normalizePhysicalFixture(fixture);
 // Fixture-club labels are backed by the validated fixture identity.
 // They never create an affiliation or a generated player ID.
 const temporarySquad=createTemporaryUniformFixtureSquad(identity);
 // The internal record includes derived season, whereas the public fixture
 // has EXACTLY seven fields. Reset must use a sealed external-shape copy,
 // never the derived record or a mutable caller-supplied object.
 const resetFixture=Object.freeze({
  id:identity.id,competitionId:identity.competitionId,
  marker:identity.marker,day:identity.day,round:identity.round,
  homeClubId:identity.homeClubId,awayClubId:identity.awayClubId
 });
 if(!scenario||typeof scenario!=='object'||Array.isArray(scenario))reject();
 if(!options||typeof options!=='object'||Array.isArray(options)||
    Reflect.ownKeys(options).some(k=>k!=='globalResponse'&&
     k!=='autonomousActions'&&k!=='researchShotAttacker'&&
     k!=='autonomousCarry'&&k!=='autonomousCarrySupport'&&
      k!=='autonomousCarrySupportPressHandoff'&&
     k!=='autonomousCarryAttackContinuity'&&
      k!=='autonomousCarrySupportBallAccess'&&
      k!=='autonomousCarrySupportLateralAlign'&&
      k!=='autonomousCarrySupportEarlyFacing'&&
      k!=='autonomousCarrySupportShoeCenterTarget'&&
      k!=='autonomousCarrySupportFootLateralLead'&&
      k!=='autonomousCarrySupportObservedBallVelocityLead'&&
      k!=='autonomousCarrySupportTerminalFacingLead'&&
      k!=='autonomousCarrySupportTerminalRunThrough'&&
      k!=='autonomousCarrySupportTerminalLateralSlip'&&
       k!=='autonomousCarrySupportLongitudinalLead'))reject();
 if(Object.hasOwn(options,'autonomousActions')&&options.autonomousActions!==true)
  reject();
 if(Object.hasOwn(options,'researchShotAttacker')&&(
   !['home','away'].includes(options.researchShotAttacker)||
   options.autonomousActions!==true))reject();
 if(Object.hasOwn(options,'autonomousCarry')&&(
   options.autonomousCarry!==true||
   options.autonomousActions!==true||
   Object.hasOwn(options,'researchShotAttacker')))reject();
 if(Object.hasOwn(options,'autonomousCarrySupport')&&
   (options.autonomousCarrySupport!==true||
    options.autonomousCarry!==true||
    Object.hasOwn(options,'researchShotAttacker')))reject();
 const initial=normalizeScenario(scenario);
 const autonomousActions=options.autonomousActions===true;
 const autonomousCarry=options.autonomousCarry===true;
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
 const source=createUniversalMatchBallSession(RAPIER,initial,options);
 const response=source.snapshot().globalResponse;
 const observeContact=createClosedFixtureContactFeed(temporarySquad);
 const observeAutonomousDutyContact=createClosedAutonomousContactReader(
  temporarySquad,autonomousCarry,autonomousCarrySupport);
 const observeActionOutcome=createProvisionalActionOutcomeObserver(identity.id).observe;
 const observePhysicalShot=createPhysicalShotBoundaryObserver(identity.id).observe;
 const observePhysicalBallVolume=createPhysicalBallVolumeBoundaryObserver(identity.id).observe;
 const observePhysicalCarrySequence=
  createPhysicalCarryContactSequenceObserver(identity.id).observe;
 const observePhysicalCarryProximity=
  createPhysicalCarryProximityObserver(identity.id).observe;
 let closed=false;
 const ensureOpen=()=>{if(closed)throw new Error('Fixture physics runtime disposed');};
 const wrap=frame=>{
  if(frame.experimentalLocalOnly!==true||
     frame.matchRuntimeIntegrated!==false||
     frame.officialMatchPossession!==false||
     frame.ballForceApplied!==(frame.localAutonomousAction!==null)||
     frame.autonomousActionMode!==autonomousActions||
     frame.autonomousCarryMode!==autonomousCarry||
     Boolean(frame.autonomousCarrySupportMode)!==autonomousCarrySupport||
     Boolean(frame.autonomousCarryAttackContinuityMode)!==
       autonomousCarryAttackContinuity||
      Boolean(frame.autonomousCarrySupportPressHandoffMode)!==
      autonomousCarrySupportPressHandoff||
     Boolean(frame.autonomousCarrySupportBallAccessMode)!==
      autonomousCarrySupportBallAccess||
     Boolean(frame.autonomousCarrySupportLateralAlignMode)!==
      autonomousCarrySupportLateralAlign||
     Boolean(frame.autonomousCarrySupportEarlyFacingMode)!==
      autonomousCarrySupportEarlyFacing||
     Boolean(frame.autonomousCarrySupportShoeCenterTargetMode)!==
      autonomousCarrySupportShoeCenterTarget||
     Boolean(frame.autonomousCarrySupportFootLateralLeadMode)!==
      autonomousCarrySupportFootLateralLead||
     Boolean(frame.autonomousCarrySupportObservedBallVelocityLeadMode)!==
      autonomousCarrySupportObservedBallVelocityLead||
     Boolean(frame.autonomousCarrySupportTerminalFacingLeadMode)!==
      autonomousCarrySupportTerminalFacingLead||
     Boolean(frame.autonomousCarrySupportTerminalRunThroughMode)!==
      autonomousCarrySupportTerminalRunThrough||
     Boolean(frame.autonomousCarrySupportTerminalLateralSlipMode)!==
      autonomousCarrySupportTerminalLateralSlip||
     Boolean(frame.autonomousCarrySupportLongitudinalLeadMode)!==
      autonomousCarrySupportLongitudinalLead||
     frame.officialMatchAction!==false||
     frame.playerCount!==22||
     frame.footContact?.tick!==frame.physicsTick||
     frame.autonomousMovement?.physicsTick!==frame.physicsTick)
   throw new Error('Untrusted physical fixture step source');
  const positions=frame.physicalPlayerPositions;
  if(!Object.isFrozen(positions)||positions.length!==22||
     positions.some((p,i)=>p.engineId!==temporarySquad.players[i].engineId||
      p.team!==temporarySquad.players[i].team||
      !Object.isFrozen(p)||!Number.isFinite(p.x)||!Number.isFinite(p.y)))
   throw new Error('Untrusted same-tick read-only player positions');
  const physicalContactFeed=observeContact(frame.footContact);
  const contactDecisionObservation=observeAutonomousDutyContact(
   physicalContactFeed,frame.autonomousMovement,
   frame.localAutonomousAction,autonomousActions);
  // C3.3g: the geometric actor sample is sealed inside the SAME mover
  // tick that Rapier used for shoe pose. It is never an input to physics,
  // a guessed contact, or a replacement for the actual START/ACTIVE feed.
  const shoeGeometry=autonomousCarry?
   frame.actualCarryChallengerShoeGeometry??null:null;
  const challenger=contactDecisionObservation.carryChallenger;
  if((autonomousCarry&&
      !Object.hasOwn(frame,'actualCarryChallengerShoeGeometry'))||
     (!autonomousCarry&&
      Object.hasOwn(frame,'actualCarryChallengerShoeGeometry'))||
     Boolean(shoeGeometry)!==Boolean(challenger))
   throw new Error('Untrusted physical carry shoe-geometry observation mode');
  if(shoeGeometry){
   const actor=positions.find(p=>p.engineId===challenger.challengerId);
   const face=shoeGeometry.actualFacingRad;
   if(!actor||
      !Object.isFrozen(shoeGeometry)||!Object.isFrozen(shoeGeometry.shoeCenter)||
      shoeGeometry.version!==CARRY_ORIENTED_SHOE_GEOMETRY_VERSION||
      shoeGeometry.source!=='same-60hz-moved-rapier-shoe-transform'||
      shoeGeometry.readOnly!==true||
      shoeGeometry.engineId!==challenger.challengerId||
      shoeGeometry.team!==challenger.challengerTeam||
      shoeGeometry.physicsTick!==frame.physicsTick||
      !Number.isFinite(face)||Math.abs(face)>Math.PI+1e-5||
      Math.abs(shoeGeometry.bodyX-actor.x)>1e-8||
      Math.abs(shoeGeometry.bodyY-actor.y)>1e-8||
      Math.abs(shoeGeometry.shoeCenter.x-
       (actor.x+FOOT_CONTACT_FORWARD_OFFSET_M*Math.cos(face)))>1e-8||
      Math.abs(shoeGeometry.shoeCenter.y-
       (actor.y+FOOT_CONTACT_FORWARD_OFFSET_M*Math.sin(face)))>1e-8||
      Math.abs(shoeGeometry.shoeCenter.z-
       FOOT_CONTACT_CENTER_HEIGHT_M)>1e-8||
      !Number.isFinite(shoeGeometry.shoeBallCenter3DGapM)||
      !Number.isFinite(shoeGeometry.estimatedStaticSurfaceClearanceM)||
      shoeGeometry.estimatedStaticSurfaceClearanceM<0||
      shoeGeometry.actualRapierCollisionInferred!==false||
      shoeGeometry.ballControlConfirmed!==null||
      shoeGeometry.dribbleConfirmed!==null||
      shoeGeometry.officialMatchPossession!==false)
    throw new Error('Untrusted same-tick real Rapier shoe orientation geometry');
  }
  const physicalCarryContactSequence=observePhysicalCarrySequence({
   physicsTick:frame.physicsTick,ballSnapshot:frame.ballSnapshot,
   physicalContactFeed,localAutonomousAction:frame.localAutonomousAction
  });
  if(physicalCarryContactSequence.version!==PHYSICAL_CARRY_SEQUENCE_VERSION||
     physicalCarryContactSequence.physicsTick!==frame.physicsTick||
     physicalCarryContactSequence.fixtureId!==identity.id||
     physicalCarryContactSequence.readOnly!==true||
     physicalCarryContactSequence.carryConfirmed!==null||
     physicalCarryContactSequence.dribbleConfirmed!==null||
     physicalCarryContactSequence.officialMatchPossession!==false||
     physicalCarryContactSequence.officialMatchResult!==null||
     !Number.isSafeInteger(physicalCarryContactSequence.verifiedGroundCarryRecontacts)||
     physicalCarryContactSequence.verifiedGroundCarryRecontacts<0||
     physicalCarryContactSequence.latestVerifiedGroundCarryRecontact?.secondShoeTick>
      frame.physicsTick||
     physicalCarryContactSequence.latestPair?.to.physicsTick>
       frame.physicsTick)
   throw new Error('Untrusted physical successive shoe-contact audit');
  const physicalCarryProximity=observePhysicalCarryProximity({
   physicsTick:frame.physicsTick,ballSnapshot:frame.ballSnapshot,
   physicalPlayerPositions:positions,
   physicalContactFeed,localAutonomousAction:frame.localAutonomousAction,
   physicalCarryContactSequence
  });
  if(physicalCarryProximity.version!==CARRY_PROXIMITY_VERSION||
     physicalCarryProximity.physicsTick!==frame.physicsTick||
     physicalCarryProximity.fixtureId!==identity.id||
     physicalCarryProximity.readOnly!==true||
     physicalCarryProximity.proximityIsNotPossession!==true||
     physicalCarryProximity.ballControlConfirmed!==null||
     physicalCarryProximity.dribbleConfirmed!==null||
     physicalCarryProximity.officialMatchPossession!==false||
     physicalCarryProximity.officialMatchResult!==null||
     physicalCarryProximity.measuredWindows>
      physicalCarryContactSequence.verifiedGroundCarryRecontacts||
     physicalCarryProximity.latestMeasuredWindow?.secondShoeTick>
      frame.physicsTick||
     physicalCarryProximity.latestInterruptedWindow?.observedThroughTick>
      frame.physicsTick||
     !Object.isFrozen(physicalCarryProximity.interruptionReasons)||
     PROXIMITY_INTERRUPTION_REASONS.some(reason=>
      !Number.isSafeInteger(physicalCarryProximity.interruptionReasons[reason])||
      physicalCarryProximity.interruptionReasons[reason]<0)||
     Object.values(physicalCarryProximity.interruptionReasons)
      .reduce((count,value)=>count+value,0)!==
       physicalCarryProximity.interruptedWindows||
     (physicalCarryProximity.latestInterruptedWindow&&(
      physicalCarryProximity.latestInterruptedWindow.dribbleConfirmed!==null||
      physicalCarryProximity.latestInterruptedWindow.officialMatchResult!==null||
      physicalCarryProximity.latestInterruptedWindow.officialMatchPossession!==false)))
   throw new Error('Untrusted read-only physical carry proximity window');
  const physicalBallVolumeBoundary=observePhysicalBallVolume({
   physicsTick:frame.physicsTick,ballPosition:frame.ball.position
  });
  if(physicalBallVolumeBoundary.version!==PHYSICAL_BALL_VOLUME_BOUNDARY_VERSION||
     physicalBallVolumeBoundary.physicsTick!==frame.physicsTick||
     physicalBallVolumeBoundary.fixtureId!==identity.id||
     physicalBallVolumeBoundary.goalScored!==null||
     physicalBallVolumeBoundary.officialMatchResult!==null||
     physicalBallVolumeBoundary.officialOutOfPlay!==null||
     physicalBallVolumeBoundary.productionScoringConnected!==false)
   throw new Error('Untrusted read-only whole-ball boundary observation');
  const physicalShotBoundary=observePhysicalShot({
   physicsTick:frame.physicsTick,ballPosition:frame.ball.position,
   localAutonomousAction:frame.localAutonomousAction,physicalContactFeed
  });
  const physicalActionOutcome=observeActionOutcome({
   physicsTick:frame.physicsTick,ballSnapshot:frame.ballSnapshot,
   physicalContactFeed,localAutonomousAction:frame.localAutonomousAction,
   autonomousActionMode:autonomousActions
  });
  // ME-PB-55 A4.3c: assert the closed source/fixture/observer join on
  // EVERY 60Hz frame. A real applied impulse is NOT a football result.
  const active=physicalActionOutcome.active;
  const terminal=physicalActionOutcome.lastCompleted;
  const passFollow=physicalActionOutcome.physicalPassFollowThrough;
  const opponentChallenge=passFollow?.opponentChallenge;
  const defenderFlight=opponentChallenge?.defenderFlight;
  if(contactDecisionObservation.localAutonomousAction!==frame.localAutonomousAction||
     contactDecisionObservation.footballActionExecuted!==
       (frame.localAutonomousAction!==null)||
     physicalActionOutcome.latestExecutedAction!==frame.localAutonomousAction||
     physicalActionOutcome.physicsTick!==frame.physicsTick||
     physicalActionOutcome.fixtureId!==identity.id||
     physicalActionOutcome.actionSuccessAdjudicated!==false||
     physicalActionOutcome.officialMatchResult!==null||
     physicalActionOutcome.officialMatchPossession!==false||
     passFollow?.physicsTick!==frame.physicsTick||
     passFollow.fixtureId!==identity.id||
     passFollow.readOnly!==true||
     passFollow.passCompleted!==null||
     passFollow.officialMatchResult!==null||
     opponentChallenge?.readOnly!==true||
     !defenderFlight||!Object.isFrozen(defenderFlight)||
     defenderFlight.readOnly!==true||
     defenderFlight.physicalEvidenceOnly!==true||
     defenderFlight.observationTicks!==6||
     !Number.isSafeInteger(defenderFlight.pendingCount)||
     defenderFlight.pendingCount<0||
     !Number.isSafeInteger(defenderFlight.completedCount)||
     defenderFlight.completedCount<0||
     defenderFlight.isolatedShoeImpulseProven!==false||
     defenderFlight.interceptionConfirmed!==null||
     defenderFlight.tackleConfirmed!==null||
     defenderFlight.passCompleted!==null||
     defenderFlight.officialMatchPossession!==false||
     defenderFlight.officialMatchResult!==null||
     (defenderFlight.lastCompleted&&(
      !Object.isFrozen(defenderFlight.lastCompleted)||
      !Object.isFrozen(defenderFlight.lastCompleted.samples)||
      defenderFlight.lastCompleted.fixtureId!==identity.id||
      defenderFlight.lastCompleted.sampledFrames!==6||
      defenderFlight.lastCompleted.samples.length!==6||
      defenderFlight.lastCompleted.observedThroughTick!==
       defenderFlight.lastCompleted.contactTick+6||
      defenderFlight.lastCompleted.observedThroughTick>frame.physicsTick||
      defenderFlight.lastCompleted.sourcePassTick>=
       defenderFlight.lastCompleted.contactTick||
      !Number.isFinite(defenderFlight.lastCompleted.path3DM)||
      defenderFlight.lastCompleted.path3DM<0||
      !Number.isFinite(defenderFlight.lastCompleted.velocityDeltaSumMps)||
      defenderFlight.lastCompleted.velocityDeltaSumMps<0||
      defenderFlight.lastCompleted.interceptionConfirmed!==null||
      defenderFlight.lastCompleted.officialMatchPossession!==false||
      defenderFlight.lastCompleted.samples.some((sample,i)=>
       !Object.isFrozen(sample)||!Object.isFrozen(sample.position)||
       !Object.isFrozen(sample.velocity)||
       sample.physicsTick!==defenderFlight.lastCompleted.contactTick+i+1)))||
     opponentChallenge.authenticShoeStartsOnly!==true||
     opponentChallenge.interceptionConfirmed!==null||
     opponentChallenge.tackleConfirmed!==null||
     opponentChallenge.passCompleted!==null||
     opponentChallenge.officialMatchResult!==null||
     (opponentChallenge.active&&(
       opponentChallenge.active.status!=='observing'||
       opponentChallenge.active.fixtureId!==identity.id||
       opponentChallenge.active.firstOpponentContact!==null||
       opponentChallenge.active.interceptionConfirmed!==null||
       opponentChallenge.active.passCompleted!==null||
       opponentChallenge.active.observedThroughTick!==frame.physicsTick))||
     (opponentChallenge.lastResolved&&(
       opponentChallenge.lastResolved.fixtureId!==identity.id||
       !['opponent-contact-observed','expired-without-opponent-contact']
        .includes(opponentChallenge.lastResolved.status)||
       opponentChallenge.lastResolved.interceptionConfirmed!==null||
       opponentChallenge.lastResolved.tackleConfirmed!==null||
       opponentChallenge.lastResolved.passCompleted!==null||
       opponentChallenge.lastResolved.officialMatchResult!==null||
       (opponentChallenge.lastResolved.status==='opponent-contact-observed')!==
        (opponentChallenge.lastResolved.firstOpponentContact!==null)||
       (opponentChallenge.lastResolved.firstOpponentContact&&(
         opponentChallenge.lastResolved.firstOpponentContact.physicsTick<=
          opponentChallenge.lastResolved.actionTick||
         opponentChallenge.lastResolved.firstOpponentContact.contacts.some(
          foot=>foot.team===opponentChallenge.lastResolved.passerTeam)||
         opponentChallenge.lastResolved.firstOpponentContact.interceptionConfirmed!==null||
         opponentChallenge.lastResolved.firstOpponentContact.passCompleted!==null))))||
     (passFollow.active&&(
       passFollow.active.status!=='observing'||
       passFollow.active.passCompleted!==null||
       passFollow.active.firstSubsequentContact!==null||
       passFollow.active.observedThroughTick!==frame.physicsTick))||
     (passFollow.lastResolved&&(
       !['contact-observed','expired-without-contact']
        .includes(passFollow.lastResolved.status)||
       passFollow.lastResolved.passCompleted!==null||
       passFollow.lastResolved.firstSubsequentContact?.passCompleted!==null&&
         passFollow.lastResolved.firstSubsequentContact!==null))||
     (active&&(active.actionTick>frame.physicsTick||
       active.elapsedPhysicsTicks!==frame.physicsTick-active.actionTick||
       active.elapsedPhysicsTicks>=PROVISIONAL_ACTION_OBSERVATION_TICKS||
       active.terminal!==false||
       active.officialMatchResult!==null))||
     (terminal&&(terminal.terminal!==true||
       terminal.elapsedPhysicsTicks!==PROVISIONAL_ACTION_OBSERVATION_TICKS||
       terminal.observedThroughTick!==terminal.actionTick+
         PROVISIONAL_ACTION_OBSERVATION_TICKS||
       terminal.shotOnTarget!==null||terminal.passCompleted!==null||
       terminal.interceptionConfirmed!==null||terminal.tackleConfirmed!==null||
       terminal.goalScored!==null||terminal.officialMatchResult!==null)))
   throw new Error('Untrusted physical action aftermath or official score inference');
  return Object.freeze({
   version:PHYSICAL_FIXTURE_RUNTIME_VERSION,
   fixture:identity,fixtureId:identity.id,
   physicsTick:frame.physicsTick,
   elapsedSeconds:frame.physicsTick*FIXED_DT,
   ball:frame.ball,ballSnapshot:frame.ballSnapshot,
   canonicalBall:canonicalSnapshot(frame.ballSnapshot),
   footContact:frame.footContact,
   physicalContactFeed,
   physicalShotBoundary,
   physicalBallVolumeBoundary,
   physicalCarryContactSequence,physicalCarryProximity,
   physicalPlayerPositions:positions,
   ...(autonomousCarry?{physicalCarryChallengerShoeGeometry:shoeGeometry}:{}),
   contactDecisionObservation,
   ...(frame.autonomousMovement.continuityAudit?{
    continuityAudit:Object.freeze({...frame.autonomousMovement.continuityAudit})
   }:{}),
   physicalActionOutcome,
   localAutonomousAction:frame.localAutonomousAction,
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
   localFootballActionExecuted:frame.localFootballActionExecuted,
   ballForceApplied:frame.ballForceApplied,
   globalResponse:frame.globalResponse,playerCount:frame.playerCount,
   movementSource:'canonical-22-local-placeholder-players',
   temporarySquad,
   temporaryPlayerSource:'homogeneous-temporary-actors',
   uniformPlayerStats:true,
   generatedPlayersUsed:false,
   physicalRapierStep:true,realFootEventsOnly:true,
   fixtureCalendarVerified:false,rosterBound:false,
   officialMatchResult:null,officialMatchPossession:false,
   officialMatchActions:false,officialGoalEvidence:false,
   scoreAuthority:'external-temporary-score-v1',
   productionScoringConnected:false,remotePersistence:false
  });
 };
 let last=wrap(source.snapshot());
 function dispose(){if(!closed){closed=true;source.dispose();}}
 function snapshot(...args){ensureOpen();if(args.length)noArgs();return last;}
 function step(...args){
  ensureOpen();if(args.length)noArgs();
  try{
   const frame=wrap(source.step());
   if(frame.physicsTick!==last.physicsTick+1||
      Math.abs(frame.elapsedSeconds-frame.physicsTick*FIXED_DT)>1e-8)
    throw new Error('Nonconsecutive physical fixture clock');
   last=frame;
   return last;
  }catch(error){dispose();throw error;}
 }
 function advance(ticks,...args){
  ensureOpen();if(args.length)noArgs();
  if(!Number.isSafeInteger(ticks)||ticks<1||ticks>600)
   throw new RangeError('Physical fixture advance requires 1..600 ticks');
  const frames=[];
  for(let i=0;i<ticks;i++)frames.push(step());
  return Object.freeze(frames);
 }
 function reset(...args){
  ensureOpen();if(args.length)noArgs();
  const fresh=createPhysicalFixtureStepRuntime(RAPIER,resetFixture,initial,{
   globalResponse:response,
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
   ...(options.researchShotAttacker?{
    researchShotAttacker:options.researchShotAttacker
   }:{})
  });
  dispose();
  return fresh;
 }
 return Object.freeze({snapshot,step,advance,reset,dispose});
}
