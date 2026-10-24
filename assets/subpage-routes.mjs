// ROUTE-02 compatibility facade; public exports and legacy result shape are frozen.
import {parseRoute,buildRoute,competitionViews,clubViews} from "./routes-registry.mjs";
export {competitionViews,clubViews};
export function resolveSubpage(pathname){
 const route=parseRoute(pathname);
 return route&&(route.kind==="competition"||route.kind==="club")?{kind:route.kind,base:route.base,view:route.view,canonical:route.canonical,redirect:route.redirect}:null;
}
export function competitionSubpage(id,view="overview"){return buildRoute({kind:"competition",id,view});}
export function clubSubpage(country,id,view="overview"){return buildRoute({kind:"club",country,id,view});}
