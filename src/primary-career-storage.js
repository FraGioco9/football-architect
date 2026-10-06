// Football Architect — IndexedDB is the durable PRIMARY career store.
// Legacy localStorage is imported once and is never deleted or silently replaced.
// The synchronous Storage facade supports existing v1 slot/checkpoint helpers;
// irreversible actions await an atomic, read-back-verified IndexedDB commit.
import {sha256Text} from './career-vault.js';
import {SaveFormatError} from './storage.js';

export const PRIMARY_DB_NAME='football-architect-primary-careers';
export const PRIMARY_DB_VERSION=1;
export const PRIMARY_STORE='snapshots';
export const PRIMARY_RECORD_ID='primary';
const fail=(code,message)=>{throw new SaveFormatError(code,message);};
const acceptKey=k=>/^(football-architect:(career:|match-preview:)|touchline-dynasty:career:|lega-aurora-manager:career:)/.test(k);
const encoded=data=>JSON.stringify([...data.entries()].sort(([a],[b])=>a.localeCompare(b)));
function decode(raw){
  let rows;
  try{rows=JSON.parse(raw);}catch{fail('primary_corrupt','Archivio IndexedDB non leggibile. Nessun dato è stato sostituito.');}
  if(!Array.isArray(rows)||rows.some(row=>!Array.isArray(row)||row.length!==2||typeof row[0]!=='string'||typeof row[1]!=='string'||!acceptKey(row[0]))||new Set(rows.map(r=>r[0])).size!==rows.length)fail('primary_corrupt','Archivio IndexedDB incoerente.');
  return new Map(rows);
}
export function createMemoryCareerStorage(initial=[]){
  let data=new Map(initial);
  return {durablePrimary:true,get length(){return data.size;},key:n=>[...data.keys()][n]??null,
    getItem:k=>data.get(String(k))??null,setItem:(k,v)=>{data.set(String(k),String(v));},
    removeItem:k=>{data.delete(String(k));},clear:()=>{data.clear();},
    entries:()=>[...data.entries()],replace:entries=>{data=new Map(entries);}};
}
export function createIndexedDbPrimaryDriver(factory=globalThis.indexedDB){
  let dbPromise;
  function db(){
    if(!dbPromise){
      if(!factory?.open)fail('primary_unavailable','IndexedDB non disponibile: i salvataggi non verranno modificati.');
      dbPromise=new Promise((resolve,reject)=>{
        const req=factory.open(PRIMARY_DB_NAME,PRIMARY_DB_VERSION);
        req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(PRIMARY_STORE))req.result.createObjectStore(PRIMARY_STORE,{keyPath:'id'});};
        req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();dbPromise=null;};resolve(req.result);};
        req.onerror=()=>reject(req.error||Error('Apertura IndexedDB fallita.'));
        req.onblocked=()=>reject(Error('Chiudi le altre schede di Football Architect per aggiornare IndexedDB.'));
      }).catch(err=>{dbPromise=null;throw err;});
    }
    return dbPromise;
  }
  async function read(){
    const connection=await db();return new Promise((resolve,reject)=>{
      const tx=connection.transaction(PRIMARY_STORE,'readonly'),request=tx.objectStore(PRIMARY_STORE).get(PRIMARY_RECORD_ID);
      let value=null;request.onsuccess=()=>{value=request.result??null;};tx.oncomplete=()=>resolve(value);
      tx.onabort=()=>reject(tx.error||Error('Lettura IndexedDB interrotta.'));tx.onerror=()=>{};
    });
  }
  async function compareAndPut(expectedRevision,record){
    const connection=await db();return new Promise((resolve,reject)=>{
      const tx=connection.transaction(PRIMARY_STORE,'readwrite'),store=tx.objectStore(PRIMARY_STORE);
      const readRequest=store.get(PRIMARY_RECORD_ID);
      readRequest.onsuccess=()=>{
        const previous=readRequest.result??null;
        if((previous?.revision??0)!==expectedRevision){try{tx.abort();}catch{}return;}
        store.put(record);
      };
      tx.oncomplete=()=>resolve();
      tx.onabort=()=>reject((tx.error||((readRequest.result?.revision??0)!==expectedRevision?Object.assign(Error('Archivio modificato da un’altra scheda.'),{code:'primary_conflict'}):Error('Commit IndexedDB interrotto.'))));
      tx.onerror=()=>{};
    });
  }
  return {read,compareAndPut};
}
export async function openPrimaryCareerStorage({driver=createIndexedDbPrimaryDriver(),legacyStorage=globalThis.localStorage,cryptoImpl=globalThis.crypto,validate}={}){
  if(!cryptoImpl?.subtle)fail('primary_unavailable','SHA-256 non disponibile: archivio non modificato.');
  const checksum=raw=>sha256Text(raw,cryptoImpl);
  let record=await driver.read(),initial,migrated=false;
  if(record){
    if(record.schemaVersion>1)fail('primary_future','Archivio creato da una versione futura: aggiornare il gioco.');
    if(record.schemaVersion!==1||!Number.isSafeInteger(record.revision)||record.revision<1||typeof record.raw!=='string'||typeof record.sha256!=='string'||(await checksum(record.raw))!==record.sha256)fail('primary_corrupt','Archivio IndexedDB danneggiato: nessuna migrazione automatica.');
    initial=decode(record.raw);
  }else{
    const legacy=[];
    // Read only. Existing localStorage bytes must survive migration unchanged.
    for(let i=0;i<legacyStorage.length;i++){
      const key=legacyStorage.key(i);if(acceptKey(key)){
        const value=legacyStorage.getItem(key);if(value!==null)legacy.push([key,value]);
      }
    }
    initial=new Map(legacy);
    // Validate all registered slots before certifying the primary copy.
    if(validate){
      for(const [key,raw] of initial){
        if(/^football-architect:career:slot:/.test(key)){
          let career;try{career=JSON.parse(raw);}catch{fail('primary_migration_invalid','Slot legacy non leggibile; migrazione interrotta.');}
          if(!validate(career))fail('primary_migration_invalid','Slot legacy non valido; migrazione interrotta.');
        }
      }
    }
    const raw=encoded(initial),sha256=await checksum(raw);
    record={id:PRIMARY_RECORD_ID,schemaVersion:1,revision:1,raw,sha256,updatedAt:new Date().toISOString()};
    await driver.compareAndPut(0,record);
    const checked=await driver.read();
    if(checked?.sha256!==sha256||checked.raw!==raw)fail('primary_write_failed','Migrazione IndexedDB non verificata.');
    migrated=true;
  }
  const storage=createMemoryCareerStorage(initial);
  let committedRaw=record.raw,revision=record.revision;
  let pending=Promise.resolve(),failed=null;
  async function commit(){
    // Serialize all requests; always snapshot at execution time so writes during
    // an in-flight transaction are not lost.
    const perform=async()=>{
      if(failed)throw failed;
      const raw=encoded(new Map(storage.entries()));
      if(raw===committedRaw)return {changed:false,revision};
      const sha256=await checksum(raw);
      const next={id:PRIMARY_RECORD_ID,schemaVersion:1,revision:revision+1,raw,sha256,updatedAt:new Date().toISOString()};
      try{
        await driver.compareAndPut(revision,next);
        const checked=await driver.read();
        if(checked?.revision!==next.revision||checked.raw!==raw||checked.sha256!==sha256)fail('primary_write_failed','Commit IndexedDB non verificato.');
        revision=next.revision;committedRaw=raw;
        return {changed:true,revision,bytes:new TextEncoder().encode(raw).byteLength};
      }catch(err){failed=err;throw err;}
    };
    pending=pending.then(perform,()=>perform());
    return pending;
  }
  function rollback(){storage.replace(decode(committedRaw));}
  function snapshot(){return storage.entries();}
  return {storage,commit,rollback,snapshot,migrated,get revision(){return revision;},get failed(){return failed;},get bytes(){return new TextEncoder().encode(committedRaw).byteLength;}};
}
