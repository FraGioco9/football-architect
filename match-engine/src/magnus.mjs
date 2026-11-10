// ME-PHYS-09 — isolated spin/lift research proxy. No gameplay aerodynamics.
// Real footballs show dependence on speed, spin, panel geometry and Reynolds number;
// negative Magnus is also reported in some regimes. A linear capped coefficient
// is a controlled sensitivity model, NOT a measured universal soccer-ball Cl.
// NASA: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-of-a-soccer-ball/
// Measurements: https://www.mdpi.com/2504-3900/49/1/88
export const MAGNUS_SPIN_RPS = 6;
export const MAGNUS_SPIN_RAD_S = MAGNUS_SPIN_RPS * 2 * Math.PI;
export const MAGNUS_SPIN_LIMIT_RAD_S = 80;
export const MAGNUS_CL_SLOPE = 0.6; // hypothesis, not an experimental fit
export const MAGNUS_CL_CAP = 0.25; // illustrative safety cap
export const MAGNUS_SOURCE = 'https://www.mdpi.com/2504-3900/49/1/88';

// Axis policy: +X forward, +Y across the field, +Z up.
// F_M points along omega x velocity. Thus +Z spin bends toward +Y;
// +Y spin generates downward force (topspin) for a +X shot.
export function magnusLift(velocity, angularVelocity, {
  radiusM = 0.11, densityKgM3 = 1.225, areaM2 = Math.PI * radiusM ** 2
} = {}) {
  const axes = ['x','y','z'];
  for (const vec of [velocity,angularVelocity]) {
    if (!vec || axes.some(axis=>typeof vec[axis]!=='number' || !Number.isFinite(vec[axis])))
      throw new TypeError('Invalid Magnus velocity vector');
  }
  const speed = Math.hypot(velocity.x,velocity.y,velocity.z);
  const spin = Math.hypot(angularVelocity.x,angularVelocity.y,angularVelocity.z);
  if (!(speed > 1e-8) || !(spin > 1e-8))
    return Object.freeze({force:Object.freeze({x:0,y:0,z:0}),
      spinParameter:0, liftCoefficient:0, magnitudeN:0});
  const cross={
    x: angularVelocity.y*velocity.z-angularVelocity.z*velocity.y,
    y: angularVelocity.z*velocity.x-angularVelocity.x*velocity.z,
    z: angularVelocity.x*velocity.y-angularVelocity.y*velocity.x
  };
  const crossMagnitude=Math.hypot(cross.x,cross.y,cross.z);
  if (!(crossMagnitude > 1e-8))
    return Object.freeze({force:Object.freeze({x:0,y:0,z:0}),
      spinParameter:0, liftCoefficient:0, magnitudeN:0});
  const perpendicularSpin=crossMagnitude/speed;
  const spinParameter=radiusM*perpendicularSpin/speed;
  const liftCoefficient=Math.min(MAGNUS_CL_CAP,MAGNUS_CL_SLOPE*spinParameter);
  const magnitudeN=0.5*densityKgM3*areaM2*liftCoefficient*speed*speed;
  return Object.freeze({
    force:Object.freeze({
      x:magnitudeN*cross.x/crossMagnitude,
      y:magnitudeN*cross.y/crossMagnitude,
      z:magnitudeN*cross.z/crossMagnitude
    }),
    spinParameter,liftCoefficient,magnitudeN
  });
}
