/** Indexed public match read; staged fixtures remain private until draw commit. */
import type {Database} from './database.ts';
import {ApiError} from './errors.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {readWorld} from './world-repository.ts';
import {isMatchId,matchIdForSlot} from './domain/calendar/match-slot-identity.ts';
import type {TemporaryResult} from './temporary-simulation.ts';
import {buildKnockoutSlotReservations,type BracketScope} from './domain/calendar/knockout-slot-reservations.ts';
import {readPublicSportingSeason} from './public-sporting-read.ts';

interface MatchRow {
 match_id:string;generation:string;season_number:number;competition_id:string;phase_id:string;
 slot_id:string;source_fixture_id:string;marker:string;scheduled_day:number;round_number:number;
 home_club_id:string;away_club_id:string;source_kind:'calendar'|'domestic'|'international';
 source_hash:string;published_at:number;
}
interface Stage {generation:string;seed:string;fixtures_hash:string;participants_hash:string;rules_hash:string;created_at:number}
interface Draw {competition_id:string;outcome_hash:string;created_at:number}
interface Event {status:string;receipt_hash:string|null;completed_at:number|null}
interface Calendar {calendar_hash:string;created_at:number}
interface Day {generation:string;day:number;calendar_hash:string;simulation_version:string;outcome_hash:string;outcome_json:string}
const missing=():never=>{throw new ApiError(404,'not_found')};
const corrupt=():never=>{throw new ApiError(503,'match_unavailable')};

interface PublicationSource {generation:string;season_number:number;competition_id:string;source_kind:'calendar'|'domestic'|'international';source_hash:string;published_at:number}
async function confirmedPublication(db:Database,row:PublicationSource):Promise<Calendar|null> {
 const calendar=await db.prepare('SELECT calendar_hash,created_at FROM season_calendars WHERE season_number=?')
  .bind(row.season_number).first<Calendar>();
 if(row.source_kind==='calendar'){
  if(!calendar||calendar.calendar_hash!==row.source_hash||calendar.created_at!==row.published_at)return corrupt();
  return calendar;
 }
 const stage=await db.prepare('SELECT generation,seed,fixtures_hash,participants_hash,rules_hash,created_at FROM season_domestic_stages WHERE season_number=?')
  .bind(row.season_number).first<Stage>();
 const eventId=row.source_kind==='domestic'?'domestic:calendar':'international:draw';
 const event=await db.prepare('SELECT status,receipt_hash,completed_at FROM season_admin_events WHERE season_number=? AND event_id=?')
  .bind(row.season_number,eventId).first<Event>();
 if(!event||event.status!=='completed')return missing();
 if(!stage||stage.generation!==row.generation||!event.receipt_hash||
    event.completed_at!==row.published_at)return corrupt();
 if(row.source_kind==='domestic'){
  if(row.competition_id.startsWith('int-')||row.source_hash!==stage.fixtures_hash||
     stage.created_at!==row.published_at)return corrupt();
  const receipt=await canonicalHash({schemaVersion:1,season:row.season_number,generation:row.generation,
   eventId:'domestic:calendar',fixturesHash:stage.fixtures_hash,seed:stage.seed,
   participantsHash:stage.participants_hash,rulesHash:stage.rules_hash});
  if(receipt!==event.receipt_hash)return corrupt();
 }else{
  if(!row.competition_id.startsWith('int-'))return corrupt();
  const draws=(await db.prepare('SELECT competition_id,outcome_hash,created_at FROM season_draws WHERE season_number=? ORDER BY competition_id')
   .bind(row.season_number).all<Draw>()).results;
  if(draws.length!==2||draws[0].competition_id!=='int-1'||draws[1].competition_id!=='int-2'||
     draws.some(d=>d.created_at!==row.published_at))return corrupt();
  const own=draws.find(d=>d.competition_id===row.competition_id);
  if(!own||own.outcome_hash!==row.source_hash)return corrupt();
  const receipt=await canonicalHash({schemaVersion:1,generation:row.generation,season:row.season_number,
   eventId:'international:draw',domesticHash:stage.fixtures_hash,
   drawHashes:draws.map(d=>[d.competition_id,d.outcome_hash])});
  if(receipt!==event.receipt_hash)return corrupt();
 }
 return calendar;
}

export async function readPublicMatch(db:Database,matchId:string){
 if(typeof matchId!=='string'||!isMatchId(matchId))return missing();
 const world=await readWorld(db);
 const row=await db.prepare('SELECT * FROM season_match_slots WHERE match_id=?').bind(matchId).first<MatchRow>();
 if(!row)return readPublicReservedKnockout(db,matchId,world);
 if(row.generation!==world.generation||world.seasonNumber===0||
    row.season_number>world.seasonNumber)return missing();
 const season=await db.prepare('SELECT generation FROM seasons WHERE season_number=?')
  .bind(row.season_number).first<{generation:string}>();
 if(!season||season.generation!==world.generation)return corrupt();
 const expected=await matchIdForSlot({generation:row.generation,season:row.season_number,
  competitionId:row.competition_id,phaseId:row.phase_id,slotId:row.slot_id});
 if(expected!==matchId||row.source_fixture_id!==
  'season:'+row.season_number+':'+row.competition_id+':'+row.marker+':'+row.home_club_id+':'+row.away_club_id)
  return corrupt();
 const calendar=await confirmedPublication(db,row);
 let scored:TemporaryResult|null=null;
 if(calendar&&row.scheduled_day<=(row.season_number===world.seasonNumber?world.day:56)){
  const receipt=await db.prepare('SELECT generation,day,calendar_hash,simulation_version,outcome_hash,outcome_json FROM season_day_outcomes WHERE season_number=? AND day=?')
   .bind(row.season_number,row.scheduled_day).first<Day>();
  if(!receipt)return corrupt();
  let data:any;
  try{data=JSON.parse(receipt.outcome_json)}catch{return corrupt()}
  if(receipt.generation!==world.generation||receipt.day!==row.scheduled_day||
   receipt.calendar_hash!==calendar.calendar_hash||receipt.simulation_version!=='temporary-score-v1'||
   data.schemaVersion!==1||data.season!==row.season_number||data.generation!==world.generation||
   data.day!==row.scheduled_day||data.calendarHash!==calendar.calendar_hash||
   data.simulationVersion!=='temporary-score-v1'||!Array.isArray(data.results)||
   await canonicalHash(data)!==receipt.outcome_hash)return corrupt();
  const matches=(data.results as TemporaryResult[]).filter(x=>x.fixtureId===row.source_fixture_id);
  if(matches.length!==1)return corrupt();
  scored=matches[0];
  if(scored.algorithmVersion!=='temporary-score-v1'||scored.provenance!=='temporary-simulation'||
   !Number.isSafeInteger(scored.homeGoals)||scored.homeGoals<0||
   !Number.isSafeInteger(scored.awayGoals)||scored.awayGoals<0)return corrupt();
 }
 const after=await readWorld(db);
 if(after.generation!==world.generation||after.revision!==world.revision||
  after.seasonNumber!==world.seasonNumber||after.day!==world.day||after.phase!==world.phase)
  throw new ApiError(409,'stale_world');
 const result=scored?{homeGoals:scored.homeGoals,awayGoals:scored.awayGoals,
  resolution:scored.resolution,extraTime:scored.extraTime??null,penalties:scored.penalties??null,
  winnerClubId:scored.winnerClubId}:null;
 return {schemaVersion:1,providerId:'authoritative-world',matchId,season:row.season_number,
  competitionId:row.competition_id,stageId:row.phase_id,slotId:row.slot_id,
  round:row.round_number,marker:row.marker,day:row.scheduled_day,
  homeParticipant:{clubId:row.home_club_id},awayParticipant:{clubId:row.away_club_id},
  status:result?'completed':'scheduled',result,venue:null,kickoff:null,
  provenance:{kind:'authoritative',sourceKind:row.source_kind,sourceHash:row.source_hash}};
}

/**
 * Published competition's official fixtures, including during the interval
 * between domestic and international draws. Does not publish standings or
 * future match results before a sporting receipt exists.
 */
export async function readPublishedCompetitionMatches(db:Database,season:number,competitionId:string){
 if(!Number.isSafeInteger(season)||season<1||
    !/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/.test(competitionId))return missing();
 const world=await readWorld(db);
 if(world.seasonNumber===0||season>world.seasonNumber)return missing();
 const rows=(await db.prepare(
  'SELECT * FROM season_match_slots WHERE season_number=? AND competition_id=? ORDER BY scheduled_day,round_number,match_id'
 ).bind(season,competitionId).all<MatchRow>()).results;
 if(rows.length===0)return missing();
 const expected=competitionId.startsWith('int-')?72:240;
 if(rows.length!==expected)return corrupt();
 const sample=rows[0];
 if(rows.some(r=>r.generation!==world.generation||r.source_kind!==sample.source_kind||
   r.source_hash!==sample.source_hash||r.published_at!==sample.published_at))return corrupt();
 const saved=await db.prepare('SELECT generation FROM seasons WHERE season_number=?')
  .bind(season).first<{generation:string}>();
 if(!saved||saved.generation!==world.generation)return corrupt();
 await confirmedPublication(db,sample);
 const brackets=(await db.prepare(
  'SELECT * FROM season_knockout_match_slots WHERE season_number=? AND competition_id=? ORDER BY scheduled_day,round_number,match_id'
 ).bind(season,competitionId).all<ReservedKnockout>()).results;
 const expectedBrackets=competitionId.startsWith('int-')?21:competitionId.endsWith('-1')?2:5;
 if(brackets.length!==expectedBrackets)return corrupt();
 const definitions=(await buildKnockoutSlotReservations(world.generation,season,sample.source_kind))
  .filter(s=>s.competitionId===competitionId);
 if(definitions.length!==expectedBrackets)return corrupt();
 const canonical=await buildKnockoutSlotReservations(world.generation,season,sample.source_kind);
 for(const bracket of brackets){
  if(bracket.generation!==world.generation||bracket.source_kind!==sample.source_kind||
     bracket.source_hash!==sample.source_hash||bracket.published_at!==sample.published_at)return corrupt();
  await validKnockoutSlot(bracket,canonical);
 }
 await confirmedPublication(db,brackets[0]);
 const after=await readWorld(db);
 if(after.generation!==world.generation||after.revision!==world.revision||
   after.seasonNumber!==world.seasonNumber||after.day!==world.day||after.phase!==world.phase)
   throw new ApiError(409,'stale_world');
 return {schemaVersion:1,providerId:'authoritative-world',season,competitionId,
  status:'published',fixtures:[
   ...rows.map(r=>({matchId:r.match_id,sourceFixtureId:r.source_fixture_id,
     marker:r.marker,day:r.scheduled_day,round:r.round_number,phaseId:'league',
     homeClubId:r.home_club_id,awayClubId:r.away_club_id})),
   ...brackets.map(r=>({matchId:r.match_id,sourceFixtureId:null,
     marker:r.marker,day:r.scheduled_day,round:r.round_number,phaseId:r.phase_id,
     tieId:r.tie_id,leg:r.leg,homeClubId:null,awayClubId:null,
     participantA:JSON.parse(r.participant_a_json),participantB:JSON.parse(r.participant_b_json)}))
  ].sort((a,b)=>a.day-b.day||a.matchId.localeCompare(b.matchId,'en')),
  provenance:{kind:'authoritative',sourceKind:sample.source_kind,sourceHash:sample.source_hash}};
}

interface ReservedKnockout extends PublicationSource {
 match_id:string;phase_id:string;tie_id:string;leg:number;slot_id:string;
 marker:string;scheduled_day:number;round_number:number|null;
 home_policy:string;rules_version:string;participant_a_json:string;participant_b_json:string;
}
interface ResolvedFixture {
 id:string;marker:string;day:number;homeClubId:string;awayClubId:string;
 phaseId:string;tieId:string|null;leg:number|null;result:unknown;
}
/** Re-derive immutable slot proof from approved brackets, not from its database row. */
async function validKnockoutSlot(row:ReservedKnockout,canonical?:Awaited<ReturnType<typeof buildKnockoutSlotReservations>>) {
 const scope=row.source_kind as BracketScope;
 const expected=(canonical??await buildKnockoutSlotReservations(row.generation,row.season_number,scope))
  .find(x=>x.matchId===row.match_id);
 if(!expected||row.competition_id!==expected.competitionId||row.phase_id!==expected.phaseId||
  row.tie_id!==expected.tieId||row.leg!==expected.leg||row.slot_id!==expected.slotId||
  row.marker!==expected.marker||row.scheduled_day!==expected.day||
  row.round_number!==expected.round||row.home_policy!==expected.homePolicy||
  row.rules_version!==expected.rulesVersion||
  row.participant_a_json!==JSON.stringify(expected.participantA)||
  row.participant_b_json!==JSON.stringify(expected.participantB))return corrupt();
 return expected;
}
async function readPublicReservedKnockout(
 db:Database,matchId:string,world:Awaited<ReturnType<typeof readWorld>>,
){
 const row=await db.prepare('SELECT * FROM season_knockout_match_slots WHERE match_id=?')
  .bind(matchId).first<ReservedKnockout>();
 if(!row||row.generation!==world.generation||world.seasonNumber===0||
    row.season_number>world.seasonNumber)return missing();
 const season=await db.prepare('SELECT generation FROM seasons WHERE season_number=?')
  .bind(row.season_number).first<{generation:string}>();
 if(!season||season.generation!==world.generation)return corrupt();
 const slot=await validKnockoutSlot(row);
 await confirmedPublication(db,row);
 let resolved:ResolvedFixture|null=null;
 const tie=await db.prepare('SELECT plan_hash FROM season_knockout_ties WHERE season_number=? AND competition_id=? AND phase_id=? AND tie_id=?')
  .bind(row.season_number,row.competition_id,row.phase_id,row.tie_id).first<{plan_hash:string}>();
 if(tie){
  // This existing projection independently reconstructs and verifies the entire
  // sporting chain (receipts, league ranks, knockout plan and source hashes).
  const projection=await readPublicSportingSeason(db,row.competition_id,row.season_number);
  const data=projection.data as {fixtures:ResolvedFixture[]}|null;
  if(!data||!Array.isArray(data.fixtures))return corrupt();
  const matching=data.fixtures.filter(f=>f.phaseId===row.phase_id&&f.tieId===row.tie_id&&f.leg===row.leg);
  if(matching.length!==1||matching[0].marker!==row.marker||matching[0].day!==row.scheduled_day)return corrupt();
  resolved=matching[0];
 }
 const after=await readWorld(db);
 if(after.generation!==world.generation||after.revision!==world.revision||
  after.seasonNumber!==world.seasonNumber||after.day!==world.day||after.phase!==world.phase)
  throw new ApiError(409,'stale_world');
 return {schemaVersion:1,providerId:'authoritative-world',matchId,season:row.season_number,
  competitionId:row.competition_id,stageId:row.phase_id,tieId:row.tie_id,slotId:row.slot_id,
  round:row.round_number,marker:row.marker,day:row.scheduled_day,leg:row.leg,
  neutral:row.home_policy==='neutral',homePolicy:row.home_policy,
  participantA:slot.participantA,participantB:slot.participantB,
  homeParticipant:resolved?{clubId:resolved.homeClubId}:null,
  awayParticipant:resolved?{clubId:resolved.awayClubId}:null,
  status:resolved?.result?'completed':resolved?'scheduled':'awaiting_participants',
  result:resolved?.result??null,venue:null,kickoff:null,
  provenance:{kind:'authoritative',sourceKind:row.source_kind,sourceHash:row.source_hash}};
}
