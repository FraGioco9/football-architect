// #628 B06b H1 — original 22-player 60Hz Rapier two-half research session.
// A mini-period is allowed only for bounded DEV acceptance tests, not
// evidence of 90 minutes. Every physics tick is actually integrated.
import {createEngine,FIXED_DT,ENGINE_VERSION} from './core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS} from './player-movement.mjs';
import {createBasicMatchRefereeB05} from './basic-match-referee-b05.mjs';
import {createBasicMatchTimelineB06,basicMatchClockB06,
 B06_HALF_TICKS,B06_FULL_TICKS} from './basic-match-clock-score-b06.mjs';
export const B06B_SESSION_VERSION='me-628-b06b-real-two-half-native-source-v3';
const freeze=Object.freeze;
export function createBasicRegulationSessionB06b(RAPIER,{
 researchHalfTicks=B06_HALF_TICKS,researchOpeningKickoff=false,
 researchGoalCrossingSide=null
}={}){
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
 if(goalMode&&(researchOpeningKickoff||researchHalfTicks===B06_HALF_TICKS))
  throw new TypeError('B06b real goal fixture is restricted to bounded non-opening mini QA');
 const openingRequired=researchOpeningKickoff||researchHalfTicks===B06_HALF_TICKS;
 // A DEV-only pre-tick-zero physical ball flight, NOT a native player shot.
 const goalInitial=goalMode?{
  x:researchGoalCrossingSide==='home'?47.8:-47.8,
  y:researchGoalCrossingSide==='home'?2.8:-2.8,
  vx:researchGoalCrossingSide==='home'?25:-25
 }:null;
 // This is a dedicated research-only match lifecycle: the same original
 // Rapier World, one ball and the same canonical movement for all 22 ids.
 const engine=createEngine(RAPIER,{
  preset:'roll',seed:'me-628-b06b-real-halftime',
  x:goalInitial?.x??0,
  y:goalInitial?.y??(openingRequired?0:20),
  z:0,vx:goalInitial?.vx??0,vy:0,vz:0
 },{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticB06bHalftimeTick:researchHalfTicks,
  diagnosticB06bOpeningKickoffEnabled:openingRequired,
  diagnosticB06bGoalRestartEnabled:goalMode
 });
 const mover=createPlayerMovement({researchB06bHalftimeTick:researchHalfTicks,
  ...(openingRequired?{researchB06bOpeningKickoffEnabled:true}:{}),
  ...(goalMode?{researchB06bGoalRestartEnabled:true}:{})});
 const referee=createBasicMatchRefereeB05();
 const ledger=createBasicMatchTimelineB06({b06bRealHalftimePause:true});
 let disposed=false,phase=openingRequired?'opening-kickoff':'first-half',
  clockTicks=0,openingKickoff=null,halftimePlacement=null,
  kickoff=null,end=null,deadBall=null,goalPending=null,
  goalPauseTicks=0,goalKickoffs=freeze([]),goalPlacements=freeze([]);
 let frame=mover.snapshot(),physics=engine.snapshot();
 function observe(){
  const evidence=referee.observe({physics,playerFrame:frame,
   foot:engine.footContactSnapshot(),
   solver:physics.tick?engine.footContactSolverSnapshot():null,action:null});
  let current=ledger.observe({physics,refereeEvidence:evidence});
  if(evidence.lastEvent?.tick===physics.tick){
   const event=evidence.lastEvent;
   if(goalMode&&event.kind==='goal'&&event.restart.ready){
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
    goalPauseTicks+=confirmed.tick-goalPending.tick;
    goalKickoffs=freeze([...goalKickoffs,confirmed]);
    goalPending=null;
    phase=clockTicks>=researchHalfTicks?'second-half':'first-half';
   }
  }else clockTicks++;
  timeline=observe();
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
