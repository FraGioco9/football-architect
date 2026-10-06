// QOL01.01 — Lightweight catalogue of career references, NOT a save migration.
// A slot entry points to existing career bytes; the catalogue never embeds or
// rewrites gameplay data. QOL01.02 will migrate those bytes to dedicated slots.
import {CAREER_STORAGE_KEY,SAVE_SCHEMA_VERSION,SaveFormatError,saveSchemaVersion} from './storage.js';

export const CAREER_CATALOG_KEY='football-architect:career:catalog:v1';
export const CAREER_CATALOG_VERSION=1;
const MAX_SLOTS=100;
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=(code,message)=>{throw new SaveFormatError(code,message);};
const emptyCatalog=()=>({catalogVersion:CAREER_CATALOG_VERSION,activeSlotId:null,slots:[]});
const isIso=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const validId=s=>typeof s==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9-]{7,79}$/.test(s);
const validText=(s,max=160)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const validKey=s=>s===CAREER_STORAGE_KEY||(typeof s==='string'&&/^football-architect:career:slot:[a-zA-Z0-9-]{8,80}$/.test(s));

export function validateCareerCatalog(catalog){
  if(!isObject(catalog)||catalog.catalogVersion!==CAREER_CATALOG_VERSION||!Array.isArray(catalog.slots)||catalog.slots.length>MAX_SLOTS)return false;
  if(catalog.activeSlotId!==null&&!validId(catalog.activeSlotId))return false;
  const ids=new Set(),keys=new Set();
  for(const slot of catalog.slots){
    if(!isObject(slot)||!validId(slot.id)||!validText(slot.name)||!validText(slot.manager,80)
      ||!validKey(slot.storageKey)||!validText(slot.countryId,12)
      ||!Number.isSafeInteger(slot.season)||slot.season<1
      ||!Number.isSafeInteger(slot.round)||slot.round<0
      ||!Number.isSafeInteger(slot.saveSchemaVersion)||slot.saveSchemaVersion<1
      ||!isIso(slot.createdAt)||!isIso(slot.lastSavedAt)
      ||(slot.clubId!==null&&(!Number.isSafeInteger(slot.clubId)||slot.clubId<1))
      ||(slot.clubName!==null&&!validText(slot.clubName))
      ||ids.has(slot.id)||keys.has(slot.storageKey))return false;
    ids.add(slot.id);keys.add(slot.storageKey);
  }
  return catalog.activeSlotId===null||ids.has(catalog.activeSlotId);
}

export function readCareerCatalog(storage){
  const raw=storage.getItem(CAREER_CATALOG_KEY);
  if(raw===null)return emptyCatalog();
  let data;
  try{data=JSON.parse(raw);}catch{fail('invalid_catalog','Il catalogo delle carriere contiene un JSON non valido. Nessuna voce sarà sovrascritta.');}
  if(Number.isSafeInteger(data?.catalogVersion)&&data.catalogVersion>CAREER_CATALOG_VERSION){
    fail('unsupported_catalog_version','Il catalogo è stato creato con una versione più recente. Nessuna voce sarà sovrascritta.');
  }
  if(!validateCareerCatalog(data))fail('invalid_catalog','Catalogo carriere non valido: nessuna voce sarà sovrascritta.');
  return structuredCloneSafe(data);
}

function structuredCloneSafe(value){return JSON.parse(JSON.stringify(value));}

export function writeCareerCatalog(storage,catalog){
  if(!validateCareerCatalog(catalog))fail('invalid_catalog','Impossibile salvare un catalogo di carriere non valido.');
  // Never overwrite unreadable or future-version catalogue data, even on an
  // otherwise successful gameplay autosave.
  readCareerCatalog(storage);
  const raw=JSON.stringify(catalog);
  storage.setItem(CAREER_CATALOG_KEY,raw);
  if(storage.getItem(CAREER_CATALOG_KEY)!==raw)fail('catalog_write_failed','Il catalogo delle carriere non è stato verificato.');
  return structuredCloneSafe(catalog);
}

export function newSlotId(idFactory,used){
  for(let attempt=0;attempt<20;attempt++){
    const id=idFactory();
    if(validId(id)&&!used.has(id))return id;
  }
  fail('catalog_id_failed','Impossibile generare un identificativo univoco per la carriera.');
}

export function defaultIdFactory(){
  if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();
  // Localhost is a secure context on supported browsers; fail closed rather
  // than risk colliding IDs from a clock-based or Math.random fallback.
  fail('catalog_id_failed','Il browser non supporta gli identificativi sicuri per gli slot.');
}

export function metadataFromCareer(career,{id,createdAt,lastSavedAt,storageKey,name}){
  const team=career.teams.find(item=>item.id===career.clubId);
  const clubName=team?.name||null;
  const manager=typeof career.manager==='string'&&career.manager.trim()?career.manager.trim().slice(0,80):'Allenatore';
  const fallbackName=clubName?`${clubName} — ${manager}`:'Nuova carriera';
  return {
    id,name:(name||fallbackName).slice(0,160),manager,
    clubId:team?team.id:null,clubName,countryId:career.countryId||'IT',
    season:career.season,round:career.round,lastSavedAt,createdAt,
    saveSchemaVersion:saveSchemaVersion(career),storageKey,
  };
}
