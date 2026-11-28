import {observeNativeAerialDuel} from './small-sided-native-body-guard.mjs';
import {createDribbleShieldObserver,planDribbleDefender,resolveDuelActors} from './isolated-dribble-touches.mjs';
import {observeNativeShotBlock} from './defensive-intervention-selection.mjs';
// #620 — controlled actions on the CLEAN canonical same-world Rapier core.
// No legacy universal match session, opponent-lane tactical simulator or fake
// action event. Exactly one core engine and one existing 22-player mover.
import {createEngine,FIXED_DT} from './core.mjs';
import {LAB_SHOT_PROFILES} from './lab-shot-calibration.mjs';
import {createKeeperShotObserver} from './goalkeeper-save-foundation-b02.mjs';
import {CURRENT_LAB_DYNAMICS_VERSION} from './physical-receiving-cushion-m25.mjs';
import {createPhysicalFootballDecisionObserver}
 from './physical-football-decision-evidence-m23.mjs';
import {createRealPostContactBallContinuity}
 from './real-post-contact-ball-continuity-m24.mjs';
import {createRealPressuredFirstTouchObserver}
 from './real-pressured-first-touch-m26.mjs';
import {createRealSecondTouchFollowThrough}
 from './real-second-touch-follow-through-m28.mjs';
import {createNativeControlEvidenceGateM29}
 from './native-control-evidence-gate-m29.mjs';
import {createRealBallReleaseAuditM30} from './real-ball-release-audit-m30.mjs';
import {createBasicMatchRefereeB05} from './basic-match-referee-b05.mjs';
import {createBasicMatchTimelineB06,basicMatchClockB06,B06_HALF_TICKS} from './basic-match-clock-score-b06.mjs';
import {createBasicReceiveDribbleObserverB04}
 from './basic-receive-dribble-b04.mjs';
import {createRealOpponentBallContestAuditM31}
 from './real-opponent-ball-contest-m31.mjs';
import {createPlayerMovement,INITIAL_PLAYERS} from './player-movement.mjs';
import {SMALL_SIDED_LAB_SCENARIOS,AERIAL_LAB_SCENARIOS,smallSidedSetup,supportsNativeOpenPlay}
 from './small-sided-lab-scenarios.mjs';
import {SOLO_CARRY_PHASES} from './solo-carry-phases.mjs';
import {uniformSoloCarryAttributes,validateSoloCarryAttributes}
 from './solo-carry-attribute-calibration.mjs';
import {drawPitchMarkings} from './pitch-markings.mjs';
import {createIsolatedDribbleNativeAudit} from './isolated-dribble-native-audit.mjs';
import {inspectUniformPolicyGeometry} from './player-ball-uniform-autonomous-action.mjs';
import {ACTION_LAB_SCENARIOS,SHOT_LAB_STARTS,CROSS_LAB_STARTS,SAVE_LAB_STARTS,DEFENSE_LAB_STARTS,B05_LAB_STARTS,B05B_LAB_STARTS,CARRY_LAB_STARTS,
 CHALLENGE_LAB_STARTS,CONTROL_LAB_STARTS,
 getActionLabScenario,classifyActionLabEvidence} from './action-lab-scenarios.mjs';

// UME-06D: a private match lifecycle adapter, not another movement or
// action engine. Every live tick uses the same guarded full-field native
// policy. Existing B05/B06 independently observe the original ball.
// A dead ball or half-time closes the live gate until physical restart
// support is authenticated; this adapter never fabricates a restart.
export function createNativeFullFieldSession(RAPIER,{side='home',variantIndex=0,researchHalfTicks=B06_HALF_TICKS}={}){
 if(!RAPIER||typeof RAPIER.World!=='function'||!Number.isSafeInteger(researchHalfTicks)||
    researchHalfTicks<120||researchHalfTicks>B06_HALF_TICKS)
  throw new TypeError('Native full-field session requires Rapier and bounded physical half');
 const id='full-field-native',fixture=smallSidedSetup(id,side,INITIAL_PLAYERS,{variantIndex});
 const engine=createEngine(RAPIER,fixture.ball,{
  diagnosticSmallSidedSituation:id,diagnosticSmallSidedSide:side,diagnosticSmallSidedVariantIndex:variantIndex,
  diagnosticPlayerFootContactsEnabled:true,diagnosticAutonomousFixtureActionEnabled:true,
  diagnosticSmallSidedBodyGuardEnabled:true,diagnosticSmallSidedBodyFeedbackEnabled:true,
  diagnosticCollectiveActions:true,diagnosticLatestLabDynamics:true,diagnosticNativeHalfTicks:researchHalfTicks
 });
 try{
  const mover=createPlayerMovement({researchSmallSidedSituation:id,researchSmallSidedSide:side,
   researchSmallSidedVariantIndex:variantIndex,researchSmallSidedBodyFeedback:true,researchCollectiveApproaches:true});
  const ledger=createBasicMatchTimelineB06({b06bRealHalftimePause:true,nativeHalfTicks:researchHalfTicks});
  let disposed=false,phase='first-half',playedTicks=0,secondHalfStarted=false,latest;
  function observe(physics,frame,restartTake=null){
   const placement=latest?.physicalRestart??null;
   const foot=engine.footContactSnapshot(),raw=engine.uniformAutonomousActionSnapshot();
   const action=raw?.tick===physics.tick&&physics.tick>0?raw:null;
   const keepers=engine.nativeKeeperSnapshots();
   const evidence=engine.nativeMatchRefereeSnapshot();
   let timeline=ledger.observe({physics,refereeEvidence:evidence});
   if(engine.nativePlayedTicksSnapshot()!==playedTicks)throw new Error('Native physical and session clocks disagree');
   if(restartTake){
    if(restartTake.periodRestart==='second-half'){
     timeline=ledger.recordNativeHalfTake({physicsTick:physics.tick,playedTicks,take:restartTake,foot,solver:engine.footContactSolverSnapshot()});
     secondHalfStarted=true;
    }else timeline=ledger.recordSetPiece({physicsTick:physics.tick,take:restartTake});
    phase=secondHalfStarted?'second-half':'first-half';
   }
   if(playedTicks===2*researchHalfTicks&&secondHalfStarted){
    timeline=ledger.recordNativeFullTime({physicsTick:physics.tick,playedTicks});phase='full-time';
   }else if(timeline.outstandingDeadBall)phase='dead-ball-awaiting-native-restart';
   else if(playedTicks===researchHalfTicks&&!secondHalfStarted&&phase!=='dead-ball-placed-awaiting-native-take')phase='half-time-awaiting-native-restart';
   latest=Object.freeze({
    tick:physics.tick,ball:physics.ball,players:frame.players,starts:foot.started,action,
    control:engine.collectiveControlSnapshot(),keepers,reception:engine.latestLabReceptionSnapshot(),
    body:engine.smallSidedBodyGuardSnapshot(),decisions:frame.smallSidedMovementDecisions,
    activeIds:fixture.activeIds,phase,playedTicks,
    clock:Object.freeze({...basicMatchClockB06(playedTicks),phase,
     originalPhysicsSourceTick:physics.tick,abbreviatedResearchRun:researchHalfTicks!==B06_HALF_TICKS,
     halfTimeRestartVerified:secondHalfStarted,completedMatchVerified:false}),
    referee:evidence,timeline,provisionalScore:timeline.provisionalScore,
    pendingRestart:phase==='full-time'?null:phase==='dead-ball-placed-awaiting-native-take'&&placement?.periodRestart==='second-half'?null:
     timeline.outstandingDeadBall||phase==='dead-ball-placed-awaiting-native-take'?evidence.lastEvent.restart:null,
    physicalRestart:placement,restartTake:restartTake??latest?.restartTake??null,throwHands:engine.nativeThrowHandsSnapshot(),
    matchAuthority:false,officialMatchResult:null,officialPossession:false,
    completeFootballGameplayVerified:false,realFull90MinutesVerified:false,
    boundedTwoPeriodsVerified:phase==='full-time',attackPolarity:engine.nativeAttackPolaritySnapshot(),nativeHalfFormationPhase:frame.nativeHalfFormationPhase??null,
    directionSwitchVerified:secondHalfStarted&&engine.nativeAttackPolaritySnapshot()===-1
   });
   return latest;
  }
  observe(engine.snapshot(),mover.snapshot());
  function snapshot(){if(disposed)throw new Error('Native full-field session disposed');return latest;}
  function step(){
   if(disposed)throw new Error('Native full-field session disposed');
   if(!['first-half','second-half'].includes(phase))throw new Error('Native full-field live play paused pending authenticated restart or full-time');
   const prior=engine.snapshot(),control=engine.collectiveControlSnapshot();
   let frame=mover.step(prior.ball.position,null,null,prior.ball.velocity,null,false,false,null,null,null,control,null,engine.nativeAttackPolaritySnapshot());
   const physics=engine.step(frame);
   mover.reconcileSmallSidedNativeBodyResponse(engine.smallSidedBodyGuardSnapshot());
   frame=mover.snapshot();engine.acknowledgeSmallSidedBodyFeedback(frame);
   if(physics.tick!==latest.tick+1||frame.tick!==physics.tick)throw new Error('Native match requires consecutive physical 60Hz ticks');
   playedTicks++;
   return observe(physics,frame);
  }
  function placeRestart(){
   if(disposed)throw new Error('Native full-field session disposed');
   if(phase!=='dead-ball-awaiting-native-restart'||!latest.pendingRestart?.ready)
    throw new Error('Native restart placement requires a verified ready boundary ticket');
   const event=latest.referee.lastEvent,placement=engine.applyBasicRestartAtBoundary(event);
   const referee=engine.nativeMatchRefereeSnapshot();
   const timeline=ledger.recordRestart({physicsTick:latest.tick,refereeEvidence:referee,physicalRestart:placement});
   phase='dead-ball-placed-awaiting-native-take';
   latest=Object.freeze({...latest,ball:engine.snapshot().ball,
    control:engine.collectiveControlSnapshot(),keepers:engine.nativeKeeperSnapshots(),
    action:null,starts:Object.freeze([]),reception:null,phase,
    clock:Object.freeze({...latest.clock,phase}),referee,timeline,
    provisionalScore:timeline.provisionalScore,physicalRestart:placement,
    pendingRestart:event.restart});
   return latest;
  }
  function placeSecondHalf(){
   if(disposed)throw new Error('Native full-field session disposed');
   if(phase!=='half-time-awaiting-native-restart')throw new Error('Native second-half placement requires exact half-time');
   const placement=engine.placeNativeSecondHalf(),timeline=ledger.recordNativeHalfPlacement({physicsTick:latest.tick,playedTicks,placement});
   phase='dead-ball-placed-awaiting-native-take';
   latest=Object.freeze({...latest,ball:engine.snapshot().ball,
    control:engine.collectiveControlSnapshot(),keepers:engine.nativeKeeperSnapshots(),
    action:null,starts:Object.freeze([]),reception:null,phase,
    clock:Object.freeze({...latest.clock,phase}),referee:engine.nativeMatchRefereeSnapshot(),timeline,
    physicalRestart:placement,pendingRestart:null,attackPolarity:engine.nativeAttackPolaritySnapshot()});
   return latest;
  }
  function advanceRestart(){
   if(disposed)throw new Error('Native full-field session disposed');
   if(phase!=='dead-ball-placed-awaiting-native-take'||!latest.physicalRestart)
    throw new Error('Native restart requires a placed ready ticket');
   const placement=latest.physicalRestart,prior=engine.snapshot(),control=engine.collectiveControlSnapshot();
   let frame=mover.step(prior.ball.position,null,null,prior.ball.velocity,null,false,false,null,null,null,control,placement,engine.nativeAttackPolaritySnapshot());
   const physics=engine.step(frame,placement);
   mover.reconcileSmallSidedNativeBodyResponse(engine.smallSidedBodyGuardSnapshot());
   frame=mover.snapshot();engine.acknowledgeSmallSidedBodyFeedback(frame);
   if(physics.tick!==latest.tick+1||frame.tick!==physics.tick)throw new Error('Native restart requires consecutive physical 60Hz ticks');
   const take=engine.nativeRestartTakeSnapshot();
   return observe(physics,frame,take?.tick===physics.tick?take:null);
  }
  function dispose(){if(!disposed){disposed=true;engine.dispose();}}
  return Object.freeze({snapshot,step,placeRestart,placeSecondHalf,advanceRestart,dispose});
 }catch(error){engine.dispose();throw error;}
}

export function createControlledActionLab(RAPIER,id,{
 shotSide='home',shotLane='open',carrySide='home',controlScene='receive',
 controlSide='home',controlDecisionEnabled=true,
 challengeSide='away',challengeScene='contact',variantIndex=0,
 bodyGuardEnabled=false,collectiveApproaches=false,keeperSingleShot=false,directedDribble=false,duelTackleProfile='mixed',soloShoeWidthScale=1,
 soloShoeLengthScale=1,soloRecoveryStepScale=1,
 soloSprintCadenceScale=1,soloSprintLateralTrackScale=1,
 soloSprintActiveFootReleaseM=0,intentDrivenSoloCarry=false,soloCarryLockedPhase=null,
 carryRunwayStart=false,nativeFixedCarryResearch=false,
 nativeFixedSprintLongStride=false,soloSprintPursuitLeadM=0,
 soloCarryPlayerAttributes=null,historicalEvidenceBaseline=false,historicalCarryPhysics=false,shotProfile='power',firstTimeShot=false
}={}){
 if(!RAPIER||typeof RAPIER.World!=='function')
  throw new TypeError('Rapier required for real Action LAB');
 const aerialLab=['header-pair','chest-control','aerial-foot-control','aerial-duel','lofted-pass','volley-solo','keeper-high-cross','keeper-high-intercept','lofted-short','lofted-switch'].includes(id);
 if(aerialLab){bodyGuardEnabled=true;collectiveApproaches=true;}
 if(typeof collectiveApproaches!=='boolean'||(collectiveApproaches&&(!supportsNativeOpenPlay(id)||!bodyGuardEnabled||keeperSingleShot||directedDribble||duelTackleProfile!=='mixed')))
  throw new TypeError('Native open play requires guarded participants without isolated overrides');
 if(typeof carryRunwayStart!=='boolean'||
    (carryRunwayStart&&id!=='carry-solo'))
  throw new TypeError('Long-running pre-kickoff runway only for Solo Carry');
 if(![0,0.06,0.1].includes(soloSprintActiveFootReleaseM)||
    (soloSprintActiveFootReleaseM!==0&&(
     !nativeFixedCarryResearch||soloCarryLockedPhase!=='sprint'||
     id!=='carry-solo'||nativeFixedSprintLongStride||bodyGuardEnabled||
     soloSprintCadenceScale!==1||soloSprintLateralTrackScale!==1||
     soloShoeWidthScale!==1||soloShoeLengthScale!==1||
     soloRecoveryStepScale!==1)))
  throw new TypeError('Native active-foot release is Sprint research only');
 if(![0,0.25].includes(soloSprintPursuitLeadM)||
    (soloSprintPursuitLeadM!==0&&(
     id!=='carry-solo'||!nativeFixedCarryResearch||
     soloCarryLockedPhase!=='sprint'||
     soloSprintActiveFootReleaseM!==0.06||
     nativeFixedSprintLongStride||bodyGuardEnabled||
     soloSprintCadenceScale!==1||soloSprintLateralTrackScale!==1)))
  throw new TypeError('Adaptive pursuit only for source-authenticated native Sprint');
 if(typeof nativeFixedSprintLongStride!=='boolean'||
    (nativeFixedSprintLongStride&&(
     !nativeFixedCarryResearch||soloCarryLockedPhase!=='sprint'||
     soloSprintCadenceScale!==1||soloSprintLateralTrackScale!==1)))
  throw new TypeError('Long-stride trial only for isolated native fixed Sprint');
 if(typeof nativeFixedCarryResearch!=='boolean'||
    (nativeFixedCarryResearch&&(
     id!=='carry-solo'||intentDrivenSoloCarry||
     soloCarryLockedPhase===null||bodyGuardEnabled||!carryRunwayStart)))
  throw new TypeError('Native fixed Carry requires an isolated 10s research runway');
 if(typeof intentDrivenSoloCarry!=='boolean'||
    (intentDrivenSoloCarry&&(id!=='carry-solo'||bodyGuardEnabled||
     soloShoeWidthScale!==1||soloShoeLengthScale!==1||
     soloRecoveryStepScale!==1||soloSprintCadenceScale!==1||
     soloSprintLateralTrackScale!==1)))
  throw new TypeError('Intent mode is only available in simple Solo Carry');
 if((soloCarryLockedPhase!==null&&(
    !SOLO_CARRY_PHASES.includes(soloCarryLockedPhase)||
    id!=='carry-solo'||
    !(intentDrivenSoloCarry||nativeFixedCarryResearch)))||
    (soloCarryPlayerAttributes!==null&&soloCarryLockedPhase===null))
  throw new TypeError('Fixed Carry phase is available only in intentional solo DEV LAB');
 const selectedCarryAttributes=soloCarryLockedPhase===null?null:
  soloCarryPlayerAttributes===null?uniformSoloCarryAttributes(50):
   validateSoloCarryAttributes(soloCarryPlayerAttributes);
 const spec=getActionLabScenario(id);
 if(typeof firstTimeShot!=='boolean'||(firstTimeShot&&id!=='shot-solo'))
  throw new TypeError('First-time start requires isolated shooter');
 if(!LAB_SHOT_PROFILES.includes(shotProfile)||(shotProfile!=='power'&&id!=='shot-solo'))
  throw new TypeError('Shot profile requires isolated shooter');
 if(typeof directedDribble!=='boolean'||(directedDribble&&(id!=='dribble-1v1'||!bodyGuardEnabled)))
  throw new TypeError('Directed dribble requires native 1v1');
 if(!['mixed','standing','sliding','shoulder','interception','block'].includes(duelTackleProfile)||(duelTackleProfile==='block'?(id!=='defender-1v1'||!bodyGuardEnabled||directedDribble):duelTackleProfile==='interception'?(id!=='pass-pair'||directedDribble):duelTackleProfile!=='mixed'&&!directedDribble))
  throw new TypeError('Tackle profile requires original guarded directed duel');
 if(typeof keeperSingleShot!=='boolean'||(keeperSingleShot&&(id!=='keeper-1v1'||!bodyGuardEnabled)))
  throw new TypeError('Single-shot exercise requires native keeper duel');
 if(typeof bodyGuardEnabled!=='boolean'||
    (bodyGuardEnabled&&(spec.mode!=='situation'||['pass-pair','cross-pair','shot-solo'].includes(id))))
  throw new TypeError('Native body-contact exercise only in a small-sided situation');
 if(spec.mode!=='situation'&&variantIndex!==0)
  throw new TypeError('Variations require a selected small-sided exercise');
 if(![0.9,1,1.1].includes(soloShoeWidthScale)||
    (id!=='carry-solo'&&soloShoeWidthScale!==1)||
    (soloShoeWidthScale!==1&&!bodyGuardEnabled))
  throw new TypeError('Counterfactual widths require solo Carry with native body guard');
 if(![0.9,1,1.05,1.075,1.1].includes(soloShoeLengthScale)||
    ![0.85,0.925,1,1.15].includes(soloRecoveryStepScale)||
    ((soloShoeLengthScale!==1||soloRecoveryStepScale!==1)&&
     (id!=='carry-solo'||!bodyGuardEnabled)))
  throw new TypeError('Longitudinal native shoe study requires guarded solo Carry');
 if(![0.9,1,1.1].includes(soloSprintCadenceScale)||
    ![0.9,1,1.1].includes(soloSprintLateralTrackScale)||
    ((soloSprintCadenceScale!==1||soloSprintLateralTrackScale!==1)&&
     (id!=='carry-solo'||!bodyGuardEnabled)))
  throw new TypeError('Sprint cadence and lateral-tracking research require guarded solo Carry');
 const smallSided=spec.mode==='situation'?
  smallSidedSetup(id,shotSide,INITIAL_PLAYERS,{
   variantIndex,carryRunwayStart,tapInStart:shotProfile==='tap-in',firstTimeShot,shoulderStart:duelTackleProfile==='shoulder',interceptionStart:duelTackleProfile==='interception',blockStart:duelTackleProfile==='block'
  }):null;
 const refereeMode=spec.mode==='referee';
 if(typeof historicalEvidenceBaseline!=='boolean'||(historicalEvidenceBaseline&&smallSided))
  throw new TypeError('Historical evidence only for original archived action fixtures');
 if(typeof historicalCarryPhysics!=='boolean'||historicalCarryPhysics&&(!['carry-solo','dribble-1v1'].includes(id)||collectiveApproaches))throw new TypeError('Historical carry physics requires isolated research');
 const currentDynamics=!refereeMode&&!historicalEvidenceBaseline;
 const sourceRestart=['throw-in','corner','goal-kick'].includes(id);
 const basicFootwork=['trap','dribble'].includes(id);
 const effectiveControlScene=id==='trap'?'receive-cushion':
  id==='dribble'?'receive-release':controlScene;
 if(!['home','away'].includes(shotSide)||
    !['home','away'].includes(carrySide)||
    !['open','blocked'].includes(shotLane)||
    !['receive','receive-cushion','receive-pressure','receive-decide','receive-pressure-decide','receive-release','receive-contest','receive-challenge','opponent-first'].includes(controlScene)||
    !['home','away'].includes(controlSide)||
    typeof controlDecisionEnabled!=='boolean'||
    (!controlDecisionEnabled&&controlScene!=='receive-decide')||
    (id!=='control'&&controlSide!=='home')||
    (controlScene==='opponent-first'&&controlSide!=='home')||
    !['home','away'].includes(challengeSide)||
    !['contact','no-contact'].includes(challengeScene)||
    (id!=='challenge'&&(challengeSide!=='away'||challengeScene!=='contact'))||
    (!['shot','cross','save','tackle','interception','trap','dribble','goal','touchline','goal-line-out','throw-in','corner','goal-kick'].includes(id)&&!smallSided&&(shotSide!=='home'||shotLane!=='open'))||
     (['cross','save','tackle','interception','trap','dribble','goal','touchline','goal-line-out','throw-in','corner','goal-kick'].includes(id)&&shotLane!=='open')||
    (id!=='carry'&&carrySide!=='home')||
    (id!=='control'&&controlScene!=='receive')||
    (basicFootwork&&!controlDecisionEnabled))
  throw new TypeError('Only bounded SHOT, CARRY or CONTROL scenes supported');
 const selectedControlSide=spec.mode==='control'?
  (basicFootwork?shotSide:controlSide):null;
 const selectedShotSide=smallSided||['shot','cross','save','tackle','interception','goal','touchline','goal-line-out','throw-in','corner','goal-kick'].includes(id)?shotSide:null;
 const defenseExperiment=['tackle','interception'].includes(id);
  const goalkeeperSave=id==='save';
  const wideCross=id==='cross';
 const selectedCarrySide=id==='carry'?carrySide:null;
 const selectedChallengeSide=id==='challenge'?challengeSide:null;
 const initial=smallSided?smallSided.ball:
  sourceRestart?
    B05B_LAB_STARTS[id==='throw-in'?'throwIn':id==='goal-kick'?'goalKick':id][selectedShotSide]:
  refereeMode?
   B05_LAB_STARTS[id==='goal-line-out'?'goalLine':id][selectedShotSide]:
  defenseExperiment?DEFENSE_LAB_STARTS[id][selectedShotSide]:
   goalkeeperSave?SAVE_LAB_STARTS[selectedShotSide]:
   wideCross?CROSS_LAB_STARTS[selectedShotSide]:
   selectedShotSide?SHOT_LAB_STARTS[selectedShotSide]:
  selectedCarrySide?CARRY_LAB_STARTS[selectedCarrySide]:
  selectedControlSide?(basicFootwork&&selectedControlSide==='home'?
   spec.initial:CONTROL_LAB_STARTS[selectedControlSide]):
  selectedChallengeSide?(challengeScene==='no-contact'?
   CHALLENGE_LAB_STARTS.noContact:CHALLENGE_LAB_STARTS[selectedChallengeSide]):
   spec.initial;
 const blocked=selectedShotSide!==null&&shotLane==='blocked';
 const opposingControl=spec.mode==='control'&&effectiveControlScene==='opponent-first';
 const firstTouchCushion=spec.mode==='control'&&
  ['receive-cushion','receive-pressure','receive-decide',
   'receive-pressure-decide','receive-release','receive-contest','receive-challenge'].includes(effectiveControlScene);
 const closePressure=spec.mode==='control'&&
  ['receive-pressure','receive-pressure-decide'].includes(effectiveControlScene);
 const moderatePressure=spec.mode==='control'&&
   ['receive-decide','receive-release'].includes(effectiveControlScene);
 const reachExperiment=spec.mode==='control'&&effectiveControlScene==='receive-challenge';
 const contestExperiment=spec.mode==='control'&&
  ['receive-contest','receive-challenge'].includes(effectiveControlScene);
 const tapExperiment=spec.mode==='control'&&
  ['receive-release','receive-contest','receive-challenge'].includes(effectiveControlScene);
 const adaptiveDecision=spec.mode==='control'&&controlDecisionEnabled&&
  ['receive-decide','receive-pressure-decide','receive-release','receive-contest','receive-challenge'].includes(effectiveControlScene);
 const focus=smallSided?smallSided.activeIds:
  sourceRestart?
   Object.freeze((id==='corner'?
    [(selectedShotSide==='home'?'away':'home')+'-10',selectedShotSide+'-9']:
    [selectedShotSide+'-10',(selectedShotSide==='home'?'away':'home')+'-9'])
    .concat([(selectedShotSide==='home'?'away':'home')+'-1'])):
   refereeMode&&selectedShotSide==='away'?
   Object.freeze(['home-1','away-10','home-10']):
  defenseExperiment?
   Object.freeze(selectedShotSide==='home'?
    ['home-7','away-10','home-10']:['away-7','home-10','away-10']):
   goalkeeperSave?
   Object.freeze(selectedShotSide==='home'?
    ['home-1','away-10','away-1']:
    ['away-1','home-10','home-1']):
   opposingControl?
  Object.freeze(['home-10','home-9','away-7']):
  (closePressure||moderatePressure||contestExperiment)?Object.freeze(selectedControlSide==='home'?
   ['home-10','home-9','away-7']:['away-10','away-9','home-7']):
  selectedControlSide==='away'?
   Object.freeze(['away-10','away-9','home-10']):
  selectedChallengeSide==='home'?
   Object.freeze(['home-10','home-9','away-10']):
  selectedChallengeSide==='away'?
   Object.freeze(['away-10','away-9','home-10']):
  blocked?Object.freeze(selectedShotSide==='home'?
  ['home-10','away-2','away-1']:['away-10','home-2','home-1']):
  selectedShotSide==='away'?
   Object.freeze(['away-10','home-1','home-10']):
  selectedCarrySide==='away'?
   Object.freeze(['away-10','away-9','away-11','home-9','home-11']):
   spec.focus;
 // The same physical authority produces shoe START and applies the original
 // action impulse; diagnostic flags remain explicit and DEV-local.
 const engine=createEngine(RAPIER,initial,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:!refereeMode,
  diagnosticLatestLabDynamics:currentDynamics,
  diagnosticIsolatedShotProfile:shotProfile,diagnosticFirstTimeShot:firstTimeShot,
   ...(firstTimeShot?{diagnosticInitialRollFraction:1}:{}),
  ...(smallSided?{
   diagnosticSmallSidedSituation:id,
   diagnosticSmallSidedSide:shotSide,
   diagnosticSmallSidedVariantIndex:variantIndex,
   diagnosticCarryRunwayStart:carryRunwayStart,diagnosticHistoricalCarryPhysics:historicalCarryPhysics,
   ...(id==='carry-solo'?{
    diagnosticSoloShoeWidthScale:soloShoeWidthScale,
    diagnosticSoloShoeLengthScale:soloShoeLengthScale,
    diagnosticSoloRecoveryStepScale:soloRecoveryStepScale,
    diagnosticSoloSprintCadenceScale:nativeFixedSprintLongStride?0.9:soloSprintCadenceScale,
    diagnosticSoloSprintLateralTrackScale:soloSprintLateralTrackScale,
    diagnosticSoloSprintActiveFootReleaseM:soloSprintActiveFootReleaseM,
    diagnosticIntentDrivenSoloCarryEnabled:intentDrivenSoloCarry,
   diagnosticNativeFixedCarryResearchEnabled:nativeFixedCarryResearch,
    diagnosticNativeFixedSprintLongStrideEnabled:nativeFixedSprintLongStride
   }:{}),
   diagnosticSmallSidedBodyGuardEnabled:bodyGuardEnabled,
   diagnosticCollectiveActions:collectiveApproaches,diagnosticNativeAerialEnabled:aerialLab,
   diagnosticKeeperSingleShot:keeperSingleShot,diagnosticDirectedDribble:directedDribble,diagnosticDuelTackleProfile:duelTackleProfile,
    diagnosticSmallSidedBodyFeedbackEnabled:bodyGuardEnabled
  }:{}),
  ...(refereeMode?{diagnosticBasicRestartEnabled:true}:{}),
  ...(sourceRestart?{
   diagnosticBasicRestartSource:id,
   diagnosticBasicRestartAttackSide:selectedShotSide
  }:{}),
  ...(defenseExperiment?{
    diagnosticResearchDefensiveSide:selectedShotSide,
    diagnosticResearchDefensiveKind:id
   }:goalkeeperSave?{diagnosticResearchGoalkeeperSaveSide:selectedShotSide}:
    refereeMode?{}:
    selectedShotSide&&!smallSided?{diagnosticResearchShotAttacker:selectedShotSide}:{}),
  ...(blocked?{diagnosticResearchShotBlockedLane:true}:{}),
   ...(wideCross?{diagnosticResearchShotWideCross:true}:{}),
  ...(spec.mode==='control'?{
   diagnosticResearchControlReceiver:true,
   diagnosticResearchControlSide:selectedControlSide,
   ...(firstTouchCushion?{diagnosticResearchReceivingCushionEnabled:true}:{}),
   ...(adaptiveDecision?{diagnosticResearchReceivingDecisionEnabled:true}:{}),
   ...(tapExperiment?{diagnosticResearchReceiverTapEnabled:true}:{}),
   ...(closePressure?{diagnosticResearchControlCloseDefender:true}:{}),
   ...(moderatePressure?{diagnosticResearchControlSpaceDefender:true}:{}),
   ...(contestExperiment?{diagnosticResearchControlContestDefender:true}:{})
  }:{}),
  ...(opposingControl?{diagnosticResearchControlOpponentFirst:true}:{}),
  ...(selectedCarrySide?{diagnosticResearchCarrySide:selectedCarrySide}:{}),
  ...(spec.mode==='carry'?{diagnosticAutonomousCarryEnabled:true}:{})
 });
 const mover=createPlayerMovement(smallSided?{
   researchSmallSidedSituation:id,researchSmallSidedSide:shotSide,
   ...(duelTackleProfile==='shoulder'?{researchShoulderStart:true}:{}),
   ...(duelTackleProfile==='interception'?{researchInterceptionStart:true}:{}),
   ...(duelTackleProfile==='block'?{researchBlockStart:true}:{}),
   ...(shotProfile==='tap-in'?{researchTapInStart:true}:{}),
   ...(firstTimeShot?{researchFirstTimeShot:true}:{}),
   ...(variantIndex>0?{researchSmallSidedVariantIndex:variantIndex}:{}),
   ...(carryRunwayStart?{researchCarryRunwayStart:true}:{}),
   ...(nativeFixedCarryResearch?{researchNativeFixedCarry:true}:{}),
   ...(soloSprintPursuitLeadM!==0?{
    researchSoloSprintPursuitLeadM:soloSprintPursuitLeadM}:{}),
   ...(soloCarryLockedPhase!==null?{
    researchSoloCarryLockedPhase:soloCarryLockedPhase,
    researchSoloCarryPlayerAttributes:selectedCarryAttributes}:{}),
   ...(collectiveApproaches?{researchCollectiveApproaches:true}:{}),
   ...(bodyGuardEnabled?{researchSmallSidedBodyFeedback:true}:{})
  }:sourceRestart?{
   researchBasicRestartSource:id,
   researchBasicRestartAttackSide:selectedShotSide,
   researchBasicRestartBall:initial
  }:refereeMode?{}:defenseExperiment?{
   researchDefensiveSide:selectedShotSide,
   researchDefensiveKind:id,
   researchDefensiveBall:initial
  }:goalkeeperSave?{
   researchGoalkeeperSaveSide:selectedShotSide,
   researchGoalkeeperSaveBall:initial
  }:selectedShotSide?{
  researchShotAttacker:selectedShotSide,researchShotBall:initial,
  ...(blocked?{researchShotBlockedLane:true}:{}),
   ...(wideCross?{researchShotWideCross:true}:{})
 }:spec.mode==='control'?{
  researchControlReceiver:true,researchControlBall:initial,
  researchControlSide:selectedControlSide,
  ...(opposingControl?{researchControlOpponentFirst:true}:{}),
  ...(closePressure?{researchControlCloseDefender:true}:{}),
  ...(moderatePressure?{researchControlSpaceDefender:true}:{}),
   ...(contestExperiment?{researchControlContestDefender:true}:{}),
   ...(reachExperiment?{researchControlChallengerReach:true}:{})
 }:selectedCarrySide?{
  researchCarrySide:selectedCarrySide,researchCarryBall:initial
 }:{});
 let firstPhysicalPassAction=null;
 let disposed=false,firstRealPass=null,count=0,history=Object.freeze([]);
 let intentCarryImpulseCount=0;
 const soloReadout=soloCarryLockedPhase===null?null:{
  // Read-only authenticated native action timeline; NOT solver collision forces.
  nativeTouchTicks:[],nativeAddedImpulseSumNs:0,
  ballStartX:engine.snapshot().ball.position.x,playerPrev:null,playerPrevV:null,
  playerPathM:0,ballPathM:0,lastBall:null,speedSum:0,gapSum:0,
  peakPlayerSpeedMps:0,peakBallSpeedMps:0,peakAccelerationMps2:0,
  samples:0,lateSpeedSum:0,lateSpeedSampleTicks:0,
  peakGapM:0,outOfReachTicks:0,realRecoveryEpisodes:0,outOfReach:false
 };
 let shotTrace=null,blockedShotObservation=null,receivingContact=null;
 let blockAudit=duelTackleProfile==='block'?Object.freeze({phase:'ready',shotTick:null,contactTick:null,blocked:false}):null;
 let previousBlockBall=null;
 let interceptionAudit=duelTackleProfile==='interception'?Object.freeze({phase:'ready',passTick:null,interceptionTick:null,carryTick:null,recipientTick:null}):null;
 let passPairAudit=id==='pass-pair'&&!interceptionAudit?Object.freeze({
  attempted:false,passTick:null,receiverTick:null,targetDistanceM:null,
  launchSpeedMps:null,peakBallSpeedMps:0,closestTargetGapM:null,
  peakGroundClearanceM:0,flightTimeS:null,
  receivingContact:null,receiverFollowThrough:null,
  officialPassCompleted:false,officialReception:false
 }):null;
 let previousPassBall=null;
 let crossPairAudit=id==='cross-pair'?Object.freeze({attempted:false,tick:null,
  airborne:false,peakClearanceM:0,arrival:null,firstLowSample:null,
  firstDescendingHalfMetre:null,firstGroundContact:null,
  firstReceivingShoeStart:null,receivingCushion:null,receiverFollowThrough:null,
  officialCrossCompleted:false,
  officialReception:false}):null;
 let previousCrossBall=null;
 let shotSoloAudit=id==='shot-solo'?Object.freeze({profile:shotProfile,firstTimeShot,attempted:false,launchTick:null,peakClearanceM:0,maxLateralBendM:0,crossing:null,officialGoal:false}):null;
 let firstOpposingShoe=null,carryTrace=null,physicalRestart=null,b05bOutKick=null,b05bTake=null;
 // One read-only observer of the original closed Rapier shoe/ball source.
 const decisionObserver=createPhysicalFootballDecisionObserver();
 const continuityObserver=createRealPostContactBallContinuity();
 const pressureObserver=firstTouchCushion?
  createRealPressuredFirstTouchObserver():null;
 const followThroughObserver=adaptiveDecision&&!tapExperiment?
  createRealSecondTouchFollowThrough():null;
 const controlGateObserver=adaptiveDecision&&!tapExperiment?
  createNativeControlEvidenceGateM29():null;
 const releaseObserver=tapExperiment?createRealBallReleaseAuditM30():null;
 const contestObserver=tapExperiment?createRealOpponentBallContestAuditM31():null;
 if(smallSided&&JSON.stringify(engine.originalSmallSidedPhysicalShoeIds())!==
   JSON.stringify(smallSided.activeIds))
  throw new Error('Small-sided participants differ from physical Rapier shoe colliders');
 const keeperShotObserver=id==='keeper-1v1'?createKeeperShotObserver(shotSide):null;
 const shieldObserver=directedDribble?createDribbleShieldObserver(shotSide):null;
 const refereeObserver=(refereeMode||smallSided)?
  createBasicMatchRefereeB05():null;
 const matchTimelineObserver=(refereeMode||smallSided)?
  createBasicMatchTimelineB06():null;
 const isolatedDribbleAudit=(!collectiveApproaches&&!intentDrivenSoloCarry&&
  ['dribble-1v1','carry-solo'].includes(id))?
  createIsolatedDribbleNativeAudit({side:shotSide,variantIndex,solo:id==='carry-solo',directed:directedDribble}):null;
 const baseFootworkObserver=basicFootwork?
  createBasicReceiveDribbleObserverB04({side:selectedControlSide,kind:id}):null;
 const collectiveCounts=collectiveApproaches?{carry:0,pass:0,shot:0,tackle:0,interception:0,save:0,other:0}:null;
 let headerAudit=null,headerCrossAudit=null,aerialControlAudit=null,aerialDuelAudit=null,loftedPassAudit=null,volleyAudit=null,highClaimAudit=null;
 let priorRecordedBallVelocity=null;
 function record(physics,playerFrame){
  const incomingVelocity=priorRecordedBallVelocity;
  priorRecordedBallVelocity=Object.freeze({...physics.ball.velocity});
  const foot=engine.footContactSnapshot();
  const starts=Object.freeze([...foot.started]);
  if(foot.tick!==physics.tick||playerFrame.tick!==physics.tick)
   throw new Error('Only genuine same-tick Rapier and canonical mover allowed');
  const raw=engine.uniformAutonomousActionSnapshot?.()??null;
  const action=raw?.tick===physics.tick?raw:null;
  const collectiveControl=collectiveApproaches?engine.collectiveControlSnapshot():null;
  if(collectiveCounts&&action?.appliedByRapier===true&&action.actualPhysicsImpulseApplied===true&&action.tick===physics.tick){
   const kind=Object.hasOwn(collectiveCounts,action.action)?action.action:'other';collectiveCounts[kind]++;
  }
  if(blockAudit){
   const ball=physics.ball,defender=(shotSide==='home'?'away':'home')+'-2';
   const body=engine.smallSidedBodyGuardSnapshot();
   if(action?.action==='shot'&&blockAudit.phase==='ready')blockAudit=Object.freeze({...blockAudit,phase:'flight',shotTick:physics.tick,shotSpeedMps:Math.hypot(ball.velocity.x,ball.velocity.y,ball.velocity.z)});
   else if(blockAudit.phase==='flight'&&previousBlockBall&&physics.tick>blockAudit.shotTick&&(starts.includes(defender)||body.lowerLegBallStarts.includes(defender))){
    const observed=observeNativeShotBlock({tick:physics.tick,delivery:{kind:'shot',tick:blockAudit.shotTick,team:shotSide},players:playerFrame.players,starts,bodyStarts:body.lowerLegBallStarts,before:previousBlockBall.velocity,after:ball.velocity});
    if(observed?.actorId===defender)blockAudit=Object.freeze({...blockAudit,...observed,phase:observed.blocked?'blocked':'flight'});
   }
   previousBlockBall=ball;
  }
  if(interceptionAudit){
   if(action?.action==='pass'&&interceptionAudit.phase==='ready')interceptionAudit=Object.freeze({...interceptionAudit,phase:'flight',passTick:physics.tick,passDistanceM:action.passTarget.distanceM});
   else if(action?.action==='interception'&&interceptionAudit.phase==='flight')interceptionAudit=Object.freeze({...interceptionAudit,phase:'intercepted',interceptionTick:physics.tick,actorId:action.playerId});
   else if(action?.action==='carry'&&interceptionAudit.phase==='intercepted')interceptionAudit=Object.freeze({...interceptionAudit,phase:'collected',carryTick:physics.tick});
   else if(interceptionAudit.phase==='flight'&&starts.includes(shotSide+'-9'))interceptionAudit=Object.freeze({...interceptionAudit,phase:'received',recipientTick:physics.tick});
  }
  if((intentDrivenSoloCarry||nativeFixedCarryResearch)&&
     action?.action==='carry'&&
     action.actualPhysicsImpulseApplied===true){
   intentCarryImpulseCount++;
   if(nativeFixedCarryResearch&&action.nativeShoeContactVerified===true&&
      foot.nativeSoloFeet?.exclusivePhysicalStart===true){
    soloReadout.nativeTouchTicks.push(physics.tick);
    soloReadout.nativeAddedImpulseSumNs+=Math.hypot(
     action.impulseNs.x,action.impulseNs.y,action.impulseNs.z);
   }
  }
  if(soloReadout&&physics.tick>0){
   const actor=playerFrame.players.find(p=>p.id===shotSide+'-10');
   const position=physics.ball.position,velocity=physics.ball.velocity;
   const speed=Math.hypot(actor.vx,actor.vy);
   const gap=Math.hypot(position.x-actor.x,position.y-actor.y);
   if(soloReadout.playerPrev)
    soloReadout.playerPathM+=Math.hypot(actor.x-soloReadout.playerPrev.x,
     actor.y-soloReadout.playerPrev.y);
   if(soloReadout.lastBall)
    soloReadout.ballPathM+=Math.hypot(position.x-soloReadout.lastBall.x,
     position.y-soloReadout.lastBall.y);
   if(soloReadout.playerPrevV)
    soloReadout.peakAccelerationMps2=Math.max(
     soloReadout.peakAccelerationMps2,60*Math.hypot(
      actor.vx-soloReadout.playerPrevV.x,
      actor.vy-soloReadout.playerPrevV.y));
   soloReadout.playerPrev={x:actor.x,y:actor.y};
   soloReadout.playerPrevV={x:actor.vx,y:actor.vy};
   soloReadout.lastBall={x:position.x,y:position.y};
   soloReadout.samples++;
   soloReadout.speedSum+=speed;
   soloReadout.gapSum+=gap;
   soloReadout.peakGapM=Math.max(soloReadout.peakGapM,gap);
   // Explicit observational proxy only; no invented possession or take-on.
   // The 1.5m loss threshold is the existing canonical lost-ball chase gate.
   const outOfReach=gap>1.5;
   if(outOfReach)soloReadout.outOfReachTicks++;
   if(!outOfReach&&soloReadout.outOfReach)
    soloReadout.realRecoveryEpisodes++;
   soloReadout.outOfReach=outOfReach;
   soloReadout.peakPlayerSpeedMps=Math.max(soloReadout.peakPlayerSpeedMps,speed);
   soloReadout.peakBallSpeedMps=Math.max(soloReadout.peakBallSpeedMps,
    Math.hypot(velocity.x,velocity.y));
   if(physics.tick>=121&&physics.tick<=180){
    soloReadout.lateSpeedSampleTicks++;
    soloReadout.lateSpeedSum+=speed;
   }
  }
  const soloCarryMeasurements=soloReadout?Object.freeze({
   samples:soloReadout.samples,
   ballForwardM:(shotSide==='home'?1:-1)*
    (physics.ball.position.x-soloReadout.ballStartX),
   ballPathM:soloReadout.ballPathM,
   playerPathM:soloReadout.playerPathM,
   peakPlayerSpeedMps:soloReadout.peakPlayerSpeedMps,
   peakBallSpeedMps:soloReadout.peakBallSpeedMps,
   peakAccelerationMps2:soloReadout.peakAccelerationMps2,
   meanPlayerSpeedMps:soloReadout.samples?
    soloReadout.speedSum/soloReadout.samples:0,
   meanGapM:soloReadout.samples?
    soloReadout.gapSum/soloReadout.samples:0,
   peakGapM:soloReadout.peakGapM,
   observedOutOfReachTicks:soloReadout.outOfReachTicks,
   observedRealRecoveryEpisodes:soloReadout.realRecoveryEpisodes,
   outOfReachNow:soloReadout.outOfReach,
   lateSpeedSampleTicks:soloReadout.lateSpeedSampleTicks,
   lateMeanSpeedMps:soloReadout.lateSpeedSampleTicks?
    soloReadout.lateSpeedSum/soloReadout.lateSpeedSampleTicks:0,
   appliedCarryImpulses:intentCarryImpulseCount,
   // Isolate recent native impulse cadence from the cumulative source count.
   // N·s reflects only the additional action, not all Rapier solver forces.
   nativeConfirmedImpulseCount:soloReadout.nativeTouchTicks.length,
   nativeRecent2sImpulseCount:soloReadout.nativeTouchTicks.filter(
    t=>t>physics.tick-120).length,
   nativeMeanImpulseGapS:soloReadout.nativeTouchTicks.length>1?
    (soloReadout.nativeTouchTicks.at(-1)-soloReadout.nativeTouchTicks[0])/
     (60*(soloReadout.nativeTouchTicks.length-1)):null,
   nativeMeanAddedImpulseNs:soloReadout.nativeTouchTicks.length?
    soloReadout.nativeAddedImpulseSumNs/soloReadout.nativeTouchTicks.length:null
  }):null;
  // Only a genuine post-pass Rapier opponent shoe START is negative evidence.
  // Neither nearby player positions nor a guessed interception suffice.
  const opposingStart=spec.mode==='control'&&firstRealPass?
   starts.find(id=>id.startsWith(
    selectedControlSide==='home'?'away-':'home-')):null;
  if(opposingStart&&!firstOpposingShoe)
   firstOpposingShoe=Object.freeze({
    tick:physics.tick,playerId:opposingStart,
    passingTick:firstRealPass.tick,realShoeStart:true,
    officialInterception:false,tackleConfirmed:null
   });
  // A gameplay-proximity impulse is NOT native shoe evidence. Keep the
  // actual Rapier ball action visible, but do not feed it to any observer
  // whose proofs require a genuine shoe START.
  const nativeAction=intentDrivenSoloCarry||action?.nativeExclusiveHeadStart===true||action?.nativeExclusiveAerialControlStart===true?null:action;
  if(id==='volley-solo'&&!volleyAudit&&headerCrossAudit&&action?.nativeVolley===true&&action.nativeExclusiveAerialControlStart===true&&action.actualPhysicsImpulseApplied===true&&
     action.playerId===headerCrossAudit.recipientId&&action.tick>headerCrossAudit.tick)
   volleyAudit=Object.freeze({cross:headerCrossAudit,launch:action,crossing:null});
  if(['lofted-pass','lofted-short','lofted-switch'].includes(id)){
   if(!loftedPassAudit&&action?.action==='pass'&&action.passTarget?.deliveryProfile==='lofted'&&action.actualPhysicsImpulseApplied===true&&starts.length===1&&starts[0]===action.playerId)
    loftedPassAudit=Object.freeze({launch:action,peakZM:physics.ball.position.z,receiverContact:null});
   if(loftedPassAudit&&!loftedPassAudit.receiverContact){
    const launch=loftedPassAudit.launch,body=engine.smallSidedBodyGuardSnapshot();
    const receiver=launch.recipientId;
    const receivingSurface=body.aerial?.find(s=>s.actorId===receiver&&s.surface==='foot'&&s.contactStarted&&s.actualNativeSolverContact);
    // The solver may reverse vertical velocity at the very contact being
    // measured. Use real incoming velocity and exclusive contact evidence.
    const sole=starts.length===1&&starts[0]===receiver&&foot.active.length===1&&foot.active[0]===receiver&&!body.aerialControlContacts?.length&&!body.lowerLegBallContacts.length;
    const raised=receivingSurface&&body.aerialControlStarts.length===1&&body.aerialControlContacts.length===1&&!foot.active.length&&!body.lowerLegBallContacts.length;
    const hit=physics.tick>launch.tick&&((sole&&incomingVelocity?.z<0)||(raised&&receivingSurface.incomingVelocity.z<0));
    loftedPassAudit=Object.freeze({...loftedPassAudit,peakZM:Math.max(loftedPassAudit.peakZM,physics.ball.position.z),
     receiverContact:hit?Object.freeze({tick:physics.tick,actorId:launch.recipientId,officialPossession:false}):null});
   }
  }
  if(id==='aerial-duel'&&physics.tick>0&&!aerialDuelAudit)aerialDuelAudit=observeNativeAerialDuel({tick:physics.tick,evidence:engine.smallSidedBodyGuardSnapshot().aerial,players:playerFrame.players.filter(p=>focus.includes(p.id)),action});
  if(aerialLab&&action?.action==='aerial-control'&&action.nativeExclusiveAerialControlStart===true&&!aerialControlAudit&&
     (id==='aerial-foot-control'||headerCrossAudit&&action.playerId===headerCrossAudit.recipientId&&action.tick>headerCrossAudit.tick))aerialControlAudit=action;
  if(aerialLab&&action?.action==='cross'&&action.appliedByRapier===true&&action.actualPhysicsImpulseApplied===true&&
     starts.length===1&&starts[0]===action.playerId&&!headerCrossAudit)headerCrossAudit=action;
  if(['keeper-high-cross','keeper-high-intercept'].includes(id)&&headerCrossAudit){
   const k=engine.nativeKeeperSnapshots().find(k=>k.keeperId===smallSided.opponent+'-1');
   if(k?.plan?.kind==='high-claim'&&k.started&&!highClaimAudit)highClaimAudit=Object.freeze({cross:headerCrossAudit,attemptTick:k.tick,keeperId:k.keeperId,contactTick:null,confirmedTick:null,punchTick:null,gripReleased:false});
   if(highClaimAudit&&k){
    const contactTick=highClaimAudit.contactTick??(k.contactStarted&&k.plan?.kind==='high-claim'?k.tick:null);
    highClaimAudit=Object.freeze({...highClaimAudit,contactTick,confirmedTick:highClaimAudit.confirmedTick??(contactTick!==null?k.catchState?.confirmedTick??null:null),punchTick:highClaimAudit.punchTick??(contactTick!==null&&k.highHandAction?.kind==='punch'&&k.highHandAction.actualPhysicsImpulseApplied===true?k.tick:null),gripReleased:highClaimAudit.gripReleased||k.catchState?.released===true});
   }
  }
  if(aerialLab&&action?.nativeExclusiveHeadStart===true&&headerCrossAudit&&
     action.tick>headerCrossAudit.tick&&action.playerId===headerCrossAudit.recipientId&&!headerAudit)headerAudit=action;
  const evidence=classifyActionLabEvidence(spec,{
   tick:physics.tick,action:nativeAction,starts,priorPass:firstRealPass,
   opponentEarlier:firstOpposingShoe!==null,
   challengeSide:selectedChallengeSide??'away'
  });
  // Observe the original unmodified three-lane geometry ONLY after
  // the real single Rapier shooter START on this exact physics tick.
  if(blocked&&starts.length===1&&
     starts[0]===selectedShotSide+'-10'&&physics.tick>0){
   const geometry=inspectUniformPolicyGeometry({
    tick:physics.tick,playerId:starts[0],
    ballPosition:physics.ball.position,
    physicalPlayerPositions:Object.freeze(playerFrame.players.map(p=>
     Object.freeze({engineId:p.id,team:p.team,role:p.role,x:p.x,y:p.y})))
   });
   if(geometry.shotRange&&!geometry.shotLaneFound&&
      action?.action!=='shot')
    blockedShotObservation=Object.freeze({
     tick:physics.tick,playerId:starts[0],
     policyGeometry:geometry,actionType:action?.action??null,
     realShoeStart:true,officialGoal:false
    });
  }
  if(spec.mode==='control'&&evidence.verifiedReceivingShoeContact&&
     receivingContact===null)
   receivingContact=Object.freeze({
    tick:physics.tick,recipientId:starts[0],
    passingPlayerId:firstRealPass.playerId,
    passingTick:firstRealPass.tick,
    realShoeStart:true,officialPossession:false,passCompleted:false
   });
  if(evidence.witnessed){
   count++;
   history=Object.freeze([...history,Object.freeze({
    tick:physics.tick,kind:spec.goal,
    actorId:action?.playerId??starts[0]??null
   })].slice(-12));
  }
  // Post-impulse ball centres from the single Rapier engine, not a
  // predicted trajectory or inferred official goal.
  const p=physics.ball.position;
  if(['shot','cross','save','tackle','interception'].includes(action?.action)&&evidence.verifiedShoeImpulse){
   shotTrace=Object.freeze({
    shooterId:action.playerId,team:action.team,tick:physics.tick,
     actionType:action.action,
    origin:Object.freeze({...p}),last:Object.freeze({...p}),
    samples:1,path3DM:0,maxCenterZM:p.z,observed3DFlight:false
   });
  }else if(shotTrace){
   const prev=shotTrace.last;
   const travelled=Math.hypot(p.x-prev.x,p.y-prev.y,p.z-prev.z);
   const maxZ=Math.max(shotTrace.maxCenterZM,p.z);
   shotTrace=Object.freeze({
    ...shotTrace,last:Object.freeze({...p}),
    samples:shotTrace.samples+1,path3DM:shotTrace.path3DM+travelled,
    maxCenterZM:maxZ,
    observed3DFlight:maxZ>shotTrace.origin.z+0.02
   });
  }
  // Carry is a single observed Rapier impulse plus ball motion after it,
  // not a trap, multi-touch success or virtual dribble.
  if(action?.action==='carry'&&
     (evidence.verifiedShoeImpulse||intentDrivenSoloCarry)&&!carryTrace){
   carryTrace=Object.freeze({
    tick:physics.tick,actorId:action.playerId,team:action.team,
    origin:Object.freeze({...p}),last:Object.freeze({...p}),
    path2DM:0,samples:1,groundedSamples:p.z<=0.15?1:0,
    observedGroundMotion:false,endedByOtherAction:false,
    officialPossession:false,dribbleConfirmed:null
   });
  }else if(carryTrace&&!carryTrace.endedByOtherAction){
   if(action&&physics.tick!==carryTrace.tick){
    carryTrace=Object.freeze({...carryTrace,endedByOtherAction:true});
   }else{
    const travelled=Math.hypot(p.x-carryTrace.last.x,
     p.y-carryTrace.last.y);
    const distance=carryTrace.path2DM+travelled;
    const grounded=carryTrace.groundedSamples+(p.z<=0.15?1:0);
    carryTrace=Object.freeze({
     ...carryTrace,last:Object.freeze({...p}),
     path2DM:distance,samples:carryTrace.samples+1,
     groundedSamples:grounded,
     observedGroundMotion:distance>0.15&&grounded>=2
    });
   }
  }
  if(action?.action==='pass'&&!firstRealPass&&
     starts.length===1&&starts[0]===action.playerId&&
     action.appliedByRapier===true&&
     action.actualPhysicsImpulseApplied===true&&
     (spec.mode!=='control'||(
      action.playerId===selectedControlSide+'-10'&&
      action.team===selectedControlSide&&
      action.passTarget?.recipientId===selectedControlSide+'-9'))){
   firstRealPass=Object.freeze({
    tick:physics.tick,playerId:action.playerId,
    team:action.team,recipientId:action.passTarget?.recipientId??null,
    physicalImpulseApplied:true
   });
   firstPhysicalPassAction=action;
  }
  // Only the closed one-World Action LAB supplies these same-tick samples.
  // No new impulse, tackle, reception or possession is authorized.
  const decisionEvidence=decisionObserver.observe({
   physics,playerFrame,foot,action:nativeAction
  });
  // Read-only original Rapier evidence. A later exclusive receiving
  // shoe START is observed; it does not establish completed reception.
  if(passPairAudit){
   if(nativeAction?.action==='pass'&&!passPairAudit.attempted){
    const target=nativeAction.passTarget;
    passPairAudit=Object.freeze({...passPairAudit,attempted:true,
     passTick:physics.tick,targetDistanceM:target.distanceM,
     targetX:target.recipientX,targetY:target.recipientY,
     launchSpeedMps:Math.hypot(physics.ball.velocity.x,physics.ball.velocity.y),
     appliedImpulseNs:Math.hypot(nativeAction.impulseNs.x,nativeAction.impulseNs.y),
     calibrationScale:nativeAction.isolatedGroundPassCalibration?.scale??1});
   }
   if(passPairAudit.attempted&&passPairAudit.receiverTick===null){
    const pos=physics.ball.position,vel=physics.ball.velocity;
    const gap=Math.hypot(pos.x-passPairAudit.targetX,pos.y-passPairAudit.targetY);
    const receive=decisionEvidence.firstPossibleReception;
    const cushion=receive?engine.researchReceivingCushionSnapshot():null;
    if(cushion&&(cushion.tick!==physics.tick||cushion.actorId!==receive.playerId))
     throw new Error('PASS-02 requires the same genuine receiving START');
    // The preceding 60Hz sample is before the receiving collision tick.
    // When a cushion occurs, distinguish original solver output from the
    // additional real damping impulse; no exact sub-tick speed is inferred.
    if(receive&&(receive.tick!==physics.tick||
       previousPassBall?.tick!==physics.tick-1))
     throw new Error('PASS-01 receiving observation requires consecutive native samples');
    passPairAudit=Object.freeze({...passPairAudit,
     peakBallSpeedMps:Math.max(passPairAudit.peakBallSpeedMps,Math.hypot(vel.x,vel.y)),
     closestTargetGapM:Math.min(passPairAudit.closestTargetGapM??Infinity,gap),
     peakGroundClearanceM:Math.max(passPairAudit.peakGroundClearanceM,Math.max(0,pos.z-0.11)),
     receiverTick:receive?.tick??null,
     flightTimeS:receive?(receive.tick-passPairAudit.passTick)*FIXED_DT:null,
     receivingContact:receive?Object.freeze({
      receiverId:receive.playerId,
      priorSampleTick:previousPassBall.tick,contactTick:physics.tick,
      priorSampleSpeedMps:Math.hypot(previousPassBall.velocity.x,previousPassBall.velocity.y),
      postSolverSpeedMps:cushion?Math.hypot(cushion.realPreBallVelocity.x,cushion.realPreBallVelocity.y):
       Math.hypot(vel.x,vel.y),
      postContactSpeedMps:Math.hypot(vel.x,vel.y),
      cushion,mode:cushion?'active-cushion':'passive-contact',
      targetGapM:gap,position:Object.freeze({...pos}),realRapierShoeStart:true,readOnly:true,
      officialReception:false
     }):null});
   }
   // Observe one second after the first contact (and optional one-time
   // cushion). No later assisted trap, target movement or extra impulse.
   if(passPairAudit.receiverTick!==null){
    const elapsed=physics.tick-passPairAudit.receiverTick;
    if(elapsed>=0&&elapsed<=120){
     const pos=physics.ball.position,vel=physics.ball.velocity;
     const contact=passPairAudit.receivingContact,dir=contact.cushion?.controlDirection;
     const dx=pos.x-contact.position.x,dy=pos.y-contact.position.y;
     const sample=Object.freeze({tick:physics.tick,
      directedTravelM:dir?dx*dir.x+dy*dir.y:null,
      crossTrackM:dir?Math.abs(dx*dir.y-dy*dir.x):null,
      gapM:Math.hypot(pos.x-passPairAudit.targetX,pos.y-passPairAudit.targetY),
      speedMps:Math.hypot(vel.x,vel.y)});
     const prior=passPairAudit.receiverFollowThrough;
     passPairAudit=Object.freeze({...passPairAudit,
      receiverFollowThrough:Object.freeze({
       samples:(prior?.samples??0)+1,
       maxGapM:Math.max(prior?.maxGapM??0,sample.gapM),
       maxHorizontalSpeedMps:Math.max(prior?.maxHorizontalSpeedMps??0,sample.speedMps),
       minDirectedTravelM:Math.min(prior?.minDirectedTravelM??0,sample.directedTravelM??0),
       maxCrossTrackM:Math.max(prior?.maxCrossTrackM??0,sample.crossTrackM??0),
       atQuarterSecond:elapsed===15?sample:prior?.atQuarterSecond??null,
       atHalfSecond:elapsed===30?sample:prior?.atHalfSecond??null,
       atOneSecond:elapsed===60?sample:prior?.atOneSecond??null,
       atTwoSeconds:elapsed===120?sample:null,
       completed:elapsed===120,readOnly:true,officialReception:false
      })});
    }
   }
   previousPassBall=Object.freeze({tick:physics.tick,
    velocity:Object.freeze({...physics.ball.velocity})});
  }
  if(crossPairAudit){
   const pos=physics.ball.position,vel=physics.ball.velocity;
   if(nativeAction?.action==='cross'&&!crossPairAudit.attempted){
    const target=nativeAction.crossTarget;
    crossPairAudit=Object.freeze({...crossPairAudit,attempted:true,tick:physics.tick,
     originX:target.originX,originY:target.originY,
     targetX:target.targetX,targetY:target.targetY,targetDistanceM:target.distanceM,
     recipientId:target.recipientId,launchSpeedMps:Math.hypot(vel.x,vel.y,vel.z)});
   }
   if(crossPairAudit.attempted){
    const prior=crossPairAudit;
    const clearance=Math.max(0,pos.z-0.11);
    const airborne=prior.airborne||clearance>0.20;
    const descending=prior.descending===true||vel.z<0;
    const sample=()=>Object.freeze({
     tick:physics.tick,timeS:(physics.tick-prior.tick)*FIXED_DT,
     position:Object.freeze({...pos}),
     velocity:Object.freeze({...vel}),
     targetGapM:Math.hypot(pos.x-prior.targetX,pos.y-prior.targetY),
     clearanceM:clearance,readOnly:true
    });
    const eligible=prior.airborne&&physics.tick>prior.tick;
    const ground=eligible?engine.crossGroundContactSnapshot():null;
    if(ground&&ground.tick!==physics.tick)
     throw new Error('CROSS-01 ground contact must be same-tick native evidence');
    const firstGroundContact=prior.firstGroundContact??(
     eligible&&ground.nativeGroundPair?Object.freeze({...sample(),
      source:'native-ground-solver-pair',ground}):null);
    const cushion=engine.researchReceivingCushionSnapshot();
     if(cushion&&cushion.version!==CURRENT_LAB_DYNAMICS_VERSION)
      throw new Error('CROSS-02 requires isolated low-cross first touch');
     const firstReceivingShoeStart=prior.firstReceivingShoeStart??(
     eligible&&starts.length===1&&starts[0]===prior.recipientId&&
      foot.active.length===1&&foot.active[0]===prior.recipientId?
      Object.freeze({...sample(),source:'native-receiving-shoe-start',
       recipientId:prior.recipientId,realRapierShoeStart:true}):null);
    const firstDescendingHalfMetre=prior.firstDescendingHalfMetre??(
     eligible&&previousCrossBall&&previousCrossBall.velocity.z<0&&
      previousCrossBall.position.z-0.11>0.50&&clearance<=0.50?
      Object.freeze({...sample(),source:'observed-descending-half-metre'}):null);
    // Preserve v1's low sample independently, even when a native contact
    // already occurred. It can belong to a later rebound, not delivery.
    const firstLowSample=prior.firstLowSample??(
     airborne&&clearance<=0.10&&descending?Object.freeze({...sample(),
      source:'observed-low-sample'}):null);
    // Only real same-world contact can establish the first physical
    // arrival. A later low sample is not allowed to overwrite it.
    const arrival=prior.arrival??firstReceivingShoeStart??firstGroundContact;
     if(cushion&&(!firstReceivingShoeStart||cushion.tick!==firstReceivingShoeStart.tick||
        cushion.actorId!==prior.recipientId||cushion.originalCrossTick!==prior.tick))
      throw new Error('CROSS-02 cushion requires original first receiving START');
     let follow=prior.receiverFollowThrough;
     if(firstReceivingShoeStart&&!follow?.completed){
      const elapsed=physics.tick-firstReceivingShoeStart.tick;
      const receiver=playerFrame.players.find(p=>p.id===prior.recipientId);
      const dx=pos.x-firstReceivingShoeStart.position.x,dy=pos.y-firstReceivingShoeStart.position.y;
      const dir=cushion?.controlDirection;
      const current=Object.freeze({tick:physics.tick,elapsedTicks:elapsed,
       position:Object.freeze({...pos}),velocity:Object.freeze({...vel}),
       directedTravelM:dir?dx*dir.x+dy*dir.y:null,
       crossTrackM:dir?Math.abs(dx*dir.y-dy*dir.x):null,
       gapM:Math.hypot(pos.x-receiver.x,pos.y-receiver.y),
       speedMps:Math.hypot(vel.x,vel.y,vel.z),
       horizontalSpeedMps:Math.hypot(vel.x,vel.y),verticalSpeedMps:vel.z,
       angularSpeedRadS:Math.hypot(...Object.values(engine.angularVelocity())),
       clearanceM:clearance});
      follow=Object.freeze({samples:(follow?.samples??0)+1,
       maxGapM:Math.max(follow?.maxGapM??0,current.gapM),
       maxClearanceM:Math.max(follow?.maxClearanceM??0,clearance),
       maxHorizontalSpeedMps:Math.max(follow?.maxHorizontalSpeedMps??0,current.horizontalSpeedMps),
       maxSpeedMps:Math.max(follow?.maxSpeedMps??0,current.speedMps),
       ticksAboveOneMps:(follow?.ticksAboveOneMps??0)+(current.horizontalSpeedMps>1?1:0),
       minDirectedTravelM:Math.min(follow?.minDirectedTravelM??0,current.directedTravelM??0),
       maxCrossTrackM:Math.max(follow?.maxCrossTrackM??0,current.crossTrackM??0),
       atQuarterSecond:elapsed===15?current:follow?.atQuarterSecond??null,
       atHalfSecond:elapsed===30?current:follow?.atHalfSecond??null,
       atOneSecond:elapsed===60?current:follow?.atOneSecond??null,
       atTwoSeconds:elapsed===120?current:null,completed:elapsed===120,readOnly:true});
     }
    crossPairAudit=Object.freeze({...prior,airborne,descending,
     peakClearanceM:prior.arrival?prior.peakClearanceM:
      Math.max(prior.peakClearanceM,clearance),
     arrival,firstLowSample,firstDescendingHalfMetre,
     firstGroundContact,firstReceivingShoeStart,receivingCushion:cushion,
      receiverFollowThrough:follow});
   }
   previousCrossBall=physics.ball;
  }
  const physicalFirstTouch=engine.researchReceivingCushionSnapshot?.()??null;
  const physicalReceiverChoice=engine.researchReceiverChoiceSnapshot?.()??null;
  const physicalReceiverTap=engine.researchReceiverTapSnapshot?.()??null;
  const postDeferContinuity=followThroughObserver?.observe({
   physics,playerFrame,foot,physicalFirstTouch,physicalReceiverChoice,
   action:nativeAction
  })??null;
  const realReleaseSequence=releaseObserver?.observe({
   physics,playerFrame,foot,
   solver:engine.footContactSolverSnapshot(),
   choice:physicalReceiverChoice,tap:physicalReceiverTap,
   action:nativeAction
  })??null;
  const realOpponentContest=contestObserver?.observe({
   physics,playerFrame,foot,
   solver:engine.footContactSolverSnapshot(),
   tap:physicalReceiverTap,m30:realReleaseSequence,
   action:nativeAction
  })??null;
  const physicalControlEvidence=controlGateObserver?.observe({
   physics,playerFrame,foot,
   solver:engine.footContactSolverSnapshot(),m28:postDeferContinuity,
   action:nativeAction
  })??null;
  const pressureEvidence=pressureObserver?.observe({
   physics,playerFrame,foot,physicalFirstTouch,action:nativeAction
  })??null;
  const baseFootworkAudit=baseFootworkObserver?.observe({
   physics,playerFrame,foot,
   solver:engine.footContactSolverSnapshot(),
   action:nativeAction,priorPass:firstRealPass,
   cushion:physicalFirstTouch,tap:physicalReceiverTap,
   releaseSequence:realReleaseSequence
  })??null;
  if(baseFootworkAudit?.attemptTick===physics.tick){
   count++;
   history=Object.freeze([...history,Object.freeze({
    tick:physics.tick,kind:id,actorId:baseFootworkAudit.actorId
   })].slice(-12));
  }
  const keeperDive=engine.keeperDiveSnapshot?.()??(['keeper-high-cross','keeper-high-intercept'].includes(id)?engine.nativeKeeperSnapshots()[0]??null:null);
  const refereeEvidence=refereeObserver?.observe({
   physics,playerFrame,foot,solver:engine.footContactSolverSnapshot(),
   action:aerialLab?action:nativeAction,...(keeperDive?{keeperDive}: {}),
   ...(aerialLab&&physics.tick>0?{aerialEvidence:engine.smallSidedBodyGuardSnapshot().aerial,
    aerialConflict:engine.smallSidedBodyGuardSnapshot().lowerLegBallContacts.length>0}:{})
  })??null;
  if(refereeEvidence?.lastEvent?.tick===physics.tick){
   count++;
   history=Object.freeze([...history,Object.freeze({
    tick:physics.tick,kind:refereeEvidence.lastEvent.kind,
    actorId:refereeEvidence.lastVerifiedTouch?.playerId??null
   })].slice(-12));
  }
  if(shotSoloAudit){
   if(nativeAction?.action==='shot'&&!shotSoloAudit.attempted){
    const c=nativeAction.labShotCalibration;
    shotSoloAudit=Object.freeze({...shotSoloAudit,attempted:true,launchTick:physics.tick,
     shooterId:nativeAction.playerId,distanceM:c.distanceM,aimY:c.targetY,
      targetSelection:c.targetSelection,
       ...(nativeAction.firstTimeShotEvidence?{firstTimeEvidence:nativeAction.firstTimeShotEvidence,
         postStrikeSamples:Object.freeze([])}:{}),
      launchPosition:Object.freeze({...physics.ball.position}),launchVelocity:Object.freeze({...physics.ball.velocity}),
      launchSpinRadS:Math.hypot(...Object.values(engine.angularVelocity())),
     aimCentreZM:c.targetCentreZM,launchSpeedMps:Math.hypot(...Object.values(physics.ball.velocity))});
   }
   if(shotSoloAudit.attempted&&!shotSoloAudit.crossing){
    const e=refereeEvidence?.lastEvent;
    const postStrikeSamples=firstTimeShot&&physics.tick>shotSoloAudit.launchTick&&
     physics.tick<=shotSoloAudit.launchTick+6?Object.freeze([...shotSoloAudit.postStrikeSamples,
     Object.freeze({tick:physics.tick,ballVelocity:Object.freeze({...physics.ball.velocity}),
      active:foot.active,ended:foot.ended,
      solverPair:engine.footContactSolverSnapshot()?.pairs.find(p=>p.id===shotSoloAudit.shooterId)??null,
      nativeShotRelease:foot.nativeShotRelease??null})]):shotSoloAudit.postStrikeSamples;
    const crossing=e&&e.tick>=shotSoloAudit.launchTick?Object.freeze({
     tick:e.tick,timeS:(e.tick-shotSoloAudit.launchTick)*FIXED_DT,
     kind:e.kind,position:e.crossing.intersection,goal:e.kind==='goal',
     scoringTeam:e.scoringTeam,fullBallCrossed:e.crossing.fullBallCrossed,
     lateralErrorM:Math.abs(e.crossing.intersection.y-shotSoloAudit.aimY),
     heightErrorM:Math.abs(e.crossing.intersection.z-shotSoloAudit.aimCentreZM),
     originalRapierSource:true,officialGoal:false}):null;
    shotSoloAudit=Object.freeze({...shotSoloAudit,
     ...(firstTimeShot?{postStrikeSamples}:{}),
     peakClearanceM:Math.max(shotSoloAudit.peakClearanceM,Math.max(0,physics.ball.position.z-0.11)),
      maxLateralBendM:Math.max(shotSoloAudit.maxLateralBendM,Math.abs(
       (physics.ball.position.y-shotSoloAudit.launchPosition.y)*shotSoloAudit.launchVelocity.x-
       (physics.ball.position.x-shotSoloAudit.launchPosition.x)*shotSoloAudit.launchVelocity.y)/
       Math.max(1e-8,Math.hypot(shotSoloAudit.launchVelocity.x,shotSoloAudit.launchVelocity.y))),crossing});
   }
  }
  const matchTimeline=matchTimelineObserver?.observe({
   physics,refereeEvidence
  })??null;
  const nativeDribbleAudit=isolatedDribbleAudit?.observe({
   physics,playerFrame,foot,action,
   physicalBodies:bodyGuardEnabled?engine.smallSidedBodyGuardSnapshot():null
  })??null;
  const transition=directedDribble?engine.duelTransitionSnapshot():null;
  const shieldAudit=shieldObserver?.observe({tick:physics.tick,players:playerFrame.players,ball:physics.ball,
   starts,bodyStarts:engine.smallSidedBodyGuardSnapshot()?.lowerLegBallStarts??[],action,carrierId:transition?.carrierId})??null;
  const duelActors=directedDribble?resolveDuelActors(playerFrame.players,shotSide,transition):null;
  const defensivePositioning=duelActors?planDribbleDefender({...duelActors,
   ballPosition:physics.ball.position,ballVelocity:physics.ball.velocity}):null;
  const contactContinuity=continuityObserver.observe({
   physics,playerFrame,foot,decisionEvidence
  });
  return Object.freeze({
   scenarioId:id,shotSide:selectedShotSide,shotLane:selectedShotSide?shotLane:null,
   challengeSide:selectedChallengeSide,
   challengeScene:selectedChallengeSide?challengeScene:null,
   physicsTick:physics.tick,timeS:physics.tick*FIXED_DT,
   ball:physics.ball,
   players:Object.freeze(playerFrame.players.map(p=>Object.freeze({
    id:p.id,team:p.team,x:p.x,y:p.y
   }))),
   // M3 read-only canonical motion samples: no second mover or guessed
   // velocity and no authority outside the existing closed Action LAB.
   observedMovementPlayers:playerFrame.players,
   starts,action,evidence,decisionEvidence,contactContinuity,
   ...(aerialLab?{headerAudit,headerCrossAudit,aerialControlAudit,aerialDuelAudit,loftedPassAudit,volleyAudit,highClaimAudit}:{}),
   ...(collectiveControl?{collectiveControl,collectiveCounts:Object.freeze({...collectiveCounts}),nativeKeeperStates:engine.nativeKeeperSnapshots()}:{}),
    labDynamicsVersion:currentDynamics?CURRENT_LAB_DYNAMICS_VERSION:null,
    latestOrientedReception:currentDynamics?(engine.latestLabReceptionSnapshot?.()??null):null,
   ...(passPairAudit?{passPairAudit}:{}),
   ...(interceptionAudit?{interceptionAudit,interceptionApproach:playerFrame.duelInterception??null}:{}),
   ...(blockAudit?{blockAudit,blockApproach:playerFrame.blockApproach??null}:{}),
   ...(playerFrame.defensiveDecision?{defensiveDecision:playerFrame.defensiveDecision}:{}),
   ...(crossPairAudit?{crossPairAudit}:{}),
    ...(shotSoloAudit?{shotSoloAudit}:{}),
   ...(keeperDive?{keeperDive}:{}),
   ...(keeperShotObserver?{keeperShotAudit:keeperShotObserver.observe({tick:physics.tick,
    ball:physics.ball,starts,action:nativeAction,event:refereeEvidence?.lastEvent,keeperDive})}:{}),
   ...(firstTouchCushion?{physicalFirstTouch,pressureEvidence}:{}),
   ...(adaptiveDecision?{physicalReceiverChoice,postDeferContinuity,
    physicalControlEvidence}:{}),
    ...(tapExperiment?{physicalReceiverTap,realReleaseSequence,
     realOpponentContest}:{}),
    ...(reachExperiment?{realBallReachM32:playerFrame.realBallReachM32}:{}),
    ...(basicFootwork?{baseFootworkAudit}:{}),
    ...(refereeMode||smallSided?{refereeEvidence,physicalRestart,b05bOutKick,b05bTake,
     matchTimeline}:{}),
    ...(nativeDribbleAudit?{nativeDribbleAudit}:{}),
    ...(shieldAudit?{shieldAudit}:{}),
    ...(defensivePositioning?{defensivePositioning}:{}),
    ...(directedDribble?{duelTackleProfile,duelTransition:transition,defensiveSlide:playerFrame.duelSlide??null,shoulderApproach:playerFrame.duelShoulder??null,interceptionApproach:playerFrame.duelInterception??null}:{}),
    ...(nativeFixedCarryResearch?{
      nativeFixedCarryResearch:true,
      nativeFixedSprintLongStride,
      soloSprintActiveFootReleaseM,soloSprintPursuitLeadM,
      ...(soloCarryMeasurements?{soloCarryMeasurements}:{}),
      soloCarryLockedPhase,
      soloCarryPlayerAttributes:selectedCarryAttributes,
      nativeRealShoeStartThisTick:
       action?.action==='carry'&&
       foot.nativeSoloFeet?.exclusivePhysicalStart===true,
      nativeShoeContactClaimed:
       action?.action==='carry'&&
       action?.nativeShoeContactVerified===true
    }:{}),
    ...(intentDrivenSoloCarry?{
     intentDrivenCarry:true,
     intentCarryImpulseCount,
     ...(soloCarryMeasurements?{soloCarryMeasurements}:{}),
     ...(soloCarryLockedPhase!==null?{
      soloCarryLockedPhase,
      soloCarryPlayerAttributes:selectedCarryAttributes}:{}),
     intentCarryImpulseThisTick:action?.action==='carry'&&
      action?.decisionContext?.intentDrivenSoloCarry===true,
     nativeShoeContactClaimed:false
    }:{}),
    ...(smallSided?{smallSidedParticipants:smallSided.activeIds,
     physicalShoeColliderCount:engine.originalSmallSidedPhysicalShoeColliderCount(),
     allowedFundamentals:engine.nativeFundamentalsSnapshot(),
     nativeContactMaterial:engine.nativeContactMaterialSnapshot(),
     smallSidedMovementDecisions:playerFrame.smallSidedMovementDecisions,
     ...(id==='carry-solo'?{
      soloCarryPhase:playerFrame.soloCarryPhase,
      soloNativeFeet:foot.nativeSoloFeet??null
     }:{}),
     smallSidedNativeBodyGuard:bodyGuardEnabled?
       engine.smallSidedBodyGuardSnapshot():null,
      smallSidedPhysicalFeedback:bodyGuardEnabled?
       playerFrame.smallSidedPhysicalFeedback:null,
     smallSidedVariantIndex:smallSided.variantIndex,
     genuinePhysicalPlayerCount:smallSided.genuinePhysicalPlayers,
     activeCollisionSource:'native-colliders-only',
     no11v11Authority:true}:{}),
    ...(goalkeeperSave?{
      goalkeeperDiveIntent:playerFrame.goalkeeperDiveIntent,
      goalkeeperDiveIntentTicks:playerFrame.goalkeeperDiveIntentTicks
    }:{}),
   eventCount:count,events:history,
   shotFlight:shotTrace,blockedShotObservation,
   carryTrace,carrySide:selectedCarrySide,
   priorRealPass:firstRealPass,receivingContact,
   firstOpposingShoe,controlScene:spec.mode==='control'?effectiveControlScene:null,
   controlSide:selectedControlSide,
   officialMatchResult:null,officialMatchPossession:false,
   scoreChanged:false,readOnlyEvidence:true
  });
 }
 let latest=record(engine.snapshot(),mover.snapshot());
 function snapshot(){if(disposed)throw new Error('Action LAB disposed');return latest;}
 function step(){
  if(disposed)throw new Error('Action LAB disposed');
  const prior=engine.snapshot();
  let frame=mover.step(prior.ball.position,
   spec.mode==='control'?firstPhysicalPassAction:null,
   reachExperiment?engine.researchReceiverTapSnapshot():null,
   (goalkeeperSave||id==='carry-solo'||id==='dribble-1v1'||id==='keeper-1v1'||directedDribble||collectiveApproaches||interceptionAudit||blockAudit)?prior.ball.velocity:null,
   id==='keeper-1v1'&&!keeperSingleShot&&bodyGuardEnabled&&latest.keeperShotAudit?.reboundTick!=null&&
    !latest.keeperShotAudit.crossing&&!latest.keeperDive?.catchState?.active?
     {tick:prior.tick,reboundTick:latest.keeperShotAudit.reboundTick}:null,
   keeperSingleShot&&latest.keeperShotAudit?.shots===0&&!latest.keeperDive?.catchState?.active,directedDribble,
   latest.duelTransition??null,latest.interceptionAudit??null,latest.blockAudit??null,latest.collectiveControl??null);
  const initialAfter=engine.step(frame);
   if(smallSided&&bodyGuardEnabled){
    // Only post-step original native manifolds feed the canonical mover.
    // The real shoe impulse in this tick has already been decided.
    mover.reconcileSmallSidedNativeBodyResponse(
     engine.smallSidedBodyGuardSnapshot());
    frame=mover.snapshot();
    engine.acknowledgeSmallSidedBodyFeedback(frame);
   }
  if(sourceRestart&&!b05bOutKick){
   b05bOutKick=engine.attemptB05bNativeOutboundKick(frame);
  }
  const after=sourceRestart?engine.snapshot():initialAfter;
  if(after.tick!==prior.tick+1||frame.tick!==after.tick)
   throw new Error('Action LAB must preserve real canonical 60Hz ticks');
  latest=record(after,frame);
  if(refereeMode&&latest.refereeEvidence.lastEvent?.tick===after.tick&&
     latest.refereeEvidence.lastEvent.restart.ready){
   const ticket=latest.refereeEvidence.lastEvent.restart;
   physicalRestart=engine.applyBasicRestartAtBoundary(
    latest.refereeEvidence.lastEvent);
   refereeObserver.acknowledgeRestart(ticket);
   const matchTimeline=matchTimelineObserver.recordRestart({
    physicsTick:after.tick,refereeEvidence:refereeObserver.snapshot(),physicalRestart
   });
   latest=Object.freeze({...latest,
    refereeEvidence:refereeObserver.snapshot(),physicalRestart,matchTimeline});
  }
  if(sourceRestart&&physicalRestart&&after.tick>physicalRestart.tick&&!b05bTake){
   const take=engine.attemptB05bOriginalSetPiece(
    frame,latest.refereeEvidence.lastEvent.restart);
   if(take){
    b05bTake=take;
    count++;
    history=Object.freeze([...history,Object.freeze({
     tick:after.tick,kind:take.type+'-physical-attempt',
     actorId:take.actorId
    })].slice(-12));
    const matchTimeline=matchTimelineObserver.recordSetPiece({
     physicsTick:after.tick,take
    });
    latest=Object.freeze({...latest,
     ball:engine.snapshot().ball,b05bTake,matchTimeline,
     eventCount:count,events:history});
   }
  }
  return latest;
 }
 function dispose(){if(!disposed){disposed=true;engine.dispose();}}
 return Object.freeze({spec,focus,shotSide:selectedShotSide,
  shotLane:selectedShotSide?shotLane:null,
  carrySide:selectedCarrySide,
  controlScene:spec.mode==='control'?effectiveControlScene:null,
  controlSide:selectedControlSide,
  challengeSide:selectedChallengeSide,
  challengeScene:selectedChallengeSide?challengeScene:null,
  snapshot,step,dispose});
}
const label=id=>id.replace('home-','Home #').replace('away-','Away #');
const number=n=>Number(n).toFixed(2);

// The UI is mounted once, no duplicated buttons or AI panels per action.
export function mountControlledActionLabs({getRapier,onOpen,onClose}){
 const by=id=>document.getElementById(id);
 const dialog=by('action-labs-dialog'),select=by('action-labs-choice');
 const shotSide=by('action-labs-shot-side'),
  shotSideLabel=by('action-labs-shot-side-label'),
  shotLaneChoice=by('action-labs-shot-lane'),
  shotLaneLabel=by('action-labs-shot-lane-label'),
  controlSceneChoice=by('action-labs-control-scene'),
  controlSceneLabel=by('action-labs-control-scene-label'),
  challengeSceneChoice=by('action-labs-challenge-scene'),
  challengeSceneLabel=by('action-labs-challenge-scene-label');
 const canvas=by('action-labs-pitch'),status=by('action-labs-status');
 const summary=by('action-labs-readout'),description=by('action-labs-description');
 const go=by('action-labs-play'),pause=by('action-labs-pause');
 const step=by('action-labs-step'),reset=by('action-labs-reset');
 if(!dialog||!select||!shotSide||!shotSideLabel||!shotLaneChoice||
    !shotLaneLabel||!controlSceneChoice||!controlSceneLabel||
    !challengeSceneChoice||!challengeSceneLabel||
    !canvas||!status||!summary||!description||
    !go||!pause||!step||!reset||
    !by('action-labs-open')||!by('action-labs-close'))
  throw new Error('Action LAB controls are missing');
 const all=[...ACTION_LAB_SCENARIOS,...SMALL_SIDED_LAB_SCENARIOS,...AERIAL_LAB_SCENARIOS];
 if(select.options.length!==all.length||
    all.some((s,i)=>select.options[i].value!==s.id))
  throw new Error('Action LAB menu must match the single scenario catalog');
 let session=null,playing=false,lastTime=0,accumulator=0;
 let trail=[];
 function stop(){playing=false;go.disabled=false;pause.disabled=true;}
 function draw(frame){
  const ctx=canvas.getContext('2d');
  const {X,Y}=drawPitchMarkings(ctx,canvas.width,canvas.height);
  ctx.beginPath();
  for(let i=0;i<trail.length;i++){
   const p=trail[i];
   if(!i)ctx.moveTo(X(p.x),Y(p.y));else ctx.lineTo(X(p.x),Y(p.y));
  }
  ctx.lineWidth=2.2;ctx.strokeStyle='#ffdf88';ctx.stroke();
  const selected=new Set(session.focus);
  for(const p of frame.players){
   if(!selected.has(p.id))continue; // keep the controlled scenario compact
   ctx.beginPath();ctx.arc(X(p.x),Y(p.y),8,0,Math.PI*2);
   ctx.fillStyle=p.team==='home'?'#a8dfff':'#ffb39a';
   ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle='#173b33';ctx.stroke();
   ctx.fillStyle='#102d2e';ctx.textAlign='center';
   ctx.textBaseline='middle';ctx.font='bold 9px system-ui';
   ctx.fillText(p.id.split('-')[1],X(p.x),Y(p.y));
  }
  const p=frame.ball.position;
  ctx.beginPath();ctx.arc(X(p.x),Y(p.y),7.5,0,Math.PI*2);
  ctx.fillStyle='#ffffff';ctx.fill();ctx.strokeStyle='#142b2a';
  ctx.lineWidth=2;ctx.stroke();
 }
 function render(){
  if(!session)return;
  const snap=session.snapshot();
  const ball=snap.ball.position;
  draw(snap);
  summary.textContent='Tick '+snap.physicsTick+' · '+
   number(snap.timeS)+' s · Ball ('+[ball.x,ball.y,ball.z].map(number).join(', ')+
   ') m · Real shoe STARTs '+snap.starts.length+' · Witnesses '+snap.eventCount+
   (snap.matchTimeline?
    ' · B06 '+snap.matchTimeline.clock.label+
    ' · LAB '+snap.matchTimeline.provisionalScore.home+
    '–'+snap.matchTimeline.provisionalScore.away+
    ' · match events '+snap.matchTimeline.matchEventCount+
    (snap.matchTimeline.outstandingDeadBall?' · dead ball pending':'')+
    ' · unofficial':'')+
   (snap.decisionEvidence.current.kind!=='none'?
    ' · Physical candidate '+snap.decisionEvidence.current.kind:'')+
   (snap.physicalFirstTouch?
    ' · Real first-touch cushion '+number(Math.hypot(
     snap.physicalFirstTouch.impulseNs.x,
     snap.physicalFirstTouch.impulseNs.y))+' Ns'+
    ' · pressure '+number(snap.physicalFirstTouch.measuredNearestOpponentM)+' m':'')+
   (snap.physicalReceiverChoice?
    ' · Native choice '+(snap.physicalReceiverChoice.physicalImpulseAllowed?
     'release existing clearance':'hold / no new impulse')+
    ' · defender '+number(snap.physicalReceiverChoice.nearestRealDefenderM)+' m':'')+
   (snap.postDeferContinuity?.active?
    ' · M28 physical follow-through '+snap.postDeferContinuity.active.observedTicks+
    '/120 ticks · ball gap '+
    number(snap.postDeferContinuity.active.lastActualBallGapM)+' m':
    snap.postDeferContinuity?.latestCompleted?
    ' · M28 measured '+snap.postDeferContinuity.latestCompleted.observedTicks+
    ' native ticks · no official possession':'')+
   (snap.physicalControlEvidence?.active?
    ' · M29 native pair '+snap.physicalControlEvidence.active.realActivePairTicks+
    ' ticks · recontacts '+
    snap.physicalControlEvidence.active.genuineReleaseThenRecontact:
    snap.physicalControlEvidence?.latestCompleted?
    ' · M29 '+snap.physicalControlEvidence.latestCompleted.physicalSequenceClassification+
    ' · official control unconfirmed':'')+
   (snap.realReleaseSequence?.active?
     ' · M30 real shoe release '+(snap.realReleaseSequence.active.genuineNativeReleaseObserved?
       'observed':'pending')+' · recontact '+
       (snap.realReleaseSequence.active.genuineNativeRecontactAfterRelease?'yes':'no'):
     snap.realReleaseSequence?.latestCompleted?
      ' · M30 '+snap.realReleaseSequence.latestCompleted.endReason+
      ' · official control unconfirmed':'')+
   (snap.goalkeeperDiveIntentTicks?
    ' · Keeper lateral dive approach '+snap.goalkeeperDiveIntentTicks+
    ' original 60Hz ticks · no confirmed save':'')+
   (snap.baseFootworkAudit?.trap?
    ' · B04 native TRAP tick '+snap.baseFootworkAudit.trap.tick:
    '')+
   (snap.baseFootworkAudit?.dribbleAttempt?
    ' · B04 physical DRIBBLE push tick '+
     snap.baseFootworkAudit.dribbleAttempt.tick:'')+
   (snap.baseFootworkAudit?.release?
    ' · actual shoe release '+snap.baseFootworkAudit.release.actualShoeEndTick+
    ' and independent recontact '+
     snap.baseFootworkAudit.release.actualShoeRecontactTick:'')+
   (snap.b05bTake?
    ' · B05b '+snap.b05bTake.type.toUpperCase()+
    ' physical attempt by '+snap.b05bTake.actorId+
    ' tick '+snap.b05bTake.tick+
    (snap.b05bTake.originalNativeShoeStart?
     ' · real set-piece native shoe START':
     ' · provisional unmodelled hand release'):'')+
   (snap.b05bOutKick?
    ' · native outbound shoe kick '+snap.b05bOutKick.actorId+
    ' tick '+snap.b05bOutKick.tick:'')+
   (snap.refereeEvidence?.lastEvent?
    ' · B05 '+snap.refereeEvidence.lastEvent.kind.toUpperCase()+
    (snap.refereeEvidence.lastEvent.scoringTeam?
     ' scoring '+snap.refereeEvidence.lastEvent.scoringTeam.toUpperCase():'')+
    ' · '+snap.refereeEvidence.lastEvent.restart.type.toUpperCase()+
    (snap.physicalRestart?' · same Rapier ball physically restarted':
     ' · no invented last touch'):'')+
   (snap.realBallReachM32?.activeTicks?
    ' · M32 real challenger direct-ball pursuit '+
    snap.realBallReachM32.activeTicks+' native ticks':
    '')+
   (snap.realOpponentContest?.active?
    ' · M31 real opponent shoe '+(snap.realOpponentContest.active.opposingShoeContactIsNative?
     'START tick '+snap.realOpponentContest.active.firstOpposingNativeShoeStartTick:
     'not observed')+
    ' · defender-ball '+number(snap.realOpponentContest.active.minimumRealOpponentToBallGapM)+' m':
   snap.realOpponentContest?.latestCompleted?
    ' · M31 '+snap.realOpponentContest.latestCompleted.classification+
    ' · NO official possession':'')+
   (snap.pressureEvidence?.active?
    ' · Live defender '+number(snap.pressureEvidence.active.lastRealOpponentGapM)+
    ' m · ball gap '+number(snap.pressureEvidence.active.finalBallGapM)+
    ' m · genuine recontacts '+
    snap.pressureEvidence.active.genuineSameReceiverRecontacts:
    snap.pressureEvidence?.completed?
    ' · Defended observation '+snap.pressureEvidence.completed.observedTicks+
    ' ticks · closest opponent '+
    number(snap.pressureEvidence.completed.minimumRealOpponentGapM)+' m'+
    ' · genuine recontacts '+
    snap.pressureEvidence.completed.genuineSameReceiverRecontacts+
    (snap.pressureEvidence.completed.subsequentPhysicalAction?
     ' · next action '+snap.pressureEvidence.completed.subsequentPhysicalAction.action:
     ''):'')+
   (snap.contactContinuity.active?
    ' · Post-contact '+snap.contactContinuity.active.observedTicks+
    '/60 actual ticks · ball travel '+
    number(snap.contactContinuity.active.cumulativeBallTravelXYM)+' m':
    snap.contactContinuity.latestCompleted?
    ' · Last post-contact: '+
    snap.contactContinuity.latestCompleted.observedTicks+
    ' measured ticks · no proven control':'')+
   (snap.shotFlight?' · '+(snap.shotFlight.actionType??'shot').toUpperCase()+' '+snap.shotFlight.team.toUpperCase()+
    ' · 3D path '+number(snap.shotFlight.path3DM)+' m'+
    ' · peak centre Z '+number(snap.shotFlight.maxCenterZM)+' m':'')+
   (snap.blockedShotObservation?' · All three SHOT lanes blocked':'')+
   (session.spec.goal==='control'&&snap.priorRealPass?
    ' · Physical PASS tick '+snap.priorRealPass.tick+
    ' → intended '+label(snap.priorRealPass.recipientId):'')+
   (snap.receivingContact?' · Real receiving shoe START tick '+
    snap.receivingContact.tick:'')+
   (snap.firstOpposingShoe?' · Opposing shoe START tick '+
    snap.firstOpposingShoe.tick+' · no verified reception':'')+
   (snap.carryTrace?' · CARRY '+snap.carryTrace.team.toUpperCase()+
    ' · observed ground path '+number(snap.carryTrace.path2DM)+' m':'');
  if(session.spec.mode==='situation'&&snap.refereeEvidence?.lastEvent){
   const event=snap.refereeEvidence.lastEvent;
   status.textContent='Real '+event.kind.toUpperCase()+
    ' from original Rapier ball at tick '+event.tick+
    ' · provisional '+snap.matchTimeline.provisionalScore.home+
    '–'+snap.matchTimeline.provisionalScore.away+
    ' · no official match result or unverified possession.';
  }else if(session.spec.mode==='situation'&&snap.action){
   status.textContent='Observed '+snap.action.team.toUpperCase()+' '+
    snap.action.action.toUpperCase()+' · genuine original Rapier shoe START '+
    'and impulse. No guaranteed pass, tackle, save or goal.';
  }else if(session.spec.mode==='referee'&&snap.b05bTake){
   const t=snap.b05bTake;
   status.textContent=t.originalNativeShoeStart?
    'B05b physical '+t.type.toUpperCase()+
    ' attempt: genuine independent original #9 Rapier shoe START and applied same-ball kick. No official result or possession.':
    'B05b provisional THROW-IN: current original #9 near the verified spot, physical same-ball launch. No native hand collider or legally confirmed throw.';
  }else if(session.spec.mode==='referee'&&snap.refereeEvidence?.lastEvent){
   const e=snap.refereeEvidence.lastEvent;
   status.textContent=e.provisionalGoalScored?
    'Observed genuine full-ball GOAL crossing ('+
      e.scoringTeam.toUpperCase()+
      '); original Rapier ball restarted with KICKOFF. No official match result.':
    e.restart.ready?
    'Observed genuine full-ball '+e.kind+' exit. Physical '+
     e.restart.type+' for '+e.restart.team+
     ' on the same Rapier ball.':
    'Observed genuine full-ball '+e.kind+
     ' exit. Last shoe touch unknown: '+e.restart.type+
     '; do not invent THROW-IN, CORNER or GOAL KICK ownership.';
  }else if(session.spec.id==='trap'&&snap.baseFootworkAudit?.trap){
   status.textContent='Verified '+snap.controlSide.toUpperCase()+' TRAP physical attempt: genuine separate receiving shoe START + Rapier cushioning impulse. No official control or possession.';
  }else if(session.spec.id==='dribble'&&snap.baseFootworkAudit?.release){
   status.textContent='Verified DRIBBLE physical sequence: original trap, second native shoe START with Rapier ball push, shoe END and independent recontact. No completed dribble or possession.';
  }else if(session.spec.id==='dribble'&&snap.baseFootworkAudit?.dribbleAttempt){
   status.textContent='Verified DRIBBLE physical attempt: original receiver cushioning and new native shoe START + real ball push; release/recontact pending. No possession.';
  }else if(snap.realOpponentContest?.latestCompleted?.opposingShoeContactIsNative){
   const e=snap.realOpponentContest.latestCompleted;
   status.textContent='M31: genuine opponent '+e.firstOpposingNativeShoeStartPlayerId+
    ' shoe-ball START tick '+e.firstOpposingNativeShoeStartTick+
    ' verified by native Rapier; NOT a proven tackle/interception/possession.';
  }else if(snap.realReleaseSequence?.latestCompleted?.sourceVerifiedSequence){
   const seq=snap.realReleaseSequence.latestCompleted;
   status.textContent='M30 observed: real shoe END tick '+seq.firstTrueShoeEndTick+
    ' and independent exclusive START tick '+seq.firstTrueSubsequentShoeStartTick+
    '; original action '+(seq.actualActionAfterTap?.action??'none')+
    '. No official dribble, control or possession.';
  }else if(snap.physicalReceiverTap){
   status.textContent='M30: real bounded second-shoe Rapier tap; watch native END/START. No possession awarded.';
  }else if(snap.physicalReceiverChoice){
   status.textContent='Research: genuine second shoe START → '+
    (snap.physicalReceiverChoice.physicalImpulseAllowed?
     'original clearance applied under observed pressure.':
     'clearance deferred without any new impulse.')+
    ' No official control or possession.';
  }else if(snap.physicalFirstTouch){
   status.textContent='Research: real receiving shoe START → bounded physical first-touch impulse; ball control and possession NOT confirmed.';
  }else if(snap.shotFlight?.observed3DFlight){
   status.textContent='Verified '+snap.shotFlight.team.toUpperCase()+
    ' '+(snap.shotFlight.actionType??'shot').toUpperCase()+
    ': exclusive shoe START + real Rapier impulse; observed 3D flight ('+
    snap.shotFlight.samples+' physical samples). '+
    (['tackle','interception'].includes(snap.shotFlight.actionType)?
     'No recovery, tackle win or interception confirmed.':
     'No goal awarded.');
  }else if(snap.carryTrace?.observedGroundMotion){
   status.textContent='Verified '+snap.carryTrace.team.toUpperCase()+
    ' CARRY: exclusive real Rapier shoe START and original ground-touch impulse; observed '+
    number(snap.carryTrace.path2DM)+' m ball motion. Dribble and possession unconfirmed.';
  }else if(snap.blockedShotObservation){
   status.textContent='Observed: genuine '+snap.shotSide.toUpperCase()+
    ' shoe START; original policy finds no open SHOT lane. No shot or goal awarded.';
  }else if(snap.evidence.witnessed){
   const kind=session.spec.goal;
   status.textContent=['tackle','interception'].includes(kind)?
    'Verified: original defender real Rapier shoe START + '+kind.toUpperCase()+
    ' impulse; no possession or recovery confirmed.':
    kind==='save'?
    'Verified: genuine Rapier keeper shoe START + SAVE parry impulse; not a confirmed save.':
    kind==='cross'?
    'Verified: genuine Rapier shoe START + lofted CROSS impulse; no completed cross or goal.':
    kind==='shot'?
    'Verified: genuine Rapier shoe START + SHOT impulse. No goal awarded.':
    kind==='pass'?
     'Verified: genuine Rapier shoe START + PASS impulse. Reception not assumed.':
    kind==='carry'?
     'Verified: genuine Rapier shoe START + CARRY impulse. Dribble unconfirmed.':
    kind==='control'?
     'Observed: separate teammate shoe-ball contact after real pass. No official possession.':
     'Observed: actual '+snap.challengeSide.toUpperCase()+
      ' shoe-ball START; no successful tackle or interception claimed.';
  }else if(session.spec.goal==='control'&&snap.receivingContact){
   status.textContent='Observed: separate teammate shoe-ball contact after real pass. No official possession.';
  }else if(session.spec.goal==='control'&&snap.firstOpposingShoe){
   status.textContent='Observed: genuine '+label(snap.firstOpposingShoe.playerId)+
    ' shoe-ball START before intended '+label(snap.priorRealPass.recipientId)+
    '. No verified reception, tackle or interception.';
  }else if(session.spec.goal==='control'&&snap.priorRealPass){
   status.textContent='Observed: genuine '+label(snap.priorRealPass.playerId)+
    ' PASS; awaiting authentic '+label(snap.priorRealPass.recipientId)+
    ' shoe-ball START. No possession awarded.';
  }else if(snap.eventCount===0&&snap.physicsTick>0){
   status.textContent='No '+session.spec.goal+
    ' witness yet · physical tick '+snap.physicsTick+
    '. No outcome is granted without genuine Rapier evidence.';
  }
 }
 function advance(){
  // A dead-ball state with unknown legal restart owner is NOT live play.
  // Leave the last genuine full-ball crossing on screen; otherwise Rapier
  // continues falling past the finite grass after play has stopped.
  if((session.spec.mode==='referee'||session.spec.mode==='situation')&&
     session.snapshot().refereeEvidence?.lastEvent&&
     !session.snapshot().refereeEvidence?.restartApplied)return;
  const f=session.step();const p=f.ball.position;
  trail.push({x:p.x,y:p.y});
  if(trail.length>450)trail.shift();
  render();
  if((session.spec.mode==='referee'||session.spec.mode==='situation')&&
     f.refereeEvidence?.lastEvent&&!f.refereeEvidence.restartApplied){
   stop();go.disabled=true;step.disabled=true;
  }
 }
 function resetSession(){
  stop();step.disabled=false;if(session)session.dispose();
  shotSideLabel.hidden=!(['shot','cross','save','tackle','interception','trap','dribble','goal','touchline','goal-line-out','throw-in','corner','goal-kick','carry','challenge'].includes(select.value)||
    [...SMALL_SIDED_LAB_SCENARIOS,...AERIAL_LAB_SCENARIOS].some(x=>x.id===select.value));
  shotLaneLabel.hidden=select.value!=='shot';
  controlSceneLabel.hidden=select.value!=='control';
  challengeSceneLabel.hidden=select.value!=='challenge';
  by('action-labs-title').textContent=select.selectedOptions[0].textContent.trim();
  session=createControlledActionLab(getRapier(),select.value,{
   // Hidden original research comparator, not a selectable gameplay LAB.
   historicalEvidenceBaseline:![...SMALL_SIDED_LAB_SCENARIOS,...AERIAL_LAB_SCENARIOS].some(x=>x.id===select.value),
   shotSide:(['shot','cross','save','tackle','interception','trap','dribble','goal','touchline','goal-line-out','throw-in','corner','goal-kick'].includes(select.value)||
    [...SMALL_SIDED_LAB_SCENARIOS,...AERIAL_LAB_SCENARIOS].some(x=>x.id===select.value))?shotSide.value:'home',
   shotLane:select.value==='shot'?shotLaneChoice.value:'open',
   carrySide:select.value==='carry'?shotSide.value:'home',
   controlScene:select.value==='control'?controlSceneChoice.value:'receive',
   challengeSide:select.value==='challenge'?shotSide.value:'away',
   challengeScene:select.value==='challenge'?challengeSceneChoice.value:'contact'
  });
  trail=[{x:session.snapshot().ball.position.x,
   y:session.snapshot().ball.position.y}];
  description.textContent=session.spec.mode==='situation'?
   session.spec.description+' Only selected participants have real Rapier shoe colliders; the other canonical identities remain for motion validation. No 11v11 match or official result.':
   ['throw-in','corner','goal-kick'].includes(select.value)?
    'B05b original native outbound shoe START, real full-ball exit and assigned restart. CORNER/GOAL KICK require a second genuine #9 shoe START to kick; THROW-IN uses an explicitly provisional same-ball hand-release proxy without simulated hands. No official result or possession.':
    session.spec.mode==='referee'?
    'B05 native 105×68m field referee: actual consecutive Rapier ball crossing, genuine last-shoe attribution or unresolved ownership; original same-world KICKOFF on a scored goal. No official competition result.':
    ['trap','dribble'].includes(select.value)?
    'B04 basic physical '+select.value.toUpperCase()+
    ': original pass and native receiving shoe cushion'+
    (select.value==='dribble'?
    ', second independent shoe START and real ball tap / physical recontact':
    '')+'. Attempts only, no completed reception, dribble or possession.':
    ['tackle','interception'].includes(select.value)?
    'B03 defensive attempt: the original #7 meets a real nearby opponent and an observed live ball. Only a genuine exclusive Rapier shoe START allows a deflection. No official recovery, possession, completed interception or successful tackle.':
    select.value==='save'?
    'B02 basic goalkeeper approach: the canonical keeper moves laterally from the actual incoming ball velocity; only a real exclusive native shoe START can produce a single Rapier parry impulse. No airborne dive, catch or successful save is assumed.':
    session.shotLane==='blocked'?
   'An opposing defender obstructs all goal-mouth lanes before tick zero. Observe real contact, never a fabricated SHOT.':
   session.controlScene==='receive-challenge'?
    'M32 research: original defender #7 uses the current REAL ball as its pursuit target only after authenticated M30 tap; same canonical 60Hz acceleration, turning, player separation and Rapier shoe collision apply; never infer a tackle or possession.':
    session.controlScene==='receive-contest'?
    'M31 research: original pre-start defender closer to the REAL receiver; native shoe-ball START required to claim a direct challenge. No tackle or possession awarded.':
    session.controlScene==='receive-release'?
    'M30 research: after genuine second shoe START, apply one bounded real Rapier tap and measure physical release/recontact; no dribble or possession awarded.':
    session.controlScene==='receive-pressure-decide'?
   'M27 research: the actual nearby defender affects the original receiver second-touch decision; real clearance or hold only, no automatic possession.':
   session.controlScene==='receive-decide'?
   'M27 research: real second-touch original clearance can be deferred if the original ball remains nearby and no defender is close. No automatic possession.':
   session.controlScene==='receive-pressure'?
   'M26 research: one pre-start real opposing midfielder presses the original receiver. Every shoe START, ball gap, and defender distance is measured from autonomous Rapier play. No fake control or possession.':
   session.controlScene==='receive-cushion'?
   'M25 genuine first-touch: compare original receiving contact with a single bounded Rapier cushioning impulse. Only native shoe START authorizes the attempt; no possession is awarded.':
   session.controlScene==='opponent-first'?
   'A true long PASS targets HOME #9. AWAY #7 approaches only after that physical PASS; observe the opposing shoe first, without awarding an interception, tackle or reception.':
   session.challengeScene==='no-contact'?
   'Ball starts far from all 22 canonical shoes. Observe a physically empty contact timeline; do not manufacture action, interception or possession.':
   session.spec.description;
  status.textContent='Ready · '+session.spec.title+
   ' · Play to observe genuine Rapier events; no result is pre-awarded.';
  accumulator=0;lastTime=0;render();
 }
 function loop(now){
  if(!dialog.open)return;
  if(playing&&session){
   if(lastTime){
    accumulator+=Math.min((now-lastTime)/1000,0.08);
    let iterations=0;
    while(accumulator>=FIXED_DT&&iterations<12){
     advance();accumulator-=FIXED_DT;iterations++;
    }
    if(iterations===12)accumulator=0;
   }
  }
  lastTime=now;requestAnimationFrame(loop);
 }
 const open=by('action-labs-open'),close=by('action-labs-close');
 open.addEventListener('click',()=>{
  if(!getRapier())return;
  onOpen();dialog.showModal();
  try{resetSession();requestAnimationFrame(loop);}
  catch(e){status.textContent='Cannot start: '+e.message;stop();}
 });
 close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{
  stop();if(session){session.dispose();session=null;}
  trail=[];onClose();
 });
 shotSide.addEventListener('change',()=>{if(dialog.open)try{resetSession();}
  catch(e){stop();status.textContent=e.message;}});
 shotLaneChoice.addEventListener('change',()=>{if(dialog.open)try{resetSession();}
  catch(e){stop();status.textContent=e.message;}});
 controlSceneChoice.addEventListener('change',()=>{if(dialog.open)try{resetSession();}
  catch(e){stop();status.textContent=e.message;}});
 challengeSceneChoice.addEventListener('change',()=>{if(dialog.open)try{resetSession();}
  catch(e){stop();status.textContent=e.message;}});
 select.addEventListener('change',()=>{if(dialog.open)try{resetSession();}
  catch(e){stop();status.textContent=e.message;}});
 go.addEventListener('click',()=>{playing=true;go.disabled=true;pause.disabled=false;});
 pause.addEventListener('click',stop);
 step.addEventListener('click',()=>{stop();try{advance();}
  catch(e){status.textContent=e.message;}});
 reset.addEventListener('click',()=>{try{resetSession();}
  catch(e){stop();status.textContent=e.message;}});
 stop();
 return Object.freeze({isOpen:()=>dialog.open});
}


/**
 * Compact read-only view of every actual small-sided field participant.
 * Each row is the canonical mover's SAME-tick chosen destination, not an
 * invented pass, possession, successful carry, or other match outcome.
 */
export function projectActiveLabDecisions(frame,focus){
 const ids=Array.isArray(focus)?focus:null;
 if(!frame||!Number.isSafeInteger(frame.physicsTick)||frame.physicsTick<0||
    !ids||ids.length<1||ids.length>7||
    new Set(ids).size!==ids.length||
    ids.some(id=>typeof id!=='string'||!/^(home|away)-(?:[1-9]|10|11)$/.test(id))||
    !Array.isArray(frame.smallSidedMovementDecisions))
  throw new TypeError('Only the original current small-sided decision source is permitted');
 if(frame.physicsTick===0&&frame.smallSidedMovementDecisions.length===0)
  return Object.freeze([]);
 const byId=new Map();
 for(const decision of frame.smallSidedMovementDecisions){
  if(!ids.includes(decision.id)||byId.has(decision.id)||
     decision.tick!==frame.physicsTick||decision.originalCanonicalMover!==true||
     decision.readOnly!==true||decision.actionConfirmed!==false||
     !['goalkeeping','press-ball','cover-pass','carry-ball','approach-ball','support-run','hold-pass-target','getting-up','shoulder-challenge','intercept-ball','block-shot'].includes(decision.kind)||
     ![decision.target?.x,decision.target?.y,decision.speedMps].every(Number.isFinite))
   throw new TypeError('Invalid current authoritative mover intent');
  byId.set(decision.id,decision);
 }
 if(byId.size!==ids.length)
  throw new TypeError('Every on-field player must have one real chosen target');
 const action=frame.action?.appliedByRapier===true&&
  frame.action.actualPhysicsImpulseApplied===true&&
  frame.action.tick===frame.physicsTick?frame.action:null;
 return Object.freeze(ids.map(id=>{
  const d=byId.get(id);
  return Object.freeze({
   ...d,actualAction:action?.playerId===id?action.action:null,
   actualActionTick:action?.playerId===id?frame.physicsTick:null,
   contextualChoice:action?.playerId===id?
    action.decisionContext?.smallSidedChoice?.selected??null:null,
   officialResult:false
  });
 }));
}
