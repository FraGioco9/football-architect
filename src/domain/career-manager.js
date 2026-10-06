import {clearCareerMatchdayPlans} from './career-matchday.js';
/** WRD06 — opt-in manager identity and employment across a persistent universe.
 * Player-club authority is never inferred from a manager appointment.
 * Cross-country league handover is deliberately rejected until every subsystem
 * can migrate its authoritative league state together.
 */
import {hasCareerWorld} from './career-world.js';
import {boardEnabled,boardStatus,appointBoardManager} from './career-board.js';
import {table} from './standings.js';
import {addMessage} from './history.js';
import {migrateManagerCountryAtSeasonStart} from './manager-international.js';
import {syncCareerContracts} from './career-contracts.js';
import {validateCareerWorld} from './career-world.js';
import {validateCareerDivisions} from './career-divisions.js';
import {validateCareerBoard} from './career-board.js';
import {validateCareerFinance} from './career-finance.js';
import {validateCareerFacilities} from './career-facilities.js';
import {validateCareerTraining} from './career-training.js';
import {validateCareerYouth} from './career-youth.js';
import {validateCareerMarket} from './career-market.js';
import {validateCareerCalendar} from './career-calendar.js';
import {validateCareerCups} from './career-cups.js';
import {validateCareerContinental} from './career-continental.js';
import {validateCareerScouting} from './career-scouting.js';
import {validateCareerAIMarket} from './career-ai-market.js';

const state=w=>w?.advancedV1?.managerV1;
const fail=code=>{throw Error(`WRD06_${code}`);};
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const styles=['balanced','attacking','defensive','youth'];
const statuses=['active','dismissed','retired'];
const names=['A. Moretti','L. Varela','K. Jensen','S. Costa','M. Vidal','D. Ferreira','J. Becker','R. Sato','P. Laurent','T. Silva'];
const isInt=(n,a=0,b=1e9)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const key=(country,id)=>`${country}:club:${id}`;
const activeBoard=w=>boardEnabled(w)&&boardStatus(w)==='active';
const homeClub=w=>w.teams.find(c=>c.id===w.clubId);
const current=s=>s.jobs.at(-1);
const percent=w=>{
 const rows=table(w),place=rows.findIndex(c=>c.id===w.clubId)+1;
 return clamp(Math.round(100*(w.teams.length+1-place)/w.teams.length),0,100);
};
export const managerCareerEnabled=w=>w?.advancedV1?.enabled===true&&state(w)?.schemaVersion===1;
export function enableManagerCareer(w,{origin='',style='balanced'}={}){
 if(!hasCareerWorld(w)||!boardEnabled(w))fail('REQUIRES_WORLD_BOARD');
 if(managerCareerEnabled(w))return w;
 if(state(w)!==undefined)fail('UNKNOWN_SCHEMA');
 if(!styles.includes(style)||typeof origin!=='string'||origin.length>55)fail('PROFILE');
 const c=homeClub(w);if(!c)fail('CLUB');
 const job={countryId:w.countryId,clubId:w.clubId,clubName:c.name,startSeason:w.season,startRound:w.round,
   endSeason:null,endRound:null,reason:null,contractUntil:w.advancedV1.boardV1.contractUntil,salaryEUR:140000};
 const coaches={};for(const league of w.advancedV1.worldV1.leagues){
  const teams=league.locked?w.teams:league.clubs;
  coaches[league.countryId]=teams.filter(t=>!(league.countryId===w.countryId&&t.id===w.clubId))
   .map(t=>({clubId:t.id,name:names[Math.abs((t.id*7+league.countryId.charCodeAt(0))%names.length)],
       reputation:clamp(Math.round((t.reputation??50)*.68+15),20,95),contractUntil:w.season+2,
        status:t.id%9===0?'vacant':'active',vacancyRound:t.id%9===0?w.round:null}));
 }
 w.advancedV1.managerV1={schemaVersion:1,revision:0,profile:{name:w.manager,origin:origin.trim(),style,
   experience:0,reputation:clamp(Math.round((c.reputation??50)*.66+16),20,95),preferences:[]},
  jobs:[job],offers:[],interviews:[],coaches,aiHistory:[],awards:[],events:[],lastRound:{season:w.season,round:w.round},
  status:boardStatus(w),sequence:0};
 if(!validateManagerCareer(w))fail('INITIALIZATION');return w;
}
function event(w,type,description,details={}){
 const s=state(w);s.events.push({season:w.season,round:w.round,type,description,...details});
 if(s.events.length>240)s.events=s.events.slice(-240);
 s.revision++;
}
function syncEmployment(w){
 const s=state(w),j=current(s),status=boardStatus(w);
 if(status==='dismissed'&&j?.endSeason===null){
  j.endSeason=w.season;j.endRound=w.round;j.reason='dismissed';event(w,'dismissal',j.clubName);
 }
 s.status=status;
}
const countries=w=>w.advancedV1.worldV1.leagues;
export function managerVacancies(w){
 if(!managerCareerEnabled(w))return [];
 const s=state(w),jobs=[];
 for(const league of countries(w)){
  const clubs=league.locked?w.teams:league.clubs;
  for(const c of clubs){if(league.countryId===w.countryId&&c.id===w.clubId)continue;
   const coach=s.coaches[league.countryId]?.find(co=>co.clubId===c.id);
   if(!coach||coach.status==='vacant'||coach.contractUntil<=w.season||coach.reputation<32)
     jobs.push({clubKey:key(league.countryId,c.id),countryId:league.countryId,clubId:c.id,name:c.name,reputation:c.reputation??50,
       supported:league.countryId===w.countryId||w.round===0});
  }
 }
 return jobs.sort((a,b)=>b.reputation-a.reputation||a.clubKey.localeCompare(b.clubKey));
}
/** Applications can be submitted to current-country clubs with an open position.
 * Interviews allow salary counteroffers and explicitly expire. */
export function applyManagerJob(w,{revision,clubKey}={}){
 if(!managerCareerEnabled(w))fail('NOT_ENABLED');const s=state(w);
 if(!isInt(revision)||revision!==s.revision||s.status==='retired')fail('STALE');
 const candidate=managerVacancies(w).find(v=>v.clubKey===clubKey);
 if(!candidate)fail('NOT_VACANT');
 if(!candidate.supported)fail('FOREIGN_APPOINTMENTS_AT_SEASON_START_ONLY');
 if(s.offers.some(o=>o.clubKey===clubKey&&o.status==='open'))fail('DUPLICATE');
 const salaryEUR=Math.round((90_000+candidate.reputation*3200+s.profile.reputation*850)/1000)*1000;
 const offer={id:++s.sequence,clubKey,countryId:candidate.countryId,clubId:candidate.clubId,
  clubName:candidate.name,createdSeason:w.season,createdRound:w.round,expiresAfterRound:w.round+4,
  salaryEUR,contractYears:2,status:'open',type:'application'};
 s.offers.push(offer);event(w,'application',candidate.name,{offerId:offer.id});return offer;
}
export function negotiateManagerOffer(w,{revision,offerId,salaryEUR,contractYears}={}){
 if(!managerCareerEnabled(w))fail('NOT_ENABLED');const s=state(w);
 if(s.revision!==revision||!isInt(offerId,1))fail('STALE');
 const offer=s.offers.find(o=>o.id===offerId);
 if(!offer||offer.status!=='open'||w.season!==offer.createdSeason||w.round>offer.expiresAfterRound)fail('NOT_OPEN');
 if(!isInt(contractYears,1,4)||!isInt(salaryEUR,50_000,2_000_000)||salaryEUR%1000)fail('TERMS');
 // Clubs have strict and deterministic salary limits; unsupported contracts cannot be executed.
 const max=Math.round((offer.salaryEUR*1.25)/1000)*1000;
 if(salaryEUR>max)fail('COUNTER_TOO_HIGH');
 offer.salaryEUR=salaryEUR;offer.contractYears=contractYears;
 s.interviews.push({offerId,season:w.season,round:w.round,salaryEUR,contractYears});
 event(w,'interview',offer.clubName,{offerId});return offer;
}
export function decideManagerOffer(w,{revision,offerId,accept=false}={}){
 // Preserve existing object references for national offers (legacy API contract).
 const requested=w.advancedV1?.managerV1?.offers?.find(o=>o.id===offerId);
 if(!requested||requested.countryId===w.countryId||!accept)
  return decideManagerOfferOnDraft(w,{revision,offerId,accept});
 const draft=structuredClone(w),result=decideManagerOfferOnDraft(draft,{revision,offerId,accept});
 if(![validateManagerCareer,validateCareerWorld,validateCareerDivisions,validateCareerBoard,validateCareerFinance,
  validateCareerFacilities,validateCareerTraining,validateCareerYouth,validateCareerMarket,validateCareerCalendar,
  validateCareerCups,validateCareerContinental,validateCareerScouting,validateCareerAIMarket].every(fn=>fn(draft)))fail('TRANSACTION_VALIDATION');
 Object.assign(w,draft);return result;
}
function decideManagerOfferOnDraft(w,{revision,offerId,accept=false}={}){
 if(!managerCareerEnabled(w))fail('NOT_ENABLED');const s=state(w);
 if(s.revision!==revision||!isInt(offerId,1))fail('STALE');
 const offer=s.offers.find(o=>o.id===offerId);
 if(!offer||offer.status!=='open'||w.season!==offer.createdSeason||w.round>offer.expiresAfterRound)fail('NOT_OPEN');
 if(!accept){offer.status='declined';event(w,'decline',offer.clubName,{offerId});return offer;}
 const international=offer.countryId!==w.countryId;
 if(!international&&(!w.teams.some(c=>c.id===offer.clubId)||offer.clubId===w.clubId))fail('CLUB');
 const oldClub=w.clubId,oldCountry=w.countryId;
 if(international){migrateManagerCountryAtSeasonStart(w,offer.countryId,offer.clubId);}
 else appointBoardManager(w,{revision:w.advancedV1.boardV1.revision,clubId:offer.clubId,allowActive:true});
 clearCareerMatchdayPlans(w);
 syncCareerContracts(w);
 // PLY06 rebuilds the save object during foreign enrollment. Refresh manager state.
 const live=state(w),previous=current(live);
 previous.endSeason=w.season;previous.endRound=w.round;previous.reason='appointment_elsewhere';
 const newClub=homeClub(w);
 live.jobs.push({countryId:w.countryId,clubId:w.clubId,clubName:newClub.name,startSeason:w.season,startRound:w.round,
   endSeason:null,endRound:null,reason:null,contractUntil:w.season+offer.contractYears,salaryEUR:offer.salaryEUR});
 live.profile.experience++;live.status='active';
 live.coaches[w.countryId]=live.coaches[w.countryId].filter(c=>c.clubId!==newClub.id);
 live.coaches[oldCountry]=live.coaches[oldCountry].filter(c=>c.clubId!==oldClub);
 live.coaches[oldCountry].push({clubId:oldClub,name:names[(s.sequence+oldClub)%names.length],reputation:55,contractUntil:w.season+2,status:'active',vacancyRound:null});
 const accepted=live.offers.find(o=>o.id===offer.id);accepted.status='accepted';
 for(const other of live.offers)if(other!==accepted&&other.status==='open')other.status='withdrawn';
 event(w,'appointment',newClub.name,{offerId});
 addMessage(w,'Nuovo incarico',`Nuovo incarico presso ${newClub.name}.`,'board',
   {type:'board.update',params:{reason:'new_club',trust:w.advancedV1.boardV1.trust,status:'active'}});
 if(!validateManagerCareer(w))fail('COMMIT');return offer;
}
export function registerManagerRetirement(w){
 if(!managerCareerEnabled(w))return false;
 const s=state(w);if(boardStatus(w)!=='retired')fail('RETIREMENT');
 const job=current(s);if(job.endSeason===null){job.endSeason=w.season;job.endRound=w.round;job.reason='retirement';}
 s.status='retired';event(w,'retirement',job.clubName);return true;
}
/** Keeps WRD06 history aligned with an MGT01 appointment after dismissal. */
export function registerBoardAppointment(w,previousClubId){
 if(!managerCareerEnabled(w))return false;
 const s=state(w);if(s.status!=='dismissed'||!isInt(previousClubId,1)||previousClubId===w.clubId)fail('APPOINTMENT');
 const job=current(s);if(job.endSeason===null){job.endSeason=w.season;job.endRound=w.round;job.reason='dismissed';}
 const c=homeClub(w);if(!c)fail('CLUB');
 s.jobs.push({countryId:w.countryId,clubId:w.clubId,clubName:c.name,startSeason:w.season,startRound:w.round,
   endSeason:null,endRound:null,reason:null,contractUntil:w.advancedV1.boardV1.contractUntil,salaryEUR:125000});
 s.coaches[w.countryId]=s.coaches[w.countryId].filter(c=>c.clubId!==w.clubId);
 s.coaches[w.countryId].push({clubId:previousClubId,name:names[(w.season+w.round)%names.length],reputation:52,contractUntil:w.season+2,status:'active',vacancyRound:null});
 s.profile.experience++;s.status='active';event(w,'reappointment',c.name);
 return true;
}
export function advanceManagerCareerRound(w){
 if(!managerCareerEnabled(w))return false;
 const s=state(w);if(s.lastRound.season!==w.season||s.lastRound.round!==w.round-1)fail('ROUND_SYNC');
 syncEmployment(w);
 for(const o of s.offers)if(o.status==='open'&&(o.createdSeason!==w.season||w.round>o.expiresAfterRound))o.status='expired';
 if(w.round%6===0){
  for(const league of countries(w))for(const co of s.coaches[league.countryId]??[]){
   if(co.status==='vacant'){
    if(w.round-co.vacancyRound>=6){
     const fresh=names[(w.round+co.clubId+w.season)%names.length];
     co.name=fresh;co.reputation=clamp(38+(co.clubId+w.season)%22,35,70);
     co.contractUntil=w.season+2;co.status='active';co.vacancyRound=null;
     s.aiHistory.push({season:w.season,round:w.round,countryId:league.countryId,clubId:co.clubId,type:'appointment',coach:fresh});
    }
   }else{
    // Evaluate only actually played official fixtures (not fabricated results).
    const fixtures=league.locked?w.fixtures:league.fixtures;
    let played=0,points=0;
    for(const day of fixtures)for(const match of day.matches??[]){
     if(!match.result||(match.home!==co.clubId&&match.away!==co.clubId))continue;
     played++;
     const ours=match.home===co.clubId?match.result.homeGoals:match.result.awayGoals;
     const theirs=match.home===co.clubId?match.result.awayGoals:match.result.homeGoals;
     points+=ours>theirs?3:ours===theirs?1:0;
    }
    const pace=points/Math.max(1,played);
    const delta=played===0?0:pace>=1.9?2:pace>=1.4?1:pace<=.7?-3:pace<=1.0?-2:0;
    co.reputation=clamp(co.reputation+delta,18,95);
    if(co.reputation<=24){co.status='vacant';co.vacancyRound=w.round;
     s.aiHistory.push({season:w.season,round:w.round,countryId:league.countryId,clubId:co.clubId,type:'dismissal',coach:co.name});}
   }
  }
  if(s.aiHistory.length>250)s.aiHistory.splice(0,s.aiHistory.length-250);
  if(s.status==='active'&&s.profile.reputation>=25&&s.offers.filter(o=>o.status==='open').length<2){
   const candidate=managerVacancies(w).find(c=>c.supported&&!s.offers.some(o=>o.clubKey===c.clubKey&&o.status==='open'));
   if(candidate){
    s.offers.push({id:++s.sequence,clubKey:candidate.clubKey,countryId:candidate.countryId,clubId:candidate.clubId,
     clubName:candidate.name,createdSeason:w.season,createdRound:w.round,expiresAfterRound:w.round+4,
     salaryEUR:Math.round((100_000+candidate.reputation*3500)/1000)*1000,
     contractYears:2,status:'open',type:'invitation'});
    event(w,'invitation',candidate.name);
   }
  }
  event(w,'market_review','AI coach market');
 }
 s.lastRound={season:w.season,round:w.round};return true;
}
export function settleManagerCareerSeason(w,{boardReview}={}){
 if(!managerCareerEnabled(w))return false;
 const s=state(w);if(s.lastRound.season!==w.season||s.lastRound.round!==w.round||w.round!==w.fixtures.length)fail('SEASON_SYNC');
 syncEmployment(w);
 const finish=table(w).findIndex(r=>r.id===w.clubId)+1;
 const cup=w.advancedV1?.cupsV1?.cups?.find(c=>c.countryId===w.countryId);
 const continental=w.advancedV1?.continentalV1;
 if(cup?.championId===w.clubId)s.awards.push({season:w.season,type:'national_cup',clubId:w.clubId});
 if(finish===1)s.awards.push({season:w.season,type:'league',clubId:w.clubId});
 const delta=clamp((percent(w)-55)/12,-4,4)+(boardReview?.satisfied>=3?2:0);
 s.profile.reputation=clamp(Math.round(s.profile.reputation+delta),5,99);
 s.profile.experience++;event(w,'season_review',`Position ${finish}`,{finish});
 return true;
}
export function openManagerCareerSeason(w){
 if(!managerCareerEnabled(w))return false;
 const s=state(w);if(s.lastRound.season!==w.season-1)fail('SEASON_SYNC');
 syncEmployment(w);
 for(const o of s.offers)if(o.status==='open')o.status='expired';
 for(const coaches of Object.values(s.coaches))for(const c of coaches){
  if(c.status==='active'&&c.contractUntil<=w.season){
   if(c.reputation>=40){c.contractUntil=w.season+1;s.aiHistory.push({season:w.season,round:0,clubId:c.clubId,type:'renewal',coach:c.name});}
   else {c.status='vacant';c.vacancyRound=0;s.aiHistory.push({season:w.season,round:0,clubId:c.clubId,type:'departure',coach:c.name});}
  }
 }
 s.lastRound={season:w.season,round:0};event(w,'new_season',String(w.season));return true;
}
export function validateManagerCareer(w){
 if(state(w)===undefined)return true;
 const s=state(w);
 if(!w?.advancedV1?.enabled||!hasCareerWorld(w)||!boardEnabled(w)||s?.schemaVersion!==1||!isInt(s.revision)||!isInt(s.sequence))return false;
 const p=s.profile;
 if(!p||p.name!==w.manager||typeof p.origin!=='string'||p.origin.length>55||!styles.includes(p.style)||!isInt(p.experience)||!isInt(p.reputation,1,100)||!Array.isArray(p.preferences))return false;
 if(!statuses.includes(s.status)||s.status!==boardStatus(w))return false;
 if(!Array.isArray(s.jobs)||s.jobs.length<1||s.jobs.length>150||s.jobs.filter(j=>j.endSeason===null).length>(s.status==='active'?1:0))return false;
 const j=current(s);if(!j||j.countryId!==w.countryId||j.clubId!==w.clubId)return false;
 if(s.status==='active'&&j.endSeason!==null)return false;
 if(s.jobs.some(j=>!isInt(j.clubId,1)||typeof j.countryId!=='string'||!isInt(j.startSeason,1)||!isInt(j.startRound,0,38)||!isInt(j.salaryEUR,1)||!isInt(j.contractUntil,1)|| (j.endSeason!==null&&(!isInt(j.endSeason,1)||!isInt(j.endRound,0,38)))))return false;
 if(!Array.isArray(s.offers)||s.offers.length>200||s.offers.some(o=>!isInt(o.id,1)||!isInt(o.clubId,1)||!isInt(o.salaryEUR,50_000,2_000_000)||!isInt(o.contractYears,1,4)||!['open','accepted','declined','withdrawn','expired'].includes(o.status)||!isInt(o.createdSeason,1)||!isInt(o.createdRound,0,38)||!isInt(o.expiresAfterRound,o.createdRound,o.createdRound+4)))return false;
 if(new Set(s.offers.map(o=>o.id)).size!==s.offers.length)return false;
 if(!Array.isArray(s.interviews)||s.interviews.length>200||s.interviews.some(i=>!s.offers.some(o=>o.id===i.offerId)))return false;
 if(!s.coaches||typeof s.coaches!=='object'||!countries(w).every(l=>Array.isArray(s.coaches[l.countryId])&&s.coaches[l.countryId].every(c=>isInt(c.clubId,1)&&isInt(c.reputation,1,100)&&isInt(c.contractUntil,1)&&['active','vacant'].includes(c.status))))return false;
 if(!Array.isArray(s.aiHistory)||s.aiHistory.length>250||s.aiHistory.some(h=>!isInt(h.season,1)||!isInt(h.clubId,1)||typeof h.coach!=='string'||!['dismissal','appointment','renewal','departure'].includes(h.type)))return false;
 if(!Array.isArray(s.awards)||s.awards.length>250||!Array.isArray(s.events)||s.events.length>240)return false;
 if(!s.lastRound||s.lastRound.season!==w.season||s.lastRound.round!==w.round)return false;
 return true;
}
