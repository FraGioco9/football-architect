/**
 * V4.2 immutable fictional family-context portraits.
 * Name-bank origin is a casting cue, never a real-world ancestry inference.
 * No network, filesystem, AI call, database write or V4.1 identity mutation.
 */
import {COUNTRY_NAMES,V4_BODY_ARCHETYPES} from './player-portrait-core.mjs';
import {buildDiverseV4PortraitSnapshotForPlayer,DIVERSE_V4_TRAIT_OPTIONS,
 pickStyle,v41VariationForBody} from './player-portrait-diversity-v41.mjs';

export const FAMILY_V42_SCHEMA_VERSION='player-portraits-v5';
export const FAMILY_V42_PROMPT_VERSION='player-portrait-v4.2';
export const FAMILY_V42_SEED_VERSION='football-architect:portrait-identity:v4.2';
const FIELDS=['schema_version','prompt_version','player_id','nationality','secondary_nationality',
 'name_origins','family_background','appearance_traits','appearance_fingerprint','body_profile',
 'body_variation'].sort();
const SOURCES=['primary','secondary','unknown'];

// Illustrative, broad casting priors. Not census data, ethnicity probabilities
// or a rule that a country has one face. ALL variants retain positive weights.
const GLOBAL={
 complexion:[7,11,12,10,12,11,11,10,9,7],
 hairTexture:[13,23,23,19,10,7,5],
 hairColor:[31,26,15,10,7,4,4,2,1],
 eyeColor:[39,31,11,6,5,6,1,1]
};
const PRIOR={
 westCentralAfrica:{
  complexion:[1,1,1,2,3,8,19,12,31,22],
  hairTexture:[1,2,3,6,10,23,55],
  hairColor:[61,24,8,2,1,1,1,1,1],
  eyeColor:[72,18,5,1,1,1,1,1]
 },
 northAfrica:{
  complexion:[2,3,7,13,19,21,17,12,5,1],
  hairTexture:[9,18,22,23,14,9,5],
  hairColor:[44,30,13,6,2,1,2,1,1],
  eyeColor:[49,31,10,5,2,1,1,1]
 },
 eastAsia:{
  complexion:[7,14,20,17,13,11,8,6,3,1],
  hairTexture:[22,36,22,10,4,3,3],
  hairColor:[63,26,6,1,1,1,1,1,1],
  eyeColor:[65,23,6,2,1,1,1,1]
 },
 mediterranean:{
  complexion:[4,7,14,18,19,15,10,8,4,1],
  hairTexture:[13,20,24,22,11,7,3],
  hairColor:[34,30,15,9,5,3,2,1,1],
  eyeColor:[40,33,12,6,3,3,2,1]
 },
 northernEurope:{
  complexion:[17,20,19,13,11,8,5,4,2,1],
  hairTexture:[18,27,25,15,7,5,3],
  hairColor:[15,22,19,15,13,8,5,2,1],
  eyeColor:[26,24,14,8,11,11,4,2]
 }
};
const REGIONS={
 westCentralAfrica:'NGA SEN CIV MLI CMR COD',
 northAfrica:'MAR ALG EGY',
 eastAsia:'JPN KOR',
 mediterranean:'ITA ESP POR GRE TUR IRN',
 northernEurope:'ENG SCO WAL GER NED BEL DEN NOR SWE AUT SUI POL'
};
function profile(country){
 const group=Object.keys(REGIONS).find(key=>REGIONS[key].split(' ').includes(country));
 return PRIOR[group]??GLOBAL;
}
function validatedOrigins(input,secondary){
 if(input==null)return Object.freeze({first:'unknown',last:'unknown'});
 if(typeof input!=='object'||Array.isArray(input)||
   Object.keys(input).sort().join(',')!=='first,last'||
   !SOURCES.includes(input.first)||!SOURCES.includes(input.last)||
   (!secondary&&(input.first==='secondary'||input.last==='secondary')))
  throw new TypeError('invalid_v42_name_origins');
 return Object.freeze({first:input.first,last:input.last});
}
function checkCountry(row){
 if(!Number.isSafeInteger(row?.id)||row.id<1||!Object.hasOwn(COUNTRY_NAMES,row.nationality)||
    (row.secondary_nationality!=null&&
     (!Object.hasOwn(COUNTRY_NAMES,row.secondary_nationality)||
      row.secondary_nationality===row.nationality)))
  throw new TypeError('invalid_v42_player');
}
const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
const hex=b=>Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');
function roll(bytes,index){
 const i=index*4;
 return ((bytes[i]|bytes[i+1]<<8|bytes[i+2]<<16|bytes[i+3]<<24)>>>0)/4294967296;
}
function pick(options,weights,random){
 if(weights.length!==options.length||weights.some(n=>!Number.isFinite(n)||n<=0))
  throw new TypeError('invalid_v42_weights');
 let cut=random*weights.reduce((a,b)=>a+b,0);
 for(let i=0;i<options.length;i++){
  if(cut<weights[i])return options[i];
  cut-=weights[i];
 }
 return options.at(-1);
}
function secondaryProbability(src){
 if(src.last==='secondary')return src.first==='secondary'?.92:.85;
 if(src.last==='primary')return src.first==='secondary'?.35:.15;
 if(src.first==='secondary')return .65;
 if(src.first==='primary')return .35;
 return .50;
}
async function canonicalFace(id,nationality,secondary,source){
 const seed=[FAMILY_V42_SEED_VERSION,id,nationality,secondary??'-',
  source.first,source.last].join(':');
 const bytes=await hash(seed);
 const useSecondary=Boolean(secondary)&&roll(bytes,0)<secondaryProbability(source);
 const anchor=useSecondary?secondary:nationality;
 const other=useSecondary?nationality:secondary;
 const a=profile(anchor),b=other?profile(other):a;
 const v41=await buildDiverseV4PortraitSnapshotForPlayer({
  id,nationality,secondary_nationality:secondary,
  attributes:{strength:58,speed:58,agility:58,stamina:58}
 });
 const traits={...v41.appearance_traits};
 for(const [i,key] of ['complexion','hairTexture','hairColor','eyeColor'].entries()){
  if(traits.hairLength==='bald'&&['hairTexture','hairColor'].includes(key))continue;
  const weights=a[key].map((x,j)=>x*.85+b[key][j]*.15);
  traits[key]=pick(DIVERSE_V4_TRAIT_OPTIONS[key],weights,roll(bytes,i+1));
 }
 if(traits.hairLength!=='bald')
  traits.hairStyle=pickStyle(traits.hairLength,traits.hairTexture,roll(bytes,5));
 return Object.freeze({
  family_background:anchor,appearance_traits:Object.freeze(traits),
  appearance_fingerprint:hex(await hash(JSON.stringify({seed,anchor,traits}))).slice(0,16)
 });
}
/** Candidate only: verified original physical attributes, no current-game stats. */
export async function buildFamilyV42PortraitSnapshotForPlayer(player){
 checkCountry(player);
 const secondary=player.secondary_nationality??null;
 const source=validatedOrigins(player.name_origins,Boolean(secondary));
 const base=await buildDiverseV4PortraitSnapshotForPlayer(player);
 const face=await canonicalFace(player.id,player.nationality,secondary,source);
 return Object.freeze({
  schema_version:FAMILY_V42_SCHEMA_VERSION,prompt_version:FAMILY_V42_PROMPT_VERSION,
  player_id:player.id,nationality:player.nationality,secondary_nationality:secondary,
  name_origins:source,...face,body_profile:base.body_profile,body_variation:base.body_variation
 });
}
export async function renderFamilyV42PortraitPromptFromSnapshot(s){
 if(s?.schema_version!==FAMILY_V42_SCHEMA_VERSION||
    s?.prompt_version!==FAMILY_V42_PROMPT_VERSION)
  throw new TypeError('invalid_v42_portrait_version');
 if(!s||typeof s!=='object'||Array.isArray(s)||
    Object.keys(s).sort().join(',')!==FIELDS.join(',')||
    !Number.isSafeInteger(s.player_id)||s.player_id<1||
    !Object.hasOwn(COUNTRY_NAMES,s.nationality)||
    (s.secondary_nationality!==null&&
      (!Object.hasOwn(COUNTRY_NAMES,s.secondary_nationality)||
       s.secondary_nationality===s.nationality))||
    !V4_BODY_ARCHETYPES.includes(s.body_profile))
  throw new TypeError('invalid_v42_portrait_snapshot');
 const source=validatedOrigins(s.name_origins,Boolean(s.secondary_nationality));
 const face=await canonicalFace(s.player_id,s.nationality,s.secondary_nationality,source);
 const expectedVariation=await v41VariationForBody(s.player_id,s.body_profile);
 if(s.family_background!==face.family_background||
    s.appearance_fingerprint!==face.appearance_fingerprint||
    JSON.stringify(s.appearance_traits)!==JSON.stringify(face.appearance_traits)||
    s.body_variation!==expectedVariation)
  throw new TypeError('noncanonical_v42_portrait_snapshot');
 const t=face.appearance_traits;
 const description=[
  'FACE SHAPE: '+t.face+'. CHEEKS: '+t.cheekFullness+'. FOREHEAD: '+t.forehead+'.',
  'EYES: '+t.eyeColor+', '+t.eyeShape+', '+t.eyeSpacing+'. BROWS: '+t.eyebrows+'.',
  'NOSE: '+t.noseBridge+', '+t.noseTip+'. JAW: '+t.jaw+'. CHIN: '+t.chin+'.',
  'MOUTH: '+t.mouth+', '+t.lips+'. EARS: '+t.ears+'.',
  'COMPLEXION: '+t.complexion+'. FACIAL HAIR: '+t.facialHair+'.',
  'HAIR: '+t.hairLength+' length; '+t.hairColor+' color; '+t.hairTexture+
   ' texture; '+t.hairStyle+'; '+t.hairDensity+'; '+t.hairline+'.',
  'SKIN: '+t.skinTexture+'; '+t.skinMark+'.'
 ].join('\n');
 const countryContext='Primary nationality: '+COUNTRY_NAMES[s.nationality]+'. '+
  (s.secondary_nationality?'Secondary nationality: '+COUNTRY_NAMES[s.secondary_nationality]+'. ':'');
 return [
  'Create an ultra-photorealistic media-day cutout portrait of EXACTLY ONE fictional adult male footballer.',
  countryContext+'Citizenship and name-bank origins are context, not factual ancestry inference or rigid national appearance rules.',
  'IMMUTABLE CANONICAL FACIAL DESCRIPTION: Fictional family-background cue associated with '+
   COUNTRY_NAMES[s.family_background]+'. This is a probabilistic casting choice, not a national stereotype or permission to change any frozen trait. Faithfully reproduce EACH feature:\n'+description,
  'PHYSIQUE: '+s.body_profile+'; '+s.body_variation+
   '. Consistent with verified frozen initial physical attributes, never derived from surnames, passports, position or stereotypes. Stamina cannot increase visible muscularity.',
  'Look like an ordinary real adult male, chosen for footballing ability rather than looks. Preserve natural asymmetry, non-idealized face proportions, unretouched skin texture and minor imperfections. No fashion-model styling or beauty lighting.',
  'Exactly one subject standing front-facing with direct gaze, neutral expression, level shoulders and relaxed arms. Show all hair, complete head, shoulders, both arms, torso and waist DOWN TO HIP LEVEL. No additional people, captions or text.',
  'Plain PURE WHITE short-sleeved REGULAR-FIT football jersey, unbranded, with naturally loose folds. No sponsor, number, colored trim, logos, accessories or body-sculpting fabric.',
  'Source image vertical 3:4 with genuine TRANSPARENT RGBA PNG alpha. No checkerboard, scenery, floor, props, shadows, backdrop or colored halos.',
  'Final downstream 320 x 362 WebP target: 3-8 px top margin, 0-12 px only when hair is fully visible. Center subject with transparent side padding. Never shrink the face or crop hair to force dimensions.',
  'IMPORTANT: ONE person in ONE independent image. Preserve this frozen individual identity; do not reuse a previous subject. No automatic approval or publication.'
 ].join('\n\n');
}
