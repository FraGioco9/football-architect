/**
 * Server-only footballer wire projections.
 *
 * Internal generation records may contain unpublished abilities, aptitude,
 * seed/replay metadata and future private fields. This module constructs
 * NEW public objects by explicit allowlist, never by spreading player data.
 * Directory records have a separate approved explicit public allowlist.
 */
export interface InternalFootballer {
  first_name: string;
  last_name: string;
  nationality: string;
  primary_position: string;
  secondary_positions?: readonly string[];
  height_cm?: number;
  preferred_foot?: string;
  career_status?: string;
}
export interface FootballerPublicContext {
  /** Authoritative persistent identifier (never a preview_id). */
  publicId?: number;
  /** Age at the season/date being viewed (never raw initial_age). */
  currentAge?: number;
}
export interface PublicFootballerCard {
  id?: number;
  display_name: string;
  nationality: string;
  primary_position: string;
  age?: number;
  career_status?: string;
}
export interface PublicFootballerProfile extends PublicFootballerCard {
  secondary_positions: readonly string[];
  height_cm?: number;
  preferred_foot?: 'left' | 'right';
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value!=='object'||value===null||Array.isArray(value))
    throw new TypeError('invalid_footballer');
  return value as Record<string, unknown>;
}
function requiredText(value: unknown, field: string): string {
  if(typeof value!=='string'||value.trim()!==value||!value.trim()||value!==value.normalize('NFC'))
    throw new TypeError('invalid_footballer_'+field);
  return value;
}
function optionalText(value: unknown, field: string): string | undefined {
  return value===undefined||value===null?undefined:requiredText(value,field);
}
function publicFields(value: unknown, context: FootballerPublicContext): PublicFootballerCard {
  const p=record(value),ctx=record(context);
  const first=requiredText(p.first_name,'first_name');
  const last=requiredText(p.last_name,'last_name');
  const nationality=requiredText(p.nationality,'nationality');
  const position=requiredText(p.primary_position,'primary_position');
  const out: PublicFootballerCard={
    display_name:first+' '+last,
    nationality,
    primary_position:position
  };
  const id=ctx.publicId;
  if(id!==undefined){
    if(typeof id!=='number'||!Number.isSafeInteger(id)||id<1)
      throw new TypeError('invalid_footballer_id');
    out.id=id;
  }
  if(ctx.currentAge!==undefined){
    const age=ctx.currentAge;
    if(typeof age!=='number'||!Number.isSafeInteger(age)||age<0)
      throw new TypeError('invalid_footballer_age');
    out.age=age;
  }
  const career=optionalText(p.career_status,'career_status');
  if(career!==undefined)out.career_status=career;
  return out;
}
/** Public roster list: NEVER includes internal player data or attributes. */
export function projectPublicFootballerCard(
  player: InternalFootballer, context: FootballerPublicContext={}
): Readonly<PublicFootballerCard> {
  return Object.freeze(publicFields(player,context));
}
/** Public detail: optional physical and position facts only.
 * Attributes and suitability are intentionally withheld by default.
 */
export function projectPublicFootballerProfile(
  player: InternalFootballer, context: FootballerPublicContext={}
): Readonly<PublicFootballerProfile> {
  const p=record(player),base=publicFields(p,context);
  const positions=p.secondary_positions??[];
  if(!Array.isArray(positions)||positions.some(x=>typeof x!=='string'||!x.trim()||x!==x.trim()))
    throw new TypeError('invalid_footballer_secondary_positions');
  const out: PublicFootballerProfile={
    ...base,
    secondary_positions:[...(positions as string[])]
  };
  if(p.height_cm!==undefined&&p.height_cm!==null){
    if(!Number.isSafeInteger(p.height_cm)||Number(p.height_cm)<=0)
      throw new TypeError('invalid_footballer_height_cm');
    out.height_cm=p.height_cm as number;
  }
  if(p.preferred_foot!==undefined&&p.preferred_foot!==null){
    if(p.preferred_foot!=='left'&&p.preferred_foot!=='right')
      throw new TypeError('invalid_footballer_preferred_foot');
    out.preferred_foot=p.preferred_foot;
  }
  Object.freeze(out.secondary_positions);
  return Object.freeze(out);
}

/** Approved public directory JSON, explicitly excluding initial_age, development_aptitude
 * and all administrative generator metadata. Never spread raw player payloads.
 */
export const PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS = Object.freeze([
 'speed','strength','stamina','agility',
 'passing','technique','dribbling','shooting','crossing','tackling','marking','heading',
 'vision','positioning','decisions','composure',
 'gk_reflexes','gk_handling','gk_positioning','gk_aerial'
] as const);
export type PublicFootballerAttribute = typeof PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS[number];
export interface PublicFootballerDirectoryRecord {
 readonly id:number;
 readonly first_name:string;
 readonly last_name:string;
 readonly display_name:string;
 readonly nationality:string;
 readonly secondary_nationality:string|null;
 readonly age:number;
 readonly career_status:string;
 readonly height_cm:number;
 readonly preferred_foot:'left'|'right';
 readonly primary_position:string;
 readonly secondary_positions:readonly string[];
 readonly attributes:Readonly<Record<PublicFootballerAttribute,number>>;
}
export function projectPublicFootballerDirectoryRecord(
 player:InternalFootballer,context:FootballerPublicContext
):Readonly<PublicFootballerDirectoryRecord>{
 const raw=record(player),base=projectPublicFootballerProfile(player,context);
 if(base.id===undefined||base.age===undefined||base.height_cm===undefined||base.preferred_foot===undefined||base.career_status===undefined)
  throw new TypeError('missing_public_player_fields');
 const rawAttributes=record(raw.attributes);
 const attributes={} as Record<PublicFootballerAttribute,number>;
 for(const key of PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS){
  const value=rawAttributes[key];
  if(typeof value!=='number'||!Number.isInteger(value)||value<1||value>99)
   throw new TypeError('invalid_footballer_attribute_'+key);
  attributes[key]=value;
 }
 const out:PublicFootballerDirectoryRecord={
  id:base.id,
  first_name:requiredText(raw.first_name,'first_name'),
  last_name:requiredText(raw.last_name,'last_name'),
  display_name:base.display_name,
  nationality:base.nationality,
  secondary_nationality:optionalText(raw.secondary_nationality,'secondary_nationality')??null,
  age:base.age,
  career_status:base.career_status,
  height_cm:base.height_cm,
  preferred_foot:base.preferred_foot,
  primary_position:base.primary_position,
  secondary_positions:base.secondary_positions,
  attributes:Object.freeze(attributes)
 };
 return Object.freeze(out);
}
