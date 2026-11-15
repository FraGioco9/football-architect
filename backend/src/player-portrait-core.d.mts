/** Worker-safe types for the deterministic, version-pinned portrait core. */
export type PortraitAttributes={strength:number;speed:number;agility:number;stamina:number};
export type PortraitTraits={face:string;complexion:string;hairTexture:string;hairStyle:string;hairColor:string;eyes:string;eyebrows:string;nose:string;jaw:string;facialHair:string;detail:string};
export interface PortraitSnapshot {
 schema_version:'player-portraits-v2';prompt_version:'player-portrait-v3';
 player_id:number;nationality:string;secondary_nationality:string|null;
 appearance_traits:PortraitTraits;appearance_fingerprint:string;
 body_profile:'lean'|'lean-athletic'|'balanced-athletic'|'power-athletic';
 body_conditioning:'subtle'|'natural'|'endurance';
}
export const PORTRAIT_SCHEMA_VERSION:'player-portraits-v2';
export const PORTRAIT_PROMPT_VERSION:'player-portrait-v3';
export const COUNTRY_NAMES:Readonly<Record<string,string>>;
export const BODY_ARCHETYPES:readonly string[];
export const BODY_CONDITIONING:readonly string[];
export function classifyAthleticBody(attributes:PortraitAttributes):Pick<PortraitSnapshot,'body_profile'|'body_conditioning'>;
export function describeAthleticBody(entry:Pick<PortraitSnapshot,'body_profile'|'body_conditioning'>):string;
export function buildPortraitSnapshotForPlayer(player:{id:number;nationality:string;secondary_nationality?:string|null;attributes:PortraitAttributes}):Promise<PortraitSnapshot>;
export function renderPortraitPromptFromSnapshot(snapshot:PortraitSnapshot):Promise<string>;
export function buildPortraitPrompt(entry:PortraitSnapshot&{appearance_profile:string}):Promise<string>;
