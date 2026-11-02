// DEBUG-DATA-01 I02: deterministic artifact planning only; NO filesystem writes.
// A later reviewed exporter must validate every sports invariant before materializing files.
import {hash,DEBUG_SEASONS} from "./debug-data-schema.mjs";
export function planProtectedDebugExport(corpus){
 if(corpus?.status!=="UNSEALED_NOT_FOR_RUNTIME"||corpus.seasons?.length!==5)throw new Error("not a five-season candidate");
 const files=[];
 for(const season of corpus.seasons){
  if(!DEBUG_SEASONS.includes(season.seasonNumber)||!season.candidateHash)throw new Error("invalid candidate");
  const seasonKey="season-"+String(season.seasonNumber).padStart(2,"0");
  for(const [id,fragment] of Object.entries({...season.domestic,...season.cups})){
   if(!/^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$|^int-[12]$/.test(id))throw new Error("invalid competition path");
   const path=seasonKey+"/"+id+".json";
   files.push({path,sha256:hash(fragment),bytes:Buffer.byteLength(JSON.stringify(fragment)),content:fragment});
  }
 }
 if(files.length!==90||new Set(files.map(f=>f.path)).size!==90)throw new Error("expected 90 protected fragments");
 const manifest={schemaVersion:1,kind:"protected-debug-export-plan",status:"UNSEALED_NOT_FOR_RUNTIME",datasetId:corpus.datasetId,seasonNumbers:[...DEBUG_SEASONS],files:files.map(({path,sha256,bytes})=>({path,sha256,bytes}))};
 return {manifest,manifestHash:hash(manifest),files};
}
