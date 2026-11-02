// I05 protected Stats presenter: opt-in DEV-only bridge to the existing
// faCompetitionStats.mount/update API. Never auto-imported into public pages.
import {attachProtectedPresenter} from "./dev-protected-page-bridge.mjs";
const numeric=(x)=>Number.isFinite(x)?x:0;
function summarize(payload){
 const clubs=new Map(payload.clubs.map(c=>[c.canonicalId,c]));
 const played=[...payload.fixtures].sort((a,b)=>a.day-b.day||a.order-b.order||a.eventId.localeCompare(b.eventId));
 const metrics=new Map(payload.teams.map(row=>[row.clubId,{cs:0,streak:0}]));
 for(const game of played){
  for(const [id,goalsFor,goalsAgainst] of [
   [game.homeId,game.result.homeGoals,game.result.awayGoals],
   [game.awayId,game.result.awayGoals,game.result.homeGoals]]){
   const metric=metrics.get(id);
   if(!metric)throw Error("I05 Stats unknown played club");
   if(goalsAgainst===0)metric.cs++;
   metric.streak=goalsFor>=goalsAgainst?metric.streak+1:0;
  }
 }
 return payload.teams.map(row=>{
  const club=clubs.get(row.clubId),metric=metrics.get(row.clubId);
  if(!club||!metric)throw Error("I05 Stats missing canonical club");
  return {clubKey:row.clubId,clubName:club.primaryName||club.fullName||row.clubId,
   mp:row.played,w:numeric(row.wins),gf:numeric(row.goalsFor),ga:numeric(row.goalsAgainst),
   gd:numeric(row.goalDifference),cs:metric.cs,unbeatenStreak:metric.streak,
   ppg:row.played?numeric(row.points)/row.played:0};
 });
}
export function attachProtectedStatsPresenter({panel,definition,baseContext}){
 if(!panel||typeof baseContext!=="function"||!definition?.id)return ()=>{};
 return attachProtectedPresenter({
  kind:"stats",
  prepare(payload,{revision,cursor}){
   if(cursor.competitionId!==definition.id)throw Error("I05 Stats route mismatch");
   const original=baseContext();
   if(!original||!window.faCompetitionStats?.mount)throw Error("I05 Stats renderer unavailable");
   const teams=summarize(payload);
   const matches=Math.floor(teams.reduce((s,r)=>s+r.mp,0)/2);
   const goals=teams.reduce((s,r)=>s+r.gf,0);
   const participants=teams.map(r=>({countryId:r.clubKey.split("-")[0],clubId:Number(r.clubKey.split("-")[1])}));
   const context={...original,revision,definition,selectedSeason:cursor.seasonNumber,
    seasonData:{season:cursor.seasonNumber,rulesVersion:definition.rules?.version,
     participants,provenance:{kind:"debug",namespace:"local-debug",datasetId:payload.source.datasetId},
     status:"partial",statistics:{overview:{matchesPlayed:matches,totalGoals:goals,goalsPerMatch:matches?goals/matches:0},
      teams,players:[]}}};
   return {context,original};
  },
  commit(tx){tx.api=window.faCompetitionStats.mount(panel,tx.context)},
  rollback(tx){if(tx.api&&tx.original)tx.api.update(tx.original)}
 });
}
