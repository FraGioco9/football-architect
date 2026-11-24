// #791 Node-only planner boundary used by local rehearsal tooling.
export const REFERENCE_PROFILE_VERSION:string;
export interface OpeningVersions{worldGeneration:string;worldRevision:number;clubSnapshot:string;generator:string;catalog:string;policy:string}
export interface OpeningClub{key:string;nationality:string;division:1|2|null;active:boolean}
export interface OpeningSlot{slotKey:string;clubKey:string;division:1|2;age:number;primaryPosition:string;primarySuitabilityTarget:number;generatorSeed:string;primaryNationality:string;intendedTermSeasons:1|2|3;representation:'ai'}
export interface OpeningManifest{schema:'opening-population-plan-v1';seed:string;versions:OpeningVersions;clubs:OpeningClub[];config:unknown;slots:OpeningSlot[]}
export function clubCountryToNationality(countryId:string):string;
export function planApprovedReference(input:{seed:string;versions:OpeningVersions;clubs:OpeningClub[]}):OpeningManifest;
export function manifestDigest(value:unknown):string;

export function fitOpeningYouthSlots(manifest:OpeningManifest,inventory:unknown):OpeningManifest;
