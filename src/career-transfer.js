// QOL01.05 — offline portable career exchange. All files are JSON and the
// original v1 world bytes are preserved. No external service or dependency.
import {CAREER_CATALOG_KEY,readCareerCatalog,writeCareerCatalog,newSlotId,defaultIdFactory,metadataFromCareer} from './career-catalog.js';
import {CAREER_SLOT_PREFIX} from './career-slots.js';
import {CAREER_STORAGE_KEY,SAVE_SCHEMA_VERSION,SaveFormatError,saveSchemaVersion,parseCareerJson,persistCareer,backupRawCareer,CAREER_BACKUP_PREFIX} from './storage.js';

export const CAREER_BUNDLE_FORMAT='football-architect-careers-bundle';
export const CAREER_BUNDLE_VERSION=1;
export const MAX_TRANSFER_BYTES=128_000_000;
const fail=(code,message)=>{throw new SaveFormatError(code,message);};
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9-]{7,79}$/.test(value);
const nowIso=()=>new Date().toISOString();
function slotData(storage,record,validate){
  const raw=storage.getItem(record.storageKey);
  if(raw===null)fail('missing_slot','Salvataggio non disponibile: esportazione annullata.');
  return {raw,career:parseCareerJson(raw,validate)};
}
async function sha256(value){
  if(!globalThis.crypto?.subtle)fail('crypto_unavailable','Il browser non supporta il controllo di integrità SHA-256.');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function exportCareerSlotJson(storage,id,validate){
  const catalog=readCareerCatalog(storage),record=catalog.slots.find(s=>s.id===id);
  if(!record)fail('missing_slot','Carriera non presente.');
  return slotData(storage,record,validate).raw;
}
export async function exportAllCareersJson(storage,validate,{now=nowIso}={}){
  const catalog=readCareerCatalog(storage),exportedAt=now();
  if(!iso(exportedAt))fail('invalid_archive','Data di esportazione non valida.');
  if(!catalog.slots.length)fail('empty_archive','Non ci sono carriere da esportare.');
  const entries=[];
  for(const item of catalog.slots){
    const {raw}=slotData(storage,item,validate);
    entries.push({sourceSlotId:item.id,name:item.name,createdAt:item.createdAt,
      lastSavedAt:item.lastSavedAt,raw,sha256:await sha256(raw)});
  }
  // Detect a modification from another tab during async digest operations.
  const current=readCareerCatalog(storage);
  if(JSON.stringify(current)!==JSON.stringify(catalog)||entries.some((e,i)=>storage.getItem(catalog.slots[i].storageKey)!==e.raw)){
    fail('catalog_conflict','Una carriera è cambiata durante l’esportazione. Riprova.');
  }
  const archive=JSON.stringify({format:CAREER_BUNDLE_FORMAT,version:CAREER_BUNDLE_VERSION,
    exportedAt,activeSlotId:catalog.activeSlotId,entries},null,2);
  if(new TextEncoder().encode(archive).byteLength>MAX_TRANSFER_BYTES)fail('archive_too_large','Archivio oltre 128 MB: esportare gli slot individualmente.');
  return archive;
}
function normalizeName(name,career){
  const derived=career.teams.find(t=>t.id===career.clubId)?.name||'Nuova carriera';
  return typeof name==='string'&&name.trim()&&name.length<=160?name.trim():derived;
}
export async function previewCareerImport(raw,validate){
  if(typeof raw!=='string'||!raw.length||new TextEncoder().encode(raw).length>MAX_TRANSFER_BYTES){
    fail('archive_too_large','Il file supera il limite di 128 MB o è vuoto.');
  }
  let parsed;
  try{parsed=JSON.parse(raw);}catch{fail('invalid_json','Il file JSON non è valido.');}
  if(parsed?.format===CAREER_BUNDLE_FORMAT){
    if(Number.isSafeInteger(parsed.version)&&parsed.version>CAREER_BUNDLE_VERSION){
      fail('unsupported_archive','Archivio creato con una versione più recente.');
    }
    if(parsed.version!==CAREER_BUNDLE_VERSION||!iso(parsed.exportedAt)||!Array.isArray(parsed.entries)
      ||parsed.entries.length<1||parsed.entries.length>100
      ||(parsed.activeSlotId!==null&&!validId(parsed.activeSlotId))){
      fail('invalid_archive','Struttura dell’archivio carriere non valida.');
    }
    const ids=new Set();const entries=[];
    for(const entry of parsed.entries){
      if(!isObject(entry)||!validId(entry.sourceSlotId)||ids.has(entry.sourceSlotId)
        ||typeof entry.name!=='string'||!entry.name.trim()||entry.name.length>160
        ||!iso(entry.createdAt)||!iso(entry.lastSavedAt)
        ||typeof entry.raw!=='string'||!/^[0-9a-f]{64}$/.test(entry.sha256)){
        fail('invalid_archive','Metadati dell’archivio non validi o duplicati.');
      }
      ids.add(entry.sourceSlotId);
      if(await sha256(entry.raw)!==entry.sha256)fail('archive_checksum','Il checksum del salvataggio non coincide: importazione bloccata.');
      const career=parseCareerJson(entry.raw,validate);
      entries.push({sourceSlotId:entry.sourceSlotId,name:entry.name,raw:entry.raw,career,
        createdAt:entry.createdAt,lastSavedAt:entry.lastSavedAt});
    }
    if(parsed.activeSlotId!==null&&!ids.has(parsed.activeSlotId))fail('invalid_archive','Lo slot attivo non è incluso nell’archivio.');
    return {kind:'bundle',entries,exportedAt:parsed.exportedAt};
  }
  // Treat other identified wrapper formats as unsupported, never as legacy worlds.
  if(isObject(parsed)&&typeof parsed.format==='string')fail('unsupported_archive','Formato dell’archivio non riconosciuto.');
  const career=parseCareerJson(raw,validate);
  return {kind:'single',entries:[{sourceSlotId:null,name:normalizeName(null,career),raw,career,
    createdAt:null,lastSavedAt:null}],exportedAt:null};
}
function ensureCurrentFlatWritable(storage){
  const raw=storage.getItem(CAREER_STORAGE_KEY);if(!raw)return;
  let data;try{data=JSON.parse(raw);}catch{return;}
  if(saveSchemaVersion(data)>SAVE_SCHEMA_VERSION)fail('unsupported_version','Il salvataggio corrente ha uno schema futuro: non verrà sostituito.');
}
function restorePrevious(storage,originals){
  const failures=[];
  for(const [key,raw] of originals){
    try{storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw new Error('write not verified');}
    catch{failures.push(key);}
  }
  if(failures.length)fail('import_rollback_failed','Ripristino incompleto. I backup di sicurezza sono stati conservati: non continuare a giocare prima di recuperare i dati.');
}
export function applyCareerImport(storage,preview,validate,{mode='add',targetSlotId=null,
  expectedCatalogRaw=storage.getItem(CAREER_CATALOG_KEY),now=nowIso,idFactory=defaultIdFactory}={}){
  if(!preview||!['single','bundle'].includes(preview.kind)||!Array.isArray(preview.entries)||!preview.entries.length){
    fail('invalid_archive','Anteprima di importazione non valida.');
  }
  if(!['add','replace'].includes(mode))fail('invalid_import_mode','Modalità di importazione non valida.');
  if(storage.getItem(CAREER_CATALOG_KEY)!==expectedCatalogRaw)fail('catalog_conflict','Le carriere sono cambiate dopo l’anteprima. Riapri il file.');
  const catalog=readCareerCatalog(storage),oldRaw=storage.getItem(CAREER_CATALOG_KEY);
  const entries=preview.entries.map(e=>({...e,career:parseCareerJson(e.raw,validate)}));
  if(entries.length>100||(mode==='add'&&catalog.slots.length+entries.length>100))fail('catalog_full','Superato il limite di 100 carriere.');
  const used=new Set(catalog.slots.map(s=>s.id));
  const operations=[];
  if(mode==='replace'){
    const chosen=new Set();
    for(const e of entries){
      const id=preview.kind==='single'?targetSlotId:e.sourceSlotId;
      const current=catalog.slots.find(s=>s.id===id);
      if(!current||chosen.has(id))fail('import_target_missing','La carriera da sostituire non esiste o non corrisponde all’archivio.');
      chosen.add(id);
      // Never overwrite an unreadable, future or concurrently modified slot.
      slotData(storage,current,validate);
      operations.push({entry:e,current,key:current.storageKey,id});
    }
    if(operations.some(op=>op.id===catalog.activeSlotId))ensureCurrentFlatWritable(storage);
  }else{
    for(const e of entries){
      const id=newSlotId(idFactory,used),key=`${CAREER_SLOT_PREFIX}${id}`;used.add(id);
      if(storage.getItem(key)!==null)fail('slot_conflict','La destinazione contiene già un salvataggio.');
      operations.push({entry:e,current:null,key,id});
    }
  }
  const time=now();if(!iso(time))fail('invalid_archive','Data di importazione non valida.');
  const oldContents=new Map(),backups=[];
  // Create ALL recovery copies and verify before modifying any career.
  for(const op of operations.filter(op=>op.current)){
    const original=storage.getItem(op.key);oldContents.set(op.key,original);
    backups.push({slotId:op.id,key:backupRawCareer(storage,original,`before-import-${op.id}`)});
  }
  const staged=[];let committed=false;
  try{
    if(storage.getItem(CAREER_CATALOG_KEY)!==oldRaw)fail('catalog_conflict','Il catalogo è stato modificato durante l’importazione.');
    const newEntries=[];
    for(const op of operations){
      if(op.current&&storage.getItem(op.key)!==oldContents.get(op.key))fail('catalog_conflict','Uno slot è cambiato durante l’importazione.');
      if(!op.current&&storage.getItem(op.key)!==null)fail('slot_conflict','Uno slot nuovo è già occupato.');
      staged.push(op); // Track an attempted write even if verification throws afterwards.
      storage.setItem(op.key,op.entry.raw);
      if(storage.getItem(op.key)!==op.entry.raw)fail('slot_write_failed','Impossibile verificare la scrittura del salvataggio.');
      parseCareerJson(storage.getItem(op.key),validate);
      const base=op.current;
      const record=metadataFromCareer(op.entry.career,{id:op.id,storageKey:op.key,
        name:mode==='replace'?base.name:op.entry.name,
        createdAt:base?.createdAt||time,lastSavedAt:time});
      newEntries.push(record);
    }
    if(storage.getItem(CAREER_CATALOG_KEY)!==oldRaw)fail('catalog_conflict','Il catalogo è stato modificato durante l’importazione.');
    const next={...catalog,slots:mode==='add'?[...catalog.slots,...newEntries]:catalog.slots.map(s=>newEntries.find(n=>n.id===s.id)||s)};
    writeCareerCatalog(storage,next);committed=true;
  }catch(err){
    if(!committed&&storage.getItem(CAREER_CATALOG_KEY)===oldRaw){
      // Newly staged destinations are not in the catalogue; remove only ones we created.
      for(const op of staged.filter(x=>!x.current)){try{if(storage.getItem(op.key)===op.entry.raw)storage.removeItem(op.key);}catch{/* orphan is not selectable */}}
      restorePrevious(storage,new Map(staged.filter(x=>x.current).map(op=>[op.key,oldContents.get(op.key)])));
    }
    throw err;
  }
  // Mirror failures cannot undo a successfully committed authoritative slot.
  let mirrorError=null,activeCareer=null;
  const active=operations.find(op=>op.id===catalog.activeSlotId);
  if(active){activeCareer=active.entry.career;try{persistCareer(storage,activeCareer,validate);}catch(err){mirrorError=err;}}
  return {count:operations.length,mode,backups,activeCareer,mirrorError};
}
// Backups are the exact original bytes and remain recoverable after a replace.
export function listImportBackups(storage,id,validate){
  if(!validId(id))fail('missing_slot','Identificativo carriera non valido.');
  const matches=[];const marker=`:before-import-${id}:`;
  for(let i=0;i<(storage.length??0);i++){
    const key=storage.key(i);
    if(!key?.startsWith(CAREER_BACKUP_PREFIX)||!key.includes(marker))continue;
    let status='ok';try{parseCareerJson(storage.getItem(key),validate);}catch(err){status=err?.code||'invalid_backup';}
    const encoded=key.split(':')[3];const milliseconds=parseInt(encoded,36);
    const createdAt=Number.isSafeInteger(milliseconds)&&milliseconds>0&&milliseconds<8.64e15?new Date(milliseconds).toISOString():null;
    matches.push({key,status,createdAt});
  }
  return matches.sort((a,b)=>b.key.localeCompare(a.key));
}
export function restoreImportBackup(storage,id,backupKey,validate,opts={}){
  if(!listImportBackups(storage,id,validate).some(x=>x.key===backupKey&&x.status==='ok')){
    fail('missing_backup','Backup non valido o non associato allo slot richiesto.');
  }
  const raw=storage.getItem(backupKey);
  const preview={kind:'single',entries:[{sourceSlotId:null,raw}]};
  return applyCareerImport(storage,preview,validate,{...opts,mode:'replace',targetSlotId:id});
}
