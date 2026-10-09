import {LEAGUES,getLeagueClubs,leagueById} from './leagues.js';
import {seasonLabel} from './simulation.js';
import {bestCareer} from './career-store.js';
import {icon} from './icons.js';
import {languagePicker} from './language-picker.js';
import {renderFeedback} from './feedback.js';
export const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const tr=(lang,it,en)=>lang==='en'?en:it;
const fmtDate=(value,lang,clock=false)=>{
 if(!value)return '—';
 const d=new Date(clock?value:value+'T12:00:00Z');
 return Number.isFinite(d.getTime())?new Intl.DateTimeFormat(lang==='en'?'en-GB':'it-IT',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC',...(clock?{hour:'2-digit',minute:'2-digit'}:{})}).format(d):'—';
};
const club=(country,id)=>getLeagueClubs(country).find(x=>x.id===id);
const crest=c=>c?`<span class="crest" style="--club1:${esc(c.colors[0])};--club2:${esc(c.colors[1])}">${esc(c.short)}</span>`:'<span class="crest unknown">?</span>';
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
function wizardFrame(content,lang,step,titleIt,titleEn,descriptionIt,descriptionEn){
 return `<div class="onboarding restored-onboarding wizard-page">
 <div class="onboarding-orb ob-one"></div><div class="onboarding-orb ob-two"></div>
 <div class="onboard-wrap">
  <header class="onboard-header fa-page-heading">
   <span class="pretitle wizard-step-label">${tr(lang,'NUOVA CARRIERA','NEW CAREER')} · ${tr(lang,'PASSAGGIO','STEP')} ${step}/3</span>
   <h1 class="fa-page-title">${tr(lang,titleIt,titleEn)}</h1>
   <p>${tr(lang,descriptionIt,descriptionEn)}</p>
   <div class="wizard-topline">
    ${step>1?button('setup-back',tr(lang,'Indietro','Back'),'ghost wizard-back'):''}
    ${button('cancel-setup',tr(lang,'Annulla','Cancel'),'ghost wizard-cancel')}
   </div>
  </header>
  ${content}
 </div></div>`;
}
export function managerPage(draft,lang){
 const content=`<section class="wizard-manager-panel panel" aria-labelledby="wizard-manager-title">
 <div class="onboard-heading"><h2 id="wizard-manager-title">${tr(lang,'1 · Il tuo allenatore','1 · Your manager')}</h2></div>
 <form id="manager-form" class="onboard-manager-form wizard-manager-form" novalidate>
  <label class="input-label" for="manager-name">${tr(lang,'Nome allenatore','Manager name')}</label>
  <input class="text-field" id="manager-name" name="managerName" maxlength="80" required autocomplete="off"
   value="${esc(draft.managerName)}" aria-invalid="false" aria-describedby="manager-name-error" placeholder="${tr(lang,'Inserisci il nome dell’allenatore','Enter manager name')}">
  <p id="manager-name-error" class="field-error" role="alert" hidden>${tr(lang,'Inserisci un nome per proseguire.','Enter a name to continue.')}</p>
  <button class="btn primary begin-button" type="submit"><span>${tr(lang,'Avanti: Nazione','Next: Country')}</span>${icon('chevron-right',18)}</button>
 </form>

 </section>`;
 return wizardFrame(content,lang,1,'Scegli il tuo allenatore','Choose your manager','Inserisci il nome dell’allenatore per iniziare.','Enter your manager name to get started.');
}
export function countryPage(draft,lang){
 const selected=LEAGUES.some(l=>l.id===draft.countryId)?draft.countryId:null;
 const loc=lang==='en'?'en':'it';
 const content=`<section class="league-pick wizard-country-panel" aria-labelledby="league-pick-title">
  <div class="league-pick-head"><div><span class="eyebrow">${tr(lang,'2 · NAZIONE E CAMPIONATO','2 · COUNTRY AND LEAGUE')}</span>
   <h2 id="league-pick-title">${tr(lang,'Scegli dove iniziare','Choose where to start')}</h2></div>
   <span class="league-pick-count">${LEAGUES.length} ${tr(lang,'NAZIONI','COUNTRIES')}</span></div>
  <div class="league-pick-options" role="group" aria-label="${tr(lang,'Nazione','Country')}">
   ${LEAGUES.map(l=>`<button type="button" class="league-pick-option ${l.id===selected?'active':''}"
     data-action="country" data-country="${l.id}" aria-pressed="${l.id===selected}">
     <span class="league-flag country-flag" aria-hidden="true">${esc(l.flag)}</span>
     <span class="league-pick-text"><b>${esc(l.country[loc])}</b><small>${esc(l.competition)}</small></span>
     ${l.id===selected?icon('check',15):''}</button>`).join('')}
  </div>
  <div class="wizard-actions">${button('country-next',tr(lang,'Avanti: Squadra','Next: Club'),'primary',selected?'':'disabled')}</div>
 </section>`;
 return wizardFrame(content,lang,2,'Scegli la nazione','Choose your country','Seleziona la nazione in cui iniziare la carriera.','Select the country where you want to start.');
}
export function teamsPage(draft,lang){
 const league=leagueById(draft.countryId),clubs=getLeagueClubs(league.id),loc=lang==='en'?'en':'it';
 const chosen=clubs.find(c=>c.id===draft.clubId)??null;
 const content=`<div class="onboard-grid wizard-team-grid">
  <section class="onboard-clubs" aria-labelledby="clubs-title">
   <div class="onboard-heading"><h2 id="clubs-title">${tr(lang,'3 · Scegli il club','3 · Choose your club')}</h2>
    <span>${clubs.length} ${tr(lang,'SOCIETÀ','CLUBS')}</span></div>
    <table class="club-table" id="clubs" aria-label="${tr(lang,'Squadre disponibili','Available clubs')}">
     <thead><tr>
      <th scope="col">${tr(lang,'Squadra','Club')}</th>
      <th scope="col" class="club-table-city">${tr(lang,'Città','City')}</th>
      <th scope="col" class="club-table-founded">${tr(lang,'Fondazione','Founded')}</th>
      <th scope="col" class="club-table-status">${tr(lang,'Scelta','Selection')}</th>
     </tr></thead>
     <tbody>${clubs.map(c=>`<tr class="club-table-row ${c.id===chosen?.id?'is-selected':''}" data-action="select" data-id="${c.id}">
       <td><button type="button" class="club-table-select" data-action="select" data-id="${c.id}" aria-pressed="${c.id===chosen?.id}" aria-label="${tr(lang,'Seleziona','Select')} ${esc(c.name)}">
        ${crest(c)}<span class="club-table-name"><strong>${esc(c.name)}</strong><small>${esc(c.city)}</small></span></button></td>
       <td class="club-table-city">${esc(c.city)}</td>
       <td class="club-table-founded">${c.founded}</td>
       <td class="club-table-status"><span class="club-table-indicator" aria-hidden="true">${c.id===chosen?.id?icon('check',16):icon('chevron-right',16)}</span></td>
      </tr>`).join('')}</tbody>
    </table>
  </section>
   <aside class="onboard-aside wizard-club-summary">
   ${chosen?`    <div class="selected-club-glow" style="--club-light:${esc(chosen.colors[0])}"></div>
    <div class="selected-pretitle">${tr(lang,'CLUB SELEZIONATO','SELECTED CLUB')}</div>
    <div class="selected-crest">${crest(chosen)}</div>
    <h2>${esc(chosen.name)}</h2>
    <p class="selected-city">${esc(chosen.city)} · ${esc(league.country[loc])} · ${tr(lang,'Fondato nel','Founded')} ${chosen.founded}</p>
    <p class="selected-competition">${esc(league.competition)}</p>
    <div class="selected-stats">
      <div><span>${tr(lang,'REPUTAZIONE','REPUTATION')}</span><strong>${chosen.reputation}<small>/100</small></strong></div>
      <div><span>${tr(lang,'STADIO','STADIUM')}</span><strong>${(chosen.capacity/1000).toFixed(1)}k</strong></div>
      <div><span>${tr(lang,'CITTÀ','CITY')}</span><strong class="selected-stat-city">${esc(chosen.city)}</strong></div>
    </div>
`:`<div class="wizard-no-club">
     <div class="selected-pretitle">${tr(lang,'CLUB SELEZIONATO','SELECTED CLUB')}</div>
     <div class="wizard-empty-icon">${icon('shield',26)}</div>
     <h2>${tr(lang,'Seleziona una squadra','Select a club')}</h2>
     <p>${tr(lang,'Scegli una delle squadre nella tabella per proseguire.','Choose a club in the table to continue.')}</p>
    </div>`}
    <div class="wizard-manager-summary"><span>${tr(lang,'ALLENATORE','MANAGER')}</span><strong>${esc(draft.managerName)}</strong></div>
    ${button('start-career',tr(lang,'Inizia carriera','Start career'),'primary begin-button',chosen?'':'disabled')}
    <p class="hint">${tr(lang,'Il salvataggio verrà creato solo dopo questa conferma.','Your save is created only after confirming this step.')}</p>
   </aside>
 </div>`;
 return wizardFrame(content,lang,3,'Scegli la squadra','Choose your club',
  'Seleziona una squadra per completare la configurazione.','Select a club to finish setup.');
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
