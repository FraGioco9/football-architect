// SIM01.05 — Read-only match preview checkpoints, isolated per career slot.
// An immutable event stream is stored once; subsequent ticks only write a tiny
// cursor checkpoint. This is independent of the versioned career save format.
import {createMatchPlayback} from './match-playback.js';

export const MATCH_PREVIEW_STORAGE_VERSION=1;
export const MATCH_PREVIEW_STORAGE_PREFIX='football-architect:match-preview:v1:';
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9-]{7,79}$/.test(id);
const fail=(code,message)=>{const error=new Error(message);error.code=code;throw error;};
const keys=id=>{
  if(!validId(id))fail('preview_slot','Slot carriera non valido.');
  return {record:MATCH_PREVIEW_STORAGE_PREFIX+id+':record',progress:MATCH_PREVIEW_STORAGE_PREFIX+id+':progress'};
};
// FNV-1a x2 detects incidental truncation/corruption. NOT a security signature.
const fingerprint=raw=>{
  let h=2166136261>>>0,g=0x9e3779b9;
  for(let i=0;i<raw.length;i++){
    const c=raw.charCodeAt(i);
    h=Math.imul(h^c,16777619)>>>0;
    g=Math.imul(g^(c+i),2246822519)>>>0;
  }
  return raw.length.toString(36)+'-'+h.toString(16).padStart(8,'0')+'-'+g.toString(16).padStart(8,'0');
};
// Storage timestamps and inbox read status are not match inputs: a normal
// save or reading mail must not make an unfinished preview unresumable.
export const previewWorldFingerprint=world=>{
  const {updatedAt,inbox,unread,...footballState}=world;
  return fingerprint(JSON.stringify(footballState));
};
const encode=value=>JSON.stringify(value);
const parse=(raw,code)=>{
  try{return JSON.parse(raw);}catch{fail(code,'I dati dell’anteprima non sono leggibili. Nessun dato è stato sovrascritto.');}
};
const verifiedWrite=(storage,key,raw)=>{
  storage.setItem(key,raw);
  if(storage.getItem(key)!==raw)fail('preview_write','Impossibile verificare il salvataggio dell’anteprima.');
};
function fixtureFor(world,record){
  if(!world?.clubId||!Array.isArray(world.fixtures))return false;
  const fixture=world.fixtures[world.round]?.matches?.find(m=>m.id===record.matchId);
  return !!fixture&&fixture.result==null&&fixture.home===record.homeTeamId&&fixture.away===record.awayTeamId&&
    [fixture.home,fixture.away].includes(world.clubId)&&record.season===world.season&&record.competitionId===world.countryId;
}
const compatible=(world,stored)=>stored?.version===MATCH_PREVIEW_STORAGE_VERSION&&
  stored.worldFingerprint===previewWorldFingerprint(world)&&fixtureFor(world,stored.record);

function checkedRecord(storage,slotId,world){
  const {record:key}=keys(slotId),raw=storage.getItem(key);
  if(raw===null)return null;
  const saved=parse(raw,'preview_invalid');
  if(Number.isSafeInteger(saved?.version)&&saved.version>MATCH_PREVIEW_STORAGE_VERSION)
    fail('preview_future','Anteprima creata con una versione futura: non verrà modificata.');
  if(!saved||saved.version!==MATCH_PREVIEW_STORAGE_VERSION||saved.slotId!==slotId||
    typeof saved.checksum!=='string'||fingerprint(encode(saved.record))!==saved.checksum||
    !compatible(world,saved))fail('preview_stale','L’anteprima non corrisponde più alla carriera attiva oppure è danneggiata. Eliminala esplicitamente per ricominciare.');
  try{createMatchPlayback(saved.record);}catch{fail('preview_invalid','La cronologia dell’anteprima è danneggiata.');}
  return saved;
}
function checkProgress(raw,saved){
  if(raw===null)return {version:1,slotId:saved.slotId,matchId:saved.record.matchId,checksum:saved.checksum,cursor:0,paused:true,speed:1};
  const state=parse(raw,'preview_progress_invalid');
  if(Number.isInteger(state?.version)&&state.version>MATCH_PREVIEW_STORAGE_VERSION)
    fail('preview_future','Stato della partita creato con una versione futura.');
  if(state?.version!==1||state.slotId!==saved.slotId||state.matchId!==saved.record.matchId||
    state.checksum!==saved.checksum||!Number.isSafeInteger(state.cursor)||
    state.cursor<0||state.cursor>saved.record.events.length||typeof state.paused!=='boolean'||
    ![1,2,4].includes(state.speed))fail('preview_progress_invalid','Checkpoint dell’anteprima danneggiato: nessun dato sovrascritto.');
  return state;
}
export function loadStoredMatchPreview(storage,slotId,world){
  const k=keys(slotId),saved=checkedRecord(storage,slotId,world);
  if(!saved){
    if(storage.getItem(k.progress)!==null)fail('preview_progress_invalid','Checkpoint senza cronologia: cancellazione esplicita necessaria.');
    return null;
  }
  const state=checkProgress(storage.getItem(k.progress),saved);
  // Restore ALWAYS paused so a closed/background tab never advances invisibly.
  return {record:saved.record,cursor:state.cursor,paused:true,speed:state.speed,previousCursor:state.cursor,previousCheckpoint:fingerprint(storage.getItem(k.progress)||'')};
}
export function startStoredMatchPreview(storage,slotId,world,playback){
  const k=keys(slotId),existing=checkedRecord(storage,slotId,world);
  if(existing)return loadStoredMatchPreview(storage,slotId,world);
  if(storage.getItem(k.progress)!==null)fail('preview_progress_invalid','Checkpoint orfano non sovrascritto.');
  if(playback?.cursor!==0||playback?.speed!==1||playback?.record===undefined)
    fail('preview_invalid','L’anteprima deve iniziare da zero.');
  createMatchPlayback(playback.record);
  if(!fixtureFor(world,playback.record))fail('preview_stale','Partita non disponibile nella carriera attiva.');
  const saved={version:1,slotId,worldFingerprint:previewWorldFingerprint(world),
    checksum:fingerprint(encode(playback.record)),record:playback.record};
  verifiedWrite(storage,k.record,encode(saved));
  // A crash after writing the immutable record and before the first checkpoint
  // recovers at cursor zero without regenerating any events.
  return saveStoredMatchPreviewProgress(storage,slotId,world,playback);
}
export function saveStoredMatchPreviewProgress(storage,slotId,world,playback){
  const k=keys(slotId),saved=checkedRecord(storage,slotId,world);
  if(!saved)fail('preview_missing','Anteprima da salvare non trovata.');
  if(!playback||playback.record!==saved.record&&fingerprint(encode(playback.record))!==saved.checksum)
    fail('preview_conflict','Una cronologia differente non può sovrascrivere la partita salvata.');
  if(!Number.isSafeInteger(playback.cursor)||playback.cursor<0||playback.cursor>saved.record.events.length||
    typeof playback.paused!=='boolean'||![1,2,4].includes(playback.speed))fail('preview_progress_invalid','Stato della riproduzione non valido.');
  // Fail closed on corrupt, concurrent or future state rather than overwriting.
  const before=storage.getItem(k.progress);
  const previous=checkProgress(before,saved);
  if(previous.cursor>playback.cursor)fail('preview_conflict','Una scheda ha già raggiunto un punto successivo della partita.');
  // The caller's previous cursor must match the disk cursor; prevents writes
  // from another tab with the same or older preview state.
  const expected=playback.previousCursor;
  if(expected!==undefined&&previous.cursor!==expected)fail('preview_conflict','L’anteprima è stata modificata in un’altra scheda.');
  if(playback.previousCheckpoint!==undefined&&playback.previousCheckpoint!==fingerprint(before||''))
    fail('preview_conflict','Checkpoint aggiornato da un’altra scheda.');
  const state={version:1,slotId,matchId:saved.record.matchId,checksum:saved.checksum,
    cursor:playback.cursor,paused:playback.paused,speed:playback.speed};
  if(storage.getItem(k.progress)!==before)fail('preview_conflict','Checkpoint modificato durante il salvataggio.');
  verifiedWrite(storage,k.progress,encode(state));
  return {...playback,previousCursor:state.cursor,previousCheckpoint:fingerprint(encode(state))};
}
export function discardStoredMatchPreview(storage,slotId){
  const k=keys(slotId);
  // Deleting a preview never deletes any career save, catalog, or checkpoint.
  for(const key of [k.progress,k.record]){
    storage.removeItem(key);
    if(storage.getItem(key)!==null)fail('preview_write','Impossibile verificare la cancellazione dell’anteprima.');
  }
}
export function hasStoredMatchPreview(storage,slotId){
  const k=keys(slotId);return storage.getItem(k.record)!==null||storage.getItem(k.progress)!==null;
}
