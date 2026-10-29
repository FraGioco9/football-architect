import {ApiError} from './errors.ts';
import {changePlayerPassword,revokeOtherSessions,deletePlayerAccount} from './player-account-management.ts';
import {requestPasswordReset,completePasswordReset} from './player-password-reset.ts';
import {registerPlayer,verifyPlayerEmail,type VerificationDelivery} from './player-registration.ts';
import {readAccountPermissions} from './account-permissions.ts';
import {authorizeUnifiedAdmin} from './unified-admin-authorization.ts';
import {readWorld} from './world-repository.ts';
import {requireDatabase} from './database.ts';
import {requireMutationOrigin} from './origin-policy.ts';
import {playerLogin,playerAuthenticate,playerRequireCsrf,playerCsrfFor} from './player-auth.ts';
export interface PlayerEnv {DB?:unknown;PLAYER_MODE?:string;PLAYER_ORIGIN?:string;PLAYER_TRUSTED_SOURCE?:string;PLAYER_VERIFICATION_DELIVERY?:VerificationDelivery;PLAYER_RESET_DELIVERY?:VerificationDelivery}
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Vary':'Cookie'};
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
 const methods:Record<string,string>={'/api/player/password-reset/request':'POST','/api/player/password-reset/complete':'POST','/api/player/register':'POST','/api/player/verify-email':'POST','/api/player/account/change-password':'POST','/api/player/account/revoke-other-sessions':'POST','/api/player/account/delete':'POST','/api/player/login':'POST','/api/player/logout':'POST','/api/player/session':'GET','/api/player/sessions':'GET','/api/player/permissions':'GET','/api/player/admin/world':'GET'};
 const method=methods[path];if(!method)return json(404,{error:{code:'not_found'}});
 if(request.method!==method)return json(405,{error:{code:'method_not_allowed'}},{Allow:method});
 try{
  const c=config(request,env),db=requireDatabase(env.DB),now=Math.floor(Date.now()/1000);
  if(method==='POST'||request.headers.has('Origin'))requireMutationOrigin(request.headers.get('Origin'),c.origin);
  const token=cookie(request,c.cookie);
  const set=(value:string,clear=false)=>`${c.cookie}=${value}; ${c.flags}; Max-Age=${clear?0:2592000}`;
  if(path==='/api/player/password-reset/request'){
   if(typeof env.PLAYER_RESET_DELIVERY!=='function')throw new ApiError(503,'reset_unavailable');
   return json(202,await requestPasswordReset(db,await body(request),c.source,now,env.PLAYER_RESET_DELIVERY));
  }
  if(path==='/api/player/password-reset/complete')return json(200,await completePasswordReset(db,await body(request),now));
  if(path==='/api/player/register'){
   if(typeof env.PLAYER_VERIFICATION_DELIVERY!=='function')throw new ApiError(503,'verification_unavailable');
   return json(202,await registerPlayer(db,await body(request),c.source,now,env.PLAYER_VERIFICATION_DELIVERY));
  }
  if(path==='/api/player/verify-email')return json(200,await verifyPlayerEmail(db,await body(request),now));
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
  if(path==='/api/player/account/change-password'||path==='/api/player/account/revoke-other-sessions'||path==='/api/player/account/delete'){
   await playerRequireCsrf(session.csrfDigest,request.headers.get('X-CSRF-Token'));
   const payload=await body(request);
   if(path==='/api/player/account/change-password')return json(200,await changePlayerPassword(db,session,payload,now),{'Set-Cookie':set('',true)});
   if(path==='/api/player/account/revoke-other-sessions')return json(200,await revokeOtherSessions(db,session,now));
   return json(200,await deletePlayerAccount(db,session,payload,now),{'Set-Cookie':set('',true)});
  }
  if(path==='/api/player/admin/world'){
   await authorizeUnifiedAdmin(db,token,now,'admin.world.read');
   return json(200,{world:await readWorld(db)});
  }
  if(path==='/api/player/sessions'){
   const rows=await db.prepare('SELECT token_digest,created_at,last_seen_at,expires_at FROM player_sessions WHERE account_id=? ORDER BY created_at DESC LIMIT 100').bind(session.actor.id).all<{token_digest:string;created_at:number;last_seen_at:number;expires_at:number}>();
   return json(200,{sessions:rows.results.map(row=>({current:row.token_digest===session.digest,createdAt:row.created_at,lastSeenAt:row.last_seen_at,expiresAt:row.expires_at}))});
  }
  if(path==='/api/player/permissions')return json(200,{permissions:await readAccountPermissions(db,session.actor.id)});
  return json(200,{actor:session.actor,authenticated:true,csrfToken:await playerCsrfFor(token),permissions:await readAccountPermissions(db,session.actor.id)});
 }catch(error){
  if(error instanceof ApiError)return json(error.status,{error:{code:error.code}},error.status===429?{'Retry-After':'900'}:{});
  return json(503,{error:{code:'player_unavailable'}});
 }
}
