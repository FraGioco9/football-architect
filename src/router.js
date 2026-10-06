import {NAV_PAGE_IDS} from './navigation-model.js';

export const PAGE_ROUTES=Object.freeze({
  dashboard:'/dashboard',
  calendar:'/calendar',
  inbox:'/inbox',
  club:'/club',
  squad:'/squad',
  tactics:'/tactics',
  training:'/training',
  youth:'/youth',
  league:'/league',
  world:'/world',
  advanced:'/advanced',
  market:'/market',
  finance:'/finance',
  board:'/board',
  manager:'/manager',
  settings:'/settings',
  careers:'/careers'
});
const PATH_PAGES=Object.freeze(Object.fromEntries(Object.entries(PAGE_ROUTES).map(([page,path])=>[path,page])));
const RESOURCE_SEGMENT=/^[A-Za-z0-9._:-]{1,160}$/;

export function normalizeAppPath(pathname='/'){
  let path=String(pathname||'/').split('?')[0].split('#')[0]||'/';
  try{path=decodeURI(path);}catch{return null;}
  if(!path.startsWith('/'))path='/'+path;
  if(path.length>1)path=path.replace(/\/+$/,'');
  return path;
}
export function pagePath(page){
  if(page==='home')return '/';
  return PAGE_ROUTES[page]||null;
}
export function playerPath(playerId){
  const id=Number(playerId);
  return Number.isSafeInteger(id)&&id>0?`/player/${id}`:null;
}
export function matchPreviewPath(matchId){
  const id=String(matchId??'');
  return RESOURCE_SEGMENT.test(id)?`/match/${encodeURIComponent(id)}/preview`:null;
}
export function parseAppRoute(pathname='/'){
  const path=normalizeAppPath(pathname);
  if(path===null)return {kind:'not-found',path:String(pathname||'/')};
  if(path==='/')return {kind:'page',page:'home',path,requiresCareer:false};
  if(path==='/careers/new')return {kind:'new-career',path,requiresCareer:false};
  const page=PATH_PAGES[path];
  if(page)return {kind:'page',page,path,requiresCareer:!['careers','settings'].includes(page)};
  let match=path.match(/^\/player\/(\d+)$/);
  if(match){
    const playerId=Number(match[1]);
    if(Number.isSafeInteger(playerId)&&playerId>0)return {kind:'player',playerId,path,requiresCareer:true};
  }
  match=path.match(/^\/match\/([^/]+)\/preview$/);
  if(match){
    let matchId;
    try{matchId=decodeURIComponent(match[1]);}catch{return {kind:'not-found',path};}
    if(RESOURCE_SEGMENT.test(matchId))return {kind:'match-preview',matchId,path,requiresCareer:true};
  }
  return {kind:'not-found',path};
}
export function isKnownAppRoutePath(pathname='/'){
  return parseAppRoute(pathname).kind!=='not-found';
}
export function isRoutePage(page){
  return page==='home'||NAV_PAGE_IDS.includes(page);
}
