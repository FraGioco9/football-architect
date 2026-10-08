/** MKT01 — authoritative market for the playable career. All mutations are
 * performed on a detached career and committed together by the slot/IDB layer.
 * EUR whole numbers are canonical in official finances; quote amounts are cents.
 */
// Equivalent read-only schema check; avoids a career-world ↔ career-market cycle.
const hasCareerWorld=w=>w?.advancedV1?.enabled===true&&w.advancedV1?.worldV1?.schemaVersion===1;
const relegatedLeague=(w,country)=>w.advancedV1?.divisionsV1?.countries?.[country]?.lower;
import {makeQuote} from '../addons/domain/transfer-market.mjs';
import {makeTerms,validateTerms} from '../addons/domain/player-contract.mjs';
import {copyPlayerWithAttributes} from '../addons/domain/player-generator.mjs';
import {ATTRIBUTE_KEYS,createAttributes} from '../addons/domain/player-attributes.mjs';
import {initialMedical} from '../addons/domain/player-medical.mjs';
import {initialDevelopment} from '../addons/domain/player-development.mjs';
import {toAddonPosition} from '../addons/career-bridge.mjs';
import {addMessage} from './history.js';
import {personalityEnabled,personalityContractInterest} from './career-personality.js';

const fail=c=>{throw Error('MKT01_'+c);};
const integer=(x,min=0,max=1_000_000_000)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const countries=()=>['IT','EN','ES','DE','FR','NL','PT','BR'];
const clubKey=(country,id)=>`${country}:club:${id}`;
const playerKey=(w,p)=>p.globalId??`${w.countryId}:${p.id}`;
const idOK=s=>typeof s==='string'&&/^[A-Z]{2,3}:(?:club:)?[A-Za-z0-9._:-]+$/.test(s)&&s.length<90;
const copy=x=>structuredClone(x);
const currentDay=w=>w.advancedV1.clockDay;
export const marketEnabled=w=>hasCareerWorld(w)&&w.advancedV1.marketV1?.schemaVersion===1;
export const managedClubKey=w=>clubKey(w.countryId,w.clubId);
function clubInfo(w,key){
 if(!idOK(key))fail('CLUB_ID');const m=/^([A-Z]{2,3}):club:(\d+)$/.exec(key);if(!m)fail('CLUB_ID');
 const [,country,num]=m,clubId=Number(num);
 if(country===w.countryId){const club=w.teams.find(c=>c.id===clubId);if(club)return {country,clubId,club,managed:true,key};const upper=w.advancedV1.worldV1.leagues.find(l=>l.countryId===country&&!l.locked);const first=upper?.clubs.find(c=>c.id===clubId);if(first)return {country,clubId,club:first,league:upper,managed:false,key};const lower=relegatedLeague(w,country),second=lower?.clubs?.find(c=>c.id===clubId);if(second)return {country,clubId,club:second,league:lower,managed:false,key};fail('CLUB');}
 const l=w.advancedV1.worldV1.leagues.find(l=>l.countryId===country&&!l.locked);
 const club=l?.clubs.find(c=>c.id===clubId);if(club)return {country,clubId,club,league:l,managed:false,key};const lower=relegatedLeague(w,country),second=lower?.clubs?.find(c=>c.id===clubId);if(second)return {country,clubId,club:second,league:lower,managed:false,key};fail('CLUB');
}
function playerInfo(w,globalId){
 if(!idOK(globalId))fail('PLAYER_ID');
 const managed=w.players.find(p=>playerKey(w,p)===globalId&&p.clubId>0);
 if(managed)return {player:managed,clubKey:clubKey(w.countryId,managed.clubId),managed:true};
 for(const l of w.advancedV1.worldV1.leagues){if(l.locked)continue;
  const p=l.players.find(p=>p.id===globalId);if(p)return {player:p,clubKey:clubKey(l.countryId,p.clubId),managed:false,league:l};}
 for(const country of countries()){const lower=relegatedLeague(w,country);const p=lower?.players?.find(x=>x.id===globalId);if(p)return {player:p,clubKey:clubKey(country,p.clubId),managed:false,league:lower};}
 fail('PLAYER_UNAVAILABLE');
}
function roster(w,key){const c=clubInfo(w,key);return c.managed?w.players.filter(p=>p.clubId===c.clubId):c.league.players.filter(p=>p.clubId===c.clubId);}
function balance(w,key){const c=clubInfo(w,key);return c.managed?c.club.balance:w.advancedV1.marketV1.foreignFinances[key].balance;}
function spending(w,key){const c=clubInfo(w,key);return c.managed?c.club.transferBudget:w.advancedV1.marketV1.foreignFinances[key].budget;}
function moveMoney(w,from,to,amount){
 if(!integer(amount)||balance(w,from)<amount||spending(w,from)<amount)fail('FUNDS');
 const a=clubInfo(w,from),b=clubInfo(w,to);
 if(a.managed){a.club.balance-=amount;a.club.transferBudget-=amount;}else{w.advancedV1.marketV1.foreignFinances[from].balance-=amount;w.advancedV1.marketV1.foreignFinances[from].budget-=amount;}
 if(b.managed){b.club.balance+=amount;b.club.transferBudget+=amount;}else{w.advancedV1.marketV1.foreignFinances[to].balance+=amount;w.advancedV1.marketV1.foreignFinances[to].budget+=amount;}
}
function ensureMarket(w){if(!marketEnabled(w))fail('NOT_ENABLED');return w.advancedV1.marketV1;}
export function enableCareerMarket(w){
 if(!hasCareerWorld(w))fail('REQUIRES_WORLD');if(marketEnabled(w))return w;
 if(w.advancedV1.marketV1!==undefined)fail('SCHEMA_NEWER');
 const foreignFinances=Object.create(null);
 for(const l of w.advancedV1.worldV1.leagues)if(!l.locked)for(const c of l.clubs){
  const key=clubKey(l.countryId,c.id),strength=c.reputation;
  foreignFinances[key]={balance:Math.max(12_000_000,Math.round(strength*750_000)),budget:Math.max(6_000_000,Math.round(strength*350_000))};
 }
 w.advancedV1.marketV1={schemaVersion:1,revision:0,sequence:0,season:w.season,deals:{},loans:{},installments:[],movements:[],foreignFinances};
 if(!validateCareerMarket(w))fail('INITIALIZATION');return w;
}
/** Every callable transition has revision-based compare-and-swap semantics. */
function transact(w,revision,apply){
 const state=ensureMarket(w);if(!integer(revision,0,1_000_000_000)||revision!==state.revision)fail('STALE_REVISION');
 const draft=copy(w);const result=apply(draft,draft.advancedV1.marketV1);
 draft.advancedV1.marketV1.revision++;
 if(!validateCareerMarket(draft))fail('INVALID_COMMIT');
 Object.assign(w,draft);return result;
}
export function marketClubs(w){if(!hasCareerWorld(w))return [];
 return [...w.advancedV1.worldV1.leagues.flatMap(l=>l.locked
  ?w.teams.map(c=>({key:clubKey(w.countryId,c.id),name:c.name,countryId:w.countryId,reputation:c.reputation}))
  :l.clubs.map(c=>({key:clubKey(l.countryId,c.id),name:c.name,countryId:l.countryId,reputation:c.reputation}))),
  ...(w.advancedV1.divisionsV1?.managedTier===2?w.teams.map(c=>({key:clubKey(w.countryId,c.id),name:c.name,countryId:w.countryId,reputation:c.reputation})):[])];
}
export function marketPlayers(w,{countryId='ALL',search='',position='ALL',limit=150}={}){
 if(!hasCareerWorld(w))return [];
 const lower=String(search).trim().toLocaleLowerCase(),clubNames=new Map(marketClubs(w).map(c=>[c.key,c.name.toLocaleLowerCase()])),cands=[...w.players.filter(p=>p.clubId>0).map(p=>({id:playerKey(w,p),player:p,source:w.countryId})),
  ...w.advancedV1.worldV1.leagues.filter(l=>!l.locked).flatMap(l=>l.players.map(p=>({id:p.id,player:p,source:l.countryId})))];
 return cands.filter(({id,player:p,source})=>(countryId==='ALL'||source===countryId)&&(position==='ALL'||p.position===position)&&(!lower||p.name.toLocaleLowerCase().includes(lower)||id.toLocaleLowerCase().includes(lower)||clubNames.get(clubKey(source,p.clubId))?.includes(lower)))
 .sort((a,b)=>a.player.name.localeCompare(b.player.name)||a.id.localeCompare(b.id)).slice(0,limit).map(x=>({id:x.id,name:x.player.name,position:x.player.position,ovr:x.player.ovr,age:x.player.age,countryId:x.source,clubKey:playerInfo(w,x.id).clubKey}));
}
export const marketExistingWageEUR=(w,globalId)=>playerInfo(w,globalId).player.wage*52;
export function marketValuation(w,globalId,buyerKey=managedClubKey(w)){
 const source=playerInfo(w,globalId),buyer=clubInfo(w,buyerKey),seller=clubInfo(w,source.clubKey),p=source.player;
 const value=Math.max(50_000,Math.round((p.value??(p.ovr**3*3))*((p.age<23)?1.2:(p.age>32)?.65:1)/1000)*1000);
 const asking=Math.round(value*(p.contract<=1?1.08:1.25)/1000)*1000;
 const wanted=Math.round(Math.max(p.wage??3000,((p.wage??3000)*(1+Math.max(0,(buyer.club.attractiveness??buyer.club.reputation)-(seller.club.attractiveness??seller.club.reputation))/200)))/100)*100;
 return {id:globalId,sellerKey:source.clubKey,buyerKey,valueEUR:value,askingEUR:asking,weeklyWageEUR:wanted,releaseClauseEUR:p.releaseClauseEUR??null,availability:p.contract<=1?'negotiable':p.ovr>seller.club.reputation+10?'reluctant':'open'};
}
function quoteCheck(w,q,baseDay=currentDay(w),baseSeason=w.season){
 if(!q||!['permanent','loan'].includes(q.type)||!integer(q.feeMinorEUR)||!integer(q.bonusMinorEUR)||!integer(q.validUntilDay,baseDay,baseDay+365))fail('QUOTE');
 if(q.feeMinorEUR%100||q.bonusMinorEUR%100||!Array.isArray(q.installments)||q.installments.length>5)fail('QUOTE');
 let scheduled=0,last=baseSeason;
 for(const installment of q.installments){if(!integer(installment.dueSeason,baseSeason+1,baseSeason+5)||installment.dueSeason<=last||!integer(installment.amountMinorEUR,100)||installment.amountMinorEUR%100)fail('INSTALLMENT');scheduled+=installment.amountMinorEUR;last=installment.dueSeason;}
 if(scheduled>q.feeMinorEUR)fail('INSTALLMENT_TOTAL');
 if(q.type==='loan'){
  if(q.installments.length||!integer(q.loanEndSeason,baseSeason,baseSeason+2)||!integer(q.salarySharePct,0,100)||q.salarySharePct%5)fail('LOAN_TERMS');
 }else if(q.loanEndSeason!==null||q.salarySharePct!==null)fail('QUOTE');
 if(q.releaseClauseMinorEUR!==null&&(!integer(q.releaseClauseMinorEUR)||q.releaseClauseMinorEUR%100))fail('CLAUSE');
}
export function createCareerQuote(w,{type='permanent',feeEUR=0,bonusEUR=0,days=28,installments=[],loanEndSeason=null,salarySharePct=null,releaseClauseEUR=null}={}){
 const quote=makeQuote({type,feeMinorEUR:feeEUR*100,bonusMinorEUR:bonusEUR*100,validUntilDay:currentDay(w)+days,installments:installments.map(x=>({dueSeason:x.dueSeason,amountMinorEUR:x.amountEUR*100})),loanEndSeason,salarySharePct,releaseClauseMinorEUR:releaseClauseEUR===null?null:releaseClauseEUR*100});quoteCheck(w,quote);return quote;
}
export function startMarketDeal(w,{revision,playerId,buyerKey,quote}={}){
 return transact(w,revision,(draft,s)=>{
  quoteCheck(draft,quote);const found=playerInfo(draft,playerId),buyer=clubInfo(draft,buyerKey);
  if(found.clubKey===buyer.key)fail('SAME_CLUB');
  if(s.loans[playerId]||Object.values(s.deals).some(d=>d.playerId===playerId&&!['completed','rejected','expired'].includes(d.status)))fail('ALREADY_NEGOTIATING');
  const dealId='mkt-'+(++s.sequence),d={id:dealId,playerId,sellerKey:found.clubKey,buyerKey,offer:copy(quote),openedSeason:draft.season,openedDay:currentDay(draft),status:'awaiting_seller',terms:null,history:[{step:'offer',side:'buyer',day:currentDay(draft),offer:copy(quote)}]};
  s.deals[dealId]=d;return dealId;
 });
}
function dealOpen(w,s,id){const d=s.deals[id];if(!d)fail('DEAL');if(currentDay(w)>d.offer.validUntilDay&&d.status!=='completed'){d.status='expired';fail('EXPIRED');}return d;}
function trace(w,d,step,side,details={}){d.history.push({step,side,day:currentDay(w),...details});if(d.history.length>35)d.history.shift();}
export function marketClubDecision(w,d){
 const val=marketValuation(w,d.playerId,d.buyerKey),amount=d.offer.feeMinorEUR/100+d.offer.bonusMinorEUR/100;
 const desired=d.offer.type==='loan'
  ?Math.round(Math.max(1_000,val.askingEUR*.015-marketExistingWageEUR(w,d.playerId)*d.offer.salarySharePct/100*.10)/1000)*1000
  :d.offer.releaseClauseMinorEUR!==null&&val.releaseClauseEUR!==null&&d.offer.releaseClauseMinorEUR>=val.releaseClauseEUR?val.releaseClauseEUR:val.askingEUR;
 if(amount>=desired)return {decision:'accept',askEUR:desired};
 if(amount<desired*.55)return {decision:'reject',askEUR:desired};
 return {decision:'counter',askEUR:Math.max(amount+1000,Math.round(desired*.96/1000)*1000)};
}
export function answerMarketClub(w,{revision,dealId,side,decision,counterQuote=null}={}){
 return transact(w,revision,(draft,s)=>{
  const d=dealOpen(draft,s,dealId),expected=d.status==='awaiting_seller'?'seller':d.status==='awaiting_buyer'?'buyer':null;
  if(!expected||side!==expected||!['accept','reject','counter'].includes(decision)||d.history.length>=30)fail('TURN');
  if(decision==='reject')d.status='rejected';
  else if(decision==='counter'){quoteCheck(draft,counterQuote);d.offer=copy(counterQuote);d.status=side==='seller'?'awaiting_buyer':'awaiting_seller';}
  else d.status='club_agreed';
  trace(draft,d,decision,side,decision==='counter'?{offer:copy(counterQuote)}:{});return d.status;
 });
}
function bestPersonal(w,d,terms){
 const found=playerInfo(w,d.playerId),wanted=marketValuation(w,d.playerId,d.buyerKey).weeklyWageEUR;
 if(d.offer.type==='loan')return terms.annualWage===playerInfo(w,d.playerId).player.wage*52;
 if(personalityEnabled(w)&&personalityContractInterest(w,found.player,{offeredRaise:Math.max(-100,Math.min(300,Math.round((terms.annualWage/52/Math.max(1,found.player.wage??3000)-1)*100)))})<30)return false;
 const role=terms.promisedRole;
 return terms.annualWage/52>=wanted*(role==='leader'?.85:role==='starter'?.94:1);
}
export function proposeMarketTerms(w,{revision,dealId,annualWageEUR,years=3,role='starter',signingBonusEUR=0}={}){
 return transact(w,revision,(draft,s)=>{
  const d=dealOpen(draft,s,dealId);if(!['club_agreed','player_counter'].includes(d.status))fail('PERSONAL_TURN');
  if(d.offer.type==='loan'){
   const p=playerInfo(draft,d.playerId).player;
   if(annualWageEUR!==(p.wage??3000)*52||signingBonusEUR!==0)fail('LOAN_WAGE');
  }
  const terms=makeTerms({startSeason:draft.season,years,annualWage:annualWageEUR,bonuses:{signing:signingBonusEUR},promisedRole:role});
  d.terms=terms;d.status='awaiting_player';trace(draft,d,'terms','buyer',{terms:copy(terms)});return d.status;
 });
}
export function answerMarketPlayer(w,{revision,dealId,decision,annualWageEUR=null}={}){
 return transact(w,revision,(draft,s)=>{
  const d=dealOpen(draft,s,dealId);if(d.status!=='awaiting_player'||!['accept','reject','counter'].includes(decision))fail('PERSONAL_TURN');
  if(decision==='reject')d.status='rejected';
  else if(decision==='counter'){
   if(!integer(annualWageEUR)||d.offer.type==='loan')fail('PERSONAL_COUNTER');
   d.terms={...d.terms,annualWage:annualWageEUR};validateTerms(d.terms);d.status='player_counter';
  }else{if(!bestPersonal(draft,d,d.terms))fail('PLAYER_UNWILLING');d.status='ready';}
  trace(draft,d,decision,'player');return d.status;
 });
}
function maxId(w){return Math.max(0,...w.players.map(p=>p.id))+1;}
function transferPlayer(w,globalId,destKey,loan=false){
 const from=playerInfo(w,globalId),dest=clubInfo(w,destKey),p=from.player;
 if(from.managed){
  if(dest.managed){p.clubId=dest.clubId;}
  else{
   if(!loan){p.historicalClubId=p.clubId;p.clubId=0;p.departedTo=destKey;}else{p.historicalClubId=p.clubId;p.clubId=0;p.departedTo=destKey;}
   const external={id:globalId,name:p.name,clubId:dest.clubId,position:p.position,age:p.age,ovr:p.ovr,potential:p.potential,contract:p.contract,apps:0,goals:0,nationality:p.nationality,wage:p.wage,attributes:{...p.attributeProfile?.values},personalityProfile:structuredClone(p.personalityProfile)};
   if(Object.keys(external.attributes).length!==ATTRIBUTE_KEYS.length)fail('PLAYER_ATTRIBUTES');dest.league.players.push(external);
  }
 }else{
  // Preserve seasonal scoring already completed in the country of origin.
  // The player's identity stays global, but stats belong to the competition.
  if(from.league.countryId!==dest.country&&(p.apps>0||p.goals>0)){
   from.league.departedScorers??=[];
   from.league.departedScorers.push({id:p.id,name:p.name,clubId:p.clubId,apps:p.apps,goals:p.goals});
  }
  from.league.players=from.league.players.filter(x=>x.id!==globalId);
  if(from.league.countryId!==dest.country){p.apps=0;p.goals=0;}
  if(dest.managed){
   let local=w.players.find(x=>playerKey(w,x)===globalId);
   if(local){local.clubId=dest.clubId;local.departedTo=undefined;local.age=p.age;local.ovr=p.ovr;local.contract=p.contract;}
   else{
    const id=Math.max(maxId(w),w.advancedV1.youthV1?.nextPlayerId??1),raw={...p,id,globalId,clubId:dest.clubId,foot:'Destro',fitness:95,morale:75,form:6.8,value:Math.round(p.ovr**3*3/1000)*1000,wage:p.wage??3000,injury:0,apps:0,assists:0,yellow:0,cleanSheets:0,history:[]};
    const externalAttributes=raw.attributes?createAttributes(raw.attributes,{origin:'market-v2'}):null;
    delete raw.attributes;delete raw.goals;raw.goals=0;
    raw.attributeProfile=externalAttributes??copyPlayerWithAttributes({...raw,position:toAddonPosition(raw.position)},{seed:w.seed,countryId:dest.country}).attributeProfile;
    raw.medicalV1=initialMedical({...raw,unavailable:false},{day:w.advancedV1.clockDay});
    if(w.advancedV1.trainingV1)raw.developmentV1=initialDevelopment({...raw,position:toAddonPosition(raw.position)},{seed:w.seed,countryId:w.countryId,startSeason:w.season});
    w.players.push(raw);
    if(w.advancedV1.youthV1){const y=w.advancedV1.youthV1;if(y.usedIds.includes(id))fail('DUPLICATE_ID');y.usedIds.push(id);y.nextPlayerId=Math.max(y.nextPlayerId,id+1);}
   }
  }else{p.clubId=dest.clubId;dest.league.players.push(p);}
 }
 if(from.managed&&w.lineup.includes(p.id))w.lineup=w.lineup.map(x=>x===p.id?null:x);
}
/** Shared MKT01 settlement; AI and player transfers obey exactly the same checks. */
function commitReadyMarketDeal(draft,s,dealId){
  const d=dealOpen(draft,s,dealId);if(d.status==='completed'){fail('ALREADY_COMPLETED');}
  if(d.status!=='ready')fail('NOT_READY');if(playerInfo(draft,d.playerId).clubKey!==d.sellerKey)fail('OWNERSHIP');
  if(s.loans[d.playerId])fail('PLAYER_LOANED');
  if(roster(draft,d.buyerKey).length>=32)fail('ROSTER_FULL');if(roster(draft,d.sellerKey).length<=18)fail('SELLER_TOO_FEW');
  const q=d.offer,immediate=q.feeMinorEUR/100-q.installments.reduce((a,b)=>a+b.amountMinorEUR/100,0)+q.bonusMinorEUR/100;
  const signing=q.type==='permanent'?d.terms.bonuses.signing:0;
  const old=playerInfo(draft,d.playerId).player;
  const annual=old.wage*52,newWage=d.terms.annualWage;
  if(!integer(immediate)||balance(draft,d.buyerKey)<immediate+signing||spending(draft,d.buyerKey)<immediate+signing)fail('FUNDS');
  if(q.releaseClauseMinorEUR!==null&&old.releaseClauseEUR!==undefined&&q.releaseClauseMinorEUR<old.releaseClauseEUR*100)fail('CLAUSE');
  const weekly=roster(draft,d.buyerKey).reduce((a,p)=>a+(p.wage??0),0)+(q.type==='loan'?Math.round(old.wage*q.salarySharePct/100):Math.round(newWage/52));
  const buyer=clubInfo(draft,d.buyerKey);
  if(weekly>Math.max(600_000,buyer.club.reputation*16_000))fail('WAGES');
  moveMoney(draft,d.buyerKey,d.sellerKey,immediate);
  if(signing){const finance=clubInfo(draft,d.buyerKey);if(finance.managed){finance.club.balance-=signing;finance.club.transferBudget-=signing;}else{const f=s.foreignFinances[d.buyerKey];f.balance-=signing;f.budget-=signing;}}
  if(q.type==='loan'){
   const perSeason=Math.round(old.wage*52*q.salarySharePct/100);
   if(balance(draft,d.buyerKey)<perSeason||spending(draft,d.buyerKey)<perSeason)fail('SALARY_COVER');
   if(perSeason)moveMoney(draft,d.buyerKey,d.sellerKey,perSeason);
   for(let year=draft.season+1;year<=q.loanEndSeason;year++)if(perSeason)s.installments.push({dealId:d.id,dueSeason:year,amountEUR:perSeason,buyerKey:d.buyerKey,sellerKey:d.sellerKey,kind:'salary',paid:false});
   s.loans[d.playerId]={playerId:d.playerId,originKey:d.sellerKey,destinationKey:d.buyerKey,endSeason:q.loanEndSeason,originalWeeklyWage:old.wage};
  }
  for(const i of q.installments)s.installments.push({dealId:d.id,dueSeason:i.dueSeason,amountEUR:i.amountMinorEUR/100,buyerKey:d.buyerKey,sellerKey:d.sellerKey,kind:'fee',paid:false});
  transferPlayer(draft,d.playerId,d.buyerKey,q.type==='loan');
  if(q.type==='permanent'){
   const updated=playerInfo(draft,d.playerId).player;updated.wage=Math.round(newWage/52);updated.contract=d.terms.endSeason-draft.season+1;updated.releaseClauseEUR=d.terms.clauses.releaseFee;
  }
  d.status='completed';d.completedSeason=draft.season;trace(draft,d,'completed','system');
  s.movements.push({dealId:d.id,season:draft.season,playerId:d.playerId,from:d.sellerKey,to:d.buyerKey,type:q.type,feeEUR:q.feeMinorEUR/100,immediateEUR:immediate,bonusEUR:q.bonusMinorEUR/100,policy:'FA-FIXED-2026-01'});
  const localFrom=clubInfo(draft,d.sellerKey),localTo=clubInfo(draft,d.buyerKey);
  const playerName=playerInfo(draft,d.playerId).player.name;
  if(localFrom.managed||localTo.managed){draft.transfers.unshift({season:draft.season,round:draft.round,playerId:localTo.managed?playerInfo(draft,d.playerId).player.id:old.id,from:localFrom.managed?localFrom.clubId:null,to:localTo.managed?localTo.clubId:null,fromGlobal:d.sellerKey,toGlobal:d.buyerKey,fee:q.feeMinorEUR/100,type:q.type,name:playerName});
   addMessage(draft,`Mercato: ${playerName}`,`${playerName}: ${q.type==='loan'?'prestito':'trasferimento'} ${d.sellerKey} → ${d.buyerKey}.`,'transfer');}
  return d.id;
}

export function completeMarketDeal(w,{revision,dealId,actionId=null,calendarExecution=false}={}){
 if(w.advancedV1?.calendarV1&&!calendarExecution)fail('REGISTRATION_REQUIRED');
 return transact(w,revision,(draft,s)=>commitReadyMarketDeal(draft,s,dealId));
}

/** A fully negotiated AI-to-AI move, atomic in the MKT01 market revision.
 * The caller never writes players or money directly; the shared settlement does it.
 * MKT02's calendar registration is appended by the AI scheduler on the same career
 * checkpoint. This API deliberately cannot buy from / sell to the player club.
 */
export function completeAutonomousMarketDeal(w,{revision,playerId,buyerKey,type='permanent',feeEUR,annualWageEUR,salarySharePct=50,loanEndSeason=w.season,years=3}={}){
 if(!w.advancedV1?.calendarV1||!w.advancedV1?.scoutingV1||!w.advancedV1?.aiMarketV1)fail('AI_NOT_ENABLED');
 return transact(w,revision,(draft,s)=>{
  const seller=playerInfo(draft,playerId),buyer=clubInfo(draft,buyerKey);
  if(seller.clubKey===buyerKey||seller.clubKey===managedClubKey(draft)||buyerKey===managedClubKey(draft))fail('AI_MANAGED_CLUB');
  if(s.loans[playerId]||Object.values(s.deals).some(d=>d.playerId===playerId&&!['completed','rejected','expired'].includes(d.status)))fail('ALREADY_NEGOTIATING');
  if(Object.values(draft.advancedV1.calendarV1.pending).some(p=>p.playerId===playerId))fail('RESERVED');
  if(!['permanent','loan'].includes(type)||!integer(feeEUR)||feeEUR>50_000_000||!integer(annualWageEUR,5200,20_000_000))fail('AI_TERMS');
  const periods={IT:[[0,42],[126,161]],ENG:[[0,42],[126,154]],ES:[[0,49],[133,168]],DE:[[0,42],[133,161]],FR:[[0,49],[126,161]],NL:[[0,49],[126,168]],PT:[[0,56],[133,175]],BR:[[0,56],[126,175]]};
  const offset=currentDay(draft)-draft.advancedV1.calendarV1.originDay;
  if(!periods[buyer.country]?.some(([a,b])=>offset>=a&&offset<=b))fail('AI_WINDOW_CLOSED');
  if(type==='loan'&&(!integer(salarySharePct,0,100)||salarySharePct%5||loanEndSeason!==draft.season))fail('AI_LOAN');
  const quote=makeQuote({type,feeMinorEUR:feeEUR*100,bonusMinorEUR:0,validUntilDay:currentDay(draft),installments:[],loanEndSeason:type==='loan'?loanEndSeason:null,salarySharePct:type==='loan'?salarySharePct:null,releaseClauseMinorEUR:null});
  quoteCheck(draft,quote);
  const terms=makeTerms({startSeason:draft.season,years,annualWage:annualWageEUR,bonuses:{signing:0},promisedRole:'starter'});
  if(type==='loan'&&annualWageEUR!==seller.player.wage*52)fail('AI_LOAN_WAGE');
  if(type==='permanent'&&!bestPersonal(draft,{playerId,buyerKey,offer:quote},terms))fail('PLAYER_UNWILLING');
  const id='mkt-'+(++s.sequence);
  s.deals[id]={id,playerId,sellerKey:seller.clubKey,buyerKey,offer:quote,openedDay:currentDay(draft),openedSeason:draft.season,status:'ready',terms,history:[{step:'offer',side:'buyer',day:currentDay(draft),offer:copy(quote)},{step:'accept',side:'seller',day:currentDay(draft)},{step:'accept',side:'player',day:currentDay(draft)}],automated:true};
  return commitReadyMarketDeal(draft,s,id);
 });
}

/** An expired offer cannot be accepted when advancing the official calendar.
 * This is part of the same checked match/season transaction. */
export function expireCareerMarketOffers(w){
 if(!marketEnabled(w))return 0;
 let count=0;const s=w.advancedV1.marketV1;
 for(const d of Object.values(s.deals))if(!['completed','rejected','expired'].includes(d.status)&&!w.advancedV1.calendarV1?.pending?.[d.id]&&currentDay(w)>d.offer.validUntilDay){d.status='expired';trace(w,d,'expired','system');count++;}
 if(count)s.revision++;
 return count;
}
/** Return loans only AFTER WRD05 captures the closing season and BEFORE foreign
 * retirement/intake. This protects the original club's ownership and the
 * transferred player's historical goals in both competitions. */
export function returnMarketLoansAfterArchive(w){
 if(!marketEnabled(w))return;
 const s=ensureMarket(w);
 for(const [pid,l] of Object.entries(s.loans))if(l.endSeason<=w.season){
  if(roster(w,l.originKey).length>=32)fail('LOAN_RETURN_ROSTER');
  transferPlayer(w,pid,l.originKey);delete s.loans[pid];
 }
}
/** Called on the same season transaction after archiving WRD05 and world advancement. */
export function settleCareerMarketSeason(w){
 if(!marketEnabled(w))return;
 const s=ensureMarket(w),next=w.season;
 const due=s.installments.filter(i=>!i.paid&&i.dueSeason<=next);
 for(const i of due){moveMoney(w,i.buyerKey,i.sellerKey,i.amountEUR);i.paid=true;i.paidSeason=next;}
 for(const [pid,l] of Object.entries(s.loans))if(l.endSeason<w.season){
  if(roster(w,l.originKey).length>=32)fail('LOAN_RETURN_ROSTER');
  transferPlayer(w,pid,l.originKey);delete s.loans[pid];
 }
 for(const d of Object.values(s.deals))if(!['completed','rejected','expired'].includes(d.status))d.status='expired';
 s.season=next;s.revision++;
 if(!validateCareerMarket(w))fail('SEASON_INTEGRITY');
}
export function validateCareerMarket(w){
 const m=w?.advancedV1?.marketV1;
 if(m===undefined)return true;
 if(!hasCareerWorld(w)||m?.schemaVersion!==1||!integer(m.revision,0,1_000_000_000)||!integer(m.sequence)||!integer(m.season,1,9999)||m.season!==w.season||!m.deals||!m.loans||!m.foreignFinances||!Array.isArray(m.installments)||!Array.isArray(m.movements))return false;
 try{
  const seen=new Set();for(const p of w.players.filter(p=>p.clubId>0)){const id=playerKey(w,p);if(seen.has(id))return false;seen.add(id);}
  for(const l of w.advancedV1.worldV1.leagues)if(!l.locked)for(const p of l.players){if(seen.has(p.id))return false;seen.add(p.id);}
  for(const country of ['IT','ENG','ES','DE','FR','NL','PT','BR'])for(const p of relegatedLeague(w,country)?.players??[]){if(seen.has(p.id))return false;seen.add(p.id);}
  for(const [key,f] of Object.entries(m.foreignFinances)){if(!idOK(key)||!clubInfo(w,key)||!integer(f.balance)||!integer(f.budget))return false;}
  for(const [id,d] of Object.entries(m.deals)){if(id!==d.id||!idOK(d.playerId)||!clubInfo(w,d.buyerKey)||!clubInfo(w,d.sellerKey)||!Array.isArray(d.history)||!['awaiting_seller','awaiting_buyer','club_agreed','awaiting_player','player_counter','ready','completed','rejected','expired'].includes(d.status))return false;
   if(d.status!=='completed'&&d.status!=='rejected'&&d.status!=='expired'&&playerInfo(w,d.playerId).clubKey!==d.sellerKey)return false;
   quoteCheck(w,d.offer,d.openedDay,d.openedSeason);
  }
  for(const [id,l] of Object.entries(m.loans))if(id!==l.playerId||!idOK(id)||playerInfo(w,id).clubKey!==l.destinationKey||!clubInfo(w,l.originKey)||!integer(l.endSeason,w.season,w.season+2))return false;
  for(const i of m.installments)if(!m.deals[i.dealId]||!integer(i.dueSeason,1,10000)||!integer(i.amountEUR)||typeof i.paid!=='boolean'||!clubInfo(w,i.buyerKey)||!clubInfo(w,i.sellerKey))return false;
  return true;
 }catch{return false;}
}
