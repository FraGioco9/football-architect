// DEBUG-DATA-01: pure, date-aware read model for an UNSEALED local candidate.
// No HTTP endpoints, D1 connections, public imports or runtime activation.
import {DEBUG_COMPETITIONS,DEBUG_SEASONS} from "./debug-data-schema.mjs";
import {planProtectedDebugExport} from "./debug-data-export-plan.mjs";
const assert=(condition,message)=>{if(!condition)throw Error("DEBUG-DATA-01 projection: "+message)};
const clone=value=>JSON.parse(JSON.stringify(value));
export function projectDebugWorldAtDay(corpus,{seasonNumber,worldDay,competitionId}){
 assert(DEBUG_SEASONS.includes(seasonNumber)&&Number.isInteger(worldDay)&&worldDay>=1&&worldDay<=56,"invalid world position");
 assert(DEBUG_COMPETITIONS.includes(competitionId),"unknown competition");
 // Planning validates the entire corpus and its lineage, never an isolated fragment.
 const plan=planProtectedDebugExport(corpus);
 const season=corpus.seasons.find(s=>s.seasonNumber===seasonNumber);
 const file=plan.files.find(f=>f.path==="season-"+String(seasonNumber).padStart(2,"0")+"/"+competitionId+".json");
 assert(season&&file,"unavailable competition/season");
 const source=file.content;
 const events=source.events.map(event=>{
  const historical=event.day<=worldDay;
  if(historical)return clone(event);
  const future=clone(event);
  future.result=null;
  if(future.tiebreak!==undefined)delete future.tiebreak;
  return future;
 });
 const regular=events.filter(e=>e.phaseId==="league"&&e.result!==null);
 // Never expose final outcomes or knockout winners before the final world day.
 const completed=worldDay===56;
 const details={schemaVersion:1,source:clone(source.source),seasonNumber,worldDay,competitionId,participants:[...source.participants],
  events,playedRegularMatches:regular.length,completed,
  standings:competitionId.startsWith("int-")?(completed?clone(source.ranking):null):null,
  finalTable:completed&&source.finalTable?[...source.finalTable]:null,
  champion:completed?source.champion:null,
  ties:completed?clone(source.ties??source.postseason??[]):[],
  pots:source.pots?clone(source.pots):null};
 return details;
}
