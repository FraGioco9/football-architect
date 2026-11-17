/** #613: official V2 public match read.
 * Completed fixtures are reconstructed from verified frozen receipts only;
 * scheduled fixtures have no score or fabricated player lineup.
 */
/** Indexed public match read; staged fixtures remain private until draw commit. */
import type {Database} from './database.ts';
import {ApiError} from './errors.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {readWorld} from './world-repository.ts';
import {matchIdForSlot} from './domain/calendar/match-slot-identity.ts';
import {loadSeasonSportingEvidence} from './season-sporting-evidence.ts';
import {replayLineupSeasonV1} from './lineup-season-replay.ts';
import {frozenLineupMatchDetailV1} from './frozen-lineup-match-detail.ts';
import {buildKnockoutSlotReservations,type BracketScope} from './domain/calendar/knockout-slot-reservations.ts';
import {readPublicSportingSeasonLineupV1} from './public-sporting-read-lineup-v1.ts';
import {canonicalHomeStadium,matchSlotStadium} from './match-venues.ts';

interface MatchRow {
 match_id:string;generation:string;season_number:number;competition_id:string;phase_id:string;
 slot_id:string;source_fixture_id:string;marker:string;scheduled_day:number;round_number:number;
 home_club_id:string;away_club_id:string;stadium_name:string|null;source_kind:'calendar'|'domestic'|'international';
 source_hash:string;published_at:number;
}
interface MatchNumber {id:number;slot_match_id:string;generation:string;season_number:number}
interface Stage {generation:string;seed:string;fixtures_hash:string;participants_hash:string;rules_hash:string;created_at:number}
interface Draw {competition_id:string;outcome_hash:string;created_at:number}
interface Event {status:string;receipt_hash:string|null;completed_at:number|null}
interface Calendar {calendar_hash:string;created_at:number}
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

export async function readPublicMatchLineupV1(db:Database,matchId:string){
 if(typeof matchId!=='string'||!/^[1-9][0-9]*$/.test(matchId))return missing();
 const numberId=Number(matchId);
 if(!Number.isSafeInteger(numberId)||numberId<1)return missing();
 const mapping=await db.prepare('SELECT * FROM public_match_numbers WHERE id=?')
  .bind(numberId).first<MatchNumber>();
 if(!mapping||!Number.isSafeInteger(mapping.id)||mapping.id<1)return missing();
 const internalId=mapping.slot_match_id;
 const world=await readWorld(db);
 if(mapping.generation!==world.generation||world.seasonNumber===0||mapping.season_number>world.seasonNumber)return missing();
 const row=await db.prepare('SELECT * FROM season_match_slots WHERE match_id=?').bind(internalId).first<MatchRow>();
 if(!row)return readPublicReservedKnockoutLineupV1(db,internalId,world,String(mapping.id));
 if(row.generation!==world.generation||world.seasonNumber===0||
    row.season_number>world.seasonNumber)return missing();
 const season=await db.prepare('SELECT generation FROM seasons WHERE season_number=?')
  .bind(row.season_number).first<{generation:string}>();
 if(!season||season.generation!==world.generation)return corrupt();
 const expected=await matchIdForSlot({generation:row.generation,season:row.season_number,
  competitionId:row.competition_id,phaseId:row.phase_id,slotId:row.slot_id});
 if(expected!==internalId||row.source_fixture_id!==
  'season:'+row.season_number+':'+row.competition_id+':'+row.marker+':'+row.home_club_id+':'+row.away_club_id)
  return corrupt();
 const calendar=await confirmedPublication(db,row);
 let frozen:ReturnType<typeof frozenLineupMatchDetailV1>=null;
 const visibleDay=row.season_number===world.seasonNumber?world.day:56;
 if(calendar&&row.scheduled_day<=visibleDay){
  const viewedWorld=row.season_number===world.seasonNumber?world:{
   ...world,seasonNumber:row.season_number,day:56,phase:'closed' as const
  };
  const evidence=await loadSeasonSportingEvidence(db,viewedWorld);
  const replay=await replayLineupSeasonV1(db,viewedWorld,evidence,viewedWorld.day);
  frozen=frozenLineupMatchDetailV1(replay,mapping.id);
  if(!frozen||frozen.fixtureId!==row.source_fixture_id||
    frozen.day!==row.scheduled_day||frozen.season!==row.season_number||
    frozen.competitionId!==row.competition_id||
    frozen.homeClubId!==row.home_club_id||frozen.awayClubId!==row.away_club_id)
   return corrupt();
 }
 const after=await readWorld(db);
 if(after.generation!==world.generation||after.revision!==world.revision||
  after.seasonNumber!==world.seasonNumber||after.day!==world.day||after.phase!==world.phase)
  throw new ApiError(409,'stale_world');
 const result=frozen?.result??null;
 return {schemaVersion:1,providerId:'authoritative-world',matchId:String(mapping.id),season:row.season_number,
  competitionId:row.competition_id,stageId:row.phase_id,
  round:row.round_number,day:row.scheduled_day,
  homeParticipant:{clubId:row.home_club_id},awayParticipant:{clubId:row.away_club_id},
  status:result?'completed':'scheduled',result,
  lineup:frozen?.players??null,
  venue:(()=>{const name=matchSlotStadium(row.home_club_id,row.stadium_name);return name?{name}:null})(),kickoff:null,
  provenance:{kind:'authoritative',receiptHash:frozen?.provenance.receiptHash??null}};
}

/**
 * Published competition's official fixtures, including during the interval
 * between domestic and international draws. Does not publish standings or
 * future match results before a sporting receipt exists.
 */
export async function readPublishedCompetitionMatchesLineupV1(db:Database,season:number,competitionId:string){
 if(!Number.isSafeInteger(season)||season<1||
    !/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/.test(competitionId))return missing();
 const world=await readWorld(db);
 if(world.seasonNumber===0||season>world.seasonNumber)return missing();
 const rows=(await db.prepare(
  `SELECT s.*,p.id AS public_id FROM season_match_slots s
   JOIN public_match_numbers p ON p.slot_match_id=s.match_id AND p.generation=s.generation AND p.season_number=s.season_number
   WHERE s.season_number=? AND s.competition_id=? ORDER BY s.scheduled_day,s.round_number,s.match_id`
 ).bind(season,competitionId).all<MatchRow>()).results;
 if(rows.length===0)return missing();
 const expected=competitionId.startsWith('int-')?72:240;
 if(rows.length!==expected)return corrupt();
 const sample=rows[0];
 if(rows.some(r=>!Number.isSafeInteger((r as MatchRow&{public_id:number}).public_id)||r.generation!==world.generation||r.source_kind!==sample.source_kind||
   r.source_hash!==sample.source_hash||r.published_at!==sample.published_at))return corrupt();
 const saved=await db.prepare('SELECT generation FROM seasons WHERE season_number=?')
  .bind(season).first<{generation:string}>();
 if(!saved||saved.generation!==world.generation)return corrupt();
 await confirmedPublication(db,sample);
 const brackets=(await db.prepare(
  `SELECT s.*,p.id AS public_id FROM season_knockout_match_slots s
   JOIN public_match_numbers p ON p.slot_match_id=s.match_id AND p.generation=s.generation AND p.season_number=s.season_number
   WHERE s.season_number=? AND s.competition_id=? ORDER BY s.scheduled_day,s.round_number,s.match_id`
 ).bind(season,competitionId).all<ReservedKnockout>()).results;
 const expectedBrackets=competitionId.startsWith('int-')?21:competitionId.endsWith('-1')?2:5;
 if(brackets.length!==expectedBrackets)return corrupt();
 // Generate and hash the canonical bracket reservation set only once.
 const canonical=await buildKnockoutSlotReservations(world.generation,season,sample.source_kind);
 const definitions=canonical.filter(s=>s.competitionId===competitionId);
 if(definitions.length!==expectedBrackets)return corrupt();
 for(const bracket of brackets){
  if(!Number.isSafeInteger((bracket as ReservedKnockout&{public_id:number}).public_id)||bracket.generation!==world.generation||bracket.source_kind!==sample.source_kind||
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
   ...rows.map(r=>({matchId:String((r as MatchRow&{public_id:number}).public_id),sourceFixtureId:r.source_fixture_id,
     marker:r.marker,day:r.scheduled_day,round:r.round_number,phaseId:'league',
     homeClubId:r.home_club_id,awayClubId:r.away_club_id,
     venue:(()=>{const name=matchSlotStadium(r.home_club_id,r.stadium_name);return name?{name}:null})()})),
   ...brackets.map(r=>({matchId:String((r as ReservedKnockout&{public_id:number}).public_id),sourceFixtureId:null,
     marker:r.marker,day:r.scheduled_day,round:r.round_number,phaseId:r.phase_id,
     tieId:r.tie_id,leg:r.leg,homeClubId:null,awayClubId:null,venue:null,
     participantA:JSON.parse(r.participant_a_json),participantB:JSON.parse(r.participant_b_json)}))
  ].sort((a,b)=>a.day-b.day||a.matchId.localeCompare(b.matchId,'en')),
  provenance:{kind:'authoritative',sourceKind:sample.source_kind,sourceHash:sample.source_hash}};
}


/**
 * Read-only, evidence-checked early draw projection for a single club.
 * Only query competition scopes containing this club; never probe four public API routes.
 */
export async function readPublishedClubFixturesBeforeCalendarLineupV1(db:Database,clubKey:string,season:number){
 const world=await readWorld(db);
 if(!/^(?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40)$/.test(clubKey)||
    !Number.isSafeInteger(season)||season<1||season>world.seasonNumber)return missing();
 const affiliations=(await db.prepare(
  `SELECT DISTINCT competition_id FROM season_match_slots
   WHERE generation=? AND season_number=? AND (home_club_id=? OR away_club_id=?)
   ORDER BY competition_id`
 ).bind(world.generation,season,clubKey,clubKey).all<{competition_id:string}>()).results;
 const ids=affiliations.map(row=>row.competition_id);
 const domestic=ids.filter(id=>!id.startsWith('int-'));
 if(ids.length>2||new Set(ids).size!==ids.length||
    (ids.length>0&&domestic.length!==1)||ids.some(id=>!(/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/.test(id))))
  return corrupt();
 // Reuse the exact proof already enforced by the public competition-read contract.
 // No HTTP fan-out, no 404 probes for competitions that have not been drawn.
 const published=await Promise.all(ids.map(id=>readPublishedCompetitionMatchesLineupV1(db,season,id)));
 const fixtures:{
  id:string;matchId:string;competitionId:string;season:number;day:number;round:number;
  phaseId:'league';marker:string;tieId:null;leg:null;neutral:false;
  homeClubId:string;awayClubId:string;result:null
 }[]=[];
 const seen=new Set<string>();
 for(const scope of published){
  const games=scope.fixtures.filter(f=>f.phaseId==='league'&&
   (f.homeClubId===clubKey||f.awayClubId===clubKey));
  if(games.length!==(scope.competitionId.startsWith('int-')?6:30))return corrupt();
  for(const f of games){
   if(!/^[1-9][0-9]*$/.test(f.matchId)||seen.has(f.matchId)||
      typeof f.homeClubId!=='string'||typeof f.awayClubId!=='string'||
      f.homeClubId===f.awayClubId||!Number.isSafeInteger(f.day)||f.day<=world.day||f.day>56||
      !Number.isSafeInteger(f.round)||f.round<1||
      f.round>(scope.competitionId.startsWith('int-')?6:30))return corrupt();
   seen.add(f.matchId);
   fixtures.push({id:f.matchId,matchId:f.matchId,competitionId:scope.competitionId,
    season,day:f.day,round:Number(f.round),phaseId:'league',marker:f.marker,
    tieId:null,leg:null,neutral:false,homeClubId:f.homeClubId,awayClubId:f.awayClubId,result:null});
  }
 }
 fixtures.sort((a,b)=>a.day-b.day||a.competitionId.localeCompare(b.competitionId,'en')||
  a.round-b.round||Number(a.matchId)-Number(b.matchId));
 const after=await readWorld(db);
 if(after.generation!==world.generation||after.revision!==world.revision||
    after.seasonNumber!==world.seasonNumber||after.day!==world.day||after.phase!==world.phase)
  throw new ApiError(409,'stale_world');
 return {world,competitions:ids,fixtures,
  sourceHash:ids.length?await canonicalHash(published.map(p=>({
   competitionId:p.competitionId,sourceKind:p.provenance.sourceKind,sourceHash:p.provenance.sourceHash}))):null};
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
async function readPublicReservedKnockoutLineupV1(
 db:Database,matchId:string,world:Awaited<ReturnType<typeof readWorld>>,publicMatchId:string,
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
  const projection=await readPublicSportingSeasonLineupV1(db,row.competition_id,row.season_number);
  const data=projection.data as {fixtures:ResolvedFixture[]}|null;
  if(!data||!Array.isArray(data.fixtures))return corrupt();
  const matching=data.fixtures.filter(f=>f.phaseId===row.phase_id&&f.tieId===row.tie_id&&f.leg===row.leg);
  if(matching.length!==1||matching[0].marker!==row.marker||matching[0].day!==row.scheduled_day)return corrupt();
  resolved=matching[0];
 }
 let frozen:ReturnType<typeof frozenLineupMatchDetailV1>=null;
 if(resolved?.result){
  const viewedWorld=row.season_number===world.seasonNumber?world:{
   ...world,seasonNumber:row.season_number,day:56,phase:'closed' as const
  };
  if(resolved.day>viewedWorld.day)return corrupt();
  const evidence=await loadSeasonSportingEvidence(db,viewedWorld);
  const replay=await replayLineupSeasonV1(db,viewedWorld,evidence,viewedWorld.day);
  frozen=frozenLineupMatchDetailV1(replay,Number(publicMatchId));
  if(!frozen||frozen.fixtureId!==resolved.id||
   frozen.day!==row.scheduled_day||frozen.season!==row.season_number||
   frozen.competitionId!==row.competition_id||
   frozen.homeClubId!==resolved.homeClubId||frozen.awayClubId!==resolved.awayClubId||
   frozen.result.homeGoals!==(resolved.result as {homeGoals:number}).homeGoals||
   frozen.result.awayGoals!==(resolved.result as {awayGoals:number}).awayGoals)return corrupt();
 }else if(resolved&&resolved.day<=(row.season_number===world.seasonNumber?world.day:56)){
  return corrupt();
 }
 const after=await readWorld(db);
 if(after.generation!==world.generation||after.revision!==world.revision||
  after.seasonNumber!==world.seasonNumber||after.day!==world.day||after.phase!==world.phase)
  throw new ApiError(409,'stale_world');
 return {schemaVersion:1,providerId:'authoritative-world',matchId:publicMatchId,season:row.season_number,
  competitionId:row.competition_id,stageId:row.phase_id,tieId:row.tie_id,
  round:row.round_number,day:row.scheduled_day,leg:row.leg,
  neutral:row.home_policy==='neutral',
  participantA:slot.participantA,participantB:slot.participantB,
  homeParticipant:resolved?{clubId:resolved.homeClubId}:null,
  awayParticipant:resolved?{clubId:resolved.awayClubId}:null,
  status:resolved?.result?'completed':resolved?'scheduled':'awaiting_participants',
  result:frozen?.result??null,
  lineup:frozen?.players??null,
  venue:resolved&&row.home_policy!=='neutral'
   ?(()=>{const name=canonicalHomeStadium(resolved.homeClubId);return name?{name}:null})()
   :null,kickoff:null,
  provenance:{kind:'authoritative',receiptHash:frozen?.provenance.receiptHash??null}};
}
