/** #629 — Worker/Node portable immutable player-portrait core.
 * No node:* imports, network, GitHub, image service, file exporter or AI calls.
 * The V1 SHA-256 face seed and V3 prompt match the previously owner-reviewed
 * #609 identity rule; historical V3 snapshots remain reproducible.
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
/**
 * #646 / Step B: independently versioned V4 portrait core.
 * The existing V3 implementation above is immutable and remains callable.
 * All V4 prompts describe an adult male; gameplay age is deliberately ignored.
 */
export const V4_PORTRAIT_SCHEMA_VERSION='player-portraits-v3';
export const V4_PORTRAIT_PROMPT_VERSION='player-portrait-v4';

const V4_BODIES=Object.freeze({
 slim:'Naturally slender upper body with narrow relaxed shoulders, slim arms and no pronounced muscle definition.',
 'lean-fit':'Lean, lightly trained footballer build, modest shoulders and arms, with no sculpted or prominent bulk.',
 'average-fit':'Normal, proportionate body with ordinary shoulders, chest and arms, a little everyday fitness but no pronounced muscular definition.',
 sturdy:'Naturally robust, somewhat broader or stockier build; substantial but unsculpted shoulders and arms, never a fitness-model physique.',
 muscular:'Unusually strong but believable footballer build, with visibly more developed shoulders and arms than average, never bodybuilder size or deeply carved muscles.'
});
export const V4_BODY_ARCHETYPES=Object.freeze(Object.keys(V4_BODIES));

/** Stamina is validated but intentionally cannot increase visible muscle tone. */
export function classifyV4AthleticBody(attributes){
 if(!attributes||typeof attributes!=='object'||Array.isArray(attributes))
  throw new TypeError('missing_v4_athletic_attributes');
 for(const key of ['strength','speed','stamina','agility']){
  const v=attributes[key];
  if(!Number.isInteger(v)||v<1||v>99)throw new TypeError('invalid_v4_athletic_'+key);
 }
 const mobility=(attributes.speed+attributes.agility)/2,strength=attributes.strength;
 let body_profile='average-fit';
 if(strength>=82&&strength-mobility>=12)body_profile='muscular';
 else if(strength>=72)body_profile='sturdy';
 else if(mobility>=72&&strength<=47)body_profile='slim';
 else if(mobility>=67&&strength<72)body_profile='lean-fit';
 return Object.freeze({body_profile});
}

const V4_TRAIT_VARIANTS=Object.freeze({
 face:['ordinary oval face','rounded face with fuller cheeks','long face with subtle uneven contours',
  'soft square face','broad face with fuller lower cheeks','narrow face with gentle asymmetry',
  'slightly rectangular face with ordinary proportions','heart-shaped face with soft contours',
  'rounded-oval face with modest cheek definition','broad forehead with softly tapering face'],
 complexion:['very fair complexion','fair complexion','light warm complexion','light olive complexion',
  'olive complexion','medium golden-brown complexion','medium brown complexion','warm tan complexion',
  'deep brown complexion','very deep brown complexion'],
 hairColor:['black hair','dark brown hair','medium brown hair','light brown hair','dark blond hair','blond hair','auburn hair'],
 hairTexture:['straight hair','slightly wavy hair','wavy hair','loose curly hair','tight curly hair','coily hair'],
 hairStyle:['short practical haircut','short natural textured cut','simple low fade','medium-length everyday haircut',
  'closely cropped practical haircut','short unstyled haircut','understated side-part haircut','grown-out short haircut'],
 hairline:['ordinary natural hairline','slightly uneven hairline','soft widow peak','gently rounded hairline','subtly higher temples'],
 eyes:['dark brown eyes','brown eyes','hazel eyes','amber-brown eyes','green eyes','blue-gray eyes'],
 eyebrows:['ordinary straight eyebrows','gently arched eyebrows','full irregular eyebrows','fine uneven eyebrows',
  'naturally uneven eyebrows','soft low-set eyebrows'],
 nose:['straight proportionate nose','rounded nose','prominent but natural nasal bridge','broad nose',
  'slightly asymmetric nose','soft curved nose','somewhat wider nasal tip','subtly uneven nasal bridge'],
 jaw:['soft unsculpted jawline','rounded jawline','modest square jawline','narrow ordinary jawline',
  'broad gently rounded jawline','slightly asymmetric lower jaw'],
 ears:['naturally proportioned ears','slightly prominent ears','small close-set ears',
  'one ear subtly more prominent than the other','modestly larger ears'],
 facialHair:['clean-shaven face','light uneven stubble','sparse natural facial hair','short ordinary beard',
  'subtle mustache and stubble','patchy short facial hair'],
 skinDetail:['visible natural skin texture and pores','subtle freckles and natural pores',
  'mild under-eye shadows','one small facial mole and natural skin texture',
  'a few unretouched skin blemishes','slightly uneven skin tone','subtle asymmetrical smile lines',
  'tiny faint eyebrow mark with natural skin texture']
});
const V4_TRAIT_KEYS=Object.freeze(Object.keys(V4_TRAIT_VARIANTS));
const V4_SNAPSHOT_FIELDS=Object.freeze([
 'schema_version','prompt_version','player_id','nationality','secondary_nationality',
 'appearance_traits','appearance_fingerprint','body_profile'
].sort());

function v4IdentityInput(player){
 if(!player||typeof player!=='object'||Array.isArray(player))
  throw new TypeError('invalid_v4_player_record');
 if(!Number.isSafeInteger(player.id)||player.id<1)throw new TypeError('invalid_v4_player_id');
 if(!Object.hasOwn(COUNTRY_NAMES,player.nationality))throw new TypeError('invalid_v4_nationality');
 const secondary=player.secondary_nationality??null;
 if(secondary!==null&&(!Object.hasOwn(COUNTRY_NAMES,secondary)||secondary===player.nationality))
  throw new TypeError('invalid_v4_secondary_nationality');
 return Object.freeze({player_id:player.id,nationality:player.nationality,
  secondary_nationality:secondary,...classifyV4AthleticBody(player.attributes)});
}

async function v4CanonicalFace(id){
 const bytes=await hash('football-architect:portrait-identity:v4:'+id+':0');
 const traits={};
 for(const [i,key] of V4_TRAIT_KEYS.entries())
  traits[key]=V4_TRAIT_VARIANTS[key][bytes[i]%V4_TRAIT_VARIANTS[key].length];
 const signature=Array.from(await hash(JSON.stringify(traits)),v=>v.toString(16).padStart(2,'0')).join('');
 return Object.freeze({appearance_traits:Object.freeze(traits),appearance_fingerprint:signature.slice(0,16)});
}

/** Must be called with verified frozen INITIAL physical stats; no AI/DB calls. */
export async function buildV4PortraitSnapshotForPlayer(player){
 const subject=v4IdentityInput(player);
 const face=await v4CanonicalFace(subject.player_id);
 return Object.freeze({schema_version:V4_PORTRAIT_SCHEMA_VERSION,prompt_version:V4_PORTRAIT_PROMPT_VERSION,
  ...subject,...face});
}

/** Renderer accepts ONLY the versioned and recomputed canonical ID traits. */
export async function renderV4PortraitPromptFromSnapshot(snapshot){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
    snapshot.schema_version!==V4_PORTRAIT_SCHEMA_VERSION||
    snapshot.prompt_version!==V4_PORTRAIT_PROMPT_VERSION)
  throw new TypeError('invalid_v4_portrait_version');
 if(Object.keys(snapshot).sort().join(',')!==V4_SNAPSHOT_FIELDS.join(',')||
    !Number.isSafeInteger(snapshot.player_id)||snapshot.player_id<1||
    !Object.hasOwn(COUNTRY_NAMES,snapshot.nationality)||
    (snapshot.secondary_nationality!==null&&
     (!Object.hasOwn(COUNTRY_NAMES,snapshot.secondary_nationality)||
      snapshot.secondary_nationality===snapshot.nationality)))
  throw new TypeError('invalid_v4_portrait_snapshot');
 if(!Object.hasOwn(V4_BODIES,snapshot.body_profile))throw new TypeError('invalid_v4_body_profile');
 if(!snapshot.appearance_traits||typeof snapshot.appearance_traits!=='object'||
    Array.isArray(snapshot.appearance_traits))throw new TypeError('invalid_v4_portrait_traits');
 const canonical=await v4CanonicalFace(snapshot.player_id);
 if(snapshot.appearance_fingerprint!==canonical.appearance_fingerprint||
    JSON.stringify(snapshot.appearance_traits)!==JSON.stringify(canonical.appearance_traits))
  throw new TypeError('noncanonical_v4_appearance_snapshot');
 const t=snapshot.appearance_traits;
 const nationality='Primary nationality: '+COUNTRY_NAMES[snapshot.nationality]+'. '+
  (snapshot.secondary_nationality?'Secondary nationality: '+COUNTRY_NAMES[snapshot.secondary_nationality]+'. ':'');
 const face=[t.face,t.complexion,t.hairColor,t.hairTexture,t.hairStyle,t.hairline,
  t.eyes,t.eyebrows,t.nose,t.jaw,t.ears,t.facialHair,t.skinDetail].join('; ');
 return [
  'Create an ultra-photorealistic official club media-day photograph of EXACTLY ONE fictional adult male association football player.',
  nationality+'Nationality is citizenship context, NEVER ethnicity or appearance rules. Secondary nationality does not imply mixed ancestry.',
  'BINDING INDIVIDUAL FACIAL TRAITS: '+face+'.',
  'BINDING BODY PROFILE: '+V4_BODIES[snapshot.body_profile]+
   ' Do not increase muscle bulk or visible definition for stamina, endurance, position or athletic stereotypes.',
  'Show an ordinary individual selected for football ability, not physical attractiveness. Some people may naturally be attractive; never idealize or beautify.',
  'Preserve ordinary face proportions, natural asymmetry, visible pores, unretouched skin texture and minor imperfections.',
  'No fashion-model or fitness-model appearance, beauty lighting, cosmetic retouching, smoothened skin, perfectly symmetrical features, sculpted jaw or cheekbones, glossy editorial hair, exaggerated eyes or lips.',
  'Wear a completely plain pure-white short-sleeved football jersey, comfortable REGULAR MATCH FIT and natural loose fabric drape. No clingy fabric sculpting muscles, no logos, crests, sponsors, numbers, stripes, colored trim, text or accessories.',
  'Stand upright facing forward, level shoulders, relaxed arms beside the body, neutral expression and direct eye contact. Show the COMPLETE head including all hair, both shoulders and arms, torso and waist DOWN TO HIP LEVEL. Center the subject in consistent vertical 3:4 framing, never crop the head or shrink the face just to fit large hair.',
  'COMPOSITION TARGET for publication 320 x 362 WebP: upper silhouette margin 3-8 pixels; 0-12 pixels tolerated only if hair is intact. Measured downstream with alpha >= 64/255 and at least 3 foreground pixels in the same row. Leave transparent side padding and a centered body. The source remains a complete 3:4 PNG.',
  'Use simple balanced club media-day studio light, natural colors, realistic anatomy. Not CGI, commercial advertising, fashion editorial or glamour photography.',
  'ONE person in ONE image. Never a group, collage, triptych, repeated face or generic attractive athlete. Preserve every canonical facial feature. Adult male is the only age instruction: ignore gameplay age and do not add age bands.',
  'GENUINELY TRANSPARENT RGBA PNG WITH ALPHA CHANNEL. No checkerboard, painted background, scenery, floor, shadows, watermark, extra objects or text. Clean naturally antialiased hair/jersey silhouette; no red, yellow, magenta, blue or green halos, matte spill, colored fringe or glow. Outside silhouette fully transparent.'
 ].join('\n\n');
}
