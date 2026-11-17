/* Club match URLs use immutable published DB identities, never pairings,
 * fixture display order or the next league position. Two bounded internal
 * reads replace two entire public competition collections over HTTP. */
import type {Database} from './database.ts';
import {ApiError} from './errors.ts';

export interface ClubFixtureIdentity {
 id:string;competitionId:string;phaseId:string;tieId:string|null;leg:number|null;
 marker:string;day:number;round:number;homeClubId:string;awayClubId:string;
}
interface LeagueLink {
 source_fixture_id:string;competition_id:string;marker:string;scheduled_day:number;
 round_number:number;home_club_id:string;away_club_id:string;public_id:number;
}
interface KnockoutLink {
 competition_id:string;phase_id:string;tie_id:string;leg:number;marker:string;
 scheduled_day:number;round_number:number|null;public_id:number;
}
const corrupt=():never=>{throw new ApiError(503,'sporting_data_unavailable')};
const matchNumber=(id:number):string=>Number.isSafeInteger(id)&&id>0?String(id):corrupt();
const slotKey=(competitionId:string,phaseId:string,tieId:string|null,leg:number|null)=>
 JSON.stringify([competitionId,phaseId,tieId,leg]);

/** Only map already-persisted numbers to independently validated fixtures.
 * Missing mappings remain null. The caller owns verified season evidence,
 * published provenance, generation/revision and post-read world fencing. */
export async function withOfficialClubMatchIds<T extends ClubFixtureIdentity>(
 db:Database,generation:string,season:number,clubKey:string,
 competitionIds:readonly string[],fixtures:readonly T[],
):Promise<Array<T&{matchId:string|null}>> {
 const bySource=new Map(fixtures.map(f=>[f.id,f]));
 if(bySource.size!==fixtures.length||new Set(competitionIds).size!==competitionIds.length)corrupt();
 const ids=new Map<string,string>(),used=new Set<string>();
 const league=(await db.prepare(
  'SELECT s.source_fixture_id,s.competition_id,s.marker,s.scheduled_day,s.round_number,'+
  's.home_club_id,s.away_club_id,p.id AS public_id FROM season_match_slots s '+
  'JOIN public_match_numbers p ON p.slot_match_id=s.match_id AND p.generation=s.generation '+
  'AND p.season_number=s.season_number WHERE s.generation=? AND s.season_number=? '+
  'AND (s.home_club_id=? OR s.away_club_id=?)'
 ).bind(generation,season,clubKey,clubKey).all<LeagueLink>()).results;
 for(const row of league){
  const f=bySource.get(row.source_fixture_id),id=matchNumber(row.public_id);
  if(!f||f.phaseId!=='league'||f.competitionId!==row.competition_id||
   !competitionIds.includes(row.competition_id)||f.marker!==row.marker||
   f.day!==row.scheduled_day||f.round!==row.round_number||
   f.homeClubId!==row.home_club_id||f.awayClubId!==row.away_club_id||
   ids.has(f.id)||used.has(id))corrupt();
  ids.set(f.id,id);used.add(id);
 }
 const knockoutFixtures=new Map<string,T>();
 for(const f of fixtures){
  if(f.phaseId==='league')continue;
  if(typeof f.tieId!=='string'||!Number.isSafeInteger(f.leg))corrupt();
  const key=slotKey(f.competitionId,f.phaseId,f.tieId,f.leg);
  if(knockoutFixtures.has(key))corrupt();
  knockoutFixtures.set(key,f);
 }
 if(competitionIds.length){
  const params=competitionIds.map(()=>'?').join(',');
  const reserved=(await db.prepare(
   'SELECT s.competition_id,s.phase_id,s.tie_id,s.leg,s.marker,s.scheduled_day,'+
   's.round_number,p.id AS public_id FROM season_knockout_match_slots s '+
   'JOIN public_match_numbers p ON p.slot_match_id=s.match_id AND p.generation=s.generation '+
   'AND p.season_number=s.season_number WHERE s.generation=? AND s.season_number=? '+
   'AND s.competition_id IN ('+params+')'
  ).bind(generation,season,...competitionIds).all<KnockoutLink>()).results;
  for(const row of reserved){
   const key=slotKey(row.competition_id,row.phase_id,row.tie_id,row.leg);
   const f=knockoutFixtures.get(key);
   // Future brackets without an authoritative club fixture stay hidden.
   if(!f)continue;
   const id=matchNumber(row.public_id);
   if(f.marker!==row.marker||f.day!==row.scheduled_day||
    row.round_number!==null&&f.round!==row.round_number||ids.has(f.id)||used.has(id))corrupt();
   ids.set(f.id,id);used.add(id);
  }
 }
 return fixtures.map(f=>({...f,matchId:ids.get(f.id)??null}));
}
