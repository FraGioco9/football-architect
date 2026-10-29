import type {Database} from './database.ts';
import type {WorldV1} from './types.ts';
import {loadSeasonSnapshotAuthority} from './season-snapshot-authority.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {buildInitialSchedule,buildTrustedSeasonSchedule} from './initial-schedule.ts';
import {initialDrawOutcomes} from './initial-draws.ts';
import {ApiError} from './errors.ts';
interface SeasonRow {generation:string;participants_hash:string;rules_hash:string;snapshot_json:string}
interface CalendarRow {calendar_version:string;calendar_hash:string;calendar_json:string}
interface DrawRow {competition_id:string;stage_id:string;algorithm_version:string;seed:string;outcome_hash:string;outcome_json:string}
const fail=():never=>{throw new ApiError(422,'sporting_evidence_invalid')};
/** Reconstruct expected content from approval/seed. A stored hash/status cannot
 * confer its own sporting readiness. Return exact bytes for transactional guards. */
export async function loadSeasonSportingEvidence(db:Database,world:WorldV1){
 const authority=await loadSeasonSnapshotAuthority(db,world),snapshot=authority.snapshot;
 const season=await db.prepare('SELECT generation,participants_hash,rules_hash,snapshot_json FROM seasons WHERE season_number=?').bind(world.seasonNumber).first<SeasonRow>();
 const calendar=await db.prepare('SELECT calendar_version,calendar_hash,calendar_json FROM season_calendars WHERE season_number=?').bind(world.seasonNumber).first<CalendarRow>();
 const draws=(await db.prepare('SELECT competition_id,stage_id,algorithm_version,seed,outcome_hash,outcome_json FROM season_draws WHERE season_number=? ORDER BY competition_id').bind(world.seasonNumber).all<DrawRow>()).results;
 try{
  if(!season||season.generation!==world.generation||season.participants_hash!==snapshot.participantsHash||season.rules_hash!==snapshot.rulesHash||await canonicalHash(JSON.parse(season.snapshot_json))!==await canonicalHash(snapshot)||!calendar||draws.length!==2)return fail();
  const value=JSON.parse(calendar.calendar_json),schedule=world.seasonNumber===1?await buildInitialSchedule(snapshot,value.seed):await buildTrustedSeasonSchedule(snapshot,value.seed,world.seasonNumber);
  const hash=await canonicalHash(schedule);
  if(calendar.calendar_version!==schedule.algorithmVersion||calendar.calendar_hash!==hash||await canonicalHash(value)!==hash)return fail();
  const expectedDraws=await initialDrawOutcomes(schedule,snapshot);
  for(let i=0;i<2;i++){
   const d=draws[i],expected=expectedDraws[i];
   if(d.competition_id!==expected.competitionId||d.stage_id!=='league'||d.algorithm_version!==schedule.algorithmVersion||d.seed!==schedule.seed||d.outcome_hash!==expected.hash||await canonicalHash(JSON.parse(d.outcome_json))!==expected.hash)return fail();
  }
  return {snapshot,season,calendar,draws,schedule,authorityGuards:authority.guards};
 }catch{return fail()}
}
