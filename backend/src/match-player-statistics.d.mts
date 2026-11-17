import type {LineupMatchResultV1} from './temporary-lineup-v1.mjs';
export interface MatchPlayerStatistics {
 playerId:number;name:string|null;nationality:string|null;role:string;started:boolean;
 minutes:number;goals:number;assists:null;redCards:null;cleanSheets:number|null;rating:number|null;
}
export interface MatchStatistics {
 ratingVersion:'test-rating-v1'|null;
 home:{kind:'real_xi'|'team_fallback';unattributedGoals:number;players:MatchPlayerStatistics[]};
 away:{kind:'real_xi'|'team_fallback';unattributedGoals:number;players:MatchPlayerStatistics[]};
 events:Array<{type:'goal';minute:number;period:'regulation'|'extra-time';side:'home'|'away';playerId:number;name:string|null;nationality:string|null}>;
}
export function frozenMatchPlayerStatistics(result:LineupMatchResultV1):MatchStatistics;
