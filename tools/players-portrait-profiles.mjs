/**
 * PLAYER-PORTRAITS-02 — offline, deterministic identity specifications for
 * fictional male footballers. Not part of the gameplay generator or public API.
 * This module never reads age, height, position, attributes or aptitude.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const PORTRAIT_SCHEMA_VERSION = 'player-portraits-v1';
export const PORTRAIT_PROMPT_VERSION = 'player-portrait-v2';

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
const hash=(value)=>createHash('sha256').update(value,'utf8').digest();
const requirePlayer=(player)=>{
 if(!player||typeof player!=='object'||Array.isArray(player))throw new TypeError('invalid_player_record');
 if(!Number.isSafeInteger(player.id)||player.id<1)throw new TypeError('invalid_player_id');
 if(!Object.hasOwn(COUNTRY_NAMES,player.nationality))throw new TypeError('invalid_nationality');
 const secondary=player.secondary_nationality??null;
 if(secondary!==null&&(!Object.hasOwn(COUNTRY_NAMES,secondary)||secondary===player.nationality))
  throw new TypeError('invalid_secondary_nationality');
 return {player_id:player.id,nationality:player.nationality,secondary_nationality:secondary};
};

function createTraits(playerId,nonce){
 const digest=hash(`football-architect:portrait-identity:v1:${playerId}:${nonce}`);
 const traits={};
 for(const [index,key] of keys.entries())traits[key]=VARIANTS[key][digest[index]%VARIANTS[key].length];
 return traits;
}
function portraitSentence(traits){
 return `A ${traits.face}, ${traits.complexion}, ${traits.hairColor} with ${traits.hairTexture} in a ${traits.hairStyle}, ${traits.eyes}, ${traits.eyebrows}, ${traits.nose}, ${traits.jaw}, ${traits.facialHair}, and ${traits.detail}.`;
}

/** Build a frozen, unique-on-this-cohort appearance manifest. The existing
 * published manifest, rather than regeneration, is authoritative thereafter.
 * Sort by numeric ID to make input pagination/order irrelevant.
 */
export function buildAppearanceManifest(players){
 if(!Array.isArray(players)||players.length<1)throw new TypeError('players_must_be_nonempty_array');
 const normalized=players.map(requirePlayer).sort((a,b)=>a.player_id-b.player_id);
 const ids=new Set(),signatures=new Set(),entries=[];
 for(const player of normalized){
  if(ids.has(player.player_id))throw new TypeError('duplicate_player_id');
  ids.add(player.player_id);
  let candidate=null;
  for(let nonce=0;nonce<128;nonce++){
   const traits=createTraits(player.player_id,nonce);
   const signature=hash(JSON.stringify(traits)).toString('hex');
   if(!signatures.has(signature)){
    signatures.add(signature);
    candidate={
     ...player,
     appearance_profile:portraitSentence(traits),
     appearance_fingerprint:signature.slice(0,16)
    };
    break;
   }
  }
  if(!candidate)throw new Error('appearance_diversity_exhausted');
  entries.push(Object.freeze(candidate));
 }
 return Object.freeze({schema_version:PORTRAIT_SCHEMA_VERSION,prompt_version:PORTRAIT_PROMPT_VERSION,entries:Object.freeze(entries)});
}

/** Whitelisted V2 visual prompt. No physical/football stats or player name. */
export function buildPortraitPrompt(entry){
 if(!entry||typeof entry!=='object'||typeof entry.appearance_profile!=='string'||
    !Number.isSafeInteger(entry.player_id)||entry.player_id<1||!Object.hasOwn(COUNTRY_NAMES,entry.nationality)||
    (entry.secondary_nationality!=null&&!Object.hasOwn(COUNTRY_NAMES,entry.secondary_nationality)))
  throw new TypeError('invalid_appearance_entry');
 const nationalities=`Primary nationality: ${COUNTRY_NAMES[entry.nationality]}. `+
  (entry.secondary_nationality?`Secondary nationality: ${COUNTRY_NAMES[entry.secondary_nationality]}. `:'');
 return `Create an ultra-photorealistic official club media-day photograph of EXACTLY ONE fictional adult male association football player.\n\n`+
  `${nationalities}These are citizenship/background context, NOT ethnicity or physical-feature rules. `+
  `Secondary nationality does not imply mixed ancestry.\n`+
  `Individual appearance reference: ${entry.appearance_profile}\n\n`+
  `Natural lean and athletic footballer's proportions, ordinary shoulders and arms, modest muscle definition. `+
  `No bodybuilder physique, oversized biceps or fitness-model chest. Natural asymmetry, skin texture and imperfections.\n\n`+
  `Wear a completely plain pure-white short-sleeved football jersey with a regular, comfortable match fit, `+
  `realistic lightweight fabric, subtle seams and natural folds. No logos, crests, sponsors, numbers, stripes, colored trim, or text.\n\n`+
  `Stand upright, head and torso facing directly forward, level shoulders, relaxed arms resting naturally beside the body, `+
  `neutral expression and direct eye contact. Show the entire head, shoulders, torso and waist DOWN TO HIP LEVEL, `+
  `including both sides of the body. Keep a consistent camera distance and centered vertical 3:4 framing.\n\n`+
  `Authentic professional football media-day photography, soft balanced studio lighting, accurate anatomy and facial details, `+
  `natural colors, not a CGI render or fashion advertisement.\n\n`+
  `GENUINELY TRANSPARENT BACKGROUND WITH ALPHA CHANNEL and clean hair edges, transparent PNG. `+
  `No scenery, floor, colored backdrop, artificial checkerboard, cast shadow, watermark or extra objects.`;
}

function parseArgs(args){
 if(args.length!==4||args[0]!=='--input'||args[2]!=='--output'||!args[1]||!args[3])
  throw new Error('usage: node tools/players-portrait-profiles.mjs --input players.json --output appearance-manifest.json');
 return {input:args[1],output:args[3]};
}
async function main(){
 const {input,output}=parseArgs(process.argv.slice(2));
 const json=JSON.parse(await readFile(input,'utf8'));
 const players=Array.isArray(json)?json:json?.players;
 const manifest=buildAppearanceManifest(players);
 await writeFile(output,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 process.stdout.write(`Created ${manifest.entries.length} deterministic appearance profiles: ${output}\n`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
