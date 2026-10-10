import {LEAGUES,getLeagueClubs,leagueById} from './leagues.js';
import {seasonNumber,sessionTime,localToday} from './simulation.js';
import {seasonCalendar,transferMarketFor} from './season-calendar.js';
import {normalizeManagerProfile,managerAge} from './manager-profile.js';
import {bestCareer} from './career-store.js';
import {icon} from './icons.js';
import {languagePicker} from './language-picker.js';
import {renderFeedback} from './feedback.js';
import {renderDateControl,renderNationalityControl} from './site-picker-ui.js';
export const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const tr=(lang,it,en)=>lang==='en'?en:it;
const fmtDate=(value,lang,clock=false)=>{
 if(!value)return '—';
 const d=new Date(clock?value:value+'T12:00:00Z');
 return Number.isFinite(d.getTime())?new Intl.DateTimeFormat(lang==='en'?'en-GB':'it-IT',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC',...(clock?{hour:'2-digit',minute:'2-digit'}:{})}).format(d):'—';
};
const fmtGameDate=(value,lang,time=null)=>{
 if(!value)return '—';
 const date=new Date(value+'T12:00:00Z');
 const displayed=new Intl.DateTimeFormat(lang==='en'?'en-GB':'it-IT',
  {day:'numeric',month:'short',timeZone:'UTC'}).format(date);
 return displayed+(time?' · '+time:'');
};
const club=(country,id)=>getLeagueClubs(country).find(x=>x.id===id);
const crest=c=>c?`<span class="crest" style="--club1:${esc(c.colors[0])};--club2:${esc(c.colors[1])}">${esc(c.short)}</span>`:'<span class="crest unknown">?</span>';

/* Local HD SVG flags, bundled offline under the MIT flag-icons license. */
const FLAG_ASSETS=Object.freeze({IT:'it',ENG:'gb-eng',ES:'es',DE:'de',FR:'fr',PT:'pt',NL:'nl',BR:'br'});
export function countryFlag(code){
 const name=Object.hasOwn(FLAG_ASSETS,code)?FLAG_ASSETS[code]:null;
 return name?`<img class="country-flag" src="/assets/flags/${name}.svg" width="32" height="24" alt="" decoding="async">`:'';
}
const buttonIcons={continue:'play',new:'plus-circle',careers:'folder-open',settings:'settings',load:'play',rename:'pencil',export:'download',delete:'trash',import:'upload',hour:'clock',day:'calendar',week:'calendar',month:'calendar',year:'calendar',toggle:'play','fixture-open':'calendar','start-career':'play','cancel-setup':'arrow-left'};
export const button=(action,title,variant='primary',attrs='')=>`<button type="button" class="btn ${variant}" data-action="${action}" ${attrs}>${buttonIcons[action]?icon(action==='toggle'&&variant==='warning'?'pause':buttonIcons[action],16):''}<span>${esc(title)}</span></button>`;
export function renderGlobalSearchResults(results,lang){
 if(!results.length)return '<p class="fa-global-search-empty" role="status">'+tr(lang,'Nessun risultato','No results')+'</p>';
 return results.map((item,i)=>'<button type="button" role="option" aria-selected="false" class="fa-global-search-result" data-action="global-search-result" data-index="'+i+'">'+
  '<span class="fa-global-search-result-title">'+esc(item.title)+'</span>'+
  '<span class="fa-global-search-result-detail">'+esc(item.detail)+'</span></button>').join('');
}
export function layout(inner,lang,message=null,languageOpen=false,career=null){
 if(career&&['/dashboard','/simulation','/calendar','/settings'].includes(career.route)){
  const meta=career.meta,state=career.state,playing=Boolean(career.playing);
  const c=club(meta.countryId,meta.clubId),phase=seasonCalendar(state.date,state.startedAt).phase;
  const phaseName=phase==='preseason'?tr(lang,'Prestagione','Preseason'):
   phase==='season'?tr(lang,'Stagione','Season'):tr(lang,'Pausa estiva','Summer break');
  const dashboard=career.route==='/dashboard'||career.route==='/simulation';
  const nav=(action,name,label,active)=>`<button type="button" class="fa-shell-link${active?' is-active':''}" data-action="${action}" aria-label="${label}" ${active?'aria-current="page"':''}>${icon(name,18)}<span>${label}</span></button>`;
  const action=button('toggle',playing?tr(lang,'Interrompi','Stop'):tr(lang,'Continua','Continue'),playing?'warning':'primary');
  const searchQuery=String(career.searchQuery??'');
  const searchResults=career.searchResults??[];
  const searchOpen=Boolean(searchQuery.trim());
  const shortDate=state.date.slice(8,10)+'/'+state.date.slice(5,7);
  return `<div class="shell fa-career-shell"><a href="#content" class="skip">${tr(lang,'Vai al contenuto','Skip to content')}</a>
   <aside class="fa-shell-sidebar" aria-label="${tr(lang,'Navigazione carriera','Career navigation')}">
    <div class="fa-shell-sidebar-head"><span class="brand-symbol">${icon('shield',21)}</span><span class="fa-shell-wordmark">FOOTBALL <b>ARCHITECT</b><small>MANAGER</small></span></div>
    <nav class="fa-shell-nav" aria-label="${tr(lang,'Pagine della carriera','Career pages')}">
     <section class="fa-shell-nav-group" aria-labelledby="fa-shell-start-title">
      <h2 class="fa-shell-nav-group-title" id="fa-shell-start-title">${tr(lang,'Inizio','Home')}</h2>
      <div class="fa-shell-nav-group-items">
       ${nav('career-dashboard','grid-pre-reset',tr(lang,'Dashboard','Dashboard'),dashboard)}
       ${nav('fixture-open','calendar-pre-reset',tr(lang,'Calendario','Calendar'),career.route==='/calendar')}
      </div>
     </section>
    </nav>
    <nav class="fa-shell-settings-nav" aria-label="${tr(lang,'Impostazioni carriera','Career settings')}">
     ${nav('settings','settings',tr(lang,'Impostazioni','Settings'),career.route==='/settings')}
    </nav>
   </aside>
   <div class="fa-shell-workspace">
    <header class="fa-shell-topbar">
     <div class="fa-shell-club" title="${esc(c?.name??'—')}">${crest(c)}<strong>${esc(c?.name??'—')}</strong></div>
     <div class="fa-shell-search">
      <button type="button" class="fa-shell-search-trigger" data-action="global-search-open" aria-haspopup="dialog" aria-controls="fa-global-search-dialog">
       ${icon('search',17)}<span>${tr(lang,'Cerca pagine e partite','Search pages and matches')}</span>
      </button>
     </div>
     <div class="fa-shell-time" aria-label="${tr(lang,'Data e fase della carriera','Career date and phase')}">
      ${icon('calendar',15)}<span class="fa-shell-date-full">${esc(fmtGameDate(state.date,lang,sessionTime(state)))}</span>
      <span class="fa-shell-date-short">${esc(shortDate)} · ${esc(sessionTime(state))}</span>
      <span class="fa-shell-phase">· ${esc(phaseName)}</span>
     </div>
     <div class="fa-shell-primary">${action}</div>
    </header>
    <dialog id="fa-global-search-dialog" class="fa-site-dialog fa-global-search-dialog" aria-labelledby="fa-global-search-title">
     <div class="fa-global-search-dialog-head">
      <h2 id="fa-global-search-title">${icon('search',19)} ${tr(lang,'Ricerca globale','Global search')}</h2>
      <button type="button" class="fa-global-search-close" data-action="global-search-close" aria-label="${tr(lang,'Chiudi ricerca','Close search')}">${icon('x',18)}</button>
     </div>
     <label class="fa-shell-search-label" for="fa-global-search-input">${tr(lang,'Cerca pagine e partite','Search pages and matches')}</label>
     <div class="fa-shell-search-field">${icon('search',16)}
      <input id="fa-global-search-input" type="search" role="combobox" aria-autocomplete="list" aria-controls="fa-global-search-results" aria-expanded="${String(searchOpen)}" autocomplete="off" spellcheck="false" maxlength="80" placeholder="${tr(lang,'Cerca pagine e partite','Search pages and matches')}" value="${esc(searchQuery)}">
     </div>
     <div id="fa-global-search-results" class="fa-global-search-results" role="listbox" aria-label="${tr(lang,'Risultati ricerca','Search results')}">${searchOpen?renderGlobalSearchResults(searchResults,lang):'<p class="fa-global-search-empty">'+tr(lang,'Cerca una pagina o una partita programmata.','Search for a page or a scheduled match.')+'</p>'}</div>
    </dialog>
    <main id="content" class="fa-page-main">${renderFeedback(message,lang)}${inner}</main>
    <footer>FOOTBALL ARCHITECT · ${tr(lang,'OFFLINE · GIOCATORE SINGOLO','OFFLINE · SINGLE PLAYER')}</footer>
   </div>
  </div>`;
 }
 return `<div class="shell"><a href="#content" class="skip">${tr(lang,'Vai al contenuto','Skip to content')}</a>
 <header class="top"><a class="brand" href="/" data-action="home"><span class="brand-symbol">${icon('shield',22)}</span><span>FOOTBALL <b>ARCHITECT</b><small>BUILD YOUR LEGACY</small></span></a>
 </header>
 <main id="content" class="fa-page-main">${renderFeedback(message,lang)}${inner}</main>
 <footer>FOOTBALL ARCHITECT · ${tr(lang,'OFFLINE · GIOCATORE SINGOLO','OFFLINE · SINGLE PLAYER')}</footer></div>`;
}
const option=(action,symbol,title,desc)=>`<button class="menu-option" type="button" data-action="${action}">
 <span class="option-icon" aria-hidden="true">${icon(symbol,21)}</span><span class="option-copy"><strong>${esc(title)}</strong><small>${esc(desc)}</small></span><span class="menu-chevron">${icon('chevron-right',18)}</span></button>`;
export function homePage(catalog,lang){
 const active=bestCareer(catalog),meta=active?.meta,team=meta&&club(meta.countryId,meta.clubId);
 return `<section class="hero fa-page-heading"><span class="kicker">${tr(lang,'IL TUO MONDO CALCISTICO','YOUR FOOTBALL WORLD')}</span>
 <h1 class="fa-page-title">${tr(lang,'Benvenuto in Football Architect','Welcome to Football Architect')}</h1><p>${tr(lang,'Ogni carriera è una storia diversa. Scegli una squadra e costruisci il tuo percorso.','Every career tells a different story. Choose a club and build your journey.')}</p></section>
 <div class="menu-stack">${active?`<section class="panel active-career" aria-label="${tr(lang,'Ultima carriera','Last career')}"><span class="kicker active-label">${icon('clock',15)} ${tr(lang,'ULTIMA CARRIERA','LAST CAREER')}</span>
 <div class="active-details">${crest(team)}<div><h2>${esc(team?.name??'—')}</h2><p>${meta.careerName&&meta.careerName!==team?.name?esc(meta.careerName)+' · ':''}${esc(meta.managerName)} · ${esc(tr(lang,'Stagione ','Season ')+seasonNumber(active.state))}</p>
 <p>${esc(fmtGameDate(active.state.date,lang,sessionTime(active.state)))} · ${tr(lang,'Salvata','Saved')} ${esc(fmtDate(meta.updatedAt,lang,true))}</p></div></div>
 ${button('continue',tr(lang,'Continua carriera','Continue career'))}</section>`:''}
 <section class="menu-actions" aria-label="${tr(lang,'Azioni principali','Main actions')}">
 ${option('new','plus-circle',tr(lang,'Nuova carriera','New career'),tr(lang,'Inizia un nuovo percorso da allenatore','Begin a new managerial journey'))}
 ${option('careers','folder-open',tr(lang,'Le mie carriere','My careers'),tr(lang,'Carica e gestisci i salvataggi','Load and manage saved careers'))}
 ${option('settings','settings',tr(lang,'Impostazioni','Settings'),tr(lang,'Lingua e preferenze','Language and preferences'))}
 </section></div>`;
}


/* Three setup pages: the wizard is intentionally ephemeral until final confirmation. */
function wizardFrame(content,lang,step,titleIt,titleEn){
 return `<div class="onboarding restored-onboarding wizard-page">
 <div class="onboarding-orb ob-one"></div><div class="onboarding-orb ob-two"></div>
 <div class="onboard-wrap">
  <header class="onboard-header fa-page-heading">
   <span class="pretitle wizard-step-label">${tr(lang,'NUOVA CARRIERA','NEW CAREER')} · ${tr(lang,'PASSAGGIO','STEP')} ${step}/4</span>
   <h1 class="fa-page-title">${tr(lang,titleIt,titleEn)}</h1>
   <div class="wizard-topline">
    ${step>1?button('setup-back',tr(lang,'Indietro','Back'),'ghost wizard-back'):''}
    ${button('cancel-setup',tr(lang,'Menu','Menu'),'ghost wizard-cancel')}
   </div>
  </header>
  ${content}
 </div></div>`;
}
export function managerPage(draft,lang,pickers={}){
 const p=normalizeManagerProfile(draft.managerProfile);
 const form=`<section class="wizard-manager-panel panel" aria-labelledby="wizard-manager-title">
 <div class="onboard-heading"><h2 id="wizard-manager-title">${tr(lang,'1 · Il tuo allenatore','1 · Your manager')}</h2></div>
 <form id="manager-form" class="onboard-manager-form wizard-manager-form" novalidate>
  <div class="wizard-profile-grid">
   <div class="wizard-profile-field">
    <span class="input-label" id="manager-first-name-label">${tr(lang,'Nome','First name')}</span>
    <input class="text-field fa-interactive-box wizard-profile-input" id="manager-first-name" aria-labelledby="manager-first-name-label" name="firstName" type="text"
     value="${esc(p.firstName)}" maxlength="40" autocomplete="given-name" required
     aria-invalid="false" aria-describedby="manager-form-error" placeholder="${tr(lang,'Nome','First name')}">
    <p id="manager-first-name-error" class="field-error" role="alert" hidden></p>
   </div>
   <div class="wizard-profile-field">
    <span class="input-label" id="manager-last-name-label">${tr(lang,'Cognome','Last name')}</span>
    <input class="text-field fa-interactive-box wizard-profile-input" id="manager-last-name" aria-labelledby="manager-last-name-label" name="lastName" type="text"
     value="${esc(p.lastName)}" maxlength="40" autocomplete="family-name" required
     aria-invalid="false" aria-describedby="manager-form-error" placeholder="${tr(lang,'Cognome','Last name')}">
    <p id="manager-last-name-error" class="field-error" role="alert" hidden></p>
   </div>
   <div class="wizard-profile-field">
    <span class="input-label" id="manager-birth-date-label">${tr(lang,'Data di nascita','Date of birth')}</span>
    ${renderDateControl(p.birthDate,lang,pickers.open==='calendar',pickers.month,pickers.jump)}
   </div>
   <div class="wizard-profile-field">
    <span class="input-label" id="manager-nationality-label">${tr(lang,'Nazionalità','Nationality')}</span>
    ${renderNationalityControl(p.nationality,lang,pickers.open==='nationality')}
   </div>
   <div class="wizard-profile-field wizard-profile-birthplace">
    <span class="input-label" id="manager-birth-place-label">${tr(lang,'Luogo di nascita','Place of birth')}</span>
    <input class="text-field fa-interactive-box wizard-profile-input" id="manager-birth-place" aria-labelledby="manager-birth-place-label" name="birthPlace" type="text"
     value="${esc(p.birthPlace)}" maxlength="80" autocomplete="off" required
     aria-invalid="false" aria-describedby="manager-form-error"
     placeholder="${tr(lang,'Città di nascita','Birthplace city')}">
    <p id="manager-birth-place-error" class="field-error" role="alert" hidden></p>
   </div>
  </div>
  <div class="fa-action-row wizard-manager-actions">
   <button class="btn primary begin-button" type="submit"><span>${tr(lang,'Avanti: Nazione','Next: Country')}</span>${icon('chevron-right',18)}</button>
   <p id="manager-form-error" class="fa-action-error" role="alert" hidden></p>
  </div>
 </form>
 </section>`;
 return wizardFrame(form,lang,1,'Scegli il tuo allenatore','Choose your manager');
}
export function countryPage(draft,lang){
 const selected=LEAGUES.some(l=>l.id===draft.countryId)?draft.countryId:null;
 const loc=lang==='en'?'en':'it';
 const content=`<section class="wizard-country-panel panel" aria-labelledby="league-pick-title">
  <div class="onboard-heading"><h2 id="league-pick-title">${tr(lang,'2 · La tua nazione','2 · Your country')}</h2>
   <span>${LEAGUES.length} ${tr(lang,'NAZIONI','COUNTRIES')}</span></div>
  <div class="wizard-country-options" role="group" aria-label="${tr(lang,'Nazione','Country')}">
   ${LEAGUES.map(l=>`<button type="button" id="wizard-country-${esc(l.id)}" class="fa-interactive-box wizard-country-option ${l.id===selected?'fa-choice-selected':''}"
     data-action="country" data-country="${l.id}" aria-pressed="${l.id===selected}">
     <span class="wizard-country-flag" aria-hidden="true">${countryFlag(l.id)}</span>
     <span class="wizard-country-copy"><b>${esc(l.country[loc])}</b><small>${esc(l.competition)}</small></span>
     <span class="wizard-country-check" aria-hidden="true">${l.id===selected?icon('check',15):''}</span></button>`).join('')}
  </div>
  <div class="fa-action-row wizard-country-actions"><button class="btn primary begin-button" type="button" data-action="country-next" ${selected?'':'disabled'}><span>${tr(lang,'Avanti: Campionato','Next: League')}</span>${icon('chevron-right',18)}</button></div>
 </section>`;
 return wizardFrame(content,lang,2,'Scegli la nazione','Choose your country');
}
export function championshipPage(draft,lang){
 const country=LEAGUES.find(l=>l.id===draft.countryId);
 const options=country?[country]:[];
 const selected=options.find(l=>l.id===draft.championshipId)??null;
 const loc=lang==='en'?'en':'it';
 const content=`<section class="wizard-country-panel wizard-championship-panel panel" aria-labelledby="championship-pick-title">
  <div class="onboard-heading"><h2 id="championship-pick-title">${tr(lang,'3 · Il tuo campionato','3 · Your league')}</h2>
   <span>${options.length} ${tr(lang,'CAMPIONATO DISPONIBILE','AVAILABLE LEAGUE')}</span></div>
  <div class="wizard-country-options wizard-championship-options" role="group" aria-label="${tr(lang,'Campionato','League')}">
   ${options.map(l=>`<button type="button" class="fa-interactive-box wizard-country-option wizard-championship-option ${l.id===selected?.id?'fa-choice-selected':''}"
    data-action="championship" data-championship="${esc(l.id)}" aria-pressed="${l.id===selected?.id}">
    <span class="wizard-championship-symbol" aria-hidden="true">${icon('shield',25)}</span>
    <span class="wizard-country-copy"><b>${esc(l.competition)}</b><small>${esc(l.country[loc])} · ${l.clubCount} ${tr(lang,'squadre','clubs')}</small></span>
    <span class="wizard-country-check" aria-hidden="true">${l.id===selected?.id?icon('check',15):''}</span></button>`).join('')}
  </div>
  <div class="fa-action-row wizard-country-actions"><button class="btn primary begin-button" type="button" data-action="championship-next" ${selected?'':'disabled'}><span>${tr(lang,'Avanti: Squadra','Next: Club')}</span>${icon('chevron-right',18)}</button></div>
 </section>`;
 return wizardFrame(content,lang,3,'Scegli il campionato','Choose your league');
}
export function teamsPage(draft,lang){
 const league=leagueById(draft.countryId),clubs=getLeagueClubs(league.id),loc=lang==='en'?'en':'it';
 const chosen=clubs.find(c=>c.id===draft.clubId)??null;
 const content=`<div class="onboard-grid wizard-team-grid">
  <section class="onboard-clubs wizard-team-panel" aria-labelledby="clubs-title">
   <div class="onboard-heading"><h2 id="clubs-title">${tr(lang,'4 · La tua squadra','4 · Your club')}</h2>
    <span>${clubs.length} ${tr(lang,'SOCIETÀ','CLUBS')}</span></div>
    <table class="club-table" id="clubs" aria-label="${tr(lang,'Squadre disponibili','Available clubs')}">
     <thead><tr>
      <th scope="col">${tr(lang,'Squadra','Club')}</th>
      <th scope="col" class="club-table-city">${tr(lang,'Città','City')}</th>
      <th scope="col" class="club-table-founded">${tr(lang,'Fondazione','Founded')}</th>
      <th scope="col" class="club-table-reputation">${tr(lang,'Rep.','Rep.')}</th>
      <th scope="col" class="club-table-capacity">${tr(lang,'Posti','Seats')}</th>
      <th scope="col" class="club-table-status">${tr(lang,'Scelta','Selection')}</th>
     </tr></thead>
     <tbody>${clubs.map(c=>`<tr class="club-table-row ${c.id===chosen?.id?'is-selected':''}" data-action="select" data-id="${c.id}">
       <td><div class="club-table-cell club-table-cell--name"><button type="button" class="club-table-select" data-action="select" data-id="${c.id}" aria-pressed="${c.id===chosen?.id}" aria-label="${tr(lang,'Seleziona','Select')} ${esc(c.name)}">
        ${crest(c)}<span class="club-table-name"><strong>${esc(c.name)}</strong><small>${esc(c.city)}</small></span></button></div></td>
       <td class="club-table-city"><div class="club-table-cell">${esc(c.city)}</div></td>
       <td class="club-table-founded"><div class="club-table-cell">${c.founded}</div></td>
       <td class="club-table-reputation" title="${tr(lang,'Reputazione','Reputation')}"><div class="club-table-cell club-table-cell--number">${c.reputation}<small>/100</small></div></td>
       <td class="club-table-capacity" title="${esc(c.stadium)} · ${tr(lang,'Capienza','Capacity')}"><div class="club-table-cell club-table-cell--number">${new Intl.NumberFormat(lang==='en'?'en-GB':'it-IT').format(c.capacity)}</div></td>
       <td class="club-table-status"><div class="club-table-cell club-table-cell--status"><span class="club-table-indicator" aria-hidden="true">${c.id===chosen?.id?icon('check',16):icon('chevron-right',16)}</span></div></td>
      </tr>`).join('')}</tbody>
    </table>
  </section>
   <aside class="onboard-aside wizard-club-summary">
   <div class="onboard-heading wizard-summary-heading"><h2>${tr(lang,'Riepilogo','Summary')}</h2></div>
   ${chosen?`    
    <div class="selected-pretitle">${tr(lang,'CLUB SELEZIONATO','SELECTED CLUB')}</div>
    <div class="selected-crest">${crest(chosen)}</div>
    <h2>${esc(chosen.name)}</h2>
    <p class="selected-city">${esc(chosen.city)} · ${esc(league.country[loc])} · ${tr(lang,'Fondato nel','Founded')} ${chosen.founded}</p>
    <p class="selected-competition">${esc(league.competition)}</p>
    <div class="selected-stats">
      <div><span>${tr(lang,'REPUTAZIONE','REPUTATION')}</span><strong>${chosen.reputation}<small>/100</small></strong></div>
      <div><span>${tr(lang,'POSTI','SEATS')}</span><strong>${new Intl.NumberFormat(lang==='en'?'en-GB':'it-IT').format(chosen.capacity)}</strong></div>
      <div class="wizard-stadium-stat"><span>${tr(lang,'STADIO','STADIUM')}</span><strong class="selected-stat-city">${esc(chosen.stadium)}</strong></div>
    </div>
`:`<div class="wizard-no-club">
     <div class="selected-pretitle">${tr(lang,'CLUB SELEZIONATO','SELECTED CLUB')}</div>
     <div class="wizard-empty-icon">${icon('shield',26)}</div>
     <h2>${tr(lang,'Seleziona una squadra','Select a club')}</h2>
     <p>${tr(lang,'Scegli una delle squadre nella tabella per proseguire.','Choose a club in the table to continue.')}</p>
    </div>`}
    <div class="wizard-manager-summary"><span>${tr(lang,'ALLENATORE','MANAGER')}</span><strong>${esc(draft.managerName)}</strong>
     ${managerAge(draft.managerProfile)!==null?`<small>${managerAge(draft.managerProfile)} ${tr(lang,'anni','years old')}</small>`:''}</div>
    <div class="fa-action-row wizard-team-actions"><button type="button" class="btn secondary wizard-roster-button" disabled aria-disabled="true" title="${tr(lang,'Rosa disponibile in seguito','Squad management coming later')}"><span>${tr(lang,'Rosa','Squad')}</span></button><button class="btn primary begin-button" type="button" data-action="start-career" ${chosen?'':'disabled'}><span>${tr(lang,'Inizia carriera','Start career')}</span>${icon('chevron-right',18)}</button></div>

   </aside>
 </div>`;
 return wizardFrame(content,lang,4,'Scegli la squadra','Choose your club');
}

export function careersPage(catalog,lang,currentCareerId=null){
 const rows=catalog.rows;
 const entries=rows.map((row,index)=>{
  const m=row.meta,team=m&&club(m.countryId,m.clubId),league=m&&leagueById(m.countryId);
  const healthy=row.status==='ok',active=healthy&&currentCareerId!==null&&row.id===currentCareerId,id=esc(row.id);
  const title=esc(m?.careerName??team?.name??tr(lang,'Carriera non leggibile','Unreadable career'));
  const caption=[league?.country?.[lang],league?.competition].filter(Boolean).join(' · ');
  const status=!healthy?tr(lang,'Da verificare','Needs attention'):tr(lang,'Attuale','Current');
  const fact=(label,value)=>`<div class="wizard-career-fact"><span>${label}</span><strong>${value}</strong></div>`;
  return `<article class="wizard-career-row ${active?'is-current':''} ${healthy?'':'is-corrupt'}" aria-labelledby="wizard-career-${index}-title" ${active?'aria-current="true"':''}>
    <div class="wizard-career-identity">
     <span class="wizard-career-crest" aria-hidden="true">${team?crest(team):icon('shield',23)}</span>
     <div class="wizard-career-heading">
      <span class="wizard-career-location">${countryFlag(league?.id)}<span>${esc(caption||tr(lang,'Salvataggio locale','Local save'))}</span></span>
      <h3 id="wizard-career-${index}-title">${title}</h3>
      ${team&&m?.careerName!==team.name?`<small>${esc(team.name)}</small>`:''}
     </div>
     ${!healthy||active?`<span class="wizard-career-status ${healthy?'is-active':'is-invalid'}">${!healthy?icon('alert-triangle',14):icon('check',14)}<span>${status}</span></span>`:''}
    </div>
    <div class="wizard-career-facts">
     ${fact(tr(lang,'Allenatore','Manager'),esc(m?.managerName??'—'))}
     ${fact(tr(lang,'Stagione','Season'),healthy?esc(tr(lang,'Stagione ','Season ')+seasonNumber(row.state)):'—')}
     ${fact(tr(lang,'Data di gioco','Game date'),healthy?esc(fmtGameDate(row.state.date,lang,sessionTime(row.state))):'—')}
     ${fact(tr(lang,'Ultimo salvataggio','Last saved'),esc(fmtDate(m?.updatedAt,lang,true)))}
    </div>
    ${healthy?'':`<p class="wizard-career-warning" role="status">${icon('alert-triangle',16)}${tr(lang,'Salvataggio danneggiato: caricamento disabilitato. Puoi esportare o eliminare questa carriera.','Corrupt save: loading disabled. You can export or delete this career.')}</p>`}
    <div class="wizard-career-actions">
     ${healthy?button('load',tr(lang,'Carica','Load'),'primary',`data-id="${id}"`):''}
     ${healthy?button('rename',tr(lang,'Rinomina','Rename'),'secondary',`data-id="${id}"`):''}
     ${button('export',tr(lang,'Esporta','Export'),'secondary',`data-id="${id}"`)}
     ${button('delete',tr(lang,'Elimina','Delete'),'danger',`data-id="${id}"`)}
    </div>
   </article>`;
 }).join('');
 return `<div class="onboarding restored-onboarding wizard-page restored-careers wizard-careers">
  <div class="onboarding-orb ob-one"></div><div class="onboarding-orb ob-two"></div>
  <div class="onboard-wrap">
   <header class="onboard-header fa-page-heading">
    <span class="pretitle wizard-step-label">${tr(lang,'SALVATAGGI LOCALI','LOCAL SAVES')}</span>
    <h1 class="fa-page-title">${tr(lang,'Le mie carriere','My careers')}</h1>
    <div class="wizard-topline">${button('cancel-setup',tr(lang,'Menu','Menu'),'ghost wizard-cancel')}</div>
   </header>
   <section class="wizard-careers-panel panel" aria-labelledby="wizard-careers-title">
    <div class="wizard-careers-toolbar">
     <div class="onboard-heading wizard-careers-heading"><h2 id="wizard-careers-title">${tr(lang,'Carriere salvate','Saved careers')}</h2><span>${rows.length} ${tr(lang,rows.length===1?'CARRIERA':'CARRIERE',rows.length===1?'CAREER':'CAREERS')}</span></div>
     <div class="wizard-careers-toolbar-actions">
      ${button('new',tr(lang,'Nuova carriera','New career'),'primary')}
      ${button('import',tr(lang,'Importa JSON','Import JSON'),'secondary')}
     </div>
    </div>
    <input id="import-file" type="file" accept=".json,application/json" hidden aria-label="${tr(lang,'File carriera JSON','Career JSON file')}">
    <div class="wizard-careers-list">${entries||`<div class="wizard-careers-empty">
      <span class="wizard-careers-empty-icon" aria-hidden="true">${icon('folder-open',28)}</span>
      <h3>${tr(lang,'Nessuna carriera salvata','No saved careers')}</h3>
      <p>${tr(lang,'Crea la prima carriera per iniziare.','Create your first career to get started.')}</p>
     </div>`}</div>
   </section>
   <dialog id="career-rename-dialog" class="fa-site-dialog fa-rename-dialog" aria-labelledby="career-rename-title">
    <form id="career-rename-form" novalidate>
     <div class="fa-rename-dialog-header"><h2 id="career-rename-title" tabindex="-1">${tr(lang,'Rinomina carriera','Rename career')}</h2>
      <button class="fa-rename-close" type="button" data-action="rename-cancel" aria-label="${tr(lang,'Chiudi','Close')}">${icon('x',17)}</button>
     </div>
     <span class="input-label" id="career-rename-field-label">${tr(lang,'Nome carriera','Career name')}</span>
     <input id="career-rename-input" class="text-field fa-interactive-box" type="text" name="careerName" maxlength="80" autocomplete="off" required aria-labelledby="career-rename-field-label" aria-describedby="career-rename-error">
     <p id="career-rename-error" class="fa-rename-error" role="alert" hidden></p>
     <div class="fa-rename-dialog-actions">
      <button type="button" class="btn secondary" data-action="rename-cancel">${tr(lang,'Annulla','Cancel')}</button>
      <button type="submit" class="btn primary">${icon('check',14)}<span>${tr(lang,'Salva','Save')}</span></button>
     </div>
    </form>
   </dialog>
   <dialog id="career-delete-dialog" class="fa-site-dialog fa-delete-dialog" aria-labelledby="career-delete-title" aria-describedby="career-delete-description">
    <form id="career-delete-form">
     <div class="fa-rename-dialog-header"><h2 id="career-delete-title" tabindex="-1">${tr(lang,'Elimina carriera','Delete career')}</h2>
      <button class="fa-rename-close" type="button" data-action="delete-cancel" aria-label="${tr(lang,'Chiudi','Close')}">${icon('x',17)}</button>
     </div>
     <p id="career-delete-description" class="fa-site-dialog-description">${tr(lang,'Eliminare definitivamente questa carriera?','Permanently delete this career?')}</p>
     <div class="fa-rename-dialog-actions">
      <button type="button" class="btn secondary" data-action="delete-cancel">${tr(lang,'Annulla','Cancel')}</button>
      <button type="submit" class="btn danger">${icon('trash',14)}<span>${tr(lang,'Elimina','Delete')}</span></button>
     </div>
    </form>
   </dialog>
  </div>
 </div>`;
}
export function settingsPage(lang,languageOpen=false){
 const info=(title,detail)=>`<div class="setting-fact"><span>${esc(title)}</span><b>${esc(detail)}</b></div>`;
 const option=(action,iconName,title,desc)=>`<button class="settings-action" type="button" data-action="${action}">
  ${icon(iconName,22)}<span><strong>${esc(title)}</strong><small>${esc(desc)}</small></span>${icon('chevron-right',17)}</button>`;
 return `<div class="restored-settings">
  <header class="fa-page-heading fa-settings-heading"><h1 class="fa-page-title">${tr(lang,'Impostazioni','Settings')}</h1></header>
  <div class="settings-grid">
   <section class="settings-panel panel"><h2>${tr(lang,'Lingua','Language')}</h2>
    <div class="settings-language">${languagePicker(lang,languageOpen)}</div></section>
   <section class="settings-panel panel"><h2>${tr(lang,'La tua carriera','Your career')}</h2>
    ${info(tr(lang,'SALVATAGGI','SAVES'),tr(lang,'IndexedDB locale','Local IndexedDB'))}
    ${info(tr(lang,'ACCOUNT','ACCOUNT'),tr(lang,'Non richiesto','Not required'))}
    ${info(tr(lang,'CONNESSIONE','CONNECTION'),tr(lang,'Offline','Offline'))}</section>
   <section class="settings-panel panel"><h2>${tr(lang,'Gestione dati','Data management')}</h2>
    <div class="settings-actions">
      ${option('careers','folder-open',tr(lang,'Gestisci carriere','Manage careers'),tr(lang,'Carica, rinomina o elimina un salvataggio.','Load, rename or delete a save.'))}
      ${option('new','plus-circle',tr(lang,'Nuova carriera','New career'),tr(lang,'Inizia senza cancellare quelle esistenti.','Start without deleting existing careers.'))}
      ${option('import','upload',tr(lang,'Importa carriera','Import career'),tr(lang,'Importa un salvataggio JSON.','Import a JSON save.'))}
      <input id="import-file" type="file" accept=".json,application/json" hidden aria-label="${tr(lang,'File carriera JSON','Career JSON file')}">
    </div></section>
   <section class="settings-panel panel"><h2>${tr(lang,'Informazioni sul gioco','About the game')}</h2>
    <div class="about-grid">
      <div>${icon('shield',22)}<strong>${tr(lang,'Universo immaginario','Fictional universe')}</strong><p>${tr(lang,'Paesi e città reali; squadre e competizioni inventate.','Real countries and cities; invented clubs and leagues.')}</p></div>
      <div>${icon('folder-open',22)}<strong>100% offline</strong><p>${tr(lang,'Nessun account, cloud o servizio esterno.','No accounts, cloud or external services.')}</p></div>
      <div>${icon('calendar',22)}<strong>${tr(lang,'Simulazione calendario','Calendar simulation')}</strong><p>${tr(lang,'Avanzamento del tempo, senza partite.','Time advancement without matches.')}</p></div>
    </div></section>
  </div>
 </div>`;
}

export function simulationPage(meta,state,lang,playing,nextFixture=null){
 const c=club(meta.countryId,meta.clubId),l=leagueById(meta.countryId);
 const fixtureOpponent=nextFixture?club(meta.countryId,nextFixture.homeClubId===meta.clubId?nextFixture.awayClubId:nextFixture.homeClubId):null;
 const fixtureHome=nextFixture?.homeClubId===meta.clubId;
 const calendar=seasonCalendar(state.date,state.startedAt);
 const market=transferMarketFor(state);
 const marketTitle=market.window==='summer'?tr(lang,'Mercato estivo','Summer transfer window'):
  market.window==='winter'?tr(lang,'Mercato invernale','Winter transfer window'):
  tr(lang,'Calciomercato chiuso','Transfer window closed');
 const phaseLabel=calendar.phase==='preseason'?tr(lang,'Prestagione','Preseason'):
  calendar.phase==='season'?tr(lang,'Stagione','Season'):tr(lang,'Pausa estiva','Summer break');
 const moments=[
  {id:'preseason',date:calendar.preseasonStart,it:'Prestagione',en:'Preseason'},
  {id:'season',date:calendar.seasonStart,it:'Periodo stagionale',en:'Season period'},
  {id:'offseason',date:calendar.offseasonStart,it:'Pausa estiva',en:'Summer break'}
 ];
 return `<section class="heading fa-page-heading">
 <span class="kicker">${tr(lang,'CARRIERA','CAREER')}</span><h1 class="fa-page-title">${tr(lang,'Dashboard','Dashboard')}</h1>
 <p>${esc(c?.name??'—')} · ${esc(meta.managerName)} · <span class="career-country-flag" aria-hidden="true">${countryFlag(l.id)}</span> ${esc(l.country[lang])}</p></section>
 <div class="metrics"><section class="panel"><span class="kicker">${tr(lang,'DATA DI GIOCO','GAME DATE')}</span><h2>${esc(fmtGameDate(state.date,lang,sessionTime(state)))}</h2></section>
 <section class="panel"><span class="kicker">${tr(lang,'STAGIONE','SEASON')}</span><h2>${esc(tr(lang,'Stagione ','Season ')+seasonNumber(state))}</h2></section>
 <section class="panel"><span class="kicker">${tr(lang,'GIORNI TRASCORSI','DAYS ELAPSED')}</span><h2>${state.daysElapsed.toLocaleString(lang==='en'?'en-GB':'it-IT')}</h2></section></div>
 <section class="panel fa-season-calendar" aria-labelledby="fa-season-calendar-title">
  <div class="fa-season-calendar-header">
   <h2 id="fa-season-calendar-title">${tr(lang,'Calendario stagionale','Season calendar')}</h2>
   <span class="fa-season-phase">${esc(phaseLabel)}</span>
  </div>
  <div class="fa-season-milestones">
   ${moments.map(m=>`<div class="fa-season-milestone ${calendar.phase===m.id?'is-current':''}">
    <span>${tr(lang,m.it,m.en)}</span><strong>${esc(fmtGameDate(m.date,lang))}</strong>
   </div>`).join('')}
  </div>
  <p class="muted">${tr(lang,
   'Date e orari delle partite sono programmati, ma non viene ancora giocato alcun incontro.',
   'Match dates and kick-off times are scheduled, but no matches are played yet.')}</p>
 </section>
 <section class="panel fa-next-fixture" aria-labelledby="fa-next-fixture-title">
  <div class="fa-season-calendar-header">
   <h2 id="fa-next-fixture-title">${tr(lang,'Prossima partita','Next match')}</h2>
   <span class="fa-season-phase">${tr(lang,'PROGRAMMATA','SCHEDULED')}</span>
  </div>
  ${nextFixture?`<p><strong>${esc(c?.name??'—')} — ${esc(fixtureOpponent?.name??'—')}</strong></p>
   <p class="muted">${esc(fmtDate(nextFixture.date,lang))} · ${esc(nextFixture.time)} · ${fixtureHome?tr(lang,'In casa','Home'):tr(lang,'In trasferta','Away')}</p>`:
   `<p class="muted">${tr(lang,'Nessuna partita futura disponibile','No upcoming match available')}</p>`}
  <div class="actions">${button('fixture-open',tr(lang,'Apri calendario','Open calendar'),'secondary')}</div>
 </section>
 <section class="panel fa-transfer-window" aria-labelledby="fa-transfer-title">
  <div class="fa-season-calendar-header">
   <h2 id="fa-transfer-title">${tr(lang,'Calciomercato','Transfer market')}</h2>
   <span class="fa-transfer-status ${market.open?'is-open':'is-closed'}">${market.open?tr(lang,'APERTO','OPEN'):tr(lang,'CHIUSO','CLOSED')}</span>
  </div>
  <p class="fa-transfer-name">${esc(marketTitle)}</p>
  <div class="fa-transfer-periods">
   <div><strong>${tr(lang,'Estate','Summer')}</strong><span>${tr(lang,'1 luglio 00:00 – 31 agosto 24:00','1 July 00:00 – 31 August 24:00')}</span></div>
   <div><strong>${tr(lang,'Inverno','Winter')}</strong><span>${tr(lang,'1 gennaio 00:00 – 31 gennaio 24:00','1 January 00:00 – 31 January 24:00')}</span></div>
  </div>
  <p class="muted">${tr(lang,'La chiusura coincide con le 00:00 del 1° settembre o del 1° febbraio. Il mercato è solo informativo: non sono ancora disponibili trasferimenti.','Each window closes at 00:00 on 1 September or 1 February. Market timing is informational; transfers are not yet available.')}</p>
 </section>
 <section class="panel control"><h2>${tr(lang,'Avanza nel tempo','Advance through time')}</h2><p>${tr(lang,'La simulazione modifica soltanto il calendario. Non viene giocata alcuna partita.','Only the calendar advances. No matches are played.')}</p>
 <div class="actions">${button('hour',tr(lang,'+ 1 ora','+ 1 hour'))}${button('day',tr(lang,'+ 1 giorno','+ 1 day'))}${button('week',tr(lang,'+ 7 giorni','+ 7 days'))}${button('month',tr(lang,'+ 30 giorni','+ 30 days'))}${button('year',tr(lang,'+ 365 giorni','+ 365 days'))}</div>
 <div class="actions separated">${button('careers',tr(lang,'Le mie carriere','My careers'),'ghost')}</div>
 <p class="muted" role="status">${playing?tr(lang,'Avanzamento automatico attivo: +1 ora a ogni intervallo','Automatic advancement: +1 hour per tick'):tr(lang,'Simulazione in pausa','Simulation paused')}</p></section>`;
}

/** CAL-02.4: read-only calendar view. No results, persistence, or match engine. */
export function calendarPage(meta,state,lang,calendar,options={}){
 const view=options.view==='round'?'round':'month';
 const filter=options.filter==='all'?'all':'club';
 const month=options.month??state.date.slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Invalid displayed month');
 const year=Number(month.slice(0,4)),number=Number(month.slice(5,7));
 const date=new Date(month+'-01T12:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,7)!==month)throw new Error('Invalid calendar month');
 const selectedDay=options.day?.slice(0,7)===month?options.day:null;
 const round=Math.max(1,Math.min(38,Number.isSafeInteger(options.round)?options.round:1));
 const c=club(meta.countryId,meta.clubId),league=leagueById(meta.countryId);
 const all=calendar.matchdays.flatMap(day=>day.fixtures).filter(f=>
  filter==='all'||f.homeClubId===meta.clubId||f.awayClubId===meta.clubId);
 const ordered=[...all].sort((a,b)=>
  (a.date+'T'+a.time).localeCompare(b.date+'T'+b.time)||a.id.localeCompare(b.id));
 const visible=view==='round'?ordered.filter(f=>f.matchday===round):
  ordered.filter(f=>f.date.slice(0,7)===month&&(!selectedDay||f.date===selectedDay));
 const byDate=new Map();
 for(const f of ordered)if(f.date.slice(0,7)===month)byDate.set(f.date,(byDate.get(f.date)??0)+1);
 const monthLabel=new Intl.DateTimeFormat(lang==='en'?'en-GB':'it-IT',
  {month:'long',year:'numeric',timeZone:'UTC'}).format(date);
 const gameItem=f=>{
  const home=club(meta.countryId,f.homeClubId);
  const away=club(meta.countryId,f.awayClubId);
  const myClub=f.homeClubId===meta.clubId||f.awayClubId===meta.clubId;
  return '<li class="fa-fixture-item'+(myClub?' is-club':'')+'">'+
   '<span class="fa-fixture-item-time">'+esc(fmtDate(f.date,lang))+' · '+esc(f.time)+'</span>'+
   '<span class="fa-fixture-item-teams">'+esc(home?.name??'—')+' — '+esc(away?.name??'—')+'</span>'+
   '<span class="fa-fixture-item-round">'+esc(tr(lang,'Giornata ','Round ')+f.matchday)+'</span></li>';
 };
 const dates=[...new Set(visible.map(f=>f.date))];
 const matches=visible.length?
  dates.map(day=>'<section class="fa-fixture-date-section"><h3>'+esc(fmtDate(day,lang))+'</h3>'+
   '<ul class="fa-fixture-items">'+visible.filter(f=>f.date===day).map(gameItem).join('')+'</ul></section>').join(''):
  '<p class="muted fa-fixture-empty">'+tr(lang,'Nessuna partita in questa selezione.','No matches in this selection.')+'</p>';
 const toggle=(action,value,label,active)=>
  '<button type="button" class="fa-fixture-toggle'+(active?' is-active':'')+
   '" data-action="'+action+'" data-value="'+value+'" aria-pressed="'+String(active)+'">'+label+'</button>';
 const firstWeekday=(date.getUTCDay()+6)%7;
 const daysInMonth=new Date(Date.UTC(year,number,0)).getUTCDate();
 const weekdays=lang==='en'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
 const dayControls=Array.from({length:firstWeekday},()=>'<span class="fa-fixture-outside" aria-hidden="true"></span>');
 for(let day=1;day<=daysInMonth;day++){
  const iso=month+'-'+String(day).padStart(2,'0');
  const has=byDate.has(iso),selected=selectedDay===iso,current=state.date===iso;
  dayControls.push('<button type="button" data-action="fixture-day" data-date="'+iso+
   '" aria-pressed="'+String(selected)+'" aria-label="'+esc(fmtDate(iso,lang))+
   (has?' · '+byDate.get(iso)+' '+tr(lang,'partite','matches'):'')+
   '" class="fa-fixture-day'+(selected?' is-selected':'')+(current?' is-game-day':'')+'">'+
   '<span>'+day+'</span>'+(has?'<span class="fa-fixture-dot" aria-hidden="true"></span>':'')+'</button>');
 }
 const prev='<button type="button" class="fa-fixture-nav" data-action="fixture-month-prev" aria-label="'+tr(lang,'Mese precedente','Previous month')+'">'+icon('arrow-left',18)+'</button>';
 const next='<button type="button" class="fa-fixture-nav" data-action="fixture-month-next" aria-label="'+tr(lang,'Mese successivo','Next month')+'">'+icon('chevron-right',18)+'</button>';
 const monthContent='<div class="fa-fixture-month-head">'+prev+
   '<h2>'+esc(monthLabel)+'</h2>'+next+
   '<button type="button" class="fa-fixture-current" data-action="fixture-month-current">'+tr(lang,'Data di gioco','Game date')+'</button></div>'+
   '<div class="fa-fixture-calendar-grid" role="group" aria-label="'+tr(lang,'Giorni del mese','Days of month')+'">'+
   weekdays.map(w=>'<span class="fa-fixture-weekday">'+w+'</span>').join('')+
   dayControls.join('')+'</div>'+
   (selectedDay?'<button type="button" class="fa-fixture-clear" data-action="fixture-day-clear">'+
    tr(lang,'Mostra tutto il mese','Show whole month')+'</button>':'');
 const roundContent='<div class="fa-fixture-round-head">'+
   '<button type="button" class="fa-fixture-nav" data-action="fixture-round-prev" aria-label="'+tr(lang,'Giornata precedente','Previous round')+'">'+icon('arrow-left',18)+'</button>'+
   '<h2>'+tr(lang,'Giornata ','Round ')+round+' / 38 · '+esc(calendar.seasonYear+'/'+String((calendar.seasonYear+1)%100).padStart(2,'0'))+'</h2>'+
   '<button type="button" class="fa-fixture-nav" data-action="fixture-round-next" aria-label="'+tr(lang,'Giornata successiva','Next round')+'">'+icon('chevron-right',18)+'</button></div>';
 return '<section class="heading fa-page-heading">'+
  '<span class="kicker">'+tr(lang,'CARRIERA','CAREER')+'</span>'+
  '<h1 class="fa-page-title">'+tr(lang,'Calendario partite','Match calendar')+'</h1>'+
  '<p>'+esc(c?.name??'—')+' · '+esc(league.country[lang])+'</p></section>'+
  '<section class="panel fa-fixture-calendar" aria-labelledby="fa-fixture-calendar-title">'+
  '<h2 id="fa-fixture-calendar-title" class="fa-fixture-heading">'+tr(lang,'Calendario','Calendar')+'</h2>'+
  '<div class="fa-fixture-toolbar"><div class="fa-fixture-switch" role="group" aria-label="'+tr(lang,'Visualizzazione','View')+'">'+
  toggle('fixture-view','month',tr(lang,'Mese','Month'),view==='month')+
  toggle('fixture-view','round',tr(lang,'Giornate','Rounds'),view==='round')+'</div>'+
  '<div class="fa-fixture-switch" role="group" aria-label="'+tr(lang,'Filtro partite','Match filter')+'">'+
  toggle('fixture-filter','club',tr(lang,'La mia squadra','My team'),filter==='club')+
  toggle('fixture-filter','all',tr(lang,'Tutte le partite','All matches'),filter==='all')+'</div></div>'+
  (view==='month'?monthContent:roundContent)+
  '<div class="fa-fixture-results" aria-live="polite"><h2>'+
  tr(lang,'Incontri','Matches')+' · '+visible.length+'</h2>'+matches+'</div></section>';
}
