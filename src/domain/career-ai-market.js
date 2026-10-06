/** MKT04 — Deterministic NPC market, opt-in per career, on the authoritative
 * MKT01/02/03 ledger. No duplicate player ownership or second financial model.
 * All round and season calls occur on career.js' detached candidate snapshot.
 */
import {marketEnabled,marketClubs,marketValuation,completeAutonomousMarketDeal} from './career-market.js';
import {calendarEnabled,windowStatus,budgetReservations,releaseCareerFreeAgent,signCareerFreeAgent} from './career-calendar.js';
import {scoutingEnabled} from './career-scouting.js';
import {randomFactory,scopedSeed} from './rng.js';
import {addMessage} from './history.js';

const error=s=>{throw Error(`MKT04_${s}`);};
const integer=(n,a=0,b=1e9)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const KEYS=/^(IT|ENG|ES|DE|FR|NL|PT|BR):club:\d+$/;
const POS=['POR','TD','DC','TS','MED','CC','COC','AD','AS','ATT'];
const managedKey=w=>`${w.countryId}:club:${w.clubId}`;
const get=w=>w.advancedV1.aiMarketV1;
const round=w=>w.round;
const day=w=>w.advancedV1.clockDay;
export const aiMarketEnabled=w=>marketEnabled(w)&&calendarEnabled(w)&&scoutingEnabled(w)&&get(w)?.schemaVersion===1;
const list=(w,key)=>{
 const [country,,str]=key.split(':'),id=Number(str);
 const mine=country===w.countryId&&w.teams.some(c=>c.id===id);return mine?w.players.filter(p=>p.clubId===id):w.advancedV1.worldV1.leagues.find(l=>l.countryId===country&&!l.locked)?.players.filter(p=>p.clubId===id)??[];
};
const money=(w,key)=>{
 const [country,,str]=key.split(':');return country===w.countryId&&w.teams.some(t=>t.id===Number(str))?w.teams.find(t=>t.id===Number(str)):w.advancedV1.marketV1.foreignFinances[key];
};
const posCounts=players=>Object.fromEntries(POS.map(p=>[p,players.filter(x=>x.position===p).length]));
const playerId=(w,p,c)=>p.globalId??(typeof p.id==='string'?p.id:`${c}:${p.id}`);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function enableCareerAIMarket(w){
 if(!marketEnabled(w)||!calendarEnabled(w)||!scoutingEnabled(w))error('REQUIRES_MKT03');
 if(aiMarketEnabled(w))return w;
 if(get(w)!==undefined)error('UNKNOWN_SCHEMA');
 const clubs={};
 for(const c of marketClubs(w))if(c.key!==managedKey(w)){
  const rand=randomFactory(scopedSeed(w.seed,'ai-strategy',c.key));
  clubs[c.key]={ambition:Math.round(30+c.reputation*.55+rand()*12),risk:Math.round(rand()*100),coachStyle:['balanced','pressing','defensive','possession'][Math.floor(rand()*4)],focus:POS[Math.floor(rand()*POS.length)],movesThisSeason:0};
 }
 w.advancedV1.aiMarketV1={schemaVersion:1,season:w.season,lastDay:day(w),revision:0,sequence:0,clubs,offers:[],history:[],renewals:[],metrics:{offers:0,completed:0,loans:0,expired:0,refused:0,freeReleases:0,freeSignings:0,renewals:0}};
 if(!validateCareerAIMarket(w))error('INITIALIZATION');return w;
}
/** International WRD06 appointment: preserve other clubs' strategies, and hand the
 * former managed club back to the autonomous market. Historical deals stay recorded. */
export function reconcileAIMarketManagedClub(w,formerManagedKey){
 if(!aiMarketEnabled(w))return false;
 const s=get(w),now=managedKey(w);
 delete s.clubs[now];
 const all=marketClubs(w).filter(c=>c.key!==now);
 for(const c of all)if(!s.clubs[c.key]){
  const rand=randomFactory(scopedSeed(w.seed,'ai-strategy',c.key));
  s.clubs[c.key]={ambition:Math.round(30+c.reputation*.55+rand()*12),risk:Math.round(rand()*100),coachStyle:['balanced','pressing','defensive','possession'][Math.floor(rand()*4)],focus:POS[Math.floor(rand()*POS.length)],movesThisSeason:0};
 }
 const touching=s.offers.filter(p=>[p.buyerKey,p.sellerKey].includes(now));
 for(const pending of touching.filter(p=>p.status==='offered')){
  pending.status='refused';s.metrics.refused++;record(w,pending,'refused',null,'manager_appointment');
 }
 // Keep the complete historical offers in the manager archive: the AI registry is
 // intentionally restricted to teams not currently controlled by the player.
 if(touching.length){
  const career=w.advancedV1.managerV1;career.archivedAIOffers=[...(career.archivedAIOffers??[]),...structuredClone(touching)].slice(-250);
  s.offers=s.offers.filter(p=>![p.buyerKey,p.sellerKey].includes(now));
 }
 s.revision++;
 if(!validateCareerAIMarket(w))error('MIGRATION');
 return true;
}
export function aiClubStrategy(w,key){if(!aiMarketEnabled(w))return null;return get(w).clubs[key]??null;}
/** Generate a small slate of proposals each market week; deterministic seeds do
 * not affect results of matches or the other seven simulated championships.
 * Player's club is excluded at BOTH ends. NPCs may scout without exposing CA/PA
 * to the manager's interface or writing ratings into an offer.
 */
export function planCareerAIOffers(w){
 if(!aiMarketEnabled(w))return 0;
 const s=get(w),clubs=marketClubs(w).filter(c=>c.key!==managedKey(w)),rnd=randomFactory(scopedSeed(w.seed,'ai-offers',w.season,round(w))),amount=2;
 const market=w.advancedV1.marketV1,proposed=new Set(s.offers.filter(x=>x.status==='offered').map(o=>o.playerId));
 let planned=0;
 for(let attempt=0;attempt<amount*8&&planned<amount;attempt++){
  const c=clubs[Math.floor(rnd()*clubs.length)],key=c.key,strategy=s.clubs[key],country=c.countryId;
  if(!windowStatus(w,country).open||strategy.movesThisSeason>=3)continue;
  const squad=list(w,key),n=squad.length,held=budgetReservations(w,key),bank=money(w,key);
  if(n+held.roster>=30||n<18)continue;
  const bias={balanced:[],pressing:['ATT','AS','AD'],defensive:['POR','DC','MED'],possession:['CC','COC','MED']}[strategy.coachStyle];
  const counts=posCounts(squad),wanted=POS.slice().sort((a,b)=>(counts[a]-(a===strategy.focus?1:0)-(bias.includes(a)?.5:0))-(counts[b]-(b===strategy.focus?1:0)-(bias.includes(b)?.5:0))||a.localeCompare(b))[0];
  const alternatives=clubs.filter(x=>x.key!==key&&x.key!==managedKey(w)&&list(w,x.key).length>21);
  if(!alternatives.length)continue;
  const seller=alternatives[Math.floor(rnd()*alternatives.length)],selling=list(w,seller.key),sellerCounts=posCounts(selling);
  const candidates=selling.filter(p=>p.position===wanted&&sellerCounts[p.position]>(p.position==='POR'?2:1)&&!market.loans[playerId(w,p,seller.countryId)]&&!proposed.has(playerId(w,p,seller.countryId))&&!Object.values(market.deals).some(d=>d.playerId===playerId(w,p,seller.countryId)&&!['completed','rejected','expired'].includes(d.status))&&!Object.values(w.advancedV1.calendarV1.pending).some(b=>b.playerId===playerId(w,p,seller.countryId)));
  if(!candidates.length)continue;
  candidates.sort((a,b)=>Math.abs(a.ovr-(c.reputation+strategy.ambition/35))-Math.abs(b.ovr-(c.reputation+strategy.ambition/35))||a.age-b.age||String(a.id).localeCompare(String(b.id)));
  const target=candidates[Math.floor(rnd()*Math.min(strategy.risk>=45?3:2,candidates.length))],id=playerId(w,target,seller.countryId);
  const valuation=marketValuation(w,id,key),type=rnd()<(strategy.risk>=65?.22:.08)&&n<29&&list(w,seller.key).length>=24?'loan':'permanent';
  const fee=type==='loan'?Math.max(1000,Math.round(valuation.askingEUR*.017/1000)*1000):Math.round(valuation.askingEUR/1000)*1000;
  const salary=Math.round(Math.max(target.wage*52,valuation.weeklyWageEUR*52)/100)*100;
  const cash=Math.min(bank.balance??0,bank.budget??bank.transferBudget??0)-held.cash;
  const perSeason=type==='loan'?Math.round(target.wage*52*.5):0;
  if(!integer(fee)||fee>50_000_000||cash<fee+perSeason+300_000||cash-fee<Math.max(0,Math.round(cash*(.18+(100-strategy.risk)/550))))continue;
  const wageCap=Math.max(600_000,c.reputation*16_000);
  if(squad.reduce((sum,p)=>sum+(p.wage??0),0)+Math.round(salary/52)>wageCap*.92)continue;
  const deal={id:`ai:${w.season}:${++s.sequence}`,playerId:id,buyerKey:key,sellerKey:seller.key,type,feeEUR:fee,annualWageEUR:type==='loan'?target.wage*52:salary,loanEndSeason:w.season,salarySharePct:50,createdDay:day(w),expiresDay:day(w)+14,status:'offered'};
  s.offers.push(deal);s.metrics.offers++;planned++;proposed.add(id);
 }
 s.offers=s.offers.slice(-120);return planned;
}
function record(w,p,status,dealId=null,reason=null){
 const s=get(w);s.history.push({id:p.id,season:w.season,day:day(w),from:p.sellerKey,to:p.buyerKey,playerId:p.playerId,type:p.type,feeEUR:p.feeEUR,status,dealId,reason});
 s.history=s.history.slice(-180);
}
function register(w,dealId,p){
 const c=w.advancedV1.calendarV1;
 c.registrations.push({id:`ai-registration:${dealId}`,dealId,playerId:p.playerId,buyerKey:p.buyerKey,type:p.type,season:w.season,effectiveDay:day(w),postedDay:day(w),origin:'ai'});
 c.events.push({id:`mkt02:${w.season}:${c.nextEvent++}`,type:'transfer_registered',dealId,effectiveDay:day(w),season:w.season,day:day(w),origin:'ai'});
 c.events=c.events.slice(-250);c.revision++;
}
/** Resolve an accepted offer by the MKT01 authoritative market transaction.
 * Rejections are data, not silent exceptions; known unsafe states cancel offers.
 * The enclosing official matchday is itself a deep-cloned transaction.
 */
export function settleCareerAIOffers(w){
 if(!aiMarketEnabled(w))return 0;
 let n=0;
 for(const p of get(w).offers.filter(x=>x.status==='offered'&&x.createdDay<day(w)).slice(0,3)){
  const s=get(w),buyer=s.clubs[p.buyerKey],seller=s.clubs[p.sellerKey];
  if(day(w)>p.expiresDay||!windowStatus(w,p.buyerKey.split(':')[0]).open){p.status='expired';s.metrics.expired++;record(w,p,'expired');continue;}
  if(!buyer||!seller||buyer.movesThisSeason>=3||p.buyerKey===managedKey(w)||p.sellerKey===managedKey(w)||list(w,p.sellerKey).length<=21){p.status='refused';s.metrics.refused++;record(w,p,'refused','', 'roster');continue;}
  try{
   const dealId=completeAutonomousMarketDeal(w,{revision:w.advancedV1.marketV1.revision,playerId:p.playerId,buyerKey:p.buyerKey,type:p.type,feeEUR:p.feeEUR,annualWageEUR:p.annualWageEUR,salarySharePct:p.salarySharePct,loanEndSeason:p.loanEndSeason});
   // MKT01's checked transaction replaces the draft object; reacquire state.
   const after=get(w),offer=after.offers.find(x=>x.id===p.id);
   offer.status='completed';offer.dealId=dealId;after.metrics.completed++;if(offer.type==='loan')after.metrics.loans++;
   after.clubs[offer.buyerKey].movesThisSeason++;after.clubs[offer.sellerKey].movesThisSeason++;
   register(w,dealId,offer);record(w,offer,'completed',dealId);
   n++;
  }catch(err){
   if(!/^MKT01_/.test(String(err.message)))throw err;
   const offer=get(w).offers.find(x=>x.id===p.id);offer.status='refused';get(w).metrics.refused++;record(w,offer,'refused',null,String(err.message).slice(0,75));
  }
 }
 return n;
}
function renewAIContracts(w){
 if(w.round!==29)return;
 const s=get(w),keys=Object.keys(s.clubs),rand=randomFactory(scopedSeed(w.seed,'ai-renew',w.season));
 const from=Math.floor(rand()*keys.length);
 let total=0;
 for(let i=0;i<keys.length&&total<3;i++){
  const key=keys[(from+i)%keys.length],roster=list(w,key),club=s.clubs[key],account=money(w,key);
  if(roster.length<18||account.balance<600000||club.movesThisSeason>=3)continue;
  const player=roster.filter(p=>p.contract<=1&&p.age<=30&&p.ovr>=60).sort((a,b)=>b.ovr-a.ovr||a.age-b.age)[0];
  if(!player)continue;
  const cap=Math.max(600000,marketClubs(w).find(c=>c.key===key).reputation*16000);
  const wage=Math.round(player.wage*(1.05+club.risk/1000)/100)*100;
  if(roster.reduce((a,p)=>a+(p.wage??0),0)+(wage-player.wage)>cap*.93)continue;
  const before=player.wage;player.wage=wage;player.contract=3;
  s.renewals.push({playerId:playerId(w,player,key.split(':')[0]),clubKey:key,season:w.season,oldWageEUR:before,newWageEUR:wage});
  s.renewals=s.renewals.slice(-100);s.metrics.renewals++;total++;
 }
}
function releaseSurplus(w){
 // One consensual senior release in the mid-season registration period every second year.
 // Keep a full complement for match simulation and do not touch player team.
 if(w.round!==18||w.season%2!==0)return;
 const s=get(w),keys=Object.keys(s.clubs),rand=randomFactory(scopedSeed(w.seed,'ai-releases',w.season));
 const from=Math.floor(rand()*keys.length);
 for(let i=0;i<keys.length;i++){
  const key=keys[(from+i)%keys.length],roster=list(w,key);
  if(roster.length<25||s.clubs[key].movesThisSeason>=3)continue;
  const available=roster.filter(p=>p.age>=32&&!w.advancedV1.marketV1.loans[playerId(w,p,key.split(':')[0])]);
  const counts=posCounts(roster);
  const candidate=available.filter(p=>counts[p.position]>(p.position==='POR'?2:1)).sort((a,b)=>b.age-a.age||a.ovr-b.ovr)[0];
  if(!candidate)continue;
  try{
   releaseCareerFreeAgent(w,{revision:w.advancedV1.calendarV1.revision,playerId:playerId(w,candidate,key.split(':')[0]),consent:true});
   get(w).metrics.freeReleases++;get(w).clubs[key].movesThisSeason++;
   return;
  }catch(e){if(!/^MKT02_/.test(e.message))throw e;}
 }
}
function signSurplusFreeAgents(w){
 if(w.round%5!==2)return;
 const all=Object.entries(w.advancedV1.calendarV1.freeAgents);
 if(!all.length)return;
 const keys=Object.keys(get(w).clubs),rand=randomFactory(scopedSeed(w.seed,'ai-free-signing',w.season,round(w)));
 const from=Math.floor(rand()*keys.length);
 for(let i=0;i<keys.length;i++){
  const key=keys[(from+i)%keys.length],club=get(w).clubs[key];
  if(club.movesThisSeason>=3||list(w,key).length>=25)continue;
  const entry=all.find(([,f])=>f.formerClubKey===key)||all.find(([,f])=>f.formerClubKey?.startsWith(key.split(':')[0]+':'));
  if(!entry)continue;
  const [id,f]=entry;
  if(!f?.player?.wage)continue;
  try{
   signCareerFreeAgent(w,{revision:w.advancedV1.calendarV1.revision,playerId:id,buyerKey:key,annualWageEUR:Math.max(5200,Math.round(f.player.wage*52/100)*100),years:2});
   get(w).metrics.freeSignings++;get(w).clubs[key].movesThisSeason++;
   return;
  }catch(e){if(!/^MKT02_/.test(e.message))throw e;}
 }
}
export function advanceCareerAIMarket(w){
 if(!aiMarketEnabled(w))return false;
 if(day(w)<=get(w).lastDay)return false;
 settleCareerAIOffers(w);renewAIContracts(w);
 releaseSurplus(w);signSurplusFreeAgents(w);
 // Two offers roughly every other eligible matchday, not every country every week.
 if(round(w)%2===1)planCareerAIOffers(w);
 const s=get(w);s.lastDay=day(w);s.revision++;
 if(!validateCareerAIMarket(w))error('ROUND_INTEGRITY');return true;
}
export function settleCareerAIMarketSeason(w){
 if(!aiMarketEnabled(w))return;
 const s=get(w);for(const p of s.offers.filter(x=>x.status==='offered')){p.status='expired';s.metrics.expired++;record(w,p,'expired');}
 const active=new Set(marketClubs(w).filter(c=>c.key!==managedKey(w)).map(c=>c.key));
 for(const key of Object.keys(s.clubs))if(!active.has(key))delete s.clubs[key];
 for(const club of marketClubs(w))if(club.key!==managedKey(w)&&!s.clubs[club.key]){
  const rand=randomFactory(scopedSeed(w.seed,'ai-strategy',club.key));
  s.clubs[club.key]={ambition:Math.round(30+club.reputation*.55+rand()*12),risk:Math.round(rand()*100),coachStyle:['balanced','pressing','defensive','possession'][Math.floor(rand()*4)],focus:POS[Math.floor(rand()*POS.length)],movesThisSeason:0};
 }
 for(const c of Object.values(s.clubs))c.movesThisSeason=0;
 s.season=w.season;s.lastDay=day(w);s.revision++;
 if(!validateCareerAIMarket(w))error('SEASON_INTEGRITY');
}
export function validateCareerAIMarket(w){
 const s=get(w);if(s===undefined)return true;
 if(!calendarEnabled(w)||!scoutingEnabled(w)||s?.schemaVersion!==1||s.season!==w.season||!integer(s.lastDay,0,day(w))||!integer(s.sequence)||!integer(s.revision)||!s.clubs||!Array.isArray(s.offers)||s.offers.length>120||!Array.isArray(s.history)||s.history.length>180||!Array.isArray(s.renewals)||s.renewals.length>100||!s.metrics)return false;
 try{
  const all=marketClubs(w).map(c=>c.key).filter(k=>k!==managedKey(w));
  if(Object.keys(s.clubs).length!==all.length||all.some(k=>!s.clubs[k]))return false;
  for(const [key,c] of Object.entries(s.clubs))if(!KEYS.test(key)||!integer(c.ambition,0,150)||!integer(c.risk,0,100)||!POS.includes(c.focus)||!['balanced','pressing','defensive','possession'].includes(c.coachStyle)||!integer(c.movesThisSeason,0,3))return false;
  const ids=new Set();
  for(const p of s.offers){if(ids.has(p.id)||!/^ai:\d+:\d+$/.test(p.id)||!KEYS.test(p.buyerKey)||!KEYS.test(p.sellerKey)||p.buyerKey===managedKey(w)||p.sellerKey===managedKey(w)||p.buyerKey===p.sellerKey||!/^(IT|ENG|ES|DE|FR|NL|PT|BR):[\w.:-]+$/.test(p.playerId)||!['permanent','loan'].includes(p.type)||!integer(p.feeEUR)||!integer(p.annualWageEUR)||!integer(p.createdDay)||!integer(p.expiresDay,p.createdDay,p.createdDay+30)||!['offered','completed','expired','refused'].includes(p.status)||p.status==='completed'&&(!p.dealId||w.advancedV1.marketV1.deals[p.dealId]?.status!=='completed'))return false;ids.add(p.id);}
  for(const h of s.history)if(!/^ai:\d+:\d+$/.test(h.id)||!['completed','expired','refused'].includes(h.status)||!integer(h.day)||!integer(h.season,1,w.season)||!KEYS.test(h.from)||!KEYS.test(h.to)||!integer(h.feeEUR)||!['loan','permanent'].includes(h.type))return false;
  for(const r of s.renewals)if(!KEYS.test(r.clubKey)||!Number.isInteger(r.season)||!integer(r.oldWageEUR)||!integer(r.newWageEUR)||!r.playerId)return false;
  for(const [k,v] of Object.entries(s.metrics))if(!['offers','completed','loans','expired','refused','freeReleases','freeSignings','renewals'].includes(k)||!integer(v))return false;
  return true;
 }catch{return false;}
}
