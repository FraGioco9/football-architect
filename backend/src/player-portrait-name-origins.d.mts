import type {PortraitNameOrigins} from './player-portrait-family-v42.mjs';

/** Catalogue-membership evidence, not an inference of ancestry. */
export function resolveCatalogueNameOrigins(player:{
 nationality:string;
 secondary_nationality?:string|null;
 name?:string;
 first_name?:string;
 last_name?:string;
}):PortraitNameOrigins;
