/** #629 — Worker/Node portable immutable player-portrait core.
 * No node:* imports, network, GitHub, image service, file exporter or AI calls.
 * The V1 SHA-256 face seed and V3 prompt match the previously owner-reviewed
 * #609 identity rule; the approved #44/#98/#145 remain untouched.
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

export const PORTRAIT_SCHEMA_VERSION = 'player-portraits-v2';
export const PORTRAIT_PROMPT_VERSION = 'player-portrait-v3';

// Codes are the existing 50-country footballer catalogue, not ethnicity labels.
export const COUNTRY_NAMES = Object.freeze({
 ESP:'Spain',ARG:'Argentina',FRA:'France',ENG:'England',POR:'Portugal',BRA:'Brazil',MAR:'Morocco',BEL:'Belgium',
 NED:'Netherlands',MEX:'Mexico',COL:'Colombia',SUI:'Switzerland',GER:'Germany',CRO:'Croatia',ITA:'Italy',
 USA:'United States',JPN:'Japan',SEN:'Senegal',NOR:'Norway',URU:'Uruguay',DEN:'Denmark',AUT:'Austria',
 IRN:'Iran',ECU:'Ecuador',EGY:'Egypt',AUS:'Australia',CAN:'Canada',ALG:'Algeria',CIV:'Côte d’Ivoire',
 NGA:'Nigeria',TUR:'Türkiye',KOR:'South Korea',PAR:'Paraguay',SWE:'Sweden',RUS:'Russia',UKR:'Ukraine',
 POL:'Poland',HUN:'Hungary',WAL:'Wales',COD:'DR Congo',GRE:'Greece',CMR:'Cameroon',SCO:'Scotland',
 SRB:'Serbia',SVK:'Slovakia',PAN:'Panama',MLI:'Mali',RSA:'South Africa',VEN:'Venezuela',CHI:'Chile'
});

const VARIANTS = Object.freeze({
 face:['oval face','rounded face','long oval face','subtly angular face','soft square face','narrow face','broad cheekbones','defined cheekbones'],
 complexion:['very fair complexion','fair complexion','light warm complexion','light olive complexion','olive complexion','medium golden-brown complexion','medium brown complexion','warm tan complexion','deep brown complexion','very deep brown complexion'],
 hairTexture:['straight hair','slightly wavy hair','wavy hair','loose curly hair','tight curly hair','coily hair'],
 hairStyle:['short cropped haircut','short textured haircut','low fade haircut','medium length natural haircut','short side-parted haircut','closely trimmed haircut','short curly top'],
 hairColor:['black hair','dark brown hair','medium brown hair','light brown hair','dark blond hair','blond hair','auburn hair'],
 eyes:['dark brown eyes','brown eyes','hazel eyes','amber-brown eyes','green eyes','blue-gray eyes'],
 eyebrows:['straight eyebrows','gently arched eyebrows','thick eyebrows','fine eyebrows','slightly uneven eyebrows'],
 nose:['straight nose','slightly rounded nose','prominent nasal bridge','wide nose','subtly curved nose','narrow nose'],
 jaw:['soft jawline','defined jawline','rounded jawline','narrow jawline','square jawline'],
 facialHair:['clean-shaven face','very light stubble','short uneven stubble','short neatly trimmed beard','short mustache and stubble','sparse natural facial hair'],
 detail:['subtle freckles','one small cheek mole','faint natural under-eye creases','slight natural facial asymmetry','mild skin texture variation','tiny faint eyebrow mark','subtle smile lines','a few natural skin blemishes']
});
const keys=Object.keys(VARIANTS);
const hash=async(value)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
const requirePlayer=(player)=>{
 if(!player||typeof player!=='object'||Array.isArray(player))throw new TypeError('invalid_player_record');
 if(!Number.isSafeInteger(player.id)||player.id<1)throw new TypeError('invalid_player_id');
 if(!Object.hasOwn(COUNTRY_NAMES,player.nationality))throw new TypeError('invalid_nationality');
 const secondary=player.secondary_nationality??null;
 if(secondary!==null&&(!Object.hasOwn(COUNTRY_NAMES,secondary)||secondary===player.nationality))
  throw new TypeError('invalid_secondary_nationality');
 return {player_id:player.id,nationality:player.nationality,secondary_nationality:secondary,
  ...classifyAthleticBody(player.attributes)};
};

async function createTraits(playerId){
 const digest=await hash(`football-architect:portrait-identity:v1:${playerId}:0`);
 const traits={};
 for(const [index,key] of keys.entries())traits[key]=VARIANTS[key][digest[index]%VARIANTS[key].length];
 return traits;
}
function portraitSentence(traits){
 return `A ${traits.face}, ${traits.complexion}, ${traits.hairColor} with ${traits.hairTexture} in a ${traits.hairStyle}, ${traits.eyes}, ${traits.eyebrows}, ${traits.nose}, ${traits.jaw}, ${traits.facialHair}, and ${traits.detail}.`;
}

/** The canonical face is determined by the permanent ID alone, not the
 * other players in a cohort. This makes singleton, offline and future Worker
 * generation produce the same immutable face for a given player ID.
 */
async function canonicalAppearanceEntry(player){
 const traits=await createTraits(player.player_id);
 const signature=Array.from(await hash(JSON.stringify(traits)),v=>v.toString(16).padStart(2,'0')).join('');
 return Object.freeze({...player,appearance_traits:Object.freeze(traits),appearance_profile:portraitSentence(traits),
  appearance_fingerprint:signature.slice(0,16)});
}

/** Whitelisted V3 visual prompt. Descriptors only, never raw stats, age, height or player name. */
export async function buildPortraitPrompt(entry){
 if(!entry||typeof entry!=='object'||typeof entry.appearance_profile!=='string'||
    !Number.isSafeInteger(entry.player_id)||entry.player_id<1||!Object.hasOwn(COUNTRY_NAMES,entry.nationality)||
    (entry.secondary_nationality!=null&&!Object.hasOwn(COUNTRY_NAMES,entry.secondary_nationality)))
  throw new TypeError('invalid_appearance_entry');
 // Fail closed on arbitrary or injected facial descriptions; the manifest
 // must originate from the versioned, ID-keyed generator.
 const canonical=await canonicalAppearanceEntry(requirePlayer({
  id:entry.player_id,nationality:entry.nationality,
  secondary_nationality:entry.secondary_nationality,
  attributes:{strength:58,speed:58,agility:58,stamina:58}
 }));
 if(entry.appearance_profile!==canonical.appearance_profile||
    entry.appearance_fingerprint!==canonical.appearance_fingerprint)
  throw new TypeError('noncanonical_appearance_entry');
 const physicalDescription=describeAthleticBody(entry);
 const nationalities=`Primary nationality: ${COUNTRY_NAMES[entry.nationality]}. `+
  (entry.secondary_nationality?`Secondary nationality: ${COUNTRY_NAMES[entry.secondary_nationality]}. `:'');
 return `Create an ultra-photorealistic official club media-day photograph of EXACTLY ONE fictional adult male association football player.\n\n`+
  `${nationalities}These are citizenship/background context, NOT ethnicity or physical-feature rules. `+
  `Secondary nationality does not imply mixed ancestry.\n`+
  `Individual appearance reference: ${entry.appearance_profile}\n\n`+
  `${physicalDescription} Natural facial asymmetry, skin texture and imperfections.\n\n`+
  `Wear a completely plain pure-white short-sleeved football jersey with a regular, comfortable match fit, `+
  `realistic lightweight fabric, subtle seams and natural folds. No logos, crests, sponsors, numbers, stripes, colored trim, or text.\n\n`+
  `Stand upright, head and torso facing directly forward, level shoulders, relaxed arms resting naturally beside the body, `+
  `neutral expression and direct eye contact. Show the entire head, shoulders, torso and waist DOWN TO HIP LEVEL, `+
  `including both sides of the body. Keep a consistent camera distance and centered vertical 3:4 framing.\n\n`+
  `Authentic professional football media-day photography, soft balanced studio lighting, accurate anatomy and facial details, `+
  `natural colors, not a CGI render or fashion advertisement.\n\n`+
  `CRITICAL IMAGE COMPOSITION: Render exactly ONE individual portrait for this player. Never make a group portrait, collage, triptych, contact sheet or multiple panels. `+
  `Treat the individual appearance reference as binding: keep the specified complexion, eye color, hair color, hair texture, haircut, facial hair and face structure. `+
  `Do not replace these traits with a generic athlete's face, and do not reuse a previous player's face. `+
  `Maintain comfortable transparent padding around all hair, shoulders and arms and a consistent bottom crop at hip level.\n\n`+
  `GENUINELY TRANSPARENT BACKGROUND WITH ALPHA CHANNEL and clean, naturally antialiased hair edges, transparent RGBA PNG. `+
  `No scenery, floor, colored backdrop, checkerboard texture or painted transparency, cast shadow, watermark or extra objects. `+
  `NO CHROMATIC EDGE FRINGING: no red, yellow, magenta, blue or green outlines, colored halos, edge glow, matte spill or color contamination around the subject. `+
  `Outside the silhouette must be completely transparent; partially transparent edges must blend only with the local subject color.`;
}

/** Immutable portrait variables: built once after the permanent ID is allocated.
 * Only physical snapshots and citizenship context are captured. Nothing calls AI.
 */
export async function buildPortraitSnapshotForPlayer(player){
 const entry=await canonicalAppearanceEntry(requirePlayer(player));
 const {appearance_profile,...variables}=entry;
 return Object.freeze({schema_version:PORTRAIT_SCHEMA_VERSION,prompt_version:PORTRAIT_PROMPT_VERSION,...variables});
}

/** Reconstruct a V3 image prompt only when an authorized caller needs it.
 * Never recompute from a player's CURRENT evolving gameplay attributes.
 * V3 stays pinned when new templates are introduced.
 */
export async function renderPortraitPromptFromSnapshot(snapshot){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
    snapshot.schema_version!==PORTRAIT_SCHEMA_VERSION||snapshot.prompt_version!==PORTRAIT_PROMPT_VERSION)
  throw new TypeError('invalid_portrait_version');
 const fields=['schema_version','prompt_version','player_id','nationality','secondary_nationality','appearance_traits',
  'appearance_fingerprint','body_profile','body_conditioning'];
 if(Object.keys(snapshot).sort().join(',')!==fields.sort().join(','))
  throw new TypeError('invalid_portrait_snapshot');
 if(!Number.isSafeInteger(snapshot.player_id)||snapshot.player_id<1||
    !Object.hasOwn(COUNTRY_NAMES,snapshot.nationality)||
    (snapshot.secondary_nationality!==null&&
    (!Object.hasOwn(COUNTRY_NAMES,snapshot.secondary_nationality)||snapshot.secondary_nationality===snapshot.nationality)))
  throw new TypeError('invalid_portrait_snapshot');
 if(!snapshot.appearance_traits||typeof snapshot.appearance_traits!=='object'||Array.isArray(snapshot.appearance_traits))
  throw new TypeError('invalid_portrait_traits');
 const canonical=await canonicalAppearanceEntry({
  player_id:snapshot.player_id,nationality:snapshot.nationality,
  secondary_nationality:snapshot.secondary_nationality,body_profile:snapshot.body_profile,
  body_conditioning:snapshot.body_conditioning
 });
 if(JSON.stringify(snapshot.appearance_traits)!==JSON.stringify(canonical.appearance_traits)||
    snapshot.appearance_fingerprint!==canonical.appearance_fingerprint)
  throw new TypeError('noncanonical_appearance_snapshot');
 return buildPortraitPrompt({...canonical, ...snapshot,appearance_profile:canonical.appearance_profile});
}
