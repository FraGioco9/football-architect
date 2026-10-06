// UX2-10 / UX #20 00A: Pure main menu rendering. UI-only; no save or storage writes.
// Render from the same verified catalog used by Career Management.
import {esc} from './ui-components.js';
import {formatCareerDate} from './domain/career-date.js';

export function menuSnapshot(world,overview){
  const slots=Array.isArray(overview?.slots)?overview.slots:[];
  const active=slots.find(slot=>slot.id===overview?.activeSlotId)||null;
  return {
    active,
    canContinue:Boolean(world?.clubId&&active?.status==='ok'),
  };
}
function formatLastSaved(value,language){
  if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return '—';
  return new Intl.DateTimeFormat(language==='en'?'en-GB':'it-IT',{
    day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',
    hour12:false,timeZone:'UTC'
  }).format(new Date(value));
}
export function renderHomeMenu(world,ui,{languagePicker='' }={}){
  const en=ui.language==='en',tr=(it,english)=>en?english:it;
  const {active,canContinue}=menuSnapshot(world,ui.careers);
  const settings=ui.page==='home-settings';
  const option=(action,label,description,{primary=false,disabled=false}={})=>`<button type="button" data-action="${action}" class="fa-menu-option ${primary?'fa-menu-primary':''}"${disabled?' disabled':''}><span class="fa-menu-option-text"><strong>${esc(label)}</strong><small>${esc(description)}</small></span><span aria-hidden="true">→</span></button>`;
  const activeSummary=canContinue?`<section class="fa-menu-active-summary" aria-label="${tr('Ultima carriera','Last career')}">
    <div class="fa-menu-active-heading"><span class="overline">${tr('ULTIMA CARRIERA','LAST CAREER')}</span><strong>${esc(active.name||active.clubName||tr('Carriera','Career'))}</strong></div>
    <dl class="fa-menu-active-meta">
      <div><dt>${tr('Allenatore','Manager')}</dt><dd>${esc(active.manager||tr('Allenatore','Manager'))}</dd></div>
      <div><dt>Club</dt><dd>${esc(active.clubName||tr('Da scegliere','Not selected'))}</dd></div>
      <div><dt>${tr('Stagione','Season')}</dt><dd>${Number(active.season)||1}</dd></div>
      <div><dt>${tr('Data di gioco','Game date')}</dt><dd>${esc(formatCareerDate(world.currentDate,ui.language))}</dd></div>
      <div><dt>${tr('Ultimo salvataggio','Last save')}</dt><dd>${esc(formatLastSaved(active.lastSavedAt,ui.language))}</dd></div>
    </dl>
  </section>`:'' ;
  return `<div class="fa-main-menu">
    <a class="skip-link" href="#main-content">${tr('Vai al contenuto','Skip to content')}</a>
    <header class="fa-menu-header"><span class="fa-menu-wordmark">FOOTBALL <b>ARCHITECT</b><small>2.0 · ${tr('Universo calcistico','Football universe')}</small></span><div class="fa-menu-header-actions">${languagePicker}</div></header>
    <main class="fa-menu-main" id="main-content" tabindex="-1">${settings?`
      <div class="fa-menu-intro"><span class="overline">${tr('PREFERENZE','PREFERENCES')}</span><h1 id="home-title" tabindex="-1">${tr('Impostazioni','Settings')}</h1><p>${tr('La lingua si applica subito. Tutte le carriere sono salvate localmente nel browser.','Language changes apply immediately. All careers are stored locally in your browser.')}</p></div>
      <section class="fa-menu-panel" aria-label="${tr('Preferenze del gioco','Game preferences')}"><h2>${tr('Lingua e dati locali','Language and local data')}</h2><p>${tr('La lingua può essere modificata dal selettore in alto. Per gestire i backup apri Gestione carriere.','Change language in the selector above. Use Manage careers for backup and restore.')}</p>${option('menu-manage',tr('Gestione carriere e backup','Careers and backups'),tr('Esporta, importa e proteggi i salvataggi','Export, import and protect saves'))}${canContinue?option('menu-open-settings',tr('Impostazioni della carriera','Career settings'),tr('Apri le impostazioni del gioco attivo','Open the active career settings')):''}</section>
      <div class="fa-menu-footer"><button class="btn btn-quiet" data-action="menu-home">${tr('← Torna al menu','← Back to menu')}</button></div>`:`
      <div class="fa-menu-intro"><span class="overline">${tr('IL TUO CALCIO. LE TUE SCELTE.','YOUR FOOTBALL. YOUR CHOICES.')}</span><h1 id="home-title" tabindex="-1">${tr('Benvenuto in Football Architect','Welcome to Football Architect')}</h1><p>${tr('Crea una storia o riprendi quella attiva. Gestione salvataggi e preferenze restano nelle rispettive pagine.','Start a new story or resume the active one. Save management and preferences stay in their dedicated pages.')}</p></div>
      <div class="fa-menu-stack">
        ${activeSummary}
        <section class="fa-menu-panel fa-menu-actions" aria-label="${tr('Azioni principali','Main actions')}"><h2>${tr('Inizia a giocare','Start playing')}</h2>
          ${option('menu-continue',tr('Continua','Continue'),active?tr('Riprendi la carriera attiva','Resume the active career'):tr('Nessuna carriera attiva','No active career'),{primary:canContinue,disabled:!canContinue})}
          ${option('menu-new',tr('Nuova carriera','New career'),tr('Crea una nuova storia','Start a new story'))}
          ${option('menu-manage',tr('Carriere','Careers'),tr('Slot, importazione, esportazione e backup','Slots, import, export and backups'))}
          ${option('menu-settings',tr('Impostazioni','Settings'),tr('Lingua e preferenze globali','Language and global preferences'))}
        </section>
      </div>`}
    </main><footer class="fa-menu-bottom">FOOTBALL ARCHITECT · ${tr('Offline · Nessun account richiesto','Offline · No account required')}</footer></div>`;
}
