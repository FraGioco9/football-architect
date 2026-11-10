// ME-01: isolated, deterministic 3D physics core. No browser, HTTP, D1 or football-world dependencies.
import {speedDependentDragCd} from './aerodynamics.mjs';
import {magnusLift,MAGNUS_SPIN_LIMIT_RAD_S} from './magnus.mjs';
import {literatureCandidateForces} from './literature-aero-candidate.mjs';
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
  diagnosticSpinDecayRatePerS = 0
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
    diagnosticMagnusLiftEnabled,diagnosticSpinDecayRatePerS
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
    .setCcdEnabled(true);
  const body = world.createRigidBody(desc);
  // Mass is NOT density: the old density=0.4 produced only ~2.23 grams.
  // Model the ball as a thin spherical shell for mass moment of inertia,
  // I=(2/3)*m*r². Rapier's physical collider remains an 11cm sphere.
  world.createCollider(RAPIER.ColliderDesc.ball(BALL_RADIUS)
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
  function step() {
    if (disposed) throw new Error('Engine has been disposed');
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
    world.step();
    // Exponential airborne-only decay after integration; zero rate preserves
    // the original physics-v4 path without any angular-velocity setter.
    if(diagnosticSpinDecayRatePerS>0 &&
       body.translation().z>BALL_RADIUS+0.02){
      const a=body.angvel(),ratio=Math.exp(-diagnosticSpinDecayRatePerS*FIXED_DT);
      body.setAngvel({x:a.x*ratio,y:a.y*ratio,z:a.z*ratio},true);
    }
    applyGrassRollingResistance();
    tick += 1;
    return snapshot();
  }
  function dispose() {
    if (!disposed) {
      disposed = true;
      world.free();
    }
  }
  return Object.freeze({scenario, ballProperties, snapshot, angularVelocity, step, dispose, reset: () => {
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
