import {createSession,validSession} from './simulation.js';
import {getLeagueClubs} from './leagues.js';
import {normalizeManagerProfile,managerFullName,validManagerProfile} from './manager-profile.js';

export const CAREER_DB='football-architect-careers-v1';
export const EXPORT_FORMAT='football-architect-career';
const NOW=()=>new Date().toISOString();
const nameOk=n=>typeof n==='string'&&n.trim().length>=1&&n.trim().length<=80;
const iso=t=>typeof t==='string'&&Number.isFinite(Date.parse(t));
const error=(code)=>new Error(code);
function transaction(db,stores,mode,operation){
 return new Promise((resolve,reject)=>{
  let result,settled=false;
  const tx=db.transaction(stores,mode);
  const fail=e=>{if(!settled){settled=true;reject(e);}};
  tx.oncomplete=()=>{if(!settled){settled=true;resolve(result);}};
  tx.onerror=()=>fail(tx.error||error('IDB_TRANSACTION'));
  tx.onabort=()=>fail(tx.error||error('IDB_ABORT'));
  try{operation(tx,value=>{result=value;});}catch(e){try{tx.abort();}catch{}fail(e);}
 });
}
export function openCareerDatabase(factory=globalThis.indexedDB){
 if(!factory?.open)return Promise.reject(error('INDEXEDDB_UNAVAILABLE'));
 return new Promise((resolve,reject)=>{
  let req;
  try{req=factory.open(CAREER_DB,1);}catch(e){reject(e);return;}
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains('careers'))db.createObjectStore('careers',{keyPath:'id'});
   if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots',{keyPath:'id'});
   if(!db.objectStoreNames.contains('preferences'))db.createObjectStore('preferences',{keyPath:'key'});
  };
  req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>db.close();resolve(db);};
  req.onerror=()=>reject(req.error||error('INDEXEDDB_OPEN'));
  req.onblocked=()=>reject(error('INDEXEDDB_BLOCKED'));
 });
}
export function validMeta(m){
 return Boolean(m&&typeof m==='object'&&!Array.isArray(m)&&
  typeof m.id==='string'&&m.id.length>=8&&m.id.length<=128&&
  nameOk(m.managerName)&&(m.careerName===undefined||nameOk(m.careerName))&&typeof m.countryId==='string'&&
  Number.isSafeInteger(m.clubId)&&m.clubId>0&&
  iso(m.createdAt)&&iso(m.updatedAt)&&m.schemaVersion===1&&
  (m.managerProfile===undefined||(validManagerProfile(m.managerProfile)&&managerFullName(m.managerProfile)===m.managerName)));
}
export function checkEntry(meta,record){
 if(!validMeta(meta)||!record||typeof record.raw!=='string')return null;
 try{
  const state=JSON.parse(record.raw);
  if(!validSession(state)||state.countryId!==meta.countryId||state.clubId!==meta.clubId)return null;
  return state;
 }catch{return null;}
}
export function readCatalog(db){
 return transaction(db,['careers','snapshots','preferences'],'readonly',(tx,done)=>{
  let metas=[],snapshots=[];
  tx.objectStore('careers').getAll().onsuccess=e=>{metas=e.target.result;};
  tx.objectStore('snapshots').getAll().onsuccess=e=>{snapshots=e.target.result;};
  // The final ordered request observes all prior results within the transaction.
  tx.objectStore('preferences').get('active').onsuccess=e=>{
   const active=e.target.result?.value;
   const map=new Map(snapshots.map(s=>[s.id,s]));
   const all=metas.map(meta=>{
    const state=checkEntry(meta,map.get(meta?.id));
    return {id:typeof meta?.id==='string'?meta.id:'invalid',meta,status:state?'ok':'corrupt',state};
   });
   const known=new Set(metas.map(m=>m.id));
   for(const snap of snapshots)if(!known.has(snap.id))all.push({id:snap.id,meta:null,status:'corrupt',state:null});
   all.sort((a,b)=>(b.meta?.updatedAt??'').localeCompare(a.meta?.updatedAt??'')||a.id.localeCompare(b.id));
   done({rows:all,activeId:active??null});
  };
 });
}
export function bestCareer(catalog){
 const rows=catalog?.rows??[];
 return rows.find(r=>r.id===catalog?.activeId&&r.status==='ok')??rows.find(r=>r.status==='ok')??null;
}
export function createCareer(db,{managerName=null,managerProfile=null,countryId,clubId,session=null,careerName=null,source=null,legacyImport=false,id=globalThis.crypto?.randomUUID?.(),now=NOW()}){
 const hasProfile=managerProfile!==null&&managerProfile!==undefined;
 if(!hasProfile&&!legacyImport)throw error('CAREER_DATA_INVALID');
 if(hasProfile&&!validManagerProfile(managerProfile))throw error('CAREER_DATA_INVALID');
 const profile=hasProfile?normalizeManagerProfile(managerProfile):null;
 const fullName=hasProfile?managerFullName(profile):managerName;
 if(!nameOk(fullName)||(managerName!==null&&hasProfile&&managerName.trim()!==fullName)||
    (careerName!==null&&!nameOk(careerName))||typeof id!=='string'||id.length<8||!iso(now))throw error('CAREER_DATA_INVALID');
 const state=session??createSession(countryId,clubId);
 if(!validSession(state)||state.countryId!==countryId||state.clubId!==clubId)throw error('CAREER_DATA_INVALID');
 const defaultName=getLeagueClubs(countryId).find(c=>c.id===clubId)?.name;
 const meta={id,schemaVersion:1,careerName:(careerName??defaultName??fullName).trim(),
  managerName:fullName.trim(),countryId,clubId,createdAt:now,updatedAt:now};
 if(profile)meta.managerProfile=profile;
 if(source==='minimal-v1')meta.source=source;
 return transaction(db,['careers','snapshots','preferences'],'readwrite',(tx,done)=>{
  const careers=tx.objectStore('careers'),snapshots=tx.objectStore('snapshots');
  const get=careers.get(id);
  get.onsuccess=()=>{
   if(get.result){tx.abort();return;}
   careers.put(meta);
   snapshots.put({id,raw:JSON.stringify(state)});
   tx.objectStore('preferences').put({key:'active',value:id});
   done({meta,state});
  };
 });
}
export function selectCareer(db,id){
 return transaction(db,['careers','snapshots','preferences'],'readwrite',(tx,done)=>{
  const cars=tx.objectStore('careers'),shots=tx.objectStore('snapshots'),get=cars.get(id);
  get.onsuccess=()=>{
   const meta=get.result,read=shots.get(id);
   read.onsuccess=()=>{
    const state=checkEntry(meta,read.result);
    if(!state){tx.abort();return;}
    tx.objectStore('preferences').put({key:'active',value:id});
    done({meta,state});
   };
  };
 });
}
export function saveCareer(db,id,state,{expectedDays=null,now=NOW()}={}){
 if(!validSession(state)||!iso(now))throw error('CAREER_DATA_INVALID');
 return transaction(db,['careers','snapshots'],'readwrite',(tx,done)=>{
  const cars=tx.objectStore('careers'),shots=tx.objectStore('snapshots'),get=cars.get(id);
  get.onsuccess=()=>{
   const meta=get.result,read=shots.get(id);
   read.onsuccess=()=>{
    const existing=checkEntry(meta,read.result);
    if(!existing||existing.countryId!==state.countryId||existing.clubId!==state.clubId){
     tx.abort();return;
    }
    if(expectedDays!==null&&existing.daysElapsed!==expectedDays){tx.abort();return;}
    if(state.daysElapsed<existing.daysElapsed){tx.abort();return;}
    const updated={...meta,updatedAt:now};
    cars.put(updated);
    shots.put({id,raw:JSON.stringify(state)});
    done({meta:updated,state});
   };
  };
 });
}
export function renameCareer(db,id,careerName,now=NOW()){
 if(!nameOk(careerName)||!iso(now))throw error('CAREER_NAME_INVALID');
 return transaction(db,['careers'],'readwrite',(tx,done)=>{
  const cars=tx.objectStore('careers'),req=cars.get(id);
  req.onsuccess=()=>{
   if(!validMeta(req.result)){tx.abort();return;}
   const meta={...req.result,careerName:careerName.trim(),updatedAt:now};
   cars.put(meta);done(meta);
  };
 });
}
export function deleteCareer(db,id){
 return transaction(db,['careers','snapshots','preferences'],'readwrite',(tx,done)=>{
  tx.objectStore('careers').delete(id);
  tx.objectStore('snapshots').delete(id);
  const store=tx.objectStore('preferences'),req=store.get('active');
  req.onsuccess=()=>{if(req.result?.value===id)store.delete('active');done(true);};
 });
}
export function exportCareer(db,id){
 return transaction(db,['careers','snapshots'],'readonly',(tx,done)=>{
  let meta=null,record=null;
  tx.objectStore('careers').get(id).onsuccess=e=>{meta=e.target.result??null;};
  tx.objectStore('snapshots').get(id).onsuccess=e=>{
   record=e.target.result??null;
   done({format:EXPORT_FORMAT,version:1,meta,snapshotRaw:record?.raw??null});
  };
 });
}
export function parseCareerImport(text){
 if(typeof text!=='string'||text.length>2_000_000)throw error('IMPORT_INVALID');
 let payload;
 try{payload=JSON.parse(text);}catch{throw error('IMPORT_INVALID');}
 if(payload?.format!==EXPORT_FORMAT||payload.version!==1||!nameOk(payload.meta?.managerName)||typeof payload.snapshotRaw!=='string')throw error('IMPORT_INVALID');
 const state=checkEntry(payload.meta,{raw:payload.snapshotRaw});
 if(!state)throw error('IMPORT_INVALID');
 return {managerName:payload.meta.managerName,managerProfile:payload.meta.managerProfile??null,
  legacyImport:payload.meta.managerProfile===undefined,careerName:payload.meta.careerName??null,
  countryId:state.countryId,clubId:state.clubId,session:state};
}
