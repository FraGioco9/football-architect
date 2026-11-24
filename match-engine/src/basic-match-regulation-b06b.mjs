// #628 B06b H1 — original 22-player 60Hz Rapier two-half research session.
// A mini-period is allowed only for bounded DEV acceptance tests, not
// evidence of 90 minutes. Every physics tick is actually integrated.
import {createEngine,FIXED_DT,ENGINE_VERSION} from './core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS} from './player-movement.mjs';
import {createBasicMatchRefereeB05} from './basic-match-referee-b05.mjs';
import {createBasicMatchTimelineB06,basicMatchClockB06,
 B06_HALF_TICKS,B06_FULL_TICKS} from './basic-match-clock-score-b06.mjs';
export const B06B_SESSION_VERSION='me-628-b06b-real-two-half-native-source-v5';
const freeze=Object.freeze;
export function createBasicRegulationSessionB06b(RAPIER,{
 researchHalfTicks=B06_HALF_TICKS,researchOpeningKickoff=false,
 researchGoalCrossingSide=null,researchLiveShotSide=null
}={}){
 if(researchLiveShotSide!==null&&
    !['home','away'].includes(researchLiveShotSide))
  throw new TypeError('B06b native live shot requires a known HOME/AWAY side');
 if(researchGoalCrossingSide!==null&&
    !['home','away'].includes(researchGoalCrossingSide))
  throw new TypeError('B06b goal diagnostic requires HOME/AWAY only');
 if(typeof researchOpeningKickoff!=='boolean')
  throw new TypeError('B06b opening option must be boolean');
 if(!RAPIER||typeof RAPIER.World!=='function'||
   !Number.isSafeInteger(researchHalfTicks)||
   researchHalfTicks<120||researchHalfTicks>B06_HALF_TICKS)
  throw new TypeError('B06b requires Rapier and a bounded authentic 60Hz half');
 const goalMode=researchGoalCrossingSide!==null;
 const shotMode=researchLiveShotSide!==null;
 const goalRestartEnabled=goalMode||shotMode;
 if(shotMode&&(goalMode||researchOpeningKickoff||
    researchHalfTicks===B06_HALF_TICKS))
  throw new TypeError('B06b native shot is exclusively bounded non-opening mini research');
 if(goalMode&&(researchOpeningKickoff||researchHalfTicks===B06_HALF_TICKS))
  throw new TypeError('B06b real goal fixture is restricted to bounded non-opening mini QA');
 const openingRequired=researchOpeningKickoff||researchHalfTicks===B06_HALF_TICKS;
 // A DEV-only pre-tick-zero physical ball flight, NOT a native player shot.
 const shotInitial=shotMode?{
  x:researchLiveShotSide==='home'?30:-30,y:0,vx:0
 }:null;
 const goalInitial=goalMode?{
  x:researchGoalCrossingSide==='home'?47.8:-47.8,
  y:researchGoalCrossingSide==='home'?2.8:-2.8,
  vx:researchGoalCrossingSide==='home'?25:-25
 }:null;
 // This is a dedicated research-only match lifecycle: the same original
 // Rapier World, one ball and the same canonical movement for all 22 ids.
 const researchBall=freeze({
  preset:'roll',seed:'me-628-b06b-real-halftime',
  x:goalInitial?.x??shotInitial?.x??0,
  y:goalInitial?.y??shotInitial?.y??(openingRequired?0:20),
  z:0,vx:goalInitial?.vx??shotInitial?.vx??0,vy:0,vz:0
 });
 const engine=createEngine(RAPIER,researchBall,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:shotMode,
  diagnosticResearchShotAttacker:researchLiveShotSide,
  diagnosticB06bNativeShotSide:researchLiveShotSide,
  diagnosticB06bHalftimeTick:researchHalfTicks,
  diagnosticB06bOpeningKickoffEnabled:openingRequired,
  diagnosticB06bGoalRestartEnabled:goalRestartEnabled
 });
 const mover=createPlayerMovement({researchB06bHalftimeTick:researchHalfTicks,
  ...(openingRequired?{researchB06bOpeningKickoffEnabled:true}:{}),
  ...(goalRestartEnabled?{researchB06bGoalRestartEnabled:true}:{}),
  ...(shotMode?{
   researchB06bNativeShotSide:researchLiveShotSide,
   researchShotAttacker:researchLiveShotSide,
   researchShotBall:researchBall
  }:{})});
 const referee=createBasicMatchRefereeB05();
 const ledger=createBasicMatchTimelineB06({b06bRealHalftimePause:true});
 let disposed=false,phase=openingRequired?'opening-kickoff':'first-half',
  clockTicks=0,openingKickoff=null,halftimePlacement=null,
  kickoff=null,end=null,deadBall=null,goalPending=null,
  goalPauseTicks=0,goalKickoffs=freeze([]),goalPlacements=freeze([]),
  nativeShots=freeze([]);
 let frame=mover.snapshot(),physics=engine.snapshot();
 function observe(){
  const foot=engine.footContactSnapshot();
  const solver=physics.tick?engine.footContactSolverSnapshot():null;
  const action=shotMode&&physics.tick?
    engine.uniformAutonomousActionSnapshot():null;
  const evidence=referee.observe({physics,playerFrame:frame,
   foot,solver,action});
  let current=ledger.observe({physics,refereeEvidence:evidence});
  if(action?.action==='shot'){
   current=ledger.recordNativeLiveShot({
    physicsTick:physics.tick,playedTicks:clockTicks,
    physics,action,foot,solver,refereeEvidence:evidence
   });
   nativeShots=freeze([...nativeShots,action].slice(-64));
  }
  if(evidence.lastEvent?.tick===physics.tick){
   const event=evidence.lastEvent;
   if(goalRestartEnabled&&event.kind==='goal'&&event.restart.ready){
    // B05 and independent B06 geometry have both observed THIS physical tick.
    const placement=engine.b06bOriginalPlaceGoalRestart(event,frame);
    referee.acknowledgeRestart(event.restart);
    current=ledger.recordRestart({physicsTick:physics.tick,
     refereeEvidence:referee.snapshot(),physicalRestart:placement});
    mover.queueB06bOriginalGoalKickoff(event);
    goalPending=event;
    goalPlacements=freeze([...goalPlacements,placement]);
    phase='goal-kickoff';deadBall=null;
    physics=engine.snapshot(); // Same original ball, after physical placement.
   }else{
    deadBall=event;
    phase='dead-ball-pending-source-verified-restart';
   }
  }
  return current;
 }
 let timeline=observe();
 function snapshot(){
  if(disposed)throw new Error('B06b original Rapier session disposed');
  const c=basicMatchClockB06(clockTicks);
  const shortened=researchHalfTicks!==B06_HALF_TICKS;
  return freeze({
   version:B06B_SESSION_VERSION,physicsTick:physics.tick,
   clockTicks,clock:freeze({...c,
    source:'original-60hz-rapier-live-ticks-with-authenticated-halftime-pause',
    originalPhysicsSourceTick:physics.tick,
    halfTimeRestartVerified:kickoff!==null,
    completedMatchVerified:end!==null&&!shortened}),
   phase,firstHalfKickoff:openingKickoff,
   goalRestartPlacements:goalPlacements,
   genuineGoalKickoffs:goalKickoffs,
   pausedGoalPhysicsTicks:goalPauseTicks,
   goalFixtureStartsFromPreTickZeroBallVelocity:goalMode,
   nativePlayerShotResearchEnabled:shotMode,
   nativePhysicalShotAttempts:nativeShots,
   halfTime:halftimePlacement,secondHalfKickoff:kickoff,
   final:end,
   realFull90MinutesVerified:end!==null&&!shortened&&openingKickoff!==null,
   fullFootballActionCoverageVerified:false,
   abbreviatedResearchRun:shortened,
   physicsBall:physics.ball,
   canonical22:frame.players.length===22&&INITIAL_PLAYERS.every((p,i)=>
    frame.players[i]?.id===p.id&&frame.players[i].team===p.team),
   refereeSource:referee.snapshot(),
   originalEventLedger:timeline,
   provisionalScore:timeline.provisionalScore,
   originalPhysicsClockS:physics.tick*FIXED_DT,
   officialMatchScore:null,officialMatchResult:null,
   officialPossession:false,matchAuthority:false
  });
 }
 function step(){
  if(disposed)throw new Error('B06b original Rapier session disposed');
  if(end||deadBall)
   throw new Error('B06b cannot step after full time or unresolved native dead ball');
  frame=mover.step(physics.ball.position);
  physics=engine.step(frame);
  if(frame.tick!==physics.tick)
   throw new Error('B06b requires actual original canonical 60Hz movement and physics');
  // The private native shoe bridge has already observed the current
  // same-world solver. No synthetic shoe START or virtual possession.
  let newlyConfirmedGoalKickoff=null;
  if(phase==='opening-kickoff'){
   openingKickoff=engine.b06bOriginalOpeningKickoff(frame);
   if(!openingKickoff)throw new Error('B06b requires a genuine opening HOME sole Rapier shoe START');
   phase='first-half';clockTicks++;
  }else if(phase==='half-time'){
   const confirmed=engine.b06bOriginalSecondHalfKickoff(frame);
   if(confirmed){
    kickoff=confirmed;phase='second-half';
   }
  }else if(phase==='goal-kickoff'){
   const confirmed=engine.b06bOriginalTakeGoalRestart(frame,goalPending);
   if(confirmed){
    mover.finishB06bOriginalGoalKickoff(confirmed);
    newlyConfirmedGoalKickoff=confirmed;
    goalPauseTicks+=confirmed.tick-goalPending.tick;
    goalKickoffs=freeze([...goalKickoffs,confirmed]);
    goalPending=null;
    phase=clockTicks>=researchHalfTicks?'second-half':'first-half';
   }
  }else clockTicks++;
  timeline=observe();
  if(newlyConfirmedGoalKickoff){
   timeline=ledger.recordGoalKickoff({
    physicsTick:physics.tick,playedTicks:clockTicks,
    refereeEvidence:referee.snapshot(),
    physicalKickoff:newlyConfirmedGoalKickoff,
    foot:engine.footContactSnapshot(),
    solver:engine.footContactSolverSnapshot()
   });
  }
  if(phase==='first-half'&&clockTicks===researchHalfTicks){
   if(deadBall)throw new Error('B06b half cannot resume on unassigned dead ball');
   halftimePlacement=engine.b06bOriginalHalftimePlacement(frame);
   if(halftimePlacement.physicsTick!==physics.tick||
      !halftimePlacement.actualOriginalRapierBallPlaced)
    throw new Error('B06b cannot declare a halftime without real original ball placement');
   phase='half-time';
   // Read after the physical dead-ball placement, not a virtual ball.
   physics=engine.snapshot();
  }
  if(phase==='second-half'&&clockTicks===researchHalfTicks*2){
   const verified=(!openingRequired||openingKickoff!==null)&&kickoff!==null&&
    halftimePlacement?.physicsTick===researchHalfTicks+
     goalPauseTicks&&
    kickoff.tick>halftimePlacement.physicsTick&&
    timeline.tick===physics.tick&&
    !timeline.outstandingDeadBall&&!deadBall;
   if(!verified)throw new Error('B06b refuses full-time without actual source continuity');
   end=freeze({
    physicsTick:physics.tick,gameClockTicks:clockTicks,
    phase:'full-time',winner:timeline.provisionalScore.home===
     timeline.provisionalScore.away?'draw':
     timeline.provisionalScore.home>timeline.provisionalScore.away?'home':'away',
    provisionalScore:timeline.provisionalScore,
    provisionalMatchEvents:timeline.matchEvents,
    physicallyAuthenticatedGoalKickoffs:goalKickoffs,
    nativeOriginalShotAttempts:nativeShots,
    playedTicksExcludingDeadBallApproaches:clockTicks,
    actualRapierPhysicsTicks:physics.tick,
    source:'original-b05-b06-independent-rapier-event-audit',
    twoPhysicalHalvesAndNativeKickoff:true,
    firstHalfNativeKickoffVerified:openingKickoff!==null,
    complete90Minutes:researchHalfTicks===B06_HALF_TICKS&&openingKickoff!==null,
    completeFootballGameplayVerified:false,
    officialMatchResult:null,competitionWrite:false
   });
   phase='full-time';
  }
  return snapshot();
 }
 function dispose(){
  if(!disposed){disposed=true;engine.dispose();}
 }
 return freeze({snapshot,step,dispose});
}
