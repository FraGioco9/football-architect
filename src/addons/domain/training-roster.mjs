/** MGT04.02/.03: training-only player snapshots; no implicit writes to legacy careers. */
import {readDevelopment,validateDevelopment} from './player-development.mjs';
import {readMedical,validateMedical} from './player-medical.mjs';
import {readPersonality} from './player-personality.mjs';
import {evaluatePersonalityEffects} from './player-personality-effects.mjs';
import {validateAttributes,ATTRIBUTE_KEYS} from './player-attributes.mjs';
import {canonicalPosition} from './player-ratings.mjs';
import {ROLE_BY_ID} from './player-roles.mjs';
import {obj,validId,checkInt,checkNum,fail,copy} from './training-plan.mjs';
export const TRAINING_ROSTER_SCHEMA=1;
const validKey=s=>typeof s==='string'&&/^[a-zA-Z0-9-]{2,40}$/.test(s)&&!['__proto__','prototype','constructor'].includes(s);
export function validateTrainingRoster(roster){
 if(!obj(roster)||roster.schemaVersion!==1||!validId(roster.clubId)||!obj(roster.players))fail('ROSTER_SCHEMA');
 if(Object.keys(roster.players).length>1000)fail('ROSTER_SIZE');
 for(const [key,p] of Object.entries(roster.players)){
  if(!validId(key)||['__proto__','constructor','prototype'].includes(key)||!obj(p)||String(p.id)!==key)fail('ROSTER_PLAYER');
  if(typeof p.name!=='string'||p.name.length>200)fail('PLAYER_NAME');
  if(canonicalPosition(p.position)!==p.position)fail('PLAYER_POSITION');checkInt(p.age,15,110,'AGE');
  checkNum(p.baselineOvr,1,100,'OVR');checkNum(p.potential,1,100,'POTENTIAL');checkNum(p.trainingFactor,0.8,1.2,'TRAINING_FACTOR');
  validateAttributes(p.attributes);validateMedical(p.medical);if(p.medical.playerId!==key)fail('MEDICAL_PLAYER');
  if(!obj(p.carry)||Object.keys(p.carry).length>ATTRIBUTE_KEYS.length)fail('CARRY');
  for(const [a,val] of Object.entries(p.carry))if(!ATTRIBUTE_KEYS.includes(a)||!Number.isFinite(val)||val<0||val>=1)fail('CARRY_VALUE');
  if(!obj(p.familiarity)||!obj(p.familiarity.formations)||!obj(p.familiarity.roles))fail('FAMILIARITY');
  if(Object.keys(p.familiarity.formations).length>12||Object.keys(p.familiarity.roles).length>30)fail('FAMILIARITY_SIZE');
  for(const [k,v] of Object.entries(p.familiarity.formations))if(!validKey(k)||!Number.isFinite(v)||v<0||v>100)fail('FAMILIARITY_FORMATION');
  for(const [k,v] of Object.entries(p.familiarity.roles))if(!Object.hasOwn(ROLE_BY_ID,k)||!Number.isFinite(v)||v<0||v>100)fail('FAMILIARITY_ROLE');
 }
 return true;
}
export function createTrainingRoster(clubId,players,{seed=0,countryId='',day=0}={}){
 if(!validId(clubId)||!Array.isArray(players)||players.length>1000||players.length===0)fail('ROSTER');checkInt(seed,0,0xffffffff,'SEED');checkInt(day,0,9999999,'DAY');
 const roster={schemaVersion:1,clubId:String(clubId),players:Object.create(null)};
 for(const p of players){
  if(!obj(p)||!validId(p.id)||Object.hasOwn(roster.players,String(p.id)))fail('DUPLICATE_PLAYER');
  const d=readDevelopment(p,{seed,countryId});validateDevelopment(d);
  const m=readMedical(p,{day});if(m.lastDay>day)fail('MEDICAL_FUTURE');
  const factor=evaluatePersonalityEffects(readPersonality(p,{seed,countryId})).factors.training;
  const key=String(p.id);
  roster.players[key]={id:key,name:String(p.name??p.fullName??`Player ${key}`),position:d.position,age:d.age,potential:d.potential,
   baselineOvr:d.baselineOvr,trainingFactor:factor,attributes:copy(d.attributes),medical:m,carry:{},
   familiarity:{formations:{},roles:{}}};
 }
 validateTrainingRoster(roster);return roster;
}
/** Form and role familiarity is separate from ability and position OVR. */
export function familiarityFor(roster,playerId,{formation='4231',role=null}={}){
 validateTrainingRoster(roster);if(!validId(playerId)||!roster.players[String(playerId)])fail('PLAYER_ID');
 const player=roster.players[String(playerId)];
 if(!validKey(formation))fail('FORMATION');if(role!==null&&!Object.hasOwn(ROLE_BY_ID,role))fail('ROLE');
 return {formation:player.familiarity.formations[formation]??0,role:role===null?null:(player.familiarity.roles[role]??0)};
}
