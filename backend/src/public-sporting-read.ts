/** Anonymous, read-only projection of persisted inaugural sporting evidence.
 * Verification reconstructs deterministic expectations; only stored, validated
 * results are projected. Reads never finalize matches or persist repaired data.
 */
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import type {WorldV1} from './types.ts';
import {readWorld} from './world-repository.ts';
import {loadSeasonSportingEvidence} from './season-sporting-evidence.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {sportingDayPayload} from './sporting-day-payload.ts';
import {createProgression,processSportingDay,tieKey,type KnockoutTie} from './knockout-progression.ts';
import {rankLeagueTable} from './league-standings.ts';
import type {TemporaryResult} from './temporary-simulation.ts';
import type {Fixture} from './initial-schedule.ts';
interface Receipt {day:number;generation:string;calendar_hash:string;simulation_version:string;outcome_hash:string;outcome_json:string}
interface Tie {generation:string;competition_id:string;phase_id:string;tie_id:string;plan_hash:string;plan_json:string}
interface Archive {generation:string;calendar_hash:string;results_hash:string;knockout_hash:string;archive_hash:string;results_count:number;days_count:number;ties_count:number;created_at:number}
const competitionPattern=/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/;
function invalid():never{throw new ApiError(503,'sporting_data_unavailable')}
async function unchanged(db:Database,before:WorldV1){
 const after=await readWorld(db);
 if(after.generation!==before.generation||after.revision!==before.revision||after.seasonNumber!==before.seasonNumber||after.day!==before.day||after.phase!==before.phase)throw new ApiError(409,'stale_world');
}
function publicScore(result:TemporaryResult){
 return {homeGoals:result.homeGoals,awayGoals:result.awayGoals,resolution:result.resolution,
  extraTime:result.extraTime?{home:result.extraTime.home,away:result.extraTime.away}:null,
  penalties:result.penalties?{home:result.penalties.home,away:result.penalties.away}:null,winnerClubId:result.winnerClubId};
}
function teamStatistics(clubs:readonly string[],fixtures:readonly Fixture[],results:ReadonlyMap<string,TemporaryResult>){
 const teams=new Map(clubs.map(clubId=>[clubId,{clubId,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,cleanSheets:0}]));
 let matchesPlayed=0,totalGoals=0;
 for(const fixture of fixtures){
  const score=results.get(fixture.id);if(!score)continue;
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
  teams:[...teams.values()].map(t=>({...t,goalDifference:t.goalsFor-t.goalsAgainst})),players:null,playerStatus:'unavailable' as const};
}
function projectFixtures(fixtures:readonly Fixture[],plans:readonly KnockoutTie[],results:ReadonlyMap<string,TemporaryResult>){
 const metadata=new Map(plans.flatMap(plan=>plan.fixtures.map(item=>[item.fixture.id,{phaseId:plan.phaseId,tieId:plan.tieId,leg:item.leg,neutral:item.neutral}] as const)));
 return fixtures.map(f=>({...f,...(metadata.get(f.id)??{phaseId:'league',tieId:null,leg:null,neutral:false}),result:results.has(f.id)?publicScore(results.get(f.id)!):null}));
}
async function readPublicProjection(db:Database,competitionId:string,selectedSeason:number,calendarDay?:number){
 if((competitionId!=='world'&&!competitionPattern.test(competitionId))||!Number.isSafeInteger(selectedSeason)||selectedSeason<1||competitionId==='world'&&(typeof calendarDay!=='number'||!Number.isInteger(calendarDay)||calendarDay<1||calendarDay>56))throw new ApiError(404,'not_found');
 const world=await readWorld(db);
 const base={schemaVersion:1 as const,providerId:'authoritative-world' as const,...(competitionId==='world'?{scope:'calendar' as const,day:calendarDay}:{competitionId}),selectedSeason,world};
 const empty=async(status:'empty'|'unavailable',reason:string)=>{
  await unchanged(db,world);
  return {...base,status,reason,provenance:{kind:'none',resultAuthority:null,sourceRef:null},data:null};
 };
 // A future/unimplemented viewed season must never be silently mapped to Season1.
 if(selectedSeason!==1)return empty('unavailable','unsupported-season');
 if(world.seasonNumber===0)return empty('empty','season-not-prepared');
 // The sporting authority has not yet been generalized to later active seasons.
 if(world.seasonNumber!==1)return empty('unavailable','unsupported-world-season');
 try{
  const published=await db.prepare('SELECT calendar_hash FROM season_calendars WHERE season_number=1').first<{calendar_hash:string}>();
  if(!published){
   // Staged fixtures, participant lists and draw outputs remain private until publication.
   const leaked=(await db.prepare('SELECT count(*) n FROM season_day_outcomes WHERE season_number=1').first<{n:number}>())?.n;
   if(leaked||world.day>12||world.phase==='closed')invalid();
   return await empty('empty','calendar-unpublished');
  }
  const evidence=await loadSeasonSportingEvidence(db,world);
  const receipts=(await db.prepare('SELECT day,generation,calendar_hash,simulation_version,outcome_hash,outcome_json FROM season_day_outcomes WHERE season_number=1 ORDER BY day').all<Receipt>()).results;
  const ties=(await db.prepare('SELECT generation,competition_id,phase_id,tie_id,plan_hash,plan_json FROM season_knockout_ties WHERE season_number=1 ORDER BY competition_id,phase_id,tie_id').all<Tie>()).results;
  if(receipts.length!==world.day)invalid();
  const state=createProgression(evidence.snapshot,evidence.schedule),storedResults=new Map<string,TemporaryResult>();
  for(let i=0;i<receipts.length;i++){
   const row=receipts[i],expectedDay=await processSportingDay(state,i+1);
   const expected=sportingDayPayload(1,world.generation,i+1,evidence.calendar.calendar_hash,expectedDay.results);
   const digest=await canonicalHash(expected),saved=JSON.parse(row.outcome_json) as ReturnType<typeof sportingDayPayload>;
   if(row.day!==i+1||row.generation!==world.generation||row.calendar_hash!==evidence.calendar.calendar_hash||row.simulation_version!=='temporary-score-v1'||row.outcome_hash!==digest||await canonicalHash(saved)!==digest)invalid();
   for(const result of saved.results){if(storedResults.has(result.fixtureId))invalid();storedResults.set(result.fixtureId,result)}
  }
  if(ties.length!==state.ties.size)invalid();
  for(const tie of ties){
   const expected=state.ties.get(tieKey({competitionId:tie.competition_id,phaseId:tie.phase_id,tieId:tie.tie_id}));
   if(!expected||tie.generation!==world.generation||tie.plan_hash!==await canonicalHash(expected)||await canonicalHash(JSON.parse(tie.plan_json))!==tie.plan_hash)invalid();
  }
  const archive=await db.prepare('SELECT * FROM season_archives WHERE season_number=1').first<Archive>();
  if(world.phase==='closed'){
   if(!archive||world.day!==56||archive.generation!==world.generation||archive.calendar_hash!==evidence.calendar.calendar_hash||archive.days_count!==56||archive.results_count!==4082||archive.ties_count!==54||storedResults.size!==4082||ties.length!==54||!Number.isSafeInteger(archive.created_at)||archive.created_at<=0)invalid();
   const resultsHash=await canonicalHash(receipts.map(r=>r.outcome_hash)),knockoutHash=await canonicalHash(ties.map(t=>t.plan_hash));
   const archiveHash=await canonicalHash({schemaVersion:1,season:1,generation:world.generation,calendarHash:evidence.calendar.calendar_hash,resultsHash,knockoutHash,resultsCount:4082,daysCount:56,tiesCount:54});
   if(archive.results_hash!==resultsHash||archive.knockout_hash!==knockoutHash||archive.archive_hash!==archiveHash)invalid();
  }else if(archive)invalid();
  if(competitionId==='world'){
   const plans=[...state.ties.values()];
   const all=[...evidence.schedule.fixtures,...plans.flatMap(p=>p.fixtures.map(item=>item.fixture))].filter(f=>f.day===calendarDay);
   const canonical=(await import('../../assets/world-calendar-model.js')).default.createSeason(1) as {days:{events:{marker:string}[]}[]};
   const priorities=new Map(canonical.days[calendarDay!-1].events.map((e,i)=>[e.marker,i]));
   all.sort((a,b)=>(Number(priorities.get(a.marker))-Number(priorities.get(b.marker)))||a.competitionId.localeCompare(b.competitionId,'en')||a.id.localeCompare(b.id,'en'));
   const data={season:selectedSeason,day:calendarDay,calendarHash:evidence.calendar.calendar_hash,rulesHash:evidence.snapshot.rulesHash,
    competitions:evidence.snapshot.bindings.map(b=>({id:b.competitionId,rulesVersion:b.rulesVersion,clubIds:[...b.clubIds]})),
    fixtures:projectFixtures(all,plans,storedResults)};
   await unchanged(db,world);
   return {...base,status:world.phase==='closed'?'available' as const:'partial' as const,reason:null,
    provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',sourceRef:`world:${world.generation}:season:1:${evidence.calendar.calendar_hash}`},data};
  }
  const binding=evidence.snapshot.bindings.find(b=>b.competitionId===competitionId);if(!binding)invalid();
  const leagueFixtures=evidence.schedule.fixtures.filter(f=>f.competitionId===competitionId);
  const plans=[...state.ties.values()].filter(t=>t.competitionId===competitionId);
  const fixtures=[...leagueFixtures,...plans.flatMap(t=>t.fixtures.map(f=>f.fixture))].sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id,'en'));
  const table=await rankLeagueTable(competitionId,binding.clubIds,leagueFixtures,storedResults,evidence.schedule.seed,{throughDay:world.day});
  const standings={complete:leagueFixtures.every(f=>storedResults.has(f.id)),rows:table.map(({drawKey,...row})=>row)};
  const stats=teamStatistics(binding.clubIds,fixtures,storedResults);
  const final=fixtures.find(f=>f.marker===(competitionId==='int-1'?'SOVEREIGN-FINAL':'FEDERATION-FINAL'));
  const championClubId=competitionId.startsWith('int-')?(final?storedResults.get(final.id)?.winnerClubId:null):table[0]?.clubId;
  if(archive&&!championClubId)invalid();
  const data={season:selectedSeason,rulesVersion:binding.rulesVersion,participants:[...binding.clubIds],
   fixtures:projectFixtures(fixtures,plans,storedResults),standings,statistics:stats,
   calendar:Array.from({length:56},(_,i)=>({day:i+1,fixtureIds:fixtures.filter(f=>f.day===i+1).map(f=>f.id),played:fixtures.filter(f=>f.day===i+1&&storedResults.has(f.id)).length})),
   history:archive?{season:1,archiveHash:archive.archive_hash,closedAt:archive.created_at,championClubId,finalStandings:standings.rows,statistics:stats}:null};
  await unchanged(db,world);
  return {...base,status:world.phase==='closed'?'available' as const:'partial' as const,reason:null,
   provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',sourceRef:`world:${world.generation}:season:1:${evidence.calendar.calendar_hash}`},data};
 }catch(error){if(error instanceof ApiError&&error.code==='stale_world')throw error;return invalid()}
}

export function readPublicSportingSeason(db:Database,competitionId:string,selectedSeason:number){
 if(!competitionPattern.test(competitionId))throw new ApiError(404,'not_found');
 return readPublicProjection(db,competitionId,selectedSeason);
}
export function readPublicCalendarDay(db:Database,selectedSeason:number,day:number){return readPublicProjection(db,'world',selectedSeason,day)}
