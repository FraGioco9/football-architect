/** SIM06.04: immutable, idempotent per-match archives. No career/storage side effects. */
import {verifyMatchStatistics} from './match-statistics.mjs';
export const MATCH_STATISTICS_ARCHIVE_SCHEMA=1;
const fail=(code)=>{throw Error(`SIM06_ARCHIVE_${code}`)};
const yes=(v,code)=>{if(!v)fail(code)};
const clone=x=>structuredClone(x);
const hash=(txt)=>{let x=2166136261;for(let i=0;i<txt.length;i++)x=Math.imul(x^txt.charCodeAt(i),16777619)>>>0;return x.toString(16).padStart(8,'0');};
export const fixtureKey=report=>JSON.stringify([report.season,String(report.competitionId),String(report.matchId)]);
const checksum=report=>'fnv1a-'+hash(JSON.stringify(report)); // corruption detection only, NOT a signature
export function createStatisticsArchive(){return {schemaVersion:MATCH_STATISTICS_ARCHIVE_SCHEMA,matches:[]};}
export function validateStatisticsArchive(archive){
 yes(archive&&archive.schemaVersion===MATCH_STATISTICS_ARCHIVE_SCHEMA&&Array.isArray(archive.matches)&&archive.matches.length<=10000,'SCHEMA');
 const keys=new Set();
 for(const entry of archive.matches){
  yes(entry&&typeof entry.key==='string'&&entry.report&&typeof entry.checksum==='string','ENTRY');
  verifyMatchStatistics(entry.report);
  yes(entry.report.completed&&entry.key===fixtureKey(entry.report)&&entry.checksum===checksum(entry.report),'ENTRY_INTEGRITY');
  yes(!keys.has(entry.key),'DUPLICATE');keys.add(entry.key);
 }
 return true;
}
/** Returns new archive; re-adding the same snapshot is an exact no-op.
 * A changed match at the same identity is rejected, never silently double-booked. */
export function recordMatchStatistics(archive,report){
 validateStatisticsArchive(archive);
 verifyMatchStatistics(report);yes(report.completed&&report.cursor===180,'INCOMPLETE');
 const key=fixtureKey(report),entry=archive.matches.find(e=>e.key===key);
 if(entry){if(JSON.stringify(entry.report)===JSON.stringify(report))return clone(archive);fail('CONFLICT');}
 yes(archive.matches.length<10000,'CAPACITY');
 const next=clone(archive);next.matches.push({key,checksum:checksum(report),report:clone(report)});
 next.matches.sort((a,b)=>a.key.localeCompare(b.key));
 return next;
}
export function restoreStatisticsArchive(input){
 const data=typeof input==='string'?JSON.parse(input):clone(input);
 validateStatisticsArchive(data);return data;
}
const freshTeam=(id,season=null,competitionId=null)=>({teamId:id,season,competitionId,matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,
 shots:0,shotsOnTargetMinimum:0,unknownShots:0,unknownPasses:0,xg:0,passes:0,completedPasses:0,recoveries:0,fouls:0,yellowCards:0,redCards:0,possessions:0});
const freshPlayer=(id,teamId)=>({playerId:id,teamId,matches:0,goals:0,shots:0,shotsOnTargetMinimum:0,unknownShots:0,unknownPasses:0,xg:0,passes:0,completedPasses:0,
 recoveries:0,fouls:0,yellowCards:0,redCards:0,duels:0,duelsWon:0,touchesObserved:0,minutes:0,minutesCoverage:0});
const sum=(s,r)=>{
 const keys=['goals','shots','shotsOnTargetMinimum','passes','completedPasses','recoveries','fouls','yellowCards','redCards'];
 for(const k of keys)s[k==='goals'?'goalsFor':k]=(s[k==='goals'?'goalsFor':k]??0)+r[k];
 s.unknownShots+=r.unclassifiedShots;s.unknownPasses+=r.unclassifiedPasses;s.possessions+=r.possessions;s.xg=Number((s.xg+r.xg).toFixed(3));
};
const group=x=>JSON.stringify(x.map(String));
/** Scans compact snapshots; never trusts mutable precomputed totals. Cup and future leagues are separate. */
export function aggregateStatistics(archive,{season=null,competitionId=null}={}){
 validateStatisticsArchive(archive);
 if(season!==null)yes(Number.isSafeInteger(season)&&season>0,'SEASON');
 if(competitionId!==null)yes(typeof competitionId==='string'&&competitionId.trim().length>0,'COMPETITION');
 const teams=new Map(),players=new Map();let matched=0;
 for(const {report:r} of archive.matches){
  if(season!==null&&r.season!==season||competitionId!==null&&String(r.competitionId)!==String(competitionId))continue;
  matched++;
  for(const side of ['home','away']){
   const id=side==='home'?r.homeTeamId:r.awayTeamId;
   const k=group([r.season,r.competitionId,id]);
   const row=teams.get(k)??freshTeam(id,r.season,r.competitionId);
   const ours=r[side],other=r[side==='home'?'away':'home'];
   row.matches++;row.goalsAgainst+=other.goals;
   if(ours.goals>other.goals)row.wins++;else if(ours.goals<other.goals)row.losses++;else row.draws++;
   sum(row,ours);teams.set(k,row);
  }
  for(const p of r.players){
   const k=group([r.season,r.competitionId,p.teamId,p.playerId]);
   const row=players.get(k)??freshPlayer(p.playerId,p.teamId);
   // Bench players with zero actions and zero minutes are not credited appearances.
   const participated=p.minutes!==null?p.minutes>0:p.touchesObserved>0;
   if(!participated)continue;
   row.matches++;
   for(const field of ['goals','shots','shotsOnTargetMinimum','passes','completedPasses','recoveries','fouls','yellowCards','redCards','duels','duelsWon','touchesObserved'])row[field]+=p[field];
   row.unknownShots+=p.unclassifiedShots;row.unknownPasses+=p.unclassifiedPasses;row.xg=Number((row.xg+p.xg).toFixed(3));
   if(p.minutes!==null){row.minutes=Number((row.minutes+p.minutes).toFixed(2));row.minutesCoverage++;}
   players.set(k,row);
  }
 }
 return {matches:matched,teams:[...teams.values()].sort((a,b)=>String(a.teamId).localeCompare(String(b.teamId))||a.season-b.season),
  players:[...players.values()].sort((a,b)=>String(a.playerId).localeCompare(String(b.playerId),undefined,{numeric:true}))};
}
