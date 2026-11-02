// DEBUG-DATA-01 I05 — DEV-only candidate subscription registry.
// Does not import a page renderer or modify DOM. Consumers must opt in from DEV.
const listeners=new Set();
let snapshot=null,lastRevision=0;
const isRevision=value=>Number.isInteger(value)&&value>0;
export function currentProtectedCandidates(){return snapshot;}
export function subscribeProtectedCandidates(listener){
 if(typeof listener!=="function")throw TypeError("I05 subscriber must be a function");
 listeners.add(listener);
 if(snapshot)listener(snapshot);
 return ()=>listeners.delete(listener);
}
export function acceptProtectedCandidates(detail){
 const revision=detail?.revision;
 if(!isRevision(revision)||revision<=lastRevision)return false;
 const consumers=detail.consumers;
 if(consumers?.acceptance!=="UNSEALED_NOT_FOR_RUNTIME"||
  consumers.source?.kind!=="debug"||consumers.source.namespace!=="local-debug"||
  consumers.source.datasetId!=="debug-corpus-v1"||
  consumers.cursor?.seasonNumber!==detail.season||
  consumers.cursor?.worldDay!==detail.day||
  consumers.cursor?.competitionId!==detail.competitionId)return false;
 lastRevision=revision;
 snapshot=Object.freeze({revision,season:detail.season,day:detail.day,
  competitionId:detail.competitionId,consumers});
 for(const fn of [...listeners])fn(snapshot);
 return true;
}
export function invalidateProtectedCandidates(revision){
 if(!isRevision(revision)||revision<lastRevision)return false;
 lastRevision=revision;
 snapshot=null;
 for(const fn of [...listeners])fn(null);
 return true;
}
