/** #613: read-only Match Detail candidate from ALREADY VERIFIED V2 history.
 * Never consults live affiliations; does not expose unfinished matches.
 * Not wired to a public route until the single-engine cutover is approved.
 */
import {frozenMatchPlayerStatistics,type MatchStatistics} from './match-player-statistics.mjs';
import type {LineupSeasonReplayV1} from './lineup-season-replay.ts';
import type {LineupMatchResultV1} from './temporary-lineup-v1.mjs';

export interface FrozenLineupMatchDetailV1 {
 matchId:string;fixtureId:string;season:number;competitionId:string;day:number;
 homeClubId:string;awayClubId:string;status:'completed';
 result:{homeGoals:number;awayGoals:number;
  regulation:{home:number;away:number};extraTime:{home:number;away:number}|null;
  penalties:{home:number;away:number}|null;winnerClubId:string|null;
  resolution:'regulation'|'extra-time'|'penalties'};
 statistics:MatchStatistics;
 players:{ratingVersion:'test-rating-v1'|null;
  home:{kind:'real_xi'|'team_fallback';starters:Array<{playerId:number;role:string;rating:number|null}>};
  away:{kind:'real_xi'|'team_fallback';starters:Array<{playerId:number;role:string;rating:number|null}>}};
 provenance:{kind:'immutable-lineup-v1';receiptHash:string;algorithmVersion:'temporary-lineup-v1'};
}
type FrozenLineupMatchHeaderV1=Omit<FrozenLineupMatchDetailV1,'statistics'>&{statistics:null};
const fail=():never=>{throw new TypeError('Invalid frozen match detail')};
// Preserve the original two-argument return type for existing v1/v2 consumers.
export function frozenLineupMatchDetailV1(
 replay:LineupSeasonReplayV1,publicMatchId:number
):FrozenLineupMatchDetailV1|null;
export function frozenLineupMatchDetailV1(
 replay:LineupSeasonReplayV1,publicMatchId:number,fixtureId:string
):FrozenLineupMatchDetailV1|null;
export function frozenLineupMatchDetailV1(
 replay:LineupSeasonReplayV1,publicMatchId:number,fixtureId:string,includeStatistics:false
):FrozenLineupMatchHeaderV1|null;
export function frozenLineupMatchDetailV1(
 replay:LineupSeasonReplayV1,publicMatchId:number,fixtureId:string,includeStatistics:boolean
):FrozenLineupMatchDetailV1|FrozenLineupMatchHeaderV1|null;
export function frozenLineupMatchDetailV1(
 replay:LineupSeasonReplayV1,publicMatchId:number,fixtureId?:string,includeStatistics=true
):FrozenLineupMatchDetailV1|FrozenLineupMatchHeaderV1|null{
 if(!Number.isSafeInteger(publicMatchId)||publicMatchId<1)return fail();
 // Public match readers already have the verified fixture ID. The season replay
 // has proved public IDs unique; read its existing fixture index directly.
 // Preserve the legacy ID-only caller contract (including duplicate rejection).
 const records=fixtureId===undefined?[...replay.frozenMatches.values()].filter(r=>r.matchId===publicMatchId):null;
 if(records&&records.length>1)return fail();
 const record=records?records[0]:replay.frozenMatches.get(fixtureId!);
 if(!record)return null; // Scheduled or unpublished: no premature result.
 const fixture=record.receipt.fixture;
 if(record.matchId!==publicMatchId||
    (fixtureId!==undefined&&(record.fixtureId!==fixtureId||fixture.fixtureId!==fixtureId)))return fail();
 const result=record.receipt.result as unknown as LineupMatchResultV1;
 if(fixture.matchId!==publicMatchId||result.algorithmVersion!=='temporary-lineup-v1'||
  !['real_xi','team_fallback'].includes(result.home?.kind)||
  !['real_xi','team_fallback'].includes(result.away?.kind))return fail();
 const side=(team:LineupMatchResultV1['home'])=>{
  if(team.kind==='team_fallback')return {kind:team.kind,starters:[]};
  const v2=result.eventModelVersion==='lineup-events-v1';
  if(!Array.isArray(team.starters)||team.starters.length!==11||
     !Array.isArray(team.appearances)||
     (v2?team.appearances.filter(p=>p.started).length!==11||
       team.appearances.length<11||team.appearances.length>17:
       team.appearances.length!==11))return fail();
  const appearances=new Map(team.appearances.map(p=>[p.playerId,p]));
  if(appearances.size!==team.appearances.length||
     (!v2&&appearances.size!==11)||
     new Set(team.starters.map(p=>p.playerId)).size!==11)return fail();
  const starters=team.starters.map(({playerId,role})=>{
   const appearance=appearances.get(playerId);
   if(!appearance||appearance.started!==true)return fail();
   return {playerId,role,rating:result.ratingVersion==='test-rating-v1'&&
    typeof appearance.rating==='number'?appearance.rating:null};
  });
  return {kind:team.kind,starters};
 };
 const shared:Omit<FrozenLineupMatchDetailV1,'statistics'>={
  matchId:String(publicMatchId),fixtureId:record.fixtureId,
  season:fixture.season as number,competitionId:fixture.competitionId as string,
  day:fixture.day as number,homeClubId:fixture.homeClubId as string,
  awayClubId:fixture.awayClubId as string,status:'completed',
  result:{homeGoals:result.homeGoals,awayGoals:result.awayGoals,
   regulation:result.regulation,extraTime:result.extraTime,penalties:result.penalties,
   winnerClubId:result.winnerClubId,resolution:result.resolution},
  players:{ratingVersion:result.ratingVersion==='test-rating-v1'?'test-rating-v1':null,
   home:side(result.home),away:side(result.away)},
  provenance:{kind:'immutable-lineup-v1',algorithmVersion:'temporary-lineup-v1',
   receiptHash:record.receiptHash}
 };
 return includeStatistics
  ?{...shared,statistics:frozenMatchPlayerStatistics(result)}
  :{...shared,statistics:null};
}
