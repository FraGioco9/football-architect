// DEBUG-DATA-01 I02: integrate isolated INT24 league candidate and catalog knockout.
// Unsealed development output only. No public route, D1 binding, or live Debug usage.
import {hash,DEBUG_COUNTRIES} from "./debug-data-schema.mjs";
import {buildInternationalLeagueCandidate} from "./debug-data-international-candidate.mjs";
import {resolveCatalogKnockout} from "./debug-data-knockout.mjs";
const ensure=(ok,message)=>{if(!ok)throw new Error("DEBUG-DATA-01 international: "+message)};
const COUNTRY_DAYS=[16,19,22,25,28,31];
function rankLeague(participants,events){
 const table=new Map(participants.map(clubId=>[clubId,{clubId,played:0,wins:0,draws:0,losses:0,points:0,goalsFor:0,goalsAgainst:0,awayGoals:0,awayWins:0}]));
 for(const e of events){
  const h=table.get(e.homeId),a=table.get(e.awayId);
  ensure(h&&a&&e.result,"unknown participant/score");
  h.played++;a.played++;h.goalsFor+=e.result.homeGoals;h.goalsAgainst+=e.result.awayGoals;
  a.goalsFor+=e.result.awayGoals;a.goalsAgainst+=e.result.homeGoals;a.awayGoals+=e.result.awayGoals;
  if(e.result.homeGoals>e.result.awayGoals){h.wins++;a.losses++;h.points+=3}
  else if(e.result.homeGoals<e.result.awayGoals){a.wins++;a.awayWins++;h.losses++;a.points+=3}
  else {h.draws++;a.draws++;h.points++;a.points++}
 }
 ensure([...table.values()].every(t=>t.played===6),"six games per club required");
 const rows=[...table.values()];
 rows.sort((a,b)=>b.points-a.points||(b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst)||b.goalsFor-a.goalsFor||b.wins-a.wins||b.awayGoals-a.awayGoals||b.awayWins-a.awayWins||a.clubId.localeCompare(b.clubId));
 // Provisional rankings; full approved opponents-strength tiebreakers remain an I02 blocker.
 return rows;
}
export function buildInternationalCupDraft({seasonNumber,cupId,participants,seed,datasetId,rules}){
 ensure(["int-1","int-2"].includes(cupId)&&rules?.version==="international-int24-v1","approved INT24 rules required");
 ensure(rules?.phases?.length===5,"all five INT24 phases required");
 const league=buildInternationalLeagueCandidate({seasonNumber,cupId,participants,seed,datasetId});
 ensure(league.events.length===72&&league.events.every(e=>COUNTRY_DAYS.includes(e.day)),"invalid international league calendar");
 const ranking=rankLeague(participants,league.events);
 const elimination=resolveCatalogKnockout({seasonNumber,competitionId:cupId,rules,rankedClubs:ranking.map(row=>row.clubId),seed});
 ensure(elimination.ties.length===11,"11 INT24 elimination ties required");
 ensure(elimination.events.length===19,"19 knockout legs required");
 const events=[...league.events,...elimination.events].sort((a,b)=>a.day-b.day||a.order-b.order||a.eventId.localeCompare(b.eventId));
 ensure(new Set(events.map(e=>e.eventId)).size===events.length,"duplicate cup event IDs");
 const winners=new Set(elimination.ties.map(t=>t.winner));
 ensure(winners.has(elimination.winner),"cup final winner absent");
 return {schemaVersion:1,kind:"unsealed-international-cup-draft",source:{kind:"debug",namespace:"local-debug",datasetId},seasonNumber,competitionId:cupId,participants:[...participants],ranking,leagueEvents:league.events,ties:elimination.ties,events,winner:elimination.winner,contentsHash:hash({events,ranking,winner:elimination.winner}),limitations:["pot constraints unverified","holder allocation unverified","complete ranking tiebreakers pending"]};
}
export function selectCupBaseline(approved,cupId){
 const names=approved.get(cupId);
 ensure(names?.length===24,"approved S1 cup baseline required");
 ensure(DEBUG_COUNTRIES.every(c=>names.filter(id=>id.startsWith(c+"-")).length===3),"cup baseline nationality quota");
 return [...names];
}
