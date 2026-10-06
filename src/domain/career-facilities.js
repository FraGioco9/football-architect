/** MGT03 — persistent, opt-in club staff and facilities. Only the managed club
 * has analytic staff contracts; global world transfers remain authoritative.
 * All timestamps use the advanced career clock, and money is booked by MGT02.
 */
import {financeEnabled,postCareerFacilityCash} from './career-finance.js';
import {addMessage} from './history.js';
import {delegateTrainingWeek} from '../addons/domain/training-plan.mjs';
const error=code=>{throw new Error(`MGT03_${code}`);};
const ROLES=['assistant','fitness','medical','scouting','director'];
const TYPES=['training','academy','medical','stadium'];
export const STAFF_ROLES=Object.freeze(ROLES);
export const FACILITY_TYPES=Object.freeze(TYPES);
export const facilityEnabled=w=>w?.advancedV1?.enabled===true&&w.advancedV1?.facilitiesV1?.schemaVersion===1;
const club=w=>w.teams.find(c=>c.id===w.clubId);
const state=w=>w.advancedV1.facilitiesV1;
const whole=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const baseline=(w)=>Object.fromEntries(ROLES.map((role,i)=>[role,{id:`${w.clubId}:${role}:1`,role,quality:2,wageEUR:3500+i*450,contractUntil:w.season+2}]));
const buildings=()=>Object.fromEntries(TYPES.map(type=>[type,{level:1}]));
const archive=(s,ev,extra={})=>{s.events.push({id:`mgt03:${++s.sequence}`,season:s.season,day:s.lastDay,type:ev,...extra});s.events=s.events.slice(-160);s.revision++;};
export function enableCareerFacilities(w){
 if(!financeEnabled(w)||!w.advancedV1?.youthV1||!w.advancedV1?.trainingV1)error('REQUIRES_FINANCE_TRAINING_YOUTH');
 if(facilityEnabled(w))return w;
 if(w.advancedV1.facilitiesV1!==undefined)error('UNKNOWN_SCHEMA');
 w.advancedV1.facilitiesV1={schemaVersion:1,clubId:w.clubId,season:w.season,lastDay:w.advancedV1.clockDay,revision:0,
  staff:baseline(w),buildings:buildings(),projects:[],delegations:{training:false,scouting:false,youth:false,market:false},
  events:[],sequence:0,formerClubs:[],staffArrearsEUR:0,lastPayrollDay:w.advancedV1.clockDay};
 if(!validateCareerFacilities(w))error('INITIALIZATION');return w;
}
export const facilityBonus=(w,type)=>facilityEnabled(w)?clamp((state(w).buildings[type]?.level??1)-1,0,4):0;
export function facilityImpact(w){if(!facilityEnabled(w))return null;
 const s=state(w);return {trainingBonus:clamp(facilityBonus(w,'training')+Math.max(0,s.staff.fitness.quality-2),0,6),
  medicalBonus:clamp(facilityBonus(w,'medical')+Math.max(0,s.staff.medical.quality-2),0,6),
  academyBonus:clamp(facilityBonus(w,'academy')+Math.max(0,s.staff.assistant.quality-2),0,6),
  scoutingBonus:clamp(facilityBonus(w,'training')+Math.max(0,s.staff.scouting.quality-2),0,4),
  stadiumLevel:s.buildings.stadium.level};}
export function facilityProjectQuote(w,type){if(!facilityEnabled(w)||!TYPES.includes(type))error('PROJECT_TYPE');
 const level=state(w).buildings[type].level;if(level>=5)error('MAX_LEVEL');
 return {type,from:level,to:level+1,costEUR:250_000*level*(type==='stadium'?4:type==='academy'?3:2),days:28+14*level};
}
/** Actions are checkpointed at the UI layer; clone for all-or-nothing failures. */
function transact(w,revision,fn){if(!facilityEnabled(w))error('DISABLED');if(revision!==state(w).revision)error('STALE_REVISION');
 const d=structuredClone(w);const result=fn(d,state(d));
 if(!validateCareerFacilities(d)||!financeEnabled(d))error('INVALID_COMMIT');Object.assign(w,d);return result;
}
export function hireCareerStaff(w,{revision,role,quality,years=2}={}){return transact(w,revision,(d,s)=>{
 if(!ROLES.includes(role)||!whole(quality,1,5)||!whole(years,1,5))error('STAFF');
 const fee=quality*25000,wageEUR=2000+quality*1700;if(club(d).balance-fee<d.advancedV1.financeV1.transferReserveEUR)error('FUNDS');
 postCareerFacilityCash(d,`mgt03:hire:${s.sequence+1}`,-fee,'staff');
 s.staff[role]={id:`${d.clubId}:${role}:${s.sequence+1}`,role,quality,wageEUR,contractUntil:d.season+years};
 archive(s,'staff_hired',{role,quality,feeEUR:fee});return s.staff[role];
});}
export function delegateCareerStaff(w,{revision,task,enabled}={}){return transact(w,revision,(d,s)=>{
 if(!Object.hasOwn(s.delegations,task)||typeof enabled!=='boolean')error('DELEGATION');
 if(task==='scouting'&&!d.advancedV1.scoutingV1)error('REQUIRES_SCOUTING');
 s.delegations[task]=enabled;
 if(task==='training'&&d.advancedV1.trainingV1){const t=d.advancedV1.trainingV1;if(enabled)t.week=delegateTrainingWeek(t.week);else{t.week.delegated=false;t.week.revision++;}}
 if(task==='youth'&&enabled&&d.advancedV1.youthV1)d.advancedV1.youthV1.academyProgram='balanced';
 archive(s,'delegation',{task,enabled});return enabled;
});}
export function planFacilityProject(w,{revision,type}={}){return transact(w,revision,(d,s)=>{
 const quote=facilityProjectQuote(d,type);if(s.projects.some(p=>p.type===type&&['planned','building'].includes(p.status)))error('ALREADY_PLANNED');
 const project={id:`facility:${s.sequence+1}`,type,targetLevel:quote.to,costEUR:quote.costEUR,days:quote.days,status:'planned',approvedDay:null,dueDay:null};
 s.projects.push(project);archive(s,'project_planned',{projectId:project.id,type});return project.id;
});}
export function decideFacilityProject(w,{revision,id,decision}={}){return transact(w,revision,(d,s)=>{
 const project=s.projects.find(p=>p.id===id);if(!project||!['approve','postpone','cancel'].includes(decision))error('DECISION');
 if(decision==='approve'){
  if(project.status!=='planned'||s.buildings[project.type].level+1!==project.targetLevel)error('PROJECT_STAGE');
  if(club(d).balance-project.costEUR<d.advancedV1.financeV1.transferReserveEUR)error('FUNDS');
  postCareerFacilityCash(d,`mgt03:build:${project.id}`,-project.costEUR,'stadium');
  project.status='building';project.approvedDay=s.lastDay;project.dueDay=s.lastDay+project.days;
 }else if(decision==='postpone'){
  if(project.status!=='planned')error('PROJECT_STAGE');
 }else{
  if(!['planned','building'].includes(project.status))error('PROJECT_STAGE');
  // A started project loses 20% of the investment; no phantom refund for plans.
  if(project.status==='building')postCareerFacilityCash(d,`mgt03:refund:${project.id}`,Math.floor(project.costEUR*.8),'stadium');
  project.status='cancelled';
 }
 archive(s,`project_${decision}`,{projectId:project.id});return project.status;
});}
/** Apply once at the end of each official 7-day round. The wage bill is *new*
 * named-contract pay above the MGT02 baseline operating staff cost. */
export function advanceCareerFacilitiesRound(w){if(!facilityEnabled(w))return false;const s=state(w),now=w.advancedV1.clockDay;
 if(now!==s.lastDay+7||now!==s.lastPayrollDay+7)error('CLOCK');
 s.lastDay=now;
 const wage=Object.values(s.staff).reduce((total,a)=>total+a.wageEUR,0)+s.staffArrearsEUR;
 // If there is no liquidity, carry a transparently recorded payable forward.
 // Never throw halfway through a played matchday due to a new MGT03 payroll.
 const payable=Math.min(wage,Math.max(0,club(w).balance));
 if(payable)postCareerFacilityCash(w,`mgt03:payroll:${w.season}:${now}`,-payable,'staff');
 s.staffArrearsEUR=wage-payable;s.lastPayrollDay=now;
 if(s.staffArrearsEUR&&now%35===0)addMessage(w,'Stipendi staff da saldare',`Compensi differiti: ${s.staffArrearsEUR} EUR.`,'finance',{type:'facilities.payroll',params:{amountEUR:s.staffArrearsEUR}});
 for(const p of s.projects){if(p.status!=='building'||p.dueDay>now)continue;
  if(s.buildings[p.type].level+1!==p.targetLevel)error('PROJECT_LEVEL');
  s.buildings[p.type].level=p.targetLevel;p.status='completed';
  if(p.type==='stadium')club(w).capacity+=1000*p.targetLevel;
  archive(s,'project_completed',{projectId:p.id,level:p.targetLevel});
  addMessage(w,'Struttura completata',`${p.type}: livello ${p.targetLevel}.`,'finance',{type:'facilities.completed',params:{type:p.type,level:p.targetLevel}});
 }
 // Delegation does not fabricate transfers or observations. Scout managers
 // improve reliability within existing MKT03 uncertainty ceilings.
 if(s.delegations.scouting&&w.advancedV1.scoutingV1){const scout=w.advancedV1.scoutingV1;scout.staffLevel=Math.max(scout.staffLevel,Math.min(5,s.staff.scouting.quality));}
 if(now%28===0&&Object.values(s.delegations).some(Boolean))archive(s,'delegated_report',{tasks:Object.entries(s.delegations).filter(([,on])=>on).map(([key])=>key)});
 return true;
}
/** Previous club must retain its facilities; appointment opens a separate budget. */
export function changeCareerFacilitiesClub(w,previousClubId){if(!facilityEnabled(w))return false;const s=state(w);
 if(s.clubId!==previousClubId||w.clubId===previousClubId)error('CLUB_CHANGE');
 const former={clubId:previousClubId,season:w.season,buildings:s.buildings,staff:s.staff,projects:s.projects,events:s.events};
 const formerClubs=[...s.formerClubs,former].slice(-10);delete w.advancedV1.facilitiesV1;
 enableCareerFacilities(w);state(w).formerClubs=formerClubs;
 if(!validateCareerFacilities(w))error('JOB_VALIDATION');return true;
}
export function openCareerFacilitiesSeason(w){if(!facilityEnabled(w))return false;const s=state(w);if(w.season!==s.season+1)error('SEASON');
 s.season=w.season;s.lastDay=w.advancedV1.clockDay;s.lastPayrollDay=s.lastDay;
 // Expired staff remain on temporary rolling terms until a replacement is hired;
 // no new contract wage is charged at year rollover.
 for(const x of Object.values(s.staff))x.contractUntil=Math.max(x.contractUntil,w.season);
 return validateCareerFacilities(w);
}
export function validateCareerFacilities(w){const s=w?.advancedV1?.facilitiesV1;if(s===undefined)return true;
 if(!financeEnabled(w)||s?.schemaVersion!==1||s.clubId!==w.clubId||s.season!==w.season||s.lastDay!==w.advancedV1.clockDay||s.lastPayrollDay!==s.lastDay||!whole(s.revision,0,1000000)||!whole(s.sequence,0,1000000)||!whole(s.staffArrearsEUR,0,1000000000000))return false;
 if(!s.staff||!s.buildings||!s.delegations||!Array.isArray(s.projects)||s.projects.length>100||!Array.isArray(s.events)||s.events.length>160||!Array.isArray(s.formerClubs)||s.formerClubs.length>10)return false;
 const ids=new Set(),live=new Set();
 for(const role of ROLES){const p=s.staff[role];if(!p||p.role!==role||typeof p.id!=='string'||ids.has(p.id)||!whole(p.quality,1,5)||!whole(p.wageEUR,0,100000)||!whole(p.contractUntil,s.season, s.season+20))return false;ids.add(p.id);}
 for(const type of TYPES)if(!whole(s.buildings[type]?.level,1,5))return false;
 for(const key of ['training','scouting','youth','market'])if(typeof s.delegations[key]!=='boolean')return false;
 for(const p of s.projects){if(!p||typeof p.id!=='string'||ids.has(p.id)||!TYPES.includes(p.type)||!['planned','building','completed','cancelled'].includes(p.status)||!whole(p.targetLevel,2,5)||!whole(p.costEUR,1,10000000)||!whole(p.days,1,365))return false;
  const reference=250_000*(p.targetLevel-1)*(p.type==='stadium'?4:p.type==='academy'?3:2);
  if(p.costEUR!==reference||p.days!==28+14*(p.targetLevel-1))return false;
  const paid=w.advancedV1.financeV1.keys.includes(`mgt03:build:${p.id}`);
  const refunded=w.advancedV1.financeV1.keys.includes(`mgt03:refund:${p.id}`);
  if(p.status==='planned'&&(paid||refunded||p.approvedDay!==null||p.dueDay!==null))return false;
  if(['building','completed'].includes(p.status)&&(!paid||refunded))return false;
  if(p.status==='cancelled'&&(p.approvedDay===null?(paid||refunded):(!paid||!refunded)))return false;
  ids.add(p.id);if(['planned','building'].includes(p.status)){if(live.has(p.type))return false;live.add(p.type);}
  if(p.status==='building'&&(!whole(p.approvedDay,0,10000000)||!whole(p.dueDay,p.approvedDay+1,p.approvedDay+365)))return false;
  if(p.status==='completed'&&s.buildings[p.type].level<p.targetLevel)return false;
 }
 return s.events.every(e=>typeof e.id==='string'&&whole(e.season,1,s.season)&&whole(e.day,0,s.lastDay)&&typeof e.type==='string');
}
