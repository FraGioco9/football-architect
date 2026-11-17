// ME-01: isolated, deterministic 3D physics core. No browser, HTTP, D1 or football-world dependencies.
import {speedDependentDragCd} from './aerodynamics.mjs';
import {magnusLift,MAGNUS_SPIN_LIMIT_RAD_S} from './magnus.mjs';
import {literatureCandidateForces} from './literature-aero-candidate.mjs';
import {createPrivateRapierFootContactBridge}
 from './rapier-foot-contact-bridge.mjs';
import {createPrivateRapier22BodyBridge} from './rapier-22-body-bridge.mjs';
import {createPrivatePhysicalActionExecutor}
 from './private-physical-action-executor.mjs';
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {smallSidedSetup} from './small-sided-lab-scenarios.mjs';
import {createSmallSidedNativeBodyGuard}
 from './small-sided-native-body-guard.mjs';
import {initialResearchBodyEncounterLineup}
 from './research-body-encounter-initial-lineup.mjs';
import {initialResearchShotLineup} from './research-shot-initial-lineup.mjs';
import {basicSourcePositiveRestartSetup}
 from './basic-restart-source-lineup-b05b.mjs';
import {initialB06bOpeningLineup} from './basic-opening-kickoff-lineup-b06b.mjs';
import {initialResearchDefensiveLineup}
 from './basic-defensive-physical-actions-b03.mjs';
import {initialResearchGoalkeeperSaveLineup}
 from './goalkeeper-save-foundation-b02.mjs';
import {initialResearchControlLineup} from './research-control-initial-lineup.mjs';
import {initialResearchCarryLineup} from './research-carry-initial-lineup.mjs';
export const ENGINE_VERSION = 'me-01-physics-v4';
export const PHYSICS_VERSION = '@dimforge/rapier3d-deterministic-compat@0.21.0';
export const FIXED_DT = 1 / 60;
export const BALL_RADIUS = 0.11;
// ME-PHYS-02: explicit match-ball mass and thin-shell rotational inertia proxy.
export const BALL_MASS_KG = 0.43;
export const BALL_INERTIA_KG_M2 = (2 / 3) * BALL_MASS_KG * BALL_RADIUS ** 2;
// ME-PHYS-07 candidate aerodynamic drag; diagnostic-only until owner approval.
export const AIR_DENSITY_KG_M3 = 1.225;
export const BALL_FRONTAL_AREA_M2 = Math.PI * BALL_RADIUS ** 2;
export const DRAG_EXPERIMENT_CD = 0.24; // illustrative constant coefficient, not a universal soccer-ball Cd.
export const GROUND_RESTITUTION = 0.62; // candidate: measure LAB-05 rebound against FIFA turf reference.
export const BALL_RESTITUTION = 0.62;
// Public scenario Z is clearance from grass to the ball's underside; Rapier Z is center height.
export const toCenterHeight = clearance => clearance + BALL_RADIUS;
export const toGroundClearance = centerHeight => Math.max(0, centerHeight - BALL_RADIUS);
// ME-GRASS-01: provisional rolling resistance for level grass, not collider sliding friction.
// 0.8 m/s² is inside reported football turf roll-deceleration ranges (0.45–1.5).
export const GRASS_ROLL_DECELERATION = 0.8;
export const ROLL_STOP_SPEED = 0.04;
export const GRAVITY = Object.freeze({x: 0, y: 0, z: -9.81});
export const PRESETS = Object.freeze({
  drop: Object.freeze({x: 0, y: 0, z: 3, vx: 0, vy: 0, vz: 0}),
  launch: Object.freeze({x: -18, y: -3, z: 0.8, vx: 11, vy: 2, vz: 10}),
  roll: Object.freeze({x: 0, y: 0, z: 0, vx: 4, vy: 0, vz: 0}),
  bounce: Object.freeze({x: 0, y: 0, z: 2, vx: 0, vy: 0, vz: 0})
});
const FIELDS = ['x', 'y', 'z', 'vx', 'vy', 'vz'];
const BOUNDS = Object.freeze({x: 48, y: 30, z: 30, vx: 60, vy: 60, vz: 60});

export function normalizeScenario(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Invalid scenario');
  if (Object.keys(input).some(key => !['preset', 'seed', ...FIELDS].includes(key)))
    throw new TypeError('Unknown scenario field');
  const preset = input.preset ?? 'drop';
  if (!Object.hasOwn(PRESETS, preset)) throw new TypeError('Unknown preset');
  const seed = input.seed ?? 'me01-fixed';
  if (typeof seed !== 'string' || !/^[a-zA-Z0-9._:-]{1,64}$/.test(seed))
    throw new TypeError('Invalid seed');
  const data = {preset, seed};
  for (const key of FIELDS) {
    const value = input[key] ?? PRESETS[preset][key];
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > BOUNDS[key])
      throw new RangeError('Invalid value for ' + key);
    data[key] = Object.is(value, -0) ? 0 : value;
  }
  if (data.z < 0) throw new RangeError('Ball clearance cannot be below the surface');
  return Object.freeze(data);
}

export function canonicalSnapshot(state) {
  const p = state.ball.position, v = state.ball.velocity;
  const n = value => {
    if (!Number.isFinite(value)) throw new RangeError('Non-finite physics state');
    return Math.round(value * 1e7) / 1e7;
  };
  return JSON.stringify([ENGINE_VERSION, state.tick, n(p.x), n(p.y), n(p.z),
    n(v.x), n(v.y), n(v.z)]);
}

export function createEngine(RAPIER, input = {}, {
  diagnosticInitialRollFraction = 0,
  diagnosticGrassRollDecelerationMps2 = GRASS_ROLL_DECELERATION,
  diagnosticAirDragCd = 0,
  diagnosticAirDragModel = 'none',
  diagnosticAerodynamicProfile = 'none',
  diagnosticMagnusSpinRadS = null,
  diagnosticMagnusLiftEnabled = true,
  diagnosticSpinDecayRatePerS = 0,
  diagnosticPlayerFootContactsEnabled = false,
  diagnosticPlayerBodyCollidersEnabled = false,
  diagnosticSharedContactEventsEnabled = false,
  diagnosticResearchBodyEncounter = false,
  diagnosticUnstagedBodyFeedbackEnabled = false,
  diagnosticAutonomousFixtureActionEnabled = false,
  diagnosticAutonomousCarryEnabled = false,
  diagnosticResearchShotAttacker = null,
  diagnosticResearchShotBlockedLane = false,
  diagnosticResearchShotWideCross = false,
  diagnosticResearchGoalkeeperSaveSide = null,
  diagnosticResearchDefensiveSide = null,
  diagnosticResearchDefensiveKind = null,
  diagnosticBasicRestartEnabled = false,
  diagnosticBasicRestartSource = null,
  diagnosticBasicRestartAttackSide = null,
  diagnosticB06bHalftimeTick = null,
  diagnosticB06bOpeningKickoffEnabled = false,
  diagnosticB06bGoalRestartEnabled = false,
  diagnosticB06bNativeShotSide = null,
  diagnosticSmallSidedSituation = null,
  diagnosticSmallSidedSide = null,
  diagnosticSmallSidedVariantIndex = 0,
  diagnosticSmallSidedBodyGuardEnabled = false,
   diagnosticSmallSidedBodyFeedbackEnabled = false,
  diagnosticResearchControlReceiver = false,
  diagnosticResearchControlSide = 'home',
  diagnosticResearchControlOpponentFirst = false,
  diagnosticResearchReceivingCushionEnabled = false,
  diagnosticResearchReceivingDecisionEnabled = false,
   diagnosticResearchReceiverTapEnabled = false,
  diagnosticResearchControlCloseDefender = false,
  diagnosticResearchControlSpaceDefender = false,
   diagnosticResearchControlContestDefender = false,
  diagnosticResearchCarrySide = null
} = {}) {
  if (!RAPIER || typeof RAPIER.World !== 'function') throw new TypeError('Rapier 3D required');
  if(typeof diagnosticPlayerFootContactsEnabled!=='boolean')
    throw new TypeError('Boolean opt-in required for private shoe physics');
  // M9: the only permitted dual-source mode is explicitly research-only,
  // action-disabled, and drains exactly ONE current-world native event queue.
  // Existing isolated shoe/body paths are unchanged and remain default OFF.
  if(typeof diagnosticPlayerBodyCollidersEnabled!=='boolean'||
     typeof diagnosticSharedContactEventsEnabled!=='boolean'||
     (diagnosticPlayerBodyCollidersEnabled&&
      diagnosticPlayerFootContactsEnabled&&!diagnosticSharedContactEventsEnabled)||
     (diagnosticSharedContactEventsEnabled&&
      (!diagnosticPlayerBodyCollidersEnabled||
       !diagnosticPlayerFootContactsEnabled||
       diagnosticAutonomousFixtureActionEnabled||
       diagnosticAutonomousCarryEnabled)))
    throw new TypeError('Shared contact events require both native bridges without football action authority');
  if((diagnosticSmallSidedSituation===null)!==(diagnosticSmallSidedSide===null))
   throw new TypeError('Small-sided situation and attacking side must be paired');
  if(diagnosticSmallSidedSituation===null&&diagnosticSmallSidedVariantIndex!==0)
   throw new TypeError('Small-sided variant requires a paired physical exercise');
  if(typeof diagnosticSmallSidedBodyFeedbackEnabled!=='boolean'||
      (diagnosticSmallSidedBodyFeedbackEnabled&&
       diagnosticSmallSidedBodyGuardEnabled!==true))
    throw new TypeError('Small-sided feedback needs selected physical bodies');
   if(typeof diagnosticSmallSidedBodyGuardEnabled!=='boolean'||
     (diagnosticSmallSidedBodyGuardEnabled&&(
      diagnosticSmallSidedSituation===null||
      !diagnosticPlayerFootContactsEnabled||
      !diagnosticAutonomousFixtureActionEnabled||
      diagnosticPlayerBodyCollidersEnabled||
      diagnosticSharedContactEventsEnabled)))
   throw new TypeError('LAB body collision requires a small-sided exercise with actual shoe source');
  if(diagnosticSmallSidedSituation!==null){
   smallSidedSetup(diagnosticSmallSidedSituation,
    diagnosticSmallSidedSide,INITIAL_PLAYERS,
    {variantIndex:diagnosticSmallSidedVariantIndex});
   if(!diagnosticPlayerFootContactsEnabled||
      !diagnosticAutonomousFixtureActionEnabled||
      diagnosticPlayerBodyCollidersEnabled||diagnosticSharedContactEventsEnabled||
      diagnosticB06bHalftimeTick!==null||
      diagnosticB06bNativeShotSide!==null||
      diagnosticB06bOpeningKickoffEnabled||
      diagnosticB06bGoalRestartEnabled||
      diagnosticBasicRestartEnabled||diagnosticBasicRestartSource!==null||
      diagnosticResearchShotAttacker!==null||
      diagnosticResearchDefensiveSide!==null||
      diagnosticResearchControlReceiver||
      diagnosticResearchCarrySide!==null||
      diagnosticResearchGoalkeeperSaveSide!==null)
    throw new TypeError('Small-sided exercise exclusively requires original Rapier feet and uniform AI');
  }
  if(typeof diagnosticAutonomousFixtureActionEnabled!=='boolean'||
     typeof diagnosticAutonomousCarryEnabled!=='boolean'||
     (diagnosticAutonomousFixtureActionEnabled&&!diagnosticPlayerFootContactsEnabled)||
     (diagnosticAutonomousCarryEnabled&&!diagnosticAutonomousFixtureActionEnabled))
    throw new TypeError('Physical actions require explicit genuine shoe-source opt-in');
  if(typeof diagnosticBasicRestartEnabled!=='boolean'||
     (diagnosticBasicRestartEnabled&&(
       !diagnosticPlayerFootContactsEnabled||
       diagnosticAutonomousFixtureActionEnabled||
       diagnosticPlayerBodyCollidersEnabled||
       diagnosticSharedContactEventsEnabled||
       diagnosticResearchShotAttacker!==null||
       diagnosticResearchControlReceiver||
       diagnosticResearchCarrySide!==null||
       diagnosticResearchDefensiveSide!==null||
       diagnosticResearchGoalkeeperSaveSide!==null)))
    throw new TypeError('B05 restart may only use isolated source-bound DEV ball/feet without kick authority');
  if((diagnosticBasicRestartSource===null)!==
     (diagnosticBasicRestartAttackSide===null)||
     (diagnosticBasicRestartSource!==null&&(
      !diagnosticBasicRestartEnabled||
      !['throw-in','corner','goal-kick'].includes(diagnosticBasicRestartSource)||
      !['home','away'].includes(diagnosticBasicRestartAttackSide))))
   throw new TypeError('B05b authentic source must be tied to bounded DEV restart');
  if(typeof diagnosticB06bOpeningKickoffEnabled!=='boolean'||
     (diagnosticB06bOpeningKickoffEnabled&&diagnosticB06bHalftimeTick===null))
    throw new TypeError('B06b opening requires original private regulation opt-in');
  if(typeof diagnosticB06bGoalRestartEnabled!=='boolean'||
     (diagnosticB06bGoalRestartEnabled&&(
      diagnosticB06bHalftimeTick===null||diagnosticB06bOpeningKickoffEnabled)))
   throw new TypeError('B06b goal restart needs isolated non-opening regulation source');
  // H2b2b1: only this coupled, private research option may reuse the
  // EXISTING original uniform 22-player shot selector during a mini match.
  // An unrelated SHOT LAB, ordinary engine, or 90-minute audit cannot opt in.
  if(diagnosticB06bNativeShotSide!==null&&(
     !['home','away'].includes(diagnosticB06bNativeShotSide)||
     diagnosticB06bHalftimeTick===null||
     diagnosticB06bHalftimeTick===162000||
     !diagnosticB06bGoalRestartEnabled||
     diagnosticB06bOpeningKickoffEnabled||
     !diagnosticAutonomousFixtureActionEnabled||
     diagnosticAutonomousCarryEnabled||
     diagnosticResearchShotAttacker!==diagnosticB06bNativeShotSide||
     diagnosticResearchShotBlockedLane||diagnosticResearchShotWideCross))
   throw new TypeError('B06b native shot must use isolated original mini-match Rapier action source');
  if(diagnosticB06bHalftimeTick!==null&&(
    !Number.isSafeInteger(diagnosticB06bHalftimeTick)||
    diagnosticB06bHalftimeTick<120||
    diagnosticB06bHalftimeTick>162000||
    !diagnosticPlayerFootContactsEnabled||
    (diagnosticAutonomousFixtureActionEnabled&&
     diagnosticB06bNativeShotSide===null)||
    diagnosticAutonomousCarryEnabled||
    diagnosticBasicRestartEnabled||
    diagnosticPlayerBodyCollidersEnabled||
    diagnosticSharedContactEventsEnabled||
    (diagnosticResearchShotAttacker!==null&&
     diagnosticResearchShotAttacker!==diagnosticB06bNativeShotSide)||
    diagnosticResearchControlReceiver||
    diagnosticResearchDefensiveSide!==null||
    diagnosticResearchGoalkeeperSaveSide!==null))
   throw new TypeError('B06b isolated source-only native 60Hz halftime required');
  const scenario = normalizeScenario(input);
  if(typeof diagnosticResearchBodyEncounter!=='boolean'||
     (diagnosticResearchBodyEncounter&&
      (!diagnosticPlayerBodyCollidersEnabled||
       (diagnosticPlayerFootContactsEnabled&&
        !diagnosticSharedContactEventsEnabled)||
       diagnosticAutonomousFixtureActionEnabled)))
   throw new TypeError('M8 encounter needs body-only same-world opt-in');
 // M13: only the same original 22-body/shoe queue, NO staged encounter
 // and NO football action authority. This is never enabled by default.
 if(typeof diagnosticUnstagedBodyFeedbackEnabled!=='boolean'||
    (diagnosticUnstagedBodyFeedbackEnabled&&(
     !diagnosticPlayerBodyCollidersEnabled||
     !diagnosticPlayerFootContactsEnabled||
     !diagnosticSharedContactEventsEnabled||
     diagnosticResearchBodyEncounter||
     diagnosticAutonomousFixtureActionEnabled||
     diagnosticAutonomousCarryEnabled||
     diagnosticResearchShotAttacker!==null||
     diagnosticResearchControlReceiver||
     diagnosticResearchCarrySide!==null)))
  throw new TypeError('M13 feedback requires unstaged shared Rapier without gameplay authority');
 if(diagnosticResearchShotAttacker!==null&&(
    !['home','away'].includes(diagnosticResearchShotAttacker)||
    !diagnosticPlayerFootContactsEnabled||
    !diagnosticAutonomousFixtureActionEnabled||
    diagnosticAutonomousCarryEnabled))
  throw new TypeError('Research shot needs genuine private source/action opt-in');
 if(typeof diagnosticResearchShotBlockedLane!=='boolean'||
    (diagnosticResearchShotBlockedLane&&diagnosticResearchShotAttacker===null))
  throw new TypeError('Blocked lane requires genuine bounded research shot');
 if(typeof diagnosticResearchShotWideCross!=='boolean'||
    (diagnosticResearchShotWideCross&&(
     diagnosticResearchShotAttacker===null||
     diagnosticResearchShotBlockedLane||
     !diagnosticPlayerFootContactsEnabled||
     !diagnosticAutonomousFixtureActionEnabled)))
  throw new TypeError('Wide CROSS requires original exclusive Rapier shoe action');
 if(diagnosticResearchDefensiveSide!==null&&(
    !['home','away'].includes(diagnosticResearchDefensiveSide)||
    !['tackle','interception'].includes(diagnosticResearchDefensiveKind)||
    !diagnosticPlayerFootContactsEnabled||
    !diagnosticAutonomousFixtureActionEnabled||
    diagnosticAutonomousCarryEnabled||
    diagnosticResearchShotAttacker!==null||
    diagnosticResearchGoalkeeperSaveSide!==null||
    diagnosticResearchControlReceiver||
    diagnosticResearchCarrySide!==null))
  throw new TypeError('B03 defensive actions require exclusive original Rapier source');
 if(diagnosticResearchDefensiveSide===null&&
    diagnosticResearchDefensiveKind!==null)
  throw new TypeError('B03 kind requires real defender research side');
 if(diagnosticResearchGoalkeeperSaveSide!==null&&(
    !['home','away'].includes(diagnosticResearchGoalkeeperSaveSide)||
    !diagnosticPlayerFootContactsEnabled||
    !diagnosticAutonomousFixtureActionEnabled||
    diagnosticAutonomousCarryEnabled||
    diagnosticResearchShotAttacker!==null||
    diagnosticResearchControlReceiver||
    diagnosticResearchCarrySide!==null))
  throw new TypeError('Goalkeeper SAVE requires isolated original Rapier shoe action');
 if(!['home','away'].includes(diagnosticResearchControlSide)||
    (diagnosticResearchControlSide==='away'&&
     (!diagnosticResearchControlReceiver||
      diagnosticResearchControlOpponentFirst)))
  throw new TypeError('AWAY CONTROL requires the genuine receiver fixture');
 if(typeof diagnosticResearchControlOpponentFirst!=='boolean'||
    (diagnosticResearchControlOpponentFirst&&
     !diagnosticResearchControlReceiver))
  throw new TypeError('Bounded CONTROL opponent requires genuine receiver scene');
 if(typeof diagnosticResearchReceivingDecisionEnabled!=='boolean'||
    (diagnosticResearchReceivingDecisionEnabled&&(
     !diagnosticResearchReceivingCushionEnabled||
     !diagnosticResearchControlReceiver)))
  throw new TypeError('M27 applies only to original closed CONTROL M25 cushion source');
 if(typeof diagnosticResearchReceiverTapEnabled!=='boolean'||
     (diagnosticResearchReceiverTapEnabled&&(
      !diagnosticResearchReceivingDecisionEnabled||
      !diagnosticResearchReceivingCushionEnabled||
      (!diagnosticResearchControlSpaceDefender&&
       !diagnosticResearchControlContestDefender)||
      diagnosticResearchControlCloseDefender||
      diagnosticResearchControlOpponentFirst)))
   throw new TypeError('M30 requires original isolated M27 space receiving decision');
  if(typeof diagnosticResearchControlContestDefender!=='boolean'||
     (diagnosticResearchControlContestDefender&&(
      !diagnosticResearchControlReceiver||
      !diagnosticResearchReceivingCushionEnabled||
      !diagnosticResearchReceivingDecisionEnabled||
      !diagnosticResearchReceiverTapEnabled||
      diagnosticResearchControlSpaceDefender||
      diagnosticResearchControlCloseDefender||
      diagnosticResearchControlOpponentFirst)))
   throw new TypeError('M31 contested source requires isolated real M30 tap');
  if(typeof diagnosticResearchControlSpaceDefender!=='boolean'||
    (diagnosticResearchControlSpaceDefender&&(
     !diagnosticResearchControlReceiver||
     !diagnosticResearchReceivingCushionEnabled||
     diagnosticResearchControlCloseDefender||
     diagnosticResearchControlContestDefender||
     diagnosticResearchControlOpponentFirst)))
  throw new TypeError('M27 space source requires original CONTROL and M25');
 if(typeof diagnosticResearchControlCloseDefender!=='boolean'||
    (diagnosticResearchControlCloseDefender&&(
     !diagnosticResearchControlReceiver||
     !diagnosticResearchReceivingCushionEnabled||
     diagnosticResearchControlOpponentFirst)))
  throw new TypeError('M26 requires isolated CONTROL + original genuine cushion');
 if(typeof diagnosticResearchReceivingCushionEnabled!=='boolean'||
    (diagnosticResearchReceivingCushionEnabled&&(
     !diagnosticResearchControlReceiver||
     !diagnosticPlayerFootContactsEnabled||
     !diagnosticAutonomousFixtureActionEnabled||
     diagnosticSharedContactEventsEnabled||
     diagnosticPlayerBodyCollidersEnabled||
     diagnosticAutonomousCarryEnabled||
     diagnosticResearchShotAttacker!==null||
     diagnosticResearchCarrySide!==null)))
  throw new TypeError('M25 cushion requires genuine CONTROL-only Rapier action source');
 if(typeof diagnosticResearchControlReceiver!=='boolean'||
    (diagnosticResearchControlReceiver&&(
     diagnosticResearchShotAttacker!==null||
     diagnosticAutonomousCarryEnabled||
     !diagnosticPlayerFootContactsEnabled||
     !diagnosticAutonomousFixtureActionEnabled)))
  throw new TypeError('CONTROL setup must use sole private current-tick Rapier source');
 if(diagnosticResearchCarrySide!==null&&(
    !['home','away'].includes(diagnosticResearchCarrySide)||
    diagnosticResearchShotAttacker!==null||diagnosticResearchControlReceiver||
    !diagnosticPlayerFootContactsEnabled||
    !diagnosticAutonomousFixtureActionEnabled))
  throw new TypeError('CARRY setup requires bounded genuine private shoe source');
 const smallSided=diagnosticSmallSidedSituation===null?null:
  smallSidedSetup(diagnosticSmallSidedSituation,
   diagnosticSmallSidedSide,INITIAL_PLAYERS,
   {variantIndex:diagnosticSmallSidedVariantIndex});
 const stagedShoes=smallSided?smallSided.staged:
  diagnosticB06bOpeningKickoffEnabled?
   initialB06bOpeningLineup(INITIAL_PLAYERS):
  diagnosticBasicRestartSource!==null?
   basicSourcePositiveRestartSetup(INITIAL_PLAYERS,
    diagnosticBasicRestartAttackSide,scenario,
    diagnosticBasicRestartSource).players:
  diagnosticResearchDefensiveSide!==null?
   initialResearchDefensiveLineup(INITIAL_PLAYERS,
    diagnosticResearchDefensiveSide,scenario,
    {kind:diagnosticResearchDefensiveKind}):
  diagnosticResearchGoalkeeperSaveSide!==null?
   initialResearchGoalkeeperSaveLineup(INITIAL_PLAYERS,
    diagnosticResearchGoalkeeperSaveSide,scenario):
  diagnosticResearchShotAttacker!==null?
  initialResearchShotLineup(INITIAL_PLAYERS,diagnosticResearchShotAttacker,
   scenario,{blockedLane:diagnosticResearchShotBlockedLane,
    wideCross:diagnosticResearchShotWideCross}):
  diagnosticResearchControlReceiver?
   initialResearchControlLineup(INITIAL_PLAYERS,scenario,
    {opponentFirst:diagnosticResearchControlOpponentFirst,
     closeDefender:diagnosticResearchControlCloseDefender,
     spaceDefender:diagnosticResearchControlSpaceDefender,
     contestDefender:diagnosticResearchControlContestDefender,
     side:diagnosticResearchControlSide}):
  diagnosticResearchCarrySide!==null?
   initialResearchCarryLineup(INITIAL_PLAYERS,diagnosticResearchCarrySide,
    scenario):
  diagnosticResearchBodyEncounter?
   initialResearchBodyEncounterLineup(INITIAL_PLAYERS,scenario,{
    sharedContactBall:diagnosticSharedContactEventsEnabled
   }):
   INITIAL_PLAYERS;
  // Restricted to isolated zero/partial/full-spin roll experiments. Default 0
  // remains byte-for-byte equivalent to the accepted ME-01 physics-v4 path.
  if (typeof diagnosticInitialRollFraction !== 'number' ||
      !Number.isFinite(diagnosticInitialRollFraction) ||
      diagnosticInitialRollFraction < 0 || diagnosticInitialRollFraction > 1)
    throw new RangeError('Invalid diagnostic initial roll fraction');
  if (diagnosticInitialRollFraction !== 0 &&
      (scenario.preset !== 'roll' || scenario.z !== 0 || scenario.vz !== 0))
    throw new RangeError('Initial rolling spin is only available in grounded roll diagnostics');
  // ME-PHYS-05: sensitivity tests may vary ONLY rolling resistance on the
  // grounded roll scenario; normal LAB/production physics stays at 0.8 m/s².
  if(typeof diagnosticGrassRollDecelerationMps2 !== 'number' ||
     !Number.isFinite(diagnosticGrassRollDecelerationMps2) ||
     diagnosticGrassRollDecelerationMps2 < 0.3 ||
     diagnosticGrassRollDecelerationMps2 > 2)
    throw new RangeError('Invalid diagnostic grass rolling deceleration');
  if (diagnosticGrassRollDecelerationMps2 !== GRASS_ROLL_DECELERATION &&
      (scenario.preset !== 'roll' || scenario.z !== 0 || scenario.vz !== 0))
    throw new RangeError('Grass resistance sensitivity requires grounded roll diagnostics');
  if(typeof diagnosticAirDragCd !== 'number' || !Number.isFinite(diagnosticAirDragCd) ||
     diagnosticAirDragCd<0 || diagnosticAirDragCd>0.6)
    throw new RangeError('Invalid diagnostic air drag coefficient');
  if(diagnosticAirDragCd!==0 && scenario.preset!=='launch')
    throw new RangeError('Air drag sensitivity is only available for launch diagnostics');
  if(!['none','speed-dependent'].includes(diagnosticAirDragModel))
    throw new RangeError('Invalid diagnostic air drag model');
  if(diagnosticAirDragModel!=='none' && scenario.preset!=='launch')
    throw new RangeError('Speed-dependent drag is only available for launch diagnostics');
  if(diagnosticAirDragModel!=='none' && diagnosticAirDragCd!==0)
    throw new RangeError('Diagnostic drag modes are mutually exclusive');
  // A single experimental literature-informed candidate is restricted to
  // independently launched diagnostics, never ordinary LAB/gameplay worlds.
  if(!['none','literature-2011'].includes(diagnosticAerodynamicProfile))
    throw new RangeError('Invalid diagnostic aerodynamic profile');
  if(diagnosticAerodynamicProfile!=='none'){
    if(scenario.preset!=='launch')
      throw new RangeError('Literature aerodynamic profile requires a launch diagnostic');
    if(diagnosticAirDragModel!=='none'||diagnosticAirDragCd!==0||
       !diagnosticMagnusLiftEnabled)
      throw new RangeError('Literature aerodynamic profile conflicts with independent force switches');
    if(diagnosticMagnusSpinRadS===null)
      throw new RangeError('Literature aerodynamic profile requires explicit physical spin (zero permitted)');
  }
  // ME-PHYS-10: diagnostics may keep the SAME physical initial spin while
  // toggling lift OFF in the no-force and drag-only matched controls.
  if(typeof diagnosticMagnusLiftEnabled!=='boolean')
    throw new RangeError('Invalid diagnostic Magnus lift switch');
  // Lift cannot leak into ordinary launches or non-launch LABs. Explicitly
  // frozen spin is an isolated diagnostic, not a new scenario/roster attribute.
  let magnusSpin=null;
  if(diagnosticMagnusSpinRadS!==null){
    const value=diagnosticMagnusSpinRadS;
    if(!value || typeof value!=='object' || Array.isArray(value) ||
      Object.keys(value).length!==3 ||
      ['x','y','z'].some(k=>!Object.hasOwn(value,k) ||
        typeof value[k]!=='number'||!Number.isFinite(value[k])) ||
      Math.hypot(value.x,value.y,value.z)>MAGNUS_SPIN_LIMIT_RAD_S)
      throw new RangeError('Invalid diagnostic Magnus spin vector');
    if(scenario.preset!=='launch')
      throw new RangeError('Magnus spin is only available for launch diagnostics');
    // ME-PHYS-10 allows Cd(v) and lift to coexist in disposable launch-only
    // worlds. The existing fixed-Cd and drag-free cases remain unchanged.
    magnusSpin=Object.freeze({x:value.x,y:value.y,z:value.z});
  }
  if(!diagnosticMagnusLiftEnabled && !magnusSpin)
    throw new RangeError('Disabling Magnus lift requires a diagnostic spin vector');
  // ME-PHYS-23: launch-only spin sensitivity; never normal gameplay.
  if(typeof diagnosticSpinDecayRatePerS!=='number' ||
     !Number.isFinite(diagnosticSpinDecayRatePerS) ||
     diagnosticSpinDecayRatePerS<0 || diagnosticSpinDecayRatePerS>1)
    throw new RangeError('Invalid diagnostic in-flight spin decay rate');
  if(diagnosticSpinDecayRatePerS!==0 &&
     (scenario.preset!=='launch' || !magnusSpin ||
      Math.hypot(magnusSpin.x,magnusSpin.y,magnusSpin.z)<1e-8))
    throw new RangeError('Spin decay requires an independently launched diagnostic with nonzero spin');
  const diagnosticOptions=Object.freeze({
    diagnosticInitialRollFraction, diagnosticGrassRollDecelerationMps2,
    diagnosticAirDragCd, diagnosticAirDragModel,diagnosticAerodynamicProfile,
    diagnosticMagnusSpinRadS:magnusSpin,
    diagnosticMagnusLiftEnabled,diagnosticSpinDecayRatePerS,
    diagnosticPlayerFootContactsEnabled,diagnosticPlayerBodyCollidersEnabled,
    diagnosticSharedContactEventsEnabled,
    diagnosticResearchBodyEncounter,diagnosticUnstagedBodyFeedbackEnabled,
    diagnosticAutonomousFixtureActionEnabled,diagnosticAutonomousCarryEnabled,
    diagnosticResearchShotAttacker,diagnosticResearchShotBlockedLane,
    diagnosticResearchShotWideCross,diagnosticResearchGoalkeeperSaveSide,
    diagnosticResearchDefensiveSide,diagnosticResearchDefensiveKind,
    diagnosticBasicRestartEnabled,diagnosticBasicRestartSource,
    diagnosticBasicRestartAttackSide,
    diagnosticB06bHalftimeTick,diagnosticB06bNativeShotSide,
    diagnosticSmallSidedSituation,diagnosticSmallSidedSide,
    diagnosticSmallSidedVariantIndex,diagnosticSmallSidedBodyGuardEnabled,
     diagnosticSmallSidedBodyFeedbackEnabled,
    diagnosticB06bGoalRestartEnabled,diagnosticB06bOpeningKickoffEnabled,
    diagnosticResearchControlReceiver,diagnosticResearchControlSide,
    diagnosticResearchControlOpponentFirst,diagnosticResearchReceivingCushionEnabled,
    diagnosticResearchReceivingDecisionEnabled,diagnosticResearchReceiverTapEnabled,
    diagnosticResearchControlCloseDefender,
    diagnosticResearchControlSpaceDefender,
     diagnosticResearchControlContestDefender,diagnosticResearchCarrySide
  });
  const world = new RAPIER.World(GRAVITY);
  world.timestep = FIXED_DT;
  // XY = field surface. Physics Z = center height, scenario Z = bottom clearance.
  // The floor top is exactly z=0 and a grounded ball center starts at its radius.
  const ground = RAPIER.ColliderDesc.cuboid(52.5, 34, 0.2)
    .setTranslation(0, 0, -0.2).setFriction(0.65).setRestitution(smallSided?.id==='dribble-1v1'?0:GROUND_RESTITUTION);
  world.createCollider(ground);
  const desc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(scenario.x, scenario.y, toCenterHeight(scenario.z))
    .setLinvel(scenario.vx, scenario.vy, scenario.vz)
    .setCcdEnabled(true);
  const body = world.createRigidBody(desc);
  // Mass is NOT density: the old density=0.4 produced only ~2.23 grams.
  // Model the ball as a thin spherical shell for mass moment of inertia,
  // I=(2/3)*m*r². Rapier's physical collider remains an 11cm sphere.
  const ballShape=RAPIER.ColliderDesc.ball(BALL_RADIUS)
    .setMassProperties(BALL_MASS_KG,
      {x: 0, y: 0, z: 0},
      {x: BALL_INERTIA_KG_M2, y: BALL_INERTIA_KG_M2, z: BALL_INERTIA_KG_M2},
      {w: 1, x: 0, y: 0, z: 0})
    .setFriction(0.45).setRestitution(smallSided?.id==='dribble-1v1'?0:BALL_RESTITUTION);
  // In M9 only, category 0x1 shoes/ball can interact with each other
  // and ground but NOT player-body category 0x20. Default path untouched.
  if(diagnosticSharedContactEventsEnabled)
   ballShape.setCollisionGroups(0x00010001);
  const ballCollider=world.createCollider(ballShape,body);
  const measuredInertia = body.principalInertia();
  const ballProperties = Object.freeze({
    massKg: body.mass(),
    principalInertiaKgM2: Object.freeze({
      x: measuredInertia.x, y: measuredInertia.y, z: measuredInertia.z
    })
  });
  if (Math.abs(ballProperties.massKg - BALL_MASS_KG) > 1e-4 ||
      Object.values(ballProperties.principalInertiaKgM2)
        .some(value => !Number.isFinite(value) || Math.abs(value - BALL_INERTIA_KG_M2) > 1e-5))
    throw new Error('Rapier match-ball mass/inertia mismatch');
  // M9 shared mode owns exactly ONE Rapier queue. Pre-existing action labs
  // still create their own unshared shoe queue with byte-stable callbacks.
  const sharedContactQueue=diagnosticSharedContactEventsEnabled?
   new RAPIER.EventQueue(true):null;
  const shoeBridge=diagnosticPlayerFootContactsEnabled?
    createPrivateRapierFootContactBridge(RAPIER,world,ballCollider,stagedShoes,
     {...(sharedContactQueue?{sharedQueue:sharedContactQueue}:{}),
      ...(smallSided?{activePlayerIds:smallSided.activeIds}:{}),
      ...(smallSided?.id==='dribble-1v1'?{
       isolatedGroundDribbleBallCentreZ:BALL_RADIUS
      }:{}),
      ...(diagnosticSmallSidedBodyGuardEnabled?{
       isolatedPhysicalBodies:true
      }:{})}):null;
  // All 22 real body colliders remain isolated from ball, shoes and grass.
  const bodyBridge=diagnosticPlayerBodyCollidersEnabled?
    createPrivateRapier22BodyBridge(RAPIER,world,stagedShoes,{
     controlledEncounter:diagnosticResearchBodyEncounter,
     unstagedFeedback:diagnosticUnstagedBodyFeedbackEnabled,
     ...(sharedContactQueue?{sharedQueue:sharedContactQueue}:{})
    }):null;
  const smallBodyGuard=diagnosticSmallSidedBodyGuardEnabled?
   createSmallSidedNativeBodyGuard(RAPIER,world,ballCollider,
     stagedShoes,smallSided.activeIds,{
      feedbackEnabled:diagnosticSmallSidedBodyFeedbackEnabled,
      ...(smallSided?.id==='dribble-1v1'?{
       dribbleGroundBallCentreZ:BALL_RADIUS
      }:{})
     }):null;
  let sharedCollisionEventsLastTick=0,sharedForceEventsLastTick=0;
  const actionExecutor=diagnosticAutonomousFixtureActionEnabled?
    createPrivatePhysicalActionExecutor({
      ballBody:body,shoeBridge,ballRadiusM:BALL_RADIUS,
      physicalBodyGuardEnabled:diagnosticSmallSidedBodyGuardEnabled,
      allowPhysicalCarry:diagnosticAutonomousCarryEnabled||
       smallSided?.id==='dribble-1v1'||(smallSided?.variantIndex>0),
      ...(smallSided?{activePlayerIds:smallSided.activeIds}:{}),
      ...(smallSided?.id==='dribble-1v1'?{
       isolatedDribbleContext:Object.freeze({
        situationId:smallSided.id,attackingSide:smallSided.side,
        variantIndex:smallSided.variantIndex
       })
      }:{}),
      ...(smallSided?.variantIndex>0?{
       smallSidedDecisionContext:Object.freeze({
        situationId:smallSided.id,
        variantIndex:smallSided.variantIndex,
        attackingSide:smallSided.side
       })
      }:{}),
      researchReceivingCushionSide:diagnosticResearchReceivingCushionEnabled?
       diagnosticResearchControlSide:null,
      researchReceivingDecisionSide:diagnosticResearchReceivingDecisionEnabled?
       diagnosticResearchControlSide:null,
      researchReceiverTapSide:diagnosticResearchReceiverTapEnabled?
       diagnosticResearchControlSide:null
    }):null;
  // A ball rolling in +X has angular velocity +Y; at its bottom contact
  // v_contact=(vx-r*omegaY, vy+r*omegaX). Match zero/half/full contact slip.
  // No setter is invoked for the default zero-spin path.
  if (diagnosticInitialRollFraction > 0)
    body.setAngvel({
      x: -scenario.vy / BALL_RADIUS * diagnosticInitialRollFraction,
      y: scenario.vx / BALL_RADIUS * diagnosticInitialRollFraction,
      z: 0
    }, true);
  if(magnusSpin)body.setAngvel(magnusSpin,true);
  let tick = 0;
  let disposed = false;
  let basicRestartTick = -1;
  let b06bOpeningKickoff=null,b06bHalftimePlacement=null,b06bKickoff=null;
  let b06bGoalPending=null,b06bGoalLastTick=-1,b06bGoalPausedTicks=0;
  let b05bOutboundAction=null,b05bTake=null,b05bRestartTicket=null;
  const b05bSource=diagnosticBasicRestartSource===null?null:
   basicSourcePositiveRestartSetup(INITIAL_PLAYERS,
    diagnosticBasicRestartAttackSide,scenario,
    diagnosticBasicRestartSource);
  function applyGrassRollingResistance() {
    // Rapier collider friction resists sliding but an already-rolling sphere can
    // retain constant speed. Apply a surface-only energy loss per fixed tick.
    const p = body.translation(), v = body.linvel();
    if (p.z > BALL_RADIUS + 0.02 || Math.abs(v.z) > 0.25 ||
        Math.abs(p.x) >= 52.5 - BALL_RADIUS || Math.abs(p.y) >= 34 - BALL_RADIUS)
      return; // Keep airborne motion (and off-pitch fall) unaffected.
    const speed = Math.hypot(v.x, v.y);
    if (!(speed > 0)) return;
    const remaining = Math.max(0, speed - diagnosticGrassRollDecelerationMps2 * FIXED_DT);
    const ratio = remaining < ROLL_STOP_SPEED ? 0 : remaining / speed;
    body.setLinvel({x: v.x * ratio, y: v.y * ratio, z: v.z}, false);
    // Brake rolling spin as well; otherwise contact friction can feed residual
    // rotation back into horizontal motion even after the translation stops.
    const spin = body.angvel();
    body.setAngvel({x: spin.x * ratio, y: spin.y * ratio, z: spin.z}, false);
  }
  function snapshot() {
    if (disposed) throw new Error('Engine has been disposed');
    const p = body.translation(), v = body.linvel();
    return Object.freeze({
      version: ENGINE_VERSION,
      tick,
      time: tick * FIXED_DT,
      ball: Object.freeze({
        position: Object.freeze({x: p.x, y: p.y, z: p.z}),
        velocity: Object.freeze({x: v.x, y: v.y, z: v.z})
      }),
      nearGround: p.z <= BALL_RADIUS + 0.01
    });
  }
  // Read-only diagnostic access; does not alter canonical snapshots or physics.
  function angularVelocity() {
    if (disposed) throw new Error('Engine has been disposed');
    const a=body.angvel();
    return Object.freeze({x:a.x,y:a.y,z:a.z});
  }
  function step(playerFrame) {
    if (disposed) throw new Error('Engine has been disposed');
    if(!shoeBridge&&!bodyBridge&&playerFrame!==undefined)
      throw new TypeError('Canonical player frame requires explicit physics opt-in');
    if(bodyBridge&&playerFrame===undefined)
      throw new TypeError('Rapier body probe requires original current player frame');
    // Private current Rapier state is captured before the only world.step().
    // The bridge never manufactures an event, impulse or match possession.
    const preStepBall=shoeBridge?snapshot().ball:null;
    if(shoeBridge)shoeBridge.prepare(playerFrame,tick+1);
    if(bodyBridge)bodyBridge.prepare(playerFrame,tick+1);
    if(smallBodyGuard)smallBodyGuard.prepare(playerFrame,tick+1);
    // User forces are persistent in Rapier. Clear the previous tick's drag
    // BEFORE computing this tick's force, and never apply it on the grass.
    // The default=0 branch is identical to the accepted physics-v4 path.
    if(diagnosticAirDragCd>0 || diagnosticAirDragModel==='speed-dependent' ||
       diagnosticAerodynamicProfile!=='none' || magnusSpin){
      body.resetForces(false);
      const position=body.translation(),v=body.linvel();
      if(position.z>BALL_RADIUS+0.02){
        const speed=Math.hypot(v.x,v.y,v.z);
        if(speed>0){
          if(diagnosticAerodynamicProfile==='literature-2011'){
            // Exactly one bounded hybrid force, computed from *actual*
            // translational and angular Rapier velocities on each 60Hz tick.
            const f=literatureCandidateForces(v,body.angvel(),{
              radiusM:BALL_RADIUS,densityKgM3:AIR_DENSITY_KG_M3,
              areaM2:BALL_FRONTAL_AREA_M2
            }).force;
            body.addForce(f,true);
          }else{
          const cd=diagnosticAirDragModel==='speed-dependent'?
            speedDependentDragCd(speed):diagnosticAirDragCd;
          // Preserve the accepted fixed and variable Cd force paths. Magnus
          // adds a separate perpendicular force, from ACTUAL Rapier spin.
          if(cd>0){
            const magnitude=-0.5*AIR_DENSITY_KG_M3*cd*
              BALL_FRONTAL_AREA_M2*speed;
            body.addForce({x:magnitude*v.x,y:magnitude*v.y,z:magnitude*v.z},true);
          }
          if(magnusSpin && diagnosticMagnusLiftEnabled){
            const lift=magnusLift(v,body.angvel(),{
              radiusM:BALL_RADIUS,densityKgM3:AIR_DENSITY_KG_M3,
              areaM2:BALL_FRONTAL_AREA_M2
            }).force;
            if(lift.x || lift.y || lift.z)body.addForce(lift,true);
          }
          } // Only one aerodynamic model applies to this disposable world.
        }
      }
    }
    if(sharedContactQueue){
      // The SINGLE original-world step emits native collider events once.
      // Capture immutable measurements BEFORE any observer can drain them.
      world.step(sharedContactQueue);
      const collisions=[],forces=[];
      sharedContactQueue.drainCollisionEvents((a,b,started)=>{
       collisions.push(Object.freeze({a,b,started}));
      });
      sharedContactQueue.drainContactForceEvents(e=>{
       const v=e.totalForce(),d=e.maxForceDirection();
       forces.push(Object.freeze({
        a:e.collider1(),b:e.collider2(),
        force:Object.freeze({x:v.x,y:v.y,z:v.z}),
        direction:Object.freeze({x:d.x,y:d.y,z:d.z}),
        magnitude:e.totalForceMagnitude(),
        maxMagnitude:e.maxForceMagnitude()
       }));
      });
      const shared=Object.freeze({
       collisions:Object.freeze(collisions),
       forces:Object.freeze(forces)
      });
      shoeBridge.observe(tick+1,preStepBall,{
       position:body.translation(),velocity:body.linvel()
      },shared);
      bodyBridge.observe(tick+1,shared);
      sharedCollisionEventsLastTick=collisions.length;
      sharedForceEventsLastTick=forces.length;
    }else if(shoeBridge){
      world.step(shoeBridge.eventQueue);
      shoeBridge.observe(tick+1,preStepBall,{
        position:body.translation(),velocity:body.linvel()
      });
    }else if(bodyBridge){
      world.step(bodyBridge.eventQueue);
      bodyBridge.observe(tick+1);
    }else world.step();
    // This is read exclusively from native post-step Rapier solver contact
    // manifolds. Never inject player collisions or attribute a goal/possession.
    if(smallBodyGuard)smallBodyGuard.observe(tick+1);
    // Exponential airborne-only decay after integration; zero rate preserves
    // the original physics-v4 path without any angular-velocity setter.
    if(diagnosticSpinDecayRatePerS>0 &&
       body.translation().z>BALL_RADIUS+0.02){
      const a=body.angvel(),ratio=Math.exp(-diagnosticSpinDecayRatePerS*FIXED_DT);
      body.setAngvel({x:a.x*ratio,y:a.y*ratio,z:a.z*ratio},true);
    }
    applyGrassRollingResistance();
    tick += 1;
    // Same tick, same private Rapier ball, exclusively from observed shoe
    // START. The ordinary physics and contact-only modes never kick.
    if(actionExecutor)actionExecutor.apply(tick,playerFrame,{
      suppressOriginalAction:diagnosticB06bNativeShotSide!==null&&(
       b06bGoalPending!==null||
       (b06bHalftimePlacement!==null&&b06bKickoff===null)),
      suppressPhysicalBodyContact:smallBodyGuard?.snapshot()
       .lowerLegBallContacts.length>0
    });
    return snapshot();
  }
  // B05b: one original native Rapier shoe START, one outbound physical
  // impulse on the same ball. This is a DEV research action, not a match
  // authority or a manufactured contact/proxy.
  function attemptB05bNativeOutboundKick(frame){
    if(disposed||!b05bSource||basicRestartTick>=0||
       frame?.tick!==tick||tick<1||
       !Array.isArray(frame?.players)||frame.players.length!==22)
      throw new TypeError('B05b exclusive original outbound kick scene required');
    if(b05bOutboundAction)return null;
    const contact=shoeBridge.snapshot(),solver=shoeBridge.solver();
    const sourceId=b05bSource.sourceId;
    if(contact.tick!==tick||solver?.tick!==tick)
      throw new TypeError('B05b requires original same-tick native shoe queue');
    if(contact.started.length!==1||contact.active.length!==1||
       contact.started[0]!==sourceId||contact.active[0]!==sourceId)
      return null;
    if(!solver.pairs.some(pair=>pair.id===sourceId&&
      pair.beganThisTick&&pair.collisionActive&&
      pair.manifolds.some(m=>m.geometricContacts>0))||
       frame.players.some((p,i)=>p.id!==INITIAL_PLAYERS[i].id||
        p.team!==INITIAL_PLAYERS[i].team||
        p.role!==INITIAL_PLAYERS[i].role||
        ![p.x,p.y,p.vx,p.vy].every(Number.isFinite)))
      throw new TypeError('B05b rejects non-native or unauthenticated last shoe START');
    const pos=body.translation();
    if(Math.hypot(pos.x-scenario.x,pos.y-scenario.y)>1.5||
       Math.abs(pos.z-BALL_RADIUS)>0.25)
      throw new TypeError('B05b source no longer on original in-field ball');
    const d=diagnosticBasicRestartAttackSide==='home'?1:-1;
    const impulse=diagnosticBasicRestartSource==='throw-in'?
     {x:0,y:4.0*d,z:0.06}:{x:4.0*d,y:0,z:0.06};
    body.applyImpulse(impulse,true);
    b05bOutboundAction=Object.freeze({
     tick,actorId:sourceId,team:b05bSource.lastTeam,
     sameWorldRapierBall:true,genuineExclusiveNativeShoeStart:true,
     nativeSolverGeometricContact:true,
     impulseNs:Object.freeze(impulse),
     appliedByOriginalRapierBody:true,
     officialMatchAction:false,officialPossession:false
    });
    return b05bOutboundAction;
  }
  // The same existing Rapier ball is placed for a lawful DEAD-BALL restart.
  // This is never a football kick, native shoe START or field-player teleport.
  // Only an exact-tick referee ticket describing the ACTUAL fully-out ball
  // unlocks this explicitly DEV-only operation.
  function applyBasicRestartAtBoundary(event){
    if(disposed||!diagnosticBasicRestartEnabled||
       !event||event.tick!==tick||basicRestartTick>=0||
       event.originalRapierSource!==true||
       event.crossing?.fullBallCrossed!==true||
       event.crossing?.source!=='real-consecutive-rapier-centres'||
       !event.restart?.ready||event.restart.sameBallRapierRestart!==true||
       !['home','away'].includes(event.restart.team)||
       !['goal','goal-line','touchline'].includes(event.kind)||
       event.crossing.edge!==event.kind||
       !['kickoff','throw-in','corner','goal-kick'].includes(event.restart.type))
      throw new TypeError('B05 needs an original exact-tick verified full-ball exit and ready restart');
    const p=body.translation(),at=event.restart.spot;
    if(!at||![at.x,at.y,at.z].every(Number.isFinite)||
       Math.abs(at.z-BALL_RADIUS)>1e-8||
       ((event.kind==='touchline')!==(event.restart.type==='throw-in'))||
       (event.kind==='goal')!==(event.restart.type==='kickoff')||
       (event.kind==='goal-line'&&!['corner','goal-kick'].includes(event.restart.type))||
       (event.kind==='touchline'&&
        (Math.abs(p.y)<34+BALL_RADIUS-1e-6||
         Math.abs(Math.abs(at.y)-(34-BALL_RADIUS))>1e-6))||
       (event.kind!=='touchline'&&
        (Math.abs(p.x)<52.5+BALL_RADIUS-1e-6||
         (event.kind==='goal'&&(
          at.x!==0||at.y!==0))||
         (event.kind==='goal-line'&&event.restart.type==='corner'&&
          (Math.abs(at.x)>52.5-BALL_RADIUS+1e-6||
           Math.abs(at.y)>34-BALL_RADIUS+1e-6||
           Math.hypot(52.5-Math.abs(at.x),34-Math.abs(at.y))>1+1e-6))||
         (event.kind==='goal-line'&&event.restart.type==='goal-kick'&&
          (Math.abs(Math.abs(at.x)-47)>1e-6||
           Math.abs(Math.abs(at.y)-5.5)>1e-6)))))
      throw new TypeError('B05 restart spot must be in original pitch geometry after true exit');
    if(b05bSource&&(
      !b05bOutboundAction||
      event.lastVerifiedTouch?.tick!==b05bOutboundAction.tick||
      event.lastVerifiedTouch?.playerId!==b05bSource.sourceId||
      event.lastVerifiedTouch?.team!==b05bSource.lastTeam||
      event.restart.type!==b05bSource.kind||
      event.restart.team!==b05bSource.restartTeam))
     throw new TypeError('B05b restart requires original same-shoe outbound action and goal-line outcome');
    body.setTranslation(at,true);
    body.setLinvel({x:0,y:0,z:0},true);
    body.setAngvel({x:0,y:0,z:0},true);
    body.resetForces(true);
    body.resetTorques(true);
    basicRestartTick=tick;
    b05bRestartTicket=b05bSource?event.restart:null;
    return Object.freeze({tick,kind:event.restart.type,
     assignedTeam:event.restart.team,
     originalRapierBallRepositioned:true,
     realShoeContact:false,officialMatchResult:null,
     ball:snapshot().ball,sourceEventTick:event.tick});
  }
  // B05b set piece: corner/goal kick MUST have an independent native
  // restart-taker shoe START and live same-tick Rapier manifold.
  // A throw-in has no hand colliders yet: a player-proximity-gated
  // DEV-only *provisional hand-release impulse*, never a certified throw.
  function attemptB05bOriginalSetPiece(frame,ticket){
    if(disposed||!b05bSource||!b05bOutboundAction||
       b05bRestartTicket===null||ticket!==b05bRestartTicket||
       ticket.type!==b05bSource.kind||
       frame?.tick!==tick||tick<=basicRestartTick||
       !Array.isArray(frame.players)||frame.players.length!==22)
      throw new TypeError('B05b set piece requires original prepared restart ticket');
    if(b05bTake)return null;
    const p=frame.players.find(q=>q.id===b05bSource.takerId);
    if(!p||p.team!==ticket.team||
       frame.players.some((q,i)=>q.id!==INITIAL_PLAYERS[i].id||
        q.team!==INITIAL_PLAYERS[i].team||
        q.role!==INITIAL_PLAYERS[i].role||
        ![q.x,q.y,q.vx,q.vy].every(Number.isFinite)))
      throw new TypeError('B05b set-piece taker must be the original current player');
    const at=ticket.spot,position=body.translation();
    if(Math.hypot(position.x-at.x,position.y-at.y)>0.65||
       Math.abs(position.z-BALL_RADIUS)>0.35)
      return null;
    const contact=shoeBridge.snapshot(),solver=shoeBridge.solver();
    if(contact.tick!==tick||solver?.tick!==tick)
      throw new TypeError('B05b set-piece requires original latest Rapier shoe step');
    const throwIn=ticket.type==='throw-in';
    const native=contact.started.length===1&&contact.active.length===1&&
      contact.started[0]===b05bSource.takerId&&
      contact.active[0]===b05bSource.takerId&&
      solver.pairs.some(pair=>pair.id===b05bSource.takerId&&
       pair.beganThisTick&&pair.collisionActive&&
       pair.manifolds.some(m=>m.geometricContacts>0));
    if(!throwIn&&!native)return null;
    if(throwIn&&(
      contact.started.length!==0||
      Math.hypot(p.x-at.x,p.y-at.y)>2.2))
      return null;
    const d=diagnosticBasicRestartAttackSide==='home'?1:-1;
    const impulse=throwIn?
     {x:d*0.2,y:-d*1.8,z:0.55}:
     ticket.type==='corner'?
     {x:-d*1.85,y:-d*1.15,z:0.42}:
     {x:-d*2.5,y:0,z:0.3};
    if(throwIn){
     // Original ball is positioned at the approximate release height
     // only once. The human arm/hand itself is NOT simulated.
     body.setTranslation({x:at.x,y:at.y,z:1.8},true);
     body.setLinvel({x:0,y:0,z:0},true);
    }
    body.applyImpulse(impulse,true);
    b05bTake=Object.freeze({
     tick,actorId:b05bSource.takerId,team:b05bSource.restartTeam,
     type:ticket.type,impulseNs:Object.freeze(impulse),
     singleOriginalRapierBall:true,physicalImpulseApplied:true,
     originalNativeShoeStart:native,
     provisionalHandReleaseWithoutHandCollider:throwIn,
     legalThrowConfirmed:false,officialMatchAction:false,
     officialPossession:false,officialMatchResult:null,
     ball:snapshot().ball
    });
    return b05bTake;
  }
  function b06bOriginalOpeningKickoff(frame){
    if(disposed||!diagnosticB06bOpeningKickoffEnabled||
       tick!==1||b06bOpeningKickoff||frame?.tick!==tick||
       !Array.isArray(frame.players)||frame.players.length!==22||
       frame.players.some((p,i)=>p?.id!==INITIAL_PLAYERS[i].id||
        p.team!==INITIAL_PLAYERS[i].team||
        p.role!==INITIAL_PLAYERS[i].role||
        ![p.x,p.y,p.vx,p.vy].every(Number.isFinite)))
      throw new TypeError('B06b opening needs first original 22-player physics tick');
    const foot=shoeBridge.snapshot(),solver=shoeBridge.solver();
    if(foot.tick!==tick||solver?.tick!==tick)
      throw new TypeError('B06b opening requires same-tick Rapier shoe solver');
    if(foot.started.length!==1||foot.active.length!==1||
       foot.started[0]!=='home-10'||foot.active[0]!=='home-10')
      return null;
    if(!solver.pairs.some(p=>p.id==='home-10'&&p.beganThisTick&&
       p.collisionActive&&p.manifolds.some(m=>m.geometricContacts>0)))
      throw new TypeError('B06b opening cannot infer an absent Rapier manifold');
    const pos=body.translation();
    if(Math.hypot(pos.x,pos.y)>0.65||Math.abs(pos.z-BALL_RADIUS)>0.3)
      throw new TypeError('B06b original opening ball must be at centre');
    const impulse=Object.freeze({x:0.65,y:0,z:0.04});
    body.applyImpulse(impulse,true);
    b06bOpeningKickoff=Object.freeze({
      tick,team:'home',actorId:'home-10',
      genuineExclusiveOriginalShoeStart:true,
      currentRapierContactManifold:true,original22PlayerFrame:true,
      impulseNs:impulse,originalBallImpulseApplied:true,
      sameOriginalRapierWorld:true,
      officialMatchAction:false,officialPossession:false,officialMatchResult:null
    });
    return b06bOpeningKickoff;
  }
  // H2b1: a goal is observed by B05/B06 before this PRIVATE same-World
  // placement. The placement is NOT a shoe kick or a restart completion.
  function b06bOriginalPlaceGoalRestart(event,frame){
    const pos=body.translation();
    const scorer=event?.scoringTeam;
    const side=scorer==='home'?1:scorer==='away'?-1:0;
    const c=event?.crossing,at=event?.restart?.spot;
    if(disposed||!diagnosticB06bGoalRestartEnabled||
       b06bGoalPending||tick<=b06bGoalLastTick||
       frame?.tick!==tick||frame.players?.length!==22||
       frame.players.some((p,i)=>p?.id!==INITIAL_PLAYERS[i].id||
        p.team!==INITIAL_PLAYERS[i].team||
        ![p.x,p.y,p.vx,p.vy].every(Number.isFinite))||
       !event||event.tick!==tick||event.kind!=='goal'||
       event.originalRapierSource!==true||
       event.provisionalGoalScored!==true||
       event.officialResult!==false||
       side===0||event.restart?.type!=='kickoff'||
       event.restart?.team!==(side===1?'away':'home')||
       event.restart?.ready!==true||
       event.restart?.sameBallRapierRestart!==true||
       at?.x!==0||at?.y!==0||Math.abs(at?.z-BALL_RADIUS)>1e-8||
       c?.source!=='real-consecutive-rapier-centres'||
       c.fullBallCrossed!==true||c.goal!==true||
       c.edge!=='goal'||c.axis!=='x'||c.side!==side||
       Math.abs(c.intersection?.x-side*(52.5+BALL_RADIUS))>1e-6||
       Math.abs(c.intersection?.y)>7.32/2-BALL_RADIUS+1e-8||
       c.intersection?.z>BALL_RADIUS+2.44||
       side*pos.x<=52.5+BALL_RADIUS||Math.abs(pos.y)>7.32/2||
       pos.z>BALL_RADIUS+2.44)
      throw new TypeError('B06b refuses goal placement without real current full-ball B05 crossing');
    body.setTranslation({x:0,y:0,z:BALL_RADIUS},true);
    body.setLinvel({x:0,y:0,z:0},true);
    body.setAngvel({x:0,y:0,z:0},true);
    body.resetForces(true);body.resetTorques(true);
    b06bGoalLastTick=tick;
    const placement=Object.freeze({
      tick,kind:'kickoff',assignedTeam:event.restart.team,
      sourceEventTick:event.tick,originalRapierBallRepositioned:true,
      realShoeContact:false,officialMatchResult:null,ball:snapshot().ball
    });
    b06bGoalPending={event,placement};
    return placement;
  }
  function b06bOriginalTakeGoalRestart(frame,event){
    if(disposed||!diagnosticB06bGoalRestartEnabled||
       !b06bGoalPending||b06bGoalPending.event!==event||
       frame?.tick!==tick||tick<=b06bGoalPending.placement.tick||
       frame.players?.length!==22||
       frame.players.some((p,i)=>p?.id!==INITIAL_PLAYERS[i].id||
        p.team!==INITIAL_PLAYERS[i].team||
        ![p.x,p.y,p.vx,p.vy].every(Number.isFinite)))
     throw new TypeError('B06b goal kickoff requires currently pending source-proven goal');
    const team=event.restart.team,id=team+'-10';
    const foot=shoeBridge.snapshot(),solver=shoeBridge.solver();
    if(foot.tick!==tick||solver?.tick!==tick)
      throw new TypeError('B06b goal kick requires current native shoe solver');
    if(foot.started.length!==1||foot.active.length!==1||
       foot.started[0]!==id||foot.active[0]!==id)return null;
    if(!solver.pairs.some(p=>p.id===id&&p.beganThisTick&&
       p.collisionActive&&p.manifolds.some(m=>m.geometricContacts>0)))
     throw new TypeError('B06b rejects goal kick without real shoe manifold');
    const pos=body.translation();
    if(Math.hypot(pos.x,pos.y)>0.65||Math.abs(pos.z-BALL_RADIUS)>0.3)
      throw new TypeError('B06b goal kick must act on original midfield ball');
    const impulse=Object.freeze({x:team==='home'?0.65:-0.65,y:0,z:0.04});
    body.applyImpulse(impulse,true);
    b06bGoalPausedTicks+=tick-b06bGoalPending.placement.tick;
    const take=Object.freeze({
      tick,sourceEventTick:event.tick,team,actorId:id,
      genuineExclusiveOriginalShoeStart:true,
      currentRapierContactManifold:true,
      original22PlayerFrame:true,impulseNs:impulse,
      originalBallImpulseApplied:true,sameOriginalRapierWorld:true,
      officiallyAwardedPossession:false,officialMatchResult:null,
     ball:snapshot().ball
    });
    b06bGoalPending=null;
    return take;
  }
  function b06bOriginalHalftimePlacement(frame){
    if(disposed||diagnosticB06bHalftimeTick===null||
       tick!==diagnosticB06bHalftimeTick+b06bGoalPausedTicks||
       b06bHalftimePlacement||b06bGoalPending||
       !frame||frame.tick!==tick||
       !Array.isArray(frame.players)||frame.players.length!==22||
       frame.players.some((p,i)=>{
        const initial=INITIAL_PLAYERS[i];
        return p?.id!==initial.id||p.team!==initial.team||
         p.role!==initial.role||
         ![p.x,p.y,p.vx,p.vy].every(Number.isFinite);
       }))
     throw new TypeError('B06b halftime requires actual exact physical 60Hz tick and 22 canonical players');
    body.setTranslation({x:0,y:0,z:BALL_RADIUS},true);
    body.setLinvel({x:0,y:0,z:0},true);
    body.setAngvel({x:0,y:0,z:0},true);
    body.resetForces(true);
    body.resetTorques(true);
    b06bHalftimePlacement=Object.freeze({
     physicsTick:tick,phase:'half-time',restartTeam:'away',
     actualOriginalRapierBallPlaced:true,
     realShoesNotFabricated:true,playerTeleports:false,
     source:'private-original-world-native-60hz',
     matchAuthority:false,officialMatchResult:null,
     ball:snapshot().ball
    });
    return b06bHalftimePlacement;
  }
  function b06bOriginalSecondHalfKickoff(frame){
    if(disposed||diagnosticB06bHalftimeTick===null||
       !b06bHalftimePlacement||tick<=b06bHalftimePlacement.physicsTick||
       frame?.tick!==tick||!Array.isArray(frame.players)||
       frame.players.length!==22||
       frame.players.some((p,i)=>{
        const initial=INITIAL_PLAYERS[i];
        return p?.id!==initial.id||p.team!==initial.team||
         p.role!==initial.role||
         ![p.x,p.y,p.vx,p.vy].every(Number.isFinite);
       }))
     throw new TypeError('B06b kickoff requires genuine subsequent original Rapier player tick');
    if(b06bKickoff)return null;
    const foot=shoeBridge.snapshot(),solver=shoeBridge.solver();
    if(foot.tick!==tick||solver?.tick!==tick)
     throw new TypeError('B06b requires real same-tick original shoe solver');
    if(foot.started.length!==1||foot.active.length!==1||
       foot.started[0]!=='away-10'||foot.active[0]!=='away-10')
     return null;
    if(!solver.pairs.some(p=>p.id==='away-10'&&
      p.beganThisTick&&p.collisionActive&&
      p.manifolds.some(m=>m.geometricContacts>0)))
     throw new TypeError('B06b refuses source-free second-half contact');
    const pos=body.translation();
    if(Math.hypot(pos.x,pos.y)>0.65||Math.abs(pos.z-BALL_RADIUS)>0.3)
     throw new TypeError('B06b second-half kick requires the original centre-circle ball');
    const impulse=Object.freeze({x:-0.65,y:0,z:0.04});
    body.applyImpulse(impulse,true);
    b06bKickoff=Object.freeze({
     tick,firstHalfEndPhysicalTick:b06bHalftimePlacement.physicsTick,
     team:'away',actorId:'away-10',
     genuineExclusiveOriginalShoeStart:true,
     currentRapierContactManifold:true,
     original22PlayerFrame:true,
     impulseNs:impulse,originalBallImpulseApplied:true,
     sameRapierWorldAsFirstHalf:true,
     officialMatchAction:false,officialPossession:false,officialMatchResult:null
    });
    return b06bKickoff;
  }
  function dispose() {
    if (!disposed) {
      disposed = true;
      actionExecutor?.dispose();
      shoeBridge?.dispose();
      bodyBridge?.dispose();
      smallBodyGuard?.dispose();
      sharedContactQueue?.free();
      world.free();
    }
  }
  return Object.freeze({scenario, ballProperties, snapshot, angularVelocity, step, dispose,
    ...(diagnosticBasicRestartEnabled?{applyBasicRestartAtBoundary}:{}),
    ...(b05bSource?{attemptB05bNativeOutboundKick,attemptB05bOriginalSetPiece}:{}),
    ...(diagnosticB06bHalftimeTick!==null?{
     b06bOriginalHalftimePlacement,b06bOriginalSecondHalfKickoff,
     ...(diagnosticB06bOpeningKickoffEnabled?{b06bOriginalOpeningKickoff}:{}),
     ...(diagnosticB06bGoalRestartEnabled?{
      b06bOriginalPlaceGoalRestart,b06bOriginalTakeGoalRestart
     }:{})
    }:{}),
    ...(shoeBridge?{
      footContactSnapshot:()=>shoeBridge.snapshot(),
      footContactTimelineSnapshot:()=>shoeBridge.timeline(),
      footContactSolverSnapshot:()=>shoeBridge.solver()
    }:{}),
    ...(sharedContactQueue?{
      sharedNativeContactSnapshot:()=>{
       if(disposed)throw new Error('Engine has been disposed');
       const foot=shoeBridge.snapshot(),physical=bodyBridge.snapshot();
       if(foot.tick!==tick||physical.tick!==tick)
        throw new Error('Only exact-tick shared Rapier contact evidence');
       return Object.freeze({
        tick,oneNativeRapierWorld:true,oneNativeEventQueue:true,
        nativeCollisionEventsLastTick:sharedCollisionEventsLastTick,
        nativeForceEventsLastTick:sharedForceEventsLastTick,
        genuineFootStarts:foot.started,
        genuineBodyStarts:physical.currentTickStarts,
        bodyActivePairs:physical.activePairs,
        officialMatchAction:false,officialTackle:false,
        officialPossession:false,officialResult:null
       });
      }
    }:{}),
    ...(bodyBridge?{
      nativePlayerBodySnapshot:()=>bodyBridge.snapshot(),
      ...((diagnosticResearchBodyEncounter||
           diagnosticUnstagedBodyFeedbackEnabled)?{
       acknowledgeNativePlayerResponse:frame=>
        bodyBridge.acknowledgeCanonicalResponse(frame)
      }:{})
    }:{}),
    ...(smallSided?{
      originalSmallSidedPhysicalShoeIds:()=>shoeBridge.physicalColliderIds,
      ...(smallBodyGuard?{
        smallSidedBodyGuardSnapshot:()=>smallBodyGuard.snapshot(),
        ...(diagnosticSmallSidedBodyFeedbackEnabled?{
         acknowledgeSmallSidedBodyFeedback:frame=>
          smallBodyGuard.acknowledgeCanonicalResponse(frame)
        }:{})
       }:{})
    }:{}),
    ...(actionExecutor?{
      uniformAutonomousActionSnapshot:()=>actionExecutor.actionSnapshot(),
      physicalRejectionAuditSnapshot:()=>actionExecutor.rejectionSnapshot(),
      researchReceivingCushionSnapshot:()=>actionExecutor.cushionSnapshot(),
      researchReceiverChoiceSnapshot:()=>actionExecutor.receiverChoiceSnapshot(),
       researchReceiverTapSnapshot:()=>actionExecutor.receiverTapSnapshot()
    }:{}),
    reset: () => {
    dispose();
    return createEngine(RAPIER, scenario, diagnosticOptions);
  }});
}

export async function initializeRapier(moduleNamespace) {
  const rapier = moduleNamespace?.World ? moduleNamespace : moduleNamespace?.default;
  if (!rapier || typeof rapier.init !== 'function' || typeof rapier.World !== 'function')
    throw new TypeError('Unsupported Rapier module');
  await rapier.init();
  return rapier;
}
