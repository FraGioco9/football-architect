/** Football Architect MKT01.01–06 — isolated, atomic, deterministic career market.
 * No calendar window is assumed (MKT02). All EUR fees are integer minor units;
 * PLY05 contract book stores integer major EUR, converted explicitly at the edge.
 * World and contract book are included in the SAME immutable returned transaction.
 */
import {validateUniverse} from './world-leagues.mjs';
import {makeBook,validateBook} from './player-contract-book.mjs';
import {makeContract,makeTerms,validateTerms} from './player-contract.mjs';
import {appendMovement,quoteMovement,validateMovement} from './currency.mjs';

export const MARKET_VERSION=1;
export const MARKET_STATUSES=Object.freeze(['awaiting_seller','awaiting_buyer','club_agreed','awaiting_player','player_counter','ready','rejected','expired','completed']);
const problem=x=>{throw new Error(`MKT01_${x}`);};
const clone=x=>structuredClone(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const safe=x=>Number.isSafeInteger(x);
const id=x=>typeof x==='string'&&x.length>0&&x.length<=75&&/^[a-zA-Z0-9:_.-]+$/.test(x)&&!['__proto__','prototype','constructor'].includes(x);
const key=x=>{if(!id(String(x)))problem('ID');return String(x);};
const whole=(n,max=9_000_000_000_000)=>{if(!safe(n)||n<0||n>max)problem('AMOUNT');return n;};
const euro=n=>{whole(n);if(n%100!==0)problem('WHOLE_EUROS_REQUIRED');return n/100;};
const sorted=x=>Object.keys(x).sort();
const fp=(name,payload)=>JSON.stringify([name,payload]);
function findClub(world,clubId){for(const league of world.leagues){const club=league.clubs.find(c=>c.id===clubId);if(club)return {league,club};}problem('CLUB_UNKNOWN');}
function findPlayer(world,playerId){for(const league of world.leagues)for(const club of league.clubs){const player=club.players.find(p=>p.id===playerId);if(player)return {league,club,player};}problem('PLAYER_UNKNOWN');}
function enter(world,clubId,player){const x=findClub(world,clubId);if(x.club.players.length>=30)problem('ROSTER_FULL');x.club.players.push({...player,clubId});}
function remove(world,playerId){const x=findPlayer(world,playerId);x.club.players=x.club.players.filter(p=>p.id!==playerId);return {...x,player:clone(x.player)};}
function originCountry(world,clubId){return findClub(world,clubId).league.countryId;}
function assessClub(clubId,world){const x=findClub(world,clubId);const squad=x.club.players;return {clubId,countryId:x.league.countryId,reputation:Math.min(100,Math.max(1,Math.round(x.club.strength))),size:squad.length};}
function validateQuote(q,day,season){
 if(!obj(q)||!['permanent','loan'].includes(q.type)||!safe(q.validUntilDay)||q.validUntilDay<day||q.validUntilDay>day+365)problem('QUOTE_VALIDITY');
 for(const k of ['feeMinorEUR','bonusMinorEUR'])euro(q[k]);
 if(!Array.isArray(q.installments)||q.installments.length>5)problem('INSTALLMENTS');
 let sum=0;let last=season;
 for(const i of q.installments){if(!obj(i)||!safe(i.dueSeason)||i.dueSeason<=last||i.dueSeason>season+5)problem('INSTALLMENT_DUE');euro(i.amountMinorEUR);if(i.amountMinorEUR===0)problem('EMPTY_INSTALLMENT');sum+=i.amountMinorEUR;last=i.dueSeason;}
 if(!safe(sum)||sum>q.feeMinorEUR)problem('INSTALLMENT_TOTAL');
 if(q.type==='loan'){
  if(!safe(q.loanEndSeason)||q.loanEndSeason<season||q.loanEndSeason>season+2||!safe(q.salarySharePct)||q.salarySharePct<0||q.salarySharePct>100||q.salarySharePct%5)problem('LOAN_TERMS');
  if(q.installments.length)problem('LOAN_INSTALLMENTS');
 }else if(q.loanEndSeason!==null||q.salarySharePct!==null)problem('PERMANENT_TERMS');
 if(q.releaseClauseMinorEUR!==null)euro(q.releaseClauseMinorEUR);
 return true;
}
export function makeQuote({type='permanent',feeMinorEUR=0,bonusMinorEUR=0,validUntilDay,installments=[],loanEndSeason=null,salarySharePct=null,releaseClauseMinorEUR=null}={}){
 return {type,feeMinorEUR,bonusMinorEUR,validUntilDay,installments:clone(installments),loanEndSeason,salarySharePct,releaseClauseMinorEUR};
}
/** Deterministic disclosure: never reads CA/PA, hidden potential or non-public traits. */
export function evaluateTransfer(state,{playerId,buyerClubId}={}){
 validateMarket(state);const p=findPlayer(state.world,key(playerId)),buyer=assessClub(key(buyerClubId),state.world),seller=assessClub(p.club.id,state.world);
 const c=state.book.contracts[p.player.id];if(!c)problem('CONTRACT_MISSING');
 const age=Number.isSafeInteger(p.player.age)&&p.player.age>=15&&p.player.age<=50?p.player.age:25;
 const ovr=p.player.ovr;const years=Math.max(0,c.terms.endSeason-state.world.season+1);
 const ageFactor=age<=25?120:age<=30?110:age<=34?85:65;
 const valueEUR=Math.max(5000,Math.round((ovr*ovr*12*ageFactor/100)*(0.65+0.12*years)/1000)*1000);
 const valueMinorEUR=valueEUR*100;
 const willingToSell=years<2?'negotiable':p.player.ovr>=p.club.strength+8?'not_for_sale':'open';
 const releaseMinorEUR=c.terms.clauses.releaseFee===null?null:c.terms.clauses.releaseFee*100;
 const askMinorEUR=willingToSell==='not_for_sale'?Math.round(valueMinorEUR*1.7/100)*100:Math.round(valueMinorEUR*(years<2?1.08:1.25)/100)*100;
 const desiredAnnualWageEUR=Math.max(c.terms.annualWage,Math.round((c.terms.annualWage*(1+(Math.max(0,buyer.reputation-seller.reputation)/200)))/100)*100);
 return {playerId:p.player.id,sellerClubId:p.club.id,buyerClubId:buyer.clubId,valueMinorEUR,askingMinorEUR:askMinorEUR,availability:willingToSell,desiredAnnualWageEUR,releaseMinorEUR,fromCountry:seller.countryId,toCountry:buyer.countryId,observedOVR:ovr,age,yearsRemaining:years};
}
export function createMarket({world,book,defaultCashEUR=10_000_000,defaultWageLimitEUR=5_000_000}={}){
 validateUniverse(world);whole(defaultCashEUR,1_000_000_000);whole(defaultWageLimitEUR,1_000_000_000);
 const actualBook=book??makeBook({season:world.season,clubs:world.leagues.flatMap(l=>l.clubs.map(c=>({id:c.id,cashBalance:defaultCashEUR,wageLimit:defaultWageLimitEUR}))),players:world.leagues.flatMap(l=>l.clubs.flatMap(c=>c.players.map(p=>({...p,clubId:c.id,salary:p.salary??p.wage??1000,contractYears:p.contractYears??3}))))});
 const state={schemaVersion:MARKET_VERSION,revision:0,world:clone(world),book:clone(actualBook),deals:{},loans:{},installments:[],movements:[],events:[],applied:{}};
 validateMarket(state);return state;
}
export function validateMarket(s){
 if(!obj(s)||s.schemaVersion!==1||!safe(s.revision)||s.revision<0||!obj(s.deals)||!obj(s.loans)||!Array.isArray(s.installments)||!Array.isArray(s.movements)||!Array.isArray(s.events)||!obj(s.applied))problem('SCHEMA');
 validateUniverse(s.world);validateBook(s.book);if(s.world.season!==s.book.season)problem('SEASON_MISMATCH');
 const players=new Map(),clubs=new Set();for(const l of s.world.leagues)for(const c of l.clubs){clubs.add(c.id);for(const p of c.players)players.set(p.id,c.id);}
 const loans=new Set();for(const [k,l] of Object.entries(s.loans)){
  if(!id(k)||!obj(l)||l.playerId!==k||!id(l.originClubId)||!id(l.destinationClubId)||!clubs.has(l.originClubId)||!clubs.has(l.destinationClubId)||!safe(l.endSeason)||!safe(l.salarySharePct)||l.salarySharePct<0||l.salarySharePct>100||loans.has(k))problem('LOAN');
  loans.add(k);if(!s.book.contracts[k]||s.book.contracts[k].clubId!==l.originClubId||players.get(k)!==l.destinationClubId)problem('LOAN_OWNERSHIP');
 }
 for(const [p,clubId] of players){const c=s.book.contracts[p];if(!c||c.clubId!==(s.loans[p]?.originClubId??clubId))problem('OWNERSHIP');}
 for(const [p,c] of Object.entries(s.book.contracts))if(!players.has(p))problem('CONTRACT_NO_PLAYER');
 for(const [k,d] of Object.entries(s.deals)){
  if(!id(k)||!obj(d)||d.id!==k||!id(d.playerId)||!id(d.buyerClubId)||!id(d.sellerClubId)||!clubs.has(d.buyerClubId)||!clubs.has(d.sellerClubId)||!MARKET_STATUSES.includes(d.status)||!Array.isArray(d.history)||!d.history.length)problem('DEAL');
  if(d.status==='completed'){
   // Completion is historical; subsequent legitimate resales must not invalidate old deals.
   const completedEvent=s.book.events.find(e=>e.id===`transfer-event:${k}`);
   if(!completedEvent||completedEvent.playerId!==d.playerId||completedEvent.fromClubId!==d.sellerClubId||completedEvent.toClubId!==d.buyerClubId||completedEvent.feeMinorEUR!==d.offer.feeMinorEUR||
      (d.offer.type==='permanent'&&!s.book.archive.some(x=>x.id===`transfer:${k}`)))problem('DEAL_COMPLETION_INTEGRITY');
  }
  validateQuote(d.offer,d.openedDay,d.season);if(d.personalTerms!==null)validateTerms(d.personalTerms);
 }
 const ids=new Set();for(const m of s.movements){if(!obj(m)||typeof m.id!=='string'||ids.has(m.id))problem('MOVEMENT_DUPLICATE');validateMovement(m);ids.add(m.id);}
 for(const e of s.installments){
  if(!obj(e)||!id(e.dealId)||!id(e.buyerClubId)||!id(e.sellerClubId)||!safe(e.dueSeason)||!safe(e.amountMinorEUR)||e.amountMinorEUR<=0||typeof e.paid!=='boolean')problem('INSTALLMENT_STATE');
  const recorded=s.movements.find(m=>m.id===`mkt:${e.dealId}:inst${e.index}`);
  if(e.paid?recorded?.baseMinorEUR!==e.amountMinorEUR:recorded!==undefined)problem('INSTALLMENT_LEDGER');
 }
 for(const [k,a] of Object.entries(s.applied))if(!id(k)||!obj(a)||typeof a.fingerprint!=='string')problem('ACTION_INDEX');
 return true;
}
function apply(s,{actionId,expectedRevision},action,payload,callback){
 validateMarket(s);const actionKey=key(actionId),fingerprint=fp(action,payload);
 if(s.applied[actionKey]){if(s.applied[actionKey].fingerprint!==fingerprint)problem('ACTION_CONFLICT');return clone(s);}
 if(expectedRevision!==undefined&&expectedRevision!==s.revision)problem('STALE_REVISION');
 const n=clone(s);callback(n);n.revision++;n.applied[actionKey]={fingerprint,revision:n.revision};
 validateMarket(n);return n;
}
const fresh=(s,dealId)=>{const d=s.deals[key(dealId)];if(!d)problem('DEAL_UNKNOWN');if(s.world.day>d.offer.validUntilDay&&d.status!=='completed'&&d.status!=='rejected'&&d.status!=='expired')problem('DEAL_EXPIRED');return d;};
const openDeal=d=>!['completed','rejected','expired'].includes(d.status);
const record=(s,d,type,actor,more={})=>{const e={type,actor,day:s.world.day,...more};d.history.push(e);s.events.push({dealId:d.id,...e});};
const eligible=(s,d)=>{const p=findPlayer(s.world,d.playerId);if(p.club.id!==d.sellerClubId||s.loans[d.playerId]||s.book.contracts[d.playerId]?.clubId!==d.sellerClubId)problem('NO_LONGER_AVAILABLE');if(d.sellerClubId===d.buyerClubId)problem('SELF_TRANSFER');return p;};
export function submitOffer(s,{actionId,expectedRevision,dealId,playerId,buyerClubId,offer}={}){
 const pid=key(playerId),buyer=key(buyerClubId),deal=key(dealId);validateQuote(offer,s.world.day,s.world.season);
 return apply(s,{actionId,expectedRevision},'offer',{deal,pid,buyer,offer},n=>{
  if(n.deals[deal])problem('DEAL_DUPLICATE');const p=findPlayer(n.world,pid);if(p.club.id===buyer)problem('SELF_TRANSFER');findClub(n.world,buyer);
  if(n.loans[pid])problem('PLAYER_ON_LOAN');if(Object.values(n.deals).some(x=>x.playerId===pid&&openDeal(x)))problem('PLAYER_IN_NEGOTIATION');
  const terms=clone(offer);n.deals[deal]={id:deal,playerId:pid,sellerClubId:p.club.id,buyerClubId:buyer,season:n.world.season,openedDay:n.world.day,status:'awaiting_seller',offer:terms,personalTerms:null,round:1,history:[]};
  record(n,n.deals[deal],'club_offer','buyer',{offer:terms});
 });
}
export function respondClub(s,{actionId,expectedRevision,dealId,actor,decision,offer=null}={}){
 const keyDeal=key(dealId);if(!['buyer','seller'].includes(actor)||!['accept','reject','counter'].includes(decision))problem('DECISION');
 if(decision==='counter')validateQuote(offer,s.world.day,s.world.season);
 return apply(s,{actionId,expectedRevision},'club_response',{keyDeal,actor,decision,offer},n=>{
  const d=fresh(n,keyDeal);eligible(n,d);const expected=d.status==='awaiting_seller'?'seller':d.status==='awaiting_buyer'?'buyer':null;
  if(actor!==expected)problem('TURN');
  if(decision==='reject'){d.status='rejected';record(n,d,'rejected',actor);return;}
  if(decision==='counter'){
   if(d.round>=10)problem('ROUND_LIMIT');d.offer=clone(offer);d.round++;d.status=actor==='seller'?'awaiting_buyer':'awaiting_seller';record(n,d,'club_counter',actor,{offer:clone(offer)});return;
  }
  d.status='club_agreed';record(n,d,'club_agreed',actor);
 });
}
export function offerPersonalTerms(s,{actionId,expectedRevision,dealId,terms,actor='buyer'}={}){
 const deal=key(dealId);validateTerms(terms);if(actor!=='buyer'&&actor!=='player')problem('ACTOR');
 return apply(s,{actionId,expectedRevision},'personal_offer',{deal,actor,terms},n=>{
  const d=fresh(n,deal);eligible(n,d);
  if(!(d.status==='club_agreed'&&actor==='buyer'||d.status==='player_counter'&&actor==='buyer'))problem('PERSONAL_TURN');
  if(terms.startSeason!==n.world.season)problem('TERMS_SEASON');
  if(d.offer.type==='loan'&&terms.annualWage!==n.book.contracts[d.playerId].terms.annualWage)problem('LOAN_WAGE_UNCHANGED');
  d.personalTerms=clone(terms);d.status='awaiting_player';record(n,d,'personal_offer',actor,{terms:clone(terms)});
 });
}
/** Explanation is based solely on disclosed financial, role and reputation information. */
export function evaluatePersonalTerms(s,{dealId,terms}={}){
 validateMarket(s);const d=s.deals[key(dealId)];if(!d)problem('DEAL_UNKNOWN');validateTerms(terms);
 const original=s.book.contracts[d.playerId],old=assessClub(d.sellerClubId,s.world),dest=assessClub(d.buyerClubId,s.world);
 const desired=Math.max(original.terms.annualWage, Math.round((original.terms.annualWage*(1+Math.max(0,dest.reputation-old.reputation)/200))/100)*100);
 const wageRatio=desired===0?2:terms.annualWage/desired;
 const roleRank={prospect:0,rotation:1,starter:2,leader:3};const change=roleRank[terms.promisedRole]-roleRank[original.terms.promisedRole];
 const score=Math.max(0,Math.min(100,Math.round(48+(wageRatio-1)*85+change*8+(dest.reputation-old.reputation)*0.3)));
 const reasons=[wageRatio<0.9?'wage_below_expectations':'wage_acceptable',change<0?'role_downgrade':'role_acceptable',dest.reputation<old.reputation?'ambition_mismatch':'ambition_acceptable'];
 return {score,likelyToAccept:score>=45,desiredAnnualWageEUR:desired,reasons};
}
export function answerPersonalTerms(s,{actionId,expectedRevision,dealId,decision,terms=null}={}){
 const deal=key(dealId);if(!['accept','reject','counter'].includes(decision))problem('DECISION');if(decision==='counter')validateTerms(terms);
 return apply(s,{actionId,expectedRevision},'personal_response',{deal,decision,terms},n=>{
  const d=fresh(n,deal);eligible(n,d);if(d.status!=='awaiting_player')problem('PERSONAL_TURN');
  if(decision==='reject'){d.status='rejected';record(n,d,'personal_rejected','player');return;}
  if(decision==='counter'){if(d.round>=10)problem('ROUND_LIMIT');if(terms.startSeason!==n.world.season)problem('TERMS_SEASON');if(d.offer.type==='loan'&&terms.annualWage!==n.book.contracts[d.playerId].terms.annualWage)problem('LOAN_WAGE_UNCHANGED');d.personalTerms=clone(terms);d.round++;d.status='player_counter';record(n,d,'personal_counter','player',{terms:clone(terms)});return;}
  if(!evaluatePersonalTerms(n,{dealId:deal,terms:d.personalTerms}).likelyToAccept)problem('PLAYER_UNWILLING');
  d.status='ready';record(n,d,'personal_agreed','player');
 });
}
function charge(book,from,to,amount){const major=euro(amount);if(book.clubs[from].cashBalance<major)problem('FUNDS');if(book.clubs[to].cashBalance+major>1_000_000_000)problem('CASH_OVERFLOW');book.clubs[from].cashBalance-=major;book.clubs[to].cashBalance+=major;}
function singleCost(book,club,amount){const major=euro(amount);if(book.clubs[club].cashBalance<major)problem('FUNDS');book.clubs[club].cashBalance-=major;}
function movement(s,{dealId,suffix,from,to,amount}){if(amount===0)return;const fromCountry=originCountry(s.world,from),toCountry=originCountry(s.world,to);s.movements=appendMovement(s.movements,quoteMovement({id:`mkt:${dealId}:${suffix}`,baseMinorEUR:amount,fromCountry,toCountry}));}
export function finalizeDeal(s,{actionId,expectedRevision,dealId}={}){
 const deal=key(dealId);
 return apply(s,{actionId,expectedRevision},'finalize',{deal},n=>{
  const d=fresh(n,deal);if(d.status!=='ready')problem('NOT_READY');eligible(n,d);
  const q=d.offer,buyer=n.book.clubs[d.buyerClubId],seller=n.book.clubs[d.sellerClubId],prev=n.book.contracts[d.playerId];
  const deferred=q.installments.reduce((sum,x)=>sum+x.amountMinorEUR,0);const immediate=q.feeMinorEUR-deferred;
  const release=prev.terms.clauses.releaseFee;if(q.releaseClauseMinorEUR!==null&&release!==null&&q.releaseClauseMinorEUR<release*100)problem('CLAUSE_UNDERPAID');
  const needs=wageToReserve(n,d);
  if(buyer.wageCommitment+reservedLoanWages(n,d.buyerClubId)+needs>buyer.wageLimit)problem('WAGE_LIMIT');
  if(findClub(n.world,d.buyerClubId).club.players.length>=30)problem('ROSTER_FULL');
  if(findClub(n.world,d.sellerClubId).club.players.length<=11)problem('SELLER_TOO_FEW_PLAYERS');
  // Final acceptance spends only explicitly due cash. Future instalments are registered as liabilities.
  if(buyer.cashBalance*100<immediate+q.bonusMinorEUR+d.personalTerms.bonuses.signing*100)problem('FUNDS');
  if(seller.cashBalance+(immediate+q.bonusMinorEUR)/100>1_000_000_000)problem('CASH_OVERFLOW');
  const moved=remove(n.world,d.playerId).player;enter(n.world,d.buyerClubId,moved);
  charge(n.book,d.buyerClubId,d.sellerClubId,immediate+q.bonusMinorEUR);
  movement(n,{dealId:deal,suffix:'fee',from:d.buyerClubId,to:d.sellerClubId,amount:immediate+q.bonusMinorEUR});
  if(q.type==='permanent'){
   singleCost(n.book,d.buyerClubId,d.personalTerms.bonuses.signing*100);
   n.book.archive.push({id:`transfer:${deal}`,reason:'transfer',season:n.world.season,contract:clone(prev)});
   n.book.contracts[d.playerId]=makeContract({playerId:d.playerId,clubId:d.buyerClubId,terms:d.personalTerms,revision:prev.revision+1,history:[...prev.history,{id:`transfer:${deal}`,type:'transfer',season:n.world.season,previousClubId:d.sellerClubId,feeMinorEUR:q.feeMinorEUR}]});
   seller.wageCommitment-=prev.terms.annualWage;buyer.wageCommitment+=d.personalTerms.annualWage;
  }else{
   if(d.personalTerms.bonuses.signing!==0)problem('LOAN_SIGNING_BONUS');
   n.loans[d.playerId]={playerId:d.playerId,dealId:deal,originClubId:d.sellerClubId,destinationClubId:d.buyerClubId,startSeason:n.world.season,endSeason:q.loanEndSeason,salarySharePct:q.salarySharePct};
   const salaryShare=Math.round(prev.terms.annualWage*q.salarySharePct/100);
   // Annual salary coverage is settled at the start of each season.
   if(prev.terms.endSeason<q.loanEndSeason)problem('LOAN_OUTLIVES_CONTRACT');
   if(salaryShare>0){
    charge(n.book,d.buyerClubId,d.sellerClubId,salaryShare*100);movement(n,{dealId:deal,suffix:'salary',from:d.buyerClubId,to:d.sellerClubId,amount:salaryShare*100});
    for(let season=n.world.season+1;season<=q.loanEndSeason;season++)n.installments.push({dealId:deal,index:`salary${season}`,buyerClubId:d.buyerClubId,sellerClubId:d.sellerClubId,dueSeason:season,amountMinorEUR:salaryShare*100,paid:false});
   }
  }
  n.installments.push(...q.installments.map((i,j)=>({dealId:deal,index:j,buyerClubId:d.buyerClubId,sellerClubId:d.sellerClubId,dueSeason:i.dueSeason,amountMinorEUR:i.amountMinorEUR,paid:false})));
  n.book.revision++;n.book.events.push({id:`transfer-event:${deal}`,season:n.book.season,type:q.type==='loan'?'loan':'transfer',playerId:d.playerId,fromClubId:d.sellerClubId,toClubId:d.buyerClubId,feeMinorEUR:q.feeMinorEUR});
  n.world.revision++;d.status='completed';record(n,d,'completed','system',{amountMinorEUR:q.feeMinorEUR,transferType:q.type});
 });
}
function wageToReserve(s,d){return d.offer.type==='permanent'?d.personalTerms.annualWage:Math.round(s.book.contracts[d.playerId].terms.annualWage*d.offer.salarySharePct/100);}
function reservedLoanWages(s,clubId){return Object.values(s.loans).filter(l=>l.destinationClubId===clubId).reduce((total,l)=>total+Math.round(s.book.contracts[l.playerId].terms.annualWage*l.salarySharePct/100),0);}
/** Update day (not a transfer window); expiry is explicit, with no money or roster mutation. */
export function marketDay(s,{actionId,expectedRevision,toDay}={}){
 return apply(s,{actionId,expectedRevision},'day',{toDay},n=>{
  if(!safe(toDay)||toDay<n.world.day||toDay>300000)problem('DAY');
  // Only for a day with no pending fixture: use WRD01 advanceUniverse in an integrated build.
  for(const l of n.world.leagues)for(const r of l.rounds)if(r.day<=toDay&&r.day>=n.world.day&&r.matches.some(m=>m.result===null))problem('FIXTURES_PENDING');
  n.world.day=toDay;n.world.revision++;
  for(const d of Object.values(n.deals))if(openDeal(d)&&d.offer.validUntilDay<toDay){d.status='expired';record(n,d,'expired','system');}
 });
}
/** Import a season transition performed by authoritative WRD01 + PLY05; no silent migration. */
export function syncMarketSeason(s,{actionId,expectedRevision,world,book}={}){
 return apply(s,{actionId,expectedRevision},'season_sync',{worldRevision:world?.revision,bookRevision:book?.revision},n=>{
  validateUniverse(world);validateBook(book);if(world.season!==book.season||world.season!==n.world.season+1)problem('SEASON_SYNC');
  n.world=clone(world);n.book=clone(book);
  // Loan return and future installments must be explicitly settled BEFORE beginning the next season.
  if(Object.values(n.loans).some(l=>l.endSeason<world.season)||n.installments.some(i=>!i.paid&&i.dueSeason<world.season))problem('UNSETTLED_LIABILITY');
  for(const d of Object.values(n.deals))if(openDeal(d)){d.status='expired';record(n,d,'expired','system');}
 });
}
export function repayDueInstallments(s,{actionId,expectedRevision}={}){
 return apply(s,{actionId,expectedRevision},'repay',{season:s.world.season},n=>{
  for(const p of n.installments)if(!p.paid&&p.dueSeason<=n.world.season){charge(n.book,p.buyerClubId,p.sellerClubId,p.amountMinorEUR);movement(n,{dealId:p.dealId,suffix:`inst${p.index}`,from:p.buyerClubId,to:p.sellerClubId,amount:p.amountMinorEUR});p.paid=true;}
  n.book.revision++;
 });
}
export function endLoan(s,{actionId,expectedRevision,playerId}={}){
 const player=key(playerId);
 return apply(s,{actionId,expectedRevision},'return_loan',{player},n=>{
  const l=n.loans[player];if(!l)problem('NOT_ON_LOAN');if(n.world.season<l.endSeason)problem('LOAN_NOT_ENDED');
  if(n.world.season===l.endSeason&&n.world.leagues.some(league=>league.clubs.some(c=>[l.originClubId,l.destinationClubId].includes(c.id))&&league.rounds.some(r=>r.matches.some(m=>m.result===null))))problem('SEASON_FIXTURES_PENDING');
  const moved=remove(n.world,player).player;enter(n.world,l.originClubId,moved);delete n.loans[player];n.world.revision++;
  n.book.events.push({id:`loan-return:${player}:${n.world.season}`,season:n.world.season,type:'loan_return',playerId:player,clubId:l.originClubId});n.book.revision++;
 });
}
export function exportMarket(s){validateMarket(s);return JSON.stringify(s);}
export function importMarket(json){if(typeof json!=='string'||json.length>80_000_000)problem('IMPORT_SIZE');let data;try{data=JSON.parse(json);}catch{problem('IMPORT_JSON');}validateMarket(data);return clone(data);}
