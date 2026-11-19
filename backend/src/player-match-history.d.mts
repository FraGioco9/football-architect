/** #712 — projection only; callers MUST supply replay/slot/archive verified inputs. */
export interface VerifiedPlayerMatch {
 matchId:string;season:number;competitionId:string;day:number;round:number;marker:string;
 phaseId:string;leg:number|null;side:'home'|'away';venue:'home'|'away'|'neutral';clubId:string;opponentId:string;
 homeClubId:string;awayClubId:string;
 result:{homeGoals:number;awayGoals:number;resolution:'regulation'|'extra-time'|'penalties';
  penalties:{home:number;away:number}|null};
 performance:{started:boolean;minutes:number;positions:string[];goals:number;
  assists:number|null;yellowCards:number|null;redCards:number|null;
  cleanSheets:number|null;rating:number|null;ratingVersion:'test-rating-v1'|null};
}
export interface VerifiedMatchMeta {kind:string;phaseId:string;neutral:boolean;leg:number|null;round:number;marker:string}
export function collectFrozenPlayerMatches(
 playerId:number,season:number,records:Iterable<unknown>,fixtureMeta:Map<string,VerifiedMatchMeta>
):VerifiedPlayerMatch[];
export function paginateVerifiedPlayerMatches(
 items:VerifiedPlayerMatch[],world:{generation:string;revision:number},
 options:{season:'all'|number;competition:string;cursor:string|null;limit:number}
):{items:VerifiedPlayerMatch[];nextCursor:string|null;total:number};
