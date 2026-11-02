// DEBUG-DATA-01 I04: isolated asynchronous read/projection coordinator.
// No public route, D1 access, session storage, or authoritative fallback.
// This API intentionally returns UNSEALED candidates; I05 cannot activate them
// until the later sporting acceptance and owner-approved cutover.
import {DEBUG_SEASONS,DEBUG_COMPETITIONS} from "./debug-data-schema.mjs";
import {planProtectedDebugExport} from "./debug-data-export-plan.mjs";
import {projectDebugWorldAtDay} from "./debug-data-projection.mjs";

const requireValue=(condition,message)=>{if(!condition)throw new Error("DEBUG-DATA-01 I04: "+message);};
const copy=value=>JSON.parse(JSON.stringify(value));
const safeKey=value=>typeof value==="string"&&/^[a-zA-Z0-9_-]{1,96}$/.test(value);
const freeze=value=>{
 if(value&&typeof value==="object"&&!Object.isFrozen(value)){
  for(const child of Object.values(value))freeze(child);
  Object.freeze(value);
 }
 return value;
};

// Epochs are scoped to a single reader instance. A successful obsolete read
// must never be published into the view that requested a later source/position.
export function createProtectedDebugSeasonReader({loadCorpus,divisions,cupCatalog,seed="debug-data-v1-fresh"}){
 requireValue(typeof loadCorpus==="function","loadCorpus callback required");
 requireValue(Array.isArray(divisions)&&Array.isArray(cupCatalog),"canonical rule catalogs required");
 let epoch=0, identity=null, loaded=null, loading=null,verifiedPlan=null;
 const projected=new Map();
 const close=()=>{epoch++;identity=null;loaded=null;loading=null;verifiedPlan=null;projected.clear();};
 function activate({datasetId}){
  requireValue(safeKey(datasetId),"invalid dataset identifier");
  close();
  identity=freeze({kind:"debug",namespace:"local-debug",datasetId});
  return epoch;
 }
 function current(token,requested){
  return token===epoch&&identity?.datasetId===requested;
 }
 async function open(token,requested){
  if(loaded)return loaded;
  if(!loading){
   const pending=Promise.resolve().then(()=>loadCorpus(requested)).then(corpus=>{
    // A replaced source must not validate or publish its stale payload.
    if(!current(token,requested))return null;
    requireValue(corpus?.datasetId===requested,"dataset identity mismatch");
    requireValue(corpus?.status==="UNSEALED_NOT_FOR_RUNTIME","candidate seal status changed");
    const plan=planProtectedDebugExport(corpus);
    requireValue(plan.manifest.datasetId===requested,"manifest identity mismatch");
    if(current(token,requested)){loaded=corpus;verifiedPlan=plan;}
    return corpus;
   });
   loading=pending;
   pending.finally(()=>{if(loading===pending)loading=null;}).catch(()=>{});
  }
  const result=await loading;
  return current(token,requested)?result:null;
 }
 async function read({seasonNumber,worldDay,competitionId}){
  requireValue(identity!==null,"source not activated");
  requireValue(DEBUG_SEASONS.includes(seasonNumber),"invalid season");
  requireValue(Number.isInteger(worldDay)&&worldDay>=1&&worldDay<=56,"invalid day");
  requireValue(DEBUG_COMPETITIONS.includes(competitionId),"invalid competition");
  const token=epoch,requested=identity.datasetId;
  const corpus=await open(token,requested);
  if(!current(token,requested))return {status:"stale",epoch:token};
  const key=[requested,seasonNumber,worldDay,competitionId].join(":");
  let projection=projected.get(key);
  if(!projection){
   projection=freeze(projectDebugWorldAtDay(corpus,{seasonNumber,worldDay,competitionId,divisions,cupCatalog,seed,verifiedPlan}));
   if(!current(token,requested))return {status:"stale",epoch:token};
   projected.set(key,projection);
  }
  return {status:"candidate",epoch:token,source:copy(identity),projection:copy(projection),
   acceptance:"UNSEALED_NOT_FOR_RUNTIME"};
 }
 async function history({beforeSeasonNumber}){
  requireValue(identity!==null,"source not activated");
  requireValue(Number.isInteger(beforeSeasonNumber)&&beforeSeasonNumber>=1&&beforeSeasonNumber<=6,"invalid history boundary");
  const token=epoch,requested=identity.datasetId;
  const corpus=await open(token,requested);
  if(!current(token,requested))return {status:"stale",epoch:token};
  // Read-only candidate summaries, not a claim of a sealed historical receipt.
  // A season is eligible only when strictly earlier than the selected season.
  const eligible=corpus.seasons.filter(s=>s.seasonNumber<beforeSeasonNumber);
  requireValue(eligible.length===beforeSeasonNumber-1,"incomplete historical sequence");
  const records=eligible.map(s=>({
   seasonNumber:s.seasonNumber,candidateHash:s.candidateHash,
   domesticChampions:Object.fromEntries(Object.entries(s.domesticOutcomes).map(([id,o])=>[id,o.champion])),
   internationalWinners:copy(s.internationalWinners),
   status:"UNSEALED_NOT_FOR_RUNTIME"
  }));
  return {status:"candidate",epoch:token,source:copy(identity),records,
   acceptance:"UNSEALED_NOT_FOR_RUNTIME"};
 }
 return Object.freeze({activate,read,history,close,getEpoch:()=>epoch,
  isCurrent:(token,datasetId)=>current(token,datasetId)});
}
