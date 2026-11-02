// DEBUG-DATA-01: protected, pure read projection; never used by public runtime.
// Strict result and bracket redaction until their actual world days.
import {DEBUG_COMPETITIONS,DEBUG_SEASONS} from "./debug-data-schema.mjs";
import {planProtectedDebugExport} from "./debug-data-export-plan.mjs";
import {rankDomesticLeague} from "./debug-data-domestic-ranking.mjs";
import {rankInternationalLeague} from "./debug-data-international-ranking.mjs";
const assert=(ok,msg)=>{if(!ok)throw Error("DEBUG-DATA-01 projection: "+msg)};
const clone=value=>JSON.parse(JSON.stringify(value));
export function projectDebugWorldAtDay(corpus,{seasonNumber,worldDay,competitionId,divisions,cupCatalog,seed="debug-data-v1-fresh",verifiedPlan=null}){
 assert(DEBUG_SEASONS.includes(seasonNumber)&&Number.isInteger(worldDay)&&worldDay>=1&&worldDay<=56,"invalid world position");
 assert(DEBUG_COMPETITIONS.includes(competitionId),"unknown competition");
 const plan=verifiedPlan??planProtectedDebugExport(corpus);
 assert(plan.manifest?.datasetId===corpus.datasetId&&plan.manifest?.status==="UNSEALED_NOT_FOR_RUNTIME","unverified export plan");
 const path="season-"+String(seasonNumber).padStart(2,"0")+"/"+competitionId+".json";
 const file=plan.files.find(f=>f.path===path);
 assert(file,"missing season fragment");
 const source=file.content,isCup=competitionId.startsWith("int-");
 assert(source.seasonNumber===seasonNumber&&source.competitionId===competitionId,"fragment coordinate mismatch");
 assert(Array.isArray(source.events)&&source.events.every(event=>Number.isInteger(event.day)&&event.day>=1&&event.day<=56),"invalid fixture day");
 const complete=worldDay===56&&source.events.every(event=>event.result!==null);
 const events=source.events.map(entry=>{
  const event=clone(entry);
  if(event.day>worldDay){
   event.result=null;
   delete event.tiebreak;
   // A future knockout's participants encode winners of earlier rounds. Mask
   // both sides until that game is due; preserve the box/day/round shell.
   if(event.phaseId!=="league"){event.homeId=null;event.awayId=null;}
  }
  return event;
 });
 const played=events.filter(e=>e.phaseId==="league"&&e.result!==null);
 let standings;
 if(isCup){
  const rules=cupCatalog?.find(c=>c.id===competitionId)?.rules;
  assert(rules?.version==="international-int24-v1","canonical international rules required");
  standings=rankInternationalLeague(source.participants,played,rules.phases[0].tiebreakers,{allowPartial:true});
 }else{
  const rules=divisions?.find(d=>d.id===competitionId)?.rules;
  assert(rules?.phases?.[0]?.type==="roundRobin","canonical domestic rules required");
  standings=rankDomesticLeague({participants:source.participants,events:played},rules,seed);
 }
 return {schemaVersion:1,source:clone(source.source),seasonNumber,worldDay,competitionId,
  participants:[...source.participants],events,standings,playedRegularMatches:played.length,completed:complete,
  finalTable:complete&&source.finalTable?[...source.finalTable]:null,
  champion:complete?source.champion:null,
  ties:complete?clone(source.ties??source.postseason??[]):[],
  pots:source.pots?clone(source.pots):null};
}
