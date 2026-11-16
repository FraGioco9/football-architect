/** Types for the isolated #613 JavaScript snapshot/receipt planner.
 * No official result pipeline depends on this contract yet.
 */
import type {Database,Statement} from './database.ts';

export interface MatchLineupWorldV1 {
 generation:string;
 revision:number;
 seasonNumber:number;
 day:number;
 phase:'preparing'|'active';
}
export interface MatchLineupPlayerV1 {
 id:number;
 career_status:'active'|'retired';
 primary_position?:string;
 secondary_positions?:string[];
 attributes?:Record<string,number>;
}
export interface MatchLineupFixtureV1 {
 matchId:number;
 season:number;
 day:number;
 fixtureId:string;
 competitionId:string;
 homeClubId:string;
 awayClubId:string;
 sourceHash:string;
}
export type MatchLineupContextV1=
 | {mode:'regulation'}
 | {mode:'single-knockout';neutral?:true}
 | {mode:'second-leg';firstLegHomeGoals:number;firstLegAwayGoals:number};

export interface MatchRostersFrozenV1 {
 homeRoster:MatchLineupPlayerV1[];
 awayRoster:MatchLineupPlayerV1[];
 guards:Statement[];
 playerCount:number;
 sourceDigest:string;
}
export function readFrozenMatchRostersV1(
 db:Database,input:{homeClubId:string;awayClubId:string;world:MatchLineupWorldV1}
):Promise<MatchRostersFrozenV1>;

export type MatchReceiptPlanV1 =
 | {kind:'legacy_fallback';guards:Statement[];sourceDigest:string;writes?:never}
 | {kind:'lineup_candidate';guards:Statement[];writes:Statement[];
    receiptHash:string;sourceDigest:string;receipt:{
      schemaVersion:1;authority:'official';algorithmVersion:'temporary-lineup-v1';
      rosterSourceDigest:string;sourceCandidateDigest:string;
      fixture:Record<string,unknown>;result:Record<string,unknown>;
    }};

export function planMatchSimulationReceiptV1(
 db:Database,input:{
  match:MatchLineupFixtureV1;world:MatchLineupWorldV1;
  seed:string;context:MatchLineupContextV1;now:number
 }
):Promise<MatchReceiptPlanV1>;
