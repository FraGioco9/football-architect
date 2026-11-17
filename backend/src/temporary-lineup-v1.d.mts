/** Strict typings for #613 single-lineup result module, server-only. */
export const TEST_RATING_VERSION:'test-rating-v1';
export interface LineupFootballerV1 {
 id:number;career_status:'active'|'retired';
 primary_position?:string;secondary_positions?:string[];
 attributes?:Record<string,number>;
}
export type LineupMatchContextV1=
 | {mode:'regulation'}
 | {mode:'single-knockout';neutral?:true}
 | {mode:'second-leg';firstLegHomeGoals:number;firstLegAwayGoals:number};
export interface LineupSideV1 {
 kind:'real_xi'|'team_fallback';strength:number;
 starters:null|Array<{playerId:number;role:string;suitability:number;
  emergencyGoalkeeper:boolean;attributes:Record<string,number>;
  primaryPosition:string;secondaryPositions:string[]}>;
 unattributedGoals:number;
 appearances:Array<{playerId:number;started:true;minutes:90|120;goals:number;rating?:number}>;
}
export interface LineupMatchResultV1 {
 algorithmVersion:'temporary-lineup-v1';
 /** Absent on existing frozen pre-rating V2 receipts, never silently backfilled. */
 ratingVersion?:'test-rating-v1';
 playerIdentityVersion?:'player-identity-v1';
 playerIdentities?:Array<{playerId:number;name:string|null;nationality:string|null}>;
 mode:'xi_vs_xi'|'xi_vs_fallback'|'fallback_vs_xi'|'fallback_vs_fallback';
 matchKey:string;homeClubId:string;awayClubId:string;
 sourceSeedHash:string;context:LineupMatchContextV1;neutral:boolean;
 expectedGoals:{home:number;away:number};
 regulation:{home:number;away:number};
 extraTime:{home:number;away:number}|null;
 penalties:{home:number;away:number}|null;
 homeGoals:number;awayGoals:number;winnerClubId:string|null;
 resolution:'regulation'|'extra-time'|'penalties';
 home:LineupSideV1;away:LineupSideV1;
 events:Array<{minute:number;playerId:number;side:'home'|'away';type:'goal';period:'regulation'|'extra-time'}>;
}
export function simulateMatchV1(args:{
 homeRoster:LineupFootballerV1[];awayRoster:LineupFootballerV1[];
 matchKey:string;seed:string;homeClubId:string;awayClubId:string;
 context:LineupMatchContextV1;
}):Promise<LineupMatchResultV1>;
export function selectAutomaticXiV1(roster:LineupFootballerV1[]):{
 kind:'team_fallback'|'real_xi';strength:number;
 starters:null|LineupSideV1['starters'];formation?:'4-3-3';
};
export function buildCandidateMatchReceiptV1(match:{
 matchId:number;season:number;day:number;generation:string;competitionId:string;
 fixtureId:string;homeClubId:string;awayClubId:string;sourceHash:string
},outcome:LineupMatchResultV1):Promise<Readonly<{
 schemaVersion:1;authority:'candidate-only';algorithmVersion:'temporary-lineup-v1';
 fixture:Record<string,unknown>;result:LineupMatchResultV1;receiptDigest:string;
}>>;
