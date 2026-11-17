/**
 * #646 — V4.1: more varied, natural and coherent photographic identities.
 *
 * The six already owner-accepted V4 (v4:0 seed) identities remain frozen in
 * player-portrait-core.mjs. This is a NEW immutable snapshot/prompt contract.
 * No mutable global RNG, no gameplay-age inference, no nationality->face mapping,
 * no network/provider/database/filesystem calls.
 */
import {
 COUNTRY_NAMES,classifyV4AthleticBody,V4_BODY_ARCHETYPES
} from './player-portrait-core.mjs';

export const DIVERSE_V4_SCHEMA_VERSION='player-portraits-v4';
export const DIVERSE_V4_PROMPT_VERSION='player-portrait-v4.1';
export const DIVERSE_V4_SEED_VERSION='football-architect:portrait-identity:v4.1';

const WEIGHTED=Object.freeze({
 face:[
  ['ordinary oval face',22],['rounded face',12],['long oval face',12],
  ['soft square face',9],['broad face',9],['narrow oval face',8],
  ['rectangular face',8],['soft heart-shaped face',7],['triangular face',4],
  ['soft trapezoid face',4],['pear-shaped face',4],['asymmetric oval face',6],
  ['long rectangular face',5],['compact rounded face',7],['subtly angular face',9],
  ['broad forehead with gently tapered face',7]
 ],
 cheekFullness:[
  ['ordinary cheek fullness',34],['gently fuller cheeks',20],
  ['slightly hollow cheeks',12],['broad lower cheeks',12],
  ['prominent but soft cheekbones',12],['asymmetrically full cheeks',10]
 ],
 complexion:[
  ['very fair complexion',7],['fair complexion',11],['light warm complexion',12],
  ['light olive complexion',10],['olive complexion',12],
  ['medium golden-brown complexion',11],['medium brown complexion',11],
  ['warm tan complexion',10],['deep brown complexion',9],
  ['very deep brown complexion',7]
 ],
 eyeColor:[
  ['dark brown eyes',39],['brown eyes',31],['hazel eyes',11],
  ['amber-brown eyes',6],['green eyes',5],['blue-gray eyes',6],
  ['gray eyes',1],['light brown eyes',1]
 ],
 eyeShape:[
  ['ordinary almond-shaped eyes',35],['slightly rounded eyes',16],
  ['narrow-set eyelid shape',8],['gently hooded eyelids',17],
  ['subtle unequal eyelids',8],['softly downturned outer corners',6],
  ['slightly upturned outer corners',5],['deep-set eyes with natural folds',5]
 ],
 eyeSpacing:[
  ['ordinary eye spacing',58],['subtly close-set eyes',13],
  ['slightly wide-set eyes',15],['asymmetric but natural eye spacing',5],
  ['moderately wide-set eyes',9]
 ],
 eyebrows:[
  ['ordinary straight eyebrows',24],['softly arched eyebrows',16],
  ['thick irregular eyebrows',18],['fine straight eyebrows',9],
  ['slightly unequal eyebrows',16],['low-set eyebrows',10],
  ['bushy unstyled eyebrows',4],['gently rounded eyebrows',3]
 ],
 noseBridge:[
  ['straight unremarkable nasal bridge',31],['prominent natural bridge',16],
  ['slightly curved nasal bridge',15],['gently broad nasal bridge',13],
  ['subtle asymmetry in the nasal bridge',12],['low nasal bridge',8],
  ['small natural bump on the bridge',5]
 ],
 noseTip:[
  ['natural rounded nose tip',31],['moderately broad nose tip',19],
  ['narrower nose tip',14],['slightly asymmetric tip',12],
  ['soft downturned nose tip',10],['gently upturned tip',14]
 ],
 jaw:[
  ['soft unsculpted jawline',26],['rounded jawline',18],
  ['modest square jawline',16],['narrow ordinary jawline',13],
  ['wide softly rounded jawline',11],['subtly asymmetric jawline',10],
  ['sloping jawline',6]
 ],
 chin:[
  ['ordinary rounded chin',35],['modest narrow chin',18],
  ['broad but soft chin',18],['slightly recessed chin',10],
  ['subtle cleft in the chin',7],['slightly asymmetric chin',12]
 ],
 forehead:[
  ['ordinary forehead height',37],['slightly taller forehead',18],
  ['shorter forehead',12],['wide forehead',12],
  ['gently sloping forehead',10],['subtly asymmetric forehead',11]
 ],
 mouth:[
  ['ordinary relaxed mouth width',43],['narrower mouth',16],
  ['slightly broader mouth',16],['one lip corner subtly lower',11],
  ['subtly asymmetric natural mouth',14]
 ],
 lips:[
  ['naturally proportionate lips',34],['rather thin lips',22],
  ['fuller lower lip',18],['slightly fuller lips',16],
  ['uneven natural lip contour',10]
 ],
 ears:[
  ['ordinary ears',34],['slightly prominent ears',18],
  ['small close-set ears',10],['one ear subtly more prominent',10],
  ['moderately large ears',13],['rounded ears',8],
  ['slightly asymmetrical ear size',7]
 ],
 hairLength:[
  ['bald',3],['very short',25],['short',49],
  ['medium',19],['longer',4]
 ],
 hairTexture:[
  ['fine straight',13],['straight',23],['slightly wavy',23],
  ['wavy',19],['loose curly',10],['tight curly',7],['coily',5]
 ],
 hairColor:[
  ['black',31],['dark brown',26],['medium brown',15],
  ['light brown',10],['dark blond',7],['blond',4],
  ['auburn',4],['copper red',2],['sandy blond',1]
 ],
 hairDensity:[
  ['ordinary natural density',50],['rather dense hair',15],
  ['mildly thin hair',18],['subtly thinning at the crown',10],
  ['uneven natural density',7]
 ],
 hairline:[
  ['ordinary hairline',42],['slightly uneven hairline',21],
  ['soft widow peak',10],['gently rounded hairline',12],
  ['slightly higher temples',12],['subtle receding temples',3]
 ],
 facialHair:[
  ['clean shaven',34],['faint uneven stubble',20],['sparse facial hair',13],
  ['natural short beard',10],['patchy short beard',8],
  ['subtle mustache and stubble',8],['thin mustache',3],
  ['short goatee',2],['very short uneven sideburns',2]
 ],
 skinTexture:[
  ['natural visible skin texture and pores',42],
  ['subtle non-retouched pores',19],['slightly uneven skin tone',16],
  ['mild under-eye shadows and natural pores',13],
  ['ordinary texture with soft smile lines',10]
 ],
 skinMark:[
  ['no conspicuous facial mark',44],['faint freckles',16],
  ['small natural facial mole',13],['few tiny blemishes',12],
  ['subtle acne marks',7],['tiny faint eyebrow mark',4],
  ['small non-dramatic facial scar',2],['faint under-eye creases',2]
 ]
});

export const DIVERSE_V4_TRAIT_OPTIONS=Object.freeze(
 Object.fromEntries(Object.entries(WEIGHTED).map(([key,opts])=>[
  key,Object.freeze(opts.map(([value])=>value))
 ]))
);

const STYLES=Object.freeze({
 'very short':{
  straight:['natural buzz cut','close practical crew cut','very short straight crop'],
  wavy:['short clipped waves','close-cropped practical haircut','short crew cut with subtle waves'],
  curly:['tight short curly crop','very short practical curly haircut','close curls'],
  coily:['close natural coily crop','short even coiled cut','practical close coily haircut']
 },
 short:{
  straight:['short straight natural haircut','practical short side part','short simple textured crop','short grown-out buzz cut'],
  wavy:['short natural waves','slightly tousled practical crop','understated short wavy side part','ordinary short wavy haircut'],
  curly:['short natural curly haircut','short loose curly top','practical short curls','soft short curly crop'],
  coily:['short natural coily haircut','low fade with coily top','short loosely shaped coils','natural short afro']
 },
 medium:{
  straight:['medium straight unstyled haircut','ordinary medium side part','medium hair falling naturally'],
  wavy:['medium wavy unstyled haircut','casual natural wavy fringe','medium slightly grown-out waves'],
  curly:['medium-length loose natural curls','gently grown-out curly top','medium curls without styling products'],
  coily:['medium natural afro','medium-length loose coils','grown-out coily haircut']
 },
 longer:{
  straight:['longer straight hair loosely tucked behind the ears','longer straight unstyled hair'],
  wavy:['natural longer wavy hair','loose wavy hair around the ears'],
  curly:['longer loose natural curls','curly hair reaching the ears'],
  coily:['fuller natural coily hair','longer natural afro']
 }
});

const BUILD_VARIANTS=Object.freeze({
 slim:[
  ['a lightly framed slender upper body with narrow, relaxed shoulders',55],
  ['naturally slight arms and a compact unsculpted torso',45]
 ],
 'lean-fit':[
  ['slender, gently conditioned shoulders and unremarkable arms',50],
  ['a lean compact torso and lightly trained but unsculpted arms',50]
 ],
 'average-fit':[
  ['an ordinary proportionate torso with a naturally soft waist',35],
  ['average shoulders and arms without visible muscle sculpting',40],
  ['a slightly broader but unremarkable everyday build',25]
 ],
 sturdy:[
  ['a broader, naturally stocky torso with a softly rounded waist',40],
  ['robust shoulders with ordinary soft muscular definition',35],
  ['a compact and broad footballer build, not sculpted',25]
 ],
 muscular:[
  ['noticeably developed but natural shoulders and upper arms',60],
  ['stronger-than-average arms with a regular, unsculpted midsection',40]
 ]
});

const FIELDS=Object.freeze([
 'schema_version','prompt_version','player_id','nationality','secondary_nationality',
 'appearance_traits','appearance_fingerprint','body_profile','body_variation'
].sort());

function weightPick(opts,roll){
 let total=0;
 for(const [,weight] of opts)total+=weight;
 if(!Number.isFinite(total)||total<=0)throw new TypeError('invalid_portrait_weighted_choices');
 let cut=roll*total;
 for(const [value,weight] of opts){
  if(weight<=0)throw new TypeError('invalid_portrait_weighted_weight');
  if(cut<weight)return value;
  cut-=weight;
 }
 return opts.at(-1)[0];
}

const sha=async value=>new Uint8Array(
 await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))
);
async function identityEntropy(playerId){
 const chunks=await Promise.all([0,1,2,3].map(i=>
  sha(DIVERSE_V4_SEED_VERSION+':'+playerId+':'+i)
 ));
 const bytes=new Uint8Array(128);
 for(const [i,chunk] of chunks.entries())bytes.set(chunk,i*32);
 let position=0;
 return ()=>{
  if(position+4>bytes.length)throw new TypeError('portrait_identity_entropy_exhausted');
  const x=(bytes[position]|(bytes[position+1]<<8)|
   (bytes[position+2]<<16)|(bytes[position+3]<<24))>>>0;
  position+=4;
  return x/4294967296;
 };
}
function group(texture){
 if(texture==='fine straight'||texture==='straight')return 'straight';
 if(texture==='slightly wavy'||texture==='wavy')return 'wavy';
 if(texture==='loose curly'||texture==='tight curly')return 'curly';
 return 'coily';
}
function pickStyle(length,texture,roll){
 const options=STYLES[length]?.[group(texture)];
 if(!options||options.length===0)throw new TypeError('invalid_hair_compatibility');
 return options[Math.min(options.length-1,Math.floor(roll*options.length))];
}
async function canonicalTraits(playerId){
 const roll=await identityEntropy(playerId),traits={};
 // Always consume independent draws, including the special bald path, to
 // avoid correlated traits and ordering-dependent random number sequences.
 for(const [key,opts] of Object.entries(WEIGHTED))traits[key]=weightPick(opts,roll());
 const styleRoll=roll();
 if(traits.hairLength==='bald'){
  traits.hairColor='no visible scalp hair';
  traits.hairTexture='no visible scalp hair texture';
  traits.hairDensity='no scalp hair';
  traits.hairline='no visible hairline';
  traits.hairStyle='naturally bald scalp';
 }else{
  traits.hairStyle=pickStyle(traits.hairLength,traits.hairTexture,styleRoll);
 }
 const bodyRoll=roll();
 const source=JSON.stringify(traits);
 const signature=Array.from(await sha(source),n=>n.toString(16).padStart(2,'0')).join('').slice(0,16);
 return Object.freeze({appearance_traits:Object.freeze(traits),appearance_fingerprint:signature,bodyRoll});
}
function validatePlayer(player){
 if(!player||typeof player!=='object'||Array.isArray(player)||
    !Number.isSafeInteger(player.id)||player.id<1)
  throw new TypeError('invalid_diverse_v4_player');
 if(!Object.hasOwn(COUNTRY_NAMES,player.nationality)||
    (player.secondary_nationality!==null&&player.secondary_nationality!==undefined&&
     (!Object.hasOwn(COUNTRY_NAMES,player.secondary_nationality)||
      player.secondary_nationality===player.nationality)))
  throw new TypeError('invalid_diverse_v4_nationality');
 return {player_id:player.id,nationality:player.nationality,
  secondary_nationality:player.secondary_nationality??null,
  ...classifyV4AthleticBody(player.attributes)};
}
function variation(body,roll){
 const options=BUILD_VARIANTS[body];
 if(!options)throw new TypeError('invalid_diverse_v4_body');
 return weightPick(options,roll);
}

/** Opt-in ONLY. Caller must provide frozen *initial* physical attributes. */
export async function buildDiverseV4PortraitSnapshotForPlayer(player){
 const details=validatePlayer(player);
 const face=await canonicalTraits(details.player_id);
 return Object.freeze({
  schema_version:DIVERSE_V4_SCHEMA_VERSION,
  prompt_version:DIVERSE_V4_PROMPT_VERSION,
  ...details,
  appearance_traits:face.appearance_traits,
  appearance_fingerprint:face.appearance_fingerprint,
  body_variation:variation(details.body_profile,face.bodyRoll)
 });
}

/** Recomputes the whole deterministic identity before returning image text. */
export async function renderDiverseV4PortraitPromptFromSnapshot(snapshot){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
    snapshot.schema_version!==DIVERSE_V4_SCHEMA_VERSION||
    snapshot.prompt_version!==DIVERSE_V4_PROMPT_VERSION)
  throw new TypeError('invalid_diverse_v4_portrait_version');
 if(Object.keys(snapshot).sort().join(',')!==FIELDS.join(',')||
    !Number.isSafeInteger(snapshot.player_id)||snapshot.player_id<1||
    !Object.hasOwn(COUNTRY_NAMES,snapshot.nationality)||
    (snapshot.secondary_nationality!==null&&
     (!Object.hasOwn(COUNTRY_NAMES,snapshot.secondary_nationality)||
      snapshot.secondary_nationality===snapshot.nationality)))
  throw new TypeError('invalid_diverse_v4_portrait_snapshot');
 if(!V4_BODY_ARCHETYPES.includes(snapshot.body_profile))
  throw new TypeError('invalid_diverse_v4_body');
 const face=await canonicalTraits(snapshot.player_id);
 if(!snapshot.appearance_traits||typeof snapshot.appearance_traits!=='object'||
    Array.isArray(snapshot.appearance_traits)||
    JSON.stringify(snapshot.appearance_traits)!==JSON.stringify(face.appearance_traits)||
    snapshot.appearance_fingerprint!==face.appearance_fingerprint||
    snapshot.body_variation!==variation(snapshot.body_profile,face.bodyRoll))
  throw new TypeError('noncanonical_diverse_v4_portrait_snapshot');
 const t=snapshot.appearance_traits;
 const physical=[
  'FACE SHAPE: '+t.face+'. CHEEKS: '+t.cheekFullness+'. FOREHEAD: '+t.forehead+'.',
  'EYES: '+t.eyeColor+', '+t.eyeShape+', '+t.eyeSpacing+'. BROWS: '+t.eyebrows+'.',
  'NOSE: '+t.noseBridge+', '+t.noseTip+'. JAW: '+t.jaw+'. CHIN: '+t.chin+'.',
  'MOUTH: '+t.mouth+', '+t.lips+'. EARS: '+t.ears+'.',
  'COMPLEXION: '+t.complexion+'. FACIAL HAIR: '+t.facialHair+'.',
  'HAIR: '+t.hairLength+' length; '+t.hairColor+' color; '+t.hairTexture+
   ' texture; '+t.hairStyle+'; '+t.hairDensity+'; '+t.hairline+'.',
  'SKIN: '+t.skinTexture+'; '+t.skinMark+'.'
 ].join('\n');
 const nationality='Primary nationality: '+COUNTRY_NAMES[snapshot.nationality]+'. '+
  (snapshot.secondary_nationality?'Secondary nationality: '+COUNTRY_NAMES[snapshot.secondary_nationality]+'. ':'');
 return [
  'Create an ultra-photorealistic media-day cutout portrait of EXACTLY ONE fictional adult male footballer.',
  nationality+'These are citizenship details, not ethnicity, facial identity or skin-tone constraints. Never infer ancestry, age or appearance from names, citizenship, club or football position.',
  'IMMUTABLE CANONICAL FACIAL DESCRIPTION: faithfully reproduce EACH listed feature, especially skin complexion, hair color, hair texture, hair length and exact compatible haircut:\n'+physical,
  'PHYSIQUE: '+snapshot.body_profile+'; '+snapshot.body_variation+
   '. This must remain consistent with the frozen initial strength/speed/agility body class, not position or stereotypes. Stamina cannot inflate muscle definition. Ordinary human body softness is welcome; no bodybuilder build, etched abs, sculpted deltoids or oversized biceps.',
  'Look like an ordinary real adult male, chosen for footballing ability rather than looks. Preserve natural asymmetry, non-idealized facial proportions, visible natural skin texture and small imperfections. No beauty retouching, glamorous styling, perfect symmetry, waxy pores, fashion-model faces or advertising lighting.',
  'Exactly one subject standing front-facing with level shoulders, direct gaze, neutral mouth and arms hanging naturally at his sides. Show all hair, complete head, shoulders, both arms, torso and waist DOWN TO HIP LEVEL. Do not show additional people, body doubles, captions, labels, player numbers or a collage.',
  'Plain PURE WHITE short-sleeved REGULAR-FIT football jersey, unbranded, comfortably draped with subtle folds; never skin-tight or body-sculpting. No logo, sponsor, number, text, color trim, props or accessories.',
  'Source image vertical 3:4 with native genuine TRANSPARENT RGBA PNG alpha; background outside the subject must be fully alpha=0, NOT a printed checkerboard, gray backdrop or artificial transparency pattern. Clean naturally antialiased edges without chromatic halo or matte contamination.',
  'Final downstream 320 x 362 WebP QA framing target: 3-8 px significant upper alpha margin; review 0-12 px only when every strand of hair remains visible. Keep at least 20 px transparent side room and horizontal silhouette centered; do not shrink the face or crop hair to meet pixel numbers. The numbers apply to the derivative, not to the original 3:4 PNG.',
  'IMPORTANT: match this SINGLE frozen identity rather than any earlier portrait or example person. Never substitute the same generic photogenic face across multiple IDs. Keep the chosen hair shape compatible with texture and length. Adult male is the only age wording. No automatic publication or owner-approval claim.'
 ].join('\n\n');
}
