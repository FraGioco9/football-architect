// QOL01.03 — User-facing career slot operations. The verified slot JSON is
// authoritative; the v1 flat mirror exists exclusively for older releases.
import {CAREER_CATALOG_KEY,readCareerCatalog,writeCareerCatalog,newSlotId,defaultIdFactory} from './career-catalog.js';
import {CAREER_SLOT_PREFIX,saveCareerToSlot} from './career-slots.js';
import {CAREER_STORAGE_KEY,SAVE_SCHEMA_VERSION,SaveFormatError,saveSchemaVersion,parseCareerJson,persistCareer,backupRawCareer} from './storage.js';

const error=(code,message)=>{throw new SaveFormatError(code,message);};
const stamp=()=>new Date().toISOString();
const slotKey=id=>`${CAREER_SLOT_PREFIX}${id}`;
function entry(catalog,id){const found=catalog.slots.find(s=>s.id===id);if(!found)error('missing_slot','Carriera non presente nel catalogo.');return found;}
function parseSlot(storage,record,validate){
  const raw=storage.getItem(record.storageKey);
  if(raw===null)error('missing_slot','I dati della carriera selezionata non sono disponibili.');
  try{return {raw,career:parseCareerJson(raw,validate)};}
  catch(err){if(err?.code==='unsupported_version')throw err;error('invalid_slot','La carriera selezionata è danneggiata o non è valida.');}
}
function checkUnchanged(storage,raw){if(storage.getItem(CAREER_CATALOG_KEY)!==raw)error('catalog_conflict','Il catalogo è cambiato durante l’operazione. Riprova.');}
function protectFlatMirror(storage){
  const raw=storage.getItem(CAREER_STORAGE_KEY);
  if(raw!==null){
    try{if(saveSchemaVersion(JSON.parse(raw))>SAVE_SCHEMA_VERSION)error('unsupported_version','Esiste un salvataggio di una versione futura: il mirror non verrà modificato.');}
    catch(err){if(err instanceof SaveFormatError)throw err;}
  }
}
function mirror(storage,career,validate){
  try{
    persistCareer(storage,career,validate);
    if(storage.getItem(CAREER_STORAGE_KEY)!==JSON.stringify(career))error('write_failed','Mirror di compatibilità non verificato.');
    return null;
  }catch(err){return err;}
}
export function listCareerSlots(storage,validate){
  const catalog=readCareerCatalog(storage);
  return {activeSlotId:catalog.activeSlotId,slots:catalog.slots.map(record=>{
    let status='ok',currentDate=null;
    try{
      const {career}=parseSlot(storage,record,validate);
      currentDate=typeof career.currentDate==='string'?career.currentDate:null;
    }catch(err){status=err?.code||'invalid_slot';}
    return {...record,status,currentDate};
  }).sort((a,b)=>{
    if(a.id===catalog.activeSlotId&&b.id!==catalog.activeSlotId)return -1;
    if(b.id===catalog.activeSlotId&&a.id!==catalog.activeSlotId)return 1;
    if(a.status==='ok'&&b.status!=='ok')return -1;
    if(b.status==='ok'&&a.status!=='ok')return 1;
    return b.lastSavedAt.localeCompare(a.lastSavedAt);
  })};
}
export function switchCareerSlot(storage,id,validate){
  const before=storage.getItem(CAREER_CATALOG_KEY),catalog=readCareerCatalog(storage);
  const record=entry(catalog,id),{career}=parseSlot(storage,record,validate);
  protectFlatMirror(storage);
  if(catalog.activeSlotId!==id){
    checkUnchanged(storage,before);
    writeCareerCatalog(storage,{...catalog,activeSlotId:id});
  }
  // The catalogue + slot commit precedes the compatibility mirror. A mirror
  // failure is reported without pretending the successful selection failed.
  return {career,entry:record,mirrorError:mirror(storage,career,validate)};
}
export function renameCareerSlot(storage,id,name){
  const clean=typeof name==='string'?name.trim():'';
  if(!clean||clean.length>160)error('invalid_slot_name','Il nome deve avere da 1 a 160 caratteri.');
  const before=storage.getItem(CAREER_CATALOG_KEY),catalog=readCareerCatalog(storage),record=entry(catalog,id);
  if(record.name===clean)return {...record};
  checkUnchanged(storage,before);
  writeCareerCatalog(storage,{...catalog,slots:catalog.slots.map(s=>s.id===id?{...s,name:clean}:s)});
  return {...record,name:clean};
}
export function duplicateCareerSlot(storage,id,validate,{now=stamp,idFactory=defaultIdFactory}={}){
  const before=storage.getItem(CAREER_CATALOG_KEY),catalog=readCareerCatalog(storage);
  if(catalog.slots.length>=100)error('catalog_full','Il catalogo delle carriere è pieno.');
  const source=entry(catalog,id),{raw}=parseSlot(storage,source,validate);
  const newId=newSlotId(idFactory,new Set(catalog.slots.map(s=>s.id))),key=slotKey(newId);
  if(storage.getItem(key)!==null)error('slot_conflict','Esiste già uno slot con questo identificativo.');
  const time=now();if(typeof time!=='string'||!Number.isFinite(Date.parse(time))||new Date(time).toISOString()!==time)error('invalid_catalog','Data non valida.');
  const suffix=' — copia';const newName=source.name.slice(0,160-suffix.length)+suffix;
  const copy={...source,id:newId,name:newName,storageKey:key,createdAt:time,lastSavedAt:time};
  storage.setItem(key,raw);
  if(storage.getItem(key)!==raw)error('slot_write_failed','La copia della carriera non è stata verificata.');
  parseSlot(storage,copy,validate);
  checkUnchanged(storage,before);
  writeCareerCatalog(storage,{...catalog,slots:[...catalog.slots,copy]});
  return copy;
}
export function createFreshCareerSlot(storage,career,validate,options={}){
  const record=saveCareerToSlot(storage,career,validate,{...options,newCareer:true});
  return {career,entry:record,mirrorError:mirror(storage,career,validate)};
}
export function deleteCareerSlot(storage,id,validate){
  const before=storage.getItem(CAREER_CATALOG_KEY),catalog=readCareerCatalog(storage),record=entry(catalog,id);
  const {raw}=parseSlot(storage,record,validate);
  const remaining=catalog.slots.filter(s=>s.id!==id);
  const activeDeleted=catalog.activeSlotId===id;
  const replacement=activeDeleted?(remaining.find(s=>s.status==='ok')||remaining.find(s=>{
    try{parseSlot(storage,s,validate);return true;}catch{return false;}
  })||null):null;
  if(activeDeleted&&remaining.length>0&&!replacement)error('invalid_slot','Le altre carriere non sono caricabili: nessun dato è stato eliminato.');
  if(activeDeleted)protectFlatMirror(storage);
  // A verified, dedicated backup is created before any deletion and retained.
  const backupKey=backupRawCareer(storage,raw,'before-delete-slot');
  const nextActiveId=activeDeleted?(replacement?.id||null):catalog.activeSlotId;
  checkUnchanged(storage,before);
  writeCareerCatalog(storage,{...catalog,activeSlotId:nextActiveId,slots:remaining});
  // Catalogue commit comes first. If cleanup is interrupted, orphaned data
  // are harmless and the deleted ID is no longer selectable.
  let cleanupError=null;
  try{
    storage.removeItem(record.storageKey);
    if(storage.getItem(record.storageKey)!==null)error('delete_failed','La cancellazione fisica dello slot non è stata verificata.');
  }catch(err){cleanupError=err;}
  let nextCareer=null,mirrorError=null;
  if(activeDeleted){
    if(replacement){nextCareer=parseSlot(storage,replacement,validate).career;mirrorError=mirror(storage,nextCareer,validate);}
    else{
      try{storage.removeItem(CAREER_STORAGE_KEY);if(storage.getItem(CAREER_STORAGE_KEY)!==null)error('write_failed','Impossibile eliminare il mirror precedente.');}
      catch(err){mirrorError=err;}
    }
  }
  return {activeDeleted,nextActiveSlotId:nextActiveId,nextCareer,backupKey,cleanupError,mirrorError};
}
