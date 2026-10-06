/** MGT01: opt-in, deterministic board/manager employment for the official career.
 * All evaluations derive from saved matches, finances and youth data; no hidden randomness.
 * Keep every change in the enclosing career checkpoint and JSON/IndexedDB transaction.
 */
import {table} from './standings.js';
import {personalityBoardShift} from './career-personality.js';
import {clubPlayers} from './selectors.js';
import {makeDefaultLineup} from './lineups.js';
import {syncCareerPersonality} from './career-personality.js';
import {addMessage} from './history.js';
import {financeEnabled,changeFinanceClub} from './career-finance.js';
import {facilityEnabled,changeCareerFacilitiesClub} from './career-facilities.js';
import {changeCareerTrainingClub} from './career-training.js';

const fail=(reason)=>{throw Error(`MGT01_${reason}`);};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const state=w=>w?.advancedV1?.boardV1;
const plans=['cautious','balanced','ambitious'];
export const boardEnabled=w=>w?.advancedV1?.enabled===true&&state(w)?.schemaVersion===1;
export const boardStatus=w=>boardEnabled(w)?state(w).status:'inactive';
const club=w=>w.teams.find(t=>t.id===w.clubId);
const position=w=>table(w).findIndex(t=>t.id===w.clubId)+1;
const ordered=w=>[...w.teams].sort((a,b)=>(b.reputation??50)-(a.reputation??50)||a.id-b.id);
function targets(w,plan='balanced'){
  const rank=ordered(w).findIndex(c=>c.id===w.clubId)+1;
  // No club may be asked to finish above its ability ranking by more than two places.
  const target=clamp(rank+(plan==='cautious'?4:plan==='ambitious'?-2:2),1,w.teams.length);
  return {leaguePosition:target,cupRound:plan==='ambitious'?3:plan==='balanced'?2:1,
    youthAppearances:plan==='ambitious'?10:plan==='balanced'?5:2,
    minBalanceRatio:plan==='ambitious'?.94:plan==='balanced'?.82:.70,
    style:plan==='ambitious'?'Offensiva':'Equilibrata'};
}
function notice(w,kind,values={}){
  // Structured event is translated by QOL02 on every inbox rendering.
  const reason=String(values.reason??kind).slice(0,80);
  addMessage(w,'Comunicazione dirigenza',`La dirigenza ha aggiornato la valutazione (${reason}). Fiducia ${state(w).trust}/100.`,
    'board',{type:'board.update',params:{reason,trust:state(w).trust,status:state(w).status}});
}
function record(w,type,cause,delta=0,extra={}){
  const b=state(w),before=b.trust;
  b.trust=clamp(before+delta,0,100);
  const entry={season:w.season,round:w.round,type,cause,delta:b.trust-before,trust:b.trust,...extra};
  b.events.push(entry);if(b.events.length>170)b.events.splice(0,b.events.length-170);
  b.revision++;
  return entry;
}
export function enableCareerBoard(w){
  if(!w?.clubId||w.advancedV1?.enabled!==true)fail('REQUIRES_ADVANCED');
  if(boardEnabled(w))return w;
  if(state(w)!==undefined)fail('UNKNOWN_SCHEMA');
  const initial=club(w)?.balance??0;
  w.advancedV1.boardV1={schemaVersion:1,clubId:w.clubId,season:w.season,revision:0,status:'active',
    trust:65,fans:60,media:55,warnings:0,contractUntil:w.season+1,
    plan:'balanced',negotiated:w.round>0,targets:targets(w),seasonBalanceStart:initial,
    events:[],history:[],seasonStartRound:w.round,joinSeason:w.season};
  record(w,'appointment','appointment');notice(w,'appointment');
  if(!validateCareerBoard(w))fail('INITIALIZATION');return w;
}
export function negotiateBoardGoals(w,{revision,plan}={}){
  if(!boardEnabled(w))fail('NOT_ENABLED');const b=state(w);
  if(b.status!=='active'||b.revision!==revision||w.round!==0||b.season!==w.season||b.negotiated)fail('NEGOTIATION_CLOSED');
  if(!plans.includes(plan))fail('PLAN');
  b.plan=plan;b.targets=targets(w,plan);b.negotiated=true;
  record(w,'negotiation',plan,plan==='ambitious'?3:plan==='cautious'?-2:0);
  notice(w,'negotiation',{reason:plan});return w;
}
function manageDismissal(w,cause){
  const b=state(w);
  if(b.status!=='active')return;
  b.status='dismissed';record(w,'dismissal',cause);notice(w,'dismissal',{reason:cause});
}
export function recordBoardRound(w,{result,ours,theirs}={}){
  if(!boardEnabled(w))return false;
  const b=state(w);if(b.status!=='active')return false;
  if(b.season!==w.season||b.clubId!==w.clubId)fail('SEASON_SYNC');
  if(!Number.isSafeInteger(ours)||!Number.isSafeInteger(theirs))fail('SCORE');
  const place=position(w),rows=table(w),myRow=rows.find(r=>r.id===w.clubId),games=Math.max(1,myRow?.p??1);
  const pointsPace=(myRow?.pts??0)/games;
  const expectedPace=clamp(2.3-(b.targets.leaguePosition-1)*.075,.85,2.3);
  const matchDelta=ours>theirs?2:ours===theirs?0:-2;
  const leagueDelta=pointsPace<expectedPace-.48?-1:pointsPace>expectedPace+.38?1:0;
  const clubNow=club(w),start=b.seasonBalanceStart;
  const moneyDelta=clubNow.balance<0||clubNow.balance<start*.5?-1:0;
  const cohesionDelta=personalityBoardShift(w);
  const delta=clamp(matchDelta+leagueDelta+moneyDelta+cohesionDelta,-4,4);
  const cause=ours>theirs?'win':ours===theirs?'draw':'loss';
  const entry=record(w,'match',cause,delta,{position:place,pointsPace:Math.round(pointsPace*100)/100,financeDelta:moneyDelta,leagueDelta,cohesionDelta});
  b.fans=clamp(b.fans+(ours>theirs?2:ours<theirs?-2:0)+(place<=b.targets.leaguePosition?1:0),0,100);
  b.media=clamp(b.media+(delta>0?1:delta<0?-1:0),0,100);
  if(w.round>=Math.max(10,Math.floor(w.fixtures.length/3))&&b.trust<=25){
    if(w.round%3===0){b.warnings++;record(w,'warning','low_confidence');notice(w,'warning',{reason:'low_confidence'});}
    // Every dismissal must be preceded by at least two warnings, never a single bad result.
    if(b.trust<=12&&b.warnings>=2)manageDismissal(w,'persistent_underperformance');
  }
  return entry;
}
const cupProgress=w=>{
  const x=w.advancedV1?.cupsV1;
  const cup=x?.cups?.find(c=>c.countryId===w.countryId);
  if(!cup)return null;
  return cup.championId===w.clubId?5:cup.rounds?.filter(r=>r.matches?.some(m=>m.home===w.clubId||m.away===w.clubId)).length??0;
};
export function settleBoardSeason(w){
  if(!boardEnabled(w))return null;
  const b=state(w);if(b.season!==w.season||w.round!==w.fixtures.length)fail('SEASON_SYNC');
  const finish=position(w),activeSquad=clubPlayers(w,w.clubId),youthApps=activeSquad.filter(p=>p.age<=21).reduce((n,p)=>n+(p.apps||0),0);
  const cup=cupProgress(w),balance=club(w).balance;
  const checks={league:finish<=b.targets.leaguePosition,
    cup:cup===null?null:cup>=b.targets.cupRound,
    youth:youthApps>=b.targets.youthAppearances,
    finance:balance>=0&&balance>=Math.min(0,b.seasonBalanceStart)*0.1&&balance>=Math.max(0,b.seasonBalanceStart)*b.targets.minBalanceRatio,
    style:w.tactic===b.targets.style};
  // Unavailable cups and youth systems are not treated as automatic failures.
  if(!w.advancedV1?.youthV1)checks.youth=null;
  const measured=Object.values(checks).filter(v=>v!==null);
  const satisfied=measured.filter(Boolean).length;
  const delta=clamp((satisfied*2-measured.length)*3,-12,12);
  if(b.status==='active')record(w,'season_review','annual_assessment',delta,{finish});
  else record(w,'season_review','annual_assessment',0,{finish});
  const summary={season:w.season,clubId:b.clubId,plan:b.plan,targets:{...b.targets},checks,finish,
    trust:b.trust,fans:b.fans,media:b.media,status:b.status,contractUntil:b.contractUntil,satisfied,total:measured.length};
  b.history.push(summary);if(b.history.length>45)b.history.shift();
  if(b.status==='active'){
    if(b.trust<=18&&b.warnings>=1)manageDismissal(w,'season_review');
    else if(b.trust>=46){b.contractUntil=Math.max(w.season+2,b.contractUntil);record(w,'renewal','contract_extended');notice(w,'renewal');}
    else {b.warnings++;record(w,'warning','contract_review');notice(w,'warning',{reason:'contract_review'});}
  }
  summary.status=b.status;summary.trust=b.trust;summary.contractUntil=b.contractUntil;
  notice(w,'season_review',{reason:'annual_assessment'});
  return summary;
}
export function openBoardSeason(w){
  if(!boardEnabled(w))return false;
  const b=state(w);if(b.season!==w.season-1)fail('SEASON_SYNC');
  b.season=w.season;b.negotiated=false;b.seasonBalanceStart=club(w).balance;b.seasonStartRound=0;
  b.targets=targets(w,b.plan);record(w,'new_season','new_season');return true;
}
export function boardJobs(w){
  if(!boardEnabled(w)||state(w).status!=='dismissed')return [];
  const former=club(w);
  return w.teams.filter(t=>t.id!==state(w).clubId&&t.id!==w.clubId)
    .sort((a,b)=>(a.reputation>former.reputation+10)-(b.reputation>former.reputation+10)||Math.abs((a.reputation??50)-(former.reputation??50))-Math.abs((b.reputation??50)-(former.reputation??50))).slice(0,6)
    .map(t=>({id:t.id,name:t.name,reputation:t.reputation}));
}
/** Club migration without altering fixture or player ownership; WRD06 uses this only
 * for clubs already in the authoritative managed league. */
export function appointBoardManager(w,{revision,clubId,allowActive=false}={}){
  if(!boardEnabled(w))fail('NOT_ENABLED');const b=state(w);
  if(b.revision!==revision||!(b.status==='dismissed'||(allowActive&&b.status==='active')))fail('NOT_AVAILABLE');
  if(!Number.isSafeInteger(clubId)||clubId===w.clubId||!w.teams.some(c=>c.id===clubId))fail('CLUB');
  if(!allowActive&&!boardJobs(w).some(c=>c.id===clubId))fail('CLUB');
  const previousClubId=w.clubId;
  b.clubId=clubId;w.clubId=clubId;
  if(financeEnabled(w))changeFinanceClub(w,previousClubId);
  if(facilityEnabled(w))changeCareerFacilitiesClub(w,previousClubId);
  changeCareerTrainingClub(w);
  syncCareerPersonality(w);
  w.lineup=makeDefaultLineup(w.players,w.clubId,w.formation);
  b.status='active';b.trust=54;b.fans=52;b.media=50;b.warnings=0;b.contractUntil=w.season+1;
  b.plan='balanced';b.targets=targets(w);b.negotiated=w.round>0;b.seasonBalanceStart=club(w).balance;
  record(w,'appointment','new_club');notice(w,'appointment',{reason:'new_club'});return w;
}
export function acceptBoardJob(w,{revision,clubId}={}){
  return appointBoardManager(w,{revision,clubId});
}
export function endBoardCareer(w,{revision}={}){
  if(!boardEnabled(w))fail('NOT_ENABLED');const b=state(w);
  if(b.revision!==revision||b.status!=='dismissed')fail('NOT_DISMISSED');
  b.status='retired';record(w,'retirement','manager_retired');return w;
}
export function validateCareerBoard(w){
  if(state(w)===undefined)return true;
  const b=state(w);
  if(!w?.advancedV1?.enabled||b?.schemaVersion!==1||!['active','dismissed','retired'].includes(b.status)||!plans.includes(b.plan))return false;
  if(!Number.isSafeInteger(b.season)||b.season!==w.season||!Number.isSafeInteger(b.clubId)||!w.teams.some(t=>t.id===b.clubId))return false;
  if(b.clubId!==w.clubId||!Number.isSafeInteger(b.revision)||b.revision<0||typeof b.negotiated!=='boolean')return false;
  if(![b.trust,b.fans,b.media].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=100)||!Number.isSafeInteger(b.warnings)||b.warnings<0||b.warnings>1000)return false;
  if(!Number.isSafeInteger(b.contractUntil)||b.contractUntil<b.season-5||b.contractUntil>b.season+200||!Number.isFinite(b.seasonBalanceStart))return false;
  if(!b.targets||!Number.isSafeInteger(b.targets.leaguePosition)||b.targets.leaguePosition<1||b.targets.leaguePosition>w.teams.length||!Number.isSafeInteger(b.targets.cupRound)||!Number.isSafeInteger(b.targets.youthAppearances)||!Number.isFinite(b.targets.minBalanceRatio)||typeof b.targets.style!=='string')return false;
  if(!Array.isArray(b.events)||b.events.length>170||!Array.isArray(b.history)||b.history.length>45)return false;
  if(b.events.some(e=>!Number.isSafeInteger(e.season)||!Number.isSafeInteger(e.round)||!Number.isSafeInteger(e.trust)||e.trust<0||e.trust>100||!Number.isSafeInteger(e.delta)||Math.abs(e.delta)>100||typeof e.cause!=='string'||typeof e.type!=='string'))return false;
  if(b.history.some(h=>!Number.isSafeInteger(h.season)||h.season>w.season||h.season<1||!h.checks||typeof h.checks!=='object'))return false;
  return true;
}
