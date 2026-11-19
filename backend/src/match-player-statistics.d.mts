import type {LineupMatchResultV1} from './temporary-lineup-v1.mjs';
export interface MatchPlayerStatistics {
 playerId:number;name:string|null;nationality:string|null;role:string;started:boolean;
 subAppearances:number|null;minutes:number;goals:number;assists:number|null;
 yellowCards:number|null;redCards:number|null;cleanSheets:number|null;rating:number|null;
}
export interface MatchStatistics {
 mvp:import('./match-mvp-v1.mjs').MatchMvpProjectionV1;
 ratingVersion:'test-rating-v1'|null;
 home:{kind:'real_xi'|'team_fallback';unattributedGoals:number;players:MatchPlayerStatistics[]};
 away:{kind:'real_xi'|'team_fallback';unattributedGoals:number;players:MatchPlayerStatistics[]};
}
export function frozenMatchPlayerStatistics(result:LineupMatchResultV1):MatchStatistics;
