/** #613 — One authoritative lineup-result replay, read-only and fail-closed.
 * All results come from immutable V2 daily receipts and per-match receipts.
 * No legacy score authority, live roster re-rating or future-score generation.
 */
import type {Database} from './database.ts';
import type {WorldV1} from './types.ts';
import type {Fixture} from './initial-schedule.ts';
import {ApiError} from './errors.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {matchIdForSlot,assignLeagueMatchSlots} from './domain/calendar/match-slot-identity.ts';
import {
 createProgression,processSportingDayWithResolver,tieKey,
 type KnockoutTie,type SportingFixtureSource
} from './knockout-progression.ts';
import type {loadSeasonSportingEvidence} from './season-sporting-evidence.ts';
import {buildCandidateMatchReceiptV1,type LineupMatchResultV1} from './temporary-lineup-v1.mjs';
import {verifyLineupDayEvidenceV2,type LineupDailyMatchReceiptV1,
 type LineupDailyEvidenceV2} from './lineup-day-evidence-v2.mjs';
import type {LineupSportingScoreV1} from './lineup-sporting-day-plan.ts';

type SeasonEvidence=Awaited<ReturnType<typeof loadSeasonSportingEvidence>>;
interface DayRow {
 day:number;generation:string;calendar_hash:string;simulation_version:string;
 outcome_hash:string;outcome_json:string;
}
interface MatchRow {
 public_match_id:number;slot_match_id:string;generation:string;season_number:number;
 day:number;fixture_id:string;algorithm_version:string;receipt_hash:string;receipt_json:string;
 published_id:number;published_slot_id:string;published_generation:string;published_season:number;
 league_slot_id:string|null;league_slot_key:string|null;league_fixture_id:string|null;
 league_competition_id:string|null;league_day:number|null;league_marker:string|null;
 league_round:number|null;league_home:string|null;league_away:string|null;league_source_hash:string|null;
 knockout_slot_id:string|null;knockout_phase:string|null;knockout_tie:string|null;
 knockout_leg:number|null;knockout_slot_key:string|null;knockout_competition_id:string|null;
 knockout_day:number|null;knockout_marker:string|null;knockout_round:number|null;
 knockout_policy:string|null;knockout_source_hash:string|null;
}
interface TieRow {
 generation:string;competition_id:string;phase_id:string;tie_id:string;
 plan_hash:string;plan_json:string;
}
interface CountRow {n:number}
const fail=():never=>{throw new ApiError(422,'lineup_replay_invalid')};
const hash64=/^[a-f0-9]{64}$/;
const matchQuery=`SELECT r.public_match_id,r.slot_match_id,r.generation,r.season_number,r.day,
 r.fixture_id,r.algorithm_version,r.receipt_hash,r.receipt_json,
 p.id AS published_id,p.slot_match_id AS published_slot_id,
 p.generation AS published_generation,p.season_number AS published_season,
 s.match_id AS league_slot_id,s.slot_id AS league_slot_key,
 s.source_fixture_id AS league_fixture_id,s.competition_id AS league_competition_id,
 s.scheduled_day AS league_day,s.marker AS league_marker,s.round_number AS league_round,
 s.home_club_id AS league_home,s.away_club_id AS league_away,s.source_hash AS league_source_hash,
 k.match_id AS knockout_slot_id,k.phase_id AS knockout_phase,
 k.tie_id AS knockout_tie,k.leg AS knockout_leg,k.slot_id AS knockout_slot_key,
 k.competition_id AS knockout_competition_id,k.scheduled_day AS knockout_day,
 k.marker AS knockout_marker,k.round_number AS knockout_round,
 k.home_policy AS knockout_policy,k.source_hash AS knockout_source_hash
 FROM match_lineup_result_receipts r
 LEFT JOIN public_match_numbers p ON p.id=r.public_match_id
 LEFT JOIN season_match_slots s ON s.match_id=p.slot_match_id
 LEFT JOIN season_knockout_match_slots k ON k.match_id=p.slot_match_id
 WHERE r.generation=? AND r.season_number=? AND r.day=? ORDER BY r.public_match_id`;
const digest=async(text:string)=>{
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
 return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
};
function parseObject(value:string):Record<string,unknown>{
 try{
  const obj:unknown=JSON.parse(value);
  if(obj&&typeof obj==='object'&&!Array.isArray(obj))return obj as Record<string,unknown>;
 }catch{}
 return fail();
}
function sameWorld(a:WorldV1,b:WorldV1){
 return a.generation===b.generation&&a.seasonNumber===b.seasonNumber&&
  a.revision===b.revision&&a.day===b.day&&a.phase===b.phase;
}
export interface FrozenLineupMatchV1 {
 fixtureId:string;matchId:number;receiptHash:string;
 receipt:LineupDailyMatchReceiptV1['receipt'];score:LineupSportingScoreV1;
}
/** Independently bind a read-only result to the canonical fixture and public slot. */
export async function verifyFrozenLineupMatchV1(
 row:MatchRow,fixture:Fixture,context:LineupSportingScoreV1['context'],
 source:SportingFixtureSource|null,world:WorldV1,trustedLeagueSlotId?:string
):Promise<FrozenLineupMatchV1>{
 if(!row||row.generation!==world.generation||row.season_number!==world.seasonNumber||
  row.published_generation!==world.generation||row.published_season!==world.seasonNumber||
  row.public_match_id!==row.published_id||row.slot_match_id!==row.published_slot_id||
  !Number.isSafeInteger(row.public_match_id)||row.public_match_id<1||
  row.day!==fixture.day||row.fixture_id!==fixture.id||
  row.algorithm_version!=='temporary-lineup-v1'||!hash64.test(row.receipt_hash))
  return fail();
 const sourceHash=source?row.knockout_source_hash:row.league_source_hash;
 const slotId=source?'tie:'+source.tieId+':leg:'+source.leg:row.league_slot_key;
 if(!source&&trustedLeagueSlotId!==undefined&&row.league_slot_key!==trustedLeagueSlotId)
  return fail();
 const phaseId=source?source.phaseId:'league';
 if(!sourceHash||!hash64.test(sourceHash)||!slotId)return fail();
 const expectedSlot=await matchIdForSlot({
  generation:world.generation,season:world.seasonNumber,
  competitionId:fixture.competitionId,phaseId,slotId
 });
 if(expectedSlot!==row.slot_match_id)return fail();
 if(source){
  if(row.league_slot_id!==null||row.knockout_slot_id!==expectedSlot||
   row.knockout_phase!==source.phaseId||row.knockout_tie!==source.tieId||
   row.knockout_leg!==source.leg||row.knockout_slot_key!==slotId||
   row.knockout_competition_id!==fixture.competitionId||
   row.knockout_day!==fixture.day||row.knockout_marker!==fixture.marker||
   (row.knockout_round??13)!==fixture.round||
   row.knockout_policy!==(source.neutral?'neutral':'higherOriginalTableRank'))return fail();
 }else if(row.knockout_slot_id!==null||row.league_slot_id!==expectedSlot||
  row.league_fixture_id!==fixture.id||row.league_competition_id!==fixture.competitionId||
  row.league_day!==fixture.day||row.league_marker!==fixture.marker||
  row.league_round!==fixture.round||row.league_home!==fixture.homeClubId||
  row.league_away!==fixture.awayClubId)return fail();
 if(typeof row.receipt_json!=='string'||await digest(row.receipt_json)!==row.receipt_hash)
  return fail();
 const receipt=parseObject(row.receipt_json);
 const frozen=receipt.fixture as Record<string,unknown>|null;
 const result=receipt.result as LineupMatchResultV1|null;
 if(![1,2].includes(receipt.schemaVersion as number)||receipt.authority!=='official'||
  receipt.algorithmVersion!=='temporary-lineup-v1'||!hash64.test(String(receipt.rosterSourceDigest))||
  !hash64.test(String(receipt.sourceCandidateDigest))||!frozen||!result||
  frozen.matchId!==row.public_match_id||frozen.generation!==world.generation||
  frozen.season!==world.seasonNumber||frozen.day!==fixture.day||
  frozen.fixtureId!==fixture.id||frozen.competitionId!==fixture.competitionId||
  frozen.homeClubId!==fixture.homeClubId||frozen.awayClubId!==fixture.awayClubId||
  frozen.sourceHash!==sourceHash||result.algorithmVersion!=='temporary-lineup-v1'||
  result.matchKey!==fixture.id||result.homeClubId!==fixture.homeClubId||
  result.awayClubId!==fixture.awayClubId||
  JSON.stringify(result.context)!==JSON.stringify(context))return fail();
 // Independently validate scorer IDs, score, XI appearances, knockout winner,
 // goal reconciliation and the candidate digest; do NOT consult current contracts.
 try{
  const candidate=await buildCandidateMatchReceiptV1(
   frozen as unknown as Parameters<typeof buildCandidateMatchReceiptV1>[0],result);
  if(candidate.receiptDigest!==receipt.sourceCandidateDigest)return fail();
 }catch{return fail()}
 const score:LineupSportingScoreV1={
  fixtureId:fixture.id,algorithmVersion:'temporary-lineup-v1',
  context:result.context,regulation:result.regulation,
  extraTime:result.extraTime,penalties:result.penalties,
  homeGoals:result.homeGoals,awayGoals:result.awayGoals,
  winnerClubId:result.winnerClubId,resolution:result.resolution
 };
 return {fixtureId:fixture.id,matchId:row.public_match_id,
  receiptHash:row.receipt_hash,receipt:receipt as unknown as LineupDailyMatchReceiptV1['receipt'],
  score};
}
export interface LineupSeasonReplayV1 {
 progression:ReturnType<typeof createProgression<LineupSportingScoreV1>>;
 days:LineupDailyEvidenceV2[];
 frozenMatches:ReadonlyMap<string,FrozenLineupMatchV1>;
 resultCount:number;
}
/** Reconstruct the EXACT persisted prefix, including empty days, with a single
 * canonical sporting progression. A caller MUST supply independently approved
 * source evidence; a DB row alone is never an authority to invent fixtures.
 */
export async function replayLineupSeasonV1(
 db:Database,world:WorldV1,evidence:SeasonEvidence,throughDay:number
):Promise<LineupSeasonReplayV1>{
 if(!world||world.seasonNumber!==evidence?.schedule.season||
  evidence.season.generation!==world.generation||
  !Number.isInteger(throughDay)||throughDay<0||throughDay>56||
  throughDay>world.day||world.seasonNumber<1)return fail();
 const rows=(await db.prepare(
  'SELECT day,generation,calendar_hash,simulation_version,outcome_hash,outcome_json FROM season_lineup_day_outcomes WHERE season_number=? ORDER BY day'
 ).bind(world.seasonNumber).all<DayRow>()).results;
 if(!Array.isArray(rows)||rows.length!==throughDay)return fail();
 const expectedTotal=await db.prepare(
  'SELECT COUNT(*) AS n FROM match_lineup_result_receipts WHERE generation=? AND season_number=?'
 ).bind(world.generation,world.seasonNumber).first<CountRow>();
 if(!expectedTotal||!Number.isSafeInteger(expectedTotal.n)||expectedTotal.n<0)return fail();
 const leagueSlots=new Map((await assignLeagueMatchSlots(evidence.schedule.fixtures,
  world.generation,world.seasonNumber)).map(s=>[s.sourceFixtureId,s.slotId]));
 const state=createProgression<LineupSportingScoreV1>(evidence.snapshot,evidence.schedule);
 const days:LineupDailyEvidenceV2[]=[];
 const frozenMatches=new Map<string,FrozenLineupMatchV1>();
 // Proof for indexed single-match reads: no two frozen fixtures share a public ID.
 const seenPublicMatchIds=new Set<number>();
 let resultCount=0;
 for(let day=1;day<=throughDay;day++){
  const row=rows[day-1];
  if(!row||row.day!==day||row.generation!==world.generation||
   row.calendar_hash!==evidence.calendar.calendar_hash||
   row.simulation_version!=='temporary-lineup-v1'||!hash64.test(row.outcome_hash))
   return fail();
  const matchRows=(await db.prepare(matchQuery)
   .bind(world.generation,world.seasonNumber,day).all<MatchRow>()).results;
  if(!Array.isArray(matchRows))return fail();
  const byFixture=new Map(matchRows.map(r=>[r.fixture_id,r]));
  if(byFixture.size!==matchRows.length)return fail();
  const entries:LineupDailyMatchReceiptV1[]=[];
  const dueFixtures:Array<{fixtureId:string;matchId:number}>=[];
  try{
   await processSportingDayWithResolver(state,day,async(f,context,source)=>{
    const match=byFixture.get(f.id);
    if(!match)return fail();
    const frozen=await verifyFrozenLineupMatchV1(match,f,context,source,world,
     source?undefined:leagueSlots.get(f.id));
    if(frozenMatches.has(f.id)||seenPublicMatchIds.has(frozen.matchId))return fail();
    frozenMatches.set(f.id,frozen);
    seenPublicMatchIds.add(frozen.matchId);
    entries.push({fixtureId:f.id,receiptHash:frozen.receiptHash,receipt:frozen.receipt});
    dueFixtures.push({fixtureId:f.id,matchId:frozen.matchId});
    return frozen.score;
   });
   if(entries.length!==matchRows.length)return fail();
   const payload=parseObject(row.outcome_json) as unknown as LineupDailyEvidenceV2['payload'];
   const verified=await verifyLineupDayEvidenceV2({
    payload,hash:row.outcome_hash,dueFixtures,receipts:entries
   });
   days.push(verified);resultCount+=entries.length;
  }catch{return fail()}
 }
 if(resultCount!==expectedTotal.n||state.results.size!==resultCount)return fail();
 const ties=(await db.prepare(
  'SELECT generation,competition_id,phase_id,tie_id,plan_hash,plan_json FROM season_knockout_ties WHERE season_number=?'
 ).bind(world.seasonNumber).all<TieRow>()).results;
 if(!Array.isArray(ties)||ties.length!==state.ties.size)return fail();
 for(const row of ties){
  const tie:KnockoutTie|undefined=state.ties.get(tieKey({
   competitionId:row.competition_id,phaseId:row.phase_id,tieId:row.tie_id
  }));
  if(!tie||row.generation!==world.generation||
   row.plan_hash!==await canonicalHash(tie)||!hash64.test(row.plan_hash))
   return fail();
  try{
   if(await canonicalHash(parseObject(row.plan_json))!==row.plan_hash)return fail();
  }catch{return fail()}
 }
 return {progression:state,days,frozenMatches,resultCount};
}
