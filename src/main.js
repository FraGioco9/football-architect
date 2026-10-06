import {readPrefs,writePrefs,moveWidget,applyTableView,PAGES} from './qol03.js';
import {makeWorld,FORMATIONS} from './data.js';
import {leagueById} from './leagues.js';
import {view} from './ui.js';
import {generateMatchActions} from './domain/match-actions.js';
import {hasAdvancedCareer,setAdvancedStyle,editAdvancedTactic,setAdvancedPlayerRole,previewAdvancedHalf} from './domain/advanced-career.js';
import {substitutionsEnabled,planCareerSubstitution,cancelCareerSubstitution,setCareerMatchdayRules,expectedNextMatch} from './domain/career-matchday.js';
import {setCareerSlotRole,resetCareerRoleFormation} from './domain/career-roles.js';
import {saveCareerTacticPreset,duplicateCareerTacticPreset,editCareerTacticPreset,clearCareerTacticPlans,deleteCareerTacticPreset,applyCareerTacticPreset,planCareerTacticChange,cancelCareerTacticChange} from './domain/career-tactics.js';
import {hasCareerTraining,configureCareerSession,configureCareerIndividual,delegateCareerTraining,syncCareerTrainingFormation} from './domain/career-training.js';
import {promoteCareerProspect,configureCareerAcademy} from './domain/career-youth.js';
import {marketEnabled,marketValuation,marketExistingWageEUR,marketClubDecision,managedClubKey,marketPlayers,createCareerQuote,startMarketDeal,answerMarketClub,proposeMarketTerms,answerMarketPlayer,completeMarketDeal} from './domain/career-market.js';
import {calendarEnabled,bookCareerTransfer,cancelCareerBooking,releaseCareerFreeAgent,signCareerFreeAgent,previewCalendarAdvance} from './domain/career-calendar.js';
import {assignScoutingMission,cancelScoutingMission,shortlistScoutedPlayer,refreshScoutingReport} from './domain/career-scouting.js';
import {settleCupCredits} from './domain/career-cups.js';
import {settleContinentalCredits} from './domain/career-continental.js';
import {negotiateBoardGoals,acceptBoardJob,endBoardCareer,boardStatus} from './domain/career-board.js';
import {managerCareerEnabled,applyManagerJob,negotiateManagerOffer,decideManagerOffer,registerBoardAppointment,registerManagerRetirement} from './domain/career-manager.js';
import {financeEnabled,reconcileCareerFinance,configureCareerFinanceBudget,financeCanCommit} from './domain/career-finance.js';
import {contractsEnabled,syncCareerContracts,proposeCareerRenewal,respondCareerRenewal,decideCareerCounter} from './domain/career-contracts.js';
import {facilityEnabled,hireCareerStaff,delegateCareerStaff,planFacilityProject,decideFacilityProject} from './domain/career-facilities.js';
import {createMatchPlayback,advanceMatchPlayback,finishMatchPlayback,setMatchPlaybackPaused,setMatchPlaybackSpeed,matchPlaybackSnapshot} from './match-playback.js';
import {matchPreviewStatus} from './match-preview-ui.js';
import {loadStoredMatchPreview,startStoredMatchPreview,saveStoredMatchPreviewProgress,discardStoredMatchPreview} from './match-preview-storage.js';
import {enhanceDesignSystem} from './design-system.js';
import {isNavigationPage} from './navigation-model.js';
import {createControlHints} from './controls-system.js';
import {createDialogCoordinator} from './dialog-system.js';
import {createFeedbackCenter} from './feedback-system.js';
import {ensureCareerDates,fixtureIsDue,nextFixtureDate,addDaysISO,formatCareerDate} from './domain/career-date.js';
import {ensureOfficialCareerSystems,officialCareerSystemsReady} from './domain/career-official.js';
import {MARKET_VIEWS,marketCostPreview} from './market-view-model.js';
import {displayCareerMoney} from './domain/career-locale.js';
import {preferredLanguage, saveLanguage, translateUi, translate, pageTitle, GAME_NAME} from './i18n.js';
import {CAREER_STORAGE_KEY,PREVIOUS_CAREER_STORAGE_KEY,LEGACY_CAREER_STORAGE_KEY,persistCareer,parseCareerJson} from './storage.js';
import {CAREER_CATALOG_KEY,readCareerCatalog} from './career-catalog.js';
import {loadActiveCareer,migrateCurrentCareerToSlot,saveCareerToSlot} from './career-slots.js';
import {listCareerSlots,switchCareerSlot,renameCareerSlot,duplicateCareerSlot,deleteCareerSlot,createFreshCareerSlot} from './career-management.js';
import {createCareerCheckpoint,listCareerCheckpoints,restoreCareerCheckpoint} from './career-checkpoints.js';
import {exportCareerSlotJson,exportAllCareersJson,previewCareerImport,applyCareerImport,listImportBackups,restoreImportBackup,MAX_TRANSFER_BYTES} from './career-transfer.js';
import {createIndexedDbVault,mirrorCatalogToVault,estimateCareerStorage,createEmergencyExport,readVerifiedVaultSlot,restoreSlotFromVault} from './career-vault.js';
import {openPrimaryCareerStorage} from './primary-career-storage.js';
import {validateSave,startCareer,advanceDay,simulateRound,changeFormation,autoLineup,assignPlayer,signPlayer,sellPlayer,newSeason,clubPlayers,playerById,clubById,myClub} from './engine.js';
// Boot is deliberately asynchronous: never render a writable world until
// the authoritative IndexedDB snapshot has been verified and hydrated.
const primary=await openPrimaryCareerStorage({legacyStorage:window.localStorage,validate:validateSave}).catch(error=>{
  // Fail closed but allow users to download the original legacy bytes.
  const app=document.getElementById('app');app.replaceChildren();
  const pane=document.createElement('main');pane.style='max-width:720px;margin:12vh auto;padding:24px';
  const title=document.createElement('h1');title.textContent='Archivio IndexedDB da verificare / Career storage needs attention';
  const details=document.createElement('p');details.textContent=error.message||'IndexedDB non disponibile';
  const backup=document.createElement('button');backup.textContent='Esporta dati legacy / Export legacy data';backup.type='button';
  backup.onclick=()=>{
    const entries=[];for(let i=0;i<window.localStorage.length;i++){
      const key=window.localStorage.key(i);
      if(/^(football-architect:(career:|match-preview:)|touchline-dynasty:career:|lega-aurora-manager:career:)/.test(key))entries.push([key,window.localStorage.getItem(key)]);
    }
    const url=URL.createObjectURL(new Blob([JSON.stringify({format:'football-architect-original-legacy-keys',entries},null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='football-architect-legacy-emergency.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
  };
  pane.append(title,details,backup);app.append(pane);throw error;
});
const careerStorage=primary.storage;
const STORAGE_KEY=CAREER_STORAGE_KEY;
let previewTimer=null;
function stopPreviewTimer(){if(previewTimer!==null){clearInterval(previewTimer);previewTimer=null;}}
const root=document.getElementById('app');
let blockedSaveError=null;
let emergencyWorldRaw=null;
let vaultSync=Promise.resolve();
const careerVault=createIndexedDbVault();
let pendingNewCatalogSlot=false;
let world=load();
ensureCareerDates(world);
const officialSystemMigration=world.clubId?ensureOfficialCareerSystems(world):{changed:false,enabled:[],status:null};
// The startup v1->slot migration is not complete until this commit succeeds.
await primary.commit();
let ui={matchPreview:null,previewRecoveryError:null,previewSaved:false,language:preferredLanguage(),page:'home',chosenClub:1,managerDraft:'',squadSearch:'',squadFilter:'ALL',squadAvailability:'all',squadSort:'Ruolo',squadAttribute:'ALL',squadMinimum:1,comparePlayerId:null,marketSearch:'',marketPosition:'ALL',marketCountry:'ALL',marketOnlyWatched:false,marketTab:'explore',tacticsTab:'formation',scoutSearch:'',scoutCountry:'ALL',scoutPosition:'ALL',scoutShortlistOnly:false,advancedTab:'players',worldCountry:null,worldClub:null,worldPlayer:null,worldHistorySeason:null,advancedPlayerId:null,calendarRound:null,sidebarOpen:false,navOpenGroups:{},modal:null,openMail:null,careers:null,checkpoints:[],importPreview:null,importMode:'add',importTarget:'',importCatalogRaw:null,importBackups:[],vaultState:'pending',vaultIds:[],storageWarning:null,storageEstimate:null};
// Each slot owns its own optional, immutable replay. The career JSON is never
// changed by a preview. Restoring always starts in pause mode.
function activePreviewSlot(){return readCareerCatalog(careerStorage).activeSlotId;}
function restorePendingPreview({open=true}={}){
  ui.previewRecoveryError=null;ui.previewSaved=false;ui.matchPreview=null;
  // The legacy replay belongs to the old instant-result engine. An opted-in
  // career must never reopen it in place of the authoritative advanced match.
  if(blockedSaveError||!world.clubId||hasAdvancedCareer(world))return;
  try{
    const slot=activePreviewSlot();if(!slot)return;
    const state=loadStoredMatchPreview(careerStorage,slot,world);
    ui.previewSaved=!!state;
    if(state&&open){ui.matchPreview=state;ui.page='match-preview';}
  }catch(err){ui.previewRecoveryError=err;}
}
const feedback=createFeedbackCenter(document,{language:()=>ui.language});
if(officialSystemMigration.changed&&!blockedSaveError){
  if(!officialCareerSystemsReady(world))throw new Error('CORE_OFFICIAL_SYSTEM_MIGRATION_INCOMPLETE');
  if(!save())throw new Error('CORE_OFFICIAL_SYSTEM_MIGRATION_SAVE_FAILED');
  await primary.commit();
}
restorePendingPreview({open:false});
let searchTimer;
let qol03Trail=[];
let qol03SkipHistory=false;
function qol03Scope(){return String(activePreviewSlot()||'local');}
function qol03Load(){ui.qol03=readPrefs(window.localStorage,qol03Scope());return ui.qol03;}
function qol03Save(){return writePrefs(window.localStorage,qol03Scope(),ui.qol03);}
function qol03TablePref(id){return ui.qol03.tables[id]||(ui.qol03.tables[id]={query:'',sort:null,desc:false,page:0});}

// QOL05.10: desktop sidebar is persistent; mobile drawer must be modal for keyboard focus.
const drawerQuery=window.matchMedia('(max-width:1000px)');
function syncDrawerAccess(){
  const sidebar=root.querySelector('#club-sidebar');
  const main=root.querySelector('.main-area');
  if(!sidebar||!main){document.body.classList.remove('navigation-drawer-open');return;}
  const open=drawerQuery.matches&&ui.sidebarOpen;
  sidebar.inert=drawerQuery.matches&&!open;
  main.inert=open;
  document.body.classList.toggle('navigation-drawer-open',open);
  // Clear a stale drawer state if a viewport changes to desktop.
  if(!drawerQuery.matches&&ui.sidebarOpen){ui.sidebarOpen=false;root.querySelector('.app-shell')?.classList.remove('sidebar-open');}
  const trigger=root.querySelector('[data-action="toggle-sidebar"]');
  if(trigger){trigger.setAttribute('aria-expanded',String(open));trigger.setAttribute('aria-label',ui.language==='en'?(open?'Close menu':'Open menu'):(open?'Chiudi menu':'Apri menu'));}
}
function toggleDrawer(open){
  ui.sidebarOpen=open;render();
  if(drawerQuery.matches){
    if(open)(root.querySelector('#club-sidebar .nav-item.active')||root.querySelector('#club-sidebar .sidebar-dismiss'))?.focus({preventScroll:true});
    else root.querySelector('[data-action="toggle-sidebar"]')?.focus({preventScroll:true});
  }
}
function focusPage(){root.querySelector('#main-content')?.focus({preventScroll:true});}
drawerQuery.addEventListener?.('change',syncDrawerAccess);
function load(){
  try{
    const stored=loadActiveCareer(careerStorage,validateSave,makeWorld);
    // Migration is idempotent. Never continue with write-enabled gameplay if
    // the current legacy career could not be copied and verified first.
    migrateCurrentCareerToSlot(careerStorage,validateSave);
    // Unstarted v1.2 previews can safely be regenerated; preserve started legacy careers.
    return !stored.clubId&&(stored.teams.length!==20||!stored.countryId)
      ? makeWorld(stored.seed,stored.countryId||'IT') : stored;
  }catch(err){
    if(!['unsupported_version','unsupported_catalog_version','invalid_catalog','missing_slot','invalid_slot','slot_conflict','slot_write_failed','catalog_write_failed','catalog_conflict','migration_required','migration_conflict','migration_write_failed'].includes(err?.code)&&!['QuotaExceededError','SecurityError'].includes(err?.name))throw err;
    // Never automatically replace a save made by a newer version of the game.
    blockedSaveError=err;
    return makeWorld();
  }
}
function readableStorageError(err){
  const byCode={
    invalid_json:'Il JSON del salvataggio non è valido.',
    invalid_save:'Il file non contiene un salvataggio valido e compatibile.',
    unsupported_version:'Salvataggio creato con una versione più recente. Aggiorna Football Architect prima di continuare.',
    invalid_backup:'Impossibile creare il backup originale.',
    backup_failed:'Backup non verificato. La carriera attuale non è stata sostituita.',
    missing_backup:'Il backup richiesto non è disponibile.',
    write_failed:'Il salvataggio non è stato verificato.',
    invalid_catalog:'Il catalogo delle carriere non è valido: esporta un backup prima di intervenire.',
    unsupported_catalog_version:'Il catalogo appartiene a una versione più recente.',
    catalog_write_failed:'Il catalogo delle carriere non è stato verificato.',
    catalog_id_failed:'Impossibile assegnare un identificativo alla carriera.',
    catalog_full:'Il catalogo delle carriere è pieno.',
    catalog_save_mismatch:'Il catalogo non corrisponde al salvataggio corrente.',
    missing_slot:'Lo slot attivo non è disponibile. I vecchi salvataggi sono stati conservati.',
    invalid_slot:'Lo slot attivo contiene dati non validi.',
    slot_conflict:'Uno slot preesistente contiene dati differenti e non verrà sovrascritto.',
    slot_write_failed:'La copia dello slot non è stata verificata.',
    catalog_conflict:'Il catalogo è cambiato durante il salvataggio.',
    migration_required:'Prima di continuare occorre completare la migrazione del salvataggio.',
    migration_conflict:'La migrazione interrotta richiede una verifica prima del recupero.',
    migration_write_failed:'Il registro di migrazione non può essere verificato.',
    invalid_slot_name:'Il nome dello slot non è valido.',
    delete_failed:'Impossibile verificare l’eliminazione dello slot.',
    checkpoint_index_invalid:'L’indice dei checkpoint è danneggiato. Esporta la carriera prima di intervenire.',
    checkpoint_index_future:'I checkpoint provengono da una versione più recente.',
    checkpoint_write_failed:'Checkpoint non verificato: operazione annullata.',
    checkpoint_too_large:'Spazio insufficiente per i checkpoint. Esporta o libera spazio.',
    missing_checkpoint:'Punto di ripristino non trovato.',
    invalid_checkpoint:'Punto di ripristino danneggiato.',
    rollback_failed:'Il recupero automatico non è riuscito. Il checkpoint di sicurezza è stato conservato.',
    archive_checksum:'Controllo integrità del file fallito. Nessun dato importato.',
    unsupported_archive:'Archivio creato con una versione futura o formato non riconosciuto.',
    invalid_archive:'L’archivio di carriere non è valido.',
    archive_too_large:'L’archivio supera il limite di 128 MB.',
    import_target_missing:'La carriera da sostituire non è disponibile. Nessun dato modificato.',
    import_rollback_failed:'Ripristino incompleto: usa i backup conservati prima di continuare.',
    vault_unavailable:'IndexedDB non disponibile: esporta un backup JSON su disco.',
    vault_corrupt:'Il backup IndexedDB è danneggiato. Non è stato usato.',
    vault_missing:'Nessuna copia IndexedDB presente per questa carriera.',
    vault_write_failed:'La copia IndexedDB non è stata verificata.',
    vault_orphan:'Copia IndexedDB non collegata al catalogo.',
    vault_future:'Copia IndexedDB creata da una versione futura: non verrà modificata.',
    vault_newer:'La copia IndexedDB è più recente: esporta o recupera la copia, senza sovrascriverla.',
  };
  return translate(byCode[err?.code]||err?.message||'Si è verificato un errore.',ui.language);
}
function save(){
  if(blockedSaveError)return false;
  try{
    if(financeEnabled(world))reconcileCareerFinance(world,{reason:'external'});
    world.updatedAt=new Date().toISOString();
    // A verified physical slot is authoritative. The catalogue is committed
    // before the legacy mirror; old branded saves remain untouched.
    saveCareerToSlot(careerStorage,world,validateSave,{newCareer:pendingNewCatalogSlot});
    pendingNewCatalogSlot=false;
    // The original flat mirror is for v1 engines that cannot interpret an
    // advanced match/medical profile. After explicit opt-in, keep that legacy
    // snapshot untouched. The verified physical slot is authoritative; a full
    // second copy would consume careerStorage quota and stop a 38-round season.
    // Complete, fresh advanced careers remain exportable from the slot / IDB.
    if(!hasAdvancedCareer(world)){
      persistCareer(careerStorage,world,validateSave);
      if(careerStorage.getItem(STORAGE_KEY)!==JSON.stringify(world)){
        throw new Error('Copia di compatibilità del salvataggio non verificata. Lo slot principale è al sicuro.');
      }
    }
    // Durable commit is awaited by the enclosing interaction, not by this
    // legacy synchronous save facade.
    return true;
  }catch(err){
    emergencyWorldRaw=JSON.stringify(world);
    primary.rollback();
    try{world=loadActiveCareer(careerStorage,validateSave,makeWorld);}catch{}
    ui.storageWarning=(err?.name==='QuotaExceededError'||err?.code==='checkpoint_too_large'?'Spazio insufficiente per salvare. Esporta subito una copia di emergenza. ':'Errore nel salvataggio. Esporta una copia di emergenza. ')+(err?.message||'');
    console.warn('Impossibile salvare la carriera:',err);
    reportError(readableStorageError(err));
    return false;
  }
}
async function migrateActiveCareerSystems(){
  ensureCareerDates(world);
  if(!world.clubId)return {changed:false,enabled:[]};
  const migration=ensureOfficialCareerSystems(world);
  if(!migration.changed)return migration;
  if(!officialCareerSystemsReady(world))throw new Error('CORE_OFFICIAL_SYSTEM_MIGRATION_INCOMPLETE');
  if(!save())throw new Error('CORE_OFFICIAL_SYSTEM_MIGRATION_SAVE_FAILED');
  await primary.commit();
  return migration;
}
function updateFieldShell(input){
  const shell=input.closest('.field-shell');
  if(shell)shell.dataset.hasValue=input.value.length?'true':'false';
}
function scheduleSearchRender(input){
  const id=input.id;
  if(id!=='squad-search'&&id!=='market-search'&&id!=='scout-search')return;
  ui[id==='squad-search'?'squadSearch':id==='scout-search'?'scoutSearch':'marketSearch']=input.value;
  const focus={id,start:input.selectionStart,end:input.selectionEnd};
  clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>{
    // Do not steal focus from another control after navigation or an IME update.
    if(input.isConnected&&document.activeElement===input)render({focus});
  },160);
}
function clearField(id){
  const input=document.getElementById(id);
  if(!input||input.disabled)return;
  clearTimeout(searchTimer);
  input.value='';
  input.dispatchEvent(new Event('input',{bubbles:true}));
  if(id==='career-name'){input.removeAttribute('aria-invalid');const err=document.getElementById('career-name-error');if(err)err.hidden=true;}
  input.focus();
  if(id==='squad-search'||id==='market-search'||id==='scout-search'){
    clearTimeout(searchTimer);
    render({focus:{id,start:0,end:0}});
  }
}
const dialogCoordinator=createDialogCoordinator(root,document,()=>{ui.modal=null;render();});
const controlHints=createControlHints(root,document);
function render({focus}={}){
  const previousDialog=dialogCoordinator.beforeRender();
  let y=window.scrollY;
  if(ui.page==='careers'&&ui.modal?.type==='career-checkpoints'){
    try{ui.checkpoints=listCareerCheckpoints(careerStorage,ui.modal.id,validateSave);}catch(err){ui.checkpoints=[];ui.checkpointError=readableStorageError(err);}
  }
  if(['careers','home','home-settings'].includes(ui.page)){
    try{ui.careers=listCareerSlots(careerStorage,validateSave);}catch(err){
      blockedSaveError=blockedSaveError||err;ui.page='dashboard';
    }
  }
  if(blockedSaveError&&ui.page!=='careers'){
    const english=ui.language==='en';
    root.innerHTML=`<main style="max-width:680px;margin:12vh auto;padding:24px"><div class="panel" style="padding:30px">
      <h1>${english?'Career storage needs attention':'Salvataggio carriera da verificare'}</h1>
      <p>${english?'The active career could not be safely loaded or migrated. No original save has been deleted. Export your original JSON before taking further action.':'La carriera attiva non può essere caricata o migrata in sicurezza. Nessun salvataggio originale è stato eliminato. Esporta il JSON prima di procedere.'}</p>
      <p role="alert">${blockedSaveError.code||'storage_error'}</p>
      <button class="btn btn-quiet" data-action="export-emergency">${english?'Emergency export (JSON)':'Esporta emergenza (JSON)'}</button>
      <button class="btn btn-primary" data-action="export-blocked-save">${english?'Download available original JSON':'Scarica JSON originale disponibile'}</button>
      <button class="btn btn-quiet" data-action="open-careers">${english?'Manage careers':'Gestisci carriere'}</button>
    </div></main>`;
    document.documentElement.lang=ui.language;
    document.title=GAME_NAME;
    document.body.classList.remove('navigation-drawer-open');
    dialogCoordinator.afterRender(previousDialog);
    return;
  }
  qol03Load();
  // PLY01.04 filters follow the active career slot, not the authoritative save.
  ui.squadAttribute=ui.qol03.rosterAttribute;
  ui.squadMinimum=ui.qol03.rosterMinimum;
  root.innerHTML=view(world,ui);
  if(ui.previewRecoveryError&&ui.page!=='careers'){
    const banner=document.createElement('div');banner.className='career-warning storage-warning';banner.setAttribute('role','alert');
    const detail=document.createElement('span');
    detail.textContent=ui.language==='en'?'Saved match preview could not be restored. Career data is safe. Discard the preview to begin again.':'Impossibile riprendere l’anteprima salvata. La carriera è al sicuro. Elimina l’anteprima per ricominciare.';
    const button=document.createElement('button');button.type='button';button.className='btn btn-danger';button.dataset.action='preview-discard';
    button.textContent=ui.language==='en'?'Discard broken preview':'Elimina anteprima danneggiata';
    banner.append(detail,button);root.prepend(banner);
  }
  if(ui.storageWarning&&ui.page!=='careers'){const banner=document.createElement('div');banner.className='career-warning storage-warning';banner.setAttribute('role','alert');const detail=document.createElement('span');detail.textContent=ui.storageWarning;const btn=document.createElement('button');btn.type='button';btn.className='btn btn-quiet';btn.dataset.action='export-emergency';btn.textContent=ui.language==='en'?'Emergency export':'Esporta emergenza';banner.append(detail,btn);root.prepend(banner);}
  document.documentElement.lang=ui.language;
  translateUi(root,ui.language);
  feedback.updateLanguage();
  syncDrawerAccess();
  qol03Enhance();
  enhanceDesignSystem(root,ui.language);
  controlHints.enhance();
  dialogCoordinator.afterRender(previousDialog);
  document.title=['home','home-settings'].includes(ui.page)?(ui.language==='en'?'Main menu':'Menu principale')+' · '+GAME_NAME:ui.page==='match-preview'?(ui.language==='en'?'Match preview':'Anteprima partita')+' · '+GAME_NAME:ui.page==='careers'?pageTitle('careers',ui.language):world.clubId?pageTitle(ui.page,ui.language):GAME_NAME;
  if(focus){const input=document.getElementById(focus.id);if(input){input.focus();try{input.setSelectionRange(focus.start,focus.end);}catch{}}}
  window.scrollTo(0,y);
}

function qol03Enhance(){
 if(!world.clubId||['careers','match-preview'].includes(ui.page))return;
 const en=ui.language==='en',main=root.querySelector('#main-content');if(!main)return;
 const crumbs=root.querySelector('.breadcrumb');
 if(crumbs){const back=document.createElement('button');back.type='button';back.className='qol03-back';back.dataset.action='qol03-back';back.textContent=en?'← Back':'← Indietro';back.setAttribute('aria-label',en?'Go to previous page':'Torna alla pagina precedente');crumbs.prepend(back);}
 const shortcuts=document.createElement('nav');shortcuts.className='qol03-shortcuts';shortcuts.setAttribute('aria-label',en?'Quick navigation':'Navigazione rapida');
 for(const [page,it,english] of [['dashboard','Scrivania','Dashboard'],['calendar','Calendario','Calendar'],['league','Classifica','League'],['world','Mondo','World'],['market','Mercato','Market'],['inbox','Posta','Inbox']]){
  const b=document.createElement('button');b.type='button';b.dataset.action='nav';b.dataset.page=page;b.className='qol03-shortcut';b.textContent=en?english:it;const shortcut={dashboard:'1',calendar:'2',league:'3',world:'4',market:'5',inbox:'6'}[page];b.title=(en?'Shortcut: Alt+':'Scorciatoia: Alt+')+shortcut;if(ui.page===page)b.setAttribute('aria-current','page');shortcuts.append(b);
 }
 main.prepend(shortcuts);
 const status=document.createElement('div');status.id='qol03-live';status.className='sr-only';status.setAttribute('role','status');status.setAttribute('aria-live','polite');main.prepend(status);
 if(ui.page==='dashboard'){
  const widgets=new Map([['kpis',main.querySelector('.kpi-grid')],['fixtures',main.querySelector('.dashboard-two:not(.dashboard-two-bottom)')],['results',main.querySelector('.dashboard-two-bottom')]]);
  const holder=document.createElement('div');holder.className='qol03-widgets';main.querySelector('.dashboard-hero')?.after(holder);
  for(const key of ui.qol03.widgets){const el=widgets.get(key);if(!el)continue;el.hidden=ui.qol03.hidden.includes(key);el.dataset.qol03Widget=key;holder.append(el);}
 }
 for(const [i,table] of [...main.querySelectorAll('.data-table')].entries()){
  const scroll=table.closest('.table-scroll');if(!scroll||!table.tBodies.length||!table.tBodies[0].rows.length)continue;
  const id=ui.page+':'+i,pref=qol03TablePref(id);
  const toolbar=document.createElement('div');toolbar.className='qol03-table-toolbar';toolbar.dataset.qol03Table=id;
  const search=document.createElement('input');search.type='search';search.value=pref.query;search.dataset.qol03Search=id;search.placeholder=en?'Filter rows…':'Filtra righe…';search.setAttribute('aria-label',en?'Filter table rows':'Filtra le righe della tabella');toolbar.append(search);
  const select=document.createElement('select');select.dataset.qol03Sort=id;select.setAttribute('aria-label',en?'Sort table by':'Ordina tabella per');
  select.add(new Option(en?'Original order':'Ordine originale',''));
  [...table.querySelectorAll('thead th')].forEach((th,j)=>{const name=th.textContent.trim();if(name)select.add(new Option(name,String(j)));});
  select.value=pref.sort===null?'':String(pref.sort);toolbar.append(select);
  const second=document.createElement('select');second.dataset.qol03Sort2=id;second.setAttribute('aria-label',en?'Second sort criterion':'Secondo criterio di ordinamento');
  second.add(new Option(en?'Second sort':'Secondo ordinamento',''));
  [...table.querySelectorAll('thead th')].forEach((th,j)=>{const name=th.textContent.trim();if(name)second.add(new Option(name,String(j)));});
  second.value=pref.sort2===null?'':String(pref.sort2);toolbar.append(second);
  const desc=document.createElement('button');desc.type='button';desc.className='btn btn-quiet';desc.dataset.action='qol03-sort-direction';desc.dataset.id=id;desc.setAttribute('aria-label',en?'Reverse order':'Inverti ordinamento');desc.textContent=pref.desc?'↓':'↑';toolbar.append(desc);
  const prev=document.createElement('button');prev.type='button';prev.className='btn btn-quiet';prev.dataset.action='qol03-table-prev';prev.dataset.id=id;prev.textContent='‹';prev.setAttribute('aria-label',en?'Previous page':'Pagina precedente');toolbar.append(prev);
  const count=document.createElement('span');count.className='qol03-table-count';count.dataset.qol03Count=id;toolbar.append(count);
  const next=document.createElement('button');next.type='button';next.className='btn btn-quiet';next.dataset.action='qol03-table-next';next.dataset.id=id;next.textContent='›';next.setAttribute('aria-label',en?'Next page':'Pagina successiva');toolbar.append(next);
  scroll.before(toolbar);qol03UpdateTable(id);
 }
}
function qol03UpdateTable(id){
 const holder=[...root.querySelectorAll('[data-qol03-table]')].find(e=>e.dataset.qol03Table===id);if(!holder)return;
 const table=holder.nextElementSibling?.querySelector('table');if(!table)return;
 const pref=qol03TablePref(id),stats=applyTableView(table,pref);if(!stats)return;
 pref.page=stats.page;const count=holder.querySelector('[data-qol03-count]');if(count)count.textContent=`${stats.visible} · ${stats.page+1}/${stats.pages}`;
 holder.querySelector('[data-action="qol03-table-prev"]').disabled=stats.page===0;
 holder.querySelector('[data-action="qol03-table-next"]').disabled=stats.page>=stats.pages-1;
 const live=root.querySelector('#qol03-live');if(live)live.textContent=`${stats.visible} ${ui.language==='en'?'rows':'righe'}`;
}
function toast(message,level='success'){
  feedback.notify(translate(message,ui.language),{level});
}
function reportError(message){toast(message,'error');}
async function changeOfficialTraining(modify){
  if(!hasAdvancedCareer(world))throw new Error('Attiva prima il motore avanzato.');
  const before=world,updated=structuredClone(world);
  try{
    modify(updated);world=updated;
    if(!save())throw new Error('Il salvataggio non è stato verificato.');
    await primary.commit();void queueVaultSync();
    render();toast(ui.language==='en'?'Training updated and saved.':'Allenamento aggiornato e salvato.');
  }catch(error){world=before;primary.rollback();render();throw error;}
}
function refresh(message='') {if(save()){render();if(message)toast(message);}}
// The checkpoint must be verified before a match, transfer or season change.
// On a failed autosave, re-read the authoritative slot rather than showing
// potentially stale, uncommitted world data.
async function runCheckpointed(kind,apply){
  const live=root.querySelector('#qol03-live');if(live)live.textContent=ui.language==='en'?'Saving and validating…':'Salvataggio e verifica in corso…';
  const surface=root.querySelector('#main-content');
  const busy=document.createElement('div');busy.className='qol03-progress';busy.setAttribute('role','status');
  busy.innerHTML=`<span class="qol03-progress-bars" aria-hidden="true"><i></i><i></i></span><strong>${ui.language==='en'?'Processing — do not close the game':'Elaborazione in corso — non chiudere il gioco'}</strong>`;
  if(surface){surface.setAttribute('aria-busy','true');surface.prepend(busy);}
  // Yield a frame before expensive multi-league transactions; never launch detached background work.
  try {
  await new Promise(resolve=>{if(document.visibilityState==='visible'&&typeof requestAnimationFrame==='function')requestAnimationFrame(resolve);else setTimeout(resolve,0);});
  if(blockedSaveError)throw blockedSaveError;
  const catalog=readCareerCatalog(careerStorage),id=catalog.activeSlotId;
  if(!id)throw new Error('Salva prima la carriera per creare un checkpoint.');
  const active=catalog.slots.find(s=>s.id===id);
  if(!active||careerStorage.getItem(active.storageKey)!==JSON.stringify(world))throw new Error('Questa carriera è stata modificata altrove. Ricaricala prima di proseguire.');
  createCareerCheckpoint(careerStorage,id,kind,validateSave);
  // A completed checkpoint must be DURABLE before the match/transfer/season.
  await primary.commit();
  const before=JSON.stringify(world);
  let result;
  try{result=apply();
    if(contractsEnabled(world))syncCareerContracts(world);
    if(financeEnabled(world)&&kind==='before-transfer'){
      const s=world.advancedV1.financeV1;
      const weekly=clubPlayers(world,world.clubId).reduce((n,p)=>n+p.wage,0);
      const club=myClub(world);
      if(weekly>s.wageCapWeeklyEUR||club.balance<s.transferReserveEUR)throw Error('MGT02_BUDGET_LIMIT');
    }
  }catch(err){world=JSON.parse(before);throw err;}
  if(financeEnabled(world)&&kind==='before-transfer')reconcileCareerFinance(world,{reason:'transfer'});
  if(!save()){
    primary.rollback();
    try{world=loadActiveCareer(careerStorage,validateSave,makeWorld);}catch{world=JSON.parse(before);}
    ui.modal=null;render();
    throw new Error('Autosave non completato. Il checkpoint è disponibile in Carriere.');
  }
  try{await primary.commit();}catch(err){
    primary.rollback();world=JSON.parse(before);ui.modal=null;render();throw err;
  }
  if(kind==='before-match'||kind==='before-season'){
    try{discardActivePreview();}catch(err){ui.previewRecoveryError=err;reportError(err.message);}
  }else if(ui.previewSaved){
    // Other world mutations invalidate a preview's career fingerprint.
    try{discardActivePreview();}catch(err){ui.previewRecoveryError=err;reportError(err.message);}
  }
  return result;
  } finally {
    busy.remove();
    if(surface?.isConnected)surface.removeAttribute('aria-busy');
    const current=root.querySelector('#qol03-live');if(current)current.textContent='';
  }
}
function saveBeforeSlotChange(){
  if(blockedSaveError)return true;
  const catalog=readCareerCatalog(careerStorage);
  return catalog.activeSlotId!==null||world.clubId?save():true;
}
function commitPreviewChange(next){
  const slot=activePreviewSlot();
  if(!slot)throw new Error('La carriera non dispone di uno slot salvato.');
  // Commit before exposing a new cursor or resuming playback. A failed write
  // leaves the current in-memory and stored positions unchanged.
  const committed=saveStoredMatchPreviewProgress(careerStorage,slot,world,next);
  ui.matchPreview=committed;ui.previewSaved=true;
  void primary.commit().catch(err=>{blockedSaveError=err;ui.storageWarning='Anteprima partita non salvata su IndexedDB: '+err.message;stopPreviewTimer();render();});
  return committed;
}
function suspendPreview(){
  stopPreviewTimer();
  if(ui.matchPreview&&!ui.matchPreview.paused&&!matchPlaybackSnapshot(ui.matchPreview).finished){
    try{commitPreviewChange(setMatchPlaybackPaused(ui.matchPreview,true));}
    catch(err){reportError(err.message);}
  }
}
function discardActivePreview(){
  stopPreviewTimer();
  const slot=activePreviewSlot();if(slot)discardStoredMatchPreview(careerStorage,slot);
  ui.matchPreview=null;ui.previewSaved=false;ui.previewRecoveryError=null;
}
function resetCareerUi(page='dashboard'){
  // Caller may already have swapped `world`: old cursor was committed on each tick.
  stopPreviewTimer();
  ui={...ui,page,matchPreview:null,previewRecoveryError:null,previewSaved:false,chosenClub:1,managerDraft:'',modal:null,calendarRound:null,openMail:null,sidebarOpen:false,worldCountry:null,worldClub:null,worldPlayer:null,worldHistorySeason:null,squadSearch:'',marketSearch:'',squadFilter:'ALL',squadAvailability:'all',marketPosition:'ALL',marketTab:'explore'};
  restorePendingPreview({open:page==='dashboard'});
}
function showCareers(){suspendPreview();ui.matchPreview=null;ui.page='careers';ui.modal=null;ui.sidebarOpen=false;render();window.scrollTo(0,0);}
// UX2-10: the main menu is UI state only. A failed durable commit must
// leave the game visible and cannot create or replace a career slot.
async function returnToMainMenu({confirmDraft=true}={}){
  if(ui.page==='home'){return;}
  if(confirmDraft&&ui.page!=='careers'&&ui.page!=='home-settings'&&!(window.confirm(ui.language==='en'
    ?'Return to the main menu? Unconfirmed form edits will be lost; saved careers will remain intact.'
    :'Tornare al menu principale? Le modifiche non confermate ai moduli andranno perse; le carriere salvate resteranno intatte.')))return;
  if(blockedSaveError)throw blockedSaveError;
  // A replay has independent committed cursor state, and is paused first.
  const previewActive=Boolean(ui.matchPreview||ui.previewSaved);
  suspendPreview();
  if(ui.previewRecoveryError)throw ui.previewRecoveryError;
  // Saving the unchanged world would alter updatedAt and invalidate a
  // separate match-preview cursor's fingerprint. Preserve that replay.
  if(previewActive){
    const catalog=readCareerCatalog(careerStorage);
    const record=catalog.slots.find(s=>s.id===catalog.activeSlotId);
    if(!record||careerStorage.getItem(record.storageKey)!==JSON.stringify(world))throw new Error(ui.language==='en'
      ?'The saved preview and career no longer match. Remain in game and export a backup.'
      :'Anteprima salvata e carriera non coincidono. Rimani nel gioco ed esporta un backup.');
  }else if(!saveBeforeSlotChange())throw new Error(ui.language==='en'?'Could not verify the career save. Remain in game.':'Salvataggio della carriera non verificato. Resta nel gioco.');
  await primary.commit();
  ui.page='home';ui.modal=null;ui.sidebarOpen=false;ui.matchPreview=null;
  render();window.scrollTo(0,0);
  root.querySelector('#home-title')?.focus({preventScroll:true});
}

function navigate(page){
  suspendPreview();
  const historyEntry=!qol03SkipHistory;qol03SkipHistory=false;
  if(!isNavigationPage(page))return;
  if(historyEntry&&ui.page!==page){qol03Trail.push(ui.page);if(qol03Trail.length>40)qol03Trail.shift();}
  ui.matchPreview=null;ui.page=page;ui.modal=null;ui.sidebarOpen=false;
  if(page==='calendar'&&!ui.calendarRound)ui.calendarRound=Math.min(world.fixtures.length,world.round+1);
  if(historyEntry&&window.history?.pushState)window.history.pushState({qol03Page:page},'',window.location.pathname+window.location.search);
  render();window.scrollTo({top:0,behavior:'instant'});
}
function qol03Back(){const prev=qol03Trail.pop()||'dashboard';qol03SkipHistory=true;navigate(prev);} 
window.addEventListener('popstate',ev=>{const page=ev.state?.qol03Page;if(page&&PAGES.includes(page)){qol03SkipHistory=true;navigate(page);}else if(world.clubId)qol03Back();});

// Read-only SIM01.05 preview: save only its independent event/cursor keys, NEVER the career.
function updatePreviewSurface(){
  if(ui.page!=='match-preview'||!ui.matchPreview)return;
  const container=root.querySelector('#match-playback-updates');
  if(container)container.innerHTML=matchPreviewStatus(world,ui.matchPreview,ui.language);
  const pause=root.querySelector('[data-preview-pause]');
  const state=matchPlaybackSnapshot(ui.matchPreview);
  if(pause){pause.disabled=state.finished;pause.textContent=state.paused?(ui.language==='en'?'Resume':'Riprendi'):(ui.language==='en'?'Pause':'Pausa');pause.setAttribute('aria-pressed',String(state.paused));}
  root.querySelector('[data-action="preview-finish"]')?.toggleAttribute('disabled',state.finished);
  root.querySelectorAll('[data-action="preview-speed"]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.value)===state.speed)));
}
function startPreviewTimer(){
  stopPreviewTimer();
  if(ui.page!=='match-preview'||!ui.matchPreview||ui.matchPreview.paused||matchPlaybackSnapshot(ui.matchPreview).finished)return;
  const interval={1:110,2:55,4:28}[ui.matchPreview.speed];
  previewTimer=setInterval(()=>{
    if(ui.page!=='match-preview'||!ui.matchPreview||ui.matchPreview.paused){stopPreviewTimer();return;}
    try{commitPreviewChange(advanceMatchPlayback(ui.matchPreview));}
    catch(err){stopPreviewTimer();reportError(err.message);return;}
    updatePreviewSurface();
    if(matchPlaybackSnapshot(ui.matchPreview).finished)stopPreviewTimer();
  },interval);
}
function openMatchPreview(matchId){
  const fixture=world.fixtures[world.round]?.matches.find(match=>match.id===matchId &&
    (match.home===world.clubId||match.away===world.clubId) && !match.result);
  if(!fixture)throw new Error(ui.language==='en'?'Only your upcoming unplayed fixture can be previewed.':'Puoi vedere soltanto l’anteprima della prossima partita da giocare.');
  if(ui.previewRecoveryError)throw ui.previewRecoveryError;
  stopPreviewTimer();
  const slot=activePreviewSlot();if(!slot)throw new Error('Salva la carriera prima di aprire un’anteprima.');
  // Reload an immutable event stream when one exists. NEVER regenerate it.
  const previous=loadStoredMatchPreview(careerStorage,slot,world);
  ui.matchPreview=previous||startStoredMatchPreview(careerStorage,slot,world,
    createMatchPlayback(generateMatchActions(world,fixture)));
  ui.previewSaved=true;
  ui.page='match-preview';ui.modal=null;ui.sidebarOpen=false;
  render();window.scrollTo(0,0);startPreviewTimer();
}
// Background tabs must not silently finish a match while the player is away.
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&ui.matchPreview&&!ui.matchPreview.paused){
    try{commitPreviewChange(setMatchPlaybackPaused(ui.matchPreview,true));}catch(err){reportError(err.message);}
    stopPreviewTimer();updatePreviewSurface();
  }
});
function confirmAction(message){return window.confirm(translate(message,ui.language));}
function matchText(m){const {homeGoals,awayGoals}=m.result;return `${clubById(world,m.home).short} ${homeGoals} – ${awayGoals} ${clubById(world,m.away).short}`;}
function downloadText(text,filename){
  const blob=new Blob([text],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}
function downloadJSON(){
  downloadText(JSON.stringify(world,null,2),`football-architect-season-${world.season}-giornata-${world.round}.json`);
}
// Legacy QOL01 vault remains an optional secondary recovery copy. The
// IndexedDB primary is committed independently before this mirror runs.
function queueVaultSync(){
  ui.vaultState='pending';
  vaultSync=vaultSync.catch(()=>{}).then(async()=>{
    try{
      const oldWarning=ui.storageWarning;
      const status=await mirrorCatalogToVault(careerStorage,careerVault,validateSave);
      const vaultRecords=await careerVault.list();
      ui.vaultIds=vaultRecords.map(r=>r.id);
      ui.storageEstimate=await estimateCareerStorage();
      ui.vaultState=status.errors||status.missing?'warning':'ok';
      if(status.errors||status.missing||ui.storageEstimate.warning){
        ui.storageWarning=status.errors
          ?'Non tutte le copie IndexedDB sono state verificate: esporta un backup JSON.'
          :status.missing?'Uno slot non è disponibile nella memoria di lavoro; verifica le copie di recupero.'
          :'Spazio del browser quasi esaurito. Esporta le tue carriere su disco.';
      }else if(!emergencyWorldRaw)ui.storageWarning=null;
      if(ui.page==='careers'||oldWarning!==ui.storageWarning)render();
    }catch(err){
      const previousWarning=ui.storageWarning;
      ui.vaultState='unavailable';
      ui.storageWarning='La copia di recupero secondaria non è disponibile; il salvataggio principale IndexedDB rimane attivo. '+(err?.message||'');
      if(ui.page==='careers'||previousWarning!==ui.storageWarning)render();
    }
  });
  return vaultSync;
}
async function handleEmergencyExport(){
  try{
    let snapshot=world;
    try{if(emergencyWorldRaw)snapshot=JSON.parse(emergencyWorldRaw);}catch{}
    const raw=await createEmergencyExport(careerStorage,careerVault,snapshot,validateSave);
    downloadText(raw,`football-architect-emergency-${new Date().toISOString().slice(0,10)}.json`);
    toast(ui.language==='en'?'Emergency JSON exported.':'Esportazione di emergenza completata.');
  }catch(err){reportError(readableStorageError(err));}
}
async function handleVaultRestore(id){
  try{
    const result=await restoreSlotFromVault(careerStorage,careerVault,id,validateSave);
    ui.modal=null;
    if(readCareerCatalog(careerStorage).activeSlotId===id&&result.restored){
      world=result.career;blockedSaveError=null;emergencyWorldRaw=null;await migrateActiveCareerSystems();resetCareerUi('careers');
      try{persistCareer(careerStorage,result.career,validateSave);}
      catch(err){ui.storageWarning='Copia di compatibilità non aggiornata: lo slot recuperato è al sicuro. '+(err?.message||'');}
    }
    await primary.commit();
    await queueVaultSync();
    render();toast(ui.language==='en'?'IndexedDB copy restored.':'Copia IndexedDB ripristinata.');
  }catch(err){ui.modal=null;render();reportError(readableStorageError(err));}
}
async function handleExportAll(){
  try{
    const archive=await exportAllCareersJson(careerStorage,validateSave);
    downloadText(archive,`football-architect-all-careers-${new Date().toISOString().slice(0,10)}.json`);
    toast(ui.language==='en'?'Full career archive exported.':'Archivio di tutte le carriere esportato.');
  }catch(err){reportError(readableStorageError(err));}
}
// QOL05.04 — opt-in busy state for genuinely asynchronous controls.
// Ignore a second click while processing; restore the state even on failure.
async function runBusyAction(action, task){
  const button=[...root.querySelectorAll('button[data-action]')].find(b=>b.dataset.action===action);
  if(button?.getAttribute('aria-busy')==='true')return;
  button?.setAttribute('aria-busy','true');
  const surface=root.querySelector('#main-content');const status=document.createElement('div');status.className='qol03-progress';status.setAttribute('role','status');
  status.textContent=ui.language==='en'?'Loading and checking files…':'Caricamento e verifica dei file…';
  if(surface){surface.setAttribute('aria-busy','true');surface.prepend(status);}
  try{
    try{await new Promise(resolve=>{if(document.visibilityState==='visible'&&typeof requestAnimationFrame==='function')requestAnimationFrame(resolve);else setTimeout(resolve,0);});await task();}
    finally{status.remove();if(surface?.isConnected)surface.removeAttribute('aria-busy');}
  }finally{button?.removeAttribute('aria-busy');}
}
async function handleImport(file){
  try{
    if(!file)return;
    if(file.size>MAX_TRANSFER_BYTES)throw new Error(ui.language==='en'?'The file exceeds the 128 MB limit.':'Il file supera il limite di 128 MB.');
    if(!saveBeforeSlotChange())throw new Error('Salvataggio corrente non verificato: importazione annullata.');
    await primary.commit();
    const raw=await file.text();
    const preview=await previewCareerImport(raw,validateSave);
    ui.importPreview=preview;ui.importMode='add';ui.importTarget='';ui.importCatalogRaw=careerStorage.getItem(CAREER_CATALOG_KEY);
    ui.page='careers';ui.modal={type:'career-import-preview'};render();
  }catch(err){reportError(`${ui.language==='en'?'Import failed':'Importazione non riuscita'}: ${readableStorageError(err)}`);}
}
let actionBusy=false;
root.addEventListener('click',async ev=>{
  const target=ev.target.closest('[data-action]');if(!target||actionBusy)return;
  actionBusy=true;
  const previousWorld=world;
  dialogCoordinator.noteOpener(target);
  const action=target.dataset.action,id=target.dataset.id,field=target.dataset.value,index=Number(target.dataset.index);
  // Re-rendering a radio group should not discard keyboard focus after using arrows.
  const restoreRadioFocus=()=>{
    if(ev.detail!==0||!target.matches('input[type="radio"]'))return;
    [...root.querySelectorAll('input[type="radio"][data-action]')]
      .find(control=>control.name===target.name&&control.value===target.value)?.focus({preventScroll:true});
  };
  try{
    // A dismissed or retired manager may review/export the career and choose a new job,
    // but may not direct the former club's squad, tactics, contracts or transfers.
    if(['dismissed','retired'].includes(boardStatus(world))&&
       (/^(advance|preview-match|sim04-|sim02-|auto-lineup|formation|assign|clear-slot|tactic|pressing|tempo|training|market-|scout-|calendar-|youth-|training-)/.test(action))){
      throw new Error(ui.language==='en'?'Choose a new club from the Board page before making club decisions.':'Scegli una nuova panchina dalla pagina Dirigenza prima di gestire un club.');
    }
    switch(action){
      case 'qol03-back':qol03Back();break;
      case 'qol03-widget-up':case 'qol03-widget-down':ui.qol03=moveWidget(ui.qol03,id,action.endsWith('up')?-1:1);qol03Save();render();break;
      case 'qol03-mail-archive':{
        const key=String(id);ui.qol03.mailArchived=ui.qol03.mailArchived.includes(key)?ui.qol03.mailArchived.filter(x=>x!==key):[...ui.qol03.mailArchived,key];qol03Save();render();break;
      }
      case 'qol03-mail-go':navigate(target.dataset.page||'inbox');focusPage();break;
      case 'qol03-sort-direction':case 'qol03-table-prev':case 'qol03-table-next':{
        const p=qol03TablePref(id);if(action==='qol03-sort-direction')p.desc=!p.desc;else p.page=Math.max(0,p.page+(action.endsWith('next')?1:-1));qol03UpdateTable(id);qol03Save();
        if(action==='qol03-sort-direction')render();break;
      }
      case 'clear-field':clearField(target.dataset.target);break;
      case 'choose-country':{
        if(world.clubId)throw new Error('La nazione può essere scelta soltanto prima di iniziare una carriera.');
        const league=leagueById(id);
        world=makeWorld(world.seed,league.id);
        ui.chosenClub=1;ui.managerDraft=document.getElementById('manager-name')?.value||ui.managerDraft;
        save();render();break;
      }
      case 'choose-club':ui.chosenClub=Number(id);render();break;
      case 'start-career':{
        const field=document.getElementById('manager-name');
        startCareer(world,ui.chosenClub,field?.value||ui.managerDraft||'Allenatore');
        ui.page='dashboard';refresh(`Benvenuto al ${myClub(world).name}!`);window.scrollTo(0,0);break;
      }
      case 'contracts-propose':{
        const pid=Number(document.getElementById('ply05-player')?.value);
        const wage=Number(document.getElementById('ply05-weekly')?.value);
        const years=Number(document.getElementById('ply05-years')?.value);
        const bonus=Number(document.getElementById('ply05-signing')?.value);
        const role=document.getElementById('ply05-role')?.value;
        const appearanceBonus=Number(document.getElementById('ply05-appearance')?.value);
        const goalBonus=Number(document.getElementById('ply05-goal')?.value);
        const releaseText=document.getElementById('ply05-release')?.value;
        const releaseFee=releaseText===''?null:Number(releaseText);
        await runCheckpointed('before-transfer',()=>proposeCareerRenewal(world,{playerId:pid,expectedRevision:world.advancedV1.contractsV1.revision,annualWage:wage*52,years,signingBonus:bonus,appearanceBonus,goalBonus,releaseFee,promisedRole:role}));render();break;
      }
      case 'contracts-auto-response':{
        await runCheckpointed('before-transfer',()=>respondCareerRenewal(world,{offerId:id,expectedRevision:world.advancedV1.contractsV1.revision,decision:'auto'}));render();break;
      }
      case 'contracts-decide-counter':{
        await runCheckpointed('before-transfer',()=>decideCareerCounter(world,{offerId:id,expectedRevision:world.advancedV1.contractsV1.revision,decision:field==='accept'?'accept':'reject'}));render();break;
      }
      case 'sim03-slot':ui.sim03Slot=Number(index);render();break;
      case 'sim03-reset':{
        if(!confirmAction(ui.language==='en'?'Reset roles for this formation only?':'Ripristinare i ruoli soltanto per questo modulo?'))break;
        await runCheckpointed('before-match',()=>resetCareerRoleFormation(world));render();break;
      }
      case 'sim02-save':case 'sim02-update':case 'sim02-duplicate':case 'sim02-apply':case 'sim02-delete':
      case 'sim02-plan':case 'sim02-cancel':{
        const surface=root.querySelector('[data-dialog-kind="sim04-halftime"]')||root;
        const value=id=>surface.querySelector(id)?.value;
        await runCheckpointed('before-match',()=>{
          if(action==='sim02-save')return saveCareerTacticPreset(world,value('#sim02-name'));
          if(action==='sim02-update')return editCareerTacticPreset(world,value('#sim02-preset-id'),{name:value('#sim02-name'),tactics:world.advancedV1.tactics});
          if(action==='sim02-duplicate')return duplicateCareerTacticPreset(world,value('#sim02-preset-id'),value('#sim02-name'));
          if(action==='sim02-apply')return applyCareerTacticPreset(world,value('#sim02-preset-id'));
          if(action==='sim02-delete')return deleteCareerTacticPreset(world,value('#sim02-preset-id'));
          if(action==='sim02-plan')return planCareerTacticChange(world,{minute:Number(value('#sim02-minute')),presetId:value('#sim02-plan-preset')});
          return cancelCareerTacticChange(world,Number(index));
        });render();break;
      }
      case 'sim02-compare':{
        const surface=root.querySelector('[data-dialog-kind="sim04-halftime"]')||root;
        ui.sim02CompareId=surface.querySelector('#sim02-compare-id')?.value||'balanced';render();break;
      }
      case 'sim04-plan-add':{
        const surface=root.querySelector('[data-dialog-kind="sim04-halftime"]')||root;
        const value=key=>Number(surface.querySelector(key)?.value);
        await runCheckpointed('before-match',()=>planCareerSubstitution(world,{minute:value('#sim04-minute'),outgoing:value('#sim04-out'),incoming:value('#sim04-in')}));render();break;
      }
      case 'sim04-plan-remove':await runCheckpointed('before-match',()=>cancelCareerSubstitution(world,index));render();break;
      case 'sim04-rules':{
        const surface=root.querySelector('[data-dialog-kind="sim04-halftime"]')||root;
        const maxSubstitutions=Number(surface.querySelector('#sim04-max-subs')?.value),maxWindows=Number(surface.querySelector('#sim04-max-windows')?.value);
        const kind=String(surface.querySelector('#sim04-kind')?.value||'league');
        await runCheckpointed('before-match',()=>setCareerMatchdayRules(world,{kind,maxSubstitutions,maxWindows}));render();break;
      }
      case 'training-delegate':{await changeOfficialTraining(w=>delegateCareerTraining(w));break;}
      case 'youth-program':{await changeOfficialTraining(w=>configureCareerAcademy(w,field));break;}
      case 'youth-promote':{
        const prospect=world.advancedV1?.youthV1?.academy?.[String(world.clubId)]?.find(p=>p.id===Number(id));
        if(!prospect)throw new Error('Prospetto non disponibile.');
        if(!confirmAction(ui.language==='en'?`Promote ${prospect.name} to the first team?`:`Promuovere ${prospect.name} in prima squadra?`))break;
        await changeOfficialTraining(w=>promoteCareerProspect(w,Number(id)));break;
      }
      case 'addon-tab':{const allowed=['players','health','training','tactics','matches','world','market'];if(allowed.includes(field)){ui.advancedTab=field;render();}break;}
      case 'manager-apply':{
        await runCheckpointed('before-transfer',()=>applyManagerJob(world,{revision:world.advancedV1.managerV1.revision,clubKey:field}));ui.page='manager';render();break;
      }
      case 'manager-counter':{
        const offer=world.advancedV1.managerV1.offers.find(o=>o.id===Number(id));
        if(!offer)throw Error('WRD06_OFFER');
        const salary=Math.round(offer.salaryEUR*1.1/1000)*1000;
        await runCheckpointed('before-transfer',()=>negotiateManagerOffer(world,{revision:world.advancedV1.managerV1.revision,offerId:Number(id),salaryEUR:salary,contractYears:offer.contractYears}));ui.page='manager';render();break;
      }
      case 'manager-offer-accept':case 'manager-offer-decline':{
        const accept=action==='manager-offer-accept';
        if(accept&&!confirmAction(ui.language==='en'?'Accept this new job and leave your current club?':'Accettare la nuova panchina e lasciare il club attuale?'))break;
        await runCheckpointed('before-season',()=>{const previous=world.clubId;decideManagerOffer(world,{revision:world.advancedV1.managerV1.revision,offerId:Number(id),accept});if(previous!==world.clubId)clearCareerTacticPlans(world);});ui.page='manager';render();break;
      }
      case 'board-negotiate':{
        await runCheckpointed('before-season',()=>negotiateBoardGoals(world,{revision:world.advancedV1.boardV1.revision,plan:target.dataset.plan}));ui.page='board';render();break;
      }
      case 'board-accept-job':{
        await runCheckpointed('before-season',()=>{const previous=world.clubId;acceptBoardJob(world,{revision:world.advancedV1.boardV1.revision,clubId:Number(id)});if(managerCareerEnabled(world))registerBoardAppointment(world,previous);if(previous!==world.clubId)clearCareerTacticPlans(world);});ui.page='board';render();break;
      }
      case 'board-retire':{
        if(!confirmAction(ui.language==='en'?'End this manager career? The save will remain available.':'Terminare la carriera da allenatore? Il salvataggio resterà disponibile.'))break;
        await runCheckpointed('before-season',()=>{endBoardCareer(world,{revision:world.advancedV1.boardV1.revision});if(managerCareerEnabled(world))registerManagerRetirement(world);});ui.page='board';render();break;
      }
      case 'world-country':ui.worldCountry=target.dataset.country;ui.worldClub=null;ui.worldPlayer=null;render();break;
      case 'world-club':ui.worldClub=target.dataset.club;ui.worldPlayer=null;render();break;
      case 'world-player':ui.worldPlayer=target.dataset.player;render();break;
      case 'nav':if(target.dataset.page==='careers')showCareers();else navigate(target.dataset.page||'dashboard');focusPage();break;
      case 'open-careers':showCareers();break;
      case 'career-back':await returnToMainMenu({confirmDraft:false});break;
      case 'menu-home':await returnToMainMenu();break;
      case 'menu-continue':{
        if(blockedSaveError)throw blockedSaveError;
        if(!world.clubId){ui.page='dashboard';render();break;}
        restorePendingPreview({open:true});
        if(ui.page!=='match-preview')ui.page='dashboard';
        ui.modal=null;ui.sidebarOpen=false;render();window.scrollTo(0,0);focusPage();break;
      }
      case 'menu-load':case 'menu-manage':showCareers();break;
      case 'menu-settings':ui.page='home-settings';ui.modal=null;render();focusPage();break;
      case 'menu-open-settings':ui.page=world.clubId?'settings':'home-settings';render();focusPage();break;
      case 'menu-import':root.querySelector('#home-import-file')?.click();break;
      case 'career-load':{
        if(!saveBeforeSlotChange())break;
        const selected=switchCareerSlot(careerStorage,id,validateSave);
        world=selected.career;blockedSaveError=null;pendingNewCatalogSlot=false;await migrateActiveCareerSystems();resetCareerUi();
        render();window.scrollTo(0,0);
        if(selected.mirrorError)reportError(readableStorageError(selected.mirrorError));
        break;
      }
      case 'menu-new':case 'career-new':{
        if(!saveBeforeSlotChange())break;
        // Only after a verified new slot exists may the running world change.
        const fresh=makeWorld();
        const created=createFreshCareerSlot(careerStorage,fresh,validateSave);
        world=created.career;blockedSaveError=null;pendingNewCatalogSlot=false;resetCareerUi();
        render();window.scrollTo(0,0);
        if(created.mirrorError)reportError(readableStorageError(created.mirrorError));
        break;
      }
      case 'career-export':{
        const raw=exportCareerSlotJson(careerStorage,id,validateSave);
        downloadText(raw,`football-architect-career-${id}.json`);
        toast(ui.language==='en'?'Career exported as JSON.':'Carriera esportata in JSON.');break;
      }
      case 'career-export-all':void runBusyAction('career-export-all',handleExportAll);break;
      case 'career-import':document.getElementById('career-import-file')?.click();break;
      case 'export-emergency':void runBusyAction('export-emergency',handleEmergencyExport);break;
      case 'retry-vault-sync':void runBusyAction('retry-vault-sync',()=>queueVaultSync());break;
      case 'request-storage-persistence':{
        if(typeof navigator.storage?.persist!=='function')throw new Error('Il browser non permette di richiedere archiviazione persistente.');
        const granted=await navigator.storage.persist();
        toast(granted?(ui.language==='en'?'Persistent storage enabled.':'Archiviazione persistente abilitata.'):(ui.language==='en'?'Browser did not grant persistent storage. Keep exporting JSON backups.':'Il browser non ha concesso la persistenza. Continua a esportare backup JSON.'));
        ui.storageEstimate=await estimateCareerStorage();render();break;
      }
      case 'career-vault-preview':{
        const item=readCareerCatalog(careerStorage).slots.find(s=>s.id===id);
        if(!item)throw new Error('Carriera non disponibile.');
        ui.modal={type:'career-vault-confirm',id,name:item.name};render();break;
      }
      case 'career-vault-confirm':await handleVaultRestore(id);break;
      case 'career-import-confirm':{
        if(!ui.importPreview)throw new Error('Anteprima di importazione non disponibile.');
        const result=applyCareerImport(careerStorage,ui.importPreview,validateSave,{
          mode:ui.importMode,targetSlotId:ui.importTarget||null,expectedCatalogRaw:ui.importCatalogRaw,
        });
        ui.importPreview=null;ui.importCatalogRaw=null;ui.modal=null;
        if(result.activeCareer){world=result.activeCareer;blockedSaveError=null;pendingNewCatalogSlot=false;await migrateActiveCareerSystems();resetCareerUi('careers');}
        toast(ui.language==='en'?`${result.count} careers imported.`:`${result.count} carriere importate.`);
        if(result.mirrorError)reportError(readableStorageError(result.mirrorError));
        break;
      }
      case 'career-import-backups':{
        ui.importBackups=listImportBackups(careerStorage,id,validateSave);
        const item=readCareerCatalog(careerStorage).slots.find(x=>x.id===id);
        ui.modal={type:'career-import-backups',id,name:item?.name||''};render();break;
      }
      case 'career-import-backup-select':{
        const item=readCareerCatalog(careerStorage).slots.find(x=>x.id===id);
        if(!item)throw new Error('Carriera non disponibile.');
        ui.modal={type:'career-import-backup-confirm',id,key:field,name:item.name};render();break;
      }
      case 'career-import-backup-confirm':{
        const result=restoreImportBackup(careerStorage,id,field,validateSave);
        ui.modal=null;
        if(result.activeCareer){world=result.activeCareer;blockedSaveError=null;pendingNewCatalogSlot=false;await migrateActiveCareerSystems();resetCareerUi('careers');}
        toast(ui.language==='en'?'Previous career restored.':'Copia precedente ripristinata.');
        if(result.mirrorError)reportError(readableStorageError(result.mirrorError));
        break;
      }
      case 'career-checkpoints':{
        const current=readCareerCatalog(careerStorage).slots.find(s=>s.id===id);if(!current)break;
        ui.modal={type:'career-checkpoints',id,name:current.name};ui.checkpointError=null;render();break;
      }
      case 'career-checkpoint-restore':{
        const cp=(ui.checkpoints||[]).find(item=>item.key===field&&item.status==='ok');
        if(!cp||readCareerCatalog(careerStorage).activeSlotId!==id)throw new Error('Carica prima la carriera e seleziona un checkpoint valido.');
        const current=readCareerCatalog(careerStorage).slots.find(s=>s.id===id);
        ui.modal={type:'career-checkpoint-confirm',id,key:cp.key,kind:cp.kind,name:current?.name||''};render();break;
      }
      case 'career-checkpoint-confirm':{
        if(!saveBeforeSlotChange())break;
        const restored=restoreCareerCheckpoint(careerStorage,id,field,validateSave);
        world=restored.career;blockedSaveError=null;pendingNewCatalogSlot=false;await migrateActiveCareerSystems();resetCareerUi();
        toast(ui.language==='en'?'Checkpoint restored.':'Checkpoint ripristinato.');window.scrollTo(0,0);
        if(restored.mirrorError)reportError(readableStorageError(restored.mirrorError));
        break;
      }
      case 'career-rename':{
        const current=readCareerCatalog(careerStorage).slots.find(s=>s.id===id);if(!current)break;
        ui.modal={type:'career-rename',id,name:current.name};render();
        document.getElementById('career-name')?.focus();break;
      }
      case 'career-rename-confirm':{
        const renameInput=document.getElementById('career-name');
        if(!renameInput?.value.trim()){
          renameInput?.setAttribute('aria-invalid','true');
          const error=document.getElementById('career-name-error');if(error)error.hidden=false;
          renameInput?.focus();break;
        }
        renameCareerSlot(careerStorage,id,renameInput.value);
        ui.modal=null;render();break;
      }
      case 'career-duplicate':{
        const catalog=readCareerCatalog(careerStorage);
        const current=catalog.slots.find(s=>s.id===id);if(!current)break;
        if(!confirmAction(`Duplicare la carriera «${current.name}»?`))break;
        duplicateCareerSlot(careerStorage,id,validateSave);render();break;
      }
      case 'career-delete':{
        const current=readCareerCatalog(careerStorage).slots.find(s=>s.id===id);if(!current)break;
        ui.modal={type:'career-delete',id,name:current.name};render();break;
      }
      case 'career-delete-confirm':{
        const catalog=readCareerCatalog(careerStorage);
        if(catalog.activeSlotId===id&&!saveBeforeSlotChange())break;
        const deleted=deleteCareerSlot(careerStorage,id,validateSave);
        ui.modal=null;
        try{discardStoredMatchPreview(careerStorage,id);}catch(err){reportError(err.message);}
        if(deleted.activeDeleted){world=deleted.nextCareer||makeWorld();blockedSaveError=null;pendingNewCatalogSlot=false;await migrateActiveCareerSystems();resetCareerUi('careers');}
        render();
        if(deleted.cleanupError||deleted.mirrorError)reportError(readableStorageError(deleted.cleanupError||deleted.mirrorError));
        break;
      }
      case 'toggle-sidebar':toggleDrawer(!ui.sidebarOpen);break;
      case 'close-sidebar':toggleDrawer(false);break;
      case 'preview-match':if(hasAdvancedCareer(world)){ui.page='advanced';ui.advancedTab='tactics';toast(ui.language==='en'?'Advanced mode: set tactics before playing; the official report will show the recorded actions.':'Modalità avanzata: prepara le tattiche prima di giocare; il tabellino mostrerà gli eventi registrati.');}else openMatchPreview(id);break;
      case 'preview-exit':navigate('calendar');break;
      case 'preview-discard':ui.modal={type:'preview-discard-confirm'};render();break;
      case 'preview-discard-confirm':discardActivePreview();ui.modal=null;navigate('calendar');break;
      case 'preview-toggle':{
        if(!ui.matchPreview)break;
        commitPreviewChange(setMatchPlaybackPaused(ui.matchPreview,!ui.matchPreview.paused));
        if(ui.matchPreview.paused)stopPreviewTimer();else startPreviewTimer();
        updatePreviewSurface();break;
      }
      case 'preview-speed':{
        if(!ui.matchPreview)break;
        commitPreviewChange(setMatchPlaybackSpeed(ui.matchPreview,Number(field||ev.target.dataset.value))); 
        startPreviewTimer();updatePreviewSurface();break;
      }
      case 'preview-finish':{
        if(!ui.matchPreview)break;
        stopPreviewTimer();commitPreviewChange(finishMatchPlayback(ui.matchPreview));
        updatePreviewSurface();break;
      }
      case 'advance':{
        ensureCareerDates(world);
        const dueNow=fixtureIsDue(world),tomorrow=addDaysISO(world.currentDate,1),nextDate=nextFixtureDate(world);
        const notice=world.advancedV1?.calendarV1?previewCalendarAdvance(world,{toDay:world.advancedV1.clockDay+(dueNow?0:1)}):{requiresConfirmation:false,confirmationToken:null,due:[],closing:[],expiring:[]};
        if(notice.requiresConfirmation&&!confirmAction(ui.language==='en'?`Tomorrow processes ${notice.due.length} registrations, ${notice.closing.length} window deadlines and ${notice.expiring.length} offer expirations. Continue?`:`Domani saranno elaborate ${notice.due.length} registrazioni, ${notice.closing.length} chiusure di mercato e ${notice.expiring.length} scadenze delle offerte. Continuare?`))break;
        const matchDay=dueNow||nextDate===tomorrow;
        if(substitutionsEnabled(world)&&matchDay&&!notice.due?.length){
          if(!dueNow)await runCheckpointed('before-match',()=>advanceDay(world,{calendarConfirmationToken:notice.confirmationToken,simulateDueMatch:false}));
          const next=expectedNextMatch(world);
          if(next){ui.modal={type:'sim04-halftime',round:world.round,preview:previewAdvancedHalf(world,next)};render();toast(formatCareerDate(world.currentDate,ui.language));break;}
        }
        const result=await runCheckpointed(matchDay?'before-match':'before-day',()=>advanceDay(world,{calendarConfirmationToken:notice.confirmationToken}));
        ui.calendarRound=world.round;
        if(result.match){ui.modal={type:'match',id:result.match.id};toast(`${formatCareerDate(world.currentDate,ui.language)} · Giornata ${world.round} · ${matchText(result.match)}`);}
        else {render();toast(formatCareerDate(world.currentDate,ui.language));}
        break;
      }
      case 'sim04-half-continue':{
        if(!substitutionsEnabled(world)||ui.modal?.type!=='sim04-halftime'||ui.modal.round!==world.round||ui.modal.preview.matchId!==expectedNextMatch(world)?.id)throw new Error('SIM04_HALFTIME_STALE');
        const m=await runCheckpointed('before-match',()=>simulateRound(world,{advanceDays:0,calendarAlreadySettled:true}));ui.calendarRound=world.round;
        ui.modal={type:'match',id:m.id};toast(`${formatCareerDate(world.currentDate,ui.language)} · Giornata ${world.round} · ${matchText(m)}`);break;
      }
      case 'new-season':{
        if(!confirmAction(`Avviare la stagione ${world.season+1}? La classifica e le statistiche stagionali ripartiranno da zero.`))break;
        const res=await runCheckpointed('before-season',()=>newSeason(world));ui.calendarRound=1;ui.page='dashboard';toast(`Nuova stagione! ${res.position}° posto e premio ${Math.round(res.prize/1e6*10)/10} milioni €.`);break;
      }
      case 'player':ui.comparePlayerId=null;ui.modal={type:'player',id:Number(id)};render();break;
      case 'match':ui.modal={type:'match',id};render();break;
      case 'slot':ui.modal={type:'slot',index};render();break;
      case 'close-modal':ui.modal=null;render();break;
      case 'dismiss-modal':if(!ev.target.closest('[data-stop-close]')){ui.modal=null;render();}break;
      case 'formation':changeFormation(world,field);syncCareerTrainingFormation(world);refresh(`Modulo ${field} applicato.`);break;
      case 'auto-lineup':autoLineup(world);refresh('Miglior undici disponibile selezionato.');break;
      case 'assign':assignPlayer(world,index,Number(id));ui.modal=null;refresh('Formazione aggiornata.');break;
      case 'clear-slot':world.lineup[index]=null;ui.modal=null;refresh('Slot liberato.');break;
      case 'tactic':world.tactic=field;refresh(`Mentalità: ${field}.`);restoreRadioFocus();break;
      case 'pressing':world.pressing=field;refresh(`Pressing: ${field}.`);restoreRadioFocus();break;
      case 'tempo':world.tempo=field;refresh(`Ritmo: ${field}.`);restoreRadioFocus();break;
      case 'training':world.training=field;refresh(`Programma ${field} selezionato.`);break;
      case 'squad-filter':ui.squadFilter=field;render();break;
      case 'squad-availability':ui.squadAvailability=['all','available','injured','tired'].includes(field)?field:'all';render();break;
      case 'squad-reset':ui.squadSearch='';ui.squadFilter='ALL';ui.squadAvailability='all';ui.squadSort='Ruolo';ui.qol03.rosterAttribute='ALL';ui.qol03.rosterMinimum=1;qol03Save();render();break;
      case 'ux206-tab':{
        if(!['formation','roles','strategy','matchday'].includes(field))break;
        ui.tacticsTab=field;render();
        root.querySelector(`[data-action="ux206-tab"][data-value="${field}"]`)?.focus({preventScroll:true});
        break;
      }
      case 'ux205-tab':{
        if(!MARKET_VIEWS.includes(field))break;
        ui.marketTab=field;render();
        root.querySelector(`[data-action="ux205-tab"][data-value="${field}"]`)?.focus({preventScroll:true});
        break;
      }
      case 'ux205-reset':{
        ui.marketSearch='';ui.marketCountry='ALL';ui.marketPosition='ALL';render();
        root.querySelector('#market-search')?.focus({preventScroll:true});break;
      }
      case 'toggle-watchlist-filter':ui.marketOnlyWatched=!ui.marketOnlyWatched;render();break;
      case 'round':ui.calendarRound=Number(field);render();break;
      case 'calendar-prev':ui.calendarRound=Math.max(1,(ui.calendarRound||world.round+1)-1);render();break;
      case 'calendar-next':ui.calendarRound=Math.min(world.fixtures.length,(ui.calendarRound||world.round+1)+1);render();break;
      case 'watch':{
        const pid=Number(id);world.watchlist=world.watchlist.includes(pid)?world.watchlist.filter(i=>i!==pid):[...world.watchlist,pid];refresh(world.watchlist.includes(pid)?'Calciatore aggiunto agli osservati.':'Calciatore rimosso dagli osservati.');break;
      }
      case 'facility-hire':{
        const role=document.getElementById('staff-role')?.value,quality=Number(document.getElementById('staff-quality')?.value);
        await runCheckpointed('before-finance',()=>hireCareerStaff(world,{revision:world.advancedV1.facilitiesV1.revision,role,quality}));render();break;
      }
      case 'facility-delegate':{
        const task=target.dataset.task,enabled=target.dataset.enabled==='true';
        await runCheckpointed('before-finance',()=>delegateCareerStaff(world,{revision:world.advancedV1.facilitiesV1.revision,task,enabled}));render();break;
      }
      case 'facility-plan':{
        const type=document.getElementById('facility-type')?.value;
        await runCheckpointed('before-finance',()=>planFacilityProject(world,{revision:world.advancedV1.facilitiesV1.revision,type}));render();break;
      }
      case 'facility-approve':case 'facility-postpone':case 'facility-cancel':{
        const decision=action.slice('facility-'.length);
        await runCheckpointed('before-finance',()=>decideFacilityProject(world,{revision:world.advancedV1.facilitiesV1.revision,id,decision}));render();break;
      }
      case 'finance-budget':{
        if(!financeEnabled(world))throw Error('MGT02_NOT_ENABLED');
        const rev=world.advancedV1.financeV1.revision;
        const val=id=>Number(document.getElementById(id)?.value);
        await runCheckpointed('before-finance',()=>configureCareerFinanceBudget(world,{revision:rev,wageCapWeeklyEUR:val('finance-wages-cap'),transferReserveEUR:val('finance-transfer-reserve')}));
        toast(ui.language==='en'?'Financial budgets saved.':'Budget salvati.');break;
      }
      case 'market-offer-player':if(!marketEnabled(world))throw Error('Attiva il mercato internazionale.');ui.modal={type:'market-offer',id};render();break;
      case 'market-open-deal':ui.modal={type:'market-deal',id};render();break;
      case 'market-send-offer':{
        const get=id=>Number(document.getElementById(id)?.value??NaN);
        const type=document.getElementById('mkt-type')?.value;
        const fee=get('mkt-fee'),bonus=get('mkt-bonus'),days=get('mkt-days'),deferred=get('mkt-installment');
        const loanEnd=get('mkt-loan-season'),share=get('mkt-salary-share'),clause=get('mkt-clause');
        const quote=createCareerQuote(world,{type,feeEUR:fee,bonusEUR:bonus,days,installments:deferred>0?[{dueSeason:world.season+1,amountEUR:deferred}]:[],loanEndSeason:type==='loan'?loanEnd:null,salarySharePct:type==='loan'?share:null,releaseClauseEUR:clause>0?clause:null});
        const rev=world.advancedV1.marketV1.revision,playerId=id,buyerKey=target.dataset.buyer;
        const newId=await runCheckpointed('before-transfer',()=>startMarketDeal(world,{revision:rev,playerId,buyerKey,quote}));
        ui.modal={type:'market-deal',id:newId};render();toast('Offerta inviata e salvata.');break;
      }
      case 'market-seller-auto':case 'market-seller-accept':case 'market-seller-reject':case 'market-seller-counter':
      case 'market-buyer-accept':case 'market-buyer-reject':case 'market-buyer-counter':{
        const state=world.advancedV1.marketV1,d=state.deals[id],seller=action.startsWith('market-seller'),side=seller?'seller':'buyer';
        const decision=action.endsWith('auto')?marketClubDecision(world,d).decision:action.endsWith('accept')?'accept':action.endsWith('reject')?'reject':'counter';
        const quote=decision==='counter'?createCareerQuote(world,{type:d.offer.type,
          feeEUR:action.endsWith('auto')?marketClubDecision(world,d).askEUR:Math.round(d.offer.feeMinorEUR/100*(seller?1.1:1.05)/1000)*1000,
          bonusEUR:d.offer.bonusMinorEUR/100,days:28,
          installments:d.offer.installments.map(i=>({dueSeason:i.dueSeason,amountEUR:i.amountMinorEUR/100})),
          loanEndSeason:d.offer.loanEndSeason,salarySharePct:d.offer.salarySharePct,
          releaseClauseEUR:d.offer.releaseClauseMinorEUR===null?null:d.offer.releaseClauseMinorEUR/100}):null;
        const rev=state.revision;
        await runCheckpointed('before-transfer',()=>answerMarketClub(world,{revision:rev,dealId:id,side,decision,counterQuote:quote}));
        ui.modal={type:'market-deal',id};render();toast('Risposta registrata.');break;
      }
      case 'market-terms':{
        const val=x=>Number(document.getElementById(x)?.value??NaN),rev=world.advancedV1.marketV1.revision;
        await runCheckpointed('before-transfer',()=>proposeMarketTerms(world,{revision:rev,dealId:id,annualWageEUR:world.advancedV1.marketV1.deals[id].offer.type==='loan'?marketExistingWageEUR(world,world.advancedV1.marketV1.deals[id].playerId):val('mkt-annual'),years:val('mkt-years'),role:document.getElementById('mkt-role')?.value,signingBonusEUR:world.advancedV1.marketV1.deals[id].offer.type==='loan'?0:val('mkt-signing')}));
        ui.modal={type:'market-deal',id};render();toast('Proposta contrattuale inviata.');break;
      }
      case 'market-player-response':{
        const d=world.advancedV1.marketV1.deals[id],val=marketValuation(world,d.playerId,d.buyerKey);
        const accepted=d.offer.type==='loan'||d.terms.annualWage/52>=val.weeklyWageEUR*(d.terms.promisedRole==='leader'?.85:d.terms.promisedRole==='starter'?.94:1);
        const rev=world.advancedV1.marketV1.revision;
        await runCheckpointed('before-transfer',()=>answerMarketPlayer(world,{revision:rev,dealId:id,decision:accepted?'accept':'counter',annualWageEUR:accepted?null:Math.ceil(val.weeklyWageEUR*52/100)*100}));
        ui.modal={type:'market-deal',id};render();toast('Risposta del calciatore registrata.');break;
      }
      case 'scout-assign':{
        const get=n=>document.getElementById(n)?.value;
        await runCheckpointed('before-transfer',()=>assignScoutingMission(world,{revision:world.advancedV1.scoutingV1.revision,countryId:get('scout-mission-country'),position:get('scout-mission-position'),ageMin:Number(get('scout-mission-age-min')),ageMax:Number(get('scout-mission-age-max')),contractMax:Number(get('scout-mission-contract')),weeks:Number(get('scout-mission-weeks'))}));ui.page='market';render();toast('Missione osservatori avviata.');break;
      }
      case 'scout-cancel':await runCheckpointed('before-transfer',()=>cancelScoutingMission(world,{revision:world.advancedV1.scoutingV1.revision,id}));render();break;
      case 'scout-shortlist':case 'scout-remove-shortlist':{
        await runCheckpointed('before-transfer',()=>shortlistScoutedPlayer(world,{revision:world.advancedV1.scoutingV1.revision,playerId:id,add:action==='scout-shortlist'}));render();break;
      }
      case 'scout-refresh':await runCheckpointed('before-transfer',()=>refreshScoutingReport(world,{revision:world.advancedV1.scoutingV1.revision,playerId:id}));render();break;
      case 'market-book':{
        const day=Number(document.getElementById('mkt-effective-day')?.value??NaN);
        await runCheckpointed('before-transfer',()=>bookCareerTransfer(world,{revision:world.advancedV1.calendarV1.revision,dealId:id,effectiveDay:day}));
        ui.modal=null;ui.page='market';render();toast('Trasferimento prenotato.');break;
      }
      case 'market-cancel-book':{
        if(!confirmAction(ui.language==='en'?'Cancel this booking and release reserved budget?':'Annullare la prenotazione e liberare i fondi riservati?'))break;
        await runCheckpointed('before-transfer',()=>cancelCareerBooking(world,{revision:world.advancedV1.calendarV1.revision,dealId:id}));ui.modal=null;ui.page='market';render();toast('Prenotazione annullata.');break;
      }
      case 'market-release-selected':{const selected=document.getElementById('mkt-release-player')?.value;if(!selected)break;
        if(!confirmAction(ui.language==='en'?'Release the player by mutual consent?':'Svincolare il giocatore con consenso reciproco?'))break;
        await runCheckpointed('before-transfer',()=>releaseCareerFreeAgent(world,{revision:world.advancedV1.calendarV1.revision,playerId:selected,consent:true}));ui.modal=null;ui.page='market';render();toast('Giocatore svincolato.');break;
      }
      case 'market-release-free':{
        if(!confirmAction(ui.language==='en'?'Release the player by mutual consent?':'Svincolare il giocatore con consenso reciproco?'))break;
        await runCheckpointed('before-transfer',()=>releaseCareerFreeAgent(world,{revision:world.advancedV1.calendarV1.revision,playerId:id,consent:true}));ui.modal=null;ui.page='market';render();toast('Giocatore svincolato.');break;
      }
      case 'market-sign-free':{
        const wage=Number(document.getElementById('mkt-free-wage')?.value??NaN);
        const years=Number(document.getElementById('mkt-free-years')?.value??NaN);
        await runCheckpointed('before-transfer',()=>signCareerFreeAgent(world,{revision:world.advancedV1.calendarV1.revision,playerId:id,buyerKey:world.countryId+':club:'+world.clubId,annualWageEUR:wage,years}));ui.modal=null;ui.page='market';render();toast('Svincolato registrato.');break;
      }
      case 'market-complete':{
        if(calendarEnabled(world))throw Error('Usa la registrazione programmata MKT02.');
        if(!confirmAction(ui.language==='en'?'Finalize transfer and commit fees, roster, salary and liabilities?':'Confermare trasferimento, rosa, ingaggi, budget e debiti?'))break;
        const rev=world.advancedV1.marketV1.revision;
        await runCheckpointed('before-transfer',()=>completeMarketDeal(world,{revision:rev,dealId:id}));
        ui.modal=null;ui.page='market';render();toast('Trasferimento completato e salvato.');break;
      }
      case 'buy':{
        if(marketEnabled(world))throw Error('Usa la trattativa MKT01, non l’acquisto istantaneo.');
        const p=playerById(world,id);if(!confirmAction(`Acquistare ${p.name} per il tuo club?`))break;
        const fee=await runCheckpointed('before-transfer',()=>signPlayer(world,Number(id)));ui.modal=null;toast(`Acquisto completato · ${Math.round(fee/1e5)/10} M€.`);break;
      }
      case 'sell':{
        if(marketEnabled(world))throw Error('Usa la trattativa MKT01, non la cessione istantanea.');
        const p=playerById(world,id);if(!confirmAction(`Confermi la cessione di ${p.name}? Il trasferimento è immediato.`))break;
        await runCheckpointed('before-transfer',()=>sellPlayer(world,Number(id)));ui.modal=null;toast(`${p.name} ceduto con successo.`);break;
      }
      case 'mark-all':world.inbox.forEach(m=>m.read=true);world.unread=0;refresh('Tutti i messaggi sono stati letti.');break;
      case 'read-mail':{
        const msg=world.inbox.find(m=>m.id===id);if(!msg)break;
        msg.read=true;world.unread=world.inbox.filter(m=>!m.read).length;
        ui.openMail=ui.openMail===id?null:id;refresh();break;
      }
      case 'export-blocked-save':{
        let keys=[STORAGE_KEY,PREVIOUS_CAREER_STORAGE_KEY,LEGACY_CAREER_STORAGE_KEY];
        try{const catalog=readCareerCatalog(careerStorage);const active=catalog.slots.find(s=>s.id===catalog.activeSlotId);if(active)keys=[active.storageKey,...keys];}catch{}
        const original=keys.map(key=>careerStorage.getItem(key)).find(Boolean);
        if(original)downloadText(original,'football-architect-original-save.json');
        break;
      }
      case 'export':downloadJSON();toast('Salvataggio esportato in JSON.');break;
      case 'import':showCareers();document.getElementById('career-import-file')?.click();break;
      case 'reset':showCareers();break;
      case 'no-op':break;
    }
  }catch(err){
    if(err?.name==='QuotaExceededError'||['checkpoint_too_large','slot_write_failed','backup_failed','write_failed'].includes(err?.code)){
      emergencyWorldRaw=JSON.stringify(world);
      ui.storageWarning=(ui.language==='en'?'Storage error. Use Emergency export to safeguard your career. ':'Errore di archiviazione. Usa Esporta emergenza per salvare la carriera. ')+(err.message||'');
      render();
    }
    reportError(err.message||'Si è verificato un errore.');console.error(err);
  }
  finally {
    try {
      const result=await primary.commit();
      if(result.changed)void queueVaultSync();
    } catch(error) {
      primary.rollback();
      try{world=loadActiveCareer(careerStorage,validateSave,makeWorld);}catch{world=previousWorld;}
      blockedSaveError=error;ui.storageWarning='Salvataggio IndexedDB non verificato: operazioni bloccate. Esporta un backup di emergenza. '+(error.message||'');
      reportError(readableStorageError(error));render();
    } finally {actionBusy=false;}
  }
});
root.addEventListener('input',ev=>{
  const el=ev.target;
  if(el?.matches?.('[data-qol03-search]')){const id=el.dataset.qol03Search,p=qol03TablePref(id);p.query=el.value.slice(0,100);p.page=0;qol03UpdateTable(id);qol03Save();return;}
  if(!(el instanceof HTMLInputElement))return;
  updateFieldShell(el);
  if(el.id==='manager-name'){ui.managerDraft=el.value;return;}
  if(el.id==='career-name'){
    el.removeAttribute('aria-invalid');
    const error=document.getElementById('career-name-error');if(error)error.hidden=true;
    return;
  }
  if(el.id==='squad-search'||el.id==='market-search'||el.id==='scout-search'){
    ui[el.id==='squad-search'?'squadSearch':el.id==='scout-search'?'scoutSearch':'marketSearch']=el.value;
    if(!ev.isComposing&&!el.dataset.composing)scheduleSearchRender(el);
  }
});
root.addEventListener('compositionstart',ev=>{
  if(ev.target?.matches?.('#squad-search,#market-search,#scout-search')){
    ev.target.dataset.composing='true';clearTimeout(searchTimer);
  }
});
root.addEventListener('compositionend',ev=>{
  if(ev.target?.matches?.('#squad-search,#market-search,#scout-search')){
    delete ev.target.dataset.composing;scheduleSearchRender(ev.target);
  }
});
root.addEventListener('change',async ev=>{
  const selected=ev.target;
  if(selected.matches('[data-world-history-season]')){ui.worldHistorySeason=Number(selected.value);render();return;}
  if(selected.matches('[data-adv-preset],[data-adv-phase],[data-adv-role],[data-adv-duty],[data-sim03-role],[data-sim03-duty]')){
    if(actionBusy)return;actionBusy=true;
    try{
      if(!hasAdvancedCareer(world))throw new Error('Attiva prima il motore avanzato.');
      const original=world;world=structuredClone(world);
      try {
      if(selected.matches('[data-sim03-role],[data-sim03-duty]')){
        const index=Number(selected.dataset.index);
        const role=root.querySelector('#sim03-role-select')?.value;
        const duty=root.querySelector('#sim03-duty-select')?.value;
        setCareerSlotRole(world,{index,role,duty});
      }else if(selected.matches('[data-adv-preset]')){if(selected.value==='custom')return;setAdvancedStyle(world,selected.value);}
      else if(selected.matches('[data-adv-phase]'))editAdvancedTactic(world,selected.dataset.advPhase,selected.dataset.advField,selected.type==='checkbox'?selected.checked:Number(selected.value));
      else {
        const playerId=Number(selected.dataset.player);
        const line=root.querySelector(`[data-adv-role][data-player="${playerId}"]`)?.closest('tr');
        const role=line?.querySelector('[data-adv-role]')?.value, duty=line?.querySelector('[data-adv-duty]')?.value;
        setAdvancedPlayerRole(world,playerId,role,duty);
      }
      if(!save())throw new Error('Modifica annullata: salvataggio non riuscito.');
      await primary.commit();
      void queueVaultSync();
      render();toast(ui.language==='en'?'Advanced tactics updated.':'Istruzioni avanzate aggiornate.');
      } catch(error){world=original;primary.rollback();throw error;}
    }catch(error){reportError(error.message);render();}
    finally{actionBusy=false;}
    return;
  }
  if(selected.matches('[data-training-session],[data-training-session-intensity],[data-training-program],[data-training-goal],[data-training-intensity],[data-training-focus]')){
    if(actionBusy)return;actionBusy=true;
    try{
      if(selected.matches('[data-training-session],[data-training-session-intensity]')){
        const index=Number(selected.dataset.trainingSession??selected.dataset.trainingSessionIntensity);
        const kind=root.querySelector(`[data-training-session="${index}"]`)?.value;
        const requested=Number(root.querySelector(`[data-training-session-intensity="${index}"]`)?.value);
        const intensity=['rest','recovery'].includes(kind)?0:requested||(kind==='technical'?50:kind==='tactical'?45:55);
        await changeOfficialTraining(w=>configureCareerSession(w,index,kind,intensity));
      }else{
        const row=selected.closest('[data-training-player-row]');
        const id=Number(row?.dataset.trainingPlayerRow);
        const program=row?.querySelector('[data-training-program]')?.value;
        const goal=row?.querySelector('[data-training-goal]')?.value;
        const intensity=Number(row?.querySelector('[data-training-intensity]')?.value);
        const focus=row?.querySelector('[data-training-focus]')?.value;
        await changeOfficialTraining(w=>configureCareerIndividual(w,id,program,{goal,intensity,focus:focus?[focus]:[]}));
      }
    }catch(error){reportError(error.message);render();}
    finally{actionBusy=false;}
    return;
  }
  if(ev.target.matches('[data-addon-player]')){const candidate=Number(ev.target.value);if(world.players.some(p=>p.id===candidate&&p.clubId===world.clubId)){ui.advancedPlayerId=candidate;render();}return;}

  const el=ev.target;
  if(el.matches('[data-qol03-widget]')){const key=el.dataset.qol03Widget;ui.qol03.hidden=el.checked?ui.qol03.hidden.filter(x=>x!==key):[...ui.qol03.hidden,key];qol03Save();render();return;}
  if(el.id==='qol03-mail-filter'){ui.qol03.mailFilter=el.value;qol03Save();render();return;}
  if(el.matches('[data-qol03-mail-note]')){ui.qol03.mailNotes[el.dataset.qol03MailNote]=el.value.slice(0,500);qol03Save();return;}
  if(el.matches('[data-qol03-sort2]')){const id=el.dataset.qol03Sort2,p=qol03TablePref(id);p.sort2=el.value===''?null:Number(el.value);p.page=0;qol03UpdateTable(id);qol03Save();return;}
  if(el.matches('[data-qol03-sort]')){const id=el.dataset.qol03Sort,p=qol03TablePref(id);p.sort=el.value===''?null:Number(el.value);p.page=0;qol03UpdateTable(id);qol03Save();return;}
  if(el.matches('[data-watchlist-only]')){ui.marketOnlyWatched=el.checked;render();return;}
  if(el.matches('[data-language-switch]')){ui.language=saveLanguage(el.value);render();return;}
  if(el.id==='squad-sort'){ui.squadSort=el.value;render();}
  if(el.id==='ply01-attribute'){ui.qol03.rosterAttribute=el.value;qol03Save();render();return;}
  if(el.id==='ply01-minimum'){ui.qol03.rosterMinimum=Number(el.value);qol03Save();render();return;}
  if(el.id==='ply01-compare-player'){ui.comparePlayerId=el.value==='none'?null:Number(el.value);render();return;}
  if(el.id==='market-position'){ui.marketPosition=el.value;render();}
  if(el.id==='career-import-mode'){ui.importMode=el.value;ui.importTarget='';render();return;}
  if(el.id==='career-import-target'){ui.importTarget=el.value;return;}
  if(el.id==='home-import-file'||el.id==='career-import-file'||el.id==='import-file'){const file=el.files?.[0];if(file)void runBusyAction('career-import',()=>handleImport(file));el.value='';}
});
root.addEventListener('input',ev=>{
  const el=ev.target;
  if(!el.matches('.selection-slider'))return;
  const out=el.closest('.selection-range')?.querySelector('output');
  if(out)out.textContent=`${el.value}${el.dataset.unit||''}`;
  el.style.setProperty('--range-position',`${Math.max(0,Math.min(100,(Number(el.value)-Number(el.min))/(Number(el.max)-Number(el.min))*100))}%`);
});
// Trap Tab in the mobile navigation drawer; Escape returns focus to the trigger.
// UX2-01: remember expanded sections for the current session only.
// This does not touch the authoritative world, IndexedDB or localStorage.
root.addEventListener('toggle',ev=>{
  const details=ev.target;
  if(!(details instanceof HTMLDetailsElement)||!details.matches('[data-nav-group]')||!root.contains(details))return;
  ui.navOpenGroups??={};
  ui.navOpenGroups[details.dataset.navGroup]=details.open;
},true);
root.addEventListener('keydown',ev=>{
  if(!ui.sidebarOpen||!drawerQuery.matches)return;
  if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();toggleDrawer(false);return;}
  if(ev.key!=='Tab'||!ev.target.closest('#club-sidebar'))return;
  const focusables=[...root.querySelectorAll('#club-sidebar button:not([disabled]),#club-sidebar summary,#club-sidebar [tabindex="0"]')].filter(el=>!el.closest('[inert]')&&!el.closest('details:not([open])'));
  const first=focusables[0],last=focusables.at(-1);
  if(ev.shiftKey&&ev.target===first){ev.preventDefault();last?.focus();}
  else if(!ev.shiftKey&&ev.target===last){ev.preventDefault();first?.focus();}
});
root.addEventListener('keydown',ev=>{
  if(ev.altKey&&!ev.ctrlKey&&!ev.metaKey&&!ev.target.closest('input,textarea,select')){
    if(ev.key==='ArrowLeft'){ev.preventDefault();qol03Back();return;}
    const dest={'1':'dashboard','2':'calendar','3':'league','4':'world','5':'market','6':'inbox'}[ev.key];
    if(dest&&world.clubId){ev.preventDefault();navigate(dest);focusPage();return;}
  }
  if(ev.key==='Escape'&&ev.target?.matches?.('.field-shell input')&&ev.target.value){
    ev.preventDefault();ev.stopPropagation();clearField(ev.target.id);return;
  }
  if(ev.key==='Enter'&&ev.target.id==='career-name'){ev.preventDefault();root.querySelector('[data-action="career-rename-confirm"]')?.click();return;}
  if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('tr[data-action]')){ev.preventDefault();ev.target.click();}
});
// Capture keyboard focus inside dialogs before underlying navigation shortcuts.
root.addEventListener('keydown',ev=>{dialogCoordinator.keydown(ev);},true);
render();
queueVaultSync();

// UX2-06: keyboard navigation for the four non-persistent tactical panels.
root.addEventListener('keydown',ev=>{
 const button=ev.target.closest?.('[role="tab"][data-action="ux206-tab"]');
 if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;
 const tabs=[...root.querySelectorAll('[role="tab"][data-action="ux206-tab"]')];
 const index=tabs.indexOf(button);if(index<0)return;
 const next=ev.key==='Home'?0:ev.key==='End'?tabs.length-1:(index+(ev.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 ev.preventDefault();tabs[next]?.click();
});
// UX2-05: accessible left/right/home/end tab navigation and a read-only cost preview.
root.addEventListener('keydown',ev=>{
 const button=ev.target.closest?.('[role="tab"][data-action="ux205-tab"]');
 if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;
 const tabs=[...root.querySelectorAll('[role="tab"][data-action="ux205-tab"]')];
 const index=tabs.indexOf(button);if(index<0)return;
 const next=ev.key==='Home'?0:ev.key==='End'?tabs.length-1:(index+(ev.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 ev.preventDefault();tabs[next]?.click();
});
function ux205UpdateCostPreview(){
 const summary=root.querySelector('#market-offer-summary');if(!summary)return;
 const val=id=>Number(root.querySelector('#'+id)?.value||0);
 const costs=marketCostPreview({fee:val('mkt-fee'),bonus:val('mkt-bonus'),installment:val('mkt-installment'),salary:val('mkt-salary')});
 const fmt=value=>displayCareerMoney(value,{countryId:world.countryId,lang:ui.language});
 for(const [id,value] of [['ux205-upfront',costs.immediate],['ux205-installment',costs.installment],['ux205-salary',costs.annualWage]]){
  const output=summary.querySelector('#'+id);if(output)output.textContent=fmt(value);
 }
}
root.addEventListener('input',ev=>{if(['mkt-fee','mkt-bonus','mkt-installment','mkt-salary'].includes(ev.target?.id))ux205UpdateCostPreview();});
// MKT01: optional international catalogue filter (UI-only; never written to a save).
root.addEventListener('change',ev=>{if(ev.target?.id==='market-country'){ui.marketCountry=ev.target.value;render();}else if(ev.target?.id==='scout-country'){ui.scoutCountry=ev.target.value;render();}else if(ev.target?.id==='scout-position'){ui.scoutPosition=ev.target.value;render();}else if(ev.target?.id==='scout-only-shortlist'){ui.scoutShortlistOnly=ev.target.checked;render();}});

root.addEventListener('change',ev=>{if(ev.target?.id==='mkt-type'&&ev.target.value==='loan'){
 const fee=document.getElementById('mkt-fee');if(fee)fee.value=String(Math.max(1000,Math.round(Number(fee.value)*.015/1000)*1000));
 const salary=document.getElementById('mkt-salary');if(salary)salary.title=ui.language==='en'?'Existing wage retained for loans':'Il prestito mantiene lo stipendio originale';
}});

root.addEventListener('change',ev=>{if(ev.target?.id==='mkt-type')queueMicrotask(ux205UpdateCostPreview);});
