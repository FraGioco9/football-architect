/** MKT04 read-only NPC activity. Private AI ratings never reach the DOM. */
import {aiMarketEnabled} from '../domain/career-ai-market.js';
import {scoutingEnabled} from '../domain/career-scouting.js';
import {esc} from '../ui-components.js';
import {displayCareerMoney} from '../domain/career-locale.js';
const t=(lang,it,en)=>lang==='en'?en:it;
export function careerAIMarketPanel(w,ui){
 const lang=ui.language;
 if(!scoutingEnabled(w))return '';
 if(!aiMarketEnabled(w))return `<section class="mkt-box" aria-label="MKT04"><h3>${t(lang,'MKT04 — Mercato AI autonomo','MKT04 — Autonomous AI market')}</h3><p>${t(lang,'Attivazione facoltativa. Gli altri 159 club trattano nel mercato internazionale rispettando budget, finestre e rose. La tua squadra non sarà modificata dall’AI.','Optional activation. The other 159 clubs negotiate internationally within budgets, windows and roster limits. AI never changes your own club.')}</p><button class="btn btn-primary" data-action="ai-market-enable">${t(lang,'Attiva MKT04','Enable MKT04')}</button></section>`;
 const s=w.advancedV1.aiMarketV1,currency=eur=>displayCareerMoney(eur,{countryId:w.countryId,lang});
 const rows=s.history.slice(-8).reverse(),offers=s.offers.filter(x=>x.status==='offered').slice(-5);
 const outcome=status=>({completed:t(lang,'Completato','Completed'),refused:t(lang,'Rifiutato','Refused'),expired:t(lang,'Scaduto','Expired')})[status]??status;
 return `<section class="mkt-box" aria-label="MKT04" data-ai-market-active="true"><div class="mkt-heading"><div><h3>${t(lang,'Mercato dei club AI','AI clubs transfer market')}</h3><p>${t(lang,'Autonomo e deterministico · Nessun intervento sul tuo club','Autonomous and deterministic · Your club remains player-controlled')}</p></div><span class="mkt-revision">REV ${s.revision}</span></div>
  <div class="mkt-ai-stats"><p>${t(lang,'Offerte','Offers')} <strong>${s.metrics.offers}</strong></p><p>${t(lang,'Trasferimenti','Transfers')} <strong>${s.metrics.completed}</strong></p><p>${t(lang,'Prestiti','Loans')} <strong>${s.metrics.loans}</strong></p><p>${t(lang,'Svincolati','Free agents')} <strong>${s.metrics.freeReleases}</strong></p><p>${t(lang,'Rinnovi','Renewals')} <strong>${s.metrics.renewals}</strong></p></div>
  <h4>${t(lang,'Proposte pendenti','Pending offers')}</h4><div class="table-scroll mkt-scroller" role="region" tabindex="0" aria-label="${t(lang,'Proposte AI','AI proposals')}"><table class="data-table"><thead><tr><th>${t(lang,'Giocatore','Player')}</th><th>${t(lang,'Da','From')}</th><th>${t(lang,'A','To')}</th><th>${t(lang,'Offerta','Offer')}</th></tr></thead><tbody>${offers.map(x=>`<tr><td>${esc(x.playerId)}</td><td>${esc(x.sellerKey)}</td><td>${esc(x.buyerKey)}</td><td>${currency(x.feeEUR)}</td></tr>`).join('')||`<tr><td colspan="4">${t(lang,'Nessuna offerta in attesa','No pending offer')}</td></tr>`}</tbody></table></div>
  <h4>${t(lang,'Ultimi movimenti','Recent moves')}</h4><div class="table-scroll mkt-scroller" role="region" tabindex="0" aria-label="${t(lang,'Cronologia mercato AI','AI transfer history')}"><table class="data-table"><thead><tr><th>${t(lang,'Stagione','Season')}</th><th>${t(lang,'Calciatore','Player')}</th><th>${t(lang,'Società','Clubs')}</th><th>${t(lang,'Importo','Fee')}</th><th>${t(lang,'Esito','Outcome')}</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.season}</td><td>${esc(x.playerId)}</td><td>${esc(x.from)} → ${esc(x.to)}</td><td>${currency(x.feeEUR)}</td><td>${esc(outcome(x.status))}</td></tr>`).join('')||`<tr><td colspan="5">${t(lang,'Nessun movimento registrato','No moves recorded')}</td></tr>`}</tbody></table></div>
 </section>`;
}
