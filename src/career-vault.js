// QOL01.06 — Non-destructive IndexedDB archive for present and future large
// career worlds. This is a verified SECOND copy: legacy synchronous slots stay
// authoritative until a separate, explicitly tested async-storage migration.
import {readCareerCatalog,writeCareerCatalog,metadataFromCareer,CAREER_CATALOG_KEY} from './career-catalog.js';
import {parseCareerJson,backupRawCareer,SaveFormatError} from './storage.js';

export const VAULT_DB_NAME='football-architect-career-vault';
export const VAULT_DB_VERSION=1;
export const VAULT_STORE='careers';
export const VAULT_EXPORT_FORMAT='football-architect-emergency-export';
const fail=(code,message)=>{throw new SaveFormatError(code,message);};
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9-]{7,79}$/.test(id);
const bytes=s=>new TextEncoder().encode(s).byteLength;
export async function sha256Text(raw,cryptoImpl=globalThis.crypto){
  if(typeof raw!=='string'||!cryptoImpl?.subtle)fail('crypto_unavailable','Verifica SHA-256 non disponibile.');
  const digest=await cryptoImpl.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}

// The IDB engine is isolated behind the same async {put,get,list} interface
// used by tests; transactions resolve only after actual oncomplete (durable).
export function createIndexedDbVault({factory=globalThis.indexedDB,cryptoImpl=globalThis.crypto}={}){
  let connection;
  async function open(){
    if(connection)return connection;
    if(!factory?.open)fail('vault_unavailable','IndexedDB non è disponibile in questo browser.');
    const db=await new Promise((resolve,reject)=>{
      const req=factory.open(VAULT_DB_NAME,VAULT_DB_VERSION);
      req.onupgradeneeded=()=>{const next=req.result;if(!next.objectStoreNames.contains(VAULT_STORE))next.createObjectStore(VAULT_STORE,{keyPath:'id'});};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Impossibile aprire IndexedDB.'));
      req.onblocked=()=>reject(new Error('IndexedDB bloccato da un’altra scheda.'));
    });
    db.onversionchange=()=>{db.close();connection=null;};
    connection=db;
    return db;
  }
  async function transact(mode,operation){
    const db=await open();
    return new Promise((resolve,reject)=>{
      let value,done=false;
      const txn=db.transaction(VAULT_STORE,mode),store=txn.objectStore(VAULT_STORE);
      try{const req=operation(store);req.onsuccess=()=>{value=req.result;};req.onerror=()=>{/* transaction abort delivers error */};}
      catch(err){try{txn.abort();}catch{}reject(err);return;}
      txn.oncomplete=()=>{done=true;resolve(value);};
      txn.onabort=()=>{if(!done)reject(txn.error||new Error('Transazione IndexedDB interrotta.'));};
      txn.onerror=()=>{/* onabort handles failure */};
    });
  }
  async function get(id){if(!validId(id))fail('invalid_slot','ID di carriera non valido.');return await transact('readonly',s=>s.get(id))||null;}
  async function list(){return await transact('readonly',s=>s.getAll())||[];}
  async function put(record){if(!validId(record?.id))fail('invalid_slot','ID di carriera non valido.');await transact('readwrite',s=>s.put(record));}
  return {open,get,list,put,cryptoImpl};
}

function checkedRecord(record,validate){
  if(!validId(record?.id)||typeof record.raw!=='string'||typeof record.sha256!=='string'||!/^[0-9a-f]{64}$/.test(record.sha256)||!Number.isSafeInteger(record.bytes)||record.bytes<1)fail('vault_corrupt','Copia IndexedDB non valida.');
  const career=parseCareerJson(record.raw,validate);
  if(bytes(record.raw)!==record.bytes)fail('vault_corrupt','Dimensioni della copia IndexedDB non coerenti.');
  return career;
}
export async function readVerifiedVaultSlot(vault,id,validate){
  const entry=await vault.get(id);if(!entry)fail('vault_missing','Non è presente alcuna copia IndexedDB di questa carriera.');
  const career=checkedRecord(entry,validate);
  if(await sha256Text(entry.raw,vault.cryptoImpl)!==entry.sha256)fail('vault_corrupt','Controllo di integrità della copia IndexedDB fallito.');
  return {entry,career};
}
export async function archiveCareerSlot(vault,id,raw,validate,{now=()=>new Date().toISOString()}={}){
  if(!validId(id))fail('invalid_slot','ID di carriera non valido.');
  parseCareerJson(raw,validate);
  const sha256=await sha256Text(raw,vault.cryptoImpl);
  const present=await vault.get(id);
  if(present){
    if(Number.isInteger(present.schemaVersion)&&present.schemaVersion>1)fail('vault_future','Copia IndexedDB creata da una versione successiva: non sarà sovrascritta.');
    await readVerifiedVaultSlot(vault,id,validate);
    const source=JSON.parse(raw),previous=JSON.parse(present.raw);
    const currentTime=Date.parse(source.updatedAt),previousTime=Date.parse(previous.updatedAt);
    if(Number.isFinite(currentTime)&&Number.isFinite(previousTime)&&previousTime>currentTime){
      fail('vault_newer','La copia IndexedDB è più recente dello slot locale. Esporta o recupera la copia, senza sovrascriverla.');
    }
  }
  if(present&&present.sha256===sha256&&present.raw===raw){
    await readVerifiedVaultSlot(vault,id,validate);
    return {changed:false,bytes:bytes(raw)};
  }
  const savedAt=now();
  const record={id,raw,sha256,bytes:bytes(raw),savedAt,schemaVersion:1};
  await vault.put(record);
  // Read-after-write and checksum checks are mandatory before reporting success.
  const checked=await readVerifiedVaultSlot(vault,id,validate);
  if(checked.entry.raw!==raw)fail('vault_write_failed','La copia IndexedDB non è stata verificata.');
  return {changed:true,bytes:record.bytes};
}
export async function mirrorCatalogToVault(storage,vault,validate){
  const catalog=readCareerCatalog(storage),original=storage.getItem(CAREER_CATALOG_KEY);
  const results=[];
  for(const item of catalog.slots){
    const raw=storage.getItem(item.storageKey);
    if(raw===null){results.push({id:item.id,status:'missing_local'});continue;}
    try{
      const saved=await archiveCareerSlot(vault,item.id,raw,validate);
      results.push({id:item.id,status:'ok',...saved});
    }catch(err){results.push({id:item.id,status:'error',code:err.code||err.name||'write_failed'});}
  }
  // If another tab changed the catalog while archiving, do not claim a full
  // verified sync. No local source is ever deleted and retry is safe.
  if(storage.getItem(CAREER_CATALOG_KEY)!==original)fail('catalog_conflict','Il catalogo è cambiato durante la copia IndexedDB. Riprova.');
  return {results,mirrored:results.filter(r=>r.status==='ok').length,errors:results.filter(r=>r.status==='error').length,missing:results.filter(r=>r.status==='missing_local').length};
}
export async function restoreSlotFromVault(storage,vault,id,validate,{now=()=>new Date().toISOString()}={}){
  const {entry,career}=await readVerifiedVaultSlot(vault,id,validate);
  const originalCatalog=storage.getItem(CAREER_CATALOG_KEY),catalog=readCareerCatalog(storage);
  const slot=catalog.slots.find(s=>s.id===id);
  if(!slot)fail('vault_orphan','La copia non corrisponde a uno slot nel catalogo.');
  const current=storage.getItem(slot.storageKey);
  if(current===entry.raw)return {restored:false,backupKey:null};
  // No silent overwrite: caller requires explicit confirmation, and any
  // displaced bytes (even invalid JSON) must have a verified backup first.
  const backupKey=current!==null?backupRawCareer(storage,current,'before-vault-restore'):null;
  if(storage.getItem(slot.storageKey)!==current)fail('slot_conflict','Lo slot locale è stato modificato durante il recupero.');
  if(storage.getItem(CAREER_CATALOG_KEY)!==originalCatalog)fail('catalog_conflict','Il catalogo è cambiato durante il recupero.');
  storage.setItem(slot.storageKey,entry.raw);
  if(storage.getItem(slot.storageKey)!==entry.raw)fail('slot_write_failed','Ripristino IndexedDB non verificato.');
  parseCareerJson(storage.getItem(slot.storageKey),validate);
  const metadata=metadataFromCareer(career,{id,storageKey:slot.storageKey,name:slot.name,createdAt:slot.createdAt,lastSavedAt:now()});
  try{writeCareerCatalog(storage,{...catalog,slots:catalog.slots.map(s=>s.id===id?metadata:s)});}
  catch(err){ // Never leave a failed metadata commit presenting a new career as old.
    try{if(current===null)storage.removeItem(slot.storageKey);else storage.setItem(slot.storageKey,current);}catch{/* preserved backup if old bytes existed */}
    throw err;
  }
  return {restored:true,backupKey,career};
}
export async function estimateCareerStorage(storageManager=globalThis.navigator?.storage){
  if(typeof storageManager?.estimate!=='function')return {supported:false,warning:false};
  try{
    const {usage,quota}=await storageManager.estimate();
    if(!Number.isFinite(usage)||!Number.isFinite(quota)||quota<=0)return {supported:false,warning:false};
    const remaining=Math.max(0,quota-usage);
    return {supported:true,usage,quota,remaining,ratio:usage/quota,warning:remaining<5_000_000||usage/quota>=0.9};
  }catch{return {supported:false,warning:false};}
}
// Emergency archive intentionally differs from the normal portable archive:
// preserve even INVALID original bytes, plus unsaved in-memory state and
// verified IndexedDB records. Never write to localStorage during export.
export async function createEmergencyExport(storage,vault,memoryWorld,validate){
  const entries=[],errors=[];
  try{
    for(let i=0;i<storage.length;i++){
      const key=storage.key(i);
      if(key?.startsWith('football-architect:career:')||key?.startsWith('touchline-dynasty:career:')||key?.startsWith('lega-aurora-manager:career:')){
        const raw=storage.getItem(key);if(typeof raw==='string')entries.push({source:'localStorage',key,raw});
      }
    }
  }catch(err){errors.push(`localStorage: ${err.message||'unavailable'}`);}
  try{
    if(vault){
      const records=await vault.list();
      for(const record of records){
        try{await readVerifiedVaultSlot(vault,record.id,validate);entries.push({source:'indexedDB',key:record.id,raw:record.raw,sha256:record.sha256});}
        catch(err){errors.push(`IndexedDB ${record.id}: ${err.code||err.message}`);}
      }
    }
  }catch(err){errors.push(`IndexedDB: ${err.message||'unavailable'}`);}
  let activeMemory=null;
  try{if(memoryWorld){activeMemory=JSON.stringify(memoryWorld);parseCareerJson(activeMemory,validate);}}
  catch(err){errors.push(`memory: ${err.code||err.message}`);activeMemory=null;}
  if(activeMemory)entries.unshift({source:'memory',key:'unsaved-current-career',raw:activeMemory});
  if(!entries.length)fail('emergency_empty','Nessun dato disponibile da esportare.');
  return JSON.stringify({format:VAULT_EXPORT_FORMAT,version:1,createdAt:new Date().toISOString(),entries,errors},null,2);
}
