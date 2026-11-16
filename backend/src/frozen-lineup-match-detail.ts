/** #613: read-only Match Detail candidate from ALREADY VERIFIED V2 history.
 * Never consults live affiliations; does not expose unfinished matches.
 * Not wired to a public route until the single-engine cutover is approved.
 */
import type {LineupSeasonReplayV1} from './lineup-season-replay.ts';
import type {LineupMatchResultV1} from './temporary-lineup-v1.mjs';

export interface FrozenLineupMatchDetailV1 {
 matchId:string;fixtureId:string;season:number;competitionId:string;day:number;
 homeClubId:string;awayClubId:string;status:'completed';
 result:{homeGoals:number;awayGoals:number;
  regulation:{home:number;away:number};extraTime:{home:number;away:number}|null;
  penalties:{home:number;away:number}|null;winnerClubId:string|null;
  resolution:'regulation'|'extra-time'|'penalties'};
 players:{ratingVersion:'test-rating-v1'|null;
  home:{kind:string;starters:unknown[];appearances:Array<{playerId:number;started:true;minutes:number;goals:number;rating:number|null}>};
  away:{kind:string;starters:unknown[];appearances:Array<{playerId:number;started:true;minutes:number;goals:number;rating:number|null}>}};
 events:LineupMatchResultV1['events'];
 provenance:{kind:'immutable-lineup-v1';receiptHash:string;algorithmVersion:'temporary-lineup-v1'};
}
const fail=():never=>{throw new TypeError('Invalid frozen match detail')};
export function frozenLineupMatchDetailV1(
 replay:LineupSeasonReplayV1,publicMatchId:number
):FrozenLineupMatchDetailV1|null{
 if(!Number.isSafeInteger(publicMatchId)||publicMatchId<1)return fail();
 const records=[...replay.frozenMatches.values()].filter(r=>r.matchId===publicMatchId);
 if(records.length>1)return fail();
 if(records.length===0)return null; // Scheduled or unpublished: no premature result.
 const record=records[0],fixture=record.receipt.fixture;
 const result=record.receipt.result as unknown as LineupMatchResultV1;
 if(fixture.matchId!==publicMatchId||result.algorithmVersion!=='temporary-lineup-v1'||
  !['real_xi','team_fallback'].includes(result.home?.kind)||
  !['real_xi','team_fallback'].includes(result.away?.kind))return fail();
 const side=(team:LineupMatchResultV1['home'])=>({
  kind:team.kind,
  starters:team.starters?.map(({playerId,role,emergencyGoalkeeper})=>({
   playerId,role,emergencyGoalkeeper
  }))??[],
  appearances:team.appearances.map(({playerId,started,minutes,goals,rating})=>({
   playerId,started,minutes,goals,
   rating:result.ratingVersion==='test-rating-v1'&&typeof rating==='number'?rating:null
  }))
 });
 return {
  matchId:String(publicMatchId),fixtureId:record.fixtureId,
  season:fixture.season as number,competitionId:fixture.competitionId as string,
  day:fixture.day as number,homeClubId:fixture.homeClubId as string,
  awayClubId:fixture.awayClubId as string,status:'completed',
  result:{homeGoals:result.homeGoals,awayGoals:result.awayGoals,
   regulation:result.regulation,extraTime:result.extraTime,penalties:result.penalties,
   winnerClubId:result.winnerClubId,resolution:result.resolution},
  players:{ratingVersion:result.ratingVersion==='test-rating-v1'?'test-rating-v1':null,
   home:side(result.home),away:side(result.away)},
  events:result.events.map(({type,minute,side,playerId,period})=>({
   type,minute,side,playerId,period
  })),
  provenance:{kind:'immutable-lineup-v1',algorithmVersion:'temporary-lineup-v1',
   receiptHash:record.receiptHash}
 };
}
