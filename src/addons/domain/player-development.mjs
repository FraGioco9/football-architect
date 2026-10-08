/** Football Architect PLY03.01/.02/.03 — opt-in pure seasonal development.
 * This module DOES NOT change save data, official OVR, fixture results or old RNG.
 * State is explicit/versioned, serialized separately only after integration approval.
 */
import {ATTRIBUTE_DEFINITIONS,ATTRIBUTE_KEYS,clampAttribute,validateAttributes,createAttributes} from './player-attributes.mjs';
import {readPlayerAttributes} from './player-generator.mjs';
import {canonicalPosition,POSITION_WEIGHTS,rawPositionRating} from './player-ratings.mjs';
import {readPersonality,validatePersonality} from './player-personality.mjs';
import {evaluatePersonalityEffects} from './player-personality-effects.mjs';

export const DEVELOPMENT_SCHEMA_VERSION=1;
export const DEVELOPMENT_PROGRAMS=Object.freeze(['balanced','role','technical','physical','mental','goalkeeper']);
const groups=Object.fromEntries(ATTRIBUTE_DEFINITIONS.map(x=>[x.key,x.group]));
const declineKeys=new Set(['acceleration','pace','agility','stamina','jumping','strength','balance']);
const compensatingKeys=new Set(['decisions','anticipation','composure','vision','concentration','teamwork','ballControl','passing','keeperPositioning']);
const err=code=>{throw new Error(`PLY03_${code}`)};
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const finite=(x,min,max,name)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)err(name);return x;};
const int=(x,min,max,name)=>{if(!Number.isSafeInteger(x)||x<min||x>max)err(name);return x;};
const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
const avg=(o,keys)=>keys.reduce((s,k)=>s+o[k],0)/keys.length;
const round=n=>Math.round(n*100)/100;
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function draw(s){let a=hash(s);a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
export function seededPotential(player,{seed=0}={}){
 int(seed,0,0xffffffff,'SEED');
 if(!obj(player)||!['number','string'].includes(typeof player.id)||!String(player.id).trim())err('PLAYER');
 if(player.potential!==undefined&&player.potential!==null)return int(player.potential,1,100,'POTENTIAL');
 const overall=finite(player.ovr??player.overall??50,1,100,'OVR');
 return limit(Math.round(overall+4+draw(`${seed}|potential|${player.id}`)*15),1,100);
}
export function validateDevelopment(state){
 if(!obj(state)||state.schemaVersion!==DEVELOPMENT_SCHEMA_VERSION)err('VERSION');
 if(typeof state.playerId!=='string'||!state.playerId.trim())err('PLAYER_ID');
 if(canonicalPosition(state.position)!==state.position)err('POSITION');
 int(state.age,15,110,'AGE');int(state.lastSeason,0,500,'SEASON');
 int(state.potential,1,100,'POTENTIAL');finite(state.baselineOvr,1,100,'BASELINE_OVR');
 int(state.seed,0,0xffffffff,'SEED');validateAttributes(state.attributes);
 if(!Array.isArray(state.history)||state.history.length>100||state.history.some(x=>!obj(x)))err('HISTORY');
 let previous=-1;
 for(const h of state.history){
  int(h.season,1,500,'HISTORY_SEASON');if(h.season<=previous||h.season>state.lastSeason)err('HISTORY_ORDER');previous=h.season;
  int(h.age,15,110,'HISTORY_AGE');finite(h.rating,1,100,'HISTORY_RATING');finite(h.delta,-100,100,'HISTORY_DELTA');
  finite(h.form,0,100,'HISTORY_FORM');int(h.minutes,0,6000,'HISTORY_MINUTES');
  if(!DEVELOPMENT_PROGRAMS.includes(h.program)||!Array.isArray(h.changes)||h.changes.length>ATTRIBUTE_KEYS.length||!Array.isArray(h.reasons))err('HISTORY_RECORD');
  if(h.changes.some(c=>!obj(c)||!ATTRIBUTE_KEYS.includes(c.attribute)||!Number.isInteger(c.from)||c.from<1||c.from>100||!Number.isInteger(c.to)||c.to<1||c.to>100||c.from===c.to))err('HISTORY_CHANGES');
  if(!Array.isArray(h.focusAttributes)||h.focusAttributes.length>5||new Set(h.focusAttributes).size!==h.focusAttributes.length||h.focusAttributes.some(k=>!ATTRIBUTE_KEYS.includes(k)))err('HISTORY_FOCUS');
  finite(h.workload,0,100,'HISTORY_WORKLOAD');
 }
 if(state.history.length&&state.history.at(-1).season!==state.lastSeason)err('HISTORY_LAST');
 return true;
}
/** Initialize from old player without changing the player or its current OVR. */
export function initialDevelopment(player,{seed=0,countryId='',startSeason=1}={}){
 if(!obj(player))err('PLAYER');int(startSeason,1,500,'SEASON');int(seed,0,0xffffffff,'SEED');
 const position=canonicalPosition(player.position??player.pos??player.role);
 const age=int(player.age??24,15,95,'AGE');
 const baselineOvr=finite(player.ovr??player.overall??50,1,100,'OVR');
 const attributes=readPlayerAttributes(player,{seed,countryId});
 const result={schemaVersion:DEVELOPMENT_SCHEMA_VERSION,playerId:String(player.id),position,age,lastSeason:startSeason-1,seed,potential:seededPotential(player,{seed}),baselineOvr,attributes,history:[]};
 validateDevelopment(result);return result;
}
/** Explicit import only: existing newer versions are rejected, never silently overwritten. */
export function readDevelopment(player,{seed=0,countryId='',startSeason=1}={}){
 if(!obj(player))err('PLAYER');
 if(player.developmentV1!==undefined&&player.developmentV1!==null){validateDevelopment(player.developmentV1);if(player.developmentV1.playerId!==String(player.id))err('PLAYER_MISMATCH');return structuredClone(player.developmentV1);}
 return initialDevelopment(player,{seed,countryId,startSeason});
}
export function copyPlayerWithDevelopment(player,options={}){
 return {...structuredClone(player),developmentV1:readDevelopment(player,options)};
}
export function growthWindow(age,position){
 int(age,15,110,'AGE');canonicalPosition(position);
 const a=position==='GK'?age-2:age;
 if(a<19)return 1.5;
 if(a<22)return 1.2;
 if(a<25)return 0.87;
 if(a<28)return 0.55;
 if(a<31)return 0.30;
 if(a<34)return 0.12;
 return 0;
}
/** Positive influence relative to player role & training style, no mutation. */
export function attributeTrainingWeight(position,key,program='balanced'){
 const pos=canonicalPosition(position);
 if(!ATTRIBUTE_KEYS.includes(key))err('ATTRIBUTE');
 if(!DEVELOPMENT_PROGRAMS.includes(program))err('PROGRAM');
 const g=groups[key],isKeeper=pos==='GK';
 if(program==='goalkeeper'&&!isKeeper)err('PROGRAM_POSITION');
 if(g==='goalkeeper'&&!isKeeper)return 0;
 if(g!=='goalkeeper'&&isKeeper&&g==='technical')return 0.22;
 const positional=(POSITION_WEIGHTS[pos][key]??0)/22;
 const focus={balanced:0.82,role:0.55+positional*1.6,technical:g==='technical'?1.65:0.35,physical:g==='physical'?1.65:0.35,mental:g==='mental'?1.65:0.35,goalkeeper:g==='goalkeeper'?1.8:0.30}[program];
 // Outfield players cannot choose keeper-only development as a primary focus.
 if(program==='goalkeeper'&&!isKeeper)err('PROGRAM_POSITION');
 return round(focus*(0.85+0.45*positional));
}
export function developmentContext(state,player,{minutes=1800,workload=55,form=50,program='balanced',focusAttributes=[],personality,season}={}){
 validateDevelopment(state);
 if(!obj(player)||String(player.id)!==state.playerId)err('PLAYER_MISMATCH');
 const intended=season??state.lastSeason+1;int(intended,1,500,'SEASON');
 int(minutes,0,6000,'MINUTES');finite(workload,0,100,'WORKLOAD');finite(form,0,100,'FORM');
 if(!DEVELOPMENT_PROGRAMS.includes(program))err('PROGRAM');
 if(program==='goalkeeper'&&state.position!=='GK')err('PROGRAM_POSITION');
 if(!Array.isArray(focusAttributes)||focusAttributes.length>5||new Set(focusAttributes).size!==focusAttributes.length||focusAttributes.some(k=>!ATTRIBUTE_KEYS.includes(k)))err('FOCUS_ATTRIBUTES');
 if(state.position!=='GK'&&focusAttributes.some(k=>groups[k]==='goalkeeper'))err('FOCUS_POSITION');
 const traits=personality??readPersonality(player,{seed:state.seed});validatePersonality(traits);
 const p=evaluatePersonalityEffects(traits);
 const age=state.age;
 const current=rawPositionRating(state.attributes.values,state.position);
 const potentialGap=Math.max(0,state.potential-current);
 const minutesFactor=limit(0.20+minutes/2800,0.20,1.40);
 const workloadFactor=workload<25?0.72:workload<=70?1:limit(1-(workload-70)/50,0.4,1);
 const talentFactor=limit((potentialGap+1)/16,0,1.35);
 return {season:intended,age,minutes,workload,form,program,focusAttributes:[...focusAttributes],minutesFactor,workloadFactor,talentFactor,potentialGap,current:round(current),personalityTraining:p.factors.training,growth:round(growthWindow(age,state.position)),traits};
}
/** Pure annual transaction. Same season on an already updated record is an exact no-op.
 * Future/non-consecutive season IDs are rejected instead of double-applying a year.
 */
export function simulateDevelopmentSeason(state,player,options={}){
 validateDevelopment(state);
 if(!obj(player)||String(player.id)!==state.playerId)err('PLAYER_MISMATCH');
 const season=options.season??state.lastSeason+1;
 if(season===state.lastSeason)return structuredClone(state);
 if(season!==state.lastSeason+1||state.age>=110)err('SEASON_SEQUENCE');
 const ctx=developmentContext(state,player,{...options,season});
 const values={...state.attributes.values},changes=[];
 const age=ctx.age;
 const isGk=state.position==='GK';
 for(const key of ATTRIBUTE_KEYS){
  const start=values[key],group=groups[key];
  const weighted=attributeTrainingWeight(state.position,key,ctx.program);
  const talent=ctx.focusAttributes.length?(ctx.focusAttributes.includes(key)?weighted*2.4:weighted*0.78):weighted;
  const r=draw(`PLY03|${state.seed}|${state.playerId}|${season}|${key}`);
  const rDecline=draw(`PLY03/decline|${state.seed}|${state.playerId}|${season}|${key}`);
  let delta=0;
  const growth=ctx.growth*ctx.talentFactor*ctx.minutesFactor*ctx.workloadFactor*ctx.personalityTraining*talent;
  // Stochastic rounded seasonal increase, limited per attribute and per season.
  const expected=limit(growth*1.30,0,3.30);
  const inc=Math.floor(expected)+(r<expected%1?1:0);
  if(group!=='goalkeeper'||isGk)delta+=inc;
  if(group==='physical'&&declineKeys.has(key)){
   const startAge=key==='strength'?35:key==='balance'?33:key==='jumping'?31:29;
   if(age>=startAge){
    const old=age-startAge+1;
    const sensitivity=['pace','acceleration','stamina'].includes(key)?1.0:key==='agility'?0.82:key==='strength'?0.38:0.62;
    const expectedDecline=limit((0.28+old*0.15)*sensitivity*(isGk?0.77:1),0,5.2);
    const loss=Math.floor(expectedDecline)+(rDecline<expectedDecline%1?1:0);
    delta-=loss;
   }
  }
  // Limited tactical experience; does not automatically offset physical aging.
  if(compensatingKeys.has(key)&&age>=30&&age<=40){
   const chance=0.10*ctx.minutesFactor*ctx.personalityTraining*(age>36?0.65:1);
   if(draw(`PLY03/experience|${state.seed}|${state.playerId}|${season}|${key}`)<chance)delta+=1;
  }
  // Aging eventually affects all active abilities but not at the same rate.
  if(age>=40&&group!=='goalkeeper'&&group!=='physical'&&rDecline<limit((age-39)*0.025,0,0.75))delta-=1;
  const value=clampAttribute(start+limit(delta,-6,4));
  values[key]=value;
  if(value!==start)changes.push({attribute:key,from:start,to:value,delta:value-start});
 }
 const attributes=createAttributes(values,{
  ...structuredClone(state.attributes.metadata??{}),developmentSchemaVersion:DEVELOPMENT_SCHEMA_VERSION,
  lastDevelopmentSeason:season,
 });
 const rating=round(rawPositionRating(attributes.values,state.position));
 const prevRating=round(rawPositionRating(state.attributes.values,state.position));
 const reasons=['age','minutes','potential_gap','training_program','personality','workload'];
 if(age>=29)reasons.push('physical_decline');
 if(age>=30&&age<=40)reasons.push('experience_compensation');
 const entry={season,age:age+1,rating,delta:round(rating-prevRating),form:ctx.form,minutes:ctx.minutes,workload:ctx.workload,program:ctx.program,focusAttributes:ctx.focusAttributes,changes,reasons};
 const next={...state,age:age+1,lastSeason:season,attributes,history:[...state.history,entry].slice(-100)};
 validateDevelopment(next);return next;
}
/** Multiple seasons are deterministic and resumable; callers supply season-specific inputs. */
export function simulateDevelopmentYears(state,player,inputs){
 if(!Array.isArray(inputs)||inputs.length>100)err('YEARS');
 return inputs.reduce((s,options)=>simulateDevelopmentSeason(s,player,options),state);
}
