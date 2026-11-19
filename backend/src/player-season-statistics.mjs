/** #578 — Pure aggregation of already-verified immutable player appearances.
 * No live club affiliations, simulation, or inferred legacy events.
 */
import {frozenMatchPlayerStatistics} from './match-player-statistics.mjs';
const metrics=['subAppearances','assists','yellowCards','redCards'];
const empty=()=>({appearances:0,starts:0,minutes:0,goals:0,gkAppearances:0,cleanSheets:0,
 keeperCoverage:true,ratingSum:0,ratedAppearances:0,mvpAwards:0,mvpCoveredAppearances:0,
 counters:{subAppearances:0,assists:0,yellowCards:0,redCards:0},
 coverage:{subAppearances:true,assists:true,yellowCards:true,redCards:true}});
function add(t,p,mvp,clubId){
 if(!Number.isSafeInteger(p.playerId)||p.playerId<1||typeof p.started!=='boolean'||
  !Number.isSafeInteger(p.minutes)||p.minutes<1||p.minutes>120||
  !Number.isSafeInteger(p.goals)||p.goals<0)throw TypeError('Invalid recorded player appearance');
 t.appearances++;if(p.started)t.starts++;
 if(mvp.status!=='unavailable'){
  t.mvpCoveredAppearances++;
  if(mvp.status==='awarded'&&mvp.playerId===p.playerId){
   if(mvp.clubId!==clubId)throw TypeError('Invalid frozen MVP club attribution');
   t.mvpAwards++;
  }
 }
 t.minutes+=p.minutes;t.goals+=p.goals;
 for(const key of metrics){
  if(p[key]===null){t.coverage[key]=false;continue;}
  if(!Number.isSafeInteger(p[key])||p[key]<0)throw TypeError('Invalid recorded player counter');
  t.counters[key]+=p[key];
 }
 if(p.role==='GK'||p.cleanSheets!==null){
  t.gkAppearances++;
  if(p.cleanSheets===null)t.keeperCoverage=false;
  else if(p.cleanSheets===0||p.cleanSheets===1)t.cleanSheets+=p.cleanSheets;
  else throw TypeError('Invalid keeper clean sheet');
 }
 if(p.rating!==null){
  if(typeof p.rating!=='number'||!Number.isFinite(p.rating)||p.rating<4||p.rating>10)
   throw TypeError('Invalid frozen test rating');
  t.ratingSum+=p.rating;t.ratedAppearances++;
 }
}
function finish(t){
 return {appearances:t.appearances,starts:t.starts,
  subAppearances:t.coverage.subAppearances?t.counters.subAppearances:null,
  minutes:t.minutes,goals:t.goals,
  assists:t.coverage.assists?t.counters.assists:null,
  yellowCards:t.coverage.yellowCards?t.counters.yellowCards:null,
  redCards:t.coverage.redCards?t.counters.redCards:null,
  gkAppearances:t.gkAppearances,
  cleanSheets:t.gkAppearances&&t.keeperCoverage?t.cleanSheets:null,
  mvpCoveredAppearances:t.mvpCoveredAppearances,
   mvpAwards:t.mvpCoveredAppearances===t.appearances?t.mvpAwards:null,
   ratedAppearances:t.ratedAppearances,
  averageRating:t.ratedAppearances?Math.round(t.ratingSum/t.ratedAppearances*100)/100:null};
}
/** Replayed records must already have passed the canonical receipt/slot/archive checks.
 * Each player/fixture contributes exactly once and keeps its recorded club identity.
 */
export function aggregateFrozenPlayerSeasonStats(playerId,frozenMatches){
 if(!Number.isSafeInteger(playerId)||playerId<1||!frozenMatches||typeof frozenMatches[Symbol.iterator]!=='function')
  throw TypeError('Invalid player season aggregation');
 const total=empty(),groups=new Map(),matches=new Set();
 for(const frozen of frozenMatches){
  const fixture=frozen?.receipt?.fixture,result=frozen?.receipt?.result;
  if(!fixture||!result||!Number.isSafeInteger(frozen.matchId)||frozen.matchId<1)
   throw TypeError('Invalid verified match');
  const home=result.home?.appearances?.some(p=>p.playerId===playerId)??false;
  const away=result.away?.appearances?.some(p=>p.playerId===playerId)??false;
  if(!home&&!away)continue;
  if(home&&away||matches.has(frozen.matchId))throw TypeError('Duplicate player participation');
  matches.add(frozen.matchId);
  const side=home?'home':'away';
  if(result[side]?.kind!=='real_xi')throw TypeError('Fallback player attribution');
  const clubId=side==='home'?fixture.homeClubId:fixture.awayClubId;
  const competitionId=fixture.competitionId;
  if(typeof clubId!=='string'||typeof competitionId!=='string')throw TypeError('Invalid match affiliation');
  const source=frozenMatchPlayerStatistics(result);
   const recorded=source[side].players.filter(p=>p.playerId===playerId);
  if(recorded.length!==1)throw TypeError('Invalid frozen player attribution');
  const key=competitionId+'\u0000'+clubId,group=groups.get(key)??{competitionId,clubId,counts:empty()};
  add(group.counts,recorded[0],source.mvp,clubId);
   add(total,recorded[0],source.mvp,clubId);groups.set(key,group);
 }
 return {total:finish(total),competitions:[...groups.values()]
  // Domestic competitions precede international cups regardless of locale
  // casing/collation (IT-1 vs int-1); ties remain deterministic.
  .sort((a,b)=>Number(a.competitionId.startsWith('int-'))-Number(b.competitionId.startsWith('int-'))||
   a.competitionId.localeCompare(b.competitionId,'en')||a.clubId.localeCompare(b.clubId,'en'))
  .map(({competitionId,clubId,counts})=>({competitionId,clubId,...finish(counts)}))};
}
