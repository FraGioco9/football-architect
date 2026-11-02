// DEBUG-DATA-01 I02: protected, UNSEALED five-season integration candidate.
// This module does not write public assets, serve routes, or connect to D1.
import {hash,assertApprovedBaseline,DEBUG_SEASONS,DEBUG_COUNTRIES} from "./debug-data-schema.mjs";
import {buildFiveSeasonDomesticDraft} from "./debug-data-five-season-draft.mjs";
import {allocateInternationalEntrants} from "./debug-data-international-qualification.mjs";
import {buildInternationalCupDraft,selectCupBaseline} from "./debug-data-international-cup-draft.mjs";
const requireValid=(ok,msg)=>{if(!ok)throw new Error("DEBUG-DATA-01: "+msg)};
const cupIds=["int-1","int-2"];
export function buildFiveSeasonCorpusCandidate({baseline,divisions,cupCatalog,seed="debug-data-v1-fresh",datasetId="debug-corpus-v1"}){
 const approved=assertApprovedBaseline(baseline);
 requireValid(Array.isArray(cupCatalog)&&cupIds.every(id=>cupCatalog.some(c=>c.id===id&&c.rules?.version==="international-int24-v1")),"canonical INT24 cup rules");
 const domestic=buildFiveSeasonDomesticDraft({baseline,divisions,seed,datasetId});
 const seasons=[];
 for(const season of domestic.seasons){
  const seasonNumber=season.seasonNumber,cups={};
  const placements=Object.fromEntries(DEBUG_COUNTRIES.map(country=>[country,season.sportingOutcomes[country+"-1"].rankedClubs]));
  const previous=seasons.at(-1);
  const holderAllocation=seasonNumber===1?null:allocateInternationalEntrants({previousPlacements:previous.domesticPlacements,previousWinners:previous.internationalWinners});
  for(const cupId of cupIds){
   // Season 1 uses the owner-approved initial cup baseline. Later seasons
   // use the *previous* sealed domestic results, never current-year finishes.
   const qualification=seasonNumber===1?selectCupBaseline(approved,cupId):holderAllocation.allocations[cupId];
   const rules=cupCatalog.find(c=>c.id===cupId).rules;
   cups[cupId]=buildInternationalCupDraft({seasonNumber,cupId,participants:qualification,seed:seed+":"+datasetId, datasetId,rules});
  }
  const competitionIds=[...Object.keys(season.fragments),...cupIds];
  requireValid(competitionIds.length===18,"18 competitions required");
  const local={schemaVersion:1,kind:"unsealed-world-season-candidate",source:{kind:"debug",namespace:"local-debug",datasetId},seasonNumber,
   domestic:season.fragments,domesticOutcomes:season.sportingOutcomes,domesticPlacements:placements,cups,
   internationalWinners:Object.fromEntries(cupIds.map(id=>[id,cups[id].winner])),holderMoves:holderAllocation?.moves??[],
   predecessorHash:seasons.at(-1)?.candidateHash??null,
   unresolved:["INT24 approved pots","domestic and international full tie-breakers","postseason canonical event mapping","seeded penalties model"]};
  local.candidateHash=hash(local);seasons.push(local);
 }
 return {schemaVersion:1,kind:"protected-debug-corpus-candidate",status:"UNSEALED_NOT_FOR_RUNTIME",datasetId,seedHash:hash(seed),seasons,unresolved:["no official D1 provenance","no publication","all sporting gates before sealing"]};
}
