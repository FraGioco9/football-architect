import type {LineupMatchResultV1} from './temporary-lineup-v1.mjs';
export interface MatchPlayerStatistics {
 playerId:number;name:string|null;nationality:string|null;role:string;started:boolean;
 subAppearances:number|null;minutes:number;goals:number;assists:number|null;
 redCards:number|null;cleanSheets:number|null;rating:number|null;
}
export interface MatchStatistics {
 eventModelVersion:'lineup-events-v1'|null;
 ratingVersion:'test-rating-v1'|null;
 home:{kind:'real_xi'|'team_fallback';unattributedGoals:number;players:MatchPlayerStatistics[]};
 away:{kind:'real_xi'|'team_fallback';unattributedGoals:number;players:MatchPlayerStatistics[]};
 events:Array<{type:string;minute:number;period:'regulation'|'extra-time';side:'home'|'away';
  playerId:number;name:string|null;nationality:string|null;ordinal?:number;
  goalId?:string|null;assistingPlayerId?:number|null;assistingName?:string|null;
  creation?:string|null;reason?:string|null;fromPlayerId?:number|null;
  toPlayerId?:number|null;outPlayerId?:number|null;inPlayerId?:number|null;
  fromRole?:string|null;toRole?:string|null;outRole?:string|null;inRole?:string|null}>;
}
export function frozenMatchPlayerStatistics(result:LineupMatchResultV1):MatchStatistics;
