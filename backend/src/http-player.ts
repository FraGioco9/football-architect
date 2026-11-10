import {requestPlayerEmailChange} from './player-email-change.ts';
import {httpJson,httpError,routeMethod,readSessionCookie,readJsonBody} from './http-contract.ts';
import {resolveAccountConfiguration} from './environment-pool.ts';
import {ApiError} from './errors.ts';
import {changePlayerPassword,revokeOtherSessions,deletePlayerAccount,updatePlayerProfile,ensureObject} from './player-account-management.ts';
import {requestPasswordReset,completePasswordReset} from './player-password-reset.ts';
import {registerPlayer,verifyPlayerEmail,type VerificationDelivery} from './player-registration.ts';
import {readAccountPermissions} from './account-permissions.ts';
import {authorizeUnifiedAdmin} from './unified-admin-authorization.ts';
import {readWorld} from './world-repository.ts';
import {requireDatabase} from './database.ts';
import {requireMutationOrigin} from './origin-policy.ts';
import {playerLogin,playerAuthenticate,playerRequireCsrf,playerCsrfFor} from './player-auth.ts';
export interface PlayerEnv {DB?:unknown;PLAYER_MODE?:string;PLAYER_ORIGIN?:string;PLAYER_TRUSTED_SOURCE?:string;PLAYER_VERIFICATION_DELIVERY?:VerificationDelivery;PLAYER_RESET_DELIVERY?:VerificationDelivery}
const json=(status:number,body:unknown,extra:Record<string,string>={})=>httpJson('account',status,body,extra);
export async function handlePlayer(request:Request,env:PlayerEnv):Promise<Response>{
 const path=new URL(request.url).pathname;
 const methods:Record<string,string>={'/api/player/password-reset/request':'POST','/api/player/password-reset/complete':'POST','/api/player/register':'POST','/api/player/verify-email':'POST','/api/player/account/change-password':'POST','/api/player/account/change-email':'POST','/api/player/account/profile':'POST','/api/player/account/revoke-other-sessions':'POST','/api/player/account/delete':'POST','/api/player/login':'POST','/api/player/logout':'POST','/api/player/session':'GET','/api/player/sessions':'GET','/api/player/permissions':'GET','/api/player/admin/world':'GET'};
 const method=methods[path];if(!method)return json(404,{error:{code:'not_found'}});
 const denied=routeMethod(request,method,'account');if(denied)return denied;
 try{
  const c=await resolveAccountConfiguration(request,env,'player_unavailable'),db=requireDatabase(env.DB),now=Math.floor(Date.now()/1000);
  if(method==='POST'||request.headers.has('Origin'))requireMutationOrigin(request.headers.get('Origin'),c.origin);
  const token=readSessionCookie(request,c.cookie);
  const set=(value:string,clear=false)=>`${c.cookie}=${value}; ${c.flags}; Max-Age=${clear?0:2592000}`;
  if(path==='/api/player/password-reset/request'){
   if(typeof env.PLAYER_RESET_DELIVERY!=='function')throw new ApiError(503,'reset_unavailable');
   return json(202,await requestPasswordReset(db,await readJsonBody(request),c.source,now,env.PLAYER_RESET_DELIVERY,request.headers.get('Accept-Language')??'en'));
  }
  if(path==='/api/player/password-reset/complete')return json(200,await completePasswordReset(db,await readJsonBody(request),now));
  if(path==='/api/player/register'){
   if(typeof env.PLAYER_VERIFICATION_DELIVERY!=='function')throw new ApiError(503,'verification_unavailable');
   return json(202,await registerPlayer(db,await readJsonBody(request),c.source,now,env.PLAYER_VERIFICATION_DELIVERY,request.headers.get('Accept-Language')??'en'));
  }
  if(path==='/api/player/verify-email')return json(200,await verifyPlayerEmail(db,await readJsonBody(request),now));
  if(path==='/api/player/login'){
   const result=await playerLogin(db,await readJsonBody(request),c.source,now,token);
   return json(200,{actor:result.actor,csrfToken:result.csrfToken,expiresAt:result.expiresAt},{'Set-Cookie':set(result.token)});
  }
  if(path==='/api/player/logout'){
   await readJsonBody(request);
   const session=await playerAuthenticate(db,token,now);
   await playerRequireCsrf(session.csrfDigest,request.headers.get('X-CSRF-Token'));
   const removed=await db.prepare(`DELETE FROM player_sessions WHERE token_digest=? AND account_id=? AND csrf_digest=? AND expires_at>? AND last_seen_at>? AND EXISTS(SELECT 1 FROM player_accounts WHERE id=player_sessions.account_id AND credential_version=player_sessions.credential_version AND status='active' AND email_verified_at IS NOT NULL)`).bind(session.digest,session.actor.id,session.csrfDigest,now,now-604800).run();
   if(removed.meta.changes!==1)throw new ApiError(401,'unauthorized');
   return json(200,{signedOut:true},{'Set-Cookie':set('',true)});
  }
  const session=await playerAuthenticate(db,token,now);
  if(path==='/api/player/account/profile'||path==='/api/player/account/change-email'){
   await playerRequireCsrf(session.csrfDigest,request.headers.get('X-CSRF-Token'));
   const payload=await readJsonBody(request);
   if(path==='/api/player/account/profile')return json(200,await updatePlayerProfile(db,session,payload,now));
   if(typeof env.PLAYER_VERIFICATION_DELIVERY!=='function')throw new ApiError(503,'verification_unavailable');
   return json(202,await requestPlayerEmailChange(db,session,ensureObject(payload,['email','currentPassword']),
    c.source,now,env.PLAYER_VERIFICATION_DELIVERY,request.headers.get('Accept-Language')??'en'));
  }
  if(path==='/api/player/account/change-password'||path==='/api/player/account/revoke-other-sessions'||path==='/api/player/account/delete'){
   await playerRequireCsrf(session.csrfDigest,request.headers.get('X-CSRF-Token'));
   const payload=await readJsonBody(request);
   if(path==='/api/player/account/change-password')return json(200,await changePlayerPassword(db,session,payload,now),{'Set-Cookie':set('',true)});
   if(path==='/api/player/account/revoke-other-sessions')return json(200,await revokeOtherSessions(db,session,now));
   return json(200,await deletePlayerAccount(db,session,payload,now),{'Set-Cookie':set('',true)});
  }
  if(path==='/api/player/admin/world'){
   const authorized=await authorizeUnifiedAdmin(db,token,now,'admin.world.read');
   return json(200,{world:await readWorld(db)});
  }
  if(path==='/api/player/sessions'){
   const rows=await db.prepare('SELECT token_digest,created_at,last_seen_at,expires_at FROM player_sessions WHERE account_id=? AND credential_version=(SELECT credential_version FROM player_accounts WHERE id=?) AND created_at>0 AND created_at<=? AND last_seen_at>=created_at AND last_seen_at<=? AND last_seen_at>? AND expires_at>? AND expires_at<=created_at+2592000 ORDER BY created_at DESC LIMIT 100').bind(session.actor.id,session.actor.id,now,now,now-604800,now).all<{token_digest:string;created_at:number;last_seen_at:number;expires_at:number}>();
   return json(200,{sessions:rows.results.map(row=>({current:row.token_digest===session.digest,createdAt:row.created_at,lastSeenAt:row.last_seen_at,expiresAt:row.expires_at}))});
  }
  if(path==='/api/player/permissions')return json(200,{permissions:await readAccountPermissions(db,session.actor.id)});
  return json(200,{actor:session.actor,profile:session.profile,authenticated:true,csrfToken:await playerCsrfFor(token),permissions:await readAccountPermissions(db,session.actor.id)});
 }catch(error){
  return httpError('account',error,'player_unavailable');
 }
}
