// ME-01: isolated, deterministic 3D physics core. No browser, HTTP, D1 or football-world dependencies.
import {speedDependentDragCd} from './aerodynamics.mjs';
import {magnusLift,MAGNUS_SPIN_LIMIT_RAD_S} from './magnus.mjs';
import {literatureCandidateForces} from './literature-aero-candidate.mjs';
import {INITIAL_PLAYERS} from './player-movement.mjs';
import {initialResearchShotLineup} from './research-shot-initial-lineup.mjs';
import {decideFirstLocalAiKick,FIRST_LOCAL_KICK_PLAYER_ID}
 from './player-ball-first-local-kick.mjs';
import {decideLocalAiPass,decideLocalAiReception,
 LOCAL_PASS_SENDER_ID,LOCAL_PASS_RECEIVER_ID,LOCAL_PASS_RECEIVE_VERSION}
 from './player-ball-local-pass-receive.mjs';
import {LOCAL_EXCHANGE_VERSION,decideLocalAiReturnPass,
 decideLocalAiReturnControl,decideLocalAiThirdPass,
 observeLocalOppositionContact}
 from './player-ball-local-exchange.mjs';
import {beginObservedOppositionFlight,advanceObservedOppositionFlight}
 from './player-ball-opposition-flight.mjs';
import {localDefenderLineup,chooseLocalPassRecipient,decideLocalSelectedPass}
 from './player-ball-local-targeting.mjs';
import {FOOT_CONTACT_VERSION,FOOT_CONTACT_HALF_LENGTH_M,FOOT_CONTACT_HALF_WIDTH_M,
 FOOT_CONTACT_HALF_HEIGHT_M,FOOT_CONTACT_ROUNDING_M,
 FOOT_CONTACT_RESTITUTION,FOOT_CONTACT_RESTITUTION_RANGE,FOOT_CONTACT_FRICTION,
 initialFootPositions,footProxyTransform,validateFootContactFrame}
 from './player-foot-contact.mjs';
import {createFootContactTimeline} from './player-foot-contact-timeline.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION,summarizeFootSolverEvidence}
 from './player-foot-contact-solver.mjs';
import {FOOT_MOMENTUM_AUDIT_VERSION,summarizeFootMomentumAudit}
 from './player-foot-contact-momentum.mjs';
import {createFootContactQualification} from './player-foot-contact-qualification.mjs';
import {selectUniformAutonomousContactAction,
 UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS}
 from './player-ball-uniform-autonomous-action.mjs';
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

// ME-PB-54: private capability for one global ball response in every scene.
// Ordinary core callers cannot opt into non-roll sensitivity via this symbol.
const UNIVERSAL_BALL_CORE_ACCESS=Symbol('universal-ball-core');

// The ONE technical derivation, reused by ME-PB-47 and the candidate
// factory. No independent shoe/grass/club/terrain public knobs.
export function resolveUniversalBallTechnicalParams(response=1){
 if(typeof response!=='number'||!Number.isFinite(response)||
    response<0.75||response>1.25)
  throw new RangeError('One bounded global ball response value required');
 return Object.freeze({
  response,
  footRestitution:FOOT_CONTACT_RESTITUTION*response,
  grassRollDecelerationMps2:GRASS_ROLL_DECELERATION/response,
  footFriction:FOOT_CONTACT_FRICTION
 });
}

// Future-match candidate, still opt-in: all four legal ball scenarios with
// 22 real Rapier shoes and one universal, uncalibrated response scalar.
export function createUniversalBallCoreEngine(RAPIER,scenario,response=1){
 const p=resolveUniversalBallTechnicalParams(response);
 return createEngine(RAPIER,scenario,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticFootRestitution:p.footRestitution,
  diagnosticGrassRollDecelerationMps2:p.grassRollDecelerationMps2,
  [UNIVERSAL_BALL_CORE_ACCESS]:true
 });
}
// A4.2b.1: separate opt-in action CAPABILITY; does not modify the
// accepted ordinary one-scalar ball factory or core physics defaults.
export function createUniformAutonomousBallCoreEngine(
 RAPIER,scenario,response=1,researchShotAttacker=null,
 diagnosticAutonomousCarryEnabled=false
){
 const p=resolveUniversalBallTechnicalParams(response);
 return createEngine(RAPIER,scenario,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticFootRestitution:p.footRestitution,
  diagnosticGrassRollDecelerationMps2:p.grassRollDecelerationMps2,
  diagnosticAutonomousFixtureActionEnabled:true,
  diagnosticAutonomousCarryEnabled,
  diagnosticFixtureShotAttacker:researchShotAttacker,
  [UNIVERSAL_BALL_CORE_ACCESS]:true
 });
}
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
  diagnosticFootRestitution = FOOT_CONTACT_RESTITUTION,
  diagnosticBallCcdEnabled = true,
  diagnosticOmittedFootId = null,
  diagnosticLocalAiKickEnabled = false,
  diagnosticLocalAiPassReceiveEnabled = false,
  diagnosticLocalAiExchangeEnabled = false,
  diagnosticLocalAiOpponentLaneEnabled = false,
  diagnosticLocalAiAutonomousDefenseEnabled = false,
  diagnosticLocalAiThirdPassEnabled = false,
  diagnosticLocalAiFourthPassEnabled = false,
  diagnosticAutonomousFixtureActionEnabled = false,
  diagnosticAutonomousCarryEnabled = false,
  diagnosticFixtureShotAttacker = null,
  [UNIVERSAL_BALL_CORE_ACCESS]: trustedUniversalBallCore = false
} = {}) {
  if (!RAPIER || typeof RAPIER.World !== 'function') throw new TypeError('Rapier 3D required');
  const scenario = normalizeScenario(input);
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
      !trustedUniversalBallCore &&
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
  // Kinematic foot volumes exist ONLY inside an explicitly opted-in DEV collision trial.
  // Default Rapier world construction and its canonical result remain unchanged.
  if(typeof diagnosticPlayerFootContactsEnabled!=='boolean')
    throw new TypeError('Explicit boolean diagnostic player-foot contact switch required');
  if(typeof diagnosticFootRestitution!=='number'||
     !Number.isFinite(diagnosticFootRestitution)||
     diagnosticFootRestitution<FOOT_CONTACT_RESTITUTION_RANGE.min||
     diagnosticFootRestitution>FOOT_CONTACT_RESTITUTION_RANGE.max)
    throw new RangeError('Uncalibrated experimental foot restitution must be bounded');
  if(!diagnosticPlayerFootContactsEnabled&&
     diagnosticFootRestitution!==FOOT_CONTACT_RESTITUTION)
    throw new RangeError('Foot restitution sensitivity requires explicit foot-collider opt-in');
  // ME-PB-13: CCD-off is test-only, only inside opted-in roll/shoe research.
  // Ordinary ball motion and all default settings keep Rapier CCD enabled.
  if(typeof diagnosticBallCcdEnabled!=='boolean')
    throw new TypeError('Explicit boolean ball CCD experiment required');
  if(!diagnosticBallCcdEnabled&&
     (!diagnosticPlayerFootContactsEnabled||scenario.preset!=='roll'))
    throw new RangeError('Disabling ball CCD requires opt-in roll and foot contacts');
  // ME-PB-16: targeted leave-one-shoe-out Rapier counterfactual only.
  // Still validate the same canonical 22-player motion frame each tick.
  // No user-facing switch and no alternate behavior in default physics.
  if(diagnosticOmittedFootId!==null&&(
     typeof diagnosticOmittedFootId!=='string'||
     !INITIAL_PLAYERS.some(p=>p.id===diagnosticOmittedFootId)))
    throw new TypeError('Canonical diagnostic omitted foot ID required');
  if(diagnosticOmittedFootId!==null&&
     (!diagnosticPlayerFootContactsEnabled||scenario.preset!=='roll'))
    throw new RangeError('Foot ablation requires opt-in roll diagnostics');
  // ME-PB-22: only the isolated local roll/foot LAB may create AI kick impulses.
  // The ordinary/official engine never accepts a candidate command to act on.
  if(typeof diagnosticLocalAiKickEnabled!=='boolean')
    throw new TypeError('Explicit boolean local AI kick diagnostic switch required');
  if(diagnosticLocalAiKickEnabled&&(
    !diagnosticPlayerFootContactsEnabled||scenario.preset!=='roll'||
    scenario.z!==0||scenario.vz!==0||diagnosticOmittedFootId!==null))
    throw new RangeError('Local AI kick requires grounded opt-in roll foot contacts');
  // ME-PB-23 is a second, separate disposable DEV-only experiment.
  // Local AI-only trial modes are mutually exclusive and never consume
  // an untrusted scheduler, external candidate or official match action.
  if(typeof diagnosticLocalAiPassReceiveEnabled!=='boolean')
    throw new TypeError('Explicit boolean local AI pass/receive diagnostic switch required');
  if(diagnosticLocalAiPassReceiveEnabled&&(
    !diagnosticPlayerFootContactsEnabled||scenario.preset!=='roll'||
    scenario.z!==0||scenario.vz!==0||diagnosticOmittedFootId!==null||
    diagnosticLocalAiKickEnabled))
    throw new RangeError('Local AI pass/receive requires exclusive grounded roll foot opt-in');
  // ME-PB-24 adds a separate DEV-only physical exchange, not a
  // game/possession mode or an external scheduler.
  if(typeof diagnosticLocalAiExchangeEnabled!=='boolean')
    throw new TypeError('Explicit boolean local AI exchange diagnostic switch required');
  if(diagnosticLocalAiExchangeEnabled&&(
    !diagnosticPlayerFootContactsEnabled||scenario.preset!=='roll'||
    scenario.z!==0||scenario.vz!==0||diagnosticOmittedFootId!==null||
    diagnosticLocalAiKickEnabled||diagnosticLocalAiPassReceiveEnabled))
    throw new RangeError('Local AI exchange requires exclusive grounded roll foot opt-in');
  // ME-PB-25: pre-position an actual Away midfielder as a disposable
  // opponent, consistently at first paint and first Rapier foot transform.
  // Never move an initialized physical body or allow an official roster edit.
  if(typeof diagnosticLocalAiOpponentLaneEnabled!=='boolean')
    throw new TypeError('Explicit boolean local opponent-lane diagnostic switch required');
  if(diagnosticLocalAiOpponentLaneEnabled&&!diagnosticLocalAiExchangeEnabled)
    throw new RangeError('Opponent-lane trial needs opt-in local AI exchange');
  // ME-PB-26 never moves an initial foot collider. The regular formation
  // stays intact; only the opt-in movement planner sees observed ball flight.
  if(typeof diagnosticLocalAiAutonomousDefenseEnabled!=='boolean')
    throw new TypeError('Explicit boolean autonomous lane-defense diagnostic switch required');
  if(diagnosticLocalAiAutonomousDefenseEnabled&&
     (!diagnosticLocalAiExchangeEnabled||diagnosticLocalAiOpponentLaneEnabled))
    throw new RangeError('Autonomous lane defense requires exclusive local AI exchange');
  // ME-PB-34: third shoe-gated pass exists ONLY inside its isolated
  // experimental autonomous research scenario.
  if(typeof diagnosticLocalAiThirdPassEnabled!=='boolean')
    throw new TypeError('Explicit boolean physical third-pass diagnostic switch required');
  if(diagnosticLocalAiThirdPassEnabled&&
     (!diagnosticLocalAiExchangeEnabled||!diagnosticLocalAiAutonomousDefenseEnabled||
      diagnosticLocalAiOpponentLaneEnabled))
    throw new RangeError('Third pass requires autonomous real Rapier exchange');
  if(typeof diagnosticLocalAiFourthPassEnabled!=='boolean')
    throw new TypeError('Explicit boolean fourth physical pass diagnostic switch required');
  if(diagnosticLocalAiFourthPassEnabled&&!diagnosticLocalAiThirdPassEnabled)
    throw new RangeError('Fourth pass requires existing third-pass Rapier opt-in');
  // Do not expose a generic impulse setter or accept untrusted commands.
  // A4.2b must originate from a trusted universal 22-shoe Rapier factory.
  if(typeof diagnosticAutonomousFixtureActionEnabled!=='boolean')
   throw new TypeError('Explicit autonomous action capability boolean required');
  if(diagnosticAutonomousFixtureActionEnabled&&(
     !trustedUniversalBallCore||!diagnosticPlayerFootContactsEnabled||
     diagnosticOmittedFootId!==null||diagnosticLocalAiKickEnabled||
     diagnosticLocalAiPassReceiveEnabled||diagnosticLocalAiExchangeEnabled))
   throw new TypeError('Autonomous actions require exclusive trusted 22-shoe ball core');
  // C3.2a is sealed to the real, autonomously selected 22-shoe fixture.
  // It cannot add impulses to the regular ME-01 engine or the scripted
  // shot-start research option.
  if(typeof diagnosticAutonomousCarryEnabled!=='boolean'||
     (diagnosticAutonomousCarryEnabled&&(
      !diagnosticAutonomousFixtureActionEnabled||
      !trustedUniversalBallCore||
      diagnosticFixtureShotAttacker!==null)))
    throw new TypeError('Real shoe-gated carry requires trusted autonomous fixture');
  if(diagnosticFixtureShotAttacker!==null&&(
    !['home','away'].includes(diagnosticFixtureShotAttacker)||
    !diagnosticAutonomousFixtureActionEnabled||
    !trustedUniversalBallCore||scenario.preset!=='roll'||
    scenario.z!==0||scenario.vz!==0))
   throw new TypeError('Isolated trusted grounded Rapier shot research situation required');
  const diagnosticOptions=Object.freeze({
    diagnosticInitialRollFraction, diagnosticGrassRollDecelerationMps2,
    diagnosticAirDragCd, diagnosticAirDragModel,diagnosticAerodynamicProfile,
    diagnosticMagnusSpinRadS:magnusSpin,
    diagnosticMagnusLiftEnabled,diagnosticSpinDecayRatePerS,
    diagnosticPlayerFootContactsEnabled,diagnosticFootRestitution,
    diagnosticBallCcdEnabled,diagnosticOmittedFootId,diagnosticLocalAiKickEnabled,
    diagnosticLocalAiPassReceiveEnabled,diagnosticLocalAiExchangeEnabled,
    diagnosticLocalAiOpponentLaneEnabled,diagnosticLocalAiAutonomousDefenseEnabled,
    diagnosticLocalAiThirdPassEnabled,diagnosticLocalAiFourthPassEnabled,
    diagnosticAutonomousFixtureActionEnabled,
    diagnosticAutonomousCarryEnabled,diagnosticFixtureShotAttacker,
    [UNIVERSAL_BALL_CORE_ACCESS]:trustedUniversalBallCore
  });
  const world = new RAPIER.World(GRAVITY);
  world.timestep = FIXED_DT;
  // XY = field surface. Physics Z = center height, scenario Z = bottom clearance.
  // The floor top is exactly z=0 and a grounded ball center starts at its radius.
  const ground = RAPIER.ColliderDesc.cuboid(52.5, 34, 0.2)
    .setTranslation(0, 0, -0.2).setFriction(0.65).setRestitution(GROUND_RESTITUTION);
  world.createCollider(ground);
  const desc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(scenario.x, scenario.y, toCenterHeight(scenario.z))
    .setLinvel(scenario.vx, scenario.vy, scenario.vz)
    .setCcdEnabled(diagnosticBallCcdEnabled);
  const body = world.createRigidBody(desc);
  // Mass is NOT density: the old density=0.4 produced only ~2.23 grams.
  // Model the ball as a thin spherical shell for mass moment of inertia,
  // I=(2/3)*m*r². Rapier's physical collider remains an 11cm sphere.
  const ballCollider=world.createCollider(RAPIER.ColliderDesc.ball(BALL_RADIUS)
    .setMassProperties(BALL_MASS_KG,
      {x: 0, y: 0, z: 0},
      {x: BALL_INERTIA_KG_M2, y: BALL_INERTIA_KG_M2, z: BALL_INERTIA_KG_M2},
      {w: 1, x: 0, y: 0, z: 0})
    .setFriction(0.45).setRestitution(BALL_RESTITUTION), body);
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
  // ME-PB-02: actual Rapier kinematic contact volumes, NOT conceptual reach.
  // Each collider follows the corresponding observed autonomous XY position.
  // Experimental only: no extra bodies/colliders/event queue on normal paths.
  const footBodies=[],footColliders=[],footColliderIds=new Map();
  const initialFootActors=diagnosticLocalAiOpponentLaneEnabled?
    localDefenderLineup(INITIAL_PLAYERS):
    diagnosticFixtureShotAttacker?
     initialResearchShotLineup(INITIAL_PLAYERS,diagnosticFixtureShotAttacker,scenario):
     INITIAL_PLAYERS;
  let footPositions=(diagnosticLocalAiOpponentLaneEnabled||
    diagnosticFixtureShotAttacker!==null)?
    Object.freeze(initialFootActors.map(p=>Object.freeze({
      x:p.x,y:p.y,facingRad:p.facingRad}))):
    initialFootPositions(),contactEvents=null;
  const emptyContactIds=Object.freeze([]);
  let activeFootContacts=new Set();
  let footSolverEvidence=Object.freeze({
    version:FOOT_SOLVER_EVIDENCE_VERSION,tick:0,
    pairs:emptyContactIds,reportedForcePairs:0,simultaneousSolverPairs:false
  });
  let footMomentumAudit=Object.freeze({
    version:FOOT_MOMENTUM_AUDIT_VERSION,tick:0,
    ballDeltaLinearMomentumWorldNs:null,ballDeltaLinearMomentumMagnitudeNs:null,
    reportedFootPairImpulseMagnitudesSumNs:0,reportedFootPairCount:0,
    pairs:emptyContactIds,attribution:'unresolved',
    exclusiveFootMomentumTransferProven:false
  });
  const footContactTimeline=diagnosticPlayerFootContactsEnabled?
    createFootContactTimeline():null;
  const footContactQualification=diagnosticPlayerFootContactsEnabled?
    createFootContactQualification():null;
  let footContactState=Object.freeze({
    version:FOOT_CONTACT_VERSION,tick:0,
    started:emptyContactIds,ended:emptyContactIds,active:emptyContactIds,
    onsetBallDeltaVelocityMps:null
  });
  if(diagnosticPlayerFootContactsEnabled){
    contactEvents=new RAPIER.EventQueue(true);
    for(let i=0;i<INITIAL_PLAYERS.length;i++){
      const p=initialFootActors[i];
      if(p.id===diagnosticOmittedFootId){
        footBodies.push(null);footColliders.push(null);
        continue;
      }
      const pose=footProxyTransform(p);
      const foot=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(pose.x,pose.y,pose.z)
        .setRotation(pose.rotation));
      const collider=world.createCollider(
        RAPIER.ColliderDesc.roundCuboid(
          FOOT_CONTACT_HALF_LENGTH_M,FOOT_CONTACT_HALF_WIDTH_M,
          FOOT_CONTACT_HALF_HEIGHT_M,FOOT_CONTACT_ROUNDING_M)
          .setFriction(FOOT_CONTACT_FRICTION)
          .setRestitution(diagnosticFootRestitution)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS|
            RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS),foot);
      footBodies.push(foot);
      footColliders.push(collider);
      footColliderIds.set(collider.handle,p.id);
    }
  }
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
  let localAiKickEvent = null;
  let uniformAutonomousAction=null;
  let lastUniformAutonomousActionTick=-UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS;
  let localAiPassEvent=null,localAiReceptionEvent=null;
  let localAiPassReceiveEvents=Object.freeze([]);
  let localExchangeFirstPass=null,localExchangeReturnPass=null;
  let localExchangeThirdPass=null,localExchangeFourthPass=null;
  let localExchangeOppositionFlightAudit=null;
  let localExchangePostThirdFootStarts=Object.freeze([]);
  let localExchangeFinalControl=null,localExchangeOpponentContact=null;
  let localExchangeEvents=Object.freeze([]);
  let disposed = false;
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
    const beforeMomentum=diagnosticPlayerFootContactsEnabled?snapshot():null;
    if(diagnosticPlayerFootContactsEnabled){
      // Reject forged identities, gaps, teleports and stale data BEFORE Rapier mutation.
      const next=validateFootContactFrame(playerFrame,tick+1,footPositions);
      for(let i=0;i<next.length;i++){
        if(footBodies[i]===null)continue;
        const pose=footProxyTransform(next[i]);
        footBodies[i].setNextKinematicTranslation({
          x:pose.x,y:pose.y,z:pose.z
        });
        footBodies[i].setNextKinematicRotation(pose.rotation);
      }
      footPositions=next;
    }else if(playerFrame!==undefined){
      throw new TypeError('Foot frames are not allowed without diagnostic opt-in');
    }
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
    let observedSolverFlight=null; // ME-PB-36 read-only solver velocity pair.
    if(diagnosticPlayerFootContactsEnabled){
      const preStepBallPosition=body.translation();
      const preStepBallVelocity=body.linvel();
      world.step(contactEvents);
      const postStepBallVelocity=body.linvel();
      if(diagnosticLocalAiExchangeEnabled)
        observedSolverFlight=Object.freeze({
          before:Object.freeze({...preStepBallVelocity}),
          after:Object.freeze({...postStepBallVelocity})
        });
      const started=[],ended=[];
      contactEvents.drainCollisionEvents((a,b,began)=>{
        const other=a===ballCollider.handle?b:
          b===ballCollider.handle?a:null;
        const id=footColliderIds.get(other);
        if(!id)return; // Exclude proxy/proxy contacts and floor.
        if(began){activeFootContacts.add(id);started.push(id);}
        else{activeFootContacts.delete(id);ended.push(id);}
      });
      const canonical=ids=>Object.freeze(INITIAL_PLAYERS.filter(p=>
        ids.has(p.id)).map(p=>p.id));
      footContactState=Object.freeze({
        version:FOOT_CONTACT_VERSION,tick:tick+1,
        started:canonical(new Set(started)),
        ended:canonical(new Set(ended)),
        active:canonical(activeFootContacts),
        // Total measured ball Δv across Rapier's 60Hz solver step, NOT an
        // individual-player impulse, calibrated kick strength or attribution.
        // Gravity and all other contacts contribute; only report on onset.
        onsetBallDeltaVelocityMps:started.length?
          Math.hypot(
            postStepBallVelocity.x-preStepBallVelocity.x,
            postStepBallVelocity.y-preStepBallVelocity.y,
            postStepBallVelocity.z-preStepBallVelocity.z
          ):null
      });
      // Rapier events alone drive duration and planar incoming-motion evidence;
      // this observer never mutates ball physics, player positions or ownership.
      footContactTimeline.observe(footContactState,{
        position:preStepBallPosition,velocity:preStepBallVelocity
      },footPositions);
      // ME-PB-06: use Rapier's REAL aggregate pair-force events, not
      // geometric per-contact impulses (which can miss solver clustering).
      // Keep the post-step manifold world normals separate from force reports.
      const forceReports=[];
      contactEvents.drainContactForceEvents(event=>{
        const a=event.collider1(),b=event.collider2();
        const other=a===ballCollider.handle?b:
          b===ballCollider.handle?a:null;
        const id=footColliderIds.get(other);
        if(!id)return; // Never attribute turf or foot-to-foot pairs.
        const totalForce=event.totalForce();
        const maxDirection=event.maxForceDirection();
        forceReports.push({
          id,totalForceWorldN:{
            x:totalForce.x,y:totalForce.y,z:totalForce.z
          },
          totalForceMagnitudeN:event.totalForceMagnitude(),
          maxContactForceMagnitudeN:event.maxForceMagnitude(),
          maxContactForceDirectionWorld:{
            x:maxDirection.x,y:maxDirection.y,z:maxDirection.z
          }
        });
      });
      const relevant=new Set([
        ...footContactState.active,...footContactState.started,
        ...footContactState.ended,...forceReports.map(r=>r.id)
      ]);
      const manifoldReports=[];
      for(let i=0;i<INITIAL_PLAYERS.length;i++){
        const id=INITIAL_PLAYERS[i].id;
        if(!relevant.has(id)||footColliders[i]===null)continue;
        world.contactPair(ballCollider,footColliders[i],(m,flipped)=>{
          const geometricContacts=m.numContacts(),solverContacts=m.numSolverContacts();
          if(geometricContacts===0&&solverContacts===0)return;
          const normal=m.normal(); // Rapier world manifold orientation.
          manifoldReports.push({
            id,flipped,normalWorld:{x:normal.x,y:normal.y,z:normal.z},
            geometricContacts,solverContacts
          });
        });
      }
      footSolverEvidence=summarizeFootSolverEvidence(
        footContactState,forceReports,manifoldReports);
    }else world.step();
    // Exponential airborne-only decay after integration; zero rate preserves
    // the original physics-v4 path without any angular-velocity setter.
    if(diagnosticSpinDecayRatePerS>0 &&
       body.translation().z>BALL_RADIUS+0.02){
      const a=body.angvel(),ratio=Math.exp(-diagnosticSpinDecayRatePerS*FIXED_DT);
      body.setAngvel({x:a.x*ratio,y:a.y*ratio,z:a.z*ratio},true);
    }
    applyGrassRollingResistance();
    tick += 1;
    const current=snapshot();
    // Audit only after all recorded ball forces, the solver and grass updates.
    // Neither its vectors nor per-pair forces are allowed to steer physics.
    if(diagnosticPlayerFootContactsEnabled){
      footMomentumAudit=summarizeFootMomentumAudit(
        beforeMomentum,current,footSolverEvidence,ballProperties.massKg);
      // Diagnostic event labels are read-only; they cannot change Rapier state.
      footContactQualification.observe(footContactTimeline.snapshot(),
        footSolverEvidence,footMomentumAudit);
    }
    // An actual recorded Rapier START triggers the LOCAL deterministic AI
    // intent, not an untrusted ME-PB-18 proposal. The impulse is applied to
    // the real Rapier ball once, AFTER contact/solver audits, so those audits
    // remain solver-only measurements rather than fake foot-force evidence.
    // The post-impulse canonical snapshot is returned to the LAB immediately.
    if(diagnosticLocalAiKickEnabled&&!localAiKickEvent){
      const actor=playerFrame.players.find(p=>p.id===FIRST_LOCAL_KICK_PLAYER_ID);
      const decision=decideFirstLocalAiKick({
        tick,contactStarted:footContactState.started,
        player:actor,ballPosition:body.translation(),
        ballRadiusM:BALL_RADIUS,alreadyApplied:false
      });
      if(decision){
        body.applyImpulse(decision.impulseNs,true);
        localAiKickEvent=Object.freeze({...decision,
          appliedByRealRapier:true,actionSource:'built-in-deterministic-local-ai'});
      }
    }
    // ME-PB-23: two actual, separated Rapier-grounded football actions.
    // Sender Home #7 passes only after its real shoe START. Receiver
    // Home #10 traps only after a *later* independent real shoe START.
    // These impulses execute AFTER solver contact/force diagnostics, so
    // the known AI action cannot contaminate reported foot impulse evidence.
    if(diagnosticLocalAiPassReceiveEnabled&&!localAiReceptionEvent){
      const find=id=>playerFrame.players.find(p=>p.id===id);
      let decision;
      if(!localAiPassEvent){
        decision=decideLocalAiPass({
          tick,contactStarted:footContactState.started,
          passer:find(LOCAL_PASS_SENDER_ID),
          receiver:find(LOCAL_PASS_RECEIVER_ID),
          ballPosition:body.translation(),ballRadiusM:BALL_RADIUS
        });
      }else{
        decision=decideLocalAiReception({
          tick,contactStarted:footContactState.started,
          passEvent:localAiPassEvent,
          receiver:find(LOCAL_PASS_RECEIVER_ID),
          ballPosition:body.translation(),ballVelocity:body.linvel(),
          ballRadiusM:BALL_RADIUS,ballMassKg:ballProperties.massKg
        });
      }
      if(decision){
        body.applyImpulse(decision.impulseNs,true);
        const recorded=Object.freeze({...decision,
          appliedByRealRapier:true});
        if(decision.stage==='pass')localAiPassEvent=recorded;
        else localAiReceptionEvent=recorded;
        localAiPassReceiveEvents=Object.freeze([...localAiPassReceiveEvents,recorded]);
      }
    }
    // ME-PB-24: local-only first/return passes. The return needs a
    // *distinct* true Rapier START by the receiver; a final Home #7
    // reception is reported only on another later genuine shoe START.
    // Any real Away shoe START while the pass is underway stops the
    // attempted exchange, without inventing an opponent possession.
    if(diagnosticLocalAiExchangeEnabled&&
       !localExchangeFinalControl&&!localExchangeOpponentContact&&
       (!localExchangeThirdPass||diagnosticLocalAiFourthPassEnabled)&&
       !localExchangeFourthPass){
      const find=id=>playerFrame.players.find(p=>p.id===id);
      const ballPosition=body.translation(),ballVelocity=body.linvel();
      const phase=localExchangeThirdPass?'third':
        localExchangeReturnPass?'return':'outbound';
      if(localExchangeFirstPass){
        const opponent=observeLocalOppositionContact({
          tick,contactStarted:footContactState.started,
          players:playerFrame.players,ballPosition,ballRadiusM:BALL_RADIUS,phase
        });
        if(opponent){
          // ME-PB-36: a verified shoe START is NOT automatically a
          // pass interruption, defender ownership or an interception.
          // Only observe the already integrated solver before/after
          // velocity and the most recent ACTUALLY applied real pass.
          const lastPhysicalPass=localExchangeEvents.filter(e=>
            (e.stage==='pass'||e.stage==='return-pass')&&
            e.appliedByRealRapier===true).at(-1)??null;
          localExchangeOppositionFlightAudit=beginObservedOppositionFlight({
            contact:opponent,contactFrame:footContactState,
            passEvent:lastPhysicalPass,
            preSolverVelocity:observedSolverFlight.before,
            postSolverVelocity:observedSolverFlight.after,tick
          });
          localExchangeOpponentContact=opponent;
          localExchangeEvents=Object.freeze([...localExchangeEvents,opponent]);
        }
      }
      if(!localExchangeOpponentContact){
        let action=null;
        if(!localExchangeFirstPass){
          const selected=chooseLocalPassRecipient({
            passer:find(LOCAL_PASS_SENDER_ID),players:playerFrame.players
          });
          action=decideLocalSelectedPass({
            tick,contactStarted:footContactState.started,
            passer:find(LOCAL_PASS_SENDER_ID),
            ballPosition,ballRadiusM:BALL_RADIUS,selection:selected
          });
        }else if(!localExchangeReturnPass){
          action=decideLocalAiReturnPass({
            tick,contactStarted:footContactState.started,
            firstPass:localExchangeFirstPass,
            player:find(localExchangeFirstPass.targetPlayerId),
            teammate:find(LOCAL_PASS_SENDER_ID),
            ballPosition,ballVelocity,ballRadiusM:BALL_RADIUS,
            ballMassKg:ballProperties.massKg
          });
        }else if(diagnosticLocalAiFourthPassEnabled&&localExchangeThirdPass){
          // The real fourth kick is another Home #10 foot START in the
          // same world. Reuse the measured, guarded return-pass decision,
          // now linked to the genuinely executed THIRD Home #7 impulse.
          action=decideLocalAiReturnPass({
            tick,contactStarted:footContactState.started,
            firstPass:localExchangeThirdPass,
            player:find('home-10'),teammate:find(LOCAL_PASS_SENDER_ID),
            ballPosition,ballVelocity,ballRadiusM:BALL_RADIUS,
            ballMassKg:ballProperties.massKg
          });
        }else if(diagnosticLocalAiThirdPassEnabled){
          action=decideLocalAiThirdPass({
            tick,contactStarted:footContactState.started,
            firstPass:localExchangeFirstPass,
            returnPass:localExchangeReturnPass,
            player:find(LOCAL_PASS_SENDER_ID),
            teammate:find('home-10'),ballPosition,ballVelocity,
            ballRadiusM:BALL_RADIUS,ballMassKg:ballProperties.massKg
          });
        }else{
          action=decideLocalAiReturnControl({
            tick,contactStarted:footContactState.started,
            returnPass:localExchangeReturnPass,
            player:find(LOCAL_PASS_SENDER_ID),ballPosition,ballVelocity,
            ballRadiusM:BALL_RADIUS,ballMassKg:ballProperties.massKg
          });
        }
        if(action){
          body.applyImpulse(action.impulseNs,true);
          const recorded=Object.freeze({...action,
            appliedByRealRapier:true});
          if(!localExchangeFirstPass)localExchangeFirstPass=recorded;
          else if(!localExchangeReturnPass)localExchangeReturnPass=recorded;
          else if(diagnosticLocalAiThirdPassEnabled&&!localExchangeThirdPass)
            localExchangeThirdPass=recorded;
          else if(diagnosticLocalAiFourthPassEnabled)localExchangeFourthPass=recorded;
          else localExchangeFinalControl=recorded;
          localExchangeEvents=Object.freeze([...localExchangeEvents,recorded]);
        }
      }
      if(diagnosticLocalAiFourthPassEnabled&&localExchangeThirdPass&&
         tick>localExchangeThirdPass.tick&&
         footContactState.started.length&&
         localExchangePostThirdFootStarts.length<12){
        // Read-only contact vs actual pass evidence. A shoe START (or
        // a ball rebound) alone NEVER becomes an applied pass event.
        const appliedFourth=localExchangeFourthPass?.tick===tick;
        localExchangePostThirdFootStarts=Object.freeze([
          ...localExchangePostThirdFootStarts,
          ...footContactState.started.slice(0,12-localExchangePostThirdFootStarts.length)
           .map(id=>Object.freeze({
             tick,playerId:id,realRapierStart:true,
             fourthPassApplied:appliedFourth&&id==='home-10',
             countedAsPass:appliedFourth&&id==='home-10',
             inferredPossession:false
           }))
        ]);
      }
    }
    // ME-PB-36 follow-up uses only subsequent completed REAL Rapier
    // velocities; three consecutive material changes are required.
    // The exchange stays stopped as before; this never steers the ball.
    if(diagnosticLocalAiExchangeEnabled&&
       localExchangeOppositionFlightAudit&&
       tick>localExchangeOppositionFlightAudit.contactTick&&
       localExchangeOppositionFlightAudit.status==='observing')
      localExchangeOppositionFlightAudit=advanceObservedOppositionFlight({
        audit:localExchangeOppositionFlightAudit,
        velocity:body.linvel(),tick
      });
    // ME-PB-55 / A4.2b.1: local, closed, GENERIC 22-player physical actions.
    // The player/tick must originate from the verified mover and a genuine
    // Rapier collision START. Apply the selected uniform action on this SAME
    // Rapier body, only after collision/force audits. No possession/goal/score.
    if(diagnosticAutonomousFixtureActionEnabled){
      const decision=selectUniformAutonomousContactAction({
       tick,contactStarted:footContactState.started,
       contactActive:footContactState.active,
       playerFrame,ballPosition:body.translation(),ballVelocity:body.linvel(),
       ballRadiusM:BALL_RADIUS,
       lastActionTick:lastUniformAutonomousActionTick,
       allowPhysicalCarry:diagnosticAutonomousCarryEnabled
      });
      if(decision){
       body.applyImpulse(decision.impulseNs,true);
       lastUniformAutonomousActionTick=tick;
       uniformAutonomousAction=Object.freeze({
        ...decision,appliedByRapier:true,
        actionSource:'internal-uniform-22-player-ai',
        actualPhysicsImpulseApplied:true
       });
      }
    }
    return diagnosticAutonomousFixtureActionEnabled||
      diagnosticLocalAiKickEnabled||diagnosticLocalAiPassReceiveEnabled||
      diagnosticLocalAiExchangeEnabled?snapshot():current;
  }
  function dispose() {
    if (!disposed) {
      disposed = true;
      if(contactEvents)contactEvents.free();
      world.free();
    }
  }
  return Object.freeze({scenario, ballProperties, snapshot, angularVelocity, step, dispose,
    ...(diagnosticPlayerFootContactsEnabled?{
      footContactSnapshot:()=>footContactState,
      footContactTimelineSnapshot:()=>footContactTimeline.snapshot(),
      footContactSolverSnapshot:()=>footSolverEvidence,
      footContactMomentumAuditSnapshot:()=>footMomentumAudit,
      footContactQualificationSnapshot:()=>footContactQualification.snapshot()
    }:{}),
    ...(diagnosticAutonomousFixtureActionEnabled?{
      uniformAutonomousActionSnapshot:()=>uniformAutonomousAction
    }:{}),
    ...(diagnosticLocalAiKickEnabled?{localAiKickSnapshot:()=>localAiKickEvent}:{}),
    ...(diagnosticLocalAiPassReceiveEnabled?{
      localAiPassReceiveSnapshot:()=>Object.freeze({
        version:LOCAL_PASS_RECEIVE_VERSION,pass:localAiPassEvent,
        control:localAiReceptionEvent,events:localAiPassReceiveEvents,
        possessionInferred:false,officialMatchAction:false
      })
    }:{}),
    ...(diagnosticLocalAiExchangeEnabled?{
      localAiExchangeSnapshot:()=>Object.freeze({
        version:LOCAL_EXCHANGE_VERSION,pass:localExchangeFirstPass,
        selectedRecipientId:localExchangeFirstPass?.targetPlayerId??null,
        opponentLanePrepositioned:diagnosticLocalAiOpponentLaneEnabled,
        autonomousDefenderFromDefaultFormation:diagnosticLocalAiAutonomousDefenseEnabled,
        returnPass:localExchangeReturnPass,thirdPass:localExchangeThirdPass,
        fourthPass:localExchangeFourthPass,
        postThirdFootStarts:localExchangePostThirdFootStarts,
        finalControl:localExchangeFinalControl,
        oppositionContact:localExchangeOpponentContact,
        oppositionFlightAudit:localExchangeOppositionFlightAudit,
        events:localExchangeEvents,
        physicalExchangeCompleted:Boolean(localExchangeFinalControl||
          localExchangeThirdPass),
        opponentContactObserved:Boolean(localExchangeOpponentContact),
        inferredPossession:false,officialMatchAction:false
      })
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
