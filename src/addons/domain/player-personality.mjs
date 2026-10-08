/** Football Architect — PLYR-06.1: seven stable, private personality traits.
 * Version 2 intentionally does not migrate obsolete v1 profiles.
 */
export const PERSONALITY_SCHEMA_VERSION=2;
export const TRAITS=Object.freeze([
  Object.freeze({key:'professionalism',label:{it:'Professionalità',en:'Professionalism'}}),
  Object.freeze({key:'ambition',label:{it:'Ambizione',en:'Ambition'}}),
  Object.freeze({key:'loyalty',label:{it:'Lealtà',en:'Loyalty'}}),
  Object.freeze({key:'determination',label:{it:'Determinazione',en:'Determination'}}),
  Object.freeze({key:'temperament',label:{it:'Temperamento',en:'Temperament'}}),
  Object.freeze({key:'adaptability',label:{it:'Adattabilità',en:'Adaptability'}}),
  Object.freeze({key:'leadership',label:{it:'Leadership',en:'Leadership'}}),
]);
export const TRAIT_KEYS=Object.freeze(TRAITS.map(x=>x.key));
const invalid=(why)=>{throw new Error(`PLY02_${why}`);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const fnv=(s)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
export const seeded=(seed)=>{let n=seed>>>0;return()=>{n=(n+0x6D2B79F5)>>>0;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};};
const normalizedSeed=n=>{if(!Number.isSafeInteger(n)||n<0||n>0xffffffff)invalid('SEED');return n>>>0;};
export function validatePersonality(record){
 if(!object(record))invalid('RECORD');
 if(record.schemaVersion!==PERSONALITY_SCHEMA_VERSION)invalid('UNKNOWN_VERSION');
 if(!object(record.traits)||Object.keys(record.traits).length!==TRAIT_KEYS.length||!TRAIT_KEYS.every(k=>Number.isInteger(record.traits[k])&&record.traits[k]>=1&&record.traits[k]<=100))invalid('TRAITS');
 if(Object.keys(record.traits).some(k=>!TRAIT_KEYS.includes(k)))invalid('UNKNOWN_TRAIT');
 if(record.metadata!==undefined&&!object(record.metadata))invalid('METADATA');
 return true;
}
export function createPersonality(traits,metadata={}){
 if(!object(traits)||!object(metadata))invalid('RECORD');
 const record={schemaVersion:PERSONALITY_SCHEMA_VERSION,traits:{...traits},metadata:structuredClone(metadata)};
 validatePersonality(record);return record;
}
/** Derives a stable private profile from world seed and global player identity.
 * Nationality, age, language and ambient time do not select personality values.
 */
export function generatePersonality(player,{seed=0,countryId=''}={}){
 if(!object(player))invalid('PLAYER_ID');
 const uniqueId=player.globalId??player.id;
 if(!['string','number'].includes(typeof uniqueId)||String(uniqueId).trim()==='')invalid('PLAYER_ID');
 const country=String(countryId??'');
 const key=`PLYR-06/2|${normalizedSeed(seed)}|${country}|${String(uniqueId)}`;
 const roll=seeded(fnv(key));const traits={};
 for(const name of TRAIT_KEYS){
  // Triangular distribution reduces extreme personalities without relying on Math.random.
  const jitter=(roll()+roll()+roll()-1.5)*44;
  traits[name]=clamp(Math.round(50+jitter),1,100);
 }
 return createPersonality(traits,{origin:'deterministic-player-v2',generationVersion:2});
}
/** Existing future/invalid profiles fail rather than being silently regenerated. */
export function readPersonality(player,options={}){
 if(!object(player))invalid('PLAYER');
 const stored=player.personalityProfile;
 if(stored!==null&&stored!==undefined){validatePersonality(stored);return structuredClone(stored);}
 return generatePersonality(player,options);
}
export function copyWithPersonality(player,options={}){
 return {...structuredClone(player),personalityProfile:readPersonality(player,options)};
}
export function describeTrait(trait,value,lang='it'){
 if(!TRAIT_KEYS.includes(trait))invalid('UNKNOWN_TRAIT');
 if(!Number.isInteger(value)||value<1||value>100)invalid('TRAIT_VALUE');
 const l=String(lang).toLowerCase().startsWith('en')?'en':'it';
 const tone=value>=73?'high':value<=32?'low':'mid';
 const labels={
  it:{high:'molto evidente',mid:'equilibrato',low:'poco evidente'},
  en:{high:'very pronounced',mid:'balanced',low:'less pronounced'},
 };
 return labels[l][tone];
}
