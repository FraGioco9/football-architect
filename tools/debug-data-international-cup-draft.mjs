// DEBUG-DATA-01 I02: integrate isolated INT24 league candidate and catalog knockout.
// Unsealed development output only. No public route, D1 binding, or live Debug usage.
import {hash,DEBUG_COUNTRIES} from "./debug-data-schema.mjs";
import {buildInternationalLeagueCandidate} from "./debug-data-international-candidate.mjs";
import {resolveCatalogKnockout} from "./debug-data-knockout.mjs";
import {rankInternationalLeague} from "./debug-data-international-ranking.mjs";
const ensure=(ok,message)=>{if(!ok)throw new Error("DEBUG-DATA-01 international: "+message)};
const COUNTRY_DAYS=[16,19,22,25,28,31];
export function buildInternationalCupDraft({seasonNumber,cupId,participants,seed,datasetId,rules}){
 ensure(["int-1","int-2"].includes(cupId)&&rules?.version==="international-int24-v1","approved INT24 rules required");
 ensure(rules?.phases?.length===5,"all five INT24 phases required");
 const league=buildInternationalLeagueCandidate({seasonNumber,cupId,participants,seed,datasetId});
 ensure(league.events.length===72&&league.events.every(e=>COUNTRY_DAYS.includes(e.day)),"invalid international league calendar");
 const ranking=rankInternationalLeague(participants,league.events,rules.phases[0].tiebreakers);
 const elimination=resolveCatalogKnockout({seasonNumber,competitionId:cupId,rules,rankedClubs:ranking.map(row=>row.clubId),seed});
 ensure(elimination.ties.length===11,"11 INT24 elimination ties required");
 ensure(elimination.events.length===21,"21 knockout legs required");
 const events=[...league.events,...elimination.events].sort((a,b)=>a.day-b.day||a.order-b.order||a.eventId.localeCompare(b.eventId));
 ensure(new Set(events.map(e=>e.eventId)).size===events.length,"duplicate cup event IDs");
 const winners=new Set(elimination.ties.map(t=>t.winner));
 ensure(winners.has(elimination.winner),"cup final winner absent");
 return {schemaVersion:1,kind:"unsealed-international-cup-draft",source:{kind:"debug",namespace:"local-debug",datasetId},seasonNumber,competitionId:cupId,participants:[...participants],pots:league.pots,ranking,leagueEvents:league.events,ties:elimination.ties,events,winner:elimination.winner,contentsHash:hash({events,ranking,winner:elimination.winner}),limitations:["season-wide knockout and holder lineage not yet sealed"]};
}
export function selectCupBaseline(approved,cupId){
 const names=approved.get(cupId);
 ensure(names?.length===24,"approved S1 cup baseline required");
 ensure(DEBUG_COUNTRIES.every(c=>names.filter(id=>id.startsWith(c+"-")).length===3),"cup baseline nationality quota");
 return [...names];
}
