/** MGT02 — optional double-entry journal layered over authoritative cash & transfers.
 * Entries are EUR integers. This module never repeats MKT01/WRD03 payments.
 * Legacy cash is the source of truth; the journal reconciles to it on every checkpoint.
 */
import {clubPlayers} from './selectors.js';
import {addMessage} from './history.js';
import {table} from './standings.js';
const fail=code=>{throw new Error(`MGT02_${code}`);};
const state=w=>w?.advancedV1?.financeV1;
const managed=w=>w.teams.find(t=>t.id===w.clubId);
const money=n=>Number.isSafeInteger(n)&&Math.abs(n)<=1e13;
const MAX=1e13;
export const financeEnabled=w=>w?.advancedV1?.enabled===true&&state(w)?.schemaVersion===1;
export const FINANCE_ACCOUNTS_EN=Object.freeze({cash:'Cash',equity:'Opening equity',ticket:'Matchday tickets',sponsor:'Sponsorship',seasonTicket:'Season tickets',prizes:'Prize money',transferIncome:'Player sales',transferExpense:'Transfer fees',wages:'Player wages',staff:'Staff',stadium:'Stadium and facilities',interest:'Loan interest',debt:'Credit facilities',otherIncome:'Other income',otherExpense:'Other expenses'});
export const FINANCE_ACCOUNTS=Object.freeze({cash:'Liquidità',equity:'Patrimonio iniziale',ticket:'Biglietteria',sponsor:'Sponsor',seasonTicket:'Abbonamenti',prizes:'Premi',transferIncome:'Plusvalenze e cessioni',transferExpense:'Acquisti e oneri mercato',wages:'Stipendi',staff:'Staff',stadium:'Stadio e strutture',interest:'Interessi',debt:'Finanziamenti',otherIncome:'Altre entrate',otherExpense:'Altre uscite'});
const operatingIncome=new Set(['ticket','sponsor','seasonTicket','prizes','transferIncome','otherIncome']);
const operatingExpense=new Set(['transferExpense','wages','staff','stadium','interest','otherExpense']);
function post(w,key,debit,credit,amountEUR,{kind=key,description=''}={}){
 const s=state(w);
 if(!financeEnabled(w))fail('NOT_ENABLED');
 if(s.keys.includes(key))return false;
 if(!Object.hasOwn(FINANCE_ACCOUNTS,debit)||!Object.hasOwn(FINANCE_ACCOUNTS,credit)||debit===credit||!money(amountEUR)||amountEUR<=0)fail('JOURNAL_LINE');
 s.entries.push({key,season:w.season,round:w.round,debit,credit,amountEUR,kind,description:String(description).slice(0,100)});
 s.keys.push(key);s.revision++;
 s.cashEUR+=(debit==='cash'?amountEUR:0)-(credit==='cash'?amountEUR:0);
 return true;
}
function postNet(w,key,amountEUR,positiveAccount,negativeAccount){
 if(!money(amountEUR))fail('AMOUNT');
 if(amountEUR>0)post(w,key,'cash',positiveAccount,amountEUR);
 if(amountEUR<0)post(w,key,negativeAccount,'cash',-amountEUR);
}
export function enableCareerFinance(w){
 if(!w?.clubId||w.advancedV1?.enabled!==true)fail('REQUIRES_ADVANCED');
 if(financeEnabled(w))return w;
 if(state(w)!==undefined)fail('UNKNOWN_SCHEMA');
 const club=managed(w);if(!club||!money(club.balance))fail('CLUB');
 const currentWages=clubPlayers(w,w.clubId).reduce((a,p)=>a+(p.wage||0),0);
 w.advancedV1.financeV1={schemaVersion:1,clubId:w.clubId,revision:0,season:w.season,
   cashEUR:0,openingEUR:club.balance,initialSeason:w.season,
   wageCapWeeklyEUR:Math.max(currentWages+100_000,Math.ceil(currentWages*1.35)),
   transferReserveEUR:0,creditLimitEUR:Math.max(1_000_000,Math.round(club.reputation*160_000)),
   debtEUR:0,entries:[],keys:[],history:[],alerts:[],formerClubs:[],
   currentSeasonStartEUR:club.balance};
 postNet(w,`opening:${w.season}:${w.round}`,club.balance,'equity','equity');
 if(!validateCareerFinance(w))fail('INIT');return w;
}
/** Does not touch cash. Record existing transfers/cup prizes exactly once. */
export function reconcileCareerFinance(w,{reason='external'}={}){
 if(!financeEnabled(w))return 0;
 const s=state(w),club=managed(w);if(s.clubId!==w.clubId)fail('CLUB_SWITCH');
 const difference=club.balance-s.cashEUR;if(!money(difference))fail('RECONCILIATION');
 const key=`reconcile:${s.revision}:${w.season}:${w.round}`;
 const type=reason==='transfer'?(difference>=0?'transferIncome':'transferExpense'):difference>=0?'otherIncome':'otherExpense';
 if(difference)postNet(w,key,difference,type,type);
 return difference;
}
const roundRecord=w=>w.financeHistory.findLast?.(x=>x.season===w.season&&x.round===w.round)
 ?? [...w.financeHistory].reverse().find(x=>x.season===w.season&&x.round===w.round);
function reportAlert(w,type,shortfall){
 const s=state(w),key=`${w.season}:${w.round}:${type}`;
 if(s.alerts.some(a=>a.key===key))return;
 s.alerts.push({key,season:w.season,round:w.round,type,amountEUR:shortfall});s.alerts=s.alerts.slice(-120);
 addMessage(w,'Allerta finanziaria',`Situazione finanziaria da monitorare: ${type}.`, 'finance', {type:'finance.alert',params:{type,amountEUR:shortfall}});
}
/** Settle only after the legacy game has already computed this round's revenue/wages. */
export function settleCareerFinanceRound(w){
 if(!financeEnabled(w))return false;
 const s=state(w),club=managed(w),r=roundRecord(w);
 if(!r||!money(r.revenue)||!money(r.wages)||s.keys.includes(`round:${w.season}:${w.round}:sponsor`))fail('ROUND_DATA');
 const sponsor=Math.min(r.revenue,85_000+club.reputation*2500),ticket=r.revenue-sponsor;
 if(sponsor)post(w,`round:${w.season}:${w.round}:sponsor`,'cash','sponsor',sponsor);

 if(ticket)post(w,`round:${w.season}:${w.round}:ticket`,'cash','ticket',ticket);
 if(r.wages)post(w,`round:${w.season}:${w.round}:wage`,'wages','cash',r.wages);
 // Any residual is MKT01–04 or cup transfers already applied by the game.
 reconcileCareerFinance(w,{reason:'round'});
 // Supplemental income is generated once from attendance and division/reputation.
 const home=w.fixtures[w.round-1]?.matches.some(m=>m.home===w.clubId);
 const cityFactor=String(club.city||'').length%9*.009;
 const place=Math.max(1,table(w).findIndex(row=>row.id===w.clubId)+1);
 const performance=Math.max(-.08,Math.min(.08,(w.teams.length/2-place)*.012));
 const tierFactor=w.advancedV1?.divisionsV1?.managedTier==='lower'?.86:1;
 const occupancy=Math.max(.35,Math.min(.97,(.42+Math.min(.28,club.reputation/310)+cityFactor+performance+((w.round%5)-2)*.012)*tierFactor));
 const attendance=home?Math.min(club.capacity,Math.round(club.capacity*occupancy)):0;
 const seasonTickets=home?Math.round(attendance*4):0;
 const facilityCost=home?Math.round(75_000+club.capacity*2.2):22_000;
 const staffCost=Math.round(17_000+(club.reputation||50)*1050);
 if(seasonTickets){club.balance+=seasonTickets;post(w,`round:${w.season}:${w.round}:season-tickets`,'cash','seasonTicket',seasonTickets);}
 club.balance-=facilityCost+staffCost;
 post(w,`round:${w.season}:${w.round}:stadium`,'stadium','cash',facilityCost);
 post(w,`round:${w.season}:${w.round}:staff`,'staff','cash',staffCost);
 if(s.debtEUR>0){const interest=Math.ceil(s.debtEUR*.055/52);club.balance-=interest;post(w,`round:${w.season}:${w.round}:interest`,'interest','cash',interest);}
 const target=250_000;
 if(club.balance<target){
   const borrowing=Math.min(Math.max(0,s.creditLimitEUR-s.debtEUR),target-club.balance);
   if(borrowing){club.balance+=borrowing;s.debtEUR+=borrowing;post(w,`round:${w.season}:${w.round}:credit`,'cash','debt',borrowing);}
   if(club.balance<target)reportAlert(w,'insolvency_risk',target-club.balance);
 }
 const wage=clubPlayers(w,w.clubId).reduce((n,p)=>n+p.wage,0);
 if(wage>s.wageCapWeeklyEUR)reportAlert(w,'wage_cap',wage-s.wageCapWeeklyEUR);
 const remaining=w.fixtures.length-w.round;
 const net=financeSeasonReport(w,w.season).netEUR;
 if(club.balance+net/Math.max(1,w.round)*remaining<0)reportAlert(w,'forecast',Math.abs(club.balance+Math.round(net/Math.max(1,w.round)*remaining)));
 if(r)r.balance=club.balance;
 if(!validateCareerFinance(w))fail('ROUND_INTEGRITY');return true;
}
export function configureCareerFinanceBudget(w,{revision,wageCapWeeklyEUR,transferReserveEUR}={}){
 if(!financeEnabled(w))fail('NOT_ENABLED');const s=state(w),c=managed(w);
 if(revision!==s.revision)fail('STALE_REVISION');
 const wage=clubPlayers(w,w.clubId).reduce((n,p)=>n+p.wage,0);
 if(!money(wageCapWeeklyEUR)||wageCapWeeklyEUR<wage||wageCapWeeklyEUR>20_000_000)fail('WAGE_BUDGET');
 if(!money(transferReserveEUR)||transferReserveEUR<0||transferReserveEUR>Math.max(0,c.balance))fail('TRANSFER_RESERVE');
 s.wageCapWeeklyEUR=wageCapWeeklyEUR;s.transferReserveEUR=transferReserveEUR;s.revision++;
 if(!validateCareerFinance(w))fail('BUDGET_INVALID');return s;
}
export function financeCanCommit(w,{feeEUR=0,addedWagesWeeklyEUR=0}={}){
 if(!financeEnabled(w))return true;const s=state(w),c=managed(w);
 return money(feeEUR)&&money(addedWagesWeeklyEUR)&&feeEUR>=0&&
  c.balance-feeEUR>=s.transferReserveEUR&&c.transferBudget>=feeEUR&&
  clubPlayers(w,w.clubId).reduce((n,p)=>n+p.wage,0)+addedWagesWeeklyEUR<=s.wageCapWeeklyEUR;
}
/** A board dismissal can move the manager to another club. Preserve the old
 * ledger as a read-only archive and initialize a fresh opening balance there.
 * Never transfer cash/debt between clubs merely because the manager changes. */
export function changeFinanceClub(w,previousClubId){
 if(!financeEnabled(w))return false;
 const s=state(w);if(s.clubId!==previousClubId||w.clubId===previousClubId)fail('JOB_CHANGE');
 const oldClub=w.teams.find(t=>t.id===previousClubId);
 if(!oldClub||s.cashEUR!==oldClub.balance)fail('JOB_CASH');
 const old={clubId:previousClubId,endedSeason:w.season,entries:s.entries,history:s.history,closingCashEUR:s.cashEUR,debtEUR:s.debtEUR};
 const former=[...(s.formerClubs||[]),old];
 delete w.advancedV1.financeV1;
 enableCareerFinance(w);
 state(w).formerClubs=former.slice(-20);
 if(!validateCareerFinance(w))fail('JOB_VALIDATION');return true;
}
export function careerFinanceForecast(w){
 if(!financeEnabled(w))return null;
 const s=state(w),period=financeSeasonReport(w),remaining=Math.max(0,w.fixtures.length-w.round);
 const weekly=period.netEUR/Math.max(1,w.round);
 const forecastEUR=managed(w).balance+Math.round(weekly*remaining);
 return {forecastEUR,remainingRounds:remaining,creditAvailableEUR:s.creditLimitEUR-s.debtEUR,weeklyNetEUR:Math.round(weekly)};
}
export function financeSeasonReport(w,season=w.season){
 if(!financeEnabled(w))return null;
 const s=state(w),entries=s.entries.filter(x=>x.season===season);
 const income={},expenses={};
 for(const e of entries){
  const amount=e.amountEUR;
  if(operatingIncome.has(e.credit))income[e.credit]=(income[e.credit]||0)+amount;
  if(operatingExpense.has(e.debit))expenses[e.debit]=(expenses[e.debit]||0)+amount;
 }
 const revenueEUR=Object.values(income).reduce((a,b)=>a+b,0),expensesEUR=Object.values(expenses).reduce((a,b)=>a+b,0);
 return {season,income,expenses,revenueEUR,expensesEUR,netEUR:revenueEUR-expensesEUR,cashEUR:s.cashEUR,debtEUR:s.debtEUR,entries:entries.length};
}
/** MGT03: charge an explicit staff/facility delta once. The existing MGT02
 * operating staff overhead is not reclassified or charged a second time. */
export function postCareerFacilityCash(w,key,deltaEUR,account='staff'){
 if(!financeEnabled(w)||!['staff','stadium'].includes(account)||!money(deltaEUR)||deltaEUR===0)fail('FACILITY');
 const c=managed(w),s=state(w);
 if(s.keys.includes(key))fail('FACILITY_DUPLICATE');
 if(deltaEUR<0&&c.balance+deltaEUR<0)fail('FACILITY_FUNDS');
 c.balance+=deltaEUR;
 if(deltaEUR>0)post(w,key,'cash',account,deltaEUR,{kind:'facility'});
 else post(w,key,account,'cash',-deltaEUR,{kind:'facility'});
 if(!validateCareerFinance(w))fail('FACILITY_BALANCE');
 return deltaEUR;
}
export function postCareerPrize(w,amountEUR){
 if(!financeEnabled(w))return false;
 if(!money(amountEUR)||amountEUR<=0)fail('PRIZE');
 post(w,`prize:${w.season}`,'cash','prizes',amountEUR);
 return true;
}
export function closeCareerFinanceSeason(w){
 if(!financeEnabled(w))return false;
 reconcileCareerFinance(w,{reason:'season'});
 const s=state(w);if(s.history.some(h=>h.season===w.season))fail('DOUBLE_CLOSE');
 s.history.push({...financeSeasonReport(w),closingBalanceEUR:managed(w).balance});
 s.history=s.history.slice(-35);
 return true;
}
export function openCareerFinanceSeason(w){
 if(!financeEnabled(w))return false;const s=state(w);
 if(s.season!==w.season-1)fail('SEASON_SYNC');
 s.season=w.season;s.currentSeasonStartEUR=managed(w).balance;s.revision++;
 reconcileCareerFinance(w,{reason:'season'});return true;
}
export function validateCareerFinance(w){
 const s=state(w);if(s===undefined)return true;
 if(!w.advancedV1?.enabled||s?.schemaVersion!==1||s.clubId!==w.clubId||!money(s.cashEUR)||!money(s.openingEUR)||!money(s.debtEUR)||s.debtEUR<0||!money(s.creditLimitEUR)||s.debtEUR>s.creditLimitEUR||!Number.isSafeInteger(s.revision)||s.revision<0||!money(s.wageCapWeeklyEUR)||s.wageCapWeeklyEUR<0||!money(s.transferReserveEUR)||s.transferReserveEUR<0||!Array.isArray(s.entries)||!Array.isArray(s.keys)||!Array.isArray(s.history)||!Array.isArray(s.alerts)||!Array.isArray(s.formerClubs)||!Number.isInteger(s.season)||s.season!==w.season)return false;
 const keys=new Set();let cash=0,debt=0;
 for(const e of s.entries){if(typeof e.key!=='string'||keys.has(e.key)||!Object.hasOwn(FINANCE_ACCOUNTS,e.debit)||!Object.hasOwn(FINANCE_ACCOUNTS,e.credit)||e.debit===e.credit||!money(e.amountEUR)||e.amountEUR<=0||!Number.isInteger(e.season)||!Number.isInteger(e.round))return false;keys.add(e.key);cash+=(e.debit==='cash'?e.amountEUR:0)-(e.credit==='cash'?e.amountEUR:0);debt+=(e.credit==='debt'?e.amountEUR:0)-(e.debit==='debt'?e.amountEUR:0);}
 if(keys.size!==s.keys.length||s.keys.some(k=>!keys.has(k))||cash!==s.cashEUR||debt!==s.debtEUR)return false;
 // The cash account must agree with the authoritative club after a completed action.
 if(s.cashEUR!==managed(w)?.balance)return false;
 return true;
}
