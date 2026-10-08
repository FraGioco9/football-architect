/** MGT04.03–06: atomic deterministic daily training, idempotent replay, medical bridge. */
import {createAttributes,ATTRIBUTE_KEYS,ATTRIBUTE_BY_KEY} from './player-attributes.mjs';
import {rawPositionRating,POSITION_WEIGHTS} from './player-ratings.mjs';
import {ROLE_BY_ID,defaultRole} from './player-roles.mjs';
import {recoverMedical,medicalAvailability,evaluateInjuryRisk,startInjury,validateMedical} from './player-medical.mjs';
import {validateTrainingWeek,copy,fail,checkInt,checkNum,clamp,validId,loadForSession} from './training-plan.mjs';
import {validateTrainingRoster} from './training-roster.mjs';
const round=(x,n=2)=>Number(x.toFixed(n));
const nontraining=new Set(['rest','recovery','match']);
const improvementKinds=new Set(['technical','physical','tactical']);
function pickKeys(player,individual,kind){
 const focus=individual?.focus??[];
 if(focus.length&&kind!=='tactical')return focus;
 const p=player.position,weights=POSITION_WEIGHTS[p]??{};
 const category=kind==='physical'?'physical':kind==='technical'?'technical':'mental';
 const program=individual?.program;
 const primary=program==='goalkeeper'?'goalkeeper':program==='mental'?'mental':program==='physical'?'physical':program==='technical'?'technical':category;
 return ATTRIBUTE_KEYS.filter(k=>ATTRIBUTE_BY_KEY[k].group===primary&&(p==='GK'||ATTRIBUTE_BY_KEY[k].group!=='goalkeeper'))
  .sort((a,b)=>(weights[b]??0)-(weights[a]??0)||a.localeCompare(b)).slice(0,3);
}
function progression(player,individual,session,day){
 const keys=pickKeys(player,individual,session.kind);const values={...player.attributes.values};const carry={...player.carry};
 if(!keys.length||session.intensity===0||!medicalAvailability(player.medical).eligible)return {attributes:player.attributes,carry,changes:[],detail:[]};
 const specialization=individual?.intensity??60;
 const ageFactor=player.age<19?1.2:player.age<23?1.1:player.age<29?0.9:player.age<33?0.65:0.35;
 const allowed=medicalAvailability(player.medical).eligible;
 const fitnessFactor=clamp(player.medical.freshness/100,0.25,1);
 const gap=clamp((player.potential-rawPositionRating(values,player.position)+9)/18,0.12,1.2);
 const goalFactor=individual?.goal==='fitness'?0.5:individual?.goal==='familiarity'?0.7:1;
 const factor=allowed?ageFactor*player.trainingFactor*gap*fitnessFactor*goalFactor:0;
 const changes=[],detail=[];
 for(const key of keys){
  const prev=values[key];if(prev>=100)continue;
  const base=session.kind==='physical'?0.095:session.kind==='technical'?0.080:0.035;
  const inc=base*session.intensity/70*(0.6+specialization/160)*factor;
  const total=(carry[key]??0)+inc;
  const gain=Math.min(2,Math.floor(total+1e-9));
  values[key]=Math.min(100,prev+gain);
  const rest=total-gain;
  if(values[key]>=100)delete carry[key];else if(rest>0)carry[key]=round(rest,8);
  if(gain>0){changes.push({attribute:key,from:prev,to:values[key],delta:values[key]-prev});}
  detail.push({attribute:key,progress:round(inc,4)});
 }
 return {attributes:createAttributes(values,player.attributes.metadata??{}),carry,changes,detail};
}
function updateFamiliarity(familiarity,{session,formation,role,trainingFactor,eligible,goal}){
 const next=copy(familiarity);const focus=goal==='familiarity'?1.6:1;
 // Decay is moderate (0.12 per off-day), bounded and never converts to negative.
 for(const f of Object.keys(next.formations))next.formations[f]=round(clamp(next.formations[f]-0.12,0,100));
 for(const r of Object.keys(next.roles))next.roles[r]=round(clamp(next.roles[r]-0.12,0,100));
 if(session.kind==='tactical'&&eligible){
  next.formations[formation]=round(clamp((next.formations[formation]??0)+0.12+session.intensity/100*0.96*trainingFactor*focus,0,100));
  if(role)next.roles[role]=round(clamp((next.roles[role]??0)+0.08+session.intensity/100*0.85*trainingFactor*focus,0,100));
 }
 return next;
}
function medicalTraining(before,{day,session,intensity,player,clubId,seed,goal}){
 const rest=session.kind==='rest'?100:session.kind==='recovery'?95:session.kind==='match'?40:goal==='fitness'?65:40;
 const training=nontraining.has(session.kind)?0:intensity;
 // The match day is only marked in training; game load is settled by SIM04/PLY04.
 const recovery=Math.round((player.attributes.values.stamina+player.attributes.values.workRate)/2);
 const state=recoverMedical(before,{day,rest,training,recovery});
 const m=copy(state);
 if(improvementKinds.has(session.kind)&&medicalAvailability(m).eligible){
  const effort=session.intensity/100;
  const hardness=session.kind==='physical'?1.35:session.kind==='tactical'?0.60:0.85;
  m.fatigue=round(clamp(m.fatigue+effort*4.7*hardness,0,100));
  m.freshness=round(clamp(m.freshness-effort*4.3*hardness,0,100));
  m.overload=round(clamp(m.overload+Math.max(0,effort-0.55)*2.6*hardness,0,100));
 }
 const risk=improvementKinds.has(session.kind)&&medicalAvailability(m).eligible?
   evaluateInjuryRisk(m,{seed,matchId:`training:${clubId}:${day}`,minutes:session.intensity/100*65,pressing:session.kind==='physical'?80:45,age:player.age}):{risk:0,occurred:false,kind:null,durationDays:0};
 if(risk.occurred){
  // A returning player can relapse; close their recovery state explicitly before new treatment.
  if(m.injury?.stage==='returning'){m.injury.stage='cleared';m.injury.daysRemaining=0;m.injury.returnProgress=100;m.recoveryStatus='cleared';}
  const injury=startInjury(m,{day,kind:risk.kind,durationDays:risk.durationDays,matchId:`training:${clubId}:${day}`});validateMedical(injury);return {medical:injury,risk};
 }
 validateMedical(m);return {medical:m,risk};
}
/** New result has new plan and roster. Inputs are not touched, even on error.
 * Strict consecutive replay: no skipped days, no partial application, duplicate day is a no-op.
 * Call once per calendar day after matching the SIM04 official match settlement chronology.
 */
export function runTrainingDay(plan,roster,{day,seed=0,expectedRevision=plan.revision}={}){
 validateTrainingWeek(plan);validateTrainingRoster(roster);
 checkInt(seed,0,0xffffffff,'SEED');checkInt(day,plan.weekStartDay,plan.weekStartDay+6,'DAY');
 if(plan.clubId!==roster.clubId)fail('CLUB_MISMATCH');
 if(plan.revision!==expectedRevision)fail('REVISION_CONFLICT');
 const offset=day-plan.weekStartDay;
 if(offset<plan.processedDays.length){
  const previous=plan.logs[offset];if(!previous||previous.day!==day)fail('REPLAY');
  if(Object.values(roster.players).some(p=>p.medical.lastDay<day))fail('STALE_ROSTER');
  return {plan:copy(plan),roster:copy(roster),report:{...copy(previous),duplicate:true}};
 }
 if(offset!==plan.processedDays.length)fail('DAY_SEQUENCE');
 const session=plan.sessions[offset],newPlan=copy(plan),newRoster=copy(roster);
 const report={day,kind:session.kind,intensity:session.intensity,trainingLoad:loadForSession(session),trained:0,injuries:0,players:[]};
 for(const [playerId,player] of Object.entries(newRoster.players)){
  if(player.medical.lastDay>day)fail('MEDICAL_IN_FUTURE');
  const individual=plan.individuals[playerId];
  const role=individual?.role??defaultRole(player.position);
  const eligible=medicalAvailability(player.medical).eligible;
  const ratedBefore=rawPositionRating(player.attributes.values,player.position);
  const trainingIntensity=session.intensity*(individual?.intensity??60)/60;
  const scaledSession={...session,intensity:Math.round(clamp(trainingIntensity,0,100))};
  const result=nontraining.has(session.kind)?{attributes:player.attributes,carry:player.carry,changes:[],detail:[]}:
   progression(player,individual,scaledSession,day);
  const med=medicalTraining(player.medical,{day,session,intensity:scaledSession.intensity,player,clubId:plan.clubId,seed,goal:individual?.goal});
  const familiar=updateFamiliarity(player.familiarity,{session:scaledSession,formation:plan.formation,role,trainingFactor:player.trainingFactor,eligible,goal:individual?.goal});
  player.attributes=result.attributes;player.carry=result.carry;player.medical=med.medical;player.familiarity=familiar;
  if(improvementKinds.has(session.kind)&&eligible)report.trained++;
  if(med.risk.occurred)report.injuries++;
  report.players.push({playerId,changes:result.changes,progress:result.detail,ratingBefore:round(ratedBefore),ratingAfter:round(rawPositionRating(player.attributes.values,player.position)),
   freshness:round(med.medical.freshness),fatigue:round(med.medical.fatigue),overload:round(med.medical.overload),
   familiarity:round(familiar.formations[plan.formation]??0),roleFamiliarity:round(familiar.roles[role]??0),injured:med.risk.occurred,
   risk:med.risk.risk,reasons:session.kind==='match'?['match_external']:session.kind==='rest'||session.kind==='recovery'?['recovery']:eligible?['training','age','potential_gap','personality','medical_load']:['unavailable']});
 }
 newPlan.processedDays.push(day);newPlan.logs.push(copy(report));newPlan.revision++;
 validateTrainingWeek(newPlan);validateTrainingRoster(newRoster);
 return {plan:newPlan,roster:newRoster,report};
}
export function runTrainingWeek(plan,roster,{seed=0}={}){
 validateTrainingWeek(plan);validateTrainingRoster(roster);let p=plan,r=roster;
 for(let i=plan.processedDays.length;i<7;i++){const t=runTrainingDay(p,r,{day:plan.weekStartDay+i,seed});p=t.plan;r=t.roster;}
 return {plan:copy(p),roster:copy(r),reports:copy(p.logs)};
}
