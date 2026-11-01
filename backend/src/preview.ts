/** Hosted Preview only. Static files arrive exclusively from a guarded artifact. */
import api,{type Env} from './index.ts';
import {parseRoute,competitionViews,clubViews} from '../../assets/routes-registry.mjs';
export interface PreviewEnv extends Env {ASSETS:Pick<typeof globalThis,'fetch'>;PREVIEW_SOURCE_SHA?:string}
const privateHeaders={'Cache-Control':'private, no-store, max-age=0','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
const error=(status:number,code:string)=>new Response(JSON.stringify({error:{code}}),{status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8'}});
function route(url:URL){
 const original=url.pathname;
 let path=original.replace(/\/index\.html$/,'').replace(/\/+$/,'')||'/';
 const params=new URLSearchParams(url.search),parsed=parseRoute(path);
 let changedQuery=false;
 if(parsed?.kind==='club'){
  const view=path===parsed.base&&clubViews.includes(params.get('view')??'')?params.get('view')!:parsed.view!;
  path=parsed.base+'/'+view;
  if(params.has('view')){params.delete('view');changedQuery=true}
  if(view==='overview'||view==='history')for(const key of ['season','matchday'])if(params.has(key)){params.delete(key);changedQuery=true}
 }else if(parsed?.kind==='competition'&&path===parsed.base){
  const view=competitionViews.includes(params.get('view')??'')?params.get('view')!:'overview';
  path=parsed.base+'/'+view;
  if(params.has('view')){params.delete('view');changedQuery=true}
  if(['history','rules'].includes(view)&&params.has('matchday')){params.delete('matchday');changedQuery=true}
 }else if(/^\/competitions\/int-[12]$/.test(path))path+='/standings';
 const search=changedQuery?(params.size?'?'+params.toString():''):url.search;
 if(path!==original||changedQuery)return {redirect:path+search};
 const target=parseRoute(path);
 if(target?.kind==='club')return {file:'/clubs/_shared/index.html'};
 if(target?.kind==='competition'||target?.kind==='cup')return {file:target.base+'/index.html'};
 return {file:path==='/'?'/index.html':/\.[a-z0-9]+$/i.test(path)?path:path+'/index.html'};
}
export default {
 async fetch(request:Request,env:PreviewEnv):Promise<Response>{
  const url=new URL(request.url);
  if(env.PLAYER_MODE!=='preview'||env.PLAYER_TRUSTED_SOURCE!=='cloudflare'||url.protocol!=='https:'||url.origin!==env.PLAYER_ORIGIN)return error(503,'preview_unavailable');
  if(url.pathname==='/api'||url.pathname.startsWith('/api/'))return api.fetch(request,env);
  if(!['GET','HEAD'].includes(request.method))return error(405,'method_not_allowed');
  if(url.pathname.includes('%')||url.pathname.includes('\\')||url.pathname.includes('//')||url.pathname.includes('\0'))return error(403,'forbidden');
  if(/^\/(?:backend|tools|tests|docs|__fa_dev__|\.git|\.github|\.wrangler)(?:\/|$)/.test(url.pathname))return error(404,'not_found');
  const target=route(url);
  if(target.redirect)return new Response(null,{status:308,headers:{...privateHeaders,Location:target.redirect}});
  try{
   // Cookies, authorization, CSRF, verification tokens and caller source never
   // enter the static binding or its cache key. Bodies are streamed unchanged.
   const response=await env.ASSETS.fetch(new Request(new URL(target.file!,url.origin),{method:request.method}));
   const headers=new Headers(response.headers);headers.delete('Set-Cookie');
   headers.set('X-Content-Type-Options','nosniff');headers.set('X-Robots-Tag','noindex, nofollow');
   if(target.file!.endsWith('.html')||response.status!==200)for(const [key,value] of Object.entries(privateHeaders))headers.set(key,value);
   if(env.PREVIEW_SOURCE_SHA&&/^[a-f0-9]{40}$/.test(env.PREVIEW_SOURCE_SHA))headers.set('X-FA-Source-SHA',env.PREVIEW_SOURCE_SHA);
   return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
  }catch{return error(503,'preview_unavailable')}
 }
};
