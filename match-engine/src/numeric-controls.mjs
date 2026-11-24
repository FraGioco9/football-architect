// Numeric controls in the ME-01 DEV laboratory. Physics inputs remain full-precision
// numbers; only the editable display is normalized to two decimal places.
export const NUMERIC_BOUNDS = Object.freeze({
  x: Object.freeze([-48,48]),
  y: Object.freeze([-30,30]),
  z: Object.freeze([0,30]),
  vx: Object.freeze([-60,60]),
  vy: Object.freeze([-60,60]),
  vz: Object.freeze([-60,60])
});

function numericValue(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (String(value).trim() === '') return null;
  const number=Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatNumericValue(value) {
  const n=numericValue(value);
  return n===null ? null : (Object.is(n,-0) ? 0 : n).toFixed(2);
}

// Return null when the requested exact 1-unit step would cross a hard boundary.
// A fractional input (e.g. 3.25) must become 4.25, never snap to the integer grid.
export function stepNumericValue(field, value, direction) {
  const bounds=NUMERIC_BOUNDS[field];
  if (!bounds || (direction!==1 && direction!==-1)) throw new TypeError('Invalid numeric step');
  const current=numericValue(value);
  if (current===null || current<bounds[0] || current>bounds[1]) return null;
  const next=current+direction;
  if (next<bounds[0]-1e-9 || next>bounds[1]+1e-9) return null;
  return formatNumericValue(next);
}

// DEV UI display only: SI physics, private impulses and public API remain m/s.
export const SPEED_KMH_PER_MPS=3.6;
export function speedToKmh(speedMps){
 if(typeof speedMps!=='number'||!Number.isFinite(speedMps))
  throw new TypeError('Finite physical speed in m/s required');
 return speedMps*SPEED_KMH_PER_MPS;
}
export function speedFromKmh(speedKmh){
 if(typeof speedKmh!=='number'||!Number.isFinite(speedKmh))
  throw new TypeError('Finite display speed in km/h required');
 return speedKmh/SPEED_KMH_PER_MPS;
}
