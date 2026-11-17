/** Canonical published match references, with no result payload. */
export interface MatchReference {
 readonly matchId:string;
 readonly season:number;
 readonly competitionId:string;
 readonly phaseId:string;
 readonly round:number;
 readonly day:number;
}
export interface MatchReferenceIndex {
 readonly season:number;
 readonly competitionId:string;
 readonly references:readonly MatchReference[];
 readonly byMatchId:Readonly<Record<string,MatchReference>>;
}
export function isPublicMatchId(id:unknown):id is string;
export function isCompetitionId(id:unknown):id is string;
export function referenceFromPublicMatch(payload:unknown,expectedId?:string):MatchReference|null;
export function indexPublishedCompetitionMatches(payload:unknown):MatchReferenceIndex;
