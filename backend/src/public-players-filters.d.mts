/** Public read-only Players query contract shared with the DEV bridge. */
export interface PublicPlayerAttributeRange {key:string;min?:number;max?:number}
export interface PublicPlayerFilters {
 name?:string;
 attributes?:PublicPlayerAttributeRange[];
 nationality?:string[];
 nationalityScope?:'any';
 position?:string[];
 positionScope?:'any';
 ageMin?:number;
 ageMax?:number;
 heightMin?:number;
 heightMax?:number;
 foot?:'left'|'right';
}
export interface PublicPlayerQuery {page:number;filters:PublicPlayerFilters}
export function parsePublicPlayerQuery(raw?:string):PublicPlayerQuery;
export function isAllowedPublicPlayersPath(raw:unknown):boolean;
