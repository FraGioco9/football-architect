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
