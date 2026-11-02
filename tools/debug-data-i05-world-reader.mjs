// I05: candidate world projection reader, isolated from public routes.
import {DEBUG_COMPETITIONS} from "./debug-data-schema.mjs";
export async function readProtectedWorldCandidates(reader,seasonNumber,worldDay){
 if(!Number.isInteger(seasonNumber)||seasonNumber<1||seasonNumber>5||
 !Number.isInteger(worldDay)||worldDay<1||worldDay>56)throw Error("Invalid Debug cursor");
 const results=await Promise.all(DEBUG_COMPETITIONS.map(competitionId=>reader.read({seasonNumber,worldDay,competitionId})));
 const first=results[0];
 const expected=new Set(DEBUG_COMPETITIONS);
 if(results.length!==expected.size)throw Error("Incomplete protected world");
 if(!first||results.some(r=>r.status!=="candidate"||r.epoch!==first.epoch||
  r.source?.datasetId!==first.source?.datasetId||r.acceptance!=="UNSEALED_NOT_FOR_RUNTIME"))
  throw Error("Inconsistent Debug source");
 if(results.some((r,i)=>r.projection?.seasonNumber!==seasonNumber||r.projection?.worldDay!==worldDay||r.projection?.competitionId!==DEBUG_COMPETITIONS[i]||!Array.isArray(r.projection.events)))throw Error("Inconsistent world coordinates");
 return {kind:"protected-debug-world",status:"UNSEALED_NOT_FOR_RUNTIME",
  seasonNumber,worldDay,source:first.source,
  competitions:results.map(r=>({competitionId:r.projection.competitionId,events:r.projection.events}))};
}
