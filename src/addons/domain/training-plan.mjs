/** MGT04.01/.02/.05 — immutable, week-scoped training plan. No career writes. */
import {ATTRIBUTE_KEYS,ATTRIBUTE_BY_KEY} from './player-attributes.mjs';
import {ROLE_BY_ID} from './player-roles.mjs';
import {canonicalPosition} from './player-ratings.mjs';
export const TRAINING_SCHEMA_VERSION=1;
export const TRAINING_KINDS=Object.freeze(['technical','tactical','physical','recovery','rest','match']);
export const TRAINING_GOALS=Object.freeze(['development','fitness','familiarity']);
export const TRAINING_PROGRAMS=Object.freeze(['balanced','role','technical','physical','mental','goalkeeper']);
export const TRAINING_WEEK_DAYS=7;
export const WEEKLY_LOAD_LIMIT=290;
export const fail=code=>{throw new Error(`MGT04_${code}`);};
export const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export const validId=v=>(typeof v==='string'&&v.trim().length>0&&v.length<=100)||(Number.isSafeInteger(v)&&v>0);
export const checkInt=(v,min,max,code)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail(code);return v;};
export const checkNum=(v,min,max,code)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(code);return v;};
export const copy=v=>structuredClone(v);
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const OWN=(o,k)=>Object.hasOwn(o,k);
const DEFAULT=[['technical',50],['tactical',50],['physical',55],['recovery',0],['technical',40],['tactical',35],['rest',0]];
const weight={technical:0.9,tactical:0.75,physical:1.15,recovery:0,rest:0,match:0};
export const loadForSession=s=>Math.round(s.intensity*weight[s.kind]*100)/100;
export const weekLoad=sessions=>Math.round(sessions.reduce((n,s)=>n+loadForSession(s),0)*100)/100;
export function validateIndividual(p){
 if(!obj(p)||!TRAINING_PROGRAMS.includes(p.program)||!TRAINING_GOALS.includes(p.goal))fail('PROGRAM');
 checkInt(p.intensity,0,100,'INTENSITY');if(!Array.isArray(p.focus)||p.focus.length>5||new Set(p.focus).size!==p.focus.length||p.focus.some(k=>!ATTRIBUTE_KEYS.includes(k)))fail('FOCUS');
 if(p.role!==null&&(typeof p.role!=='string'||!OWN(ROLE_BY_ID,p.role)))fail('ROLE');return true;
}
export function validateTrainingWeek(plan){
 if(!obj(plan)||plan.schemaVersion!==1||!validId(plan.clubId)||!obj(plan.individuals))fail('SCHEMA');
 checkInt(plan.weekStartDay,1,9999999,'WEEK_START');checkInt(plan.revision,0,999999,'REVISION');
 if(typeof plan.formation!=='string'||!/^[a-zA-Z0-9-]{2,20}$/.test(plan.formation))fail('FORMATION');
 if(typeof plan.delegated!=='boolean')fail('DELEGATED');
 if(!Array.isArray(plan.sessions)||plan.sessions.length!==TRAINING_WEEK_DAYS)fail('SESSIONS');
 let physical=0;
 for(const [index,s] of plan.sessions.entries()){
  if(!obj(s)||s.dayIndex!==index||!TRAINING_KINDS.includes(s.kind))fail('SESSION');
  checkInt(s.intensity,0,100,'SESSION_INTENSITY');
  if(['rest','recovery','match'].includes(s.kind)&&s.intensity!==0)fail('NON_TRAINING_INTENSITY');
  if(s.kind==='physical')physical++;
  if(index>0&&s.intensity>=80&&plan.sessions[index-1].intensity>=80)fail('BACK_TO_BACK_LOAD');
 }
 if(physical>3||weekLoad(plan.sessions)>WEEKLY_LOAD_LIMIT)fail('WEEK_LOAD');
 if(!Array.isArray(plan.processedDays)||plan.processedDays.length>7||!Array.isArray(plan.logs)||plan.logs.length>7)fail('PROCESSED');
 for(const [i,d] of plan.processedDays.entries())if(d!==plan.weekStartDay+i)fail('DAY_SEQUENCE');
 if(plan.logs.length!==plan.processedDays.length)fail('LOG_COUNT');
 for(const [i,l] of plan.logs.entries())if(!obj(l)||l.day!==plan.processedDays[i]||!Array.isArray(l.players)||!Number.isInteger(l.trained)||l.trained<0)fail('LOG');
 if(Object.keys(plan.individuals).length>1000)fail('INDIVIDUAL_LIMIT');
 for(const [id,p] of Object.entries(plan.individuals)){
  if(!validId(id)||['__proto__','prototype','constructor'].includes(id))fail('PLAYER_ID');
  validateIndividual(p);
 }
 return true;
}
export function createTrainingWeek({clubId,weekStartDay,formation='4231',matchDays=[],delegated=false}={}){
 if(!validId(clubId))fail('CLUB_ID');checkInt(weekStartDay,1,9999999,'WEEK_START');
 if(!Array.isArray(matchDays)||new Set(matchDays).size!==matchDays.length||matchDays.some(x=>!Number.isInteger(x)||x<0||x>6))fail('MATCH_DAYS');
 const sessions=DEFAULT.map(([kind,intensity],i)=>({dayIndex:i,kind:matchDays.includes(i)?'match':kind,intensity:matchDays.includes(i)?0:intensity}));
 // Auto-plan recuperation immediately after a match, without changing another match day.
 for(const d of matchDays)if(d+1<7&&!matchDays.includes(d+1))sessions[d+1]={dayIndex:d+1,kind:'recovery',intensity:0};
 const p={schemaVersion:1,clubId:String(clubId),weekStartDay,formation,revision:0,delegated:false,sessions,individuals:{},processedDays:[],logs:[]};
 validateTrainingWeek(p);return delegated?delegateTrainingWeek(p):p;
}
function prepareEdit(plan,expectedRevision){validateTrainingWeek(plan);if(plan.revision!==expectedRevision)fail('REVISION_CONFLICT');return copy(plan);}
export function setTrainingSession(plan,{dayIndex,kind,intensity=0,expectedRevision=plan.revision}={}){
 const p=prepareEdit(plan,expectedRevision);checkInt(dayIndex,0,6,'DAY_INDEX');
 if(!TRAINING_KINDS.includes(kind))fail('SESSION_KIND');if(plan.processedDays.includes(plan.weekStartDay+dayIndex))fail('DAY_PROCESSED');
 if(plan.sessions[dayIndex].kind==='match'||kind==='match')fail('MATCH_LOCKED');
 p.sessions[dayIndex]={dayIndex,kind,intensity};p.delegated=false;p.revision++;validateTrainingWeek(p);return p;
}
export function setIndividualTraining(plan,{playerId,position,program='balanced',goal='development',intensity=50,focus=[],role=null,expectedRevision=plan.revision}={}){
 const p=prepareEdit(plan,expectedRevision);if(p.processedDays.length)fail('PLAN_STARTED');if(!validId(playerId))fail('PLAYER_ID');
 const pos=canonicalPosition(position);
 if(role!==null&&(!OWN(ROLE_BY_ID,role)||!ROLE_BY_ID[role].positions.includes(pos)))fail('ROLE_POSITION');
 if(!Array.isArray(focus))fail('FOCUS');
 if(pos!=='GK'&&(program==='goalkeeper'||focus.some(k=>ATTRIBUTE_BY_KEY[k]?.group==='goalkeeper')))fail('GOALKEEPER_FOCUS');
 if(pos==='GK'&&focus.some(k=>ATTRIBUTE_BY_KEY[k]?.group==='physical'&&k==='crossing'))fail('FOCUS');
 const record={program,goal,intensity,focus:[...focus],role};validateIndividual(record);
 p.individuals[String(playerId)]=record;p.revision++;validateTrainingWeek(p);return p;
}
export function delegateTrainingWeek(plan,{expectedRevision=plan.revision}={}){
 const p=prepareEdit(plan,expectedRevision);if(p.processedDays.length)fail('PLAN_STARTED');
 const matches=p.sessions.filter(s=>s.kind==='match').map(s=>s.dayIndex);
 p.sessions=DEFAULT.map(([kind,intensity],dayIndex)=>{
  if(matches.includes(dayIndex))return {dayIndex,kind:'match',intensity:0};
  if(matches.some(d=>d+1===dayIndex))return {dayIndex,kind:'recovery',intensity:0};
  if(matches.some(d=>d===dayIndex+1))return {dayIndex,kind:'tactical',intensity:30};
  return {dayIndex,kind,intensity};
 });
 p.delegated=true;p.revision++;validateTrainingWeek(p);return p;
}
