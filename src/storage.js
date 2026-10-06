// Football Architect save format. The active engine still writes the original
// Current career JSON format and safeguards for valid saved worlds.
export const SAVE_SCHEMA_VERSION=1;
export const CAREER_STORAGE_KEY='football-architect:career:v1';
export const PREVIOUS_CAREER_STORAGE_KEY='touchline-dynasty:career:v1';
export const LEGACY_CAREER_STORAGE_KEY='lega-aurora-manager:career:v1';
export const CAREER_BACKUP_PREFIX='football-architect:career:backup:';

export class SaveFormatError extends Error {
  constructor(code,message){super(message);this.name='SaveFormatError';this.code=code;}
}

const fail=(code,message)=>{throw new SaveFormatError(code,message);};
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const copyJson=value=>JSON.parse(JSON.stringify(value));

// Current v1: {version:1,...world}. Proposed future v2:
// {schemaVersion:2,format:'football-architect-career',career:{...world},metadata:{...}}.
// A v2 reader/writer/migration is NOT registered in production yet.
export function saveSchemaVersion(value){
  if(!isObject(value))return null;
  const hasSchema=own(value,'schemaVersion');
  const version=hasSchema?value.schemaVersion:value.version;
  if(!Number.isSafeInteger(version)||version<1)return null;
  // An explicit newer schema must never be mistaken for legacy v1, even if
  // obsolete 'version' metadata is also present and inconsistent.
  if(hasSchema&&own(value,'version')&&value.version!==version){
    // If either marker names a future schema, fail closed instead of treating
    // it as a damaged old save that may be overwritten on the next autosave.
    if(Number.isSafeInteger(value.version)&&value.version>1)return Math.max(value.version,version);
    if(version===1)return null;
  }
  return version;
}

export function parseCareerJson(raw,validate){
  let data;
  try{data=JSON.parse(raw);}catch{fail('invalid_json','Il JSON del salvataggio non è valido.');}
  const version=saveSchemaVersion(data);
  if(version>SAVE_SCHEMA_VERSION)fail('unsupported_version',`Questo salvataggio usa lo schema ${version}, più recente del formato supportato (${SAVE_SCHEMA_VERSION}). Aggiorna Football Architect; i dati originali non saranno sovrascritti.`);
  if(version!==SAVE_SCHEMA_VERSION||!validate(data))fail('invalid_save','Il file non contiene un salvataggio valido e compatibile.');
  return data;
}

// Validate before doing any writes; never hide an unsupported newest save by
// silently switching to a different career or overwriting it with a new game.
export function loadCareer(storage,isValid,createWorld){
  for(const key of [CAREER_STORAGE_KEY,PREVIOUS_CAREER_STORAGE_KEY,LEGACY_CAREER_STORAGE_KEY]){
    try{
      const raw=storage.getItem(key);
      if(raw===null||raw==='')continue;
      return parseCareerJson(raw,isValid);
    }
    catch(err){
      if(err?.code==='unsupported_version')throw err;
      console.warn('Cannot read save data:',key,err);
    }
  }
  return createWorld();
}

// Backups store EXACT raw bytes, not reserialized JSON. Backup creation and
// verification must finish BEFORE an import/migration replaces the current key.
export function backupRawCareer(storage,raw,kind='before-change'){
  if(typeof raw!=='string'||raw.length===0)fail('invalid_backup','Impossibile creare un backup senza dati originali.');
  const stamp=Date.now().toString(36);
  for(let attempt=0;attempt<100;attempt++){
    const key=`${CAREER_BACKUP_PREFIX}${stamp}:${kind}:${attempt}`;
    if(storage.getItem(key)!==null)continue;
    storage.setItem(key,raw);
    if(storage.getItem(key)!==raw)fail('backup_failed','Il backup non è stato verificato. Nessun salvataggio è stato sostituito.');
    return key;
  }
  fail('backup_failed','Non è stato possibile trovare una chiave libera per il backup.');
}

function ensureNotFutureStorage(storage){
  const raw=storage.getItem(CAREER_STORAGE_KEY);
  if(!raw)return raw;
  try{
    const parsed=JSON.parse(raw),version=saveSchemaVersion(parsed);
    if(version>SAVE_SCHEMA_VERSION)fail('unsupported_version',`Salvataggio in formato futuro (${version}): non sarà sovrascritto.`);
  }catch(err){if(err instanceof SaveFormatError)throw err;}
  return raw;
}

// Autosave keeps the exact legacy v1 shape and storage key. No migration here.
export function persistCareer(storage,career,isValid){
  if(saveSchemaVersion(career)!==SAVE_SCHEMA_VERSION||!isValid(career))fail('invalid_save','Impossibile salvare una carriera non valida.');
  const existing=ensureNotFutureStorage(storage);
  if(existing){
    try{JSON.parse(existing);}catch{backupRawCareer(storage,existing,'invalid-json');}
  }
  storage.setItem(CAREER_STORAGE_KEY,JSON.stringify(career));
}
