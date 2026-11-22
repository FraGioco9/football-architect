/** #712: Player match-by-match projection from already verified, immutable receipts.
 * The caller MUST perform the canonical season replay/archive/slot checks first.
 * No current affiliation, roster, inferred events or future fixtures are read here.
 */
import {frozenMatchPlayerStatistics} from './match-player-statistics.mjs';

export function collectFrozenPlayerMatches(playerId,season,frozenMatches,fixtureMeta){
 if(!Number.isSafeInteger(playerId)||playerId<1||!Number.isSafeInteger(season)||season<1||
    !frozenMatches||typeof frozenMatches[Symbol.iterator]!=='function'||!(fixtureMeta instanceof Map))
  throw TypeError('Invalid verified player matches input');
 const items=[],seen=new Set();
 for(const frozen of frozenMatches){
  const fixture=frozen?.receipt?.fixture,result=frozen?.receipt?.result;
  if(!fixture||!result||fixture.season!==season||
     !Number.isSafeInteger(frozen.matchId)||frozen.matchId<1)throw TypeError('Invalid frozen match');
  const home=result.home?.appearances?.filter(p=>p.playerId===playerId)??[];
  const away=result.away?.appearances?.filter(p=>p.playerId===playerId)??[];
  if(!home.length&&!away.length)continue; // Bench-only and fallback never count.
  if(home.length+away.length!==1||seen.has(frozen.matchId))throw TypeError('Duplicate player appearance');
  seen.add(frozen.matchId);
  const side=home.length?'home':'away',appearance=(home.length?home:away)[0];
  if(result[side].kind!=='real_xi')throw TypeError('Unverified player side');
  const meta=fixtureMeta.get(fixture.fixtureId);
  if(!meta||typeof meta.marker!=='string'||!Number.isSafeInteger(meta.round)||
     !['league','knockout'].includes(meta.kind))throw TypeError('Unverified fixture metadata');
  const source=frozenMatchPlayerStatistics(result);
   const player=source[side].players.filter(p=>p.playerId===playerId);
  if(player.length!==1||!Number.isSafeInteger(player[0].minutes)||player[0].minutes<1)
   throw TypeError('Unverified player metrics');
  const stats=player[0],clubId=side==='home'?fixture.homeClubId:fixture.awayClubId;
  const opponentId=side==='home'?fixture.awayClubId:fixture.homeClubId;
  if(typeof clubId!=='string'||typeof opponentId!=='string'||clubId===opponentId||
     !Number.isSafeInteger(fixture.day)||fixture.day<1||fixture.day>56||
     !Number.isSafeInteger(result.homeGoals)||!Number.isSafeInteger(result.awayGoals))
   throw TypeError('Unverified match identity or result');
  const intervals=Array.isArray(appearance.intervals)?appearance.intervals:null;
  const positions=intervals
   ?[...new Set(intervals.map(segment=>segment.role))]
   :typeof stats.role==='string'?[stats.role]:[];
  if(!positions.length||positions.some(role=>typeof role!=='string'||!role))
   throw TypeError('Unverified match roles');
  const penalties=result.penalties===null?null:result.penalties;
  items.push({
   matchId:String(frozen.matchId),season,competitionId:fixture.competitionId,
   day:fixture.day,round:meta.round,marker:meta.marker,phaseId:meta.phaseId,
   leg:meta.leg,side,venue:meta.neutral?'neutral':side,
   clubId,opponentId,homeClubId:fixture.homeClubId,awayClubId:fixture.awayClubId,
   result:{homeGoals:result.homeGoals,awayGoals:result.awayGoals,
    resolution:result.resolution,penalties},
   performance:{started:stats.started,minutes:stats.minutes,
    positions,goals:stats.goals,assists:stats.assists,
    yellowCards:stats.yellowCards,redCards:stats.redCards,
    cleanSheets:stats.cleanSheets,rating:stats.rating,
     mvp:source.mvp.status==='unavailable'?null:
      source.mvp.status==='awarded'&&source.mvp.playerId===playerId&&source.mvp.clubId===clubId,
    ratingVersion:result.ratingVersion==='test-rating-v1'?'test-rating-v1':null}
  });
 }
 return items.sort((a,b)=>b.season-a.season||b.day-a.day||Number(b.matchId)-Number(a.matchId));
}

export function paginateVerifiedPlayerMatches(items,world,{season='all',competition='all',cursor=null,limit=20}={}){
 if(!Array.isArray(items)||!world||!Number.isSafeInteger(limit)||limit<1||limit>100)
  throw TypeError('Invalid pagination input');
 const selected=items.filter(item=>(season==='all'||item.season===season)&&
  (competition==='all'||item.competitionId===competition))
  .sort((a,b)=>b.season-a.season||b.day-a.day||Number(b.matchId)-Number(a.matchId));
 let offset=0;
 if(cursor!==null){
  if(typeof cursor!=='string'||cursor.length>512)throw TypeError('Invalid match cursor');
  let value;try{value=JSON.parse(cursor)}catch{throw TypeError('Invalid match cursor')}
  if(!value||typeof value!=='object'||Array.isArray(value)||
     Object.keys(value).sort().join(',')!=='competition,generation,matchId,revision,season'||
     value.generation!==world.generation||value.revision!==world.revision)
   throw RangeError('Stale player matches cursor');
  if(value.season!==season||value.competition!==competition)
   throw TypeError('Cursor filter mismatch');
  const index=selected.findIndex(item=>item.matchId===value.matchId);
  if(index<0)throw TypeError('Unknown player match cursor');
  offset=index+1;
 }
 const page=selected.slice(offset,offset+limit),last=page.at(-1);
 return {items:page,nextCursor:last&&offset+limit<selected.length?
  JSON.stringify({generation:world.generation,revision:world.revision,
   season,competition,matchId:last.matchId}):null,total:selected.length};
}
