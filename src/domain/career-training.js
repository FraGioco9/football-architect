/** PLY03 + MGT04 authoritative bridge for opt-in v1 careers.
 * Weekly training owns medical recovery for the managed club; the match engine
 * owns match load. Annual PLY03 growth is reconciled against (not added to)
 * gains already accrued by MGT04. No browser/storage dependencies.
 */
import {clubPlayers} from './selectors.js';
import {personalityTrainingMultiplier} from './career-personality.js';
import {toAddonPosition} from '../addons/career-bridge.mjs';
import {createTrainingWeek,validateTrainingWeek,setTrainingSession,setIndividualTraining,delegateTrainingWeek} from '../addons/domain/training-plan.mjs';
import {createTrainingRoster,validateTrainingRoster} from '../addons/domain/training-roster.mjs';
import {runTrainingDay} from '../addons/domain/training-session.mjs';
import {initialDevelopment,validateDevelopment,simulateDevelopmentSeason} from '../addons/domain/player-development.mjs';
import {createAttributes} from '../addons/domain/player-attributes.mjs';
import {rawPositionRating} from '../addons/domain/player-ratings.mjs';
import {validateMedical} from '../addons/domain/player-medical.mjs';
import {facilityImpact} from './career-facilities.js';

const bad=code=>{throw new Error(`CAREER_TRAINING_${code}`);};
const supported=w=>w?.advancedV1?.enabled===true&&w.advancedV1.schemaVersion===1;
export const hasCareerTraining=w=>supported(w)&&w.advancedV1.trainingV1?.schemaVersion===1;
const own=w=>clubPlayers(w,w.clubId);
const norm=(p)=>({...p,position:toAddonPosition(p.position)});
const emptyStats=()=>({minutes:0,formSum:0,appearances:0,workloadSum:0,trainingDays:0});
const plannedWeek=(w,startDay=w.advancedV1.clockDay+1)=>createTrainingWeek({clubId:w.clubId,weekStartDay:startDay,formation:w.formation,matchDays:[6],delegated:true});

export function enableCareerTraining(w){
 if(!supported(w)||!w.clubId||!Array.isArray(w.players))bad('INACTIVE');
 if(hasCareerTraining(w))return w;
 if(w.advancedV1.trainingV1!==undefined)bad('UNKNOWN_VERSION');
 const states=w.players.map(p=>initialDevelopment(norm(p),{seed:w.seed,countryId:w.countryId,startSeason:w.season}));
 const training={schemaVersion:1,clubId:String(w.clubId),season:w.season,lastDay:w.advancedV1.clockDay,
   week:plannedWeek(w),playerStates:{},seasonStats:{},reports:[]};
 for(let i=0;i<w.players.length;i++)w.players[i].developmentV1=states[i];
 w.advancedV1.trainingV1=training;
 if(!validateCareerTraining(w))bad('INITIALIZATION');
 return w;
}
/** Rebase the weekly plan on the new club after MGT01 appointment. */
export function changeCareerTrainingClub(w){
 if(!hasCareerTraining(w))return false;
 const t=w.advancedV1.trainingV1;
 t.clubId=String(w.clubId);t.week=plannedWeek(w,t.lastDay+1);
 t.playerStates=Object.fromEntries(Object.entries(t.playerStates).filter(([id])=>own(w).some(p=>String(p.id)===id)));
 if(!validateCareerTraining(w))bad('JOB_CHANGE');return true;
}
export function validateCareerTraining(w){
 if(!supported(w))return !w?.advancedV1?.trainingV1;
 const t=w.advancedV1.trainingV1;
 if(t===undefined)return true; // Older, opt-in advanced careers remain valid.
 try{
  if(!t||t.schemaVersion!==1||t.clubId!==String(w.clubId)||t.season!==w.season||t.lastDay!==w.advancedV1.clockDay)return false;
  validateTrainingWeek(t.week);
  if(t.week.clubId!==t.clubId||t.week.weekStartDay+t.week.processedDays.length!==t.lastDay+1||!t.week.sessions.some(s=>s.dayIndex===6&&s.kind==='match'))return false;
  if(!t.playerStates||typeof t.playerStates!=='object'||Array.isArray(t.playerStates)||Object.keys(t.playerStates).length>1000)return false;
  if(!t.seasonStats||typeof t.seasonStats!=='object'||Array.isArray(t.seasonStats)||Object.keys(t.seasonStats).length>w.players.length)return false;
  if(!Array.isArray(t.reports)||t.reports.length>12||t.reports.some(r=>!Number.isSafeInteger(r.weekStartDay)||r.weekStartDay<1||r.weekStartDay>t.lastDay||!Array.isArray(r.days)||r.days.length!==7))return false;
  const ids=new Set(w.players.map(p=>String(p.id)));
  for(const p of w.players){validateDevelopment(p.developmentV1);if(p.developmentV1.playerId!==String(p.id)||p.developmentV1.age!==p.age||p.developmentV1.lastSeason!==w.season-1)return false;}
  for(const [id,st] of Object.entries(t.playerStates)){
   if(!ids.has(id)||!st||typeof st!=='object'||Array.isArray(st)||!st.carry||!st.familiarity)return false;
   for(const value of Object.values(st.carry))if(!Number.isFinite(value)||value<0||value>=1)return false;
   for(const v of [...Object.values(st.familiarity.formations??{}),...Object.values(st.familiarity.roles??{})])if(!Number.isFinite(v)||v<0||v>100)return false;
  }
  for(const [id,s] of Object.entries(t.seasonStats)){
   if(!ids.has(id)||!s||!Number.isSafeInteger(s.minutes)||s.minutes<0||s.minutes>6000||!Number.isSafeInteger(s.appearances)||s.appearances<0||s.appearances>200||!Number.isFinite(s.formSum)||s.formSum<0||!Number.isFinite(s.workloadSum)||s.workloadSum<0||!Number.isSafeInteger(s.trainingDays)||s.trainingDays<0)return false;
  }
  return true;
 }catch{return false;}
}
function updatedRoster(w){
 const t=w.advancedV1.trainingV1,players=own(w).map(p=>{
  const a=norm(p); // PLY03 annual baseline stays unchanged until rollover.
  a.developmentV1={...p.developmentV1,attributes:p.attributeProfile};
  return a;
 });
 const roster=createTrainingRoster(w.clubId,players,{seed:w.seed,countryId:w.countryId,day:t.lastDay});
 for(const [id,record] of Object.entries(roster.players)){
  const remembered=t.playerStates[id];
  if(remembered){record.carry=structuredClone(remembered.carry);record.familiarity=structuredClone(remembered.familiarity);}
 }
 validateTrainingRoster(roster);return roster;
}
/** Editing is immutable until a complete plan validates; official UI commits the whole cloned world. */
export function configureCareerSession(w,dayIndex,kind,intensity=50){
 if(!hasCareerTraining(w))bad('INACTIVE');
 const t=w.advancedV1.trainingV1;
 t.week=setTrainingSession(t.week,{dayIndex,kind,intensity:kind==='rest'||kind==='recovery'?0:intensity});
 return t.week;
}
export function configureCareerIndividual(w,playerId,program,{goal='development',intensity=60,focus=[]}={}){
 if(!hasCareerTraining(w))bad('INACTIVE');
 const player=own(w).find(p=>p.id===Number(playerId));if(!player)bad('PLAYER');
 const t=w.advancedV1.trainingV1,previous=t.week.individuals[String(playerId)];
 const role=w.advancedV1.roles[String(playerId)]?.role??null;
 t.week=setIndividualTraining(t.week,{playerId,position:toAddonPosition(player.position),program,goal,intensity,focus,role});
 return t.week;
}
export function delegateCareerTraining(w){
 if(!hasCareerTraining(w))bad('INACTIVE');
 const t=w.advancedV1.trainingV1;t.week=delegateTrainingWeek(t.week);return t.week;
}
/** A tactical role chosen in SIM03 also becomes the focus of upcoming MGT04 sessions. */
export function syncCareerTrainingRole(w,playerId,role){
 if(!hasCareerTraining(w))return;
 const p=own(w).find(x=>x.id===Number(playerId));if(!p)bad('PLAYER');
 const t=w.advancedV1.trainingV1,existing=t.week.individuals[String(playerId)];
 t.week=setIndividualTraining(t.week,{playerId,position:toAddonPosition(p.position),program:existing?.program??'role',
  goal:existing?.goal??'familiarity',intensity:existing?.intensity??60,focus:existing?.focus??[],role});
}
/** Keep training formation aligned with the manager's official tactical changes. */
export function syncCareerTrainingFormation(w){
 if(!hasCareerTraining(w))return;
 const t=w.advancedV1.trainingV1;
 const next=structuredClone(t.week);next.formation=w.formation;next.revision++;
 validateTrainingWeek(next);t.week=next;
}
/** Process exactly one calendar day for the managed club. */
export function settleCareerTrainingDay(w,day){
 if(!hasCareerTraining(w))bad('INACTIVE');
 const t=w.advancedV1.trainingV1;
 if(day!==t.lastDay+1||t.week.weekStartDay+t.week.processedDays.length!==day)bad('DAY_SEQUENCE');
 let roster=updatedRoster(w),plan=t.week;
 const result=runTrainingDay(plan,roster,{day,seed:w.seed});
 plan=result.plan;roster=result.roster;
 const owned=new Map(own(w).map(p=>[String(p.id),p]));
 for(const [id,record] of Object.entries(roster.players)){
  const p=owned.get(id);if(!p)bad('TRANSFER_CONFLICT');
  p.attributeProfile=record.attributes;
  p.medicalV1={...record.medical,events:record.medical.events.slice(-2),processedMatchIds:record.medical.processedMatchIds.slice(-2)};
  const bonus=facilityImpact(w)?.medicalBonus??0;
  if(bonus){p.medicalV1.freshness=Math.min(100,p.medicalV1.freshness+bonus*0.5);p.medicalV1.fatigue=Math.max(0,p.medicalV1.fatigue-bonus*0.25);}
  p.fitness=Math.round(p.medicalV1.freshness);
  p.injury=w.advancedV1.legacyInjuryRounds[String(p.id)]??(record.medical.injury?.stage==='recovering'?Math.max(1,Math.ceil(record.medical.injury.daysRemaining/7)):0);
  t.playerStates[id]={carry:record.carry,familiarity:record.familiarity};
  const stat=t.seasonStats[id]??emptyStats();
  const row=plan.logs.at(-1);
  if(row&&['technical','physical','tactical'].includes(row.kind)){stat.workloadSum+=row.trainingLoad;stat.trainingDays++;}
  t.seasonStats[id]=stat;
 }
 t.lastDay=day;
 if(plan.processedDays.length>=7){
  t.reports.push({weekStartDay:plan.weekStartDay,days:plan.logs.map(l=>({day:l.day,kind:l.kind,trained:l.trained,injuries:l.injuries,trainingLoad:l.trainingLoad}))});
  t.reports=t.reports.slice(-12);
  const individuals=structuredClone(plan.individuals);
  t.week=plannedWeek(w,day+1);
  t.week.individuals=individuals;
 }else t.week=plan;
 if(!validateCareerTraining(w))bad('POST_DAY');
 return plan.logs.at(-1)??null;
}

/** Compatibility helper: process seven consecutive daily ticks. */
export function settleCareerTrainingWeek(w,day){
 if(!hasCareerTraining(w))bad('INACTIVE');
 const start=w.advancedV1.trainingV1.lastDay;
 if(start+7!==day)bad('DAY_SEQUENCE');
 let result=null;
 for(let target=start+1;target<=day;target++){
  w.advancedV1.clockDay=target;
  result=settleCareerTrainingDay(w,target);
 }
 return result;
}
/** Called by the actual seeded match simulator, once per player's real minutes. */
export function recordCareerMinutes(w,playerId,seconds,form){
 if(!hasCareerTraining(w))return;
 const t=w.advancedV1.trainingV1,id=String(playerId),s=t.seasonStats[id]??emptyStats();
 s.minutes+=Math.round(seconds/60);s.appearances++;s.formSum+=form;
 t.seasonStats[id]=s;
}
/** End-of-season reconciliation: per-attribute positive growth is MAX(weekly,annual),
 * never SUM(weekly,annual). Physical declines apply to the current trained value.
 * Both old-age decay and annual development are settled exactly once. */
export function settleCareerTrainingSeason(w){
 if(!hasCareerTraining(w))return false;
 const t=w.advancedV1.trainingV1;
 if(t.season!==w.season)bad('SEASON_SEQUENCE');
 for(const p of w.players){
  const d=p.developmentV1,s=t.seasonStats[String(p.id)]??emptyStats();
  const baseline=d.attributes.values,now=p.attributeProfile.values;
  const currentProgram=t.week.individuals[String(p.id)]?.program??'balanced';
  const yearly=simulateDevelopmentSeason(d,norm(p),{season:w.season,minutes:Math.min(6000,s.minutes),
   // MGT03 training staff reduce *excessive* effective workload rather than
   // fabricating minutes or adding a second PLY03 growth pass.
   workload:Math.max(0,Math.min(100,(s.trainingDays?Math.max(0,Math.min(100,s.workloadSum/s.trainingDays)-(facilityImpact(w)?.trainingBonus??0)*1.5):55)*personalityTrainingMultiplier(w,p))),
   form:s.appearances?Math.min(100,s.formSum/s.appearances*10):50,program:currentProgram});
  const merged={};const changes=[];
  for(const key of Object.keys(now)){
   const annualDelta=yearly.attributes.values[key]-baseline[key];
   // Include earned weekly training gains at most once per attribute.
   const target=annualDelta>=0?Math.max(now[key],baseline[key]+annualDelta):now[key]+annualDelta;
   const final=Math.max(1,Math.min(100,target));merged[key]=final;
   if(final!==baseline[key])changes.push({attribute:key,from:baseline[key],to:final,delta:final-baseline[key]});
  }
  const attributes=createAttributes(merged,{...(yearly.attributes.metadata??{}),trainingReconciled:true});
  const history=[...yearly.history];const last=history.at(-1);
  last.rating=Number(rawPositionRating(merged,d.position).toFixed(2));
  last.delta=Number((last.rating-rawPositionRating(baseline,d.position)).toFixed(2));
  last.changes=changes;
  p.developmentV1={...yearly,attributes,history};
  p.attributeProfile=attributes;
  p.ovr=Math.max(1,Math.min(100,Math.round(last.rating)));
  validateDevelopment(p.developmentV1);
 }
 t.season=w.season+1;t.seasonStats={};t.reports=[];t.playerStates=Object.fromEntries(Object.entries(t.playerStates).filter(([id])=>own(w).some(p=>String(p.id)===id)));
 // Week is reinitialized after settleAdvancedSeason advances the medical clock.
 return true;
}
export function openCareerTrainingSeason(w){
 if(!hasCareerTraining(w))return;
 const t=w.advancedV1.trainingV1;
 t.lastDay=w.advancedV1.clockDay;t.week=plannedWeek(w);
 if(!validateCareerTraining(w))bad('ROLLOVER');
}
