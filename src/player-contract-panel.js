/** PLYR-05 REC-04 — read-only contract projection and contextual actions.
 * Owned-contract details exclusively use PLY05's official careerContractView.
 * Operations delegate to existing routed handlers, never mutate game state here.
 */
import {contractsEnabled,careerContractView} from './domain/career-contracts.js';
import {marketEnabled} from './domain/career-market.js';
import {scoutingEnabled,scoutingPlayer} from './domain/career-scouting.js';
import {boardStatus} from './domain/career-board.js';
import {displayCareerMoney} from './domain/career-locale.js';
import {esc} from './ui-components.js';

const tr=(lang,it,en)=>lang==='en'?en:it;
const money=(w,lang,n)=>Number.isFinite(n)?displayCareerMoney(n,{countryId:w.countryId,lang}):'—';
const whole=n=>Number.isSafeInteger(n)&&n>=0;
const text=(n)=>n===undefined||n===null||n===''?'—':String(n);
const statusLabels=Object.freeze({
 awaiting_player:{it:'In attesa della risposta del calciatore',en:'Awaiting player response'},
 awaiting_club:{it:'Controproposta in attesa della tua decisione',en:'Counteroffer awaiting your decision'}
});
const roleLabels=Object.freeze({
 starter:{it:'Titolare',en:'Starter'},rotation:{it:'Rotazione',en:'Rotation'},
 prospect:{it:'Prospetto',en:'Prospect'},leader:{it:'Leader',en:'Leader'}
});
const detail=(label,value)=>`<div class="plyr054-detail"><dt>${esc(label)}</dt><dd>${esc(text(value))}</dd></div>`;
const action=(lang,actionName,caption,id='',kind='secondary')=>
 `<button type="button" class="plyr054-action${kind==='primary'?' is-primary':kind==='danger'?' is-danger':''}" data-action="${esc(actionName)}"${id===''?'':` data-id="${esc(id)}"`}>${esc(caption)}</button>`;
const contract=(w,player)=>{
 if(player.clubId!==w.clubId||!contractsEnabled(w))return {view:null,terms:null,pending:null,official:false};
 const view=careerContractView(w);
 const record=view?.contracts?.find(p=>String(p.playerId)===String(player.id))??null;
 const pending=view?.offers?.find(o=>String(o.playerId)===String(player.id)&&
  ['awaiting_player','awaiting_club'].includes(o.status))??null;
 return {view,terms:record?.terms??null,pending,official:!!record?.terms};
};
const manageAllowed=w=>!['dismissed','retired'].includes(boardStatus(w));

export function renderPlayerContractPanel(w,player,ui){
 const lang=ui.language==='en'?'en':'it';
 if(player.clubId!==w.clubId)return `<div class="plyr054-private" role="note">${tr(lang,
  'I dati contrattuali privati degli altri club non sono disponibili in questo profilo.',
  'Private contractual information from other clubs is not available in this profile.')}</div>`;
 const {terms,pending,official}=contract(w,player);
 const remaining=terms&&whole(terms.endSeason)?Math.max(0,terms.endSeason-w.season+1):whole(player.contract)?player.contract:null;
 const weekly=terms&&whole(terms.annualWage)?terms.annualWage/52:whole(player.wage)?player.wage:null;
 const start=terms&&whole(terms.startSeason)?terms.startSeason:null;
 const end=terms&&whole(terms.endSeason)?terms.endSeason:null;
 const clauses=terms?.clauses??{};
 const bonuses=terms?.bonuses??{};
 const release=terms?clauses.releaseFee??null:player.releaseClauseEUR??null;
 const option=terms?clauses.extensionOptionSeason??null:null;
 const role=terms?roleLabels[terms.promisedRole]?.[lang]??'—':'—';
 const endDate=whole(end)?String(end):'—';
 const months=remaining===null?'—':`${remaining} ${tr(lang,remaining===1?'stagione':'stagioni',remaining===1?'season':'seasons')}`;
 const current=`<section class="plyr054-card"><h3>${tr(lang,'Accordo attuale','Current agreement')}</h3><dl class="plyr054-details">
   ${detail(tr(lang,'Stagione di inizio','Start season'),start)}
   ${detail(tr(lang,'Scadenza','End season'),endDate)}
   ${detail(tr(lang,'Durata residua','Remaining'),months)}
   ${detail(tr(lang,'Ingaggio settimanale','Weekly wage'),money(w,lang,weekly))}
   ${detail(tr(lang,'Ingaggio annuale','Annual wage'),money(w,lang,terms?.annualWage??(weekly===null?null:weekly*52)))}
   ${detail(tr(lang,'Ruolo promesso','Promised role'),role)}
   ${detail(tr(lang,'Clausola rescissoria','Release clause'),release===null?'—':money(w,lang,release))}
   ${detail(tr(lang,'Opzione di estensione','Extension option'),option)}
   </dl></section>`;
 const bonusCard=official?`<section class="plyr054-card"><h3>${tr(lang,'Bonus e condizioni','Bonuses and conditions')}</h3><dl class="plyr054-details">
   ${detail(tr(lang,'Bonus alla firma','Signing bonus'),money(w,lang,bonuses.signing))}
   ${detail(tr(lang,'Bonus presenza','Appearance bonus'),money(w,lang,bonuses.appearance))}
   ${detail(tr(lang,'Bonus gol','Goal bonus'),money(w,lang,bonuses.goal))}
 </dl></section>`:'';
 const offer=pending?`<section class="plyr054-card plyr054-offer"><h3>${tr(lang,'Offerta in corso','Active offer')}</h3><dl class="plyr054-details">
   ${detail(tr(lang,'Stato','Status'),statusLabels[pending.status]?.[lang]??'—')}
   ${detail(tr(lang,'Ingaggio proposto / settimana','Proposed weekly wage'),money(w,lang,pending.terms?.annualWage/52))}
   ${detail(tr(lang,'Scadenza proposta','Proposed end season'),pending.terms?.endSeason)}
   ${detail(tr(lang,'Ruolo proposto','Proposed role'),roleLabels[pending.terms?.promisedRole]?.[lang]??'—')}
   ${detail(tr(lang,'Clausola proposta','Proposed release clause'),pending.terms?.clauses?.releaseFee==null?'—':money(w,lang,pending.terms.clauses.releaseFee))}
 </dl></section>`:'';
 return `<div class="plyr054-contract">
  ${!official?`<p class="plyr054-note">${tr(lang,'Sono disponibili soltanto i dati contrattuali di base; il contratto strutturato non è disponibile.','Only basic contract data is available; the structured contract record is unavailable.')}</p>`:''}
  <div class="plyr054-grid">${current}${bonusCard}${offer}</div>
 </div>`;
}

export function renderPlayerActions(w,player,ui){
 const lang=ui.language==='en'?'en':'it',owned=player.clubId===w.clubId;
 if(!manageAllowed(w))return `<footer class="plyr054-actions"><p class="plyr054-note">${tr(lang,
  'Per effettuare operazioni devi prima assumere un nuovo incarico.',
  'Take a new managerial job before making player decisions.')}</p></footer>`;
 const globalId=String(player.globalId??`${w.countryId}:${player.id}`);
 const actions=[],officialMarket=marketEnabled(w);
 if(owned){
   const {official,pending}=contract(w,player);
   if(official){
     if(pending?.status==='awaiting_player'){
       actions.push(action(lang,'contracts-auto-response',tr(lang,'Richiedi risposta del calciatore','Request player response'),pending.id,'primary'));
     }else if(pending?.status==='awaiting_club'){
       actions.push(`<button type="button" class="plyr054-action is-primary" data-action="contracts-decide-counter" data-id="${esc(pending.id)}" data-value="accept">${tr(lang,'Accetta controproposta','Accept counteroffer')}</button>`);
       actions.push(`<button type="button" class="plyr054-action" data-action="contracts-decide-counter" data-id="${esc(pending.id)}" data-value="reject">${tr(lang,'Rifiuta controproposta','Reject counteroffer')}</button>`);
     }else actions.push(action(lang,'player-open-renewal',tr(lang,'Proponi rinnovo','Propose renewal'),player.id,'primary'));
   }
   if(officialMarket)actions.push(action(lang,'player-open-market',tr(lang,'Apri trattative','Open negotiations'),'', 'secondary'));
   else actions.push(action(lang,'sell',tr(lang,'Tratta cessione','Sell player'),player.id,'danger'));
 }else{
   if(scoutingEnabled(w)&&scoutingPlayer(w,globalId)){
     const listed=w.advancedV1.scoutingV1.shortlist.includes(globalId);
     actions.push(action(lang,listed?'scout-remove-shortlist':'scout-shortlist',
       listed?tr(lang,'Rimuovi dalla shortlist','Remove from shortlist'):tr(lang,'Aggiungi alla shortlist','Add to shortlist'),globalId));
   }else{
     const listed=Array.isArray(w.watchlist)&&w.watchlist.includes(player.id);
     actions.push(action(lang,'watch',listed?tr(lang,'Rimuovi dagli osservati','Unwatch'):tr(lang,'Osserva giocatore','Watch player'),player.id));
   }
   if(officialMarket){
     actions.push(player.clubId>0?action(lang,'market-offer-player',tr(lang,'Avvia trattativa','Start negotiation'),globalId,'primary'):
       action(lang,'player-open-market',tr(lang,'Apri mercato svincolati','Open free agent market'),'', 'primary'));
   }else if(player.clubId>0)actions.push(action(lang,'buy',tr(lang,'Acquista','Buy player'),player.id,'primary'));
 }
 return `<footer class="plyr054-actions" aria-label="${tr(lang,'Azioni giocatore','Player actions')}">${actions.join('')}</footer>`;
}
