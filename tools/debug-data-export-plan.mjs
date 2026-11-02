// DEBUG-DATA-01: explicit, data-complete protected export *plan*.
// No writes or publication. An unsealed candidate can never become runtime data.
import {hash,DEBUG_SEASONS,DEBUG_COMPETITIONS,validateSeasonFragment} from "./debug-data-schema.mjs";
import {validateFiveSeasonCandidate} from "./debug-data-corpus-validator.mjs";
export function planProtectedDebugExport(corpus){
 const validity=validateFiveSeasonCandidate(corpus);
 if(validity.maySeal!==false||corpus.status!=="UNSEALED_NOT_FOR_RUNTIME")throw Error("only unsealed candidate planning allowed");
 const files=[];
 for(const season of corpus.seasons){
  if(!DEBUG_SEASONS.includes(season.seasonNumber)||!season.candidateHash)throw Error("invalid candidate");
  const seasonKey="season-"+String(season.seasonNumber).padStart(2,"0");
  for(const id of DEBUG_COMPETITIONS){
   const domestic=!id.startsWith("int-");
   const league=domestic?season.domestic[id]:null;
   const cup=domestic?null:season.cups[id];
   const outcome=domestic?season.domesticOutcomes[id]:null;
   const postseason=domestic?season.domesticPostseasonEvents[id]:null;
   if(domestic){
    validateSeasonFragment(league);
    if(postseason?.length!==(id.endsWith("-1")?2:5)||!outcome?.ties)throw Error("missing domestic postseason "+id);
   }else if(!cup?.events||!cup?.ties)throw Error("missing international cup "+id);
   const fragment=domestic?{
    schemaVersion:1,source:league.source,seasonNumber:season.seasonNumber,competitionId:id,
    participants:league.participants,events:[...league.events,...postseason],postseason:outcome.ties,
    finalTable:outcome.rankedClubs,champion:outcome.champion,
    promoted:outcome.promoted,relegated:outcome.relegated
   }:{
    schemaVersion:1,source:cup.source,seasonNumber:season.seasonNumber,competitionId:id,
    participants:cup.participants,events:cup.events,pots:cup.pots??null,
    ranking:cup.ranking,ties:cup.ties,champion:cup.winner
   };
   validateSeasonFragment(fragment);
   const path=seasonKey+"/"+id+".json",serialized=JSON.stringify(fragment);
   files.push({path,sha256:hash(serialized),bytes:Buffer.byteLength(serialized),content:fragment});
  }
 }
 if(files.length!==90||new Set(files.map(f=>f.path)).size!==90)throw Error("expected 90 protected fragments");
 const manifest={schemaVersion:1,kind:"protected-debug-export-plan",status:"UNSEALED_NOT_FOR_RUNTIME",
  datasetId:corpus.datasetId,seasonNumbers:[...DEBUG_SEASONS],files:files.map(({path,sha256,bytes})=>({path,sha256,bytes}))};
 return {manifest,manifestHash:hash(JSON.stringify(manifest)),files};
}
