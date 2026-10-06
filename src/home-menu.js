// UX2-10: Pure main menu rendering. UI-only; no save or storage writes.
// Render from the same verified catalog used by Career Management.
import {esc} from './ui-components.js';

export function menuSnapshot(world,overview){
  const slots=Array.isArray(overview?.slots)?overview.slots:[];
  const active=slots.find(s=>s.id===overview.activeSlotId)||null;
  return {
    slots:slots.length,
    active,
    canContinue:Boolean(world?.clubId&&active?.status==='ok'),
    recent:slots.filter(s=>s.status==='ok').slice(0,3),
  };
}
export function renderHomeMenu(world,ui,{languagePicker='' }={}){
  const en=ui.language==='en',tr=(it,english)=>en?english:it;
  const {slots,active,canContinue,recent}=menuSnapshot(world,ui.careers);
  const settings=ui.page==='home-settings';
  const option=(action,label,description,{primary=false,disabled=false}={})=>`<button type="button" data-action="${action}" class="fa-menu-option ${primary?'fa-menu-primary':''}"${disabled?' disabled':''}><span class="fa-menu-option-text"><strong>${esc(label)}</strong><small>${esc(description)}</small></span><span aria-hidden="true">→</span></button>`;
  const activeText=active?`${esc(active.name||'')} · ${esc(active.clubName||tr('Club da scegliere','Club not selected'))} · ${tr('Stagione','Season')} ${Number(active.season)||1}`:'';
  const recentHtml=recent.map(slot=>`<li><span>${esc(slot.name)}</span><small>${esc(slot.clubName||tr('Club da scegliere','Club not selected'))}</small></li>`).join('');
  return `<div class="fa-main-menu">
    <a class="skip-link" href="#main-content">${tr('Vai al contenuto','Skip to content')}</a>
    <header class="fa-menu-header"><span class="fa-menu-wordmark">FOOTBALL <b>ARCHITECT</b><small>2.0 · ${tr('Universo calcistico','Football universe')}</small></span><div class="fa-menu-header-actions">${languagePicker}</div></header>
    <main class="fa-menu-main" id="main-content" tabindex="-1">${settings?`
      <div class="fa-menu-intro"><span class="overline">${tr('PREFERENZE','PREFERENCES')}</span><h1 id="home-title" tabindex="-1">${tr('Impostazioni','Settings')}</h1><p>${tr('La lingua si applica subito. Tutte le carriere sono salvate localmente nel browser.','Language changes apply immediately. All careers are stored locally in your browser.')}</p></div>
      <section class="fa-menu-panel" aria-label="${tr('Preferenze del gioco','Game preferences')}"><h2>${tr('Lingua e dati locali','Language and local data')}</h2><p>${tr('La lingua può essere modificata dal selettore in alto. Per gestire i backup apri Gestione carriere.','Change language in the selector above. Use Manage careers for backup and restore.')}</p>${option('menu-manage',tr('Gestione carriere e backup','Careers and backups'),tr('Esporta, importa e proteggi i salvataggi','Export, import and protect saves'))}${canContinue?option('menu-open-settings',tr('Impostazioni della carriera','Career settings'),tr('Apri le impostazioni del gioco attivo','Open the active career settings')):''}</section>
      <div class="fa-menu-footer"><button class="btn btn-quiet" data-action="menu-home">${tr('← Torna al menu','← Back to menu')}</button></div>`:`
      <div class="fa-menu-intro"><span class="overline">${tr('IL TUO CALCIO. LE TUE SCELTE.','YOUR FOOTBALL. YOUR CHOICES.')}</span><h1 id="home-title" tabindex="-1">${tr('Benvenuto in Football Architect','Welcome to Football Architect')}</h1><p>${tr('Crea una storia, continua la tua carriera oppure gestisci i salvataggi locali.','Start a new story, continue your career or manage local saves.')}</p></div>
      <div class="fa-menu-columns"><section class="fa-menu-panel fa-menu-actions" aria-label="${tr('Azioni principali','Main actions')}"><h2>${tr('Inizia a giocare','Start playing')}</h2>
      ${option('menu-continue',tr('Continua partita','Continue game'),active?tr('Riprendi la carriera attiva','Resume your active career'):tr('Nessuna carriera avviata','No active career'),{primary:true,disabled:!canContinue})}
      ${option('menu-new',tr('Nuova carriera','New career'),tr('Crea uno slot indipendente','Create a separate save slot'))}
      ${option('menu-load',tr('Carica carriera','Load career'),tr('Scegli tra i salvataggi disponibili','Choose from available saves'),{disabled:slots===0})}
      ${option('menu-import',tr('Importa backup JSON','Import JSON backup'),tr('Verifica il file prima di importarlo','Validate the file before importing'))}
      ${option('menu-manage',tr('Gestione carriere','Manage careers'),tr('Slot, checkpoint, esportazioni e ripristino','Slots, checkpoints, export and recovery'))}
      ${option('menu-settings',tr('Impostazioni','Settings'),tr('Lingua e dati locali','Language and local data'))}
      <input type="file" id="home-import-file" accept=".json,application/json" hidden aria-label="${tr('Seleziona un salvataggio JSON','Select a JSON backup')}" /></section>
      <aside class="fa-menu-panel fa-menu-overview" aria-label="${tr('Riepilogo carriere','Career overview')}"><span class="overline">${tr('SALVATAGGI LOCALI','LOCAL SAVES')}</span><h2>${tr('Le tue carriere','Your careers')}</h2><p class="fa-menu-count">${slots}</p>${active?`<p class="fa-menu-active"><strong>${tr('Ultima carriera attiva','Last active career')}</strong><br>${activeText}</p>`:`<p>${tr('Nessuna carriera salvata. Crea una nuova carriera per iniziare.','No saved careers. Create a new one to get started.')}</p>`}
      ${recentHtml?`<ul class="fa-menu-recent">${recentHtml}</ul>`:''}<p class="fa-menu-note">${tr('I salvataggi IndexedDB restano nel profilo browser corrente. Esporta periodicamente un backup JSON.','IndexedDB saves stay in this browser profile. Export JSON backups regularly.')}</p></aside></div>`}
    </main><footer class="fa-menu-bottom">FOOTBALL ARCHITECT · ${tr('Offline · Nessun account richiesto','Offline · No account required')}</footer></div>`;
}
