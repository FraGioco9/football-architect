// DEBUG-DATA-01 I02: isolated, deterministic five-season domestic corpus plan.
// Intentionally not exposed to clients or public artifacts. International and strict
// knockout/tiebreaker rules are required before a sealed corpus can be published.
import {assertApprovedBaseline,DEBUG_SEASONS,DEBUG_COUNTRIES,hash} from "./debug-data-schema.mjs";
import {buildDomesticLeague} from "./debug-data-domestic-generator.mjs";
import {resolveDomesticPostseason,nextDomesticMembership} from "./debug-data-postseason.mjs";
const duplicate=value=>JSON.parse(JSON.stringify(value));
export function buildFiveSeasonDomesticDraft({baseline,divisions,seed="debug-data-new-v1",datasetId="debug-five-season-v1"}){
 if(!seed||!datasetId)throw new TypeError("Seed and dataset ID required");
 const approved=assertApprovedBaseline(baseline);
 if(!Array.isArray(divisions)||divisions.length!==16)throw Error("Canonical domestic rules required");
 const rules=new Map(divisions.map(d=>[d.id,d.rules]));
 let participants=new Map([...approved].filter(([id])=>!id.startsWith("int-")).map(([id,clubs])=>[id,[...clubs]]));
 const seasons=[];
 for(const seasonNumber of DEBUG_SEASONS){
  const fragments={},outcomes=new Map();
  for(const country of DEBUG_COUNTRIES)for(const tier of [1,2]){
   const competitionId=country+"-"+tier;
   const fragment=buildDomesticLeague({datasetId,seasonNumber,competitionId,participants:participants.get(competitionId),seed:seed+":"+datasetId});
   fragments[competitionId]=fragment;
   outcomes.set(competitionId,resolveDomesticPostseason({seasonNumber,competitionId,fragment,rules:rules.get(competitionId),seed:seed+":"+datasetId}));
  }
  const postseasonEvents=Object.fromEntries([...outcomes].map(([id,outcome])=>[id,outcome.ties.flatMap(t=>t.fixtures)]));
  for(const [id,events] of Object.entries(postseasonEvents)){
   const tier=Number(id.split("-")[1]);
   if(events.length!==(tier===1?2:5)||events.some(e=>e.day<52||e.day>54))throw Error("postseason event structure invalid: "+id);
  }
  const sportingOutcomes=Object.fromEntries([...outcomes].map(([id,outcome])=>[id,duplicate(outcome)]));
  const snapshot={schemaVersion:1,kind:"unsealed-domestic-draft",source:{kind:"debug",namespace:"local-debug",datasetId},seasonNumber,fragments,postseasonEvents,sportingOutcomes,contentsHash:hash({fragments,postseasonEvents,sportingOutcomes})};
  seasons.push(snapshot);
  if(seasonNumber<5)participants=nextDomesticMembership(participants,outcomes);
 }
 return {schemaVersion:1,status:"UNSEALED_INCOMPLETE_NOT_FOR_RUNTIME",datasetId,seedHash:hash(seed),seasonNumbers:[...DEBUG_SEASONS],seasons};
}
