declare module '*routes-registry.mjs' {
 export type ParsedRoute={kind:'competition'|'club'|'cup'|'page';base?:string;view?:string;canonical:string;redirect:boolean};
 export function parseRoute(path:string):ParsedRoute|null;
 export const competitionViews:readonly string[];
 export const clubViews:readonly string[];
}
