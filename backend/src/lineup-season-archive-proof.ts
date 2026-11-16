/** #613 — Independently attest the entire immutable V2 season before archiving.
 * No temporary-score-v1 replay, no live player affiliation reads, no writes.
 * Used by BOTH archive and close to prevent closure of a forged archive hash.
 */
import type {Database,Statement} from './database.ts';
import type {WorldV1} from './types.ts';
import {ApiError} from './errors.ts';
import {abortUnless} from './command-guards.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {loadSeasonSportingEvidence} from './season-sporting-evidence.ts';
import {replayLineupSeasonV1,type LineupSeasonReplayV1,type FrozenLineupMatchV1} from './lineup-season-replay.ts';
import {seasonArchiveSportingSummary} from './season-archive-summary.ts';
import type {LineupMatchResultV1} from './temporary-lineup-v1.mjs';

interface DayRow {
 day:number;generation:string;calendar_hash:string;simulation_version:string;
 outcome_hash:string;outcome_json:string;
}
interface TieRow {
 generation:string;competition_id:string;phase_id:string;tie_id:string;
 plan_hash:string;plan_json:string;
}
const invalid=():never=>{throw new ApiError(422,'lineup_archive_invalid')};
/** Stable archive digest contract: same outer hash schema as existing archive
 * consumers, but ONLY authenticated hashes of immutable V2 evidence enter it.
 * Never accepts old-score rows, partial days or extra/omitted knockout plans.
 */
export async function buildLineupArchiveDigestV1(input:{
 season:number;generation:string;calendarHash:string;
 dayHashes:readonly string[];tieHashes:readonly string[];resultCount:number
}){
 const {season,generation,calendarHash,dayHashes,tieHashes,resultCount}=input;
 const hex=/^[a-f0-9]{64}$/;
 if(!Number.isSafeInteger(season)||season<1||
  !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(generation)||
  !hex.test(calendarHash)||resultCount!==4082||
  !Array.isArray(dayHashes)||dayHashes.length!==56||
  !Array.isArray(tieHashes)||tieHashes.length!==54||
  dayHashes.some(hash=>!hex.test(hash))||tieHashes.some(hash=>!hex.test(hash)))
  invalid();
 const resultsHash=await canonicalHash(dayHashes);
 const knockoutHash=await canonicalHash(tieHashes);
 const archiveHash=await canonicalHash({schemaVersion:1,season,generation,
  calendarHash,resultsHash,knockoutHash,resultsCount:4082,daysCount:56,tiesCount:54});
 return {resultsHash,knockoutHash,archiveHash};
}

type Evidence=Awaited<ReturnType<typeof loadSeasonSportingEvidence>>;
export interface LineupSeasonArchiveProofV1 {
 evidence:Evidence;history:LineupSeasonReplayV1;
 rows:DayRow[];ties:TieRow[];
 resultsHash:string;knockoutHash:string;archiveHash:string;
 summaryJson:string;summaryHash:string;
 guards:Statement[];
}
/** Public Archive stats must never use today's player-club links. */
export function summarizeFrozenLineupPlayersV1(
 frozenMatches:ReadonlyMap<string,FrozenLineupMatchV1>
){
 const players=new Map<string,{
  playerId:number;clubId:string;competitionId:string;
  appearances:number;starts:number;minutes:number;goals:number
 }>();
 for(const frozen of frozenMatches.values()){
  const fixture=frozen.receipt.fixture;
  const result=frozen.receipt.result as unknown as LineupMatchResultV1;
  for(const side of ['home','away'] as const){
   const clubId=side==='home'?fixture.homeClubId:fixture.awayClubId;
   for(const appearance of result[side].appearances){
    if(!Number.isSafeInteger(appearance.playerId)||appearance.playerId<1||
     appearance.started!==true||!Number.isSafeInteger(appearance.minutes)||
     appearance.minutes<1||appearance.minutes>120||
     !Number.isSafeInteger(appearance.goals)||appearance.goals<0)invalid();
    const key=fixture.competitionId+':'+clubId+':'+appearance.playerId;
    const item=players.get(key)??{
     playerId:appearance.playerId,clubId,competitionId:fixture.competitionId,
     appearances:0,starts:0,minutes:0,goals:0
    };
    item.appearances++;item.starts++;item.minutes+=appearance.minutes;
    item.goals+=appearance.goals;players.set(key,item);
   }
  }
 }

 return [...players.values()].sort((a,b)=>a.competitionId.localeCompare(b.competitionId,'en')||
   a.clubId.localeCompare(b.clubId,'en')||a.playerId-b.playerId);
}

/** The rows used to calculate an archive's hash are also exact-match guarded
 * inside the atomic archive/close D1 batch. All individual match rows are
 * append-only and their total count is guarded against concurrent inserts.
 */
export async function verifyLineupSeasonArchiveV1(
 db:Database,world:WorldV1
):Promise<LineupSeasonArchiveProofV1>{
 if(!world||world.seasonNumber<1||world.day!==56||
  !['active','closed'].includes(world.phase))invalid();
 const evidence=await loadSeasonSportingEvidence(db,world);
 const history=await replayLineupSeasonV1(db,world,evidence,56);
 if(history.days.length!==56||history.resultCount!==4082||
  history.progression.results.size!==4082||
  history.progression.ties.size!==54||history.frozenMatches.size!==4082)invalid();
 const rows=(await db.prepare(
  'SELECT day,generation,calendar_hash,simulation_version,outcome_hash,outcome_json FROM season_lineup_day_outcomes WHERE season_number=? ORDER BY day'
 ).bind(world.seasonNumber).all<DayRow>()).results;
 const ties=(await db.prepare(
  'SELECT generation,competition_id,phase_id,tie_id,plan_hash,plan_json FROM season_knockout_ties WHERE season_number=? ORDER BY competition_id,phase_id,tie_id'
 ).bind(world.seasonNumber).all<TieRow>()).results;
 if(rows.length!==56||ties.length!==54)invalid();
 for(let i=0;i<56;i++){
  const row=rows[i],day=history.days[i];
  if(!row||row.day!==i+1||row.generation!==world.generation||
   row.calendar_hash!==evidence.calendar.calendar_hash||
   row.simulation_version!=='temporary-lineup-v1'||
   row.outcome_hash!==day.hash||row.outcome_json!==JSON.stringify(day.payload))invalid();
 }
 for(const row of ties){
  const tie=history.progression.ties.get(
   row.competition_id+':'+row.phase_id+':'+row.tie_id);
  if(!tie||row.generation!==world.generation||
   row.plan_hash!==await canonicalHash(tie)||
   row.plan_json!==JSON.stringify(tie))invalid();
 }
 const {resultsHash,knockoutHash,archiveHash}=await buildLineupArchiveDigestV1({
  season:world.seasonNumber,generation:world.generation,
  calendarHash:evidence.calendar.calendar_hash,
  dayHashes:rows.map(row=>row.outcome_hash),
  tieHashes:ties.map(row=>row.plan_hash),resultCount:history.resultCount
 });
 // Progression-derived championship, table and promotion summary is shared
 // with the original pure qualification rules. The new stats are frozen-player
 // receipts only, NEVER reconstructed from today's club memberships.
 const base=seasonArchiveSportingSummary(history.progression);
 const summary={...base,statisticsAvailability:'frozen-player-receipts-v1' as const,
  playerStatistics:summarizeFrozenLineupPlayersV1(history.frozenMatches)};
 const summaryJson=JSON.stringify(summary),summaryHash=await canonicalHash(summary);
 const guards:Statement[]=[
  ...evidence.authorityGuards,
  abortUnless(db,
   'SELECT 1 FROM seasons WHERE season_number=? AND generation=? AND participants_hash=? AND rules_hash=? AND snapshot_json=?',
   [world.seasonNumber,world.generation,evidence.snapshot.participantsHash,
    evidence.snapshot.rulesHash,evidence.season.snapshot_json]),
  abortUnless(db,
   'SELECT 1 FROM season_calendars WHERE season_number=? AND calendar_hash=? AND calendar_json=?',
   [world.seasonNumber,evidence.calendar.calendar_hash,JSON.stringify(evidence.schedule)]),
  abortUnless(db,
   'SELECT 1 WHERE (SELECT COUNT(*) FROM season_draws WHERE season_number=?)=2',
   [world.seasonNumber]),
  ...evidence.draws.map(draw=>abortUnless(db,
   'SELECT 1 FROM season_draws WHERE season_number=? AND competition_id=? AND outcome_hash=? AND outcome_json=?',
   [world.seasonNumber,draw.competition_id,draw.outcome_hash,draw.outcome_json])),
  abortUnless(db,
   'SELECT 1 WHERE (SELECT COUNT(*) FROM season_lineup_day_outcomes WHERE season_number=?)=56',
   [world.seasonNumber]),
  abortUnless(db,
   'SELECT 1 WHERE (SELECT COUNT(*) FROM match_lineup_result_receipts WHERE generation=? AND season_number=?)=4082',
   [world.generation,world.seasonNumber]),
  ...rows.map(row=>abortUnless(db,
   'SELECT 1 FROM season_lineup_day_outcomes WHERE season_number=? AND day=? AND generation=? AND calendar_hash=? AND simulation_version=? AND outcome_hash=? AND outcome_json=?',
   [world.seasonNumber,row.day,row.generation,row.calendar_hash,
    row.simulation_version,row.outcome_hash,row.outcome_json])),
  abortUnless(db,
   'SELECT 1 WHERE (SELECT COUNT(*) FROM season_knockout_ties WHERE season_number=?)=54',
   [world.seasonNumber]),
  ...ties.map(row=>abortUnless(db,
   'SELECT 1 FROM season_knockout_ties WHERE season_number=? AND generation=? AND competition_id=? AND phase_id=? AND tie_id=? AND plan_hash=? AND plan_json=?',
   [world.seasonNumber,row.generation,row.competition_id,row.phase_id,
    row.tie_id,row.plan_hash,row.plan_json]))
 ];
 return {evidence,history,rows,ties,resultsHash,knockoutHash,archiveHash,
  summaryJson,summaryHash,guards};
}
