import {ApiError} from './errors.ts';
import {abortUnless} from './atomic-guard.ts';
import type {Database} from './database.ts';
import {validatePasswordShape} from './password-policy.ts';
import {verifyPassword,hashPassword} from './passwords.ts';

type Identity={actor:{id:string;email:string};digest:string;csrfDigest:string};
function ensureObject(value:unknown,fields:string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(422,'invalid_account_request');
 const body=value as Record<string,unknown>;
 if(Object.keys(body).sort().join(',')!==fields.sort().join(','))throw new ApiError(422,'invalid_account_request');
 return body;
}
export async function changePlayerPassword(db:Database,session:Identity,body:unknown,now:number){
 const data=ensureObject(body,['currentPassword','newPassword']);
 if(validatePasswordShape(data.currentPassword)!==null||validatePasswordShape(data.newPassword)!==null)
  throw new ApiError(422,'invalid_account_request');
 const row=await db.prepare("SELECT password_verifier,credential_version FROM player_accounts WHERE id=? AND status='active' AND email_verified_at IS NOT NULL")
  .bind(session.actor.id).first<{password_verifier:string;credential_version:number}>();
 if(!row||!await verifyPassword(data.currentPassword as string,row.password_verifier))throw new ApiError(401,'invalid_credentials');
 const passwordVerifier=await hashPassword(data.newPassword as string);
 const changes=await db.batch([
  abortUnless(db,"SELECT 1 FROM player_accounts a JOIN player_sessions s ON s.account_id=a.id WHERE a.id=? AND a.status='active' AND a.email_verified_at IS NOT NULL AND a.credential_version=? AND a.password_verifier=? AND s.token_digest=? AND s.account_id=a.id AND s.credential_version=a.credential_version AND s.created_at>0 AND s.created_at<=? AND s.last_seen_at>=s.created_at AND s.last_seen_at<=? AND s.last_seen_at>? AND s.expires_at>? AND s.expires_at<=s.created_at+2592000",[session.actor.id,row.credential_version,row.password_verifier,session.digest,now,now,now-604800,now]),
  db.prepare("UPDATE player_accounts SET password_verifier=?,credential_version=credential_version+1,updated_at=? WHERE id=? AND status='active' AND credential_version=? AND password_verifier=?")
  .bind(passwordVerifier,now,session.actor.id,row.credential_version,row.password_verifier),
  db.prepare("DELETE FROM player_sessions WHERE account_id=?").bind(session.actor.id),
  db.prepare(`DELETE FROM admin_sessions WHERE account_id IN
   (SELECT legacy_admin_account_id FROM player_admin_operator_links WHERE player_account_id=?)`).bind(session.actor.id),
  // Invalidate every outstanding one-time credential after a password change.
  db.prepare("DELETE FROM player_one_time_tokens WHERE account_id=?").bind(session.actor.id)
 ]);
 if(changes[1].meta.changes!==1)throw new ApiError(409,'credentials_changed');
 return {changed:true,sessionsRevoked:true};
}
export async function revokeOtherSessions(db:Database,session:Identity,now:number){
 const results=await db.batch([
  abortUnless(db,"SELECT 1 FROM player_sessions s JOIN player_accounts a ON a.id=s.account_id WHERE s.token_digest=? AND s.account_id=? AND a.status='active' AND a.email_verified_at IS NOT NULL AND a.credential_version=s.credential_version AND s.created_at>0 AND s.created_at<=? AND s.last_seen_at>=s.created_at AND s.last_seen_at<=? AND s.last_seen_at>? AND s.expires_at>? AND s.expires_at<=s.created_at+2592000",[session.digest,session.actor.id,now,now,now-604800,now]),
  db.prepare("DELETE FROM player_sessions WHERE account_id=? AND token_digest<>?").bind(session.actor.id,session.digest)
 ]);
 return {otherSessionsRevoked:results[1].meta.changes};
}
/** Account removal does not remove historical Admin audit records. Explicit
 * player->operator links are cascaded, while legacy admin_accounts remain.
 */
export async function deletePlayerAccount(db:Database,session:Identity,body:unknown,now:number){
 const data=ensureObject(body,['password','confirmation']);
 if(data.confirmation!=='DELETE MY ACCOUNT'||validatePasswordShape(data.password)!==null)
  throw new ApiError(422,'invalid_account_request');
 const account=await db.prepare("SELECT password_verifier FROM player_accounts WHERE id=? AND status='active' AND email_verified_at IS NOT NULL").bind(session.actor.id).first<{password_verifier:string}>();
 if(!account||!await verifyPassword(data.password as string,account.password_verifier))throw new ApiError(401,'invalid_credentials');
 // Deny deletion of the last linked administrator until a safe transfer is provisioned.
 const linked=await db.prepare("SELECT legacy_admin_account_id FROM player_admin_operator_links WHERE player_account_id=?").bind(session.actor.id).first<{legacy_admin_account_id:string}>();
 if(linked)throw new ApiError(409,'admin_transfer_required');
 const changes=await db.batch([
  abortUnless(db,"SELECT 1 FROM player_accounts a JOIN player_sessions s ON s.account_id=a.id WHERE a.id=? AND a.password_verifier=? AND a.status='active' AND a.email_verified_at IS NOT NULL AND s.token_digest=? AND s.credential_version=a.credential_version AND s.created_at>0 AND s.created_at<=? AND s.last_seen_at>=s.created_at AND s.last_seen_at<=? AND s.last_seen_at>? AND s.expires_at>? AND s.expires_at<=s.created_at+2592000 AND NOT EXISTS(SELECT 1 FROM player_admin_operator_links WHERE player_account_id=a.id)",[session.actor.id,account.password_verifier,session.digest,now,now,now-604800,now]),
  db.prepare("DELETE FROM player_accounts WHERE id=? AND password_verifier=? AND status='active'").bind(session.actor.id,account.password_verifier)
 ]);
 if(changes[1].meta.changes!==1)throw new ApiError(409,'account_changed');
 return {deleted:true};
}
