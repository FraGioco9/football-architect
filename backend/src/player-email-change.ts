import type {Database} from './database.ts';
import {ApiError} from './errors.ts';
import {parseOperatorEmail} from './email-identity.ts';
import {validatePasswordShape} from './password-policy.ts';
import {verifyPassword} from './passwords.ts';
import {createOpaqueToken,digestOpaqueToken} from './session-tokens.ts';
import {reservePlayerAuthThrottle} from './auth-throttle-policy.ts';
import type {VerificationDelivery} from './player-registration.ts';

type Identity={actor:{id:string;email:string};digest:string};
const accepted={accepted:true,verificationRequired:true};

export async function requestPlayerEmailChange(db:Database,session:Identity,input:Record<string,unknown>,source:string,now:number,deliver:VerificationDelivery,locale:string){
 if(validatePasswordShape(input.currentPassword)!==null)throw new ApiError(422,'invalid_account_request');
 let email:string;
 try{email=parseOperatorEmail(input.email)}catch{throw new ApiError(422,'invalid_account_request')}
 if(email===session.actor.email)throw new ApiError(422,'email_unchanged');
 await reservePlayerAuthThrottle(db,'emailChange',session.actor.email,source,now);
 const account=await db.prepare(`SELECT password_verifier,credential_version,
  EXISTS(SELECT 1 FROM player_admin_operator_links WHERE player_account_id=a.id) AS linked
  FROM player_accounts a WHERE a.id=? AND a.email_normalized=? AND a.status='active' AND a.email_verified_at IS NOT NULL`)
  .bind(session.actor.id,session.actor.email).first<{password_verifier:string;credential_version:number;linked:number}>();
 if(!account||!await verifyPassword(input.currentPassword as string,account.password_verifier))throw new ApiError(403,'invalid_credentials');
 if(account.linked)throw new ApiError(409,'admin_transfer_required');
 const oldToken=createOpaqueToken(),newToken=createOpaqueToken();
 const [oldDigest,newDigest]=await Promise.all([digestOpaqueToken(oldToken),digestOpaqueToken(newToken)]);
 const saved=await db.prepare(`INSERT INTO player_email_changes(account_id,new_email,credential_version,old_digest,new_digest,expires_at)
  SELECT a.id,?,a.credential_version,?,?,? FROM player_accounts a
  JOIN player_sessions s ON s.account_id=a.id AND s.credential_version=a.credential_version
  WHERE a.id=? AND a.email_normalized=? AND a.credential_version=? AND a.status='active'
   AND a.email_verified_at IS NOT NULL AND s.token_digest=? AND s.expires_at>? AND s.last_seen_at>?
   AND NOT EXISTS(SELECT 1 FROM player_admin_operator_links WHERE player_account_id=a.id)
   AND NOT EXISTS(SELECT 1 FROM player_accounts WHERE email_normalized=?)
  ON CONFLICT(account_id) DO UPDATE SET new_email=excluded.new_email,credential_version=excluded.credential_version,
   old_digest=excluded.old_digest,new_digest=excluded.new_digest,expires_at=excluded.expires_at,old_confirmed=0,new_confirmed=0`)
  .bind(email,oldDigest,newDigest,now+3600,session.actor.id,session.actor.email,account.credential_version,session.digest,now,now-604800,email).run();
 if(saved.meta.changes!==1)return accepted;
 try{
  await deliver(email,newToken,locale);
  await deliver(session.actor.email,oldToken,locale);
 }catch{
  await db.prepare('DELETE FROM player_email_changes WHERE account_id=? AND old_digest=?').bind(session.actor.id,oldDigest).run();
  throw new ApiError(503,'verification_unavailable');
 }
 return accepted;
}

export async function confirmPlayerEmailChange(db:Database,digest:string,now:number){
 const record=await db.prepare('SELECT account_id,old_digest FROM player_email_changes WHERE old_digest=? OR new_digest=?')
  .bind(digest,digest).first<{account_id:string;old_digest:string}>();
 if(!record)return null;
 const column=record.old_digest===digest?'old':'new';
 const results=await db.batch([
  db.prepare(`UPDATE player_email_changes AS c SET ${column}_confirmed=1
   WHERE account_id=? AND ${column}_digest=? AND ${column}_confirmed=0 AND expires_at>?
    AND EXISTS(SELECT 1 FROM player_accounts a WHERE a.id=c.account_id AND a.status='active'
     AND a.email_verified_at IS NOT NULL AND a.credential_version=c.credential_version)
    AND NOT EXISTS(SELECT 1 FROM player_admin_operator_links WHERE player_account_id=c.account_id)
    AND NOT EXISTS(SELECT 1 FROM player_accounts WHERE email_normalized=c.new_email)`)
   .bind(record.account_id,digest,now),
  db.prepare(`UPDATE player_accounts AS a
   SET email_normalized=c.new_email,email_verified_at=?,updated_at=?,credential_version=a.credential_version+1
   FROM player_email_changes c WHERE a.id=c.account_id AND c.account_id=? AND c.${column}_digest=?
    AND c.old_confirmed=1 AND c.new_confirmed=1 AND c.expires_at>? AND a.status='active'
    AND a.credential_version=c.credential_version
    AND NOT EXISTS(SELECT 1 FROM player_admin_operator_links WHERE player_account_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM player_accounts WHERE email_normalized=c.new_email)`)
   .bind(now,now,record.account_id,digest,now),
  db.prepare(`DELETE FROM player_sessions WHERE account_id=? AND changes()=1`).bind(record.account_id),
  db.prepare(`DELETE FROM player_one_time_tokens WHERE account_id=? AND EXISTS(
   SELECT 1 FROM player_email_changes c JOIN player_accounts a ON a.id=c.account_id
   WHERE c.account_id=? AND c.${column}_digest=? AND a.email_normalized=c.new_email AND a.credential_version>c.credential_version)`)
   .bind(record.account_id,record.account_id,digest),
  db.prepare(`DELETE FROM player_email_changes AS c WHERE account_id=? AND c.${column}_digest=? AND EXISTS(
   SELECT 1 FROM player_accounts a WHERE a.id=c.account_id AND a.email_normalized=c.new_email AND a.credential_version>c.credential_version)`)
   .bind(record.account_id,digest)
 ]);
 if(results[0].meta.changes!==1)throw new ApiError(400,'invalid_verification');
 return results[1].meta.changes===1?{verified:true}:{verified:false,remainingConfirmation:true};
}
