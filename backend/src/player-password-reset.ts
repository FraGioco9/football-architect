import {abortUnless} from './atomic-guard.ts';
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {parseOperatorEmail} from './email-identity.ts';
import {validatePasswordShape} from './password-policy.ts';
import {createOpaqueToken,digestOpaqueToken} from './session-tokens.ts';
import {reservePlayerAuthThrottle} from './auth-throttle-policy.ts';
import type {VerificationDelivery} from './player-registration.ts';

const response={accepted:true};
const invalid=()=>new ApiError(400,'invalid_reset_token');
export async function requestPasswordReset(db:Database,body:unknown,source:string,now:number,deliver:VerificationDelivery,locale='en'){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body as object).join(',')!=='email')throw new ApiError(422,'invalid_reset_request');
 let email:string;try{email=parseOperatorEmail((body as {email:unknown}).email)}catch{throw new ApiError(422,'invalid_reset_request')}
 await reservePlayerAuthThrottle(db,'reset',email,source,now);
 const account=await db.prepare("SELECT id FROM player_accounts WHERE email_normalized=? AND status='active' AND email_verified_at IS NOT NULL").bind(email).first<{id:string}>();
 if(!account)return response;
 const token=createOpaqueToken(),digest=await digestOpaqueToken(token);
 // A failed delivery never invalidates the previous working reset token.
 await db.prepare(`INSERT INTO player_one_time_tokens(token_digest,account_id,purpose,issued_at,expires_at)
 VALUES(?,?,'reset_password',?,?)`).bind(digest,account.id,now,now+1800).run();
 try{await deliver(email,token,locale)}catch{
  await db.prepare("DELETE FROM player_one_time_tokens WHERE token_digest=? AND purpose='reset_password' AND consumed_at IS NULL").bind(digest).run();
  throw new ApiError(503,'reset_unavailable');
 }
 // Revoke older reset links only after the newer delivery succeeds.
 await db.prepare("DELETE FROM player_one_time_tokens WHERE account_id=? AND purpose='reset_password' AND token_digest<>?").bind(account.id,digest).run();
 return response;
}
export async function completePasswordReset(db:Database,body:unknown,now:number){
 if(!body||typeof body!=='object'||Array.isArray(body))throw invalid();
 const data=body as Record<string,unknown>;
 if(Object.keys(data).sort().join(',')!=='newPassword,token'||validatePasswordShape(data.newPassword)!==null)throw new ApiError(422,'invalid_reset_request');
 let digest:string;try{digest=await digestOpaqueToken(data.token as string)}catch{throw invalid()}
 const row=await db.prepare(`SELECT t.account_id FROM player_one_time_tokens t JOIN player_accounts a ON a.id=t.account_id
 WHERE t.token_digest=? AND t.purpose='reset_password' AND t.consumed_at IS NULL AND t.expires_at>?
 AND a.status='active' AND a.email_verified_at IS NOT NULL`).bind(digest,now).first<{account_id:string}>();
 if(!row)throw invalid();
 const {hashPassword}=await import('./passwords.ts');
 const verifier=await hashPassword(data.newPassword as string);
 try{
  const changes=await db.batch([
   abortUnless(db,"SELECT 1 FROM player_one_time_tokens t JOIN player_accounts a ON a.id=t.account_id WHERE t.token_digest=? AND t.purpose='reset_password' AND t.consumed_at IS NULL AND t.expires_at>? AND a.status='active' AND a.email_verified_at IS NOT NULL",[digest,now]),
   db.prepare(`UPDATE player_one_time_tokens SET consumed_at=? WHERE token_digest=? AND purpose='reset_password'
   AND consumed_at IS NULL AND expires_at>? AND EXISTS(SELECT 1 FROM player_accounts WHERE id=player_one_time_tokens.account_id AND status='active')`).bind(now,digest,now),
   db.prepare(`UPDATE player_accounts SET password_verifier=?,credential_version=credential_version+1,updated_at=?
   WHERE id=? AND status='active' AND EXISTS
   (SELECT 1 FROM player_one_time_tokens WHERE token_digest=? AND purpose='reset_password' AND consumed_at=?)`).bind(verifier,now,row.account_id,digest,now),
   db.prepare("DELETE FROM player_sessions WHERE account_id=?").bind(row.account_id),
   // Password recovery for an Admin-linked Player must also invalidate any
   // historical Admin sessions, not just unified Player sessions.
   db.prepare(`DELETE FROM admin_sessions WHERE account_id IN
    (SELECT legacy_admin_account_id FROM player_admin_operator_links WHERE player_account_id=?)`).bind(row.account_id),
   // Invalidate all other outstanding one-time links (including verification).
   // Keep the consumed reset record so a replay remains unambiguously spent.
   db.prepare("DELETE FROM player_one_time_tokens WHERE account_id=? AND token_digest<>?").bind(row.account_id,digest)
  ]);
  if(changes[1].meta.changes!==1||changes[2].meta.changes!==1)throw Error('reset_race');
 }catch{throw invalid()}
 return {reset:true,sessionsRevoked:true};
}
