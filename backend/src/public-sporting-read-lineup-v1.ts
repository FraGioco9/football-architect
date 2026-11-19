import {readPublicClubRoster} from './public-club-roster-read.ts';
/** #613: V2-only anonymous sporting projections from independently verified
 * immutable lineup receipts. Wired to HTTP in the Draft/HOLD branch; not deployed.
 * Never re-simulates a match or reads current affiliations on a public GET.
 */
import {frozenMatchPlayerStatistics} from './match-player-statistics.mjs';
import {aggregateFrozenPlayerSeasonStats} from './player-season-statistics.mjs';
import {collectFrozenPlayerMatches,paginateVerifiedPlayerMatches} from './player-match-history.mjs';
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import type {WorldV1} from './types.ts';
import {readWorld} from './world-repository.ts';
import {loadSeasonSportingEvidence} from './season-sporting-evidence.ts';
import {loadSeasonSnapshotAuthority} from './season-snapshot-authority.ts';
import {readSeasonZeroAuthority} from './season-zero-entrants.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import type {KnockoutTie} from './knockout-progression.ts';
import {replayLineupSeasonV1} from './lineup-season-replay.ts';
import type {LineupSportingScoreV1} from './lineup-sporting-day-plan.ts';
import type {FrozenLineupMatchV1} from './lineup-season-replay.ts';
import type {LineupMatchResultV1} from './temporary-lineup-v1.mjs';
import {rankLeagueTable} from './league-standings.ts';
import {withOfficialClubMatchIds} from './public-club-fixture-match-ids.ts';
import type {Fixture} from './initial-schedule.ts';
import {readSeasonCalendarHash,readSeasonArchiveSummary,readSeasonCloseReceipt} from './season-evidence-repository.ts';
interface Archive {generation:string;calendar_hash:string;results_hash:string;knockout_hash:string;archive_hash:string;results_count:number;days_count:number;ties_count:number;created_at:number}
interface DayReceiptRow {day:number;outcome_hash:string}
// The frozen replay already verifies receipt contents and generation.
// This second read only needs ordered hashes for the sealed archive proof.
async function readV2Days(db:Database,season:number):Promise<DayReceiptRow[]>{
 return (await db.prepare(
  'SELECT day,outcome_hash FROM season_lineup_day_outcomes WHERE season_number=? ORDER BY day'
 ).bind(season).all<DayReceiptRow>()).results;
}
/** Read-only, independent season evidence metadata. The caller verifies all
 * receipts against the frozen replay and archive before publishing any data.
 * No mutable cache, weakened authority check or additional D1 query. */
export async function readPublicSeasonReceiptBundle(db:Database,season:number){
 if(!Number.isSafeInteger(season)||season<1)throw new ApiError(404,'not_found');
 const receiptRead=readV2Days(db,season);
 // Only hash order and cardinality are needed here. The replay above
 // already independently validates the complete immutable knockout plans.
 const tieRead=db.prepare(
  'SELECT plan_hash FROM season_knockout_ties WHERE season_number=? ORDER BY competition_id,phase_id,tie_id'
 ).bind(season).all<{plan_hash:string}>();
 const archiveRead=db.prepare('SELECT * FROM season_archives WHERE season_number=?')
  .bind(season).first<Archive>();
 const [receipts,tieRows,archive]=await Promise.all([receiptRead,tieRead,archiveRead]);
 return {receipts,ties:tieRows.results,archive};
}
async function countV2Days(db:Database,season:number):Promise<number>{
 const row=await db.prepare('SELECT COUNT(*) AS n FROM season_lineup_day_outcomes WHERE season_number=?')
  .bind(season).first<{n:number}>();
 return row?.n??0;
}
const competitionPattern=/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/;
const clubPattern=/^(?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40)$/;
function invalid():never{throw new ApiError(503,'sporting_data_unavailable')}
async function unchanged(db:Database,before:WorldV1){
 const after=await readWorld(db);
 if(after.generation!==before.generation||after.revision!==before.revision||after.seasonNumber!==before.seasonNumber||after.day!==before.day||after.phase!==before.phase)throw new ApiError(409,'stale_world');
}
function publicScore(result:LineupSportingScoreV1){
 return {homeGoals:result.homeGoals,awayGoals:result.awayGoals,resolution:result.resolution,
  extraTime:result.extraTime?{home:result.extraTime.home,away:result.extraTime.away}:null,
  penalties:result.penalties?{home:result.penalties.home,away:result.penalties.away}:null,winnerClubId:result.winnerClubId};
}
export function lineupTeamStatisticsV1(
 clubs:readonly string[],fixtures:readonly Fixture[],
 results:ReadonlyMap<string,LineupSportingScoreV1>,
 frozenMatches:ReadonlyMap<string,FrozenLineupMatchV1>
){
 const teams=new Map(clubs.map(clubId=>[clubId,{clubId,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,cleanSheets:0}]));
 let matchesPlayed=0,totalGoals=0;
 const players=new Map<string,{playerId:number;clubId:string;displayName:string|null;nationality:string|null;appearances:number;starts:number;subAppearances:number;minutes:number;goals:number;assists:number|null;yellowCards:number|null;redCards:number|null;cleanSheets:number|null;ratedAppearances:number;ratingSum:number;mvpAwards:number;mvpCoveredAppearances:number;
  assistCoverage:boolean;yellowCoverage:boolean;redCoverage:boolean;subCoverage:boolean}>();
 for(const fixture of fixtures){
  const score=results.get(fixture.id);if(!score)continue;
  const frozen=frozenMatches.get(fixture.id);
  if(!frozen||frozen.fixtureId!==fixture.id||!Number.isSafeInteger(frozen.matchId))
   invalid();
  const complete=frozen.receipt.result as unknown as LineupMatchResultV1;
  const recorded=frozenMatchPlayerStatistics(complete);
  for(const [kind,club] of [['home',fixture.homeClubId],['away',fixture.awayClubId]] as const){
   const side=complete[kind],details=new Map(recorded[kind].players.map(p=>[p.playerId,p]));
   if(!side||!Array.isArray(side.appearances))invalid();
   for(const appearance of side.appearances){
    if(!Number.isSafeInteger(appearance.playerId)||appearance.playerId<1||
      typeof appearance.started!=='boolean'||!Number.isSafeInteger(appearance.minutes)||
      appearance.minutes<1||appearance.minutes>120||
      !Number.isSafeInteger(appearance.goals)||appearance.goals<0)invalid();
    const key=club+':'+appearance.playerId;
    const previous=players.get(key)??{
     playerId:appearance.playerId,clubId:club,displayName:null,nationality:null,appearances:0,starts:0,subAppearances:0,minutes:0,goals:0,assists:0,yellowCards:0,redCards:0,cleanSheets:null,ratedAppearances:0,ratingSum:0,mvpAwards:0,mvpCoveredAppearances:0,
     assistCoverage:true,yellowCoverage:true,redCoverage:true,subCoverage:true
    };
    previous.appearances++;if(appearance.started)previous.starts++;
    previous.minutes+=appearance.minutes;
    const detail=details.get(appearance.playerId);if(!detail)invalid();
    previous.displayName=detail.name??previous.displayName;
    previous.nationality=detail.nationality??previous.nationality;
    if(detail.cleanSheets!==null)previous.cleanSheets=(previous.cleanSheets??0)+detail.cleanSheets;
    if(detail.rating!==null){previous.ratedAppearances++;previous.ratingSum+=detail.rating;}
     if(recorded.mvp.status!=='unavailable'){
      previous.mvpCoveredAppearances++;
      if(recorded.mvp.status==='awarded'&&recorded.mvp.playerId===appearance.playerId){
       if(recorded.mvp.clubId!==club)invalid();
       previous.mvpAwards++;
      }
     }
    previous.assistCoverage&&=detail.assists!==null;
    previous.yellowCoverage&&=detail.yellowCards!==null;
    previous.redCoverage&&=detail.redCards!==null;
    previous.subCoverage&&=detail.subAppearances!==null;
    previous.assists=(previous.assists??0)+(detail.assists??0);
    previous.yellowCards=(previous.yellowCards??0)+(detail.yellowCards??0);
    previous.redCards=(previous.redCards??0)+(detail.redCards??0);
    previous.subAppearances=(previous.subAppearances??0)+(detail.subAppearances??0);
    previous.goals+=appearance.goals;players.set(key,previous);
   }
  }
  const home=teams.get(fixture.homeClubId),away=teams.get(fixture.awayClubId);if(!home||!away)invalid();
  matchesPlayed++;totalGoals+=score.homeGoals+score.awayGoals;
  home.played++;away.played++;home.goalsFor+=score.homeGoals;home.goalsAgainst+=score.awayGoals;
  away.goalsFor+=score.awayGoals;away.goalsAgainst+=score.homeGoals;
  if(score.awayGoals===0)home.cleanSheets++;if(score.homeGoals===0)away.cleanSheets++;
  // Team W/D/L describes the match score including extra time; shootouts are
  // separate tie-resolution data and do not inflate goals or change a drawn score.
  if(score.homeGoals>score.awayGoals){home.won++;away.lost++}
  else if(score.homeGoals<score.awayGoals){away.won++;home.lost++}
  else{home.drawn++;away.drawn++}
 }
 return {matchesPlayed,totalGoals,goalsPerMatch:matchesPlayed?totalGoals/matchesPlayed:0,
  teams:[...teams.values()].map(t=>({...t,goalDifference:t.goalsFor-t.goalsAgainst})),
  players:[...players.values()].map(({ratingSum,assistCoverage,yellowCoverage,redCoverage,subCoverage,...p})=>({
   ...p,mvpAwards:p.mvpAwards>0||p.mvpCoveredAppearances===p.appearances?p.mvpAwards:null,
    assists:assistCoverage?p.assists:null,
   yellowCards:yellowCoverage?p.yellowCards:null,redCards:redCoverage?p.redCards:null,
   subAppearances:subCoverage?p.subAppearances:null,
   averageRating:p.ratedAppearances?Math.round(ratingSum/p.ratedAppearances*100)/100:null
  })).sort((a,b)=>a.clubId.localeCompare(b.clubId,'en')||a.playerId-b.playerId),
  playerStatus:'available' as const};
}
/** Names are read-only identity enrichment; all sporting totals and club IDs
 * remain frozen receipt evidence. A single bound ID list avoids per-player GETs
 * and current-affiliation joins, including when viewing an archived season. */
async function competitionPlayerIdentities(db:Database,players:ReturnType<typeof lineupTeamStatisticsV1>['players']){
 const ids=[...new Set(players.filter(p=>p.displayName===null||p.nationality===null).map(p=>p.playerId))];
 if(!ids.length)return players;
 const rows=(await db.prepare(`SELECT id,
  COALESCE(NULLIF(TRIM(json_extract(payload_json,'$.display_name')),''),
   TRIM(json_extract(payload_json,'$.first_name')||' '||json_extract(payload_json,'$.last_name'))) AS display_name,
  json_extract(payload_json,'$.nationality') AS nationality
  FROM generated_players WHERE id IN (SELECT value FROM json_each(?))`)
  .bind(JSON.stringify(ids)).all<{id:number;display_name:string|null;nationality:string|null}>()).results;
 const names=new Map(rows.map(row=>[row.id,{
  name:typeof row.display_name==='string'&&row.display_name.trim()?row.display_name.trim():null,
  nationality:typeof row.nationality==='string'&&/^[A-Z]{3}$/.test(row.nationality)?row.nationality:null}]));
 return players.map(player=>({...player,displayName:player.displayName??names.get(player.playerId)?.name??null,
  nationality:player.nationality??names.get(player.playerId)?.nationality??null}));
}
function projectFixtures(fixtures:readonly Fixture[],plans:readonly KnockoutTie[],results:ReadonlyMap<string,LineupSportingScoreV1>){
 const metadata=new Map(plans.flatMap(plan=>plan.fixtures.map(item=>[item.fixture.id,{phaseId:plan.phaseId,tieId:plan.tieId,leg:item.leg,neutral:item.neutral}] as const)));
 return fixtures.map(f=>({...f,...(metadata.get(f.id)??{phaseId:'league',tieId:null,leg:null,neutral:false}),result:results.has(f.id)?publicScore(results.get(f.id)!):null}));
}
/** Verified INT-24 progress. A round is completed only by its decisive last-leg receipt.
 * Elimination freezes the attained phase; champion/runner-up require a played final. */
export function deriveInternationalClubStatus(
 clubKey:string,rank:number,leagueComplete:boolean,
 plans:readonly KnockoutTie[],results:ReadonlyMap<string,LineupSportingScoreV1>
):'groupStage'|'playoffs'|'quarterfinals'|'semifinals'|'final'|'winner'|'runnerUp'|null{
 if(!leagueComplete)return null;
 if(!Number.isSafeInteger(rank)||rank<1||rank>24)invalid();
 if(rank>12)return 'groupStage';
 const phases=['playoffs','quarterfinals','semifinals','final'] as const;
 let stage:typeof phases[number]=rank<=4?'quarterfinals':'playoffs';
 for(;;){
  const tie=plans.find(p=>p.phaseId===stage&&p.fixtures.some(f=>
   [f.fixture.homeClubId,f.fixture.awayClubId].includes(clubKey)));
  if(!tie)return stage;
  const decisive=tie.fixtures[tie.fixtures.length-1]?.fixture;
  if(!decisive)invalid();
  const result=results.get(decisive.id);
  if(!result)return stage;
  if(!result.winnerClubId||![decisive.homeClubId,decisive.awayClubId].includes(result.winnerClubId))invalid();
  if(result.winnerClubId!==clubKey)return stage==='final'?'runnerUp':stage;
  if(stage==='final')return 'winner';
  stage=phases[phases.indexOf(stage)+1];
 }
}
/** Published entrants are independent of any fixture draw. A completed admin
 * receipt and the exact season snapshot both have to match server approval.
 * An unconfirmed scope must never inherit the other scope's public clubs. */
async function confirmedEntrantsBeforeCalendar(db:Database,world:WorldV1,competitionId:string){
 if(world.phase!=='active'||world.day<1||world.day>12)return null;
 const international=competitionId.startsWith('int-');
 const eventId=international?'international:entrants':'domestic:entrants';
 const kind=international?'confirm-international-entrants':'confirm-domestic-entrants';
 const scope=international?'international':'domestic';
 const event=await db.prepare(
  'SELECT event_id,kind,scope,scheduled_day,status,completed_at,receipt_hash FROM season_admin_events WHERE season_number=? AND event_id=?'
 ).bind(world.seasonNumber,eventId).first<{
  event_id:string;kind:string;scope:string;scheduled_day:number;status:string;completed_at:number|null;receipt_hash:string|null
 }>();
 if(!event||event.status==='scheduled')return null;
 if(event.event_id!==eventId||event.kind!==kind||event.scope!==scope||
    event.status!=='completed'||!Number.isSafeInteger(event.scheduled_day)||
    event.scheduled_day<1||event.scheduled_day>world.day||
    !Number.isSafeInteger(event.completed_at)||Number(event.completed_at)<=0)return invalid();
 const {snapshot}=await loadSeasonSnapshotAuthority(db,world);
 const season=await db.prepare(
  'SELECT generation,participants_hash,rules_hash,snapshot_json FROM seasons WHERE season_number=?'
 ).bind(world.seasonNumber).first<{generation:string;participants_hash:string;rules_hash:string;snapshot_json:string}>();
 if(!season||season.generation!==world.generation||season.participants_hash!==snapshot.participantsHash||
    season.rules_hash!==snapshot.rulesHash)return invalid();
 let recorded:unknown;
 try{recorded=JSON.parse(season.snapshot_json)}catch{return invalid()}
 if(await canonicalHash(recorded)!==await canonicalHash(snapshot))return invalid();
 const receipt=await canonicalHash({schemaVersion:1,season:world.seasonNumber,generation:world.generation,
  eventId,kind,participantsHash:snapshot.participantsHash,rulesHash:snapshot.rulesHash});
 if(event.receipt_hash!==receipt)return invalid();
 const binding=snapshot.bindings.find(b=>b.competitionId===competitionId);
 if(!binding)return invalid();
 return {binding,participantsHash:snapshot.participantsHash};
}
export function clubRosterTotals(clubKey:string,fixtures:readonly Fixture[],
 results:ReadonlyMap<string,LineupSportingScoreV1>,frozenMatches:ReadonlyMap<string,FrozenLineupMatchV1>){
 const played=fixtures.filter(f=>results.has(f.id)&&(f.homeClubId===clubKey||f.awayClubId===clubKey));
 const complete=played.every(f=>{
  const result=frozenMatches.get(f.id)?.receipt.result as unknown as LineupMatchResultV1|undefined;
  return result?.[f.homeClubId===clubKey?'home':'away']?.kind==='real_xi';
 });
 const clubs=[...new Set(played.flatMap(f=>[f.homeClubId,f.awayClubId]))];
 const totals=complete?lineupTeamStatisticsV1(clubs,played,results,frozenMatches).players.filter(p=>p.clubId===clubKey):[];
 return {complete,totals};
}
async function readPublicProjection(db:Database,competitionId:string,selectedSeason:number,calendarDay?:number,rosterStats=false,includeClubRecords=false){
 const clubKey=competitionId.startsWith('club:')?competitionId.slice('club:'.length):null;
 const fixturesClubKey=competitionId.startsWith('club-fixtures:')?competitionId.slice('club-fixtures:'.length):null;
 const playerKey=/^player(?:-matches)?:([1-9][0-9]*)$/.exec(competitionId);
 const playerMatches=competitionId.startsWith('player-matches:');
 const playerId=playerKey&&Number.isSafeInteger(Number(playerKey[1]))?Number(playerKey[1]):null;
 if((competitionId!=='world'&&!competitionPattern.test(competitionId)&&!(clubKey&&clubPattern.test(clubKey))&&!(fixturesClubKey&&clubPattern.test(fixturesClubKey))&&!playerId)||!Number.isSafeInteger(selectedSeason)||selectedSeason<1||competitionId==='world'&&(typeof calendarDay!=='number'||!Number.isInteger(calendarDay)||calendarDay<1||calendarDay>56))throw new ApiError(404,'not_found');
 const world=await readWorld(db);
 const base={schemaVersion:1 as const,providerId:'authoritative-world' as const,...(competitionId==='world'?{scope:'calendar' as const,day:calendarDay}:clubKey?{clubKey}:fixturesClubKey?{clubKey:fixturesClubKey}:playerId?{playerId}:{competitionId}),selectedSeason,world};
 const empty=async(status:'empty'|'unavailable',reason:string)=>{
  await unchanged(db,world);
  return {...base,status,reason,provenance:{kind:'none',resultAuthority:null,sourceRef:null},data:null};
 };
 // A future/unimplemented viewed season must never be silently mapped to Season1.
 if(![1,2].includes(selectedSeason))return empty('unavailable','unsupported-season');
 if(world.seasonNumber===0){
  if(selectedSeason!==1||!competitionPattern.test(competitionId))return empty('empty','season-not-prepared');
  const zero=await readSeasonZeroAuthority(db,world);
  const scope=competitionId.startsWith('int-')?'international':'domestic';
  if(!zero.approved[scope])return empty('empty','season-not-prepared');
  const binding=zero.snapshot.bindings.find(b=>b.competitionId===competitionId);
  if(!binding)invalid();
  const data={entrantsOnly:true as const,season:1,seasonState:{day:0,phase:'unstarted' as const},
   rulesVersion:binding!.rulesVersion,participants:[...binding!.clubIds]};
  await unchanged(db,world);
  return {...base,status:'partial' as const,reason:null,
   provenance:{kind:'authoritative' as const,resultAuthority:'confirmed-entrants-v1' as const,
    sourceRef:`world:${world.generation}:season:0:entrants:${scope}:${zero.snapshotHash}`},data};
 }
 // Only seasons1/2 currently have a complete approved authority chain.
 if(![1,2].includes(world.seasonNumber))return empty('unavailable','unsupported-world-season');
 if(selectedSeason>world.seasonNumber)return empty('empty','season-not-prepared');
 const viewedWorld=selectedSeason===world.seasonNumber?world:{...world,seasonNumber:selectedSeason,day:56,phase:'closed' as const};
 try{
  const published=await readSeasonCalendarHash(db,selectedSeason);
  if(!published){
   // Staged fixtures, participant lists and draw outputs remain private until publication.
   const leaked=await countV2Days(db,selectedSeason);
   if(leaked||viewedWorld.day>12||viewedWorld.phase==='closed')invalid();
   if(!competitionPattern.test(competitionId))return await empty('empty','calendar-unpublished');
   const entrants=await confirmedEntrantsBeforeCalendar(db,viewedWorld,competitionId);
   if(!entrants)return await empty('empty','calendar-unpublished');
   const data={entrantsOnly:true as const,season:selectedSeason,
    seasonState:{day:viewedWorld.day,phase:viewedWorld.phase},rulesVersion:entrants.binding.rulesVersion,
    participants:[...entrants.binding.clubIds]};
   await unchanged(db,world);
   return {...base,status:'partial' as const,reason:null,
    provenance:{kind:'authoritative' as const,resultAuthority:'confirmed-entrants-v1' as const,
     sourceRef:`world:${world.generation}:season:${selectedSeason}:entrants:${entrants.participantsHash}`},data};
  }
  const evidence=await loadSeasonSportingEvidence(db,viewedWorld);
  // One verified frozen V2 chain is authoritative for all competitions.
  // Replaying progression does not resimulate a match or consult current rosters.
  const replay=await replayLineupSeasonV1(db,viewedWorld,evidence,viewedWorld.day);
  const {receipts,ties,archive}=await readPublicSeasonReceiptBundle(db,selectedSeason);
  if(receipts.length!==replay.days.length)invalid();
  const state=replay.progression,storedResults=state.results;
  if(ties.length!==state.ties.size)invalid();
  // An archive may be sealed while its season is still active on day 56.
  // History becomes public only after the separate close event receipt.
  if(archive&&viewedWorld.phase!=='closed'&&viewedWorld.day!==56)invalid();
  if(viewedWorld.phase==='closed'){
   if(!archive||viewedWorld.day!==56||archive.generation!==world.generation||archive.calendar_hash!==evidence.calendar.calendar_hash||archive.days_count!==56||archive.results_count!==4082||archive.ties_count!==54||storedResults.size!==4082||ties.length!==54||!Number.isSafeInteger(archive.created_at)||archive.created_at<=0)invalid();
   const resultsHash=await canonicalHash(receipts.map(r=>r.outcome_hash)),knockoutHash=await canonicalHash(ties.map(t=>t.plan_hash));
   const archiveHash=await canonicalHash({schemaVersion:1,season:selectedSeason,generation:world.generation,calendarHash:evidence.calendar.calendar_hash,resultsHash,knockoutHash,resultsCount:4082,daysCount:56,tiesCount:54});
   if(archive.results_hash!==resultsHash||archive.knockout_hash!==knockoutHash||archive.archive_hash!==archiveHash)invalid();
   const summary=await readSeasonArchiveSummary(db,selectedSeason);
   const closure=await readSeasonCloseReceipt(db,selectedSeason);
   if(!summary||summary.generation!==world.generation||summary.archive_hash!==archiveHash||!closure||closure.status!=='completed'||closure.receipt_hash!==archiveHash)invalid();
   if(await canonicalHash(JSON.parse(summary.summary_json))!==summary.summary_hash)invalid();
  }else if(archive){
   if(viewedWorld.day!==56||archive.generation!==world.generation)invalid();
  }
  // #712 shares the exact Stats replay/archive and publication fences.
  // Do not query or re-simulate individual matches for a public listing.
  if(playerId&&playerMatches){
   const metadata=new Map<string,{kind:string;phaseId:string;neutral:boolean;leg:number|null;round:number;marker:string}>();
   for(const fixture of evidence.schedule.fixtures)
    metadata.set(fixture.id,{kind:'league',phaseId:'league',neutral:false,leg:null,round:fixture.round,marker:fixture.marker});
   for(const tie of state.ties.values())for(const entry of tie.fixtures)
    metadata.set(entry.fixture.id,{kind:'knockout',phaseId:tie.phaseId,neutral:entry.neutral,leg:entry.leg,
     round:entry.fixture.round,marker:entry.fixture.marker});
   const matches=collectFrozenPlayerMatches(playerId,selectedSeason,replay.frozenMatches.values(),metadata);
   await unchanged(db,world);
   return {...base,status:viewedWorld.phase==='closed'?'available' as const:'partial' as const,reason:null,
    provenance:{kind:'authoritative' as const,resultAuthority:'temporary-lineup-v1' as const,
     sourceRef:'player-matches:'+world.generation+':season:'+selectedSeason+':'+evidence.calendar.calendar_hash},
    data:{season:selectedSeason,matches}};
  }
  // Player Stats reuses this same verified season/archive replay exactly once.
  // No per-competition or per-match public calls or live-affiliation inference.
  if(playerId){
   const stats=aggregateFrozenPlayerSeasonStats(playerId,replay.frozenMatches.values());
   await unchanged(db,world);
   return {...base,status:viewedWorld.phase==='closed'?'available' as const:'partial' as const,reason:null,
    provenance:{kind:'authoritative' as const,resultAuthority:'temporary-lineup-v1' as const,
     sourceRef:'player-stats:'+world.generation+':season:'+selectedSeason+':'+evidence.calendar.calendar_hash},
    data:{season:selectedSeason,...stats}};
  }
  // Read one validated world and one season evidence set, not a club history
  // request plus a separate full projection for every competition.
  if(fixturesClubKey){
   const affiliations=evidence.snapshot.bindings.filter(b=>b.clubIds.includes(fixturesClubKey));
   const domestic=affiliations.filter(b=>!b.competitionId.startsWith('int-'));
   if((affiliations.length>0&&domestic.length!==1)||affiliations.length>2||
     new Set(affiliations.map(b=>b.competitionId)).size!==affiliations.length)invalid();
   const plans=[...state.ties.values()],competitionIds=new Set(affiliations.map(b=>b.competitionId));
   const all=[...evidence.schedule.fixtures,...plans.flatMap(p=>p.fixtures.map(item=>item.fixture))];
   const fixtures=projectFixtures(all.filter(f=>f.homeClubId===fixturesClubKey||f.awayClubId===fixturesClubKey),
    plans,storedResults).sort((a,b)=>a.day-b.day||a.competitionId.localeCompare(b.competitionId,'en')||
     a.marker.localeCompare(b.marker,'en')||a.id.localeCompare(b.id,'en'));
   if(fixtures.some(f=>!competitionIds.has(f.competitionId)||
     (f.result!==null)!==(f.day<=viewedWorld.day)))invalid();
   if(rosterStats){
    const clubFixtures=all.filter(f=>f.homeClubId===fixturesClubKey||f.awayClubId===fixturesClubKey);
    const {complete,totals}=clubRosterTotals(fixturesClubKey,clubFixtures,storedResults,replay.frozenMatches);
    const breakdown=[...competitionIds].map(id=>({id,...clubRosterTotals(fixturesClubKey,
     clubFixtures.filter(f=>f.competitionId===id),storedResults,replay.frozenMatches)}));
    await unchanged(db,world);
    return {...base,status:'available' as const,data:{complete,totals,breakdown}};
   }
   // Carry persisted public IDs in the verified club response so the client
   // does not download two full public competition match collections.
   const linked=await withOfficialClubMatchIds(db,world.generation,selectedSeason,
    fixturesClubKey,[...competitionIds],fixtures);
   const data={season:selectedSeason,seasonState:{day:viewedWorld.day,phase:viewedWorld.phase},
    competitions:[...competitionIds],fixtures:linked};
   await unchanged(db,world);
   return {...base,status:viewedWorld.phase==='closed'?'available' as const:'partial' as const,reason:null,
    provenance:{kind:'authoritative' as const,resultAuthority:'temporary-lineup-v1' as const,
     sourceRef:'club-fixtures:'+world.generation+':season:'+selectedSeason+':'+evidence.calendar.calendar_hash},data};
  }
  // One validated snapshot/progression reconstructs every current club membership.
  // Avoid four independent full competition projections and their repeated D1 reads.
  if(clubKey){
   const plans=[...state.ties.values()];
   const affiliations=evidence.snapshot.bindings.filter(b=>b.clubIds.includes(clubKey));
   const domestic=affiliations.filter(b=>!b.competitionId.startsWith('int-'));
   if((affiliations.length>0&&domestic.length!==1)||affiliations.length>2||new Set(affiliations.map(b=>b.competitionId)).size!==affiliations.length)invalid();
   const memberships=await Promise.all(affiliations.map(async binding=>{
    const id=binding.competitionId,isInternational=id.startsWith('int-');
    const leagueFixtures=evidence.schedule.fixtures.filter(f=>f.competitionId===id);
    const competitionPlans=plans.filter(p=>p.competitionId===id);
    const table=await rankLeagueTable(id,binding.clubIds,leagueFixtures,storedResults,evidence.schedule.seed,{throughDay:viewedWorld.day});
    const row=table.find(r=>r.clubId===clubKey);if(!row)invalid();
    const future=[...leagueFixtures,...competitionPlans.flatMap(p=>p.fixtures.map(x=>x.fixture))]
     .filter(f=>f.day>viewedWorld.day&&!storedResults.has(f.id)&&(f.homeClubId===clubKey||f.awayClubId===clubKey))
     .sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id,'en'))[0]??null;
    const phase=future?competitionPlans.flatMap(p=>p.fixtures.map(x=>({id:x.fixture.id,phaseId:p.phaseId}))).find(x=>x.id===future.id)?.phaseId??'league':null;
    // Reuse the same verified match receipts already loaded for this overview.
    // Club History needs these match totals; returning them here avoids an
    // additional full /api/competitions/... read for each membership.
    const matchFixtures=[...leagueFixtures,...competitionPlans.flatMap(p=>p.fixtures.map(x=>x.fixture))];
    const verifiedTeam=lineupTeamStatisticsV1(binding.clubIds,matchFixtures,storedResults,replay.frozenMatches).teams.find(t=>t.clubId===clubKey);
    if(!verifiedTeam||verifiedTeam.played<row.played)invalid();
    const stats={played:verifiedTeam.played,won:verifiedTeam.won,drawn:verifiedTeam.drawn,lost:verifiedTeam.lost,
     goalsFor:verifiedTeam.goalsFor,goalsAgainst:verifiedTeam.goalsAgainst,
     goalDifference:verifiedTeam.goalDifference,cleanSheets:verifiedTeam.cleanSheets};
    return {competitionId:id,category:isInternational?'international' as const:'domestic' as const,season:selectedSeason,
     position:row.played?row.rank:null,points:row.points,
     cupStatus:isInternational?deriveInternationalClubStatus(clubKey,row.rank,leagueFixtures.every(f=>storedResults.has(f.id)),competitionPlans,storedResults):null,
     nextMatch:future?{day:future.day,round:future.round,phaseId:phase,homeId:future.homeClubId,awayId:future.awayClubId}:null,
     ...(includeClubRecords&&!isInternational?{leagueGoalsAgainst:row.goalsAgainst}:{}),stats};
   }));
   const clubFixtures=includeClubRecords?[...evidence.schedule.fixtures,...plans.flatMap(p=>p.fixtures.map(x=>x.fixture))]
    .filter(f=>(f.homeClubId===clubKey||f.awayClubId===clubKey)&&storedResults.has(f.id))
    .sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id,'en')):[];
   const neutralFixtures=new Set(plans.flatMap(plan=>plan.fixtures.filter(item=>item.neutral).map(item=>item.fixture.id)));
   const matches=clubFixtures.map(f=>{
    const score=storedResults.get(f.id)!,home=f.homeClubId===clubKey;
    const match=replay.frozenMatches.get(f.id);
    if(!match)return invalid();
    return {matchId:match.matchId,venue:neutralFixtures.has(f.id)?'neutral':home?'home':'away',opponent:home?f.awayClubId:f.homeClubId,scored:home?score.homeGoals:score.awayGoals,
     conceded:home?score.awayGoals:score.homeGoals};
   });
   const roster=includeClubRecords?clubRosterTotals(clubKey,clubFixtures,storedResults,replay.frozenMatches):null;
   const players=roster?.complete?(await competitionPlayerIdentities(db,roster.totals)).map(p=>({
    id:p.playerId,name:p.displayName,appearances:p.appearances,goals:p.goals,assists:p.assists,clean:p.cleanSheets,
    mvpAwards:p.mvpAwards,mvpCoveredAppearances:p.mvpCoveredAppearances
   })):null;
   const data={season:selectedSeason,memberships,...(includeClubRecords?{matches,players}:{})};
   await unchanged(db,world);
   return {...base,status:viewedWorld.phase==='closed'?'available' as const:'partial' as const,reason:null,
    provenance:{kind:'authoritative',resultAuthority:'temporary-lineup-v1',sourceRef:`club:${world.generation}:season:${selectedSeason}:${evidence.calendar.calendar_hash}`},data};
  }
  if(competitionId==='world'){
   const plans=[...state.ties.values()];
   const all=[...evidence.schedule.fixtures,...plans.flatMap(p=>p.fixtures.map(item=>item.fixture))].filter(f=>f.day===calendarDay);
   const canonical=(await import('../../assets/world-calendar-model.js')).default.createSeason(selectedSeason) as {days:{events:{marker:string}[]}[]};
   const priorities=new Map(canonical.days[calendarDay!-1].events.map((e,i)=>[e.marker,i]));
   all.sort((a,b)=>(Number(priorities.get(a.marker))-Number(priorities.get(b.marker)))||a.competitionId.localeCompare(b.competitionId,'en')||a.id.localeCompare(b.id,'en'));
   const data={season:selectedSeason,seasonState:{day:viewedWorld.day,phase:viewedWorld.phase},day:calendarDay,calendarHash:evidence.calendar.calendar_hash,rulesHash:evidence.snapshot.rulesHash,
    competitions:evidence.snapshot.bindings.map(b=>({id:b.competitionId,rulesVersion:b.rulesVersion,clubIds:[...b.clubIds]})),
    fixtures:projectFixtures(all,plans,storedResults)};
   await unchanged(db,world);
   return {...base,status:viewedWorld.phase==='closed'?'available' as const:'partial' as const,reason:null,
    provenance:{kind:'authoritative',resultAuthority:'temporary-lineup-v1',sourceRef:`world:${world.generation}:season:${selectedSeason}:${evidence.calendar.calendar_hash}`},data};
  }
  const binding=evidence.snapshot.bindings.find(b=>b.competitionId===competitionId);if(!binding)invalid();
  const leagueFixtures=evidence.schedule.fixtures.filter(f=>f.competitionId===competitionId);
  const plans=[...state.ties.values()].filter(t=>t.competitionId===competitionId);
  const fixtures=[...leagueFixtures,...plans.flatMap(t=>t.fixtures.map(f=>f.fixture))].sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id,'en'));
  const table=await rankLeagueTable(competitionId,binding.clubIds,leagueFixtures,storedResults,evidence.schedule.seed,{throughDay:viewedWorld.day});
  const standings={complete:leagueFixtures.every(f=>storedResults.has(f.id)),rows:table.map(({drawKey,...row})=>row)};
  const recordedStats=lineupTeamStatisticsV1(binding.clubIds,fixtures,storedResults,replay.frozenMatches);
  const enriched=await competitionPlayerIdentities(db,recordedStats.players);
  const stats={...recordedStats,players:enriched.map((p,i)=>({...p,archivedName:recordedStats.players[i]!.displayName}))};
  const playerCoverage=fixtures.every(f=>{
   if(!storedResults.has(f.id))return true;
   const match=replay.frozenMatches.get(f.id)?.receipt.result as unknown as LineupMatchResultV1|undefined;
   return match?.home.kind==='real_xi'&&match.away.kind==='real_xi';
  });
  const final=fixtures.find(f=>f.marker===(competitionId==='int-1'?'SOVEREIGN-FINAL':'FEDERATION-FINAL'));
  const championClubId=competitionId.startsWith('int-')?(final?storedResults.get(final.id)?.winnerClubId:null):table[0]?.clubId;
  if(archive&&!championClubId)invalid();
  const data={season:selectedSeason,seasonState:{day:viewedWorld.day,phase:viewedWorld.phase},rulesVersion:binding.rulesVersion,participants:[...binding.clubIds],
   playerRecordVersion:1,playerCoverage,fixtures:projectFixtures(fixtures,plans,storedResults),standings,statistics:stats,
   calendar:Array.from({length:56},(_,i)=>({day:i+1,fixtureIds:fixtures.filter(f=>f.day===i+1).map(f=>f.id),played:fixtures.filter(f=>f.day===i+1&&storedResults.has(f.id)).length})),
   history:viewedWorld.phase==='closed'&&archive?{season:selectedSeason,archiveHash:archive.archive_hash,closedAt:archive.created_at,championClubId,playerRecordVersion:1,playerCoverage,finalStandings:standings.rows,statistics:stats}:null};
  await unchanged(db,world);
  return {...base,status:viewedWorld.phase==='closed'?'available' as const:'partial' as const,reason:null,
   provenance:{kind:'authoritative',resultAuthority:'temporary-lineup-v1',sourceRef:`world:${world.generation}:season:${selectedSeason}:${evidence.calendar.calendar_hash}`},data};
 }catch(error){if(error instanceof ApiError&&error.code==='stale_world')throw error;return invalid()}
}

export function readPublicSportingSeasonLineupV1(db:Database,competitionId:string,selectedSeason:number){
 if(!competitionPattern.test(competitionId))throw new ApiError(404,'not_found');
 return readPublicProjection(db,competitionId,selectedSeason);
}
export function readPublicCalendarDayLineupV1(db:Database,selectedSeason:number,day:number){return readPublicProjection(db,'world',selectedSeason,day)}

/** One read-only, canonically validated club-season fixtures response. */
export function readPublicClubFixturesLineupV1(db:Database,clubKey:string,selectedSeason:number){
 if(!clubPattern.test(clubKey))throw new ApiError(404,'not_found');
 return readPublicProjection(db,'club-fixtures:'+clubKey,selectedSeason);
}
export async function readPublicRosterStats(db:Database,clubKey:string,season:number|null){
 const world=await readWorld(db);
 const selectedSeason=season??world.seasonNumber;
 const projection=selectedSeason>0?await readPublicProjection(db,'club-fixtures:'+clubKey,selectedSeason,undefined,true).catch(error=>{
  if(error instanceof ApiError&&error.code==='sporting_data_unavailable')return null;
  throw error;
 }):null;
 const data=projection?.data;
 const complete=data&&'complete' in data?data.complete:
  selectedSeason===0&&world.seasonNumber===0||(projection&&'reason' in projection&&projection.reason==='calendar-unpublished');
 // The standard fixtures projection does not expose roster aggregates.
 // Only the verified stats projection has these optional arrays; keep absent
 // fields separate from recorded zero-valued match statistics.
 const totals=new Map(data&&'totals' in data?(data.totals?.map(p=>[p.playerId,p])??[]):[]);
 const breakdown=data&&'breakdown' in data?(data.breakdown?.map(c=>({
  id:c.id,complete:c.complete,rows:new Map(c.totals.map(p=>[p.playerId,p]))
 }))??[]):[];
 // Preserve nullable event metrics from verified frozen receipts.
 // Missing event coverage must never become a recorded zero.
 function numbers(recorded:boolean,row:ReturnType<typeof clubRosterTotals>['totals'][number]|undefined){
  if(!recorded)return null;
  const appearances=row?.appearances??0,starts=row?.starts??0,minutes=row?.minutes??0,goals=row?.goals??0;
  const assists=row?row.assists:0,subAppearances=row?row.subAppearances:0;
  const cleanSheets=row?row.cleanSheets:0,redCards=row?row.redCards:0,yellowCards=row?row.yellowCards:0;
  const ratedAppearances=row?.ratedAppearances??0,averageRating=row?.averageRating??null;
   const mvpCoveredAppearances=row?.mvpCoveredAppearances??0,mvpAwards=row?row.mvpAwards:0;
  const goalsAssistsPer90=assists!==null&&minutes>0
   ?Math.round((goals+assists)*90/minutes*100)/100:null;
  return {appearances,starts,subAppearances,minutes,goals,assists,cleanSheets,yellowCards,redCards,
   ratedAppearances,averageRating,goalsAssistsPer90,mvpAwards,mvpCoveredAppearances};
 }
 const roster=await readPublicClubRoster(db,clubKey);
 await unchanged(db,world);
 return {...roster,season:selectedSeason,competitions:breakdown.map(c=>c.id),players:roster.players.map(player=>{
  const row=totals.get(player.id);
  const {id,display_name,nationality,primary_position,secondary_positions}=player;
  return {id,display_name,nationality,primary_position,secondary_positions,stats:numbers(!!complete,row),
   competitionStats:Object.fromEntries(breakdown.map(c=>[c.id,numbers(c.complete,c.rows.get(id))]))};
 })};
}
/** Compact, validated club overview: exactly one public HTTP request per selected season. */
export function readPublicClubOverviewLineupV1(db:Database,clubKey:string,selectedSeason:number){
 if(!clubPattern.test(clubKey))throw new ApiError(404,'not_found');
 return readPublicProjection(db,'club:'+clubKey,selectedSeason);
}


/** One read-only HTTP projection for a club's complete supported history.
 * Reuses the same authoritative, per-season receipts and club projections as
 * the public season endpoints; no independent score source or DB writes.
 */
export async function readPublicClubHistoryLineupV1(db:Database,clubKey:string){
 if(!clubPattern.test(clubKey))throw new ApiError(404,'not_found');
 const world=await readWorld(db);
 if(![0,1,2].includes(world.seasonNumber)){
  await unchanged(db,world);
  return {schemaVersion:1 as const,providerId:'authoritative-world' as const,clubKey,world,
   status:'unavailable' as const,reason:'unsupported-world-season',
   provenance:{kind:'none' as const,resultAuthority:null,sourceRef:null},data:null};
 }
 const overviews=await Promise.all(
  Array.from({length:world.seasonNumber},(_,i)=>i+1)
   .map(season=>readPublicProjection(db,'club:'+clubKey,season,undefined,false,true))
 );
 // Do not combine season snapshots across a reset, new generation, or advance.
 if(overviews.some(v=>v.world.generation!==world.generation||
   v.world.revision!==world.revision||v.world.seasonNumber!==world.seasonNumber||
   v.world.day!==world.day||v.world.phase!==world.phase))
  throw new ApiError(409,'stale_world');
 await unchanged(db,world);
 return {schemaVersion:1 as const,providerId:'authoritative-world' as const,clubKey,world,
  status:'available' as const,reason:null,
  provenance:{kind:'authoritative' as const,resultAuthority:'temporary-lineup-v1' as const,
   sourceRef:'club-history:'+world.generation+':revision:'+world.revision},
  data:{overviews}};
}

/** #578 — One batched anonymous, read-only player Stats response.
 * Each verified season replays once; current affiliation never reconstructs history.
 */
export async function readPublicPlayerStatsLineupV1(db:Database,playerId:number){
 if(!Number.isSafeInteger(playerId)||playerId<1)throw new ApiError(422,'invalid_public_request');
 const world=await readWorld(db);
 const exists=await db.prepare('SELECT id FROM generated_players WHERE id=?').bind(playerId).first<{id:number}>();
 if(!exists)throw new ApiError(404,'player_not_found');
 if(![0,1,2].includes(world.seasonNumber)){
  await unchanged(db,world);
  return {schemaVersion:1 as const,providerId:'authoritative-world' as const,playerId,world,
   status:'unavailable' as const,reason:'unsupported-world-season',seasons:[]};
 }
 const seasons=await Promise.all(Array.from({length:world.seasonNumber},(_,i)=>i+1)
  .map(season=>readPublicProjection(db,'player:'+playerId,season)));
 if(seasons.some(item=>item.world.generation!==world.generation||item.world.revision!==world.revision||
   item.world.seasonNumber!==world.seasonNumber||item.world.day!==world.day||item.world.phase!==world.phase))
  throw new ApiError(409,'stale_world');
 await unchanged(db,world);
 return {schemaVersion:1 as const,providerId:'authoritative-world' as const,playerId,world,
  status:world.seasonNumber===0?'empty' as const:'available' as const,reason:world.seasonNumber===0?'season-zero':null,
  seasons:seasons.reverse().map(item=>{
   // Player projections carry authority metadata; roster-only projections do not.
   // Fail closed rather than implying verified coverage for a mismatched scope.
   if(!('reason' in item)||!('provenance' in item))throw new ApiError(503,'sporting_data_unavailable');
   return {season:item.selectedSeason,status:item.status,reason:item.reason,provenance:item.provenance,data:item.data};
  })};
}


/** #712: anonymous batched, verified chronological appearances, capped at 50.
 * Page cursor binds both filters and the same canonical world generation/revision.
 */
export async function readPublicPlayerMatchesLineupV1(
 db:Database,playerId:number,options:{season:'all'|number;competition:string;cursor:string|null;limit:number}
){
 if(!Number.isSafeInteger(playerId)||playerId<1||!options||
  !(options.season==='all'||Number.isSafeInteger(options.season)&&options.season>=1&&options.season<=2)||
  !(options.competition==='all'||competitionPattern.test(options.competition))||
  !Number.isSafeInteger(options.limit)||options.limit<1||options.limit>50||
  !(options.cursor===null||typeof options.cursor==='string'&&options.cursor.length<=512))
  throw new ApiError(422,'invalid_public_request');
 const world=await readWorld(db);
 const exists=await db.prepare('SELECT id FROM generated_players WHERE id=?').bind(playerId).first<{id:number}>();
 if(!exists)throw new ApiError(404,'player_not_found');
 const base={schemaVersion:1 as const,providerId:'authoritative-world' as const,playerId,world};
 if(![0,1,2].includes(world.seasonNumber)){
  await unchanged(db,world);
  return {...base,status:'unavailable' as const,reason:'unsupported-world-season',
   filters:{seasons:[],competitions:[]},items:[],nextCursor:null,total:0};
 }
 if(world.seasonNumber===0){
  await unchanged(db,world);
  return {...base,status:'empty' as const,reason:'season-zero',
   filters:{seasons:[],competitions:[]},items:[],nextCursor:null,total:0};
 }
 const seasons=await Promise.all(Array.from({length:world.seasonNumber},(_,i)=>i+1)
  .map(season=>readPublicProjection(db,'player-matches:'+playerId,season)));
 if(seasons.some(item=>item.world.generation!==world.generation||item.world.revision!==world.revision||
   item.world.seasonNumber!==world.seasonNumber||item.world.day!==world.day||item.world.phase!==world.phase))
  throw new ApiError(409,'stale_world');
 if(seasons.some(item=>item.status==='unavailable')) {
  await unchanged(db,world);
  return {...base,status:'unavailable' as const,reason:'incomplete-evidence',
   filters:{seasons:[],competitions:[]},items:[],nextCursor:null,total:0};
 }
 const matches=seasons.flatMap(item=>{
  const data=item.data as {matches?:ReturnType<typeof collectFrozenPlayerMatches>}|null;
  return data?.matches??[];
 });
 const optionsAvailable={seasons:[...new Set(matches.map(item=>item.season))].sort((a,b)=>b-a),
  competitions:[...new Set(matches.map(item=>item.competitionId))].sort()};
 let page;
 try{page=paginateVerifiedPlayerMatches(matches,world,options)}
 catch(error){
  if(error instanceof RangeError)throw new ApiError(409,'stale_world');
  throw new ApiError(422,'invalid_public_request');
 }
 await unchanged(db,world);
 return {...base,status:page.total?'available' as const:'empty' as const,reason:page.total?null:'no-appearances',
  provenance:{kind:'authoritative' as const,resultAuthority:'temporary-lineup-v1' as const,
   sourceRef:'player-matches:'+world.generation+':revision:'+world.revision},
  filters:optionsAvailable,...page};
}
