import type {LineupMatchResultV1} from './temporary-lineup-v1.mjs';
export const MATCH_MVP_VERSION:'match-mvp-v1';
export type FrozenMatchMvpV1=
 | {status:'awarded';playerId:number;clubId:string;side:'home'|'away';rating:number}
 | {status:'none'};
export type MatchMvpProjectionV1=FrozenMatchMvpV1|{status:'unavailable'};
export function deriveMatchMvpV1(result:LineupMatchResultV1):FrozenMatchMvpV1;
export function sealMatchMvpV1(result:LineupMatchResultV1):LineupMatchResultV1;
export function validateMatchMvpV1(result:LineupMatchResultV1):void;
export function frozenMatchMvpV1(result:LineupMatchResultV1):MatchMvpProjectionV1;
