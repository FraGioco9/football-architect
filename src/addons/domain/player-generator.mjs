/** PLY-REBUILD PLYR-04 — deterministic native generation for attribute schema v2. */
import {ATTRIBUTE_DEFINITIONS,ATTRIBUTE_KEYS,createAttributes,validateAttributes} from './player-attributes.mjs';
import {canonicalPosition,POSITION_WEIGHTS,rawPositionRating,ratePlayer} from './player-ratings.mjs';

const error=code=>{throw new Error(`PLY04_${code}`);};
const hash=s=>{let n=2166136261;for(let i=0;i<s.length;i++){n^=s.charCodeAt(i);n=Math.imul(n,16777619);}return n>>>0;};
const rng=seed=>{let n=seed>>>0;return()=>{n=(n+0x6D2B79F5)>>>0;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};};
const clamp=n=>Math.max(1,Math.min(100,Math.round(n)));
const numberOr=(value,alt)=>typeof value==='number'&&Number.isFinite(value)?value:alt;

const profiles={
 goalkeeper:[
  {id:'shotStopper',it:'Para-tutto',en:'Shot stopper',bias:{reflexes:8,diving:7,oneOnOne:6,handling:4,passing:-6}},
  {id:'sweeperKeeper',it:'Portiere moderno',en:'Sweeper keeper',bias:{rushingOut:8,passing:7,decisions:6,commandArea:3,handling:-2}},
 ],
 defender:[
  {id:'stopper',it:'Marcatore',en:'Stopper',bias:{marking:8,tackling:7,strength:6,bravery:5,passing:-4}},
  {id:'ballPlaying',it:'Difensore impostatore',en:'Ball-playing defender',bias:{passing:8,ballControl:6,decisions:5,vision:4,marking:-3}},
 ],
 fullback:[
  {id:'attackingFullback',it:'Terzino offensivo',en:'Attacking full-back',bias:{crossing:8,pace:7,stamina:6,offBall:4,marking:-4}},
  {id:'defensiveFullback',it:'Terzino difensivo',en:'Defensive full-back',bias:{marking:7,tackling:7,defensivePositioning:6,concentration:4,crossing:-4}},
 ],
 midfield:[
  {id:'playmaker',it:'Regista',en:'Playmaker',bias:{vision:8,passing:8,decisions:6,ballControl:5,tackling:-3}},
  {id:'ballWinner',it:'Incontrista',en:'Ball winner',bias:{tackling:8,defensivePositioning:7,workRate:7,bravery:5,vision:-4}},
 ],
 attackingMid:[
  {id:'creator',it:'Creatore di gioco',en:'Creator',bias:{vision:9,passing:7,ballControl:7,dribbling:6,strength:-3}},
  {id:'goalScorer',it:'Trequartista goleador',en:'Scoring midfielder',bias:{finishing:8,offBall:7,longShots:6,composure:5,marking:-5}},
 ],
 winger:[
  {id:'speedster',it:'Ala veloce',en:'Speedster',bias:{pace:8,acceleration:8,dribbling:7,heading:-4}},
  {id:'wideCreator',it:'Ala creativa',en:'Wide creator',bias:{crossing:9,vision:7,passing:6,ballControl:5,strength:-3}},
 ],
 striker:[
  {id:'poacher',it:'Finalizzatore',en:'Poacher',bias:{finishing:9,offBall:8,composure:7,anticipation:5,marking:-4}},
  {id:'target',it:'Punta di riferimento',en:'Target forward',bias:{strength:8,heading:9,jumping:6,bravery:5,pace:-5}},
 ],
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
function normalizeInput(player){
 if(!player||typeof player!=='object'||Array.isArray(player))error('PLAYER_REQUIRED');
 const id=player.id;
 if(!['string','number'].includes(typeof id)||!String(id).trim())error('PLAYER_ID');
 const position=canonicalPosition(player.position??player.pos??player.role);
 const age=numberOr(player.age,24);
 if(!Number.isInteger(age)||age<15||age>65)error('PLAYER_AGE');
 const generationLevel=numberOr(player.generationLevel,numberOr(player.ovr,numberOr(player.overall,50)));
 if(!Number.isFinite(generationLevel)||generationLevel<1||generationLevel>100)error('GENERATION_LEVEL');
 return {id,position,age,generationLevel};
}
function preferredFoot(player,roll){
 const source=String(player.identity?.preferredFoot??player.preferredFoot??player.foot??'').toLowerCase();
 if(['right','r','destro','dx'].includes(source))return 'right';
 if(['left','l','sinistro','sx'].includes(source))return 'left';
 return roll()<0.2?'left':'right';
}
function groupBase(position,group,level){
 if(position==='GK'){
  if(group==='goalkeeper')return level;
  if(group==='physical')return level-10;
  if(group==='mental')return level-8;
  return level-22;
 }
 if(group==='goalkeeper')return Math.max(1,level*0.16);
 return level;
}

/** Generates skills first. Rating is derived afterwards; there is no OVR calibration pass. */
export function generatePlayerAttributes(player,{seed=0,countryId=''}={}){
 const {id,position,age,generationLevel}=normalizeInput(player);
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)error('SEED');
 const nationality=String(player.identity?.nationality?.primary??player.nationality??player.country??countryId??'');
 const roll=rng(hash(`${seed}|${player.globalId??id}|${position}|${age}|${nationality}|PLY04/2`));
 const archetypes=profiles[family(position)];
 const archetype=archetypes[Math.floor(roll()*archetypes.length)];
 const foot=preferredFoot(player,roll),weights=POSITION_WEIGHTS[position],values={};

 for(const definition of ATTRIBUTE_DEFINITIONS){
  const key=definition.key;
  let offset=archetype.bias[key]??0;
  if(definition.group!=='goalkeeper'&&weights[key])offset+=2.5;
  if(definition.group==='physical'){
   if(['pace','acceleration','stamina','agility'].includes(key))offset+=(25-age)*0.42;
   if(['strength','jumping'].includes(key))offset+=(age-25)*0.14;
  }
  if(['decisions','anticipation','composure','vision','concentration'].includes(key))offset+=(age-25)*0.17;
  if(['corners','freeKicks','penalties'].includes(key))offset-=4;
  const jitter=(roll()+roll()+roll()+roll()-2)*11;
  values[key]=clamp(groupBase(position,definition.group,generationLevel)+offset+jitter);
 }
 const attributeProfile=createAttributes(values,{
  origin:'native-v2-generation',generationVersion:2,seed:seed>>>0,
  profile:{archetype:archetype.id,archetypeName:{it:archetype.it,en:archetype.en},preferredFoot:foot,age,nationality,naturalPosition:position}
 });
 const generatedOvr=Math.round(rawPositionRating(attributeProfile.values,position));
 return {attributeProfile,generatedOvr,archetype:archetype.id};
}

export function readPlayerAttributes(player,options={}){
 if(!player||typeof player!=='object')error('PLAYER_REQUIRED');
 if(player.attributeProfile!==undefined&&player.attributeProfile!==null){
  validateAttributes(player.attributeProfile);return structuredClone(player.attributeProfile);
 }
 return generatePlayerAttributes(player,options).attributeProfile;
}
export function copyPlayerWithAttributes(player,options={}){
 const generated=generatePlayerAttributes(player,options);
 return {...structuredClone(player),attributeProfile:generated.attributeProfile,ovr:generated.generatedOvr};
}
export function ratingSnapshot(player,options={}){
 const profile=readPlayerAttributes(player,options);
 return {...ratePlayer({...player,position:canonicalPosition(player.position??player.pos??player.role)},profile),profile};
}
