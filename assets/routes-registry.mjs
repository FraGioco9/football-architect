// ARCH-CLEAN-02 A03: pure route identities and canonical subpage helpers.
export const countries=Object.freeze(["it","eng","es","de","fr","pt","nl","br"]);
export const competitionViews=Object.freeze(["overview","standings","postseason","fixtures","stats","history","rules","awards","teams"]);
export const cupViews=Object.freeze(["standings","postseason","fixtures","stats","history","rules","awards"]);
export const clubViews=Object.freeze(["overview","roster","fixtures","stats","history"]);
export const pages=Object.freeze(["dashboard","calendar","settings","competitions","clubs"]);
const country="(?:it|eng|es|de|fr|pt|nl|br)";
const division=new RegExp("^/competitions/("+country+"-[12])(?:/([^/]+))?/?$");
const cup=/^\/competitions\/(int-[12])(?:\/([^/]+))?\/?$/;
const club=new RegExp("^/clubs/("+country+")/([1-9]|[1-3][0-9]|40)(?:/([^/]+))?/?$");
const invalid=(v)=>typeof v!=="string"||v.includes("%")||v.includes("\\")||v.includes("//")||v.includes("\0");
export function parseRoute(pathname){
 if(invalid(pathname))return null;
 let m=division.exec(pathname);
 if(m){const view=m[2]||"overview";if(!competitionViews.includes(view))return null;const base="/competitions/"+m[1],canonical=base+"/"+view;return {kind:"competition",base,view,canonical,redirect:pathname!==canonical};}
 m=club.exec(pathname);
 if(m){const view=m[3]||"overview";if(!clubViews.includes(view))return null;const base="/clubs/"+m[1]+"/"+m[2],canonical=base+"/"+view;return {kind:"club",base,view,canonical,redirect:pathname!==canonical};}
 m=cup.exec(pathname);
 if(m&&m[2]&&cupViews.includes(m[2])){const canonical="/competitions/"+m[1]+"/"+m[2];return {kind:"cup",base:"/competitions/"+m[1],view:m[2],canonical,redirect:pathname!==canonical};}
 if(pages.some(p=>pathname==="/"+p))return {kind:"page",canonical:pathname,redirect:false};
 return null;
}
export function buildRoute({kind,id,view="overview",country:clubCountry}){
 if(kind==="competition"&&/^(?:it|eng|es|de|fr|pt|nl|br)-[12]$/.test(id)&&competitionViews.includes(view))return "/competitions/"+id+"/"+view;
 if(kind==="cup"&&/^(?:int-1|int-2)$/.test(id)&&cupViews.includes(view))return "/competitions/"+id+"/"+view;
 if(kind==="club"&&countries.includes(clubCountry)&&/^(?:[1-9]|[1-3][0-9]|40)$/.test(String(id))&&clubViews.includes(view))return "/clubs/"+clubCountry+"/"+id+"/"+view;
 if(kind==="page"&&pages.includes(id))return "/"+id;
 throw new TypeError("Invalid route identity or view");
}
export function canonicalizeRoute(pathname){return parseRoute(pathname)?.canonical??null;}
export function resolveRouteIdentity(pathname){const p=parseRoute(pathname);return p?Object.freeze({kind:p.kind,base:p.base??p.canonical,view:p.view??null}):null;}
