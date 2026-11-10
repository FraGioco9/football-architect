// Club History reads only sealed public season memberships. No catalog-derived
// allocations, DEV projections, future results or inferred sporting outcomes.
import {validPublicWorld} from './authoritative-season.mjs';
import {competitionIdsForClub,projectClubMemberships} from './club-season-source.mjs';

// The current public backend explicitly supports Seasons 1–2. Refuse any
// unsupported future world rather than silently claiming a complete archive.
export function closedClubHistorySeasons(world){
 if(!validPublicWorld(world)||world.seasonNumber>2)throw TypeError('Unsupported authoritative club history world');
 const count=Math.max(0,world.seasonNumber-(world.phase==='closed'?0:1));
 return Array.from({length:count},(_,i)=>i+1);
}

export async function readClubHistory({clubKey,world,fetchJson,signal}){
 competitionIdsForClub(clubKey);
 if(typeof fetchJson!=='function')throw TypeError('Invalid club history reader');
 const seasons=closedClubHistorySeasons(world);
 const records=await Promise.all(seasons.map(async season=>{
  const raw=await fetchJson('/api/clubs/'+clubKey+'/seasons/'+season+'/overview',{signal});
  if(signal?.aborted)throw Error('Club history read cancelled');
  const entry=projectClubMemberships(raw,clubKey,season,world);
  // Closed seasons must have an authoritative completed projection. An
  // unpublished or unavailable read is not a verified zero-participation year.
  if(entry.coverage!=='complete')throw TypeError('Unverified closed club season');
  return Object.freeze({season,memberships:entry.memberships});
 }));
 if(signal?.aborted)throw Error('Club history read cancelled');
 return Object.freeze({source:'authoritative',clubKey,world,
  coverage:seasons.length?'complete':'empty',seasons:Object.freeze(records)});
}
