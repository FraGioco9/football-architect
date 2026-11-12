/** Public read-only Players query contract shared with the DEV bridge. */
export interface PublicPlayerFilters {
 nationality?:string;
 position?:string;
 ageMin?:number;
 ageMax?:number;
 foot?:'left'|'right';
}
export interface PublicPlayerQuery {
 page:number;
 filters:PublicPlayerFilters;
}
export function parsePublicPlayerQuery(raw?:string):PublicPlayerQuery;
export function isAllowedPublicPlayersPath(raw:unknown):boolean;
