/** PLY05.02/04/05 — transactionally update pure contract books.
 * No payment occurs in the official game: cash here is an isolated book projection.
 * Duplicated actions are idempotent ONLY when payload matches. Explicit revisions detect stale writes.
 */
import {clone,fail,identifier,object,integer,money,validateContract,validateTerms,fromLegacyContract,makeContract} from './player-contract.mjs';
export const CONTRACT_BOOK_VERSION=1;
const id=x=>{if(!identifier(x))fail('ID');return String(x);};
function checkClubs(clubs){if(!object(clubs))fail('CLUBS');for(const [key,c] of Object.entries(clubs)){
 if(!object(c)||!identifier(key)||key!==String(c.id))fail('CLUB_ID');money(c.cashBalance,'CASH');money(c.wageLimit,'WAGE_LIMIT');money(c.wageCommitment,'WAGE_COMMITMENT');if(c.wageCommitment>c.wageLimit)fail('WAGE_LIMIT');}}
function calculateWages(contracts){const res={};for(const x of Object.values(contracts)){validateContract(x);const club=x.clubId;res[club]=(res[club]??0)+x.terms.annualWage;if(!Number.isSafeInteger(res[club]))fail('WAGES_OVERFLOW');}return res;}
export function validateBook(book){
 if(!object(book)||book.schemaVersion!==1)fail('BOOK_SCHEMA');integer(book.season,1,9999,'SEASON');integer(book.revision,0,1000000,'REVISION');
 if(!object(book.clubs)||!object(book.contracts)||!object(book.freeAgents)||!object(book.negotiations)||!object(book.applied)||!Array.isArray(book.archive)||!Array.isArray(book.events))fail('BOOK_SHAPE');
 checkClubs(book.clubs);
 for(const [p,c] of Object.entries(book.contracts)){validateContract(c);if(!identifier(p)||p!==c.playerId||!book.clubs[c.clubId])fail('CONTRACT_OWNER');if(c.terms.endSeason<book.season)fail('EXPIRED_ACTIVE');}
 const totals=calculateWages(book.contracts);for(const [club,c] of Object.entries(book.clubs))if(c.wageCommitment!==(totals[club]??0))fail('WAGE_LEDGER');
 for(const [p,x] of Object.entries(book.freeAgents)){if(!object(x)||!identifier(p)||p!==x.playerId||book.contracts[p]||!object(x.lastContract))fail('FREE_AGENT');validateContract(x.lastContract);if(x.lastContract.playerId!==p||x.lastContract.clubId!==String(x.formerClubId))fail('FREE_AGENT_OWNER');}
 const archiveIds=new Set();for(const x of book.archive){if(!object(x)||!object(x.contract)||!identifier(x.id))fail('ARCHIVE');validateContract(x.contract);if(archiveIds.has(x.id))fail('ARCHIVE_DUPLICATE');archiveIds.add(x.id);}
 for(const [key,n] of Object.entries(book.negotiations)){
  if(!object(n)||!identifier(key)||n.id!==key||!id(n.playerId)||!id(n.clubId)||!['awaiting_player','awaiting_club','accepted','rejected','expired'].includes(n.status)||!Array.isArray(n.history)||n.history.length<1)fail('NEGOTIATION');validateTerms(n.offer);
 }
 for(const [key,a] of Object.entries(book.applied))if(!identifier(key)||!object(a)||typeof a.fingerprint!=='string')fail('ACTION_INDEX');
 return true;
}
export function makeBook({season=1,clubs,players}){
 integer(season,1,9999,'SEASON');if(!Array.isArray(clubs)||!Array.isArray(players))fail('INPUT');
 const book={schemaVersion:1,season,revision:0,clubs:{},contracts:{},freeAgents:{},negotiations:{},archive:[],events:[],applied:{}};
 for(const c of clubs){const key=id(c.id);if(book.clubs[key])fail('DUPLICATE_CLUB');book.clubs[key]={id:key,cashBalance:money(c.cashBalance??c.budget??0,'CASH'),wageLimit:money(c.wageLimit??1_000_000_000,'WAGE_LIMIT'),wageCommitment:0};}
 for(const p of players){const key=id(p.id);if(book.contracts[key])fail('DUPLICATE_PLAYER');const contract=fromLegacyContract(p,{season,clubId:p.clubId});if(!book.clubs[contract.clubId])fail('UNKNOWN_CLUB');if(contract.terms.endSeason<season)fail('EXPIRED_LEGACY');book.contracts[key]=contract;book.clubs[contract.clubId].wageCommitment+=contract.terms.annualWage;}
 validateBook(book);return book;
}
function fingerprint(op,payload){return JSON.stringify([op,payload]);}
function trans(book,actionId,expectedRevision,op,payload,modify){
 validateBook(book);const key=id(actionId);const fp=fingerprint(op,payload);
 if(book.applied[key]){if(book.applied[key].fingerprint!==fp)fail('ACTION_CONFLICT');return clone(book);}
 if(expectedRevision!==undefined&&expectedRevision!==book.revision)fail('STALE_REVISION');
 const next=clone(book);modify(next);
 next.applied[key]={fingerprint:fp,revision:book.revision+1};next.revision++;
 validateBook(next);return next;
}
const open=n=>n.status==='awaiting_player'||n.status==='awaiting_club';
function event(book,data){book.events.push({id:`contract-event:${book.revision+1}:${book.events.length}`,season:book.season,...data});}
export function openNegotiation(book,{actionId,expectedRevision,negotiationId,playerId,clubId,offer,initiator='club'}={}){
 const player=id(playerId),club=id(clubId),negId=id(negotiationId);
 validateTerms(offer);if(!['club','player'].includes(initiator))fail('INITIATOR');
 return trans(book,actionId,expectedRevision,'open',{negId,player,club,offer,initiator},b=>{
  if(b.negotiations[negId])fail('DUPLICATE_NEGOTIATION');const active=b.contracts[player];
  if(!active||active.clubId!==club||!b.clubs[club])fail('PLAYER_CLUB');
  if(Object.values(b.negotiations).some(n=>n.playerId===player&&open(n)))fail('ALREADY_NEGOTIATING');
  if(offer.startSeason!==b.season)fail('OFFER_SEASON');
  b.negotiations[negId]={id:negId,playerId:player,clubId:club,status:initiator==='club'?'awaiting_player':'awaiting_club',offer:clone(offer),initiator,openedSeason:b.season,round:1,history:[{type:'offer',by:initiator,offer:clone(offer),season:b.season}]};
  event(b,{type:'offer',playerId:player,clubId:club,negotiationId:negId});
 });
}
export function counterOffer(book,{actionId,expectedRevision,negotiationId,actor,offer}={}){
 const negId=id(negotiationId);validateTerms(offer);if(!['player','club'].includes(actor))fail('ACTOR');
 return trans(book,actionId,expectedRevision,'counter',{negId,actor,offer},b=>{
  const n=b.negotiations[negId];if(!n||!open(n))fail('NO_OPEN_NEGOTIATION');
  if((n.status==='awaiting_player'?'player':'club')!==actor)fail('TURN');
  if(n.round>=10)fail('ROUND_LIMIT');if(offer.startSeason!==b.season)fail('OFFER_SEASON');
  n.offer=clone(offer);n.initiator=actor;n.round++;n.status=actor==='player'?'awaiting_club':'awaiting_player';n.history.push({type:'counter',by:actor,offer:clone(offer),season:b.season});
  event(b,{type:'counter',playerId:n.playerId,negotiationId:negId});
 });
}
export function decideNegotiation(book,{actionId,expectedRevision,negotiationId,actor,decision}={}){
 const negId=id(negotiationId);if(!['player','club'].includes(actor)||!['accept','reject'].includes(decision))fail('DECISION');
 return trans(book,actionId,expectedRevision,'decide',{negId,actor,decision},b=>{
  const n=b.negotiations[negId];if(!n||!open(n))fail('NO_OPEN_NEGOTIATION');
  if((n.status==='awaiting_player'?'player':'club')!==actor)fail('TURN');
  const current=b.contracts[n.playerId],club=b.clubs[n.clubId];if(!current||current.clubId!==n.clubId||!club)fail('PLAYER_CLUB');
  if(decision==='accept'){
   const newCommitment=club.wageCommitment-current.terms.annualWage+n.offer.annualWage;
   if(!Number.isSafeInteger(newCommitment)||newCommitment>club.wageLimit)fail('WAGE_LIMIT');
   if(club.cashBalance<n.offer.bonuses.signing)fail('INSUFFICIENT_FUNDS');
   const replacement=makeContract({playerId:current.playerId,clubId:current.clubId,terms:n.offer,revision:current.revision+1,history:[...current.history,{id:`renewal:${negId}`,type:'renewal',season:b.season,previousTerms:clone(current.terms),newTerms:clone(n.offer)}]});
   b.archive.push({id:`previous:${negId}`,reason:'renewal',season:b.season,contract:clone(current)});
   b.contracts[n.playerId]=replacement;club.wageCommitment=newCommitment;club.cashBalance-=n.offer.bonuses.signing;
  }
  n.status=decision==='accept'?'accepted':'rejected';n.history.push({type:decision,by:actor,season:b.season});
  event(b,{type:decision,playerId:n.playerId,clubId:n.clubId,negotiationId:negId,amount:decision==='accept'?n.offer.bonuses.signing:0});
 });
}
export function upcomingExpiries(book,{withinSeasons=2}={}){
 validateBook(book);integer(withinSeasons,1,10,'NOTICE_HORIZON');return Object.values(book.contracts).filter(c=>c.terms.endSeason-book.season<withinSeasons)
 .map(c=>({playerId:c.playerId,clubId:c.clubId,endSeason:c.terms.endSeason,seasonsRemaining:c.terms.endSeason-book.season+1})).sort((a,b)=>a.endSeason-b.endSeason||a.playerId.localeCompare(b.playerId));
}
/** Advance one season. Archives every expired contract and keeps former player identity/history intact. */
export function nextContractSeason(book,{actionId,expectedRevision,season}={}){
 return trans(book,actionId,expectedRevision,'season',{season},b=>{
  integer(season,b.season+1,b.season+1,'SEASON_ADVANCE');
  for(const [playerId,c] of Object.entries(b.contracts)){
   if(c.terms.endSeason>=season)continue;
   b.clubs[c.clubId].wageCommitment-=c.terms.annualWage;
   b.freeAgents[playerId]={playerId,formerClubId:c.clubId,releasedSeason:season,lastContract:clone(c)};
   b.archive.push({id:`expired:${season}:${playerId}`,reason:'expired',season,contract:clone(c)});delete b.contracts[playerId];
   event(b,{type:'expired',playerId,clubId:c.clubId});
  }
  for(const n of Object.values(b.negotiations))if(open(n)){
   n.status='expired';n.history.push({type:'expired',season});event(b,{type:'negotiation_expired',negotiationId:n.id,playerId:n.playerId});
  }
  b.season=season;
 });
}
export function saveBookJson(book){validateBook(book);return JSON.stringify(book);}
export function readBookJson(text){let obj;try{obj=JSON.parse(text);}catch{fail('INVALID_JSON');}validateBook(obj);return clone(obj);}
