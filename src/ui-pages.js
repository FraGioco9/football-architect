import {LEAGUES,getLeagueClubs,leagueById} from './leagues.js';
import {seasonLabel,localToday} from './simulation.js';
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
const club=(country,id)=>getLeagueClubs(country).find(x=>x.id===id);
const crest=c=>c?`<span class="crest" style="--club1:${esc(c.colors[0])};--club2:${esc(c.colors[1])}">${esc(c.short)}</span>`:'<span class="crest unknown">?</span>';

/* Inline flags work offline and do not depend on Windows emoji fonts. */
export function countryFlagSvg(code){
 const flags={"IT":"<rect width=\"11\" height=\"22\" fill=\"#009246\"/><rect x=\"11\" width=\"10\" height=\"22\" fill=\"#fff\"/><rect x=\"21\" width=\"11\" height=\"22\" fill=\"#ce2b37\"/>","ENG":"<rect width=\"32\" height=\"22\" fill=\"#fff\"/><path d=\"M13 0h6v22h-6zM0 8h32v6H0z\" fill=\"#ce1124\"/>","ES":"<rect width=\"32\" height=\"22\" fill=\"#aa151b\"/><rect y=\"5.5\" width=\"32\" height=\"11\" fill=\"#f1bf00\"/><path d=\"M11 8.5h4v6h-4z\" fill=\"#aa151b\"/>","DE":"<rect width=\"32\" height=\"7.34\" fill=\"#101010\"/><rect y=\"7.33\" width=\"32\" height=\"7.34\" fill=\"#dd0000\"/><rect y=\"14.66\" width=\"32\" height=\"7.34\" fill=\"#ffce00\"/>","FR":"<rect width=\"11\" height=\"22\" fill=\"#002395\"/><rect x=\"11\" width=\"10\" height=\"22\" fill=\"#fff\"/><rect x=\"21\" width=\"11\" height=\"22\" fill=\"#ed2939\"/>","PT":"<rect width=\"13\" height=\"22\" fill=\"#006600\"/><rect x=\"13\" width=\"19\" height=\"22\" fill=\"#ff0000\"/><circle cx=\"13\" cy=\"11\" r=\"5.4\" fill=\"#f8d447\"/><path d=\"M10.5 8.2h5v6l-2.5 1.6-2.5-1.6z\" fill=\"#fff\" stroke=\"#b0002a\" stroke-width=\".8\"/>","NL":"<rect width=\"32\" height=\"7.34\" fill=\"#ae1c28\"/><rect y=\"7.33\" width=\"32\" height=\"7.34\" fill=\"#fff\"/><rect y=\"14.66\" width=\"32\" height=\"7.34\" fill=\"#21468b\"/>","BR":"<rect width=\"32\" height=\"22\" fill=\"#009739\"/><path d=\"M16 3 29 11 16 19 3 11Z\" fill=\"#ffdf00\"/><circle cx=\"16\" cy=\"11\" r=\"5.3\" fill=\"#002776\"/><path d=\"M11 9.5c4.3-.9 8 1.2 10.1 3.7\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.4\"/>"};
 return flags[code]?'<svg class="wizard-country-flag-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 22" width="32" height="22" aria-hidden="true" focusable="false">'+flags[code]+'</svg>':'';
}
const buttonIcons={continue:'play',new:'plus-circle',careers:'folder-open',settings:'settings',load:'play',rename:'pencil',export:'download',delete:'trash',import:'upload',day:'calendar',week:'calendar',month:'calendar',year:'calendar',toggle:'play','start-career':'play','cancel-setup':'arrow-left'};
export const button=(action,title,variant='primary',attrs='')=>`<button type="button" class="btn ${variant}" data-action="${action}" ${attrs}>${buttonIcons[action]?icon(action==='toggle'&&variant==='warning'?'pause':buttonIcons[action],16):''}<span>${esc(title)}</span></button>`;
export function layout(inner,lang,message=null,languageOpen=false){
 return `<div class="shell"><a href="#content" class="skip">${tr(lang,'Vai al contenuto','Skip to content')}</a>
 <header class="top"><a class="brand" href="/" data-action="home"><span class="brand-symbol">${icon('shield',22)}</span><span>FOOTBALL <b>ARCHITECT</b><small>BUILD YOUR LEGACY</small></span></a>
 <div class="header-actions">${languagePicker(lang,languageOpen)}</div></header>
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
 <div class="active-details">${crest(team)}<div><h2>${esc(team?.name??'—')}</h2><p>${meta.careerName&&meta.careerName!==team?.name?esc(meta.careerName)+' · ':''}${esc(meta.managerName)} · ${tr(lang,'Stagione','Season')} ${esc(seasonLabel(active.state.date))}</p>
 <p>${esc(fmtDate(active.state.date,lang))} · ${tr(lang,'Salvata','Saved')} ${esc(fmtDate(meta.updatedAt,lang,true))}</p></div></div>
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
     <span class="wizard-country-flag" aria-hidden="true">${countryFlagSvg(l.id)}</span>
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

export function careersPage(catalog,lang){
 const valid=catalog.rows;
 const cards=valid.map(row=>{
  const m=row.meta,team=m&&club(m.countryId,m.clubId),l=m&&leagueById(m.countryId);
  const healthy=row.status==='ok',active=row.id===catalog.activeId,id=esc(row.id);
  const title=esc(m?.careerName??team?.name??tr(lang,'Carriera non leggibile','Unreadable career'));
  return `<article class="career-card ${active&&healthy?'career-active':''}" aria-label="${title}">
   <div class="career-card-top">
    <div><span class="overline">${esc(l?.flag??'')} ${esc(l?.country?.[lang]??'')}${l?' · '+esc(l.competition):''}</span>
    <h2>${title}</h2></div>
    <span class="tag status-chip ${!healthy?'tag-danger':active?'tag-green':'tag-muted'}">${!healthy?tr(lang,'Da verificare','Needs attention'):active?tr(lang,'Attiva','Active'):tr(lang,'Disponibile','Available')}</span>
   </div>
   <div class="career-meta">
    <span>${tr(lang,'Club','Club')}: <b>${esc(team?.name??'—')}</b></span>
    <span>${tr(lang,'Allenatore','Manager')}: <b>${esc(m?.managerName??'—')}</b></span>
    <span>${tr(lang,'Stagione','Season')}: <b>${healthy?esc(seasonLabel(row.state.date)):'—'}</b></span>
    <span>${tr(lang,'Data di gioco','Game date')}: <b>${healthy?esc(fmtDate(row.state.date,lang)):'—'}</b></span>
    <span>${tr(lang,'Ultimo salvataggio','Last saved')}: <b>${esc(fmtDate(m?.updatedAt,lang,true))}</b></span>
   </div>
   ${healthy?'':`<p class="career-warning" role="status">${tr(lang,'Salvataggio danneggiato: caricamento disabilitato. Puoi esportare o eliminare questa carriera.','Corrupt save: loading disabled. You can export or delete this career.')}</p>`}
   <div class="career-actions">
     ${healthy?button('load',active?tr(lang,'Continua','Continue'):tr(lang,'Apri','Open'),'secondary',`data-id="${id}"`):''}
     ${button('export',tr(lang,'Esporta','Export'),'ghost',`data-id="${id}"`)}
     ${button('delete',tr(lang,'Elimina','Delete'),'danger',`data-id="${id}"`)}
     ${healthy?`<details class="career-more"><summary>${tr(lang,'Altre azioni','More actions')} ${icon('chevron-down',15)}</summary>
        <div class="career-more-panel">${button('rename',tr(lang,'Rinomina','Rename'),'ghost',`data-id="${id}"`)}</div></details>`:''}
   </div>
  </article>`;
 }).join('');
 return `<div class="restored-careers">
  <header class="career-hub-heading fa-page-heading">
   <span class="pretitle">${tr(lang,'SALVATAGGI LOCALI','LOCAL SAVES')}</span>
   <div class="restored-section-head"><div><h1 class="fa-page-title">${tr(lang,'Le tue carriere','Your careers')}</h1><p>${tr(lang,'Apri una carriera o creane una nuova.','Open a career or create a new one.')}</p></div>
   <div class="career-head-actions">${button('new',tr(lang,'Nuova carriera','New career'),'primary')} ${button('import',tr(lang,'Importa','Import'),'ghost')}</div></div>
   <input id="import-file" type="file" accept=".json,application/json" hidden aria-label="${tr(lang,'File carriera JSON','Career JSON file')}">
  </header>
  <div class="career-grid">${cards||`<div class="panel career-empty"><h2>${tr(lang,'Nessuna carriera salvata','No saved careers')}</h2>
    <p>${tr(lang,'Crea la prima carriera per iniziare.','Create your first career to get started.')}</p></div>`}</div>
 </div>`;
}
export function settingsPage(lang){
 const info=(title,detail)=>`<div class="setting-fact"><span>${esc(title)}</span><b>${esc(detail)}</b></div>`;
 const option=(action,iconName,title,desc)=>`<button class="settings-action" type="button" data-action="${action}">
  ${icon(iconName,22)}<span><strong>${esc(title)}</strong><small>${esc(desc)}</small></span>${icon('chevron-right',17)}</button>`;
 return `<div class="restored-settings">
  <header class="career-hub-heading fa-page-heading"><span class="pretitle">${tr(lang,'PREFERENZE','PREFERENCES')}</span>
   <h1 class="fa-page-title">${tr(lang,'Impostazioni e salvataggi','Settings and saves')}</h1><p>${tr(lang,'Le tue carriere esistono soltanto su questo computer, senza account e senza servizi esterni.','Your careers are stored on this computer, without accounts or external services.')}</p></header>
  <div class="settings-grid">
   <section class="settings-panel panel"><h2>${tr(lang,'Lingua','Language')}</h2>
    <div class="settings-language"><div class="setting-fact"><span>${tr(lang,'LINGUA ATTUALE','CURRENT LANGUAGE')}</span><b>${lang==='en'?'English':'Italiano'}</b></div>
    <button class="btn secondary" data-action="language-focus" type="button">${icon('flag',17)} ${tr(lang,'Cambia lingua','Change language')}</button></div></section>
   <section class="settings-panel panel"><h2>${tr(lang,'La tua carriera','Your career')}</h2>
    ${info(tr(lang,'SALVATAGGI','SAVES'),tr(lang,'IndexedDB locale','Local IndexedDB'))}
    ${info(tr(lang,'ACCOUNT','ACCOUNT'),tr(lang,'Non richiesto','Not required'))}
    ${info(tr(lang,'CONNESSIONE','CONNECTION'),tr(lang,'Offline','Offline'))}</section>
   <section class="settings-panel panel"><h2>${tr(lang,'Gestione dati','Data management')}</h2>
    <p class="settings-panel-note">${tr(lang,'Esporta una copia o importa una carriera esistente.','Export a copy or import an existing career.')}</p>
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

export function simulationPage(meta,state,lang,playing){
 const c=club(meta.countryId,meta.clubId),l=leagueById(meta.countryId);
 return `<section class="heading fa-page-heading"><button class="back" type="button" data-action="home">${icon('arrow-left',16)} ${tr(lang,'Menu','Menu')}</button>
 <span class="kicker">${tr(lang,'CARRIERA','CAREER')}</span><h1 class="fa-page-title">${esc(c?.name??'—')}</h1>
 <p>${esc(meta.managerName)} · ${esc(l.flag)} ${esc(l.country[lang])}</p></section>
 <div class="metrics"><section class="panel"><span class="kicker">${tr(lang,'DATA DI GIOCO','GAME DATE')}</span><h2>${esc(fmtDate(state.date,lang))}</h2></section>
 <section class="panel"><span class="kicker">${tr(lang,'STAGIONE','SEASON')}</span><h2>${esc(seasonLabel(state.date))}</h2></section>
 <section class="panel"><span class="kicker">${tr(lang,'GIORNI TRASCORSI','DAYS ELAPSED')}</span><h2>${state.daysElapsed.toLocaleString(lang==='en'?'en-GB':'it-IT')}</h2></section></div>
 <section class="panel control"><h2>${tr(lang,'Avanza nel tempo','Advance through time')}</h2><p>${tr(lang,'La simulazione modifica soltanto il calendario. Non viene giocata alcuna partita.','Only the calendar advances. No matches are played.')}</p>
 <div class="actions">${button('day',tr(lang,'+ 1 giorno','+ 1 day'))}${button('week',tr(lang,'+ 7 giorni','+ 7 days'))}${button('month',tr(lang,'+ 30 giorni','+ 30 days'))}${button('year',tr(lang,'+ 365 giorni','+ 365 days'))}</div>
 <div class="actions separated">${button('toggle',playing?tr(lang,'Ferma simulazione','Pause simulation'):tr(lang,'Simulazione continua','Auto-advance'),playing?'warning':'secondary')}
 ${button('careers',tr(lang,'Le mie carriere','My careers'),'ghost')}</div>
 <p class="muted" role="status">${playing?tr(lang,'Avanzamento automatico attivo','Automatic advancement active'):tr(lang,'Simulazione in pausa','Simulation paused')}</p></section>`;
}
