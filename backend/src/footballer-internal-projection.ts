/**
 * Persistable fictional-footballer data projection. No direct public API.
 *
 * Explicit allowlist: never serialize generator/audit objects or database rows
 * wholesale. Keep gameplay state, not how the player was sampled or calibrated.
 * Authentication and access control remain required when this DTO is stored.
 */
export const FOOTBALLER_ATTRIBUTE_KEYS = Object.freeze([
 'speed','strength','stamina','agility','passing','technique','dribbling',
 'shooting','crossing','tackling','marking','heading','vision','positioning',
 'decisions','composure','gk_reflexes','gk_handling','gk_positioning','gk_aerial'
] as const);
export type FootballerAttribute = typeof FOOTBALLER_ATTRIBUTE_KEYS[number];
export type FootballerAttributes = Readonly<Record<FootballerAttribute,number>>;
export interface InternalFootballerRecord {
 readonly first_name: string;
 readonly last_name: string;
 readonly nationality: string;
 readonly secondary_nationality: string|null;
 readonly initial_age: number;
 readonly height_cm: number;
 readonly preferred_foot: 'left'|'right';
 readonly primary_position: string;
 readonly secondary_positions: readonly string[];
 readonly attributes: FootballerAttributes;
 readonly development_aptitude: number;
 readonly career_status: string;
}
const footballerPositions=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
function object(x:unknown,field:string):Record<string,unknown>{
 if(x===null||typeof x!=='object'||Array.isArray(x))throw new TypeError('invalid_'+field);
 return x as Record<string,unknown>;
}
function text(x:unknown,field:string):string{
 if(typeof x!=='string'||!x||x.trim()!==x||x!==x.normalize('NFC'))
  throw new TypeError('invalid_'+field);
 return x;
}
function count(x:unknown,field:string,min:number,max:number):number{
 if(typeof x!=='number'||!Number.isSafeInteger(x)||x<min||x>max)
  throw new TypeError('invalid_'+field);
 return x;
}
function position(x:unknown,field:string):string{
 const value=text(x,field);
 if(!footballerPositions.has(value))throw new TypeError('invalid_'+field);
 return value;
}
export function projectInternalFootballerRecord(player:unknown):InternalFootballerRecord{
 const p=object(player,'footballer');
 const positions=p.secondary_positions;
 if(!Array.isArray(positions))throw new TypeError('invalid_secondary_positions');
 const secondaries=positions.map((v:unknown)=>position(v,'secondary_position'));
 const primary=position(p.primary_position,'primary_position');
 if(new Set(secondaries).size!==secondaries.length||secondaries.includes(primary))
  throw new TypeError('invalid_secondary_positions');
 const preferred=p.preferred_foot;
 if(preferred!=='left'&&preferred!=='right')
  throw new TypeError('invalid_preferred_foot');
 const rawAttributes=object(p.attributes,'attributes');
 const attributes={} as Record<FootballerAttribute,number>;
 for(const key of FOOTBALLER_ATTRIBUTE_KEYS)
  attributes[key]=count(rawAttributes[key],key,1,99);
 // No object spread from the source record, not even within attributes.
 return Object.freeze({
  first_name:text(p.first_name,'first_name'),
  last_name:text(p.last_name,'last_name'),
  nationality:text(p.nationality,'nationality'),
  secondary_nationality:p.secondary_nationality===null||p.secondary_nationality===undefined?
   null:text(p.secondary_nationality,'secondary_nationality'),
  initial_age:count(p.initial_age,'initial_age',0,120),
  height_cm:count(p.height_cm,'height_cm',1,300),
  preferred_foot:preferred,
  primary_position:primary,
  secondary_positions:Object.freeze(secondaries),
  attributes:Object.freeze(attributes) as FootballerAttributes,
  development_aptitude:count(p.development_aptitude,'development_aptitude',1,99),
  career_status:text(p.career_status,'career_status')
 });
}
