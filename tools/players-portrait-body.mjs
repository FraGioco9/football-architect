/** Deterministic visual build based only on four PUBLIC athletic attributes.
 * Body description is deliberately subtle: player ability is not body size.
 * Age, height, position and development aptitude never affect this module.
 */
const ARCHETYPES=Object.freeze({
 'lean':'A naturally slim footballer build with a relatively narrow upper body and relaxed, modestly developed arms.',
 'lean-athletic':'A lean footballer build with gentle athletic definition and proportionate shoulders and arms.',
 'balanced-athletic':'A balanced footballer build with average athletic shoulders, torso and arms, without pronounced bulk.',
 'power-athletic':'A slightly sturdier footballer build, with modestly broader shoulders and somewhat fuller arms, never bulky.'
});
const CONDITIONING=Object.freeze({
 subtle:'Keep muscle definition understated and natural.',
 natural:'Show natural, moderate football-trained muscle tone without pronounced definition.',
 endurance:'Use slightly clearer but still subtle muscle tone, without increasing bulk or implying a different physique.'
});
export const BODY_ARCHETYPES=Object.freeze(Object.keys(ARCHETYPES));
export const BODY_CONDITIONING=Object.freeze(Object.keys(CONDITIONING));

export function classifyAthleticBody(attributes){
 if(!attributes||typeof attributes!=='object'||Array.isArray(attributes))throw new TypeError('missing_athletic_attributes');
 for(const key of ['strength','speed','stamina','agility']){
  const value=attributes[key];
  if(!Number.isInteger(value)||value<1||value>99)throw new TypeError('invalid_athletic_'+key);
 }
 const mobility=(attributes.speed+attributes.agility)/2;
 const strength=attributes.strength;
 let body_profile='balanced-athletic';
 if(strength>=72&&strength-mobility>=8)body_profile='power-athletic';
 else if(mobility>=72&&strength<=47)body_profile='lean';
 else if(mobility>=67&&strength<72)body_profile='lean-athletic';
 const body_conditioning=attributes.stamina>=75?'endurance':attributes.stamina<=34?'subtle':'natural';
 return Object.freeze({body_profile,body_conditioning});
}

export function describeAthleticBody(entry){
 if(!entry||!Object.hasOwn(ARCHETYPES,entry.body_profile)||!Object.hasOwn(CONDITIONING,entry.body_conditioning))
  throw new TypeError('invalid_body_profile');
 return `${ARCHETYPES[entry.body_profile]} ${CONDITIONING[entry.body_conditioning]} `+
  `Every build remains a plausible lean-to-moderate footballer physique, not a bodybuilder, fitness model or caricature.`;
}
