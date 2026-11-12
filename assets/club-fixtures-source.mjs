// Read-only Club Fixtures projection. Authority stays with the shared season validator.
import {validPublicWorld,validateAuthoritativeSeason,scoreValid} from './authoritative-season.mjs';
import {competitionIdsForClub,projectClubHistoryOverviews,projectClubMemberships} from './club-season-source.mjs';
const compare=(a,b)=>a<b?-1:a>b?1:0;
const same=(a,b)=>['generation','revision','seasonNumber','day','phase'].every(k=>a?.[k]===b?.[k]);
export function projectClubFixtures(fixtures,clubKey,season,day){
 competitionIdsForClub(clubKey);
 const seen=new Set();
 return Object.freeze(fixtures.filter(f=>[f.homeClubId,f.awayClubId].includes(clubKey)).map(f=>{
  if(!f.id||seen.has(f.id)||!Number.isInteger(f.day)||f.day<1||f.day>56||typeof f.neutral!=='boolean')throw TypeError('Invalid club fixture');
  seen.add(f.id);
  if(f.result&&f.day>day)throw TypeError('Future club result');
  if(f.result&&!scoreValid(f.result,f))throw TypeError('Invalid club result');
  const home=f.homeClubId===clubKey,result=f.result,penalties=result?.penalties;
  return Object.freeze({id:f.id,competitionId:f.competitionId,season,day:f.day,round:f.round,phaseId:f.phaseId,
   marker:f.marker??'',tieId:f.tieId??null,leg:f.leg??null,opponentId:home?f.awayClubId:f.homeClubId,
   venue:f.neutral?'neutral':home?'home':'away',goalsFor:result?(home?result.homeGoals:result.awayGoals):null,
   goalsAgainst:result?(home?result.awayGoals:result.homeGoals):null,resolution:result?.resolution??null,
   penalties:penalties?Object.freeze({for:home?penalties.home:penalties.away,against:home?penalties.away:penalties.home}):null});
 }).sort((a,b)=>a.day-b.day||compare(a.competitionId,b.competitionId)||compare(a.marker,b.marker)||
  a.round-b.round||compare(a.tieId??'',b.tieId??'')||(a.leg??0)-(b.leg??0)||compare(a.id,b.id)));
}
export async function readClubFixtures({clubKey,season,world,fetchJson,manifest,signal}){
 competitionIdsForClub(clubKey);
 if(!validPublicWorld(world)||typeof fetchJson!=='function')throw TypeError('Invalid club fixture read');
 const base={source:'authoritative',clubKey,season,world,day:season===world.seasonNumber?world.day:56,competitions:[],rows:[],unavailable:[]};
 if(world.seasonNumber===0||season===0)return {...base,coverage:'unstarted'};
 if(!Number.isInteger(season)||season<1||season>world.seasonNumber||world.seasonNumber>2)return {...base,coverage:'unavailable'};
 const batch=await fetchJson('/api/clubs/'+clubKey+'/history',{signal});
 const overviews=projectClubHistoryOverviews(batch,clubKey,world);
 const membership=projectClubMemberships(overviews[season-1],clubKey,season,world);
 if(membership.coverage==='unpublished')return {...base,coverage:'unpublished'};
 const results=await Promise.all(membership.memberships.map(async m=>{
  try{
   const definition=manifest.competitions.find(d=>d.id===m.competitionId);
   if(!definition)throw Error('Missing competition definition');
   const raw=await fetchJson('/api/competitions/'+m.competitionId+'/seasons/'+season,{signal});
   if(!same(raw?.world,world))throw Error('Obsolete fixture world');
   const verified=validateAuthoritativeSeason(raw,{definition,selectedSeason:season},manifest);
   if(!verified.data)return {definition,unavailable:true};
   if(!verified.data.participants.includes(clubKey))throw Error('Club membership mismatch');
   return {definition,fixtures:verified.data.fixtures};
  }catch(error){if(signal?.aborted)throw error;return {definition:manifest.competitions.find(d=>d.id===m.competitionId),id:m.competitionId,unavailable:true};}
 }));
 if(signal?.aborted)throw Error('Club fixtures cancelled');
 const unavailable=results.filter(r=>r.unavailable).map(r=>r.definition?.id||r.id);
 return {...base,competitions:results.map(r=>r.definition).filter(Boolean),unavailable,
  rows:projectClubFixtures(results.flatMap(r=>r.fixtures||[]),clubKey,season,base.day),
  coverage:unavailable.length?(unavailable.length===results.length?'unavailable':'partial'):'complete'};
}
