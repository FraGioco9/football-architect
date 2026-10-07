import {readPrefs,writePrefs,moveWidget} from './qol03.js';
import {makeWorld,FORMATIONS} from './data.js';
import {leagueById} from './leagues.js';
import {view,inboxDetailHtml} from './ui.js';
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
import {parseAppRoute,pagePath,playerPath,matchPreviewPath} from './router.js';
import {createControlHints} from './controls-system.js';
import {createDialogCoordinator} from './dialog-system.js';
import {createFeedbackCenter} from './feedback-system.js';
import {ensureCareerDates,fixtureIsDue,nextFixtureDate,addDaysISO,formatCareerDate} from './domain/career-date.js';
import {firstCareerInputMessage} from './domain/history.js';
import {ensureOfficialCareerSystems,officialCareerSystemsReady} from './domain/career-official.js';
import {MARKET_VIEWS,marketCostPreview} from './market-view-model.js';
import {displayCareerMoney} from './domain/career-locale.js';
import {preferredLanguage, saveLanguage, translateUi, translate, pageTitle, GAME_NAME} from './i18n.js';
import {CAREER_STORAGE_KEY,PREVIOUS_CAREER_STORAGE_KEY,LEGACY_CAREER_STORAGE_KEY,persistCareer,parseCareerJson} from './storage.js';
import {CAREER_CATALOG_KEY,readCareerCatalog} from './career-catalog.js';
import {loadActiveCareer,migrateCurrentCareerToSlot,saveCareerToSlot} from './career-slots.js';
import {listCareerSlots,switchCareerSlot,renameCareerSlot,duplicateCareerSlot,deleteCareerSlot} from './career-management.js';
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
let continuousAdvanceToken=0;
const CONTINUOUS_ADVANCE_DELAY_MS=60;
function stopPreviewTimer(){if(previewTimer!==null){clearInterval(previewTimer);previewTimer=null;}}
const root=document.getElementById('app');
let blockedSaveError=null;
let emergencyWorldRaw=null;
let vaultSync=Promise.resolve();
const careerVault=createIndexedDbVault();
let pendingNewCatalogSlot=false;
let newCareerDraft=null;
let newCareerReturnPath='/';
let world=load();
ensureCareerDates(world);
const officialSystemMigration=world.clubId?ensureOfficialCareerSystems(world):{changed:false,enabled:[],status:null};
// The startup v1->slot migration is not complete until this commit succeeds.
await primary.commit();
let ui={matchPreview:null,previewRecoveryError:null,previewSaved:false,continuing:false,continuationBlocker:null,languageMenu:null,pendingRoute:null,routeKind:'page',routePath:'/',routeReturnPage:null,routeNotFoundPath:null,routeMatchId:null,routePlayerId:null,language:preferredLanguage(),page:'home',chosenClub:1,managerDraft:'',managerNameError:false,squadSearch:'',squadFilter:'ALL',squadAvailability:'all',squadSort:'position',squadSortDir:'asc',squadSortCustom:false,squadView:'general',squadAttributeGroup:'technical',squadContractFilter:'all',squadAgeMin:'',squadAgeMax:'',squadOvrMin:'',squadOvrMax:'',squadFitnessMin:'',squadMoraleMin:'',squadValueMin:'',squadWageMax:'',squadFilterAttribute:'ALL',squadFilterAttributeMin:'',squadAttribute:'ALL',squadMinimum:1,comparePlayerId:null,playerTab:'attributes',playerAttributeGroup:'technical',marketSearch:'',marketPosition:'ALL',marketCountry:'ALL',marketOnlyWatched:false,marketTab:'explore',tacticsTab:'formation',scoutSearch:'',scoutCountry:'ALL',scoutPosition:'ALL',scoutShortlistOnly:false,advancedTab:'players',worldCountry:null,worldClub:null,worldPlayer:null,worldHistorySeason:null,advancedPlayerId:null,calendarRound:null,calendarSeason:null,calendarCompetition:'all',calendarAutoFocus:false,sidebarOpen:false,navOpenGroups:{},modal:null,openMail:null,inboxSelected:[],careers:null,checkpoints:[],importPreview:null,importMode:'add',importTarget:'',importCatalogRaw:null,importBackups:[],vaultState:'pending',vaultIds:[],storageWarning:null,storageEstimate:null,careerMoreId:null,contractFocusId:null};
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
function qol03Scope(){return String(activePreviewSlot()||'local');}
function qol03Load(){ui.qol03=readPrefs(window.localStorage,qol03Scope());return ui.qol03;}
function qol03Save(){return writePrefs(window.localStorage,qol03Scope(),ui.qol03);}
function stopContinuousAdvance({renderNow=false}={}){
  const wasRunning=Boolean(ui.continuing);
  continuousAdvanceToken++;
  ui.continuing=false;
  if(wasRunning)void queueVaultSync();
  if(renderNow&&wasRunning)render();
  return wasRunning;
}
const continuousAdvancePause=()=>new Promise(resolve=>setTimeout(resolve,CONTINUOUS_ADVANCE_DELAY_MS));

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
function createNewCareerDraft(){
  newCareerDraft=makeWorld();
  ui.chosenClub=1;ui.managerDraft='';ui.managerNameError=false;
  return newCareerDraft;
}
function discardNewCareerDraft(){
  newCareerDraft=null;ui.chosenClub=1;ui.managerDraft='';ui.managerNameError=false;
}
function languageOptions(context){return [...root.querySelectorAll(`[data-language-listbox="${context}"] [role="option"]`)];}
function focusLanguageOption(context,index=null){
  queueMicrotask(()=>{
    const options=languageOptions(context);if(!options.length)return;
    const selected=Math.max(0,options.findIndex(option=>option.getAttribute('aria-selected')==='true'));
    const target=index===null?selected:((index%options.length)+options.length)%options.length;
    options[target]?.focus({preventScroll:true});
  });
}
function focusLanguageCombobox(context){
  queueMicrotask(()=>root.querySelector(`[data-language-picker="${context}"] [role="combobox"]`)?.focus({preventScroll:true}));
}
function openLanguageMenu(context,{focusOption=false,index=null}={}){
  ui.languageMenu=context;render();
  if(focusOption)focusLanguageOption(context,index);else focusLanguageCombobox(context);
}
function closeLanguageMenu(context,{restoreFocus=true}={}){
  if(ui.languageMenu!==context)return;
  ui.languageMenu=null;render();
  if(restoreFocus)focusLanguageCombobox(context);
}
function chooseLanguage(language,context){
  if(!['it','en'].includes(language))return;
  ui.language=saveLanguage(language);ui.languageMenu=null;render();focusLanguageCombobox(context);
}
function tabFromLanguageMenu(context,backward=false){
  ui.languageMenu=null;render();
  queueMicrotask(()=>{
    const focusable=[...root.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(element=>!element.closest('[hidden],[inert]')&&element.getClientRects().length);
    const combo=root.querySelector(`[data-language-picker="${context}"] [role="combobox"]`);
    const index=focusable.indexOf(combo);
    if(backward)combo?.focus({preventScroll:true});
    else focusable[index+1]?.focus({preventScroll:true});
  });
}
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
  if(id!=='market-search'&&id!=='scout-search')return;
  ui[id==='scout-search'?'scoutSearch':'marketSearch']=input.value;
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
  if(id==='market-search'||id==='scout-search'){
    clearTimeout(searchTimer);
    render({focus:{id,start:0,end:0}});
  }
}
function closeModalUi(){
  const careerMoreId=ui.page==='careers'?ui.careerMoreId:null;
  ui.modal=null;render();
  if(careerMoreId)queueMicrotask(()=>root.querySelector(`[data-action="career-more"][data-id="${careerMoreId}"]`)?.focus({preventScroll:true}));
}
const dialogCoordinator=createDialogCoordinator(root,document,closeModalUi);
const controlHints=createControlHints(root,document);
function reconcileRenderedRoute(){
  if(ui.routeKind==='not-found'||ui.routeKind==='new-career'||ui.routeKind==='match-preview')return;
  if(ui.routeKind==='player')return;
  if(ui.pendingRoute&&ui.page==='careers')return;
  const target=ui.page==='home-settings'?'/settings':pagePath(ui.page);
  if(target&&(window.location.pathname!==target||window.location.search)){
    ui.routeKind='page';ui.routePath=target;ui.routeNotFoundPath=null;ui.routeMatchId=null;
    writeRoute(target,{replace:true});
  }
}
function render({focus}={}){
  reconcileRenderedRoute();
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
  const renderedWorld=ui.page==='new-career'&&newCareerDraft?newCareerDraft:world;
  root.innerHTML=view(renderedWorld,ui);
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
  document.title=ui.page==='not-found'?(ui.language==='en'?'Page not found':'Pagina non trovata')+' · '+GAME_NAME:ui.page==='new-career'?(ui.language==='en'?'New career':'Nuova carriera')+' · '+GAME_NAME:['home','home-settings'].includes(ui.page)?(ui.language==='en'?'Main menu':'Menu principale')+' · '+GAME_NAME:ui.page==='match-preview'?(ui.language==='en'?'Match preview':'Anteprima partita')+' · '+GAME_NAME:ui.page==='careers'?pageTitle('careers',ui.language):world.clubId?pageTitle(ui.page,ui.language):GAME_NAME;
  if(focus){const input=document.getElementById(focus.id);if(input){input.focus();try{input.setSelectionRange(focus.start,focus.end);}catch{}}}
  window.scrollTo(0,y);
  if(ui.page==='calendar'&&ui.calendarAutoFocus){
    ui.calendarAutoFocus=false;
    requestAnimationFrame(()=>root.querySelector('#calendar-current-anchor')?.scrollIntoView({block:'center'}));
  }
  if(ui.page==='squad'&&ui.contractFocusId){
    const offerId=String(ui.contractFocusId);ui.contractFocusId=null;
    requestAnimationFrame(()=>{
      const offer=document.getElementById(`contract-offer-${offerId}`);
      if(!offer)return;
      offer.scrollIntoView({block:'center',behavior:'auto'});
      (offer.querySelector('.btn-primary')||offer).focus({preventScroll:true});
    });
  }
  if(ui.page==='inbox')syncInboxSelectionChrome();
}

function qol03Enhance(){
 if(!world.clubId||['careers','match-preview','new-career'].includes(ui.page))return;
 const en=ui.language==='en',main=root.querySelector('#main-content');if(!main)return;
 const crumbs=root.querySelector('.breadcrumb');
 if(crumbs){const back=document.createElement('button');back.type='button';back.className='qol03-back';back.dataset.action='qol03-back';back.textContent=en?'← Back':'← Indietro';back.setAttribute('aria-label',en?'Go to previous page':'Torna alla pagina precedente');crumbs.prepend(back);}
 if(ui.page==='dashboard'){
  const widgets=new Map([['kpis',main.querySelector('.kpi-grid')],['fixtures',main.querySelector('.dashboard-two:not(.dashboard-two-bottom)')],['results',main.querySelector('.dashboard-two-bottom')]]);
  const holder=document.createElement('div');holder.className='qol03-widgets';main.querySelector('.dashboard-hero')?.after(holder);
  for(const key of ui.qol03.widgets){const el=widgets.get(key);if(!el)continue;el.hidden=ui.qol03.hidden.includes(key);el.dataset.qol03Widget=key;holder.append(el);}
 }
}
function toast(message,level='success'){
  feedback.notify(translate(message,ui.language),{level});
}
function reportError(message){
  const raw=String(message??'');
  const internal=/^(?:SIM|WRD|MGT|PLY|QOL|MKT|ARC|DATA|INT|OPS|CAREER_[A-Z0-9_]*|CAREER[A-Z0-9_]*)[A-Z0-9_:-]*$/i.test(raw);
  toast(internal?(ui.language==='en'?'Unable to complete this operation.':'Impossibile completare questa operazione.'):raw,'error');
}
async function changeOfficialTraining(modify){
  if(!hasAdvancedCareer(world))throw new Error('Questa funzione non è ancora disponibile in questo salvataggio.');
  const before=world,updated=structuredClone(world);
  try{
    modify(updated);world=updated;
    if(!save())throw new Error('Il salvataggio non è stato verificato.');
    await primary.commit();void queueVaultSync();
    render();toast(ui.language==='en'?'Training updated and saved.':'Allenamento aggiornato e salvato.');
  }catch(error){world=before;primary.rollback();render();throw error;}
}
function refresh(message='') {if(save()){render();if(message)toast(message);}}
let inboxReadSaveTimer=null;
function scheduleInboxReadSave(){
  if(inboxReadSaveTimer!==null)clearTimeout(inboxReadSaveTimer);
  inboxReadSaveTimer=setTimeout(()=>{inboxReadSaveTimer=null;save();},500);
}
function syncInboxUnreadChrome(){
  const en=ui.language==='en';
  root.querySelector('[data-inbox-unread-count]')?.replaceChildren(document.createTextNode(en?`${world.unread} unread`:`${world.unread} non letti`));
  const nav=root.querySelector('.nav-item[data-page="inbox"]');
  const badge=nav?.querySelector('.nav-count');
  if(world.unread<=0){badge?.remove();}
  else if(badge){badge.textContent=String(world.unread);}
}
function syncInboxSelectionChrome(){
  const selected=new Set((ui.inboxSelected||[]).map(String));
  const boxes=[...root.querySelectorAll('[data-inbox-select]')];
  let visibleSelected=0;
  for(const box of boxes){box.checked=selected.has(String(box.dataset.inboxSelect));box.closest('.inbox-mail-row')?.classList.toggle('is-selected',box.checked);if(box.checked)visibleSelected++;}
  const all=root.querySelector('[data-inbox-select-all]');
  if(all){all.checked=boxes.length>0&&visibleSelected===boxes.length;all.indeterminate=visibleSelected>0&&visibleSelected<boxes.length;}
  const count=root.querySelector('[data-inbox-selected-count]');
  if(count){count.hidden=visibleSelected===0;count.textContent=ui.language==='en'?`${visibleSelected} selected`:`${visibleSelected} selezionate`;}
}
function selectInboxMessage(id){
  const message=world.inbox.find(m=>String(m.id)===String(id));if(!message)return false;
  const wasUnread=!message.read;
  if(wasUnread){message.read=true;world.unread=world.inbox.filter(m=>!m.read).length;scheduleInboxReadSave();}
  ui.openMail=String(id);
  const workspace=root.querySelector('.inbox-workspace'),detail=root.querySelector('.inbox-detail-pane');
  if(!workspace||!detail)return false;
  workspace.classList.add('has-selection');
  root.querySelectorAll('.inbox-message-list .mail-item').forEach(row=>{
    const active=String(row.dataset.id)===String(id);
    row.classList.toggle('mail-active',active);
    row.closest('.inbox-mail-row')?.classList.toggle('mail-active-row',active);
    if(active)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');
    if(active&&wasUnread){row.classList.remove('unread');row.closest('.inbox-mail-row')?.classList.remove('unread-row');row.querySelector('.mail-date i')?.remove();}
  });
  detail.innerHTML=inboxDetailHtml(world,ui,message);
  syncInboxUnreadChrome();
  return true;
}
// The checkpoint must be verified before a match, transfer or season change.
// On a failed autosave, re-read the authoritative slot rather than showing
// potentially stale, uncommitted world data.
async function runCheckpointed(kind,apply){
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
  }
}
async function commitContinuousAdvanceTick({calendarConfirmationToken=null}={}){
  const before=JSON.stringify(world);
  let result;
  try{
    result=advanceDay(world,{calendarConfirmationToken});
    if(contractsEnabled(world))syncCareerContracts(world);
  }catch(error){
    world=JSON.parse(before);
    throw error;
  }
  if(!save()){
    primary.rollback();
    try{world=loadActiveCareer(careerStorage,validateSave,makeWorld);}catch{world=JSON.parse(before);}
    throw new Error(ui.language==='en'?'Autosave failed. Continuous simulation stopped safely.':'Salvataggio automatico non riuscito. La simulazione continua è stata interrotta in sicurezza.');
  }
  try{await primary.commit();}
  catch(error){primary.rollback();world=JSON.parse(before);throw error;}
  // The primary IndexedDB commit above is authoritative for every day.
  // Mirror the optional recovery vault only when the continuous run stops:
  // mirroring every tick races the changing catalog and can produce stale-copy warnings.
  const blockingMessage=firstCareerInputMessage(world);
  return {result,blockingMessage};
}
function continuousCalendarNotice(){
  const dueNow=fixtureIsDue(world);
  return world.advancedV1?.calendarV1
    ?previewCalendarAdvance(world,{toDay:world.advancedV1.clockDay+(dueNow?0:1)})
    :{requiresConfirmation:false,confirmationToken:null,due:[],closing:[],expiring:[]};
}
async function runContinuousAdvance(){
  if(ui.continuing||blockedSaveError||!world.clubId)return;
  const token=++continuousAdvanceToken;
  ui.continuing=true;ui.continuationBlocker=null;ui.modal=null;render();
  try{
    const existingBlocker=firstCareerInputMessage(world);
    if(existingBlocker){
      ui.continuing=false;ui.continuationBlocker={type:'mail',id:existingBlocker.id};ui.openMail=existingBlocker.id;ui.modal=null;
      navigate('inbox',{replace:true});
      toast(ui.language==='en'?'Simulation stopped: a message requires your input.':'Simulazione interrotta: un messaggio richiede il tuo intervento.','info');
      return;
    }
    await runCheckpointed('before-day',()=>null);
    const checkpointBlocker=firstCareerInputMessage(world);
    if(checkpointBlocker){
      ui.continuing=false;ui.continuationBlocker={type:'mail',id:checkpointBlocker.id};ui.openMail=checkpointBlocker.id;ui.modal=null;
      void queueVaultSync();navigate('inbox',{replace:true});
      toast(ui.language==='en'?'Simulation stopped: a message requires your input.':'Simulazione interrotta: un messaggio richiede il tuo intervento.','info');
      return;
    }
    while(ui.continuing&&token===continuousAdvanceToken&&world.round<world.fixtures.length){
      ensureCareerDates(world);
      const notice=continuousCalendarNotice();
      // MKT02 confirmations acknowledge deterministic processing (registrations,
      // window closures and offer expiries); they are not user decisions.
      // Continuous Continue therefore supplies the verified token automatically.
      const {result,blockingMessage}=await commitContinuousAdvanceTick({
        calendarConfirmationToken:notice.requiresConfirmation?notice.confirmationToken:null
      });
      if(token!==continuousAdvanceToken||!ui.continuing)return;
      ui.calendarRound=world.round;
      if(blockingMessage){
        ui.continuing=false;ui.continuationBlocker={type:'mail',id:blockingMessage.id};ui.openMail=blockingMessage.id;ui.modal=null;
        void queueVaultSync();
        navigate('inbox',{replace:true});
        toast(ui.language==='en'?'Simulation stopped: a message requires your input.':'Simulazione interrotta: un messaggio richiede il tuo intervento.','info');
        return;
      }
      if(boardStatus(world)!=='active'){
        ui.continuing=false;ui.continuationBlocker={type:'board'};ui.modal=null;
        void queueVaultSync();
        navigate('board',{replace:true});
        toast(ui.language==='en'?'Simulation stopped: the board requires your attention.':'Simulazione interrotta: la dirigenza richiede il tuo intervento.','info');
        return;
      }
      render();
      if(result.match)toast(`${formatCareerDate(world.currentDate,ui.language)} · ${ui.language==='en'?'Matchday':'Giornata'} ${world.round} · ${matchText(result.match)}`);
      if(world.round>=world.fixtures.length)break;
      await continuousAdvancePause();
    }
  }catch(error){
    if(token===continuousAdvanceToken){
      ui.continuing=false;ui.continuationBlocker={type:'error'};void queueVaultSync();render();reportError(error.message);
    }
    return;
  }
  if(token===continuousAdvanceToken){
    ui.continuing=false;ui.continuationBlocker=world.round>=world.fixtures.length?{type:'season-end'}:null;void queueVaultSync();render();
    if(world.round>=world.fixtures.length)toast(ui.language==='en'?'Season complete. Review the season before starting the next one.':'Stagione completata. Esamina la stagione prima di avviare la successiva.','info');
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
  stopContinuousAdvance();
  ui={...ui,page,matchPreview:null,previewRecoveryError:null,previewSaved:false,continuing:false,continuationBlocker:null,routeKind:'page',routePath:pagePath(page)||'/dashboard',routeReturnPage:null,routeNotFoundPath:null,routeMatchId:null,chosenClub:1,managerDraft:'',managerNameError:false,modal:null,calendarRound:null,calendarSeason:null,calendarCompetition:'all',calendarAutoFocus:false,openMail:null,sidebarOpen:false,worldCountry:null,worldClub:null,worldPlayer:null,worldHistorySeason:null,squadSearch:'',marketSearch:'',squadFilter:'ALL',squadAvailability:'all',marketPosition:'ALL',marketTab:'explore',careerMoreId:null};
  restorePendingPreview({open:page==='dashboard'});
}
function writeRoute(path,{replace=false,state={}}={}){
  const method=replace?'replaceState':'pushState';
  window.history?.[method]?.({footballArchitectRoute:path,...state},'',path);
}
function deferredRoutePath(route){return `/careers?next=${encodeURIComponent(route.path)}`;}
function deferCareerRoute(route,{replace=false,renderNow=true}={}){
  stopContinuousAdvance();suspendPreview();
  ui.pendingRoute=route;ui.routeKind='page';ui.routePath='/careers';ui.routeReturnPage=null;ui.routeNotFoundPath=null;ui.routeMatchId=null;
  ui.matchPreview=null;ui.page='careers';ui.modal=null;ui.sidebarOpen=false;
  writeRoute(deferredRoutePath(route),{replace,state:{pending:route.path}});
  if(renderNow){render();window.scrollTo(0,0);}
}
function fixtureByRouteId(matchId){
  return world.fixtures.flatMap(round=>round.matches||[]).find(match=>String(match.id)===String(matchId))||null;
}
function applyRoute(route,{replace=false,fromHistory=false,renderNow=true}={}){
  const leavingNewCareer=ui.routeKind==='new-career'&&route?.kind!=='new-career';
  if(leavingNewCareer)discardNewCareerDraft();
  if(!route||route.kind==='not-found'){
    stopContinuousAdvance();suspendPreview();
    ui.pendingRoute=null;ui.routeKind='not-found';ui.routePath=route?.path||window.location.pathname;ui.routeNotFoundPath=route?.path||window.location.pathname;ui.routeReturnPage=null;ui.routeMatchId=null;ui.routePlayerId=null;
    ui.matchPreview=null;ui.modal=null;ui.sidebarOpen=false;ui.page='not-found';
    if(!fromHistory)writeRoute(ui.routePath,{replace});
    if(renderNow){render();window.scrollTo(0,0);}return;
  }
  if(route.requiresCareer&&!world.clubId){deferCareerRoute(route,{replace:replace||fromHistory,renderNow});return;}
  stopContinuousAdvance();suspendPreview();
  ui.pendingRoute=route.pendingTarget??null;ui.routeKind=route.kind;ui.routePath=route.path;ui.routeNotFoundPath=null;ui.routeMatchId=null;ui.routePlayerId=null;ui.sidebarOpen=false;
  if(route.kind==='page'){
    ui.matchPreview=null;ui.modal=null;
    if(route.page==='home')ui.page='home';
    else if(route.page==='settings'&&!world.clubId)ui.page='home-settings';
    else ui.page=route.page;
    if(ui.page==='calendar'){
      if(!ui.calendarRound)ui.calendarRound=Math.min(world.fixtures.length,world.round+1);
      ui.calendarAutoFocus=true;
    }
  }else if(route.kind==='new-career'){
    if(!newCareerDraft)createNewCareerDraft();
    ui.matchPreview=null;ui.modal=null;ui.page='new-career';
  }else if(route.kind==='player'){
    if(!world.players.some(player=>player.id===route.playerId)){
      applyRoute({kind:'not-found',path:route.path},{replace:true,fromHistory,renderNow});return;
    }
    ui.routeReturnPage=isNavigationPage(ui.page)&&ui.page!=='careers'?ui.page:(ui.routeReturnPage||'squad');
    ui.routePlayerId=route.playerId;ui.page='player';ui.playerTab='attributes';ui.playerAttributeGroup='technical';ui.comparePlayerId=null;ui.modal=null;ui.matchPreview=null;
  }else if(route.kind==='match-preview'){
    ui.routeReturnPage=isNavigationPage(ui.page)&&ui.page!=='careers'?ui.page:'calendar';
    const fixture=fixtureByRouteId(route.matchId);
    if(!fixture||fixture.result||!(fixture.home===world.clubId||fixture.away===world.clubId)){
      applyRoute({kind:'not-found',path:route.path},{replace:true,fromHistory,renderNow});return;
    }
    ui.routeMatchId=route.matchId;ui.modal=null;
    if(hasAdvancedCareer(world)){
      ui.matchPreview=null;ui.page='advanced';ui.advancedTab='tactics';
    }else{
      openMatchPreview(route.matchId,{routeManaged:true});
    }
  }
  if(!fromHistory)writeRoute(route.path,{replace,state:{kind:route.kind}});
  if(renderNow){render();window.scrollTo(0,0);if(route.kind==='match-preview'&&!hasAdvancedCareer(world))startPreviewTimer();}
}
function routeFromLocation(){
  const route=parseAppRoute(window.location.pathname);
  if(route.kind==='page'&&route.page==='careers'){
    const next=new URLSearchParams(window.location.search).get('next');
    if(next){
      const target=parseAppRoute(next);
      if(target.kind!=='not-found'&&target.requiresCareer)return {...route,pendingTarget:target};
    }
  }
  return route;
}
function resumePendingRoute({replace=true}={}){
  const pending=ui.pendingRoute;
  if(pending&&world.clubId){ui.pendingRoute=null;applyRoute(pending,{replace});return true;}
  return false;
}
function showCareers({replace=false}={}){
  ui.careerMoreId=null;
  applyRoute(parseAppRoute('/careers'),{replace});
}
function openPlayerRoute(id){
  const path=playerPath(id);if(!path)throw new Error('PLAYER_ROUTE');
  applyRoute(parseAppRoute(path));
}
function openMatchRoute(id){
  const path=matchPreviewPath(id);if(!path)throw new Error('MATCH_ROUTE');
  applyRoute(parseAppRoute(path));
}
function closeRoutedResource(){
  if(ui.routeKind!=='match-preview')return false;
  const fallback=ui.routeReturnPage||'calendar';
  navigate(fallback,{replace:true});
  return true;
}
// UX2-10: the main menu is UI state only. A failed durable commit must
// leave the game visible and cannot create or replace a career slot.
async function returnToMainMenu({confirmDraft=true}={}){
  if(ui.page==='home'&&ui.routePath==='/'){return;}
  if(confirmDraft&&ui.page!=='careers'&&ui.page!=='home-settings'&&!(window.confirm(ui.language==='en'
    ?'Return to the main menu? Unconfirmed form edits will be lost; saved careers will remain intact.'
    :'Tornare al menu principale? Le modifiche non confermate ai moduli andranno perse; le carriere salvate resteranno intatte.')))return;
  if(blockedSaveError)throw blockedSaveError;
  stopContinuousAdvance();
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
  applyRoute(parseAppRoute('/'));
  root.querySelector('#home-title')?.focus({preventScroll:true});
}

function navigate(page,{replace=false,fromHistory=false}={}){
  if(!isNavigationPage(page))return;
  const path=pagePath(page);if(!path)return;
  applyRoute(parseAppRoute(path),{replace,fromHistory});
}
function qol03Back(){
  if(window.history.length>1)window.history.back();
  else navigate(world.clubId?'dashboard':'careers',{replace:true});
}
window.addEventListener('popstate',()=>applyRoute(routeFromLocation(),{fromHistory:true,replace:true}));

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
function openMatchPreview(matchId,{routeManaged=false}={}){
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
  if(!routeManaged){const path=matchPreviewPath(matchId);if(path){ui.routeKind='match-preview';ui.routePath=path;ui.routeMatchId=matchId;writeRoute(path);}}
  if(!routeManaged){render();window.scrollTo(0,0);startPreviewTimer();}
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
    applyRoute(parseAppRoute('/careers'),{renderNow:false});
    ui.modal={type:'career-import-preview'};render();
  }catch(err){reportError(`${ui.language==='en'?'Import failed':'Importazione non riuscita'}: ${readableStorageError(err)}`);}
}
let actionBusy=false;
root.addEventListener('click',async ev=>{
  const target=ev.target.closest('[data-action]');
  if(!target){
    if(ui.languageMenu&&!ev.target.closest('[data-language-picker]')){ui.languageMenu=null;render();}
    return;
  }
  if(ui.languageMenu&&!target.closest('[data-language-picker]'))ui.languageMenu=null;
  const action=target.dataset.action,id=target.dataset.id,field=target.dataset.value,index=Number(target.dataset.index);
  // Stop must remain responsive even while another click action is completing.
  if(action==='stop-advance'){
    if(stopContinuousAdvance({renderNow:true}))toast(ui.language==='en'?'Simulation stopped safely.':'Simulazione interrotta in sicurezza.','info');
    return;
  }
  if(actionBusy)return;
  actionBusy=true;
  let startContinuousAfterCommit=false;
  let stagedNewCareer=null;
  const previousWorld=world;
  dialogCoordinator.noteOpener(target);
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
      case 'qol03-mail-go':navigate(target.dataset.page||'inbox');focusPage();break;
      case 'inbox-back':ui.openMail=null;render();break;
      case 'inbox-input-go':{
        if(field==='contract-counter'){
          const offer=world.advancedV1?.contractsV1?.offers?.[String(id)];
          if(!offer||offer.status!=='awaiting_club'){toast(ui.language==='en'?'This request has already been resolved.':'Questa richiesta è già stata risolta.','info');render();break;}
          ui.contractFocusId=String(id);ui.squadView='contract';navigate('squad');break;
        }
        break;
      }
      case 'clear-field':clearField(target.dataset.target);break;
      case 'language-toggle':{
        const context=String(field||'top');
        if(ui.languageMenu===context)closeLanguageMenu(context);else openLanguageMenu(context);
        break;
      }
      case 'language-option':chooseLanguage(String(field),String(target.dataset.context||'top'));break;
      case 'choose-country':{
        const draftMode=ui.routeKind==='new-career';
        const targetWorld=draftMode?newCareerDraft:world;
        if(!targetWorld||targetWorld.clubId)throw new Error('La nazione può essere scelta soltanto prima di iniziare una carriera.');
        const league=leagueById(id);
        ui.managerDraft=document.getElementById('manager-name')?.value??ui.managerDraft;
        ui.managerNameError=false;ui.chosenClub=1;
        if(draftMode)newCareerDraft=makeWorld(targetWorld.seed,league.id);
        else {world=makeWorld(targetWorld.seed,league.id);save();}
        render();break;
      }
      case 'choose-club':ui.chosenClub=Number(id);render();break;
      case 'start-career':{
        const field=document.getElementById('manager-name');
        const rawName=field?.value??ui.managerDraft??'',managerName=rawName.trim();
        ui.managerDraft=rawName;
        if(!managerName){
          ui.managerNameError=true;
          render({focus:{id:'manager-name',start:rawName.length,end:rawName.length}});
          break;
        }
        ui.managerNameError=false;
        if(ui.routeKind==='new-career'){
          if(!newCareerDraft)throw new Error('NEW_CAREER_DRAFT_MISSING');
          const candidate=structuredClone(newCareerDraft);
          startCareer(candidate,ui.chosenClub,managerName);
          try{saveCareerToSlot(careerStorage,candidate,validateSave,{newCareer:true});}
          catch(error){primary.rollback();throw error;}
          stagedNewCareer={career:candidate,mirrorError:null};
          break;
        }
        startCareer(world,ui.chosenClub,managerName);
        if(!save())throw new Error('Salvataggio carriera non riuscito.');
        const welcome=`Benvenuto al ${myClub(world).name}!`;
        if(!resumePendingRoute())navigate('dashboard',{replace:true});
        toast(welcome);window.scrollTo(0,0);break;
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
        if(!world.clubId){showCareers();break;}
        if(resumePendingRoute()){focusPage();break;}
        restorePendingPreview({open:true});
        if(ui.page==='match-preview'&&ui.matchPreview?.record?.matchId){openMatchRoute(ui.matchPreview.record.matchId);}
        else navigate('dashboard',{replace:true});
        focusPage();break;
      }
      case 'menu-load':case 'menu-manage':showCareers();break;
      case 'menu-settings':case 'menu-open-settings':applyRoute(parseAppRoute('/settings'));focusPage();break;
      case 'menu-import':root.querySelector('#home-import-file')?.click();break;
      case 'career-continue':{
        if(readCareerCatalog(careerStorage).activeSlotId!==id)throw new Error('La carriera selezionata non è attiva.');
        if(!resumePendingRoute())navigate('dashboard',{replace:true});
        focusPage();break;
      }
      case 'career-more':{
        ui.careerMoreId=ui.careerMoreId===id?null:id;
        render();
        queueMicrotask(()=>root.querySelector(`[data-action="career-more"][data-id="${id}"]`)?.focus({preventScroll:true}));
        break;
      }
      case 'career-load':{
        if(!saveBeforeSlotChange())break;
        const selected=switchCareerSlot(careerStorage,id,validateSave);
        world=selected.career;blockedSaveError=null;pendingNewCatalogSlot=false;await migrateActiveCareerSystems();resetCareerUi();
        if(!resumePendingRoute())navigate('dashboard',{replace:true});
        if(selected.mirrorError)reportError(readableStorageError(selected.mirrorError));
        break;
      }
      case 'menu-new':case 'career-new':{
        newCareerReturnPath=action==='career-new'?'/careers':'/';
        createNewCareerDraft();
        applyRoute(parseAppRoute('/careers/new'));
        break;
      }
      case 'new-career-cancel':{
        applyRoute(parseAppRoute(newCareerReturnPath||'/'));
        focusPage();break;
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
        navigate('dashboard',{replace:true});toast(ui.language==='en'?'Checkpoint restored.':'Checkpoint ripristinato.');window.scrollTo(0,0);
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
      case 'preview-match':openMatchRoute(id);if(hasAdvancedCareer(world))toast(ui.language==='en'?'Advanced mode: set tactics before playing; the official report will show the recorded actions.':'Modalità avanzata: prepara le tattiche prima di giocare; il tabellino mostrerà gli eventi registrati.');break;
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
        startContinuousAfterCommit=true;
        break;
      }
      case 'play-matchday':{
        stopContinuousAdvance();
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
        stopContinuousAdvance();
        if(!confirmAction(`Avviare la stagione ${world.season+1}? La classifica e le statistiche stagionali ripartiranno da zero.`))break;
        const res=await runCheckpointed('before-season',()=>newSeason(world));ui.calendarRound=1;navigate('dashboard',{replace:true});toast(`Nuova stagione! ${res.position}° posto e premio ${Math.round(res.prize/1e6*10)/10} milioni €.`);break;
      }
      case 'player':openPlayerRoute(Number(id));break;
      case 'match':ui.modal={type:'match',id};render();break;
      case 'slot':ui.modal={type:'slot',index};render();break;
      case 'close-modal':if(!closeRoutedResource())closeModalUi();break;
      case 'dismiss-modal':if(!ev.target.closest('[data-stop-close]')){if(!closeRoutedResource())closeModalUi();}break;
      case 'formation':changeFormation(world,field);syncCareerTrainingFormation(world);refresh(`Modulo ${field} applicato.`);break;
      case 'auto-lineup':autoLineup(world);refresh('Miglior undici disponibile selezionato.');break;
      case 'assign':assignPlayer(world,index,Number(id));ui.modal=null;refresh('Formazione aggiornata.');break;
      case 'clear-slot':world.lineup[index]=null;ui.modal=null;refresh('Slot liberato.');break;
      case 'tactic':world.tactic=field;refresh(`Mentalità: ${field}.`);restoreRadioFocus();break;
      case 'pressing':world.pressing=field;refresh(`Pressing: ${field}.`);restoreRadioFocus();break;
      case 'tempo':world.tempo=field;refresh(`Ritmo: ${field}.`);restoreRadioFocus();break;
      case 'training':world.training=field;refresh(`Programma ${field} selezionato.`);break;
      case 'squad-filters':ui.modal={type:'squad-filters'};render();break;
      case 'squad-filters-clear':{
        ui.squadSearch='';ui.squadFilter='ALL';ui.squadAvailability='all';ui.squadContractFilter='all';
        ui.squadAgeMin='';ui.squadAgeMax='';ui.squadOvrMin='';ui.squadOvrMax='';ui.squadFitnessMin='';ui.squadMoraleMin='';
        ui.squadValueMin='';ui.squadWageMax='';ui.squadFilterAttribute='ALL';ui.squadFilterAttributeMin='';
        render();break;
      }
      case 'squad-filters-apply':{
        const value=id=>document.getElementById(id)?.value??'';
        const numberValue=id=>{
          const input=document.getElementById(id),raw=String(input?.value??'').trim();
          if(raw==='')return '';
          let n=Number(raw);if(!Number.isFinite(n))return '';
          const min=Number(input?.dataset.min),max=Number(input?.dataset.max);
          if(Number.isFinite(min))n=Math.max(min,n);
          if(Number.isFinite(max))n=Math.min(max,n);
          return n;
        };
        ui.squadSearch=String(value('squad-filter-search')).trim();
        ui.squadFilter=value('squad-filter-role')||'ALL';
        ui.squadAvailability=value('squad-filter-availability')||'all';
        ui.squadContractFilter=value('squad-filter-contract')||'all';
        ui.squadAgeMin=numberValue('squad-filter-age-min');ui.squadAgeMax=numberValue('squad-filter-age-max');
        if(ui.squadAgeMin!==''&&ui.squadAgeMax!==''&&ui.squadAgeMin>ui.squadAgeMax)[ui.squadAgeMin,ui.squadAgeMax]=[ui.squadAgeMax,ui.squadAgeMin];
        ui.squadOvrMin=numberValue('squad-filter-ovr-min');ui.squadOvrMax=numberValue('squad-filter-ovr-max');
        if(ui.squadOvrMin!==''&&ui.squadOvrMax!==''&&ui.squadOvrMin>ui.squadOvrMax)[ui.squadOvrMin,ui.squadOvrMax]=[ui.squadOvrMax,ui.squadOvrMin];
        ui.squadFitnessMin=numberValue('squad-filter-fitness-min');ui.squadMoraleMin=numberValue('squad-filter-morale-min');
        ui.squadValueMin=numberValue('squad-filter-value-min');ui.squadWageMax=numberValue('squad-filter-wage-max');
        ui.squadFilterAttribute=value('squad-filter-attribute')||'ALL';ui.squadFilterAttributeMin=numberValue('squad-filter-attribute-min');
        ui.modal=null;render();break;
      }
      case 'squad-sort-column':{
        const key=String(field||'');if(!key)break;
        if(ui.squadSort!==key){
          ui.squadSort=key;ui.squadSortDir='asc';ui.squadSortCustom=true;
        }else if(!ui.squadSortCustom){
          // First explicit click on the default Role order keeps ASC, but starts the 3-step cycle.
          ui.squadSortDir='asc';ui.squadSortCustom=true;
        }else if(ui.squadSortDir==='asc'){
          ui.squadSortDir='desc';
        }else{
          // Third click: return to the default squad order, Role ascending.
          ui.squadSort='position';ui.squadSortDir='asc';ui.squadSortCustom=false;
        }
        const focusKey=ui.squadSortCustom?key:'position';
        render();
        root.querySelector(`[data-action="squad-sort-column"][data-value="${CSS.escape(focusKey)}"]`)?.focus({preventScroll:true});
        break;
      }
      case 'squad-view':{
        if(!['general','attributes','contract','market','stats','condition'].includes(field))break;
        ui.squadView=field;
        render();
        root.querySelector(`[data-action="squad-view"][data-value="${field}"]`)?.focus({preventScroll:true});
        break;
      }
      case 'squad-attribute-group':{
        if(!['technical','mental','physical','goalkeeper'].includes(field))break;
        ui.squadAttributeGroup=field;render();
        root.querySelector(`[data-action="squad-attribute-group"][data-value="${field}"]`)?.focus({preventScroll:true});
        break;
      }
      case 'player-tab':{
        if(!['attributes','performance','personality','development'].includes(field))break;
        ui.playerTab=field;render();
        root.querySelector(`[data-action="player-tab"][data-value="${field}"]`)?.focus({preventScroll:true});
        break;
      }
      case 'player-attribute-group':{
        if(!['technical','mental','physical','goalkeeper'].includes(field))break;
        ui.playerAttributeGroup=field;ui.comparePlayerId=null;render();
        root.querySelector(`[data-action="player-attribute-group"][data-value="${field}"]`)?.focus({preventScroll:true});
        break;
      }

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
      case 'calendar-filter':ui.calendarCompetition=field||'all';render();break;
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
      case 'dashboard-open-input':{
        const msg=firstCareerInputMessage(world);if(!msg||msg.id!==id)break;
        msg.read=true;world.unread=world.inbox.filter(m=>!m.read).length;ui.openMail=id;
        navigate('inbox');focusPage();break;
      }
      case 'read-mail':selectInboxMessage(id);break;
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
    let commitSucceeded=true;
    try {
      const result=await primary.commit();
      if(result.changed)void queueVaultSync();
    } catch(error) {
      commitSucceeded=false;
      primary.rollback();
      try{world=loadActiveCareer(careerStorage,validateSave,makeWorld);}catch{world=previousWorld;}
      if(stagedNewCareer){
        ui.storageWarning=(ui.language==='en'?'New career could not be saved. Your previous career is unchanged.':'Impossibile salvare la nuova carriera. La carriera precedente non è stata modificata.')+' '+(error.message||'');
        reportError(readableStorageError(error));render({focus:{id:'manager-name',start:ui.managerDraft.length,end:ui.managerDraft.length}});
      }else{
        blockedSaveError=error;ui.storageWarning='Salvataggio IndexedDB non verificato: operazioni bloccate. Esporta un backup di emergenza. '+(error.message||'');
        reportError(readableStorageError(error));render();
      }
    } finally {
      actionBusy=false;
      if(commitSucceeded&&stagedNewCareer){
        world=stagedNewCareer.career;blockedSaveError=null;pendingNewCatalogSlot=false;
        const mirrorError=stagedNewCareer.mirrorError;
        newCareerDraft=null;resetCareerUi();
        if(!resumePendingRoute())navigate('dashboard',{replace:true});
        toast((ui.language==='en'?'Welcome to ':'Benvenuto al ')+myClub(world).name+'!');
        window.scrollTo(0,0);
        if(mirrorError)reportError(readableStorageError(mirrorError));
      }
      if(commitSucceeded&&startContinuousAfterCommit)void runContinuousAdvance();
    }
  }
});
root.addEventListener('input',ev=>{
  const el=ev.target;
  if(!(el instanceof HTMLInputElement))return;
  updateFieldShell(el);
  if(el.id==='manager-name'){ui.managerDraft=el.value;ui.managerNameError=false;el.removeAttribute('aria-invalid');const error=document.getElementById('manager-name-error');if(error)error.hidden=true;return;}
  if(el.id==='career-name'){
    el.removeAttribute('aria-invalid');
    const error=document.getElementById('career-name-error');if(error)error.hidden=true;
    return;
  }
  if(el.id==='market-search'||el.id==='scout-search'){
    ui[el.id==='scout-search'?'scoutSearch':'marketSearch']=el.value;
    if(!ev.isComposing&&!el.dataset.composing)scheduleSearchRender(el);
  }
});
root.addEventListener('compositionstart',ev=>{
  if(ev.target?.matches?.('#market-search,#scout-search')){
    ev.target.dataset.composing='true';clearTimeout(searchTimer);
  }
});
root.addEventListener('compositionend',ev=>{
  if(ev.target?.matches?.('#market-search,#scout-search')){
    delete ev.target.dataset.composing;scheduleSearchRender(ev.target);
  }
});
root.addEventListener('change',async ev=>{
  const selected=ev.target;
  if(selected.matches('[data-calendar-season]')){ui.calendarSeason=Number(selected.value);ui.calendarAutoFocus=ui.calendarSeason===world.season;render();return;}
  if(selected.matches('[data-world-history-season]')){ui.worldHistorySeason=Number(selected.value);render();return;}
  if(selected.matches('[data-adv-preset],[data-adv-phase],[data-adv-role],[data-adv-duty],[data-sim03-role],[data-sim03-duty]')){
    if(actionBusy)return;actionBusy=true;
    try{
      if(!hasAdvancedCareer(world))throw new Error('Questa funzione non è ancora disponibile in questo salvataggio.');
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
  if(el.matches('[data-inbox-select]')){const key=String(el.dataset.inboxSelect),selected=new Set((ui.inboxSelected||[]).map(String));if(el.checked)selected.add(key);else selected.delete(key);ui.inboxSelected=[...selected];syncInboxSelectionChrome();return;}
  if(el.matches('[data-inbox-select-all]')){const boxes=[...root.querySelectorAll('[data-inbox-select]')];ui.inboxSelected=el.checked?boxes.map(box=>String(box.dataset.inboxSelect)):[];for(const box of boxes)box.checked=el.checked;syncInboxSelectionChrome();return;}
  if(el.matches('[data-watchlist-only]')){ui.marketOnlyWatched=el.checked;render();return;}
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
// Squad row hover must move with the content instead of appearing fixed during wheel scrolling.
let rosterScrollVisualTimer=null;
root.addEventListener('wheel',ev=>{
  const shell=ev.target.closest?.('.roster-table-shell');
  if(!shell)return;
  shell.classList.add('is-scrolling');
  clearTimeout(rosterScrollVisualTimer);
  rosterScrollVisualTimer=setTimeout(()=>shell.isConnected&&shell.classList.remove('is-scrolling'),140);
},{passive:true});
root.addEventListener('pointermove',ev=>{
  const shell=ev.target.closest?.('.roster-table-shell');
  if(shell)shell.classList.remove('is-scrolling');
},{passive:true});

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
  const combo=ev.target.closest?.('[data-action="language-toggle"]');
  if(combo){
    const context=String(combo.dataset.value||'top');
    if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){
      ev.preventDefault();
      openLanguageMenu(context,{focusOption:true,index:ev.key==='ArrowDown'?null:(ui.language==='en'?0:1)});
      return;
    }
    if(ev.key==='Escape'&&ui.languageMenu===context){ev.preventDefault();closeLanguageMenu(context);return;}
  }
  const option=ev.target.closest?.('[data-action="language-option"]');
  if(option){
    const context=String(option.dataset.context||'top'),options=languageOptions(context),current=options.indexOf(option);
    if(ev.key==='ArrowDown'||ev.key==='ArrowUp'||ev.key==='Home'||ev.key==='End'){
      ev.preventDefault();
      const next=ev.key==='Home'?0:ev.key==='End'?options.length-1:current+(ev.key==='ArrowDown'?1:-1);
      options[((next%options.length)+options.length)%options.length]?.focus({preventScroll:true});
      return;
    }
    if(ev.key==='Escape'){ev.preventDefault();closeLanguageMenu(context);return;}
    if(ev.key==='Tab'){ev.preventDefault();tabFromLanguageMenu(context,ev.shiftKey);return;}
  }
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
applyRoute(routeFromLocation(),{fromHistory:true,replace:true,renderNow:false});
window.history.replaceState({footballArchitectRoute:window.location.pathname},'',window.location.pathname+window.location.search);
render();
if(ui.routeKind==='match-preview'&&ui.page==='match-preview')startPreviewTimer();
queueVaultSync();

// UX #20 05A: keyboard navigation for squad table views.
root.addEventListener('keydown',ev=>{
 const button=ev.target.closest?.('[role="tab"][data-action="squad-view"]');
 if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;
 const tabs=[...root.querySelectorAll('[role="tab"][data-action="squad-view"]')];
 const index=tabs.indexOf(button);if(index<0)return;
 const next=ev.key==='Home'?0:ev.key==='End'?tabs.length-1:(index+(ev.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 ev.preventDefault();tabs[next]?.click();
});

// UX #20 06A: keyboard navigation for standalone player profile tabs.
root.addEventListener('keydown',ev=>{
 const button=ev.target.closest?.('[role="tab"][data-action="player-tab"]');
 if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;
 const tabs=[...root.querySelectorAll('[role="tab"][data-action="player-tab"]')];
 const index=tabs.indexOf(button);if(index<0)return;
 const next=ev.key==='Home'?0:ev.key==='End'?tabs.length-1:(index+(ev.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 ev.preventDefault();tabs[next]?.click();
});

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
