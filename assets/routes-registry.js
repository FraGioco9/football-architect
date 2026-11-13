// ARCH-CLEAN-02 A03: one pure core for classic browsers and Node CommonJS.
((root,factory)=>{
 const api=factory();
 root.faRoutesRegistry=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
// ARCH-CLEAN-02 A03: pure route identities and canonical subpage helpers.
const countries=Object.freeze(["it","eng","es","de","fr","pt","nl","br"]);
const competitionViews=Object.freeze(["overview","standings","postseason","fixtures","stats","history","rules","awards","teams"]);
const cupViews=Object.freeze(["standings","postseason","fixtures","stats","history","rules","awards"]);
const clubViews=Object.freeze(["overview","roster","fixtures","stats","history"]);
const pages=Object.freeze(["dashboard","calendar","settings","admin","admin/calendar","admin/players","admin/contracts","admin/players/preview","competitions","players","clubs"]);
const country="(?:it|eng|es|de|fr|pt|nl|br)";
const division=new RegExp("^/competitions/("+country+"-[12])(?:/([^/]+))?/?$");
const cup=/^\/competitions\/(int-[12])(?:\/([^/]+))?\/?$/;
const club=new RegExp("^/clubs/("+country+")/([1-9]|[1-3][0-9]|40)(?:/([^/]+))?/?$");
const invalid=(v)=>typeof v!=="string"||v.includes("%")||v.includes("\\")||v.includes("//")||v.includes("\0");
function parseRoute(pathname){
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
function buildRoute({kind,id,view="overview",country:clubCountry}){
 if(kind==="competition"&&/^(?:it|eng|es|de|fr|pt|nl|br)-[12]$/.test(id)&&competitionViews.includes(view))return "/competitions/"+id+"/"+view;
 if(kind==="cup"&&/^(?:int-1|int-2)$/.test(id)&&cupViews.includes(view))return "/competitions/"+id+"/"+view;
 if(kind==="club"&&countries.includes(clubCountry)&&/^(?:[1-9]|[1-3][0-9]|40)$/.test(String(id))&&clubViews.includes(view))return "/clubs/"+clubCountry+"/"+id+"/"+view;
 if(kind==="page"&&pages.includes(id))return "/"+id;
 throw new TypeError("Invalid route identity or view");
}
// A missing season is an intentional current-season permalink, not a reason to
// insert a query string. Explicit historical/current permalinks remain stable.
function resolveSeasonQuery(search,current=null,{min=1}={}){
 const params=search instanceof URLSearchParams?search:new URLSearchParams(search);
 const has=params.has("season"),raw=params.get("season");
 const valid=typeof raw==="string"&&(min===0?/^(?:0|[1-9]\d{0,8})$/:/^[1-9]\d{0,8}$/).test(raw);
 const confirmed=Number.isSafeInteger(current)&&current>=0;
 const latest=confirmed?Math.max(min,current):null;
 const requested=valid?Number(raw):null;
 const unavailable=confirmed&&requested!==null&&requested>latest;
 return Object.freeze({season:requested!==null&&!unavailable?requested:latest,
  explicit:has&&valid&&!unavailable,remove:has&&(!valid||unavailable),confirmed});
}
function withSeason(path,season,current,{preserveExplicit=false}={}){
 const url=new URL(path,"https://football-architect.invalid");
 const other=new URLSearchParams(url.search);url.search="";
 if(Number.isSafeInteger(season)&&season>=0&&
   (preserveExplicit||!Number.isSafeInteger(current)||season!==current))
  url.searchParams.set("season",String(season));
 for(const [key,value] of other)if(key!=="season")url.searchParams.append(key,value);
 return url.pathname+url.search+url.hash;
}
function canonicalizeRoute(pathname){return parseRoute(pathname)?.canonical??null;}
function resolveRouteIdentity(pathname){const p=parseRoute(pathname);return p?Object.freeze({kind:p.kind,base:p.base??p.canonical,view:p.view??null}):null;}

return Object.freeze({countries,competitionViews,cupViews,clubViews,pages,parseRoute,buildRoute,resolveSeasonQuery,withSeason,canonicalizeRoute,resolveRouteIdentity});
});
