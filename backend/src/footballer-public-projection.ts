/**
 * Server-only footballer wire projections.
 *
 * Internal generation records may contain unpublished abilities, aptitude,
 * seed/replay metadata and future private fields. This module constructs
 * NEW public objects by explicit allowlist, never by spreading player data.
 * No public footballer API exists yet; apply at that API boundary when added.
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
  [internalField: string]: unknown;
}
export interface FootballerPublicContext {
  /** Authoritative persistent identifier (never a preview_id). */
  publicId?: string;
  /** Age at the season/date being viewed (never raw initial_age). */
  currentAge?: number;
}
export interface PublicFootballerCard {
  id?: string;
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
  const id=optionalText(ctx.publicId,'id');
  if(id!==undefined)out.id=id;
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
