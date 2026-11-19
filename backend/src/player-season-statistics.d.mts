/** #578: read-side projection, no new sporting score authority. */
export interface RecordedPlayerSummary {
 appearances:number;starts:number;subAppearances:number|null;
 minutes:number;goals:number;assists:number|null;yellowCards:number|null;redCards:number|null;
 gkAppearances:number;cleanSheets:number|null;ratedAppearances:number;averageRating:number|null;
 mvpAwards:number|null;mvpCoveredAppearances:number;
}
export function aggregateFrozenPlayerSeasonStats(playerId:number, matches:Iterable<unknown>):
 {total:RecordedPlayerSummary;competitions:Array<RecordedPlayerSummary&{competitionId:string;clubId:string}>};
