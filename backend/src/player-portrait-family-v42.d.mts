/** V4.2 is the only supported persistent portrait identity contract. */
import type {PortraitAttributes} from './player-portrait-core.mjs';

export type PortraitNameOrigin='primary'|'secondary'|'unknown';
export type PortraitNameOrigins=Readonly<{first:PortraitNameOrigin;last:PortraitNameOrigin}>;

export interface FamilyV42Player {
 id:number;
 nationality:string;
 secondary_nationality?:string|null;
 attributes:PortraitAttributes;
 name_origins?:PortraitNameOrigins|null;
}

export interface FamilyV42Snapshot {
 readonly schema_version:'player-portraits-v5';
 readonly prompt_version:'player-portrait-v4.2';
 readonly player_id:number;
 readonly nationality:string;
 readonly secondary_nationality:string|null;
 readonly name_origins:PortraitNameOrigins;
 readonly family_background:string;
 readonly appearance_traits:Readonly<Record<string,string>>;
 readonly appearance_fingerprint:string;
 readonly body_profile:string;
 readonly body_variation:string;
}
export const FAMILY_V42_SCHEMA_VERSION:'player-portraits-v5';
export const FAMILY_V42_PROMPT_VERSION:'player-portrait-v4.2';
export const FAMILY_V42_SEED_VERSION:'football-architect:portrait-identity:v4.2';
export function buildFamilyV42PortraitSnapshotForPlayer(player:FamilyV42Player):Promise<FamilyV42Snapshot>;
export function renderFamilyV42PortraitPromptFromSnapshot(snapshot:FamilyV42Snapshot):Promise<string>;
