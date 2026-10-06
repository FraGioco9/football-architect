/** PLY05 — official optional contract layer. The existing player.wage and
 * player.contract stay authoritative for the simulation. This module never
 * collects baseline wages a second time. All writes are checkpointed by main.
 */
import {clubPlayers} from './selectors.js';
import {addMessage} from './history.js';
import {makeTerms,makeContract,validateContract,validateTerms,CONTRACT_ROLES} from '../addons/domain/player-contract.mjs';
import {initialPromiseRecord,recordPromiseMatch,assessPromise,validatePromise} from '../addons/domain/player-contract-promises.mjs';
import {reviewPlayerOffer} from '../addons/domain/player-contract-scouting.mjs';
import {personalityEnabled,personalityPlayerView} from './career-personality.js';
import {financeEnabled} from './career-finance.js';

const fail=(code)=>{throw Error(`PLY05_${code}`)};
const state=w=>w?.advancedV1?.contractsV1;
const managed=w=>w.teams.find(c=>c.id===w.clubId);
const own=w=>clubPlayers(w,w.clubId);
const validId=x=>typeof x==='string'&&/^\d+$/.test(x)&&Number.isSafeInteger(Number(x))&&Number(x)>0;
const cap=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export const contractsEnabled=w=>w?.advancedV1?.enabled===true&&state(w)?.schemaVersion===1;
function contractFromPlayer(w,p){
 const years=cap(Number.isSafeInteger(p.contract)?p.contract:1,1,10);
 const annualWage=Math.max(0,Math.round(p.wage||0)*52);
 return makeContract({playerId:p.id,clubId:w.clubId,terms:makeTerms({startSeason:w.season,years,annualWage,promisedRole:'rotation'})});
}
function notify(w,type,player,extra={},inputRequest=null){
 const labels={enabled:'Contratti attivati',renewed:'Rinnovo contrattuale',expired:'Contratto in scadenza',promise:'Promessa di impiego',counter:'Controproposta contrattuale'};
 const text=type==='enabled'?('Gestione contratti attiva.'):type==='renewed'?`${player.name}: accordo registrato.`:type==='expired'?`${player.name}: contratto in scadenza, valuta il rinnovo.`:type==='counter'?`${player.name}: controproposta ricevuta, serve una tua decisione.`:`${player.name}: verifica del ruolo promesso.`;
 // QOL02 stores the message alongside its canonical event data. A blocking
 // request is explicit metadata and never inferred from the human-readable text.
 addMessage(w,labels[type]||'Contratti',text,'transfer',{
  type:'contract.'+type,
  params:type==='enabled'?{}:{player:player?.name||'—',...extra},
  requiresUserInput:Boolean(inputRequest),
  inputRequest
 });
}
export function enableCareerContracts(w){
 if(!w.clubId||w.advancedV1?.enabled!==true)fail('REQUIRES_ADVANCED');
 if(contractsEnabled(w))return w;
 if(state(w)!==undefined)fail('UNKNOWN_SCHEMA');
 const s={schemaVersion:1,revision:0,season:w.season,clubId:w.clubId,contracts:{},promises:{},offers:{},archive:[],events:[],processedMatches:[],notified:[]};
 for(const p of own(w)){const id=String(p.id);s.contracts[id]=contractFromPlayer(w,p);s.promises[id]=initialPromiseRecord(s.contracts[id]);}
 w.advancedV1.contractsV1=s;notify(w,'enabled');
 if(!validateCareerContracts(w))fail('INITIAL_INVALID');return w;
}
function owned(w,id){const p=own(w).find(x=>String(x.id)===String(id));if(!p)fail('NOT_OWNED');return p;}
function archive(s,id,reason,season){
 const contract=s.contracts[id];if(contract){s.archive.push({playerId:id,season,reason,contract:structuredClone(contract)});if(s.archive.length>500)s.archive.shift();}
 delete s.contracts[id];delete s.promises[id];
 for(const offer of Object.values(s.offers))if(offer.playerId===id&&['awaiting_player','awaiting_club'].includes(offer.status))offer.status='expired';
}
/** Called inside the official transaction on transfers, season changes and club moves. */
export function syncCareerContracts(w){
 if(!contractsEnabled(w))return 0;
 const s=state(w),members=own(w),ids=new Set(members.map(p=>String(p.id)));
 if(s.clubId!==w.clubId){for(const id of Object.keys(s.contracts))archive(s,id,'club_changed',w.season);s.clubId=w.clubId;}
 for(const id of Object.keys(s.contracts))if(!ids.has(id))archive(s,id,'transferred_or_released',w.season);
 for(const p of members){const id=String(p.id),c=s.contracts[id];
  if(!c){s.contracts[id]=contractFromPlayer(w,p);s.promises[id]=initialPromiseRecord(s.contracts[id]);continue;}
  // MKT01/MKT02 may have replaced wage or duration while contract state was
  // not open. Mirror that authoritative transaction, do not bill a second time.
  const officialAnnual=Math.round(p.wage*52);
  if(c.terms.annualWage!==officialAnnual || (w.season===s.season&&p.contract!==c.terms.endSeason-w.season+1)){
   archive(s,id,'external_market_update',w.season);s.contracts[id]=contractFromPlayer(w,p);s.promises[id]=initialPromiseRecord(s.contracts[id]);
  }
  if(s.contracts[id].terms.endSeason<w.season){
   archive(s,id,'expired_legacy_extension',w.season);s.contracts[id]=contractFromPlayer(w,p);s.promises[id]=initialPromiseRecord(s.contracts[id]);
  }
 }
 if(s.season!==w.season){
  for(const offer of Object.values(s.offers))if(['awaiting_player','awaiting_club'].includes(offer.status))offer.status='expired';
  s.season=w.season;s.notified=[];
 }
 for(const p of members){const c=s.contracts[String(p.id)];if(c.terms.endSeason<=w.season&&!s.notified.includes(String(p.id))){s.notified.push(String(p.id));notify(w,'expired',p);}}
 s.revision++;
 return members.length;
}
function proposedTerms(w,p,offer){
 const current=state(w).contracts[String(p.id)];if(!current)fail('CONTRACT');
 const yearly=offer.annualWage;
 if(!Number.isSafeInteger(yearly)||yearly%52)fail('WAGE_WEEKLY');
 return makeTerms({startSeason:w.season,years:offer.years,annualWage:yearly,bonuses:{signing:offer.signingBonus||0,appearance:offer.appearanceBonus||0,goal:offer.goalBonus||0},promisedRole:offer.promisedRole||'rotation',clauses:{releaseFee:offer.releaseFee??null}});
}
function checkAffordability(w,p,terms){
 const c=managed(w);if(!c)fail('CLUB');
 const signing=terms.bonuses.signing;
 if(c.balance<signing||c.transferBudget<signing)fail('FUNDS');
 const weekly=own(w).reduce((sum,x)=>sum+x.wage,0)-p.wage+Math.round(terms.annualWage/52);
 if(financeEnabled(w)&&weekly>w.advancedV1.financeV1.wageCapWeeklyEUR)fail('WAGE_CAP');
 if(weekly>Math.max(600_000,c.reputation*16_000))fail('WAGES');
 return true;
}
function activeOffer(s,playerId){return Object.values(s.offers).find(o=>o.playerId===playerId&&['awaiting_player','awaiting_club'].includes(o.status));}
export function proposeCareerRenewal(w,{playerId,expectedRevision,years=2,annualWage,signingBonus=0,appearanceBonus=0,goalBonus=0,promisedRole='rotation',releaseFee=null}={}){
 if(!contractsEnabled(w))fail('NOT_ENABLED');const s=state(w),p=owned(w,playerId),id=String(p.id);
 if(expectedRevision!==s.revision)fail('STALE_REVISION');if(activeOffer(s,id))fail('ALREADY_NEGOTIATING');
 const terms=proposedTerms(w,p,{years,annualWage,signingBonus,appearanceBonus,goalBonus,promisedRole,releaseFee});
 checkAffordability(w,p,terms);
 const offerId=`c${w.season}-${s.revision+1}-${id}`;
 s.offers[offerId]={id:offerId,playerId:id,clubId:String(w.clubId),status:'awaiting_player',terms,round:w.round,history:[{by:'club',action:'propose',season:w.season,round:w.round}]};s.revision++;
 return offerId;
}
function applyDeal(w,p,offer){
 checkAffordability(w,p,offer.terms);
 const s=state(w),id=String(p.id),previous=s.contracts[id];const next=makeContract({playerId:id,clubId:w.clubId,terms:offer.terms,revision:previous.revision+1,history:[...previous.history,{id:offer.id,type:'renewal',season:w.season,previousTerms:structuredClone(previous.terms)}]});
 const c=managed(w),bonus=offer.terms.bonuses.signing;
 c.balance-=bonus;c.transferBudget-=bonus;
 p.wage=Math.round(offer.terms.annualWage/52);p.contract=offer.terms.endSeason-w.season+1;p.releaseClauseEUR=offer.terms.clauses.releaseFee;
 s.archive.push({playerId:id,season:w.season,reason:'renewed',contract:structuredClone(previous)});
 s.contracts[id]=next;s.promises[id]=initialPromiseRecord(next);
 offer.status='accepted';offer.history.push({by:'system',action:'signed',season:w.season,round:w.round});
 s.events.push({season:w.season,round:w.round,type:'signed',playerId:id,signingEUR:bonus});s.events=s.events.slice(-250);
 notify(w,'renewed',p,{until:offer.terms.endSeason});
}
export function respondCareerRenewal(w,{offerId,expectedRevision,decision='auto'}={}){
 if(!contractsEnabled(w))fail('NOT_ENABLED');const s=state(w);if(s.revision!==expectedRevision)fail('STALE_REVISION');const o=s.offers[offerId];if(!o||o.status!=='awaiting_player')fail('OFFER_STATUS');
 const p=owned(w,o.playerId),current=s.contracts[o.playerId];
 const profile=personalityEnabled(w)?p.personalityProfile:null;
 const assessed=reviewPlayerOffer(current,o.terms,{personality:profile,morale:cap(Math.round(p.morale),0,100),playingTime:cap(Math.round(p.apps/Math.max(1,w.round)*100),0,100),clubLevel:cap(managed(w).reputation,0,100),promiseRecord:s.promises[o.playerId]});
 let outcome=decision;if(decision==='auto')outcome=assessed.interestScore>=68?'accept':assessed.interestScore<=32?'reject':'counter';
 if(!['accept','reject','counter'].includes(outcome))fail('DECISION');
 if(outcome==='accept'){applyDeal(w,p,o);}else if(outcome==='reject'){o.status='rejected';o.history.push({by:'player',action:'reject',season:w.season,round:w.round});}
 else{const increase=Math.min(1_000_000_000,Math.max(5200,Math.round(o.terms.annualWage*1.08/52)*52));o.terms=makeTerms({...o.terms,annualWage:increase});o.status='awaiting_club';o.history.push({by:'player',action:'counter',season:w.season,round:w.round});notify(w,'counter',p,{}, {type:'contract-counter',id:o.id});}
 s.revision++;return {status:o.status,assessment:assessed};
}
export function decideCareerCounter(w,{offerId,expectedRevision,decision='reject'}={}){
 if(!contractsEnabled(w))fail('NOT_ENABLED');const s=state(w);if(s.revision!==expectedRevision)fail('STALE_REVISION');const o=s.offers[offerId];if(!o||o.status!=='awaiting_club'||!['accept','reject'].includes(decision))fail('OFFER_STATUS');
 if(decision==='accept')applyDeal(w,owned(w,o.playerId),o);else{o.status='rejected';o.history.push({by:'club',action:'reject',season:w.season,round:w.round});}
 s.revision++;return o.status;
}
export function settleCareerContractsRound(w,{matchId=null,startedIds=null}={}){
 if(!contractsEnabled(w))return 0;const s=state(w),key=String(matchId||w.lastMatchId||`${w.season}:${w.round}`);
 if(s.processedMatches.includes(key))return 0;
 const starters=new Set((startedIds??w.lineup).map(String)),club=managed(w);
 let paid=0;for(const p of own(w)){
  const id=String(p.id),c=s.contracts[id];if(!c)continue;
  let promise=s.promises[id];if(promise){promise=recordPromiseMatch(promise,{matchId:key,started:starters.has(id),minutes:starters.has(id)?90:0,captain:starters.has(id)&&id===String(w.lineup[0])});s.promises[id]=promise;}
  if(starters.has(id)){
   const officialMatch=w.fixtures[w.round-1]?.matches.find(m=>m.home===w.clubId||m.away===w.clubId);
   const scored=(officialMatch?.result?.goals||[]).filter(e=>String(e.scorerId)===id).length;
   const earned=c.terms.bonuses.appearance+scored*c.terms.bonuses.goal;
   if(earned>0){club.balance-=earned;paid+=earned;}
  }
  if(promise&&promise.eligibleMatches>=5&&promise.eligibleMatches%5===0){const assessment=assessPromise(promise);if(assessment.met!==null){p.morale=cap(p.morale+assessment.moraleDelta,0,100);s.events.push({season:w.season,round:w.round,type:assessment.met?'promise_met':'promise_broken',playerId:id});}}
 }
 s.processedMatches.push(key);s.processedMatches=s.processedMatches.slice(-150);s.events.push({season:w.season,round:w.round,type:'match',playerId:'0',bonusEUR:paid});s.events=s.events.slice(-250);s.revision++;return paid;
}
export function careerContractView(w){if(!contractsEnabled(w))return null;const s=state(w);
 return {revision:s.revision,contracts:own(w).map(p=>({playerId:p.id,name:p.name,wage:p.wage,contract:p.contract,terms:s.contracts[String(p.id)]?.terms,promise:s.promises[String(p.id)]?assessPromise(s.promises[String(p.id)]):null})),offers:Object.values(s.offers).filter(o=>o.clubId===String(w.clubId)).slice(-40),events:s.events.slice(-20),archive:s.archive.slice(-30)};
}
export function validateCareerContracts(w){
 const s=state(w);if(s===undefined)return true;
 if(w.advancedV1?.enabled!==true||s.schemaVersion!==1||s.clubId!==w.clubId||s.season!==w.season||!Number.isSafeInteger(s.revision)||s.revision<0)return false;
 if(!s.contracts||!s.promises||!s.offers||!Array.isArray(s.archive)||!Array.isArray(s.events)||!Array.isArray(s.processedMatches)||!Array.isArray(s.notified))return false;
 try{
  const members=new Map(own(w).map(p=>[String(p.id),p]));
  for(const [id,c] of Object.entries(s.contracts)){if(!validId(id)||c.playerId!==id||c.clubId!==String(w.clubId))return false;validateContract(c);if(c.terms.endSeason<s.season)return false;}
  for(const [id,pr] of Object.entries(s.promises)){if(!s.contracts[id])return false;validatePromise(pr);if(pr.playerId!==id)return false;}
  for(const [id,o] of Object.entries(s.offers)){if(o.id!==id||!validId(o.playerId)||!['awaiting_player','awaiting_club','accepted','rejected','expired'].includes(o.status)||!Array.isArray(o.history))return false;validateTerms(o.terms);}
  for(const e of s.archive)validateContract(e.contract);
  if(new Set(s.processedMatches).size!==s.processedMatches.length||s.events.length>250||s.archive.length>500)return false;
  // Market register changes may land in the same transaction; missing contracts
  // are enrolled by the official checkpoint wrapper before saving.
  for(const id of members.keys())if(!s.contracts[id])return false;
 }catch{return false;}return true;
}
