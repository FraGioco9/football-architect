/** UX2-03: bilingual, read-only club page; all buttons use existing navigation. */
import {clubOverview} from './club-overview-model.js';
import {esc,sectionHead,emptyState,metricCard} from './ui-components.js';
import {displayCareerMoney} from './domain/career-locale.js';
import {badge,icon} from './ui.js';

const link=(page,label)=>`<button class="btn btn-outline" type="button" data-action="nav" data-page="${page}">${esc(label)} ${icon('chevron',16)}</button>`;
const clean=v=>v===undefined||v===null||v===''?'—':esc(v);
export function clubPage(w,ui){
 const d=clubOverview(w),en=ui.language==='en',tr=(it,eng)=>en?eng:it;
 if(!d)return emptyState(tr('Seleziona prima un club.','Select a club first.'));
 const {club:c}=d;
 const number=n=>n===null?'—':Number(n).toLocaleString(en?'en-GB':'it-IT');
 const cash=n=>n===null?'—':esc(displayCareerMoney(n,{countryId:w.countryId,lang:ui.language}));
 const status=d.board?`${tr('Fiducia','Trust')}: ${number(d.board.trust)}/100 · ${tr('Obiettivo piazzamento','League target')}: ${number(d.board.leagueTarget)}`:tr('Attiva la dirigenza dalla relativa sezione per vedere gli obiettivi.','Enable board management to view its targets.');
 const section=(title,caption,content,action='')=>`<section class="panel card-shell club-overview-panel"><header class="panel-head"><div><h2>${esc(title)}</h2><p>${esc(caption)}</p></div>${action}</header><div class="club-overview-panel-body">${content}</div></section>`;
 const key=(name,value)=>`<div class="club-overview-detail"><dt>${esc(name)}</dt><dd>${clean(value)}</dd></div>`;
 const results=d.table;
 const seasonSummary=results?`<div class="club-overview-stats">${[
   [tr('Giocate','Played'),results.p],[tr('Vittorie','Wins'),results.w],[tr('Pareggi','Draws'),results.d],[tr('Sconfitte','Losses'),results.l],[tr('Gol fatti','Goals for'),results.gf],[tr('Gol subiti','Goals against'),results.ga]
 ].map(([name,v])=>`<div><strong>${number(v)}</strong><small>${esc(name)}</small></div>`).join('')}</div>`:emptyState(tr('Nessuna classifica disponibile.','No league table available.'));
 const history=d.history.length?`<div class="table-scroll club-overview-scroll" role="region" tabindex="0" aria-label="${tr('Stagioni archiviate','Archived seasons')}"><table class="data-table"><thead><tr><th scope="col">${tr('Stagione','Season')}</th><th scope="col">${tr('Posizione','Position')}</th><th scope="col">${tr('Punti','Points')}</th><th scope="col">${tr('Vittorie','Wins')}</th></tr></thead><tbody>${d.history.slice(0,10).map(s=>`<tr><td>${number(s.season)}</td><td>${number(s.rank)}</td><td>${number(s.points)}</td><td>${number(s.wins)}</td></tr>`).join('')}</tbody></table></div>`:emptyState(tr('Nessuna stagione conclusa ancora registrata.','No completed seasons recorded yet.'));
 const facilities=d.facilities?`<div class="club-overview-stats">${Object.entries(d.facilities.buildings).map(([type,level])=>`<div><strong>${number(level)}/5</strong><small>${esc(({training:tr('Allenamento','Training'),academy:tr('Vivaio','Academy'),medical:tr('Medicina','Medical'),stadium:tr('Stadio','Stadium')})[type]??type)}</small></div>`).join('')}</div><p class="muted">${number(d.facilities.staffCount)} ${tr('figure dello staff','staff positions')} · ${number(d.facilities.underway)} ${tr('cantieri in corso','projects underway')}</p>`:emptyState(tr('Strutture avanzate non ancora attivate.','Advanced facilities not yet enabled.'));
 const titleEntries=[
   ...d.leagueHonours.map(h=>({season:h.season,name:tr('Campionato','League')})),
   ...d.nationalHonours.map(h=>({season:h.season,name:tr('Coppa nazionale','National cup')})),
   ...d.continentalHonours.map(h=>({season:h.season,name:tr('Coppa continentale','Continental cup')}))
 ].sort((a,b)=>b.season-a.season);
 const titles=titleEntries.length?`<ul class="club-overview-list">${titleEntries.slice(0,14).map(h=>`<li><span>${esc(h.name)}</span><strong>${number(h.season)}</strong></li>`).join('')}</ul>`:emptyState(tr('Nessun trofeo ufficiale ancora registrato.','No official trophies recorded yet.'));
 const rivals=d.rivals.length?`<ul class="club-overview-list">${d.rivals.map(r=>`<li><span><strong>${esc(r.name)}</strong><small>${r.kind==='city'?tr('Derby cittadino','City derby'):tr('Rivalità sportiva','Sporting rivalry')}</small></span><span>${number(r.meetings)} ${tr('incontri','matches')} · ${number(r.wins)}-${number(r.draws)}-${number(r.losses)}</span></li>`).join('')}</ul>`:emptyState(tr('Nessuna rivalità documentata dalle partite concluse.','No rivalry documented by completed matches yet.'));
 const financials=`<div class="club-overview-detail-grid">${key(tr('Saldo società','Club balance'),cash(d.balances.cash))}${key(tr('Budget trasferimenti','Transfer budget'),cash(d.balances.budget))}${d.finance?key(tr('Debito finanziario','Financial debt'),cash(d.finance.debtEUR)):''}</div>`;
 return `<div class="club-overview" data-page-view="club">${sectionHead('CLUB',esc(c.name),tr('Identità societaria, rendimento e storia ufficiale in un unico posto.','Club identity, performance and verified history in one place.'),link('dashboard',tr('Torna alla scrivania','Back to dashboard')))}
 <section class="club-overview-hero" aria-label="${tr('Identità del club','Club identity')}"><div class="club-overview-crest">${badge(c,'xl')}</div><div class="club-overview-identity"><span class="eyebrow">${esc(d.flag||'')} ${esc(en?(d.countryEn||d.country):d.country)} · ${esc(d.competition||'')}</span><h2>${esc(c.name)}</h2><p>${esc(c.city)} · ${tr('Stadio','Stadium')}: ${esc(c.stadium||'—')}</p><div class="club-overview-colors" aria-label="${tr('Colori sociali','Club colours')}">${(c.colors||[]).slice(0,2).map((color,i)=>`<span style="background:${/^#[0-9a-f]{3,8}$/i.test(color)?color:'#42dcb0'}" title="${tr('Colore','Colour')} ${i+1}"></span>`).join('')}</div></div></section>
 <div class="club-overview-kpis">${metricCard({label:tr('POSIZIONE','POSITION'),value:d.position===null?'—':`${number(d.position)}°`,detail:`${tr('Stagione','Season')} ${number(d.season)}`})}${metricCard({label:tr('PUNTI','POINTS'),value:number(results?.pts??null),detail:`${number(results?.p??null)} ${tr('partite','matches')}`})}${metricCard({label:tr('ROSA','SQUAD'),value:number(d.squadSize),detail:`${tr('Media generale','Average OVR')}: ${number(d.averageOverall)}`})}${metricCard({label:tr('REPUTAZIONE','REPUTATION'),value:number(c.reputation),detail:'/100'})}</div>
 <div class="club-overview-grid">
 ${section(tr('Identità e impianti','Identity and ground'),tr('Informazioni registrate della società','Recorded club information'),`<dl class="club-overview-detail-grid">${key(tr('Città','City'),c.city)}${key(tr('Fondazione immaginaria','Fictional founding year'),c.founded)}${key(tr('Stadio','Stadium'),c.stadium)}${key(tr('Capienza','Capacity'),number(c.capacity))}${key(tr('Allenatore','Manager'),d.manager)}${key(tr('Categoria','Tier'),d.tier===2?tr('Seconda divisione','Second tier'):tr('Prima divisione','First tier'))}</dl>`,link('world',tr('Mondo','World')))}
 ${section(tr('Rendimento stagionale','Season performance'),tr('Dati delle partite realmente disputate','Data from actual completed matches'),seasonSummary,link('league',tr('Classifica','Standings')))}
 ${section(tr('Strutture e staff','Facilities and staff'),tr('Livelli effettivi del centro sportivo','Actual training ground levels'),facilities,link('training',tr('Allenamento','Training')))}
 ${section(tr('Dirigenza e obiettivi','Board and objectives'),tr('Situazione attuale della società','Current club management status'),`<p>${esc(status)}</p>`,link('board',tr('Dirigenza','Board')))}
 ${section(tr('Finanze','Finances'),tr('Valori già presenti nella carriera','Values already present in the career'),financials,link('finance',tr('Apri finanze','Open finances')))}
 ${section(tr('Storia delle stagioni','Season history'),tr('Solo stagioni concluse, senza risultati inventati','Completed seasons only; no invented results'),`${history}<p class="muted club-overview-narrative">${esc(en?d.narrativeEn:d.narrative)}</p>`,link('world',tr('Archivio completo','Full archive')))}
 ${section(tr('Palmarès ufficiale','Official honours'),tr('Campionato, coppe e tornei realmente vinti','League and cups actually won'),titles,link('world',tr('Competizioni','Competitions')))}
 ${section(tr('Rivalità documentate','Recorded rivalries'),tr('Solo incontri archiviati nelle stagioni concluse','Only matches recorded in completed seasons'),rivals,link('world',tr('Storia e record','History and records')))}
 </div><nav class="club-overview-shortcuts" aria-label="${tr('Collegamenti gestionali','Management shortcuts')}">${[['squad',tr('Rosa','Squad')],['tactics',tr('Tattiche','Tactics')],['market',tr('Mercato','Market')],['youth',tr('Vivaio','Academy')],['manager',tr('Allenatore','Manager')]].map(([id,name])=>link(id,name)).join('')}</nav></div>`;
}
