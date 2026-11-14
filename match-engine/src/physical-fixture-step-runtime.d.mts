// ME-PB-54 A1.3b: TypeScript contract for the runtime implemented in .mjs.
export interface PhysicalFixture {
 readonly id:string;readonly competitionId:string;readonly marker:string;
 readonly day:number;readonly round:number;readonly homeClubId:string;
 readonly awayClubId:string;
}
export interface UniformTemporaryPlayer {
 readonly engineId:string;
 readonly team:'home'|'away';
 readonly clubId:string;
 readonly squadNumber:number;
 readonly tacticalRole:string;
 readonly generatedPlayerId:null;
 readonly playerId:null;
 readonly temporary:true;
 readonly attributes:Readonly<Record<string,number>>;
 readonly movementLimits:Readonly<{
  maxSpeedMps:number;accelerationMps2:number;
  brakingMps2:number;turnRadPerSecond:number
 }>;
}
export interface UniformTemporarySquad {
 readonly version:string;
 readonly source:'homogeneous-temporary-actors';
 readonly fixtureId:string;
 readonly homeClubId:string;readonly awayClubId:string;
 readonly players:readonly UniformTemporaryPlayer[];
 readonly playerCount:22;readonly playersPerTeam:11;
 readonly statsHomogeneous:true;readonly attributeValue:50;
 readonly physicalMovementUniform:true;
 readonly ratingsAppliedToPhysics:false;
 readonly generatedPlayersUsed:false;readonly rosterBound:false;
 readonly officialPlayerIdentity:false;
}
export interface PhysicalShoeActor {
 readonly engineId:string;readonly team:'home'|'away';
 readonly clubId:string;readonly squadNumber:number;
 readonly tacticalRole:string;readonly playerId:null;
 readonly generatedPlayerId:null;readonly temporary:true;
}
export interface PhysicalFixtureContactFeed {
 readonly version:string;readonly physicsTick:number;
 readonly fixtureId:string;
 readonly contactSource:'same-step-real-rapier-shoe-ball-collider';
 readonly started:readonly PhysicalShoeActor[];
 readonly ended:readonly PhysicalShoeActor[];
 readonly active:readonly PhysicalShoeActor[];
 readonly anyActive:boolean;readonly multipleActive:boolean;
 readonly shoesInPhysics:22;
 readonly temporaryPlayersOnly:true;readonly generatedPlayersUsed:false;
 readonly realPlayerRosterBound:false;readonly realFootEventsOnly:true;
 readonly independentContactInjection:false;
 readonly officialMatchAction:false;readonly officialMatchPossession:false;
 readonly officialGoalEvidence:false;
 readonly scoreAuthority:'external-temporary-score-v1';
 readonly lifecycleIntegrated:false;
}
export type AutonomousMovementDuty =
 | 'press' | 'cover' | 'screen' | 'support' | 'balance'
 | 'recover' | 'formation' | 'goalkeeper-position'
 | 'receive-pass-intent' | 'challenge-pass-intent'
 | 'attack-support-intent' | 'carry-follow-intent'
 | 'challenge-carry-intent';
export interface PhysicalDutyContact {
 readonly engineId:string;readonly team:'home'|'away';
 readonly clubId:string;readonly movementDuty:AutonomousMovementDuty;
 readonly tacticalRole:string;readonly temporary:true;readonly playerId:null;
 readonly intendedFootballAction:null;readonly actionExecuted:false;
 readonly contactPhase:'started'|'active'|'ended';
 readonly contactTick:number;
 readonly contactSource:'real-rapier-collider';
 readonly footballActionAuthorized:false;readonly ballOwnershipConfirmed:false;
}
export interface PhysicalAutonomousDuty {
 readonly engineId:string;readonly team:'home'|'away';
 readonly clubId:string;readonly movementDuty:AutonomousMovementDuty;
 readonly tacticalRole:string;readonly temporary:true;readonly playerId:null;
 readonly intendedFootballAction:null;readonly actionExecuted:false;
}
export interface PhysicalCarryOrientedShoeGeometry {
 readonly version:'me-pb-c3-3g-trusted-moved-shoe-ball-geometry-v1';
 readonly engineId:string;readonly team:'home'|'away';
 readonly source:'same-60hz-moved-rapier-shoe-transform';
 readonly physicsTick:number;readonly readOnly:true;
 readonly bodyX:number;readonly bodyY:number;
 readonly shoeCenter:Readonly<{x:number;y:number;z:number}>;
 readonly actualFacingRad:number;readonly bodyBallXYGapM:number;
 readonly shoeBallCenter3DGapM:number;
 readonly relativeBallForwardM:number;readonly relativeBallLateralM:number;
 readonly relativeBallVerticalM:number;
 readonly estimatedStaticSurfaceClearanceM:number;readonly ballRadiusM:number;
 readonly actualRapierCollisionInferred:false;
 readonly footballTackleConfirmed:null;readonly ballControlConfirmed:null;
 readonly dribbleConfirmed:null;readonly officialMatchPossession:false;
}
export interface PhysicalRealCarryChallenger {
 readonly source:'previous-authenticated-rapier-carry-with-physical-shoe-end';
 readonly sourceCarrierId:string;
 readonly sourceCarrierTeam:'home'|'away';
 readonly sourceCarryTick:number;readonly physicalShoeEndTick:number;
 readonly challengerId:string;readonly challengerTeam:'home'|'away';
 readonly physicsTick:number;
 readonly selectedByObservedLive22Players:true;
 readonly movementIntentOnly:true;readonly actualRapierShoeActive:boolean;
 readonly blockedBy:string|null;readonly realMoverStepRejected:boolean;
 readonly flank:Readonly<{
  source:'observed-carrier-hard-step-rejection';
  sourceCarryTick:number;carrierId:string;challengerId:string;
  physicsTick:number;phase:'lateral-bypass'|'along-carrier-flank';
  side:1|-1;target:Readonly<{x:number;y:number}>;
  waypointCarrierClearanceM:number;
  movementIntentOnly:true;physicalShoeContactObserved:false;
  ballControlConfirmed:null;dribbleConfirmed:null;
  officialMatchPossession:false;officialMatchResult:null;
 }>|null;
 readonly ballControlConfirmed:null;readonly dribbleConfirmed:null;
 readonly officialMatchPossession:false;readonly officialMatchResult:null;
}
export interface PhysicalContactDecisionObservation {
 readonly version:string;readonly fixtureId:string;readonly physicsTick:number;
 readonly source:'same-physics-tick-real-mover-and-rapier';
 readonly playerCount:22;readonly duties:readonly PhysicalAutonomousDuty[];
 readonly started:readonly PhysicalDutyContact[];
 readonly active:readonly PhysicalDutyContact[];
 readonly ended:readonly PhysicalDutyContact[];
 readonly allPlayersHomogeneous:true;readonly matchesPhysicalContactFeed:true;
 readonly carryChallenger:PhysicalRealCarryChallenger|null;
 readonly physicalFootContactsObserved:boolean;readonly tacticalMovementObserved:true;
 readonly actionPolicyConnected:boolean;readonly footballActionExecuted:boolean;
 readonly localAutonomousAction:ProvisionalAutonomousAction|null;
 readonly officialMatchPossession:false;readonly officialGoalEvidence:false;
 readonly productionScoringConnected:false;
}
export interface ProvisionalAutonomousAction {
 readonly version:string;readonly tick:number;
 readonly playerId:string;readonly team:'home'|'away';
 readonly action:'pass'|'shot'|'clearance'|'carry';
 readonly recipientId:string|null;
 readonly measuredGapM:number;
 readonly impulseNs:Readonly<{x:number;y:number;z:number}>;
 readonly physicalTrigger:'same-tick-real-rapier-shoe-start';
 readonly movementSource:'canonical-22-player-autonomous-mover';
 readonly appliedByRapier:true;
 readonly actualPhysicsImpulseApplied:true;
 readonly decisionContext:Readonly<{
  version:string;rule:string;nearestOpponentM:number;
  underImmediatePressure:boolean;shotLaneClearanceM:number;
  shotRange:boolean;passLaneClearanceM:number|null;
  chosenRecipientOpponentGapM:number|null;
  outcomeNotYetObserved:true;opponentTackleProven:false;
  interceptionProven:false;passCompleted:false;goalScored:false;
 }>;
 readonly actionSource:'internal-uniform-22-player-ai';
 readonly temporaryPlayersOnly:true;
 readonly uniformPlayerStats:true;
 readonly officialMatchAction:false;
 readonly officialMatchPossession:false;
 readonly officialGoalEvidence:false;
 readonly officialMatchResult:null;
}
export interface ProvisionalActionObservedEpisode {
 readonly actionTick:number;readonly playerId:string;
 readonly team:'home'|'away';readonly action:'pass'|'shot'|'clearance'|'carry';
 readonly intendedRecipientId:string|null;readonly intendedRule:string;
 readonly observedThroughTick:number;readonly elapsedPhysicsTicks:number;
 readonly ballTravelSinceImpulseM:number;
 readonly opponentShoeStarts:readonly string[];
 readonly intendedRecipientShoeStartObserved:boolean;
 readonly oppositionContactObserved:boolean;readonly terminal:boolean;
 readonly physicalImpulseApplied:true;
 readonly shotOnTarget:null;readonly passCompleted:null;
 readonly interceptionConfirmed:null;readonly tackleConfirmed:null;
 readonly goalScored:null;readonly officialMatchPossession:false;
 readonly officialMatchAction:false;readonly officialMatchResult:null;
}
export interface PhysicalDefenderFlightSample {
 readonly physicsTick:number;
 readonly position:Readonly<{x:number;y:number;z:number}>;
 readonly velocity:Readonly<{x:number;y:number;z:number}>;
 readonly realShoeStarts:readonly string[];
}
export interface PhysicalDefenderFlightCompletion {
 readonly fixtureId:string;readonly sourcePassTick:number;
 readonly passerTeam:'home'|'away';readonly contactTick:number;
 readonly defenderIds:readonly string[];readonly observedThroughTick:number;
 readonly sampledFrames:6;readonly samples:readonly PhysicalDefenderFlightSample[];
 readonly path3DM:number;readonly velocityDeltaSumMps:number;
 readonly physicalEvidenceOnly:true;readonly isolatedShoeImpulseProven:false;
 readonly interceptionConfirmed:null;readonly tackleConfirmed:null;
 readonly passCompleted:null;readonly officialMatchPossession:false;
 readonly officialMatchResult:null;
}
export interface PhysicalDefenderFlight {
 readonly observationTicks:6;readonly pendingCount:number;
 readonly completedCount:number;
 readonly lastCompleted:PhysicalDefenderFlightCompletion|null;
 readonly readOnly:true;readonly physicalEvidenceOnly:true;
 readonly isolatedShoeImpulseProven:false;
 readonly interceptionConfirmed:null;readonly tackleConfirmed:null;
 readonly passCompleted:null;readonly officialMatchPossession:false;
 readonly officialMatchResult:null;
}
export interface ProvisionalPhysicalActionOutcome {
 readonly version:string;readonly physicsTick:number;
 readonly fixtureId:string;
 readonly physicalPassFollowThrough:Readonly<{
  opponentChallenge:Readonly<{defenderFlight:PhysicalDefenderFlight}>;
 }>;
 readonly source:'observed-rapier-ball-positions-and-real-shoe-starts';
 readonly observationWindowTicks:12;
 readonly latestExecutedAction:ProvisionalAutonomousAction|null;
 readonly active:ProvisionalActionObservedEpisode|null;
 readonly lastCompleted:ProvisionalActionObservedEpisode|null;
 readonly ballMotionObserved:boolean;
 readonly authenticContactsOnly:true;readonly readOnly:true;
 readonly physicalActionExecutionProven:boolean;
 readonly actionSuccessAdjudicated:false;
 readonly officialMatchPossession:false;readonly officialMatchAction:false;
 readonly officialGoalEvidence:false;readonly officialMatchResult:null;
 readonly productionScoringConnected:false;
}
export interface PhysicalGroundCarryRecontact {
 readonly engineId:string;readonly team:'home'|'away';
 readonly firstShoeTick:number;readonly shoeEndTick:number;
 readonly secondShoeTick:number;
 readonly firstBallPosition:Readonly<{x:number;y:number;z:number}>;
 readonly secondBallPosition:Readonly<{x:number;y:number;z:number}>;
 readonly measuredBallPath3DM:number;
 readonly measuredAttackingProgressM:number;
 readonly realFirstAndSecondRapierStarts:true;
 readonly physicalShoeEndBetween:true;
 readonly secondRealBoundedCarryImpulseApplied:true;
 readonly secondCarryImpulseNs:Readonly<{x:number;y:number;z:number}>;
 readonly dribbleConfirmed:null;readonly officialMatchResult:null;
}
export interface PhysicalCarryContactSequence {
 readonly version:string;readonly fixtureId:string;readonly physicsTick:number;
 readonly shoeStartCount:number;readonly authenticatedCarryImpulses:number;
 readonly verifiedGroundCarryRecontacts:number;
 readonly latestVerifiedGroundCarryRecontact:PhysicalGroundCarryRecontact|null;
 readonly interruptedCarryAttempts:number;
 readonly sameTeamPairs:number;readonly samePlayerRecontacts:number;
 readonly opponentPairs:number;readonly measuredForwardPairs:number;
 readonly ambiguousStarts:number;
 readonly readOnly:true;readonly carryConfirmed:null;
 readonly dribbleConfirmed:null;readonly officialMatchPossession:false;
 readonly officialMatchResult:null;
}
export interface PhysicalCarryProximityWindow {
 readonly engineId:string;readonly team:'home'|'away';
 readonly firstShoeTick:number;readonly shoeEndTick:number;
 readonly secondShoeTick:number;readonly sampledFrames:number;
 readonly nearFrames:number;readonly farFrames:number;
 readonly maxConsecutiveFarFrames:number;
 readonly ballBehindActorFrames:number;readonly lateralSeparatedFrames:number;
 readonly nearFrameFraction:number;readonly diagnosticRadiusM:1.25;
 readonly lateralDiagnosticBandM:0.75;
 readonly averageGapM:number;readonly minGapM:number;readonly maxGapM:number;
 readonly measuredActorPathM:number;readonly measuredBallPath3DM:number;
 readonly measuredAttackingProgressM:number;
 readonly sameActorGenuineContactPair:true;readonly physicalRapierProofOnly:true;
 readonly ballAttached:false;readonly ballControlConfirmed:null;
 readonly dribbleConfirmed:null;readonly officialMatchPossession:false;
 readonly officialMatchResult:null;
}
export type PhysicalProximityInterruptionReason =
 'opponent-shoe'|'teammate-shoe'|'ambiguous-shoes'|
 'expired'|'unverified-second-start';
export interface PhysicalCarryInterruptedWindow {
 readonly engineId:string;readonly team:'home'|'away';
 readonly firstShoeTick:number;readonly observedThroughTick:number;
 readonly sampledFrames:number;readonly realShoeEndTick:number|null;
 readonly reason:PhysicalProximityInterruptionReason;
 readonly otherPhysicalShoeIds:readonly string[];
 readonly measuredBallPath3DM:number;readonly measuredActorPathM:number;
 readonly nearFrameFraction:number;readonly farFrames:number;
 readonly maxConsecutiveFarFrames:number;
 readonly ballBehindActorFrames:number;readonly lateralSeparatedFrames:number;
 readonly realRapierInterruptionObserved:boolean;
 readonly ballControlConfirmed:null;readonly dribbleConfirmed:null;
 readonly officialMatchPossession:false;readonly officialMatchResult:null;
}
export interface PhysicalCarryProximity {
 readonly version:string;readonly fixtureId:string;readonly physicsTick:number;
 readonly source:'closed-physical-60hz-actor-ball-distance';
 readonly measurementRadiusM:1.25;readonly lateralDiagnosticBandM:0.75;
 readonly measuredWindows:number;readonly interruptedWindows:number;
 readonly latestMeasuredWindow:PhysicalCarryProximityWindow|null;
 readonly latestInterruptedWindow:PhysicalCarryInterruptedWindow|null;
 readonly interruptionReasons:Readonly<Record<PhysicalProximityInterruptionReason,number>>;
 readonly activeMeasurement:Readonly<{
  engineId:string;team:'home'|'away';firstShoeTick:number;
  sampledFrames:number;nearFrames:number;minGapM:number;maxGapM:number;
  farFrames:number;ballBehindActorFrames:number;
  lateralSeparatedFrames:number;realShoeEndTick:number|null;
 }>|null;
 readonly readOnly:true;readonly proximityIsNotPossession:true;
 readonly ballControlConfirmed:null;readonly dribbleConfirmed:null;
 readonly officialMatchPossession:false;readonly officialMatchResult:null;
}
export interface PhysicalStep {
 readonly version:string;readonly fixtureId:string;
 readonly physicsTick:number;readonly elapsedSeconds:number;
 readonly canonicalBall:string;readonly physicalRapierStep:true;
 readonly temporarySquad:UniformTemporarySquad;
 readonly temporaryPlayerSource:'homogeneous-temporary-actors';
 readonly uniformPlayerStats:true;
 readonly generatedPlayersUsed:false;
 readonly productionScoringConnected:false;readonly officialMatchResult:null;
 readonly physicalContactFeed:PhysicalFixtureContactFeed;
 readonly physicalCarryContactSequence:PhysicalCarryContactSequence;
 readonly physicalCarryProximity:PhysicalCarryProximity;
 readonly physicalCarryChallengerShoeGeometry?:PhysicalCarryOrientedShoeGeometry|null;
 readonly contactDecisionObservation:PhysicalContactDecisionObservation;
 readonly physicalActionOutcome:ProvisionalPhysicalActionOutcome;
 readonly localAutonomousAction:ProvisionalAutonomousAction|null;
 readonly autonomousActionMode:boolean;
 readonly autonomousCarrySupportMode?:true;
 readonly autonomousCarrySupportPressHandoffMode?:true;
  readonly autonomousCarryAttackContinuityMode?:true;
 readonly autonomousCarrySupportBallAccessMode?:true;
 readonly autonomousCarrySupportLateralAlignMode?:true;
 readonly autonomousCarrySupportEarlyFacingMode?:true;
 readonly autonomousCarrySupportShoeCenterTargetMode?:true;
 readonly autonomousCarrySupportFootLateralLeadMode?:true;
 readonly autonomousCarrySupportObservedBallVelocityLeadMode?:true;
 readonly autonomousCarrySupportTerminalFacingLeadMode?:true;
 readonly autonomousCarrySupportTerminalRunThroughMode?:true;
 readonly autonomousCarrySupportTerminalLateralSlipMode?:true;
 readonly autonomousCarrySupportLongitudinalLeadMode?:true;
 readonly localFootballActionExecuted:boolean;
 readonly ballForceApplied:boolean;
 readonly footContact:{
  readonly started:readonly string[];
  readonly ended:readonly string[];
  readonly active:readonly string[];
 };
}
export interface PhysicalFixtureSession {
 snapshot():PhysicalStep;
 step():PhysicalStep;
 advance(ticks:number):readonly PhysicalStep[];
 reset():PhysicalFixtureSession;
 dispose():void;
}
export const PHYSICAL_FIXTURE_RUNTIME_VERSION:string;
export const PHYSICAL_FIXTURE_CONTACT_FEED_VERSION:string;
export const PHYSICAL_FIXTURE_DUTY_CONTACT_VERSION:string;
export function normalizePhysicalFixture(fixture:PhysicalFixture):Readonly<PhysicalFixture>;
export function createPhysicalFixtureStepRuntime(
 RAPIER:unknown,fixture:PhysicalFixture,scenario:unknown,
 options?:{globalResponse?:number;autonomousActions?:true;
  autonomousCarry?:true;autonomousCarrySupport?:true;
  autonomousCarrySupportPressHandoff?:true;
   autonomousCarryAttackContinuity?:true;
  autonomousCarrySupportBallAccess?:true;
  autonomousCarrySupportLateralAlign?:true;
  autonomousCarrySupportEarlyFacing?:true;
  autonomousCarrySupportShoeCenterTarget?:true;
  autonomousCarrySupportFootLateralLead?:true;
  autonomousCarrySupportObservedBallVelocityLead?:true;
  autonomousCarrySupportTerminalFacingLead?:true;
  autonomousCarrySupportTerminalRunThrough?:true;
  autonomousCarrySupportTerminalLateralSlip?:true;
  autonomousCarrySupportLongitudinalLead?:true;
  researchShotAttacker?:'home'|'away'}
):PhysicalFixtureSession;
