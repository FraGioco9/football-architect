// Club History reads only official public memberships and per-season competition
// statistics; the active season is partial, while earlier seasons are sealed.
import {validPublicWorld} from './authoritative-season.mjs';
import {competitionIdsForClub,projectClubMemberships,projectClubHistoryOverviews} from './club-season-source.mjs';

const safe=n=>Number.isSafeInteger(n)&&n>=0;
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const sameWorld=(a,b)=>['generation','revision','seasonNumber','day','phase'].every(k=>a?.[k]===b?.[k]);

// Public authority is currently available for seasons 1 and 2. Include the
// current season; closed seasons continue to require sealed archive evidence.
export function clubHistorySeasons(world){
 if(!validPublicWorld(world)||world.seasonNumber>2)throw TypeError('Unsupported authoritative club history world');
 return Object.freeze(Array.from({length:world.seasonNumber},(_,i)=>i+1));
}
// Retained for existing imports; now intentionally includes the active season.
export const closedClubHistorySeasons=clubHistorySeasons;

export function projectClubCompetitionStats(payload,clubKey,membership,season,world){
 const current=season===world.seasonNumber,closed=!current||world.phase==='closed';
 if(!isObject(payload)||payload.schemaVersion!==1||payload.providerId!=='authoritative-world'||
   payload.competitionId!==membership.competitionId||payload.selectedSeason!==season||
   !sameWorld(payload.world,world)||payload.status!==(closed?'available':'partial')||payload.reason!==null||
   !isObject(payload.provenance)||payload.provenance.kind!=='authoritative'||
   payload.provenance.resultAuthority!=='temporary-score-v1'||
   typeof payload.provenance.sourceRef!=='string'||
   !payload.provenance.sourceRef.startsWith('world:'+world.generation+':season:'+season+':')||
   !isObject(payload.data)||payload.data.season!==season||
   !isObject(payload.data.seasonState)||
   payload.data.seasonState.phase!==(closed?'closed':world.phase)||
   payload.data.seasonState.day!==(closed?56:world.day)||
   (closed?payload.data.history?.season!==season:payload.data.history!==null)||
   !Array.isArray(payload.data.participants)||!payload.data.participants.includes(clubKey)||
   !isObject(payload.data.standings)||typeof payload.data.standings.complete!=='boolean'||
   (closed&&payload.data.standings.complete!==true)||
   !Array.isArray(payload.data.standings.rows)||
   !Array.isArray(payload.data.statistics?.teams))
  throw TypeError('Unverified competition history source');
 const standing=payload.data.standings.rows.find(row=>row?.clubId===clubKey);
 const team=payload.data.statistics.teams.find(row=>row?.clubId===clubKey);
 if(!standing||!team||payload.data.standings.rows.filter(row=>row?.clubId===clubKey).length!==1||
   payload.data.statistics.teams.filter(row=>row?.clubId===clubKey).length!==1||
   !Number.isInteger(standing.rank)||standing.rank<1||standing.rank>24||
   !safe(standing.played)||!safe(standing.points)||standing.points!==membership.points||
   (standing.played===0?membership.position!==null:standing.rank!==membership.position)||
   !['played','won','drawn','lost','goalsFor','goalsAgainst','cleanSheets'].every(key=>safe(team[key]))||
   !Number.isSafeInteger(team.goalDifference)||team.played!==team.won+team.drawn+team.lost||
   team.goalDifference!==team.goalsFor-team.goalsAgainst||team.cleanSheets>team.played||
   (!closed&&team.played===0&&['won','drawn','lost','goalsFor','goalsAgainst','goalDifference','cleanSheets'].some(key=>team[key]!==0)))
  throw TypeError('Invalid verified club match totals');
 // For a live season, reconcile the club totals with actual played fixtures.
 // A penalty shootout cannot turn a drawn game into a match win or add goals.
 if(!closed){
  const fixtures=payload.data.fixtures;
  if(!Array.isArray(fixtures))throw TypeError('Missing live fixture evidence');
  const summed={played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,cleanSheets:0};
  for(const fixture of fixtures){
   if(!isObject(fixture)||!Number.isInteger(fixture.day)||fixture.day<1||fixture.day>56)
    throw TypeError('Invalid live fixture');
   const result=fixture.result;
   if(result===null)continue;
   if(fixture.day>world.day||!isObject(result)||!safe(result.homeGoals)||!safe(result.awayGoals))
    throw TypeError('Future or invalid live score');
   if(fixture.homeClubId!==clubKey&&fixture.awayClubId!==clubKey)continue;
   const home=fixture.homeClubId===clubKey,scored=home?result.homeGoals:result.awayGoals,
    conceded=home?result.awayGoals:result.homeGoals;
   summed.played++;summed.goalsFor+=scored;summed.goalsAgainst+=conceded;
   if(scored>conceded)summed.won++;
   else if(scored<conceded)summed.lost++;
   else summed.drawn++;
   if(conceded===0)summed.cleanSheets++;
  }
  if(Object.keys(summed).some(key=>summed[key]!==team[key]))
   throw TypeError('Live match totals disagree with verified fixture receipts');
 }
 return Object.freeze({played:team.played,won:team.won,drawn:team.drawn,lost:team.lost,
  goalsFor:team.goalsFor,goalsAgainst:team.goalsAgainst,
  goalDifference:team.goalDifference,cleanSheets:team.cleanSheets});
}
export const projectClosedClubCompetition=projectClubCompetitionStats;

// Verify the match totals embedded in each authoritative History overview.
// Missing or malformed evidence must never cause a second HTTP request.
export function projectClubOverviewStats(payload,clubKey,membership,season,world){
 const current=season===world.seasonNumber,closed=!current||world.phase==='closed';
 if(!isObject(payload)||payload.schemaVersion!==1||payload.providerId!=='authoritative-world'||
  payload.clubKey!==clubKey||payload.selectedSeason!==season||!sameWorld(payload.world,world)||
  payload.status!==(closed?'available':'partial')||payload.reason!==null||
  !isObject(payload.provenance)||payload.provenance.kind!=='authoritative'||
  payload.provenance.resultAuthority!=='temporary-score-v1'||
  typeof payload.provenance.sourceRef!=='string'||
  !payload.provenance.sourceRef.startsWith('club:'+world.generation+':season:'+season+':')||
  !isObject(payload.data)||payload.data.season!==season||
  !Array.isArray(payload.data.memberships))throw TypeError('Unverified compact club history');
 const matches=payload.data.memberships.filter(m=>m?.competitionId===membership.competitionId);
 if(matches.length!==1)throw TypeError('Duplicate club history membership');
 const raw=matches[0];
 if(raw.stats===undefined)return null; // The aggregate must contain complete verified stats.
 const stats=raw.stats;
 if(!isObject(stats)||Object.hasOwn(stats,'clubId')||
   !['played','won','drawn','lost','goalsFor','goalsAgainst','cleanSheets'].every(key=>safe(stats[key]))||
   !Number.isSafeInteger(stats.goalDifference)||stats.played!==stats.won+stats.drawn+stats.lost||
   stats.goalDifference!==stats.goalsFor-stats.goalsAgainst||stats.cleanSheets>stats.played||
   stats.played<membership.points/3||
   (stats.played===0&&(membership.points!==0||membership.position!==null||
    ['won','drawn','lost','goalsFor','goalsAgainst','goalDifference','cleanSheets'].some(key=>stats[key]!==0))))
  throw TypeError('Invalid verified compact match totals');
 return Object.freeze({played:stats.played,won:stats.won,drawn:stats.drawn,lost:stats.lost,
  goalsFor:stats.goalsFor,goalsAgainst:stats.goalsAgainst,
  goalDifference:stats.goalDifference,cleanSheets:stats.cleanSheets});
}

// Both Club views use the same verified aggregate and per-world HTTP cache.
export async function readClubHistory({clubKey,world,fetchJson,signal}){
 competitionIdsForClub(clubKey);
 if(typeof fetchJson!=='function')throw TypeError('Invalid club history reader');
 const seasons=clubHistorySeasons(world);
 if(seasons.length===0)return Object.freeze({source:'authoritative',clubKey,world,
  coverage:'empty',seasons:Object.freeze([])});
 const batch=await fetchJson('/api/clubs/'+clubKey+'/history',{signal});
 if(signal?.aborted)throw Error('Club history read cancelled');
 const overviews=projectClubHistoryOverviews(batch,clubKey,world);
 const records=overviews.map((raw,index)=>{
  const season=index+1,current=season===world.seasonNumber,closed=!current||world.phase==='closed';
  const entry=projectClubMemberships(raw,clubKey,season,world);
  if(entry.coverage==='unpublished'&&current&&!closed)
   return Object.freeze({season,ongoing:true,memberships:Object.freeze([])});
  if(entry.coverage!=='complete')throw TypeError('Unverified club season');
  const memberships=entry.memberships.map(membership=>{
   const stats=projectClubOverviewStats(raw,clubKey,membership,season,world);
   if(!stats)throw TypeError('Incomplete aggregate Club History evidence');
   return Object.freeze({...membership,stats});
  });
  return Object.freeze({season,ongoing:!closed,memberships:Object.freeze(memberships)});
 });
 if(signal?.aborted)throw Error('Club history read cancelled');
 const played=records.some(entry=>entry.memberships.some(m=>m.stats.played>0));
 return Object.freeze({source:'authoritative',clubKey,world,
  coverage:played?'complete':'empty',seasons:Object.freeze(records)});
}
