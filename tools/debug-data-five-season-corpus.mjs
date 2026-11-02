// DEBUG-DATA-01 I02: protected, UNSEALED five-season integration candidate.
// This module does not write public assets, serve routes, or connect to D1.
import {hash,assertApprovedBaseline,DEBUG_SEASONS,DEBUG_COUNTRIES} from "./debug-data-schema.mjs";
import {buildFiveSeasonDomesticDraft} from "./debug-data-five-season-draft.mjs";
import {deriveInternationalParticipants,buildInternationalLeagueCandidate} from "./debug-data-international-candidate.mjs";
import {buildInternationalCupDraft,selectCupBaseline} from "./debug-data-international-cup-draft.mjs";
const requireValid=(ok,msg)=>{if(!ok)throw new Error("DEBUG-DATA-01: "+msg)};
const cupIds=["int-1","int-2"];
export function buildFiveSeasonCorpusCandidate({baseline,cupCatalog,seed="debug-data-v1-fresh",datasetId="debug-corpus-v1"}){
 const approved=assertApprovedBaseline(baseline);
 requireValid(Array.isArray(cupCatalog)&&cupIds.every(id=>cupCatalog.some(c=>c.id===id&&c.rules?.version==="international-int24-v1")),"canonical INT24 cup rules");
 const domestic=buildFiveSeasonDomesticDraft({baseline,seed,datasetId});
 const seasons=[],priorWinners={};
 for(const season of domestic.seasons){
  const seasonNumber=season.seasonNumber,cups={};
  const placements=Object.fromEntries(DEBUG_COUNTRIES.map(country=>[country,season.sportingOutcomes[country+"-1"].rankedClubs]));
  for(const cupId of cupIds){
   // Season 1 uses the owner-approved initial cup baseline. Later seasons
   // use the *previous* sealed domestic results, never current-year finishes.
   const previous=seasons.at(-1);
   const qualification=seasonNumber===1?selectCupBaseline(approved,cupId):deriveInternationalParticipants(previous.domesticPlacements,cupId);
   const rules=cupCatalog.find(c=>c.id===cupId).rules;
   cups[cupId]=buildInternationalCupDraft({seasonNumber,cupId,participants:qualification,seed:seed+":"+datasetId, datasetId,rules});
  }
  const competitionIds=[...Object.keys(season.fragments),...cupIds];
  requireValid(competitionIds.length===18,"18 competitions required");
  const local={schemaVersion:1,kind:"unsealed-world-season-candidate",source:{kind:"debug",namespace:"local-debug",datasetId},seasonNumber,
   domestic:season.fragments,domesticOutcomes:season.sportingOutcomes,domesticPlacements:placements,cups,
   internationalWinners:Object.fromEntries(cupIds.map(id=>[id,cups[id].winner])),
   predecessorHash:seasons.at(-1)?.candidateHash??null,
   unresolved:["champion-aware qualification","INT24 approved pots","domestic and international full tie-breakers","postseason canonical event mapping","seeded penalties model"]};
  local.candidateHash=hash(local);seasons.push(local);
 }
 return {schemaVersion:1,kind:"protected-debug-corpus-candidate",status:"UNSEALED_NOT_FOR_RUNTIME",datasetId,seedHash:hash(seed),seasons,unresolved:["no official D1 provenance","no publication","all sporting gates before sealing"]};
}
