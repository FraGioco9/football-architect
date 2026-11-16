// #628 B06a — read-only match clock and provisional scoreboard.
// All events must come from the B05 original Rapier referee and its
// independently rechecked, sequential, live original-ball geometry.
// This observer NEVER awards an official match result, match possession,
// or permission to bypass the real half-time restart.
import {FIXED_DT,ENGINE_VERSION,BALL_RADIUS} from './core.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION} from './player-foot-contact-solver.mjs';
import {FOOT_CONTACT_VERSION} from './player-foot-contact.mjs';
import {UNIFORM_AUTONOMOUS_ACTION_VERSION} from './player-ball-uniform-autonomous-action.mjs';
import {B05_REFEREE_VERSION,detectFirstFullyOutBallB05,
 B05_GOAL_WIDTH_M,B05_GOAL_HEIGHT_M}
 from './basic-match-referee-b05.mjs';
export const B06_TIMELINE_VERSION='me-628-b06-native-match-timeline-v1';
export const B06_HALF_TICKS=45*60*60;
export const B06_FULL_TICKS=90*60*60;
const freeze=Object.freeze;
const validTeam=x=>x==='home'||x==='away';
const positiveInteger=n=>Number.isSafeInteger(n)&&n>=0;
const ballXYZ=b=>b&&['x','y','z'].every(k=>Number.isFinite(b[k]));
export function basicMatchClockB06(tick){
 if(!positiveInteger(tick))throw new TypeError('B06 requires a nonnegative original integer 60Hz tick');
 const capped=Math.min(tick,B06_FULL_TICKS);
 const fullSeconds=Math.floor(capped/60);
 const min=Math.floor(fullSeconds/60),sec=fullSeconds%60;
 const label=String(min).padStart(2,'0')+':'+String(sec).padStart(2,'0');
 return freeze({
  sourceTick:tick,source:'original-fixed-60hz-rapier-tick',
  elapsedS:capped*FIXED_DT,
  label,minute:min,second:sec,
  halfTimeReached:tick>=B06_HALF_TICKS,
  regulation90Reached:tick>=B06_FULL_TICKS,
  phase:tick<B06_HALF_TICKS?'first-half':
   tick===B06_HALF_TICKS?'half-time-boundary':
   tick<B06_FULL_TICKS?'second-half-clock-projection':'full-time-clock-boundary',
  halfTimeRestartVerified:false,
  completedMatchVerified:false,
  readOnlyClock:true
 });
}
export function createBasicMatchTimelineB06({b06bRealHalftimePause=false}={}){
 if(typeof b06bRealHalftimePause!=='boolean')
  throw new TypeError('B06b half-time pause is exclusively boolean');
 let tick=-1,lastBall=null,lastEvent=null,lastRestart=null,
  lastSetPiece=null,lastGoalKickoff=null,lastNativeShot=null,
  events=freeze([]),
  score=freeze({home:0,away:0});
 const eventTicks=new Set();
 function snapshot(){
  const clock=basicMatchClockB06(Math.max(0,tick));
  const deadBall=lastEvent!==null&&lastRestart?.sourceEventTick!==lastEvent.tick;
  return freeze({
   version:B06_TIMELINE_VERSION,tick,
   clock,provisionalScore:score,
   matchEvents:events,matchEventCount:events.length,
   lastNativeBoundaryEvent:lastEvent,
   lastPhysicalRestart:lastRestart,lastPhysicalSetPiece:lastSetPiece,
   lastPhysicalGoalKickoff:lastGoalKickoff,
   lastOriginalNativeShot:lastNativeShot,
   phase:deadBall?'dead-ball-awaiting-source-verified-restart':
    clock.phase,
   outstandingDeadBall:deadBall,
   scoreSource:'original-full-ball-rapier-crossing-only',
   halfTimeRestartVerified:false,fullTimeVerified:false,
   officialMatchScore:null,officialMatchResult:null,
   officialPossession:false,matchAuthority:false,readOnly:true
  });
 }
 function add(event){
  const key=event.type+':'+event.tick;
  if(eventTicks.has(key))
   throw new TypeError('B06 refuses duplicate same-tick original match evidence');
  eventTicks.add(key);
  // A 90-minute match can have >1000 real events; bounded UI history only.
  events=freeze([...events,event].slice(-2048));
 }
 function observe({physics,refereeEvidence}={}){
  const n=physics?.tick,b=physics?.ball?.position;
  if(!positiveInteger(n)||n!==tick+1||
    n>(b06bRealHalftimePause?B06_FULL_TICKS+7200:B06_FULL_TICKS)||
    physics?.version!==ENGINE_VERSION||!ballXYZ(b)||
    refereeEvidence?.version!==B05_REFEREE_VERSION||
    refereeEvidence.tick!==n||
    refereeEvidence.original22Source!==true||
    refereeEvidence.readOnlyObservation!==true||
    refereeEvidence.matchAuthority!==false||
    refereeEvidence.officialMatchResult!==null||
    refereeEvidence.officialPossession!==false||
    !positiveInteger(refereeEvidence.provisionalGoals?.home)||
    !positiveInteger(refereeEvidence.provisionalGoals?.away))
   throw new TypeError('B06 requires the next exact original Rapier/B05 referee tick');
  const latest=refereeEvidence.lastEvent;
  if(latest!==null&&(
    !positiveInteger(latest.tick)||latest.tick>n||
    latest.originalRapierSource!==true||
    latest.officialResult!==false||
    latest.officialMatchPossession!==false))
   throw new TypeError('B06 rejects untrusted native boundary event');
  if(latest?.tick===n){
   const crossing=lastBall?detectFirstFullyOutBallB05(lastBall,b):null;
   if(!crossing||crossing.edge!==latest.kind||
      latest.crossing?.source!=='real-consecutive-rapier-centres'||
      latest.crossing.fullBallCrossed!==true||
      crossing.axis!==latest.crossing.axis||
      crossing.side!==latest.crossing.side||
      !ballXYZ(latest.crossing.intersection)||
      ['x','y','z'].some(k=>Math.abs(
       crossing.intersection[k]-latest.crossing.intersection[k])>1e-6)||
      !Number.isFinite(latest.gameClockS)||
      Math.abs(latest.gameClockS-n*FIXED_DT)>1e-7)
    throw new TypeError('B06 must independently re-observe true fully crossed original Rapier ball');
   const goal=latest.kind==='goal';
   const scorer=goal?(crossing.side===1?'home':'away'):null;
   const restart=latest.restart;
   if(!restart||typeof restart.type!=='string'||
      latest.provisionalGoalScored!==goal||
      latest.goalCountedOnlyInDevLab!==goal||
      latest.scoringTeam!==scorer||
      (goal&&(restart.type!=='kickoff'||restart.ready!==true||
       restart.team!==(scorer==='home'?'away':'home')))||
      (!goal&&!['touchline','goal-line'].includes(latest.kind))||
      (!goal&&(restart.type==='kickoff'||!['throw-in','corner','goal-kick',
       'unresolved-throw-in','unresolved-goal-line'].includes(restart.type)))||
      (restart.ready===false&&(restart.team!==null||
       !restart.type.startsWith('unresolved-'))))
    throw new TypeError('B06 rejects forged goal, team or restart ownership');
   if(lastEvent!==null&&lastRestart?.sourceEventTick!==lastEvent.tick)
    throw new TypeError('B06 rejects a new event before an authenticated prior restart');
   if(goal)score=freeze({...score,[scorer]:score[scorer]+1});
   lastEvent=latest;lastRestart=null;lastSetPiece=null;
   lastGoalKickoff=null;
   add(freeze({
    type:goal?'goal':latest.kind,tick:n,
    elapsedS:n*FIXED_DT,scoringTeam:scorer,
    lastTouchId:latest.lastVerifiedTouch?.playerId??null,
    awardedRestart:restart.type,
    awardedTeam:restart.team,
    originalRapierCrossing:true,
    officialMatchEvent:false
   }));
  }else if(latest!==null&&lastEvent!==latest){
   throw new TypeError('B06 rejects a swapped/stale B05 event without a new crossing');
  }
  if(score.home!==refereeEvidence.provisionalGoals.home||
     score.away!==refereeEvidence.provisionalGoals.away)
   throw new TypeError('B06 score must match independently verified original B05 goals');
  tick=n;lastBall=freeze({...b});
  return snapshot();
 }
 function recordRestart({physicsTick,refereeEvidence,physicalRestart}={}){
  if(tick<1||physicsTick!==tick||!lastEvent||
    lastEvent.tick!==tick||lastRestart!==null||
    refereeEvidence?.lastEvent!==lastEvent||
    refereeEvidence.restartApplied!==true||
    !lastEvent.restart.ready||
    !physicalRestart||physicalRestart.tick!==tick||
    physicalRestart.sourceEventTick!==lastEvent.tick||
    physicalRestart.originalRapierBallRepositioned!==true||
    physicalRestart.realShoeContact!==false||
    physicalRestart.officialMatchResult!==null||
    physicalRestart.kind!==lastEvent.restart.type||
    physicalRestart.assignedTeam!==lastEvent.restart.team)
   throw new TypeError('B06 cannot invent a restart without original exact-tick Rapier placement');
  lastRestart=physicalRestart;
  add(freeze({
   type:'restart-placement',tick,kind:physicalRestart.kind,
   team:physicalRestart.assignedTeam,
   originalGoalOrOutTick:lastEvent.tick,
   sameOriginalRapierBall:true,deadBallPlacementOnly:true,
   officialMatchEvent:false
  }));
  return snapshot();
 }

 // H2b2b1: observe the same ORIGINAL uniform policy, Rapier shoe and solver
 // used in the Action LAB, but now under the regulated 60Hz match clock.
 // A SHOT is an attempt; ball crossing is observed separately by B05/B06.
 function recordNativeLiveShot({
  physicsTick,playedTicks,physics,action,foot,solver,refereeEvidence
 }={}){
  const n=physicsTick,side=action?.team,actor=action?.playerId;
  const target=action?.shotTarget;
  if(n!==tick||n<1||!Number.isSafeInteger(playedTicks)||
     playedTicks<1||playedTicks>B06_FULL_TICKS||
     physics?.version!==ENGINE_VERSION||physics.tick!==n||
     !ballXYZ(physics.ball?.position)||
     !ballXYZ(physics.ball?.velocity)||
     !['home','away'].includes(side)||actor!==side+'-10'||
     action?.tick!==n||action?.version!==UNIFORM_AUTONOMOUS_ACTION_VERSION||
     action.action!=='shot'||action.appliedByRapier!==true||
     action.actualPhysicsImpulseApplied!==true||
     action.actionSource!=='internal-uniform-22-player-ai'||
     action.physicalTrigger!=='same-tick-real-rapier-shoe-start'||
     action.physicalPrerequisites?.physicsTick!==n||
     action.physicalPrerequisites?.actorId!==actor||
     action.physicalPrerequisites?.originalPhysicalGuardsPassed!==true||
     action.physicalPrerequisites?.exclusiveShoeStart!==true||
     action.decisionContext?.shotRange!==true||
     action.officialMatchAction!==false||
     action.officialMatchPossession!==false||
     action.officialGoalEvidence!==false||
     action.officialMatchResult!==null||
     target?.source!=='same-tick-closed-goal-lane-from-live-22-players'||
     target.physicsTick!==n||target.shooterId!==actor||
     target.team!==side||target.attemptOnly!==true||
     target.shotOnTarget!==null||target.goalScored!==null||
     !Number.isFinite(target.originX)||!Number.isFinite(target.originY)||
     !Number.isFinite(target.targetY)||!Number.isFinite(target.laneClearanceM)||
     target.laneClearanceM<2.4||
     target.targetX!==(side==='home'?52.5:-52.5)||
     Math.abs(target.targetY)>3.55||
     Math.hypot(physics.ball.position.x-target.originX,
       physics.ball.position.y-target.originY)>0.02||
     !Number.isFinite(action.impulseNs?.x)||
     !Number.isFinite(action.impulseNs?.y)||
     !Number.isFinite(action.impulseNs?.z)||
     (side==='home'?action.impulseNs.x<=0:action.impulseNs.x>=0)||
     action.impulseNs.z<=0||
     foot?.version!==FOOT_CONTACT_VERSION||
     foot.tick!==n||foot.started?.length!==1||
     foot.active?.length!==1||
     foot.started[0]!==actor||foot.active[0]!==actor||
     solver?.version!==FOOT_SOLVER_EVIDENCE_VERSION||
     solver.tick!==n||!Array.isArray(solver.pairs)||
     !solver.pairs.some(p=>p.id===actor&&p.beganThisTick&&
       p.collisionActive&&p.manifolds?.some(m=>m.geometricContacts>0))||
     refereeEvidence?.version!==B05_REFEREE_VERSION||
     refereeEvidence.tick!==n||refereeEvidence.lastVerifiedTouch?.tick!==n||
     refereeEvidence.lastVerifiedTouch.playerId!==actor||
     refereeEvidence.lastVerifiedTouch.team!==side||
     refereeEvidence.lastVerifiedTouch.nativeExclusiveShoeStart!==true||
     refereeEvidence.officialMatchResult!==null||
     lastNativeShot?.tick===n||
     (lastEvent!==null&&lastRestart?.sourceEventTick!==lastEvent.tick))
   throw new TypeError('B06 refuses native live SHOT without same-tick original policy, Rapier sole and solver');
  lastNativeShot=action;
  add(freeze({
   type:'native-shot-physical-attempt',tick:n,
   playedTicks,playedTime:basicMatchClockB06(playedTicks).label,
   team:side,actorId:actor,
   originalPolicyActionSource:true,
   originalRapierShoeStart:true,
   originalRapierSolverManifold:true,
   actualOriginalBallImpulse:true,
   originalShotTarget:target,
   observedBallCentre:freeze({...physics.ball.position}),
   verifiedGoalScored:null,
   noScoringConclusionFromShot:true,
   officialMatchEvent:false
  }));
  return snapshot();
 }
 // H2b2a: an actual native kickoff is NOT equivalent to ball placement.
 // Keep the independent original B05/B06 goal reference, the only same-world
 // native START/manifold, the physical impulse and PLAYED vs physics clocks.
 function recordGoalKickoff({
  physicsTick,playedTicks,refereeEvidence,physicalKickoff,foot,solver
 }={}){
  const take=physicalKickoff,playerId=take?.actorId;
  if(!Number.isSafeInteger(physicsTick)||physicsTick!==tick||
     !Number.isSafeInteger(playedTicks)||playedTicks<0||
     playedTicks>B06_FULL_TICKS||
     !lastEvent||lastEvent.kind!=='goal'||!lastRestart||
     lastGoalKickoff!==null||lastRestart.kind!=='kickoff'||
     lastRestart.sourceEventTick!==lastEvent.tick||
     lastRestart.originalRapierBallRepositioned!==true||
     lastRestart.realShoeContact!==false||
     refereeEvidence?.version!==B05_REFEREE_VERSION||
     refereeEvidence.tick!==tick||
     refereeEvidence.lastEvent!==lastEvent||
     refereeEvidence.restartApplied!==true||
     refereeEvidence.officialMatchResult!==null||
     !take||take.tick!==tick||
     take.sourceEventTick!==lastEvent.tick||
     tick<=lastRestart.tick||!validTeam(take.team)||
     take.team!==lastRestart.assignedTeam||
     take.team!==lastEvent.restart.team||
     playerId!==take.team+'-10'||
     take.genuineExclusiveOriginalShoeStart!==true||
     take.currentRapierContactManifold!==true||
     take.original22PlayerFrame!==true||
     take.originalBallImpulseApplied!==true||
     take.sameOriginalRapierWorld!==true||
     take.officiallyAwardedPossession!==false||
     take.officialMatchResult!==null||
     !Number.isFinite(take.impulseNs?.x)||
     !Number.isFinite(take.impulseNs?.y)||
     !Number.isFinite(take.impulseNs?.z)||
     (take.team==='home'?take.impulseNs.x<=0:take.impulseNs.x>=0)||
     !ballXYZ(take.ball?.position)||
     Math.hypot(take.ball.position.x,take.ball.position.y)>0.65||
     Math.abs(take.ball.position.z-BALL_RADIUS)>0.3||
     foot?.tick!==tick||!Array.isArray(foot.started)||
     !Array.isArray(foot.active)||
     foot.started.length!==1||foot.active.length!==1||
     foot.started[0]!==playerId||foot.active[0]!==playerId||
     solver?.version!==FOOT_SOLVER_EVIDENCE_VERSION||
     solver.tick!==tick||!Array.isArray(solver.pairs)||
     !solver.pairs.some(p=>p.id===playerId&&p.beganThisTick&&
       p.collisionActive&&p.manifolds?.some(m=>m.geometricContacts>0)))
   throw new TypeError('B06 refuses kickoff without original current-tick native shoe, goal ticket and physical ball');
  lastGoalKickoff=take;
  add(freeze({
   type:'kickoff-physical-attempt',tick,playedTicks,
   playedTime:basicMatchClockB06(playedTicks).label,
   sourceGoalTick:lastEvent.tick,
   team:take.team,actorId:playerId,
   genuineOriginalRapierShoeStart:true,
   actualOriginalBallImpulse:true,
   playResumedWithoutAwardedPossession:true,
   officialMatchEvent:false
  }));
  return snapshot();
 }
 function recordSetPiece({physicsTick,take}={}){
  if(physicsTick!==tick||!lastEvent||!lastRestart||
    !take||take.tick!==tick||tick<=lastRestart.tick||
    lastSetPiece!==null||
    take.type!==lastRestart.kind||
    take.team!==lastRestart.assignedTeam||
    typeof take.actorId!=='string'||
    !take.actorId.startsWith(take.team+'-')||
    take.singleOriginalRapierBall!==true||
    take.physicalImpulseApplied!==true||
    take.officialMatchAction!==false||
    take.officialPossession!==false||
    take.officialMatchResult!==null||
    !(take.originalNativeShoeStart===true&&
      take.provisionalHandReleaseWithoutHandCollider===false&&
      take.type!=='throw-in'||
      take.type==='throw-in'&&
      take.originalNativeShoeStart===false&&
      take.provisionalHandReleaseWithoutHandCollider===true&&
      take.legalThrowConfirmed===false))
   throw new TypeError('B06 physical restart must use current genuine original shoe or explicit unmodelled hand proxy');
  lastSetPiece=take;
  add(freeze({
   type:'set-piece-physical-attempt',tick,kind:take.type,
   team:take.team,actorId:take.actorId,
   originalNativeShoeStart:take.originalNativeShoeStart,
   unmodelledHandRelease:take.provisionalHandReleaseWithoutHandCollider,
   sameOriginalRapierBall:true,officialMatchEvent:false
  }));
  return snapshot();
 }
 return freeze({observe,recordRestart,recordNativeLiveShot,
  recordGoalKickoff,recordSetPiece,snapshot});
}
