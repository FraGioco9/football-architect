import {ApiError} from './errors.ts';
import {requireDatabase} from './database.ts';
import {requireMutationOrigin} from './origin-policy.ts';
import {playerLogin,playerAuthenticate,playerRequireCsrf} from './player-auth.ts';
export interface PlayerEnv {DB?:unknown;PLAYER_MODE?:string;PLAYER_ORIGIN?:string;PLAYER_TRUSTED_SOURCE?:string}
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(status:number,body:unknown,extra:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
function config(request:Request,env:PlayerEnv){
 const url=new URL(request.url),origin=env.PLAYER_ORIGIN??'',mode=env.PLAYER_MODE??'';
 if(!origin)throw new ApiError(503,'player_unavailable');
 // Validate configured origin independent of a client Origin header.
 try{const trusted=new URL(origin);if(trusted.origin!==origin||trusted.pathname!=='/'||trusted.search||trusted.hash||trusted.username||trusted.password)throw Error()}catch{throw new ApiError(503,'player_unavailable')}
 if(mode==='local'){
  if(url.protocol!=='http:'||url.origin!==origin||!['localhost','127.0.0.1','[::1]','app.localhost'].includes(url.hostname))throw new ApiError(503,'player_unavailable');
  return {origin,source:'local-loopback',cookie:'fa_player_local',flags:'HttpOnly; SameSite=Strict; Path=/'};
 }
 if(mode!=='production'||env.PLAYER_TRUSTED_SOURCE!=='cloudflare'||url.protocol!=='https:'||url.origin!==origin)throw new ApiError(503,'player_unavailable');
 const source=request.headers.get('CF-Connecting-IP');
 if(!source||source.length>45||!/^[0-9a-fA-F:.]+$/.test(source))throw new ApiError(503,'player_unavailable');
 return {origin,source,cookie:'__Host-fa_player',flags:'Secure; HttpOnly; SameSite=Strict; Path=/'};
}
function cookie(request:Request,name:string){
 const values=(request.headers.get('Cookie')??'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(name+'='));
 if(values.length>1)throw new ApiError(401,'unauthorized');
 return values[0]?.slice(name.length+1)??'';
}
async function body(request:Request){
 if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new ApiError(415,'json_required');
 if(!request.body)throw new ApiError(400,'invalid_json');
 const reader=request.body.getReader();const parts:Uint8Array[]=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>4096){await reader.cancel();throw new ApiError(413,'request_too_large')}parts.push(value)}}finally{reader.releaseLock()}
 const data=new Uint8Array(length);let index=0;for(const part of parts){data.set(part,index);index+=part.length}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data)) as unknown}catch{throw new ApiError(400,'invalid_json')}
}
export async function handlePlayer(request:Request,env:PlayerEnv):Promise<Response>{
 const path=new URL(request.url).pathname;
 const methods:Record<string,string>={'/api/player/login':'POST','/api/player/logout':'POST','/api/player/session':'GET'};
 const method=methods[path];if(!method)return json(404,{error:{code:'not_found'}});
 if(request.method!==method)return json(405,{error:{code:'method_not_allowed'}},{Allow:method});
 try{
  const c=config(request,env),db=requireDatabase(env.DB),now=Math.floor(Date.now()/1000);
  if(method==='POST'||request.headers.has('Origin'))requireMutationOrigin(request.headers.get('Origin'),c.origin);
  const token=cookie(request,c.cookie);
  const set=(value:string,clear=false)=>`${c.cookie}=${value}; ${c.flags}; Max-Age=${clear?0:2592000}`;
  if(path==='/api/player/login'){
   const result=await playerLogin(db,await body(request),c.source,now,token);
   return json(200,{actor:result.actor,csrfToken:result.csrfToken,expiresAt:result.expiresAt},{'Set-Cookie':set(result.token)});
  }
  if(path==='/api/player/logout'){
   await body(request);
   const session=await playerAuthenticate(db,token,now);
   await playerRequireCsrf(session.csrfDigest,request.headers.get('X-CSRF-Token'));
   await db.prepare('DELETE FROM player_sessions WHERE token_digest=?').bind(session.digest).run();
   return json(200,{signedOut:true},{'Set-Cookie':set('',true)});
  }
  const session=await playerAuthenticate(db,token,now);
  // CSRF token is intentionally returned only on login, never reconstructed from cookie.
  return json(200,{actor:session.actor,authenticated:true});
 }catch(error){
  if(error instanceof ApiError)return json(error.status,{error:{code:error.code}},error.status===429?{'Retry-After':'900'}:{});
  return json(503,{error:{code:'player_unavailable'}});
 }
}
