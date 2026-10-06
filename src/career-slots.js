// QOL01.02 — Physical, verified v1 career slots. The current browser save is
// mirrored for older game versions; old branded keys are never deleted.
import {
  CAREER_STORAGE_KEY,PREVIOUS_CAREER_STORAGE_KEY,LEGACY_CAREER_STORAGE_KEY,
  SAVE_SCHEMA_VERSION,SaveFormatError,saveSchemaVersion,parseCareerJson,loadCareer,
} from './storage.js';
import {
  CAREER_CATALOG_KEY,readCareerCatalog,writeCareerCatalog,newSlotId,
  defaultIdFactory,metadataFromCareer,
} from './career-catalog.js';

export const CAREER_SLOT_PREFIX='football-architect:career:slot:';
export const PENDING_SLOT_MIGRATION_KEY='football-architect:career:migration:pending:v1';
const fail=(code,message)=>{throw new SaveFormatError(code,message);};
const stamp=()=>new Date().toISOString();
const slotKey=id=>`${CAREER_SLOT_PREFIX}${id}`;

function checkedRaw(raw,validate){
  if(typeof raw!=='string'||raw.length===0)fail('missing_slot','Il salvataggio dello slot non è disponibile.');
  return parseCareerJson(raw,validate);
}

// Save source selection intentionally agrees with loadCareer's legacy priority.
// Preserve the raw JSON bytes (including whitespace) rather than serializing it.
function legacySource(storage,validate){
  for(const key of [CAREER_STORAGE_KEY,PREVIOUS_CAREER_STORAGE_KEY,LEGACY_CAREER_STORAGE_KEY]){
    const raw=storage.getItem(key);
    if(!raw)continue;
    try{return {raw,career:checkedRaw(raw,validate),sourceKey:key};}
    catch(err){if(err?.code==='unsupported_version')throw err;}
  }
  return null;
}

function ensureNoFutureFlat(storage){
  const raw=storage.getItem(CAREER_STORAGE_KEY);
  if(!raw)return;
  try{
    const value=JSON.parse(raw),version=saveSchemaVersion(value);
    if(version>SAVE_SCHEMA_VERSION)fail('unsupported_version','La carriera della versione più recente non può essere sovrascritta.');
  }catch(err){if(err instanceof SaveFormatError)throw err;}
}

function verifyWrite(storage,key,raw,validate){
  // A browser setItem is atomic. A failed/quota-limited write leaves the
  // previous value intact; never remove the original on failure.
  storage.setItem(key,raw);
  if(storage.getItem(key)!==raw)fail('slot_write_failed','La copia dello slot non è stata verificata.');
  checkedRaw(storage.getItem(key),validate);
}

function slotRecord(career,existing,id,key,time){
  return metadataFromCareer(career,{
    id,storageKey:key,createdAt:existing?.createdAt||time,lastSavedAt:time,
    name:existing?.clubId===null&&existing.name==='Nuova carriera'&&career.clubId!==null
      ?null:existing?.name,
  });
}
function checkedTime(now){
  const time=now();
  if(typeof time!=='string'||!Number.isFinite(Date.parse(time))||new Date(time).toISOString()!==time){
    fail('invalid_catalog','Data del catalogo non valida.');
  }
  return time;
}
function checkCatalogStable(storage,before){
  if(storage.getItem(CAREER_CATALOG_KEY)!==before)fail('catalog_conflict','Il catalogo è stato modificato durante l’operazione. Riprova.');
}

function pendingMigration(storage){
  const raw=storage.getItem(PENDING_SLOT_MIGRATION_KEY);
  if(raw===null)return null;
  let value;
  try{value=JSON.parse(raw);}catch{fail('migration_conflict','Il registro della migrazione precedente è danneggiato.');}
  if(value?.version!==1||typeof value.id!=='string'
    ||!new RegExp('^[a-zA-Z0-9][a-zA-Z0-9-]{7,79}$').test(value.id)
    ||![CAREER_STORAGE_KEY,PREVIOUS_CAREER_STORAGE_KEY,LEGACY_CAREER_STORAGE_KEY].includes(value.sourceKey)){
    fail('migration_conflict','Registro migrazione non valido: nessun dato verrà sovrascritto.');
  }
  return value;
}
function verifyPending(storage,pending){
  const raw=JSON.stringify(pending);
  storage.setItem(PENDING_SLOT_MIGRATION_KEY,raw);
  if(storage.getItem(PENDING_SLOT_MIGRATION_KEY)!==raw)fail('migration_write_failed','Impossibile verificare il registro di migrazione.');
}
function cleanPending(storage){
  // Non-critical: if cleanup fails after catalogue commit, the next startup
  // can clean it again. A completed catalogue remains the source of truth.
  try{storage.removeItem?.(PENDING_SLOT_MIGRATION_KEY);}catch{/* retry on the next launch */}
}

// Called at startup. An older flat reference is converted to one physical
// slot. This function does NOT create a slot for a never-saved fresh world.
// Successful retries return the existing entry and do not write duplicates.
export function migrateCurrentCareerToSlot(storage,validate,{now=stamp,idFactory=defaultIdFactory}={}){
  const catalog=readCareerCatalog(storage);
  if(storage.getItem(CAREER_CATALOG_KEY)!==null&&catalog.slots.length===0)return {migrated:false,alreadyMigrated:true,entry:null};
  const active=catalog.slots.find(s=>s.id===catalog.activeSlotId);
  if(active?.storageKey!==CAREER_STORAGE_KEY&&active){
    try{checkedRaw(storage.getItem(active.storageKey),validate);}catch(err){
      if(err?.code==='unsupported_version')throw err;
      fail('invalid_slot','Lo slot attivo non è valido: nessuna copia è stata sovrascritta.');
    }
    cleanPending(storage);
    return {migrated:false,alreadyMigrated:true,entry:active};
  }
  // Never make up a new active career when the catalogue is valid but points
  // to another existing, non-active slot: QOL01.03 owns switching slots.
  const source=legacySource(storage,validate);
  if(!source){
    if(active)fail('missing_slot','La carriera indicizzata non è più disponibile.');
    return {migrated:false,alreadyMigrated:false,entry:null};
  }
  const existing=active||catalog.slots.find(s=>s.storageKey===CAREER_STORAGE_KEY)||null;
  const pending=pendingMigration(storage);
  if(pending&&pending.sourceKey!==source.sourceKey){
    fail('migration_conflict','La provenienza del salvataggio è cambiata durante una migrazione interrotta.');
  }
  if(pending&&existing&&pending.id!==existing.id){
    fail('migration_conflict','Il registro non corrisponde allo slot in migrazione.');
  }
  const id=existing?.id||pending?.id||newSlotId(idFactory,new Set(catalog.slots.map(s=>s.id)));
  if(catalog.slots.some(s=>s.id===id&&s!==existing))fail('slot_conflict','Identificativo dello slot già assegnato.');
  const key=slotKey(id),before=storage.getItem(CAREER_CATALOG_KEY);
  const otherOwner=catalog.slots.find(s=>s.storageKey===key&&s.id!==id);
  if(otherOwner)fail('slot_conflict','La chiave dello slot è già assegnata a un’altra carriera.');
  const currentSlot=storage.getItem(key);
  // A staged copy from an interrupted migration may be reused verbatim.
  // Never overwrite unrelated or unexpectedly changed bytes in that key.
  if(currentSlot!==null&&currentSlot!==source.raw)fail('slot_conflict','Esiste già uno slot con dati differenti: copia non sovrascritta.');
  if(!pending)verifyPending(storage,{version:1,id,sourceKey:source.sourceKey});
  if(currentSlot===null)verifyWrite(storage,key,source.raw,validate);
  else checkedRaw(currentSlot,validate);
  const time=checkedTime(now),entry=slotRecord(source.career,existing,id,key,time);
  const updated={...catalog,activeSlotId:id,slots:existing
    ?catalog.slots.map(s=>s.id===id?entry:s)
    :[...catalog.slots,entry]};
  checkCatalogStable(storage,before);
  writeCareerCatalog(storage,updated);
  cleanPending(storage);
  return {migrated:true,alreadyMigrated:false,entry,sourceKey:source.sourceKey};
}

// Existing catalogue slot is authoritative, including when the old flat
// mirror is missing or older (e.g. after an interrupted mirror write).
export function loadActiveCareer(storage,validate,createWorld){
  const catalog=readCareerCatalog(storage);
  if(storage.getItem(CAREER_CATALOG_KEY)!==null&&catalog.slots.length===0)return createWorld();
  const active=catalog.slots.find(s=>s.id===catalog.activeSlotId);
  if(active&&active.storageKey!==CAREER_STORAGE_KEY){
    const raw=storage.getItem(active.storageKey);
    if(raw===null)fail('missing_slot','Slot della carriera non trovato: nessun dato è stato sovrascritto.');
    try{return checkedRaw(raw,validate);}catch(err){
      if(err?.code==='unsupported_version')throw err;
      fail('invalid_slot','Lo slot attivo contiene dati non validi: non verrà sovrascritto.');
    }
  }
  return loadCareer(storage,validate,createWorld);
}

// At every autosave write and VERIFY the physical slot, then update the
// catalogue. The flat mirror is written separately, by main.js, only after
// this commit succeeds. "newCareer" allocates a new slot without erasing old.
export function saveCareerToSlot(storage,career,validate,{
  newCareer=false,now=stamp,idFactory=defaultIdFactory,
}={}){
  const raw=JSON.stringify(career);
  checkedRaw(raw,validate);
  ensureNoFutureFlat(storage);
  const catalog=readCareerCatalog(storage),before=storage.getItem(CAREER_CATALOG_KEY);
  const active=catalog.slots.find(s=>s.id===catalog.activeSlotId);
  if(!newCareer&&active?.storageKey===CAREER_STORAGE_KEY){
    fail('migration_required','La carriera precedente deve essere migrata prima del salvataggio.');
  }
  // A legacy flat reference cannot be dropped until its original bytes were
  // copied. This also protects reset/import when startup migration failed.
  if(newCareer&&catalog.slots.some(s=>s.storageKey===CAREER_STORAGE_KEY)){
    fail('migration_required','Completa la migrazione prima di sostituire la carriera.');
  }
  if(!newCareer&&!active&&legacySource(storage,validate)){
    fail('migration_required','Il salvataggio esistente non è ancora stato migrato.');
  }
  const existing=newCareer?null:active;
  if(!existing&&catalog.slots.length>=100)fail('catalog_full','Il catalogo delle carriere è pieno.');
  const id=existing?.id||newSlotId(idFactory,new Set(catalog.slots.map(s=>s.id)));
  const key=slotKey(id);
  if(existing&&existing.storageKey!==key)fail('slot_conflict','Il riferimento dello slot attivo è incoerente.');
  // A newly allocated ID must never overwrite an orphan or another career.
  if(!existing&&storage.getItem(key)!==null)fail('slot_conflict','Esiste già uno slot con questo ID.');
  verifyWrite(storage,key,raw,validate);
  const time=checkedTime(now),entry=slotRecord(career,existing,id,key,time);
  const updated={...catalog,activeSlotId:id,slots:existing
    ?catalog.slots.map(s=>s.id===id?entry:s)
    :[...catalog.slots,entry]};
  checkCatalogStable(storage,before);
  writeCareerCatalog(storage,updated);
  return entry;
}
