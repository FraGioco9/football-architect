/** #613: stage ONE guarded lineup-aware sporting day, without executing a write.
 * Uses only fixtures/context derived from the trusted canonical progression.
 * This is a server-internal planner, NOT an HTTP/admin lifecycle entrypoint.
 *
 * The future authenticated caller MUST independently replay and verify every
 * preceding V2 day and resolved tie before passing a fresh progression here,
 * and MUST commit all returned guards/writes/new tie plans in ONE world-CAS batch.
 * No old score-only result path, no retroactive score calculation.
 */
import type {Database,Statement} from './database.ts';
import type {WorldV1} from './types.ts';
import type {Fixture} from './initial-schedule.ts';
import {ApiError} from './errors.ts';
import {abortUnless} from './command-guards.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {matchIdForSlot} from './domain/calendar/match-slot-identity.ts';
import {
 processSportingDayWithResolver,
 type Progression,type FinalizedSportingMatch,type KnockoutTie
} from './knockout-progression.ts';
import {planMatchSimulationReceiptV1} from './match-lineup-snapshot-v1.mjs';
import {buildLineupDayEvidenceV2,type LineupDailyMatchReceiptV1,type LineupDailyEvidenceV2}
 from './lineup-day-evidence-v2.mjs';
import type {LineupMatchResultV1} from './temporary-lineup-v1.mjs';

export type LineupSportingScoreV1=FinalizedSportingMatch&{
 algorithmVersion:'temporary-lineup-v1';
};
export interface StagedLineupDayV1 {
 day:number;
 matchCount:number;
 dayEvidence:LineupDailyEvidenceV2;
 newTies:KnockoutTie[];
 nextProgression:Progression<LineupSportingScoreV1>;
 guards:Statement[];
 writes:Statement[];
}

/** Lookup of an already-published and stable public match ID. Reservation
 * metadata comes from the progression's verified source, never user input.
 */
async function publishedMatch(
 db:Database,world:WorldV1,fixture:Fixture,
 source:{phaseId:string;tieId:string;leg:1|2;neutral:boolean;pendingTie?:KnockoutTie}|null
):Promise<{public_id:number;source_hash:string}>{
 const slot=source?await matchIdForSlot({
  generation:world.generation,season:world.seasonNumber,
  competitionId:fixture.competitionId,phaseId:source.phaseId,
  slotId:'tie:'+source.tieId+':leg:'+source.leg
 }):null;
 const result=source
  ?await db.prepare(`SELECT p.id AS public_id,s.source_hash
    FROM season_knockout_match_slots s JOIN public_match_numbers p
    ON p.slot_match_id=s.match_id AND p.generation=s.generation
      AND p.season_number=s.season_number
    WHERE s.match_id=? AND s.generation=? AND s.season_number=?
      AND s.competition_id=? AND s.scheduled_day=? AND s.marker=?`)
   .bind(slot,world.generation,world.seasonNumber,fixture.competitionId,
    fixture.day,fixture.marker).first<{public_id:number;source_hash:string}>()
  :await db.prepare(`SELECT p.id AS public_id,s.source_hash
    FROM season_match_slots s JOIN public_match_numbers p
    ON p.slot_match_id=s.match_id AND p.generation=s.generation
      AND p.season_number=s.season_number
    WHERE s.source_fixture_id=? AND s.generation=? AND s.season_number=?
      AND s.competition_id=? AND s.scheduled_day=?`)
   .bind(fixture.id,world.generation,world.seasonNumber,fixture.competitionId,
    fixture.day).first<{public_id:number;source_hash:string}>();
 if(!result||!Number.isSafeInteger(result.public_id)||result.public_id<1||
  !/^[a-f0-9]{64}$/.test(result.source_hash))
  throw new ApiError(422,'lineup_match_publication_invalid');
 return result;
}

/** The destination day is derived from the exact authenticated world pointer.
 * The supplied progression must be fresh, verified and never shared with a
 * concurrent command; its in-memory mutation is NOT a database commit.
 */
export async function planLineupSportingDayV1(
 db:Database,world:WorldV1,progression:Progression<LineupSportingScoreV1>,
 calendarHash:string,now:number,
):Promise<StagedLineupDayV1>{
 if(!world||world.seasonNumber<1||!Number.isSafeInteger(world.revision)||
  !Number.isInteger(world.day)||world.day<0||world.day>=56||
  !(world.phase==='active'||world.phase==='preparing'&&world.day===0)||
  !Number.isSafeInteger(now)||now<=0||
  progression?.lastDay!==world.day||progression.schedule.season!==world.seasonNumber||
  !/^[a-f0-9]{64}$/.test(calendarHash)||
  calendarHash!==await canonicalHash(progression.schedule))
  throw new ApiError(422,'lineup_day_source_invalid');
 const day=world.day+1,seed=progression.schedule.seed;
 const draft:Progression<LineupSportingScoreV1>={
  ...progression,results:new Map(progression.results),
  ties:new Map(progression.ties),tables:new Map(progression.tables)
 };
 const staged:{
  fixtureId:string;publicId:number;
  receipt:LineupDailyMatchReceiptV1;
  guards:Statement[];writes:Statement[];
 }[]=[];
 // The callback sees only the canonical fixture and mode produced from
 // authenticated sporting progression. It cannot select its own participants.
 const progress=await processSportingDayWithResolver(draft,day,async(f,context,source)=>{
  const published=await publishedMatch(db,world,f,source);
  const phase: 'active'|'preparing'=world.phase==='preparing'?'preparing':'active';
  const planned=await planMatchSimulationReceiptV1(db,{
   world:{generation:world.generation,revision:world.revision,
    seasonNumber:world.seasonNumber,day:world.day,phase},
   match:{matchId:published.public_id,season:world.seasonNumber,day,
    fixtureId:f.id,competitionId:f.competitionId,
    homeClubId:f.homeClubId,awayClubId:f.awayClubId,
    sourceHash:published.source_hash},
   context,seed,now,pendingTie:source?.pendingTie
  });
  if(planned.kind!=='lineup_candidate'||planned.writes.length!==1)
   throw new ApiError(422,'lineup_match_result_invalid');
  const score=planned.receipt.result as unknown as LineupMatchResultV1;
  if(score.matchKey!==f.id||score.algorithmVersion!=='temporary-lineup-v1')
   throw new ApiError(422,'lineup_match_result_invalid');
  staged.push({fixtureId:f.id,publicId:published.public_id,
   receipt:{fixtureId:f.id,receiptHash:planned.receiptHash,receipt:planned.receipt},
   guards:planned.guards,writes:planned.writes});
  return {fixtureId:f.id,algorithmVersion:score.algorithmVersion,
   context:score.context,regulation:score.regulation,extraTime:score.extraTime,
   penalties:score.penalties,homeGoals:score.homeGoals,awayGoals:score.awayGoals,
   winnerClubId:score.winnerClubId,resolution:score.resolution};
 });
 const dayEvidence=await buildLineupDayEvidenceV2({
  generation:world.generation,season:world.seasonNumber,day,calendarHash,
  dueFixtures:staged.map(s=>({fixtureId:s.fixtureId,matchId:s.publicId})),
  receipts:staged.map(s=>s.receipt)
 });
 if(progress.results.length!==staged.length||draft.lastDay!==day)
  throw new ApiError(422,'lineup_day_result_invalid');
 const guards=[
  abortUnless(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=? AND phase=? AND day=?',
   [world.generation,world.revision,world.seasonNumber,world.phase,world.day]),
  abortUnless(db,'SELECT 1 FROM season_calendars WHERE season_number=? AND calendar_hash=?',
   [world.seasonNumber,calendarHash]),
  abortUnless(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM season_lineup_day_outcomes WHERE season_number=?)=?',
   [world.seasonNumber,world.day]),
  abortUnless(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM season_lineup_day_outcomes WHERE season_number=? AND day=?)',
   [world.seasonNumber,day]),
  ...staged.flatMap(s=>s.guards)
 ];
 const newTieWrites=await Promise.all(progress.newTies.map(async tie=>db.prepare(
  'INSERT INTO season_knockout_ties VALUES(?,?,?,?,?,?,?,?)'
 ).bind(world.seasonNumber,world.generation,tie.competitionId,tie.phaseId,tie.tieId,
  await canonicalHash(tie),JSON.stringify(tie),now)));
 const writes=[
  ...newTieWrites,
  ...staged.flatMap(s=>s.writes),
  db.prepare(`INSERT INTO season_lineup_day_outcomes(
   season_number,generation,day,calendar_hash,simulation_version,
   outcome_hash,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?)`)
   .bind(world.seasonNumber,world.generation,day,calendarHash,
    'temporary-lineup-v1',dayEvidence.hash,JSON.stringify(dayEvidence.payload),now)
 ];
 return {day,matchCount:staged.length,dayEvidence,
  newTies:progress.newTies,nextProgression:draft,guards,writes};
}
