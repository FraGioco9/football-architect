/** PLY01.02 + PLY01.05 — seeded profiles and non-destructive legacy projection. */
import {ATTRIBUTE_DEFINITIONS,ATTRIBUTE_KEYS,createAttributes,validateAttributes,clampAttribute} from './player-attributes.mjs';
import {canonicalPosition,POSITION_WEIGHTS,rawPositionRating,ratePlayer} from './player-ratings.mjs';
const error=(code)=>{throw new Error(`PLY01_${code}`)};
const hash=(s)=>{let n=2166136261;for(let i=0;i<s.length;i++){n^=s.charCodeAt(i);n=Math.imul(n,16777619);}return n>>>0;};
const rng=(seed)=>{let n=seed>>>0;return()=>{n=(n+0x6D2B79F5)>>>0;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};};
const profiles={
 goalkeeper:[{id:'shotStopper',it:'Para-tutto',en:'Shot stopper',bias:{reflexes:8,diving:7,oneOnOne:5,distribution:-6}},{id:'sweeperKeeper',it:'Portiere moderno',en:'Sweeper keeper',bias:{distribution:9,rushingOut:7,decisions:5,handling:-3}}],
 defender:[{id:'stopper',it:'Marcatore',en:'Stopper',bias:{marking:7,tackling:7,strength:6,technique:-4}},{id:'ballPlaying',it:'Difensore impostatore',en:'Ball-playing defender',bias:{shortPassing:7,longPassing:7,technique:7,marking:-4}}],
 fullback:[{id:'attackingFullback',it:'Terzino offensivo',en:'Attacking full-back',bias:{crossing:7,pace:7,stamina:5,marking:-5}},{id:'defensiveFullback',it:'Terzino difensivo',en:'Defensive full-back',bias:{marking:7,tackling:7,defensivePositioning:6,crossing:-5}}],
 midfield:[{id:'playmaker',it:'Regista',en:'Playmaker',bias:{vision:8,longPassing:7,shortPassing:7,aggression:-4}},{id:'ballWinner',it:'Incontrista',en:'Ball winner',bias:{tackling:8,defensivePositioning:7,workRate:7,vision:-4}}],
 attackingMid:[{id:'creator',it:'Creatore di gioco',en:'Creator',bias:{vision:9,technique:7,dribbling:7,strength:-3}},{id:'goalScorer',it:'Trequartista goleador',en:'Scoring midfielder',bias:{finishing:8,offBall:7,longShots:6,marking:-5}}],
 winger:[{id:'speedster',it:'Ala veloce',en:'Speedster',bias:{pace:8,acceleration:8,dribbling:6,heading:-4}},{id:'wideCreator',it:'Ala creativa',en:'Wide creator',bias:{crossing:9,vision:7,shortPassing:6,strength:-3}}],
 striker:[{id:'poacher',it:'Finalizzatore',en:'Poacher',bias:{finishing:9,offBall:8,composure:7,marking:-4}},{id:'target',it:'Punta di riferimento',en:'Target forward',bias:{strength:8,heading:9,jumping:6,pace:-5}}],
};
export const ARCHETYPES=Object.freeze(profiles);
function family(position){
 if(position==='GK')return 'goalkeeper';
 if(position==='CB')return 'defender';
 if(['RB','LB','RWB','LWB'].includes(position))return 'fullback';
 if(['CDM','CM'].includes(position))return 'midfield';
 if(['CAM','CF'].includes(position))return 'attackingMid';
 if(['RM','LM','RW','LW'].includes(position))return 'winger';
 return 'striker';
}
function numberOr(value,alt){return typeof value==='number'&&Number.isFinite(value)?value:alt;}
function normalizeInput(player){
 if(!player||typeof player!=='object'||Array.isArray(player))error('PLAYER_REQUIRED');
 const id=player.id;
 if(!(['string','number'].includes(typeof id))||String(id).trim()==='')error('PLAYER_ID');
 const position=canonicalPosition(player.position??player.pos??player.role);
 const ovr=numberOr(player.ovr,numberOr(player.overall,50));
 if(!Number.isFinite(ovr)||ovr<1||ovr>100)error('PLAYER_OVR');
 const age=numberOr(player.age,24);
 if(!Number.isInteger(age)||age<15||age>65)error('PLAYER_AGE');
 return {id,position,ovr,age};
}
function extractFoot(p,rand){
 const source=String(p.preferredFoot??p.foot??'').toLowerCase();
 if(['right','r','destro','dx'].includes(source))return 'right';
 if(['left','l','sinistro','sx'].includes(source))return 'left';
 if(['both','ambidextrous','both feet','entrambi'].includes(source))return 'both';
 return rand()<0.16?'left':rand()<0.10?'both':'right';
}
const rounded = n => Math.max(1,Math.min(100,Math.round(n)));
/** Binary calibration only shifts field strengths; no mutations or changes to old OVR. */
function calibrate(values,pos,target){
 const weights=POSITION_WEIGHTS[pos];
 let lo=-160,hi=160;
 for(let i=0;i<34;i++){
  const mid=(lo+hi)/2;
  const score=Object.entries(weights).reduce((a,[k,w])=>a+Math.max(1,Math.min(100,values[k]+mid))*w,0)/100;
  if(score<target)lo=mid;else hi=mid;
 }
 const shift=(lo+hi)/2;
 for(const k of ATTRIBUTE_KEYS)if(pos==='GK'?(['goalkeeper','mental','physical'].includes(ATTRIBUTE_DEFINITIONS.find(d=>d.key===k).group)):ATTRIBUTE_DEFINITIONS.find(d=>d.key===k).group!=='goalkeeper')values[k]=rounded(values[k]+shift);
 return values;
}
/** Project legacy, never modifies player, world, RNG of the official game, or save schema. */
export function generatePlayerAttributes(player,{seed=0,countryId=''}={}){
 const {id,position,ovr,age}=normalizeInput(player);
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)error('SEED');
 const nationality=String(player.nationality??player.country??countryId??'');
 const roll=rng(hash(`${seed}|${id}|${position}|${age}|${nationality}|PLY01/1`));
 const archetypes=profiles[family(position)];
 const archetype=archetypes[Math.floor(roll()*archetypes.length)];
 const foot=extractFoot(player,roll);
 const values={};
 const weights=POSITION_WEIGHTS[position];
 for(const definition of ATTRIBUTE_DEFINITIONS){
  const k=definition.key;
  const isGk=position==='GK',isKeeperSkill=definition.group==='goalkeeper';
  let base=isGk?!isKeeperSkill?ovr-22:ovr: isKeeperSkill?Math.max(1,ovr*0.20):ovr;
  let offset=archetype.bias[k]??0;
  if(!isKeeperSkill&&weights[k])offset+=3;
  if(definition.group==='physical') {
   if(['pace','acceleration','stamina','agility','recovery'].includes(k))offset+=(25-age)*0.43;
   if(['strength','jumping'].includes(k))offset+=(age-25)*0.13;
  }
  if(['decisions','anticipation','composure','vision'].includes(k))offset+=(age-25)*0.18;
  // Stable small player-specific deviations. Uses only locally seeded RNG.
  const jitter=(roll()+roll()+roll()-1.5)*10;
  values[k]=rounded(base+offset+jitter);
 }
 calibrate(values,position,ovr);
 const rating=rawPositionRating(values,position);
 if(Math.abs(rating-ovr)>2.2)error('LEGACY_CALIBRATION');
 const profile={archetype:archetype.id,archetypeName:{it:archetype.it,en:archetype.en},preferredFoot:foot,age,nationality,reputation:Math.round(numberOr(player.reputation,ovr*0.9)),naturalPosition:position,legacyOvr:ovr};
 return createAttributes(values,{origin:'deterministic-v1-projection',generationVersion:1,seed:seed>>>0,profile});
}
/** Opt-in: prefer already versioned records. Malformed/future records fail explicitly. */
export function readPlayerAttributes(player,options={}){
 if(!player||typeof player!=='object')error('PLAYER_REQUIRED');
 const existing=player.attributeProfile??player.attributesV1;
 if(existing!==undefined&&existing!==null){validateAttributes(existing);return structuredClone(existing);}
 return generatePlayerAttributes(player,options);
}
/** Explicit migration helper for a NEW schema, never called on load automatically. */
export function copyPlayerWithAttributes(player,options={}){
 const attributeProfile=readPlayerAttributes(player,options);
 return {...structuredClone(player),attributeProfile};
}
export function legacyParity(player,options={}){
 const profile=readPlayerAttributes(player,options);
 const result=ratePlayer({...player,position:canonicalPosition(player.position??player.pos??player.role)},profile);
 return {...result,delta:result.derivedOvr-(player.ovr??player.overall??50),profile};
}
