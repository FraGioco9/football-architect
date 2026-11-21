/**
 * #734 — Match Detail optional form/position context.
 * A late/failed context read cannot delay the separate verified scoreboard.
 * Reuse the existing publication and sporting authorities; send only the
 * two sides' last five prior verified results, ranks and published link IDs.
 */
import type {Database} from './database.ts';
import {ApiError} from './errors.ts';
import {readPublicSportingSeasonLineupV1} from './public-sporting-read-lineup-v1.ts';
import {readPublishedCompetitionMatchesLineupV1} from './public-match-read-lineup-v1.ts';

type RecordLike=Record<string,unknown>;
const object=(value:unknown):value is RecordLike=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const sameWorld=(a:unknown,b:unknown)=>object(a)&&object(b)&&
 ['generation','revision','seasonNumber','day','phase'].every(key=>a[key]===b[key]);
const invalid=():never=>{throw new ApiError(503,'match_context_unavailable')};
const unavailable=():never=>{throw new ApiError(404,'not_found')};
const numberId=(id:string)=>/^[1-9][0-9]*$/.test(id)&&Number.isSafeInteger(Number(id));
const competitionIdPattern=/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/;

export function compactPublicMatchContext(
 sporting:unknown,published:unknown,matchId:string,season:number,competitionId:string
){
 if(!object(sporting)||!object(published)||sporting.schemaVersion!==1||
   sporting.providerId!=='authoritative-world'||sporting.competitionId!==competitionId||
   sporting.selectedSeason!==season||!['partial','available'].includes(String(sporting.status))||
   !object(sporting.provenance)||sporting.provenance.kind!=='authoritative'||
   published.schemaVersion!==1||published.providerId!=='authoritative-world'||
   published.status!=='published'||published.season!==season||
   published.competitionId!==competitionId||!object(published.provenance)||
   published.provenance.kind!=='authoritative'||!sameWorld(sporting.world,published.world))invalid();
 const data=sporting.data;
 if(!object(data)||data.season!==season||!object(data.seasonState)||
   !(typeof data.seasonState.day==='number'&&Number.isSafeInteger(data.seasonState.day))||!Array.isArray(data.fixtures)||
   !object(data.standings)||!Array.isArray(data.standings.rows)||
   !Array.isArray(published.fixtures))invalid();
 const selected=published.fixtures.find((f:unknown)=>object(f)&&f.matchId===matchId);
 if(!object(selected)||selected.phaseId!=='league'||typeof selected.sourceFixtureId!=='string'||
   !(typeof selected.day==='number'&&Number.isSafeInteger(selected.day))||selected.day<1||selected.day>56||
   typeof selected.homeClubId!=='string'||typeof selected.awayClubId!=='string')unavailable();
 const target=data.fixtures.find((f:unknown)=>object(f)&&f.id===selected.sourceFixtureId);
 if(!object(target)||target.day!==selected.day||target.competitionId!==competitionId||
   target.homeClubId!==selected.homeClubId||target.awayClubId!==selected.awayClubId)invalid();
 const home=selected.homeClubId as string,away=selected.awayClubId as string,day=selected.day as number;
 const previous=(club:string)=>data.fixtures
  .filter((f:unknown)=>object(f)&&f.competitionId===competitionId&&
   typeof f.day==='number'&&Number.isSafeInteger(f.day)&&f.day>0&&f.day<day&&
   (f.homeClubId===club||f.awayClubId===club)&&object(f.result)&&
   typeof f.result.homeGoals==='number'&&Number.isSafeInteger(f.result.homeGoals)&&typeof f.result.awayGoals==='number'&&Number.isSafeInteger(f.result.awayGoals)&&
   (f.result.homeGoals as number)>=0&&(f.result.awayGoals as number)>=0)
  .sort((a:unknown,b:unknown)=>{
   const x=a as RecordLike,y=b as RecordLike;
   return (x.day as number)-(y.day as number)||String(x.id).localeCompare(String(y.id),'en');
  }).slice(-5) as RecordLike[];
 const prior=[...new Map([...previous(home),...previous(away)].map(f=>[String(f.id),f])).values()]
  .sort((a,b)=>(a.day as number)-(b.day as number)||String(a.id).localeCompare(String(b.id),'en'));
 const sourceIds=new Set(prior.map(f=>String(f.id)));
 const links=published.fixtures.filter((f:unknown)=>object(f)&&f.phaseId==='league'&&
  typeof f.sourceFixtureId==='string'&&sourceIds.has(f.sourceFixtureId))
  .map((f:RecordLike)=>({matchId:f.matchId,sourceFixtureId:f.sourceFixtureId,
   phaseId:'league',marker:f.marker,day:f.day,round:f.round}));
 const rows=data.standings.rows.filter((r:unknown)=>object(r)&&(r.clubId===home||r.clubId===away));
 return {
  schemaVersion:1,providerId:'authoritative-world',matchId,season,competitionId,day,
  homeClubId:home,awayClubId:away,world:sporting.world,
  projection:{schemaVersion:1,providerId:'authoritative-world',competitionId,
   selectedSeason:season,status:sporting.status,provenance:{kind:'authoritative'},
   data:{season,seasonState:{day:data.seasonState.day,phase:data.seasonState.phase},
    standings:{rows:rows.map((r:RecordLike)=>({clubId:r.clubId,rank:r.rank,played:r.played}))},
    fixtures:prior.map(f=>({id:f.id,day:f.day,round:f.round,competitionId:f.competitionId,
     homeClubId:f.homeClubId,awayClubId:f.awayClubId,
     result:{homeGoals:(f.result as RecordLike).homeGoals,awayGoals:(f.result as RecordLike).awayGoals}}))}},
  published:links.length?{schemaVersion:1,providerId:'authoritative-world',
   status:'published',season,competitionId,provenance:{kind:'authoritative'},
   fixtures:links}:null
 };
}

/** Independent from the scoreboard and frozen player statistics. */
export async function readPublicMatchContextV1(db:Database,matchId:string,season:number,competitionId:string){
 if(!numberId(matchId)||!Number.isSafeInteger(season)||season<1||
    !competitionIdPattern.test(competitionId))throw new ApiError(422,'invalid_public_request');
 // Both authoritative reads are independent: run concurrently, as the client did.
 // Publication supplies the verified numeric match ID and its own world proof.
 const [sporting,published]=await Promise.all([
  readPublicSportingSeasonLineupV1(db,competitionId,season),
  readPublishedCompetitionMatchesLineupV1(db,season,competitionId,true)
 ]);
 return compactPublicMatchContext(sporting,published,matchId,season,competitionId);
}
