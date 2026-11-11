// Worker-build declarations for the generated shared pure generator.
export const FIFA_SNAPSHOT: string;
export const ATTRIBUTES: string[];
export const COUNTRIES: ReadonlyArray<{code:string;name:string;rank:number;demoLast:ReadonlyArray<string>}>;
export interface TrialCandidate {
 preview_id:string;first_name:string;last_name:string;display_name:string;initial_age:number;
 nationality:string;secondary_nationality:string|null;height_cm:number;preferred_foot:string;
 primary_position:string;secondary_positions:string[];attributes:Record<string,number>;
 development_aptitude:number;career_status:string;
}
export interface TrialResult {
 trial_only:boolean;persisted:boolean;ranking_snapshot:string;seed:string;count:number;
 identity_sources:Record<string,string>;candidates:TrialCandidate[];
}
export function generateTrialWithCatalog(options:Record<string,unknown>,pools:unknown):TrialResult;
export function summarize(trial:TrialResult):{
 count:number;seed:string;snapshot:string;distinct_countries:number;secondary_nationalities:number;
 countries:Record<string,number>;positions:Record<string,number>;ages:Record<string,number>;secondary_counts:Record<string,number>
};
