// QOL01.04 — Verified, per-slot autosave checkpoints with bounded retention.
// The source slot is never modified to create/prune a checkpoint. Checkpoints
// are separate from the legacy safety backups (which must not be pruned here).
import {CAREER_CATALOG_KEY,readCareerCatalog} from './career-catalog.js';
import {parseCareerJson,SaveFormatError,persistCareer} from './storage.js';
import {saveCareerToSlot} from './career-slots.js';

export const CHECKPOINT_INDEX_KEY='football-architect:career:checkpoints:index:v1';
export const CHECKPOINT_PREFIX='football-architect:career:checkpoint:v1:';
export const CHECKPOINTS_PER_SLOT=3;
export const CHECKPOINTS_GLOBAL=10;
export const CHECKPOINTS_BYTES=2_500_000; // conservative UTF-16 approximation
const checkpointBudget=storage=>storage?.durablePrimary===true?160_000_000:CHECKPOINTS_BYTES;
const fail=(code,message)=>{throw new SaveFormatError(code,message);};
const timeNow=()=>new Date().toISOString();
const makeId=()=>{
  if(typeof globalThis.crypto?.randomUUID!=='function')fail('checkpoint_id_failed','ID sicuro per il checkpoint non disponibile.');
  return globalThis.crypto.randomUUID();
};
const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const validKey=value=>typeof value==='string'&&/^football-architect:career:checkpoint:v1:[a-zA-Z0-9-]{8,80}$/.test(value);
const kinds=new Set(['before-day','before-match','before-transfer','before-season','before-restore']);
const validItem=item=>item&&validKey(item.key)&&typeof item.slotId==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(item.slotId)
  &&kinds.has(item.kind)&&validTime(item.createdAt)&&Number.isSafeInteger(item.season)&&item.season>=1
  &&Number.isSafeInteger(item.round)&&item.round>=0;
function readIndex(storage){
  const raw=storage.getItem(CHECKPOINT_INDEX_KEY);
  if(raw===null)return {version:1,items:[]};
  let data;
  try{data=JSON.parse(raw);}catch{fail('checkpoint_index_invalid','Indice checkpoint danneggiato: nessun dato verrà sovrascritto.');}
  if(Number.isInteger(data?.version)&&data.version>1)fail('checkpoint_index_future','Indice checkpoint creato con una versione futura.');
  if(data?.version!==1||!Array.isArray(data.items)||data.items.length>500
    ||data.items.some(item=>!validItem(item))
    ||new Set(data.items.map(item=>item.key)).size!==data.items.length){
    fail('checkpoint_index_invalid','Indice checkpoint non valido: nessun dato verrà sovrascritto.');
  }
  return data;
}
function commitIndex(storage,index,before){
  if(storage.getItem(CHECKPOINT_INDEX_KEY)!==before)fail('checkpoint_conflict','I checkpoint sono cambiati durante il salvataggio.');
  const raw=JSON.stringify(index);
  storage.setItem(CHECKPOINT_INDEX_KEY,raw);
  if(storage.getItem(CHECKPOINT_INDEX_KEY)!==raw)fail('checkpoint_write_failed','Indice checkpoint non verificato.');
}
function checkedSlot(storage,id,validate){
  const catalog=readCareerCatalog(storage),record=catalog.slots.find(s=>s.id===id);
  if(!record||record.storageKey===null)fail('missing_slot','Slot della carriera non trovato.');
  const raw=storage.getItem(record.storageKey);
  if(raw===null)fail('missing_slot','Dati della carriera non disponibili.');
  return {record,raw,career:parseCareerJson(raw,validate),catalog};
}
function readSnapshot(storage,key,validate){
  const raw=storage.getItem(key);
  if(raw===null)fail('missing_checkpoint','Checkpoint non disponibile.');
  let snapshot;
  try{snapshot=JSON.parse(raw);}catch{fail('invalid_checkpoint','Checkpoint non leggibile.');}
  if(snapshot?.version!==1||!validItem(snapshot)||snapshot.key!==key||typeof snapshot.raw!=='string'){
    fail('invalid_checkpoint','Checkpoint non valido.');
  }
  return {snapshot,career:parseCareerJson(snapshot.raw,validate)};
}
function retained(items,storage,priorityKey){
  const ascending=[...items].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.key.localeCompare(b.key));
  const result=[];const perSlot=new Map();let bytes=0;
  const newest=ascending.reverse();
  const urgent=newest.find(i=>i.key===priorityKey);
  if(urgent)newest.splice(newest.indexOf(urgent),1),newest.unshift(urgent);
  for(const item of newest){
    const raw=storage.getItem(item.key);
    if(raw===null)continue; // missing records may be recovered manually; never delete active slots
    const size=2*(raw.length+item.key.length);
    const count=perSlot.get(item.slotId)||0;
    if(count>=CHECKPOINTS_PER_SLOT||result.length>=CHECKPOINTS_GLOBAL||bytes+size>checkpointBudget(storage))continue;
    result.push(item);perSlot.set(item.slotId,count+1);bytes+=size;
  }
  return result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.key.localeCompare(a.key));
}
// Create before any irreversible operation. A failed checkpoint aborts the
// operation; pruning runs only AFTER new bytes and index are verified.
export function createCareerCheckpoint(storage,slotId,kind,validate,{now=timeNow,idFactory=makeId}={}){
  if(!kinds.has(kind))fail('invalid_checkpoint','Tipo checkpoint non riconosciuto.');
  const {raw,career}=checkedSlot(storage,slotId,validate);
  const createdAt=now();if(!validTime(createdAt))fail('invalid_checkpoint','Data checkpoint non valida.');
  const before=storage.getItem(CHECKPOINT_INDEX_KEY),index=readIndex(storage);
  const id=idFactory(),key=`${CHECKPOINT_PREFIX}${id}`;
  if(!validKey(key)||storage.getItem(key)!==null||index.items.some(i=>i.key===key))fail('checkpoint_conflict','Chiave checkpoint già in uso o non valida.');
  const info={key,slotId,kind,createdAt,season:career.season,round:career.round};
  const encoded=JSON.stringify({version:1,...info,raw});
  if(encoded.length*2>checkpointBudget(storage))fail('checkpoint_too_large','Checkpoint troppo grande: esporta la carriera prima di continuare.');
  storage.setItem(key,encoded);
  if(storage.getItem(key)!==encoded)fail('checkpoint_write_failed','Checkpoint non verificato. Operazione annullata.');
  readSnapshot(storage,key,validate);
  const updated=[...index.items,info];
  const kept=retained(updated,storage,key);
  if(!kept.some(item=>item.key===key))fail('checkpoint_too_large','Spazio riservato ai checkpoint insufficiente.');
  try{commitIndex(storage,{version:1,items:kept},before);}
  catch(err){
    // If no catalogue commit happened, the newly staged copy is an orphan.
    if(storage.getItem(CHECKPOINT_INDEX_KEY)===before){try{storage.removeItem(key);}catch{/* Preserve source slot regardless. */}}
    throw err;
  }
  // A failure to reclaim space does not invalidate a verified new checkpoint.
  const garbage=updated.filter(item=>!kept.some(k=>k.key===item.key));
  let cleanupFailed=0;
  for(const item of garbage){try{storage.removeItem(item.key);if(storage.getItem(item.key)!==null)cleanupFailed++;}catch{cleanupFailed++;}}
  return {...info,cleanupFailed};
}
export function listCareerCheckpoints(storage,slotId,validate){
  return readIndex(storage).items.filter(i=>i.slotId===slotId).map(i=>{
    let status='ok';
    try{const {snapshot}=readSnapshot(storage,i.key,validate);if(snapshot.slotId!==slotId||snapshot.kind!==i.kind)status='invalid_checkpoint';}
    catch(err){status=err?.code||'invalid_checkpoint';}
    return {...i,status};
  });
}
// Restore only the active slot; save a verified checkpoint of its current
// bytes before replacing anything. On failed slot/catalogue write attempt to
// roll back the slot, and keep the recovery snapshot regardless.
export function restoreCareerCheckpoint(storage,slotId,key,validate,opts={}){
  const beforeIndex=readIndex(storage),reference=beforeIndex.items.find(i=>i.key===key&&i.slotId===slotId);
  if(!reference)fail('missing_checkpoint','Il checkpoint non appartiene a questa carriera.');
  const {snapshot,career}=readSnapshot(storage,key,validate);
  if(snapshot.slotId!==slotId||snapshot.kind!==reference.kind)fail('invalid_checkpoint','Checkpoint incoerente.');
  const original=checkedSlot(storage,slotId,validate);
  if(original.catalog.activeSlotId!==slotId)fail('inactive_slot','Carica prima la carriera che vuoi ripristinare.');
  const originalCatalog=storage.getItem(CAREER_CATALOG_KEY);
  const safety=createCareerCheckpoint(storage,slotId,'before-restore',validate,opts);
  try{
    const saved=saveCareerToSlot(storage,career,validate,{now:opts.now||timeNow});
    // The mirror is best-effort: the physical slot has already been verified.
    let mirrorError=null;
    try{persistCareer(storage,career,validate);}catch(err){mirrorError=err;}
    return {career,entry:saved,safetyCheckpoint:safety.key,mirrorError};
  }catch(err){
    // Never overwrite an unexpected third-party modification. Recovery copy
    // survives even if the best-effort rollback also fails.
    let rollbackError=null;
    try{
      if(storage.getItem(CAREER_CATALOG_KEY)===originalCatalog){
        storage.setItem(original.record.storageKey,original.raw);
        if(storage.getItem(original.record.storageKey)!==original.raw)fail('rollback_failed','Ripristino della carriera precedente non verificato.');
      }else fail('checkpoint_conflict','Catalogo modificato durante il ripristino.');
    }catch(rollback){rollbackError=rollback;}
    if(rollbackError)fail('rollback_failed',`Ripristino interrotto: copia di sicurezza conservata (${safety.key}). ${rollbackError.message}`);
    throw err;
  }
}
