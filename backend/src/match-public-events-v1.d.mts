/** #577 typed public projection of frozen V2 recorded match evidence. */
import type {LineupMatchResultV1} from './temporary-lineup-v1.mjs';

export interface PublishedMatchEventV1 {
 ordinal:number;minute:number;period:'regulation'|'extra-time';
 side:'home'|'away';type:'goal'|'pass'|'yellow'|'red'|'substitution'|'role_change';
 playerId:number;
 goalId?:string;assistingPlayerId?:number|null;creation?:string;
 fromPlayerId?:number;toPlayerId?:number;
 secondYellowSequence?:true;reason?:string;
 inPlayerId?:number;outPlayerId?:number;inRole?:string;outRole?:string;
 window?:string;fromRole?:string;toRole?:string;
}
export type PublishedMatchTimelineV1 =
 | {kind:'not_recorded';eventModelVersion:null;events:null}
 | {kind:'recorded';eventModelVersion:'lineup-events-v1';events:PublishedMatchEventV1[]};

export function projectPublishedMatchEventsV1(result:LineupMatchResultV1):PublishedMatchTimelineV1;
