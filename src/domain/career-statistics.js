/** SIM06: strictly opt-in factual stats for official event-driven matches.
 * Reports and archives are derived from one canonical causal session; past
 * matches, offscreen synthetic competitions and legacy saves are not backfilled.
 */
import {deriveMatchStatistics,verifyMatchStatistics} from '../addons/domain/match-statistics.mjs';
import {createStatisticsArchive,recordMatchStatistics,validateStatisticsArchive,aggregateStatistics,fixtureKey} from '../addons/domain/match-statistics-archive.mjs';
export const SIM06_SCHEMA=1;
const fail=code=>{throw Error(`SIM06_CAREER_${code}`)};
export const careerStatisticsEnabled=w=>w?.advancedV1?.statisticsV1?.schemaVersion===SIM06_SCHEMA&&w.advancedV1.statisticsV1.enabled===true;
export function enableCareerStatistics(w){
 if(w?.advancedV1?.enabled!==true)fail('ADVANCED_REQUIRED');
 if(careerStatisticsEnabled(w))return w;
 if(w.advancedV1.statisticsV1!==undefined)fail('UNKNOWN_SCHEMA');
 w.advancedV1.statisticsV1={schemaVersion:SIM06_SCHEMA,enabled:true,archive:createStatisticsArchive()};
 return w;
}
export function recordCareerStatistics(w,session,{matchday=null,fixture,competitionId=`league:${w.countryId}`}={}){
 if(!careerStatisticsEnabled(w))return null;
 if(!fixture||fixture.id!==session.matchId||fixture.result)fail('FIXTURE');
 const report=deriveMatchStatistics(session,{season:w.season,competitionId,matchday});
 if(!report.completed)fail('INCOMPLETE');
 const goals=session.events.filter(e=>e.type==='goal');
 if(goals.length!==report.home.goals+report.away.goals)fail('GOALS');
 // Store snapshots only for the managed club. Other official league fixtures
 // are not retroactively attributed to the human manager; global world
 // competitions may still use independent synthetic simulation.
 if(fixture.home!==w.clubId&&fixture.away!==w.clubId)return null;
 w.advancedV1.statisticsV1.archive=recordMatchStatistics(w.advancedV1.statisticsV1.archive,report);
 return {schemaVersion:1,key:fixtureKey(report),goals:report.goals.length};
}
export function validateCareerStatistics(w){
 const s=w?.advancedV1?.statisticsV1;
 if(s===undefined)return true;
 if(!careerStatisticsEnabled(w))return false;
 try{
  validateStatisticsArchive(s.archive);
  const archiveKeys=new Set(s.archive.matches.map(e=>e.key));
  for(const round of w.fixtures??[])for(const game of round.matches??[]){
   const marker=game.result?.advancedV1?.statistics;
   if(marker&&(marker.schemaVersion!==1||typeof marker.key!=='string'||!archiveKeys.has(marker.key)))return false;
  }
  for(const {report:r} of s.archive.matches){
   verifyMatchStatistics(r);
   if(String(r.competitionId)===`league:${w.countryId}`&&r.season===w.season){
    const games=w.fixtures?.flatMap(d=>d.matches)??[];
    const game=games.find(m=>m.id===r.matchId&&m.home===r.homeTeamId&&m.away===r.awayTeamId);
    if(!game?.result||game.result.homeGoals!==r.home.goals||game.result.awayGoals!==r.away.goals||game.result.advancedV1?.statistics?.key!==fixtureKey(r))return false;
   }
  }
  return true;
 }catch{return false;}
}
export function careerStatisticsReport(w,match,{season=w?.season,competitionId=`league:${w?.countryId}`}={}){
 if(!careerStatisticsEnabled(w)||!match?.result?.advancedV1?.statistics)return null;
 const key=match.result.advancedV1.statistics.key;
 const found=w.advancedV1.statisticsV1.archive.matches.find(e=>e.key===key);
 return found?.report?.season===season&&String(found.report.competitionId)===String(competitionId)?found.report:null;
}
export function careerStatisticsTotals(w,opts={}){
 if(!careerStatisticsEnabled(w))return null;
 return aggregateStatistics(w.advancedV1.statisticsV1.archive,opts);
}
