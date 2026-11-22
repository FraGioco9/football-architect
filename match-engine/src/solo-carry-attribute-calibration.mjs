// #628 — DEV-only Carry calibration from actual player attribute field names.
// Public generator uses integer 1..99; these four relevant source attributes
// are all this isolated research LAB consumes. No synthetic overall rating,
// no database access, no official match movement override.
export const SOLO_CARRY_ATTRIBUTE_KEYS=Object.freeze([
 'speed','agility','dribbling','technique'
]);
export const SOLO_CARRY_LAB_LEVELS=Object.freeze([25,50,75,90]);
export function validateSoloCarryAttributes(attributes){
 if(!attributes||typeof attributes!=='object'||Array.isArray(attributes))
  throw new TypeError('Solo Carry requires player attributes');
 const selected={};
 for(const key of SOLO_CARRY_ATTRIBUTE_KEYS){
  const rating=attributes[key];
  if(!Number.isInteger(rating)||rating<1||rating>99)
   throw new RangeError('Solo Carry '+key+' must be an integer 1..99');
  selected[key]=rating;
 }
 return Object.freeze(selected);
}
export function uniformSoloCarryAttributes(rating){
 if(!SOLO_CARRY_LAB_LEVELS.includes(rating))
  throw new RangeError('Only 25, 50, 75, 90 synthetic LAB profiles supported');
 return validateSoloCarryAttributes(Object.fromEntries(
  SOLO_CARRY_ATTRIBUTE_KEYS.map(key=>[key,rating])
 ));
}
const relative=rating=>(rating-50)/50;
// Physically bounded, monotonic research hypotheses, NOT verified player
// benchmarks. Rating 50 yields exactly the accepted previous DEV baseline.
export function calibrateSoloCarryKinematics(base,attributes){
 const a=validateSoloCarryAttributes(attributes);
 const speed=relative(a.speed),agility=relative(a.agility);
 const dribble=relative(a.dribbling),technique=relative(a.technique);
 return Object.freeze({
  maxSpeedMps:Math.min(7,base.maxSpeedMps*
   (1+0.27*speed+0.04*agility)),
  accelerationMps2:base.accelerationMps2*
   (1+0.12*speed+0.26*agility),
  brakingMps2:base.brakingMps2*(1+0.20*agility),
  ballTargetOffsetM:base.ballTargetOffsetM+
   0.06*dribble+0.02*technique
 });
}
export function calibrateSoloCarryTouch(base,attributes){
 const a=validateSoloCarryAttributes(attributes);
 const speed=relative(a.speed),dribble=relative(a.dribbling);
 const technique=relative(a.technique);
 // Better technique permits a slightly longer interval between well-paced
 // touches, with Sprint still less frequent than Moderate at every rating.
 return Object.freeze({
  spacingTicks:Math.max(24,Math.round(base.spacingTicks*
   (1+0.08*dribble+0.05*technique))),
  targetSpeedMps:base.targetSpeedMps*
   (1+0.18*speed+0.12*dribble+0.06*technique),
  maxImpulseNs:base.maxImpulseNs*
   (1+0.20*speed+0.12*dribble+0.05*technique)
 });
}
