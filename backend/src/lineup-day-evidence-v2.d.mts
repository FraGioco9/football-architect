/** #613 one-authority V2 day receipt contracts. */
export interface LineupDailyMatchReceiptV1 {
 fixtureId:string;receiptHash:string;
 receipt:{
  schemaVersion:1|2;authority:'official';algorithmVersion:'temporary-lineup-v1';
  rosterSourceDigest:string;sourceCandidateDigest:string;
  fixture:Record<string,unknown>;result:Record<string,unknown>;
 };
}
export interface LineupDailyResultV2 {
 fixtureId:string;matchId:number;homeClubId:string;awayClubId:string;
 homeGoals:number;awayGoals:number;winnerClubId:string|null;
 resolution:'regulation'|'extra-time'|'penalties';
 extraTime:{home:number;away:number}|null;
 penalties:{home:number;away:number}|null;receiptHash:string;
}
export interface LineupDailyEvidenceV2 {
 payload:{schemaVersion:2;season:number;generation:string;day:number;
  calendarHash:string;simulationVersion:'temporary-lineup-v1';
  results:LineupDailyResultV2[]};
 hash:string;
}
export const LINEUP_DAY_VERSION:'temporary-lineup-v1';
export function buildLineupDayEvidenceV2(input:{
 generation:string;season:number;day:number;calendarHash:string;
 dueFixtures:Array<{fixtureId:string;matchId:number}>;
 receipts:LineupDailyMatchReceiptV1[];
}):Promise<LineupDailyEvidenceV2>;
export function verifyLineupDayEvidenceV2(input:{
 payload:LineupDailyEvidenceV2['payload'];hash:string;
 dueFixtures:Array<{fixtureId:string;matchId:number}>;
 receipts:LineupDailyMatchReceiptV1[];
}):Promise<LineupDailyEvidenceV2>;
