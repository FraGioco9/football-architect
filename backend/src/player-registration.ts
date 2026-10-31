import {abortUnless} from './atomic-guard.ts';
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {parseOperatorEmail} from './email-identity.ts';
import {validatePasswordShape} from './password-policy.ts';
import {createOpaqueToken,digestOpaqueToken} from './session-tokens.ts';
import {hashText} from './auth.ts';
import {parseRegistrationProfile} from './player-profile.ts';

/** Delivery is injected only by an explicitly configured server-side provider.
 * No public response, database row or log contains the raw verification token.
 */
export type VerificationDelivery=(email:string,token:string,locale?:string)=>Promise<void>;
const generic={accepted:true,verificationRequired:true};
async function throttle(db:Database,email:string,source:string,now:number){
 const sql=`INSERT INTO player_auth_throttles(throttle_key,window_start,attempts,expires_at)
 VALUES(?,?,1,?) ON CONFLICT(throttle_key) DO UPDATE SET
 attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,
 window_start=CASE WHEN expires_at<=? THEN ? ELSE window_start END,
 expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING attempts`;
 const reserve=async(key:string)=>db.prepare(sql).bind(key,now,now+3600,now,now,now,now,now+3600).first<{attempts:number}>();
 const sourceResult=await reserve('registration-source:'+await hashText(source));
 if(!sourceResult||sourceResult.attempts>10)throw new ApiError(429,'registration_throttled');
 const accountResult=await reserve('registration-account:'+await hashText(email));
 if(!accountResult||accountResult.attempts>3)throw new ApiError(429,'registration_throttled');
}
export async function registerPlayer(db:Database,input:unknown,source:string,now:number,deliver:VerificationDelivery,locale='en'){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new ApiError(422,'invalid_registration');
 const fields=input as Record<string,unknown>;
 if(Object.keys(fields).some(key=>!['email','password','username','nationality','city'].includes(key))||validatePasswordShape(fields.password)!==null)
  throw new ApiError(422,'invalid_registration');
 const profile=parseRegistrationProfile(fields);
 let email:string;try{email=parseOperatorEmail(fields.email)}catch{throw new ApiError(422,'invalid_registration')}
 await throttle(db,email,source,now);
 // Username availability is public, but must never depend on email existence.
 const taken=await db.prepare('SELECT id FROM player_accounts WHERE username=? COLLATE NOCASE').bind(profile.username).first();
 if(taken)throw new ApiError(409,'username_unavailable');
 // Existing emails are deliberately indistinguishable from new registration.
 const exists=await db.prepare('SELECT id FROM player_accounts WHERE email_normalized=?').bind(email).first<{id:string}>();
 if(exists)return generic;
 const {hashPassword}=await import('./passwords.ts');
 const verifier=await hashPassword(fields.password as string);
 const id=crypto.randomUUID(),token=createOpaqueToken(),digest=await digestOpaqueToken(token);
 const inserted=await db.batch([
  db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,status,created_at,updated_at,username,nationality,city) VALUES(?,?,?,\'pending\',?,?,?,?,?) ON CONFLICT DO NOTHING')
    .bind(id,email,verifier,now,now,profile.username,profile.nationality,profile.city),
  db.prepare(`INSERT INTO player_one_time_tokens(token_digest,account_id,purpose,issued_at,expires_at)
   SELECT ?,id,'verify_email',?,? FROM player_accounts
   WHERE id=? AND status='pending' AND email_verified_at IS NULL`).bind(digest,now,now+86400,id)
 ]);
 if(inserted[0].meta.changes!==1){
  const conflict=await db.prepare('SELECT id FROM player_accounts WHERE username=? COLLATE NOCASE').bind(profile.username).first();
  if(conflict)throw new ApiError(409,'username_unavailable');
  // Preserve generic duplicate-email behavior, including concurrent registrations.
  const duplicate=await db.prepare('SELECT id FROM player_accounts WHERE email_normalized=?').bind(email).first();
  if(duplicate)return generic;
  throw new ApiError(409,'username_unavailable');
 }
 try{await deliver(email,token,locale)}catch{
  // Don't leave an unrecoverable pending account if delivery fails.
  await db.prepare("DELETE FROM player_accounts WHERE id=? AND status='pending' AND email_verified_at IS NULL").bind(id).run();
  throw new ApiError(503,'verification_unavailable');
 }
 return generic;
}
export async function verifyPlayerEmail(db:Database,raw:unknown,now:number){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw as object).join(',')!=='token')
  throw new ApiError(422,'invalid_verification');
 let digest:string;try{digest=await digestOpaqueToken((raw as {token:string}).token)}catch{throw new ApiError(422,'invalid_verification')}
 const record=await db.prepare(`SELECT t.account_id FROM player_one_time_tokens t
 JOIN player_accounts a ON a.id=t.account_id
 WHERE t.token_digest=? AND t.purpose='verify_email' AND t.consumed_at IS NULL
 AND t.expires_at>? AND a.status='pending' AND a.email_verified_at IS NULL`)
 .bind(digest,now).first<{account_id:string}>();
 if(!record)throw new ApiError(400,'invalid_verification');
 try{
  const changes=await db.batch([
   abortUnless(db,"SELECT 1 FROM player_one_time_tokens t JOIN player_accounts a ON a.id=t.account_id WHERE t.token_digest=? AND t.purpose='verify_email' AND t.consumed_at IS NULL AND t.expires_at>? AND a.status='pending' AND a.email_verified_at IS NULL",[digest,now]),
   db.prepare(`UPDATE player_one_time_tokens SET consumed_at=? WHERE token_digest=?
     AND purpose='verify_email' AND consumed_at IS NULL AND expires_at>?`).bind(now,digest,now),
   db.prepare(`UPDATE player_accounts SET status='active',email_verified_at=?,updated_at=?
     WHERE id=? AND status='pending' AND email_verified_at IS NULL
     AND EXISTS(SELECT 1 FROM player_one_time_tokens WHERE token_digest=? AND consumed_at=?)`)
    .bind(now,now,record.account_id,digest,now),
   db.prepare("DELETE FROM player_one_time_tokens WHERE account_id=? AND purpose='verify_email' AND token_digest<>?").bind(record.account_id,digest)
  ]);
  if(changes[1].meta.changes!==1||changes[2].meta.changes!==1)throw Error('verify_race');
 }catch{throw new ApiError(400,'invalid_verification')}
 return {verified:true};
}
