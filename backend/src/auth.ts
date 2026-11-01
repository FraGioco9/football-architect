import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {parseOperatorEmail} from './email-identity.ts';
import {validatePasswordShape} from './password-policy.ts';
import {createOpaqueToken,digestOpaqueToken,getSessionDeadlines} from './session-tokens.ts';
import {requireActiveSession,type SessionRow} from './session-policy.ts';

export interface AdminSession {actor:{id:string;email:string};digest:string;credentialVersion:number;csrfDigest:string;unified?:{playerId:string;sessionDigest:string;csrfDigest:string}}
interface Account {id:string;email_normalized:string;password_verifier:string;credential_version:number;enabled:number}
interface StoredSession extends SessionRow {email_normalized:string;csrf_digest:string}
export async function hashText(value:string):Promise<string>{
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
}
export const csrfFor=async(token:string)=>hashText('fa-admin-csrf-v1:'+token);
// Fixed synthetic verifier, never an account. Unknown/disabled users pay the same Argon2 cost.
// The tag is deliberately unrelated to any provisioned operator credential.
const DUMMY='$argon2id$v=19$m=19456,t=2,p=1$MDEyMzQ1Njc4OWFiY2RlZg$'+ 'A'.repeat(43);
export async function reserveLogin(db:Database,email:string,source:string,now:number):Promise<{accountKey:string;windowStart:number}>{
 const keys=['account:'+await hashText(email),'source:'+await hashText(source)];
 const sql=`INSERT INTO auth_throttles(throttle_key,window_start,attempts,expires_at) VALUES(?,?,1,?)
 ON CONFLICT(throttle_key) DO UPDATE SET
 attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,
 window_start=CASE WHEN expires_at<=? THEN ? ELSE window_start END,
 expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING attempts,window_start`;
 // Expiry cleanup is bounded; it cannot scan/delete an unbounded request workload.
 await db.batch([
  db.prepare('DELETE FROM auth_throttles WHERE throttle_key IN (SELECT throttle_key FROM auth_throttles WHERE expires_at<=? ORDER BY expires_at LIMIT 64)').bind(now),
  db.prepare('DELETE FROM admin_sessions WHERE token_digest IN (SELECT token_digest FROM admin_sessions WHERE expires_at<=? OR last_seen_at<=? ORDER BY expires_at LIMIT 64)').bind(now,now-1800)
 ]);
 // Reserve/check source first: a denied source cannot create arbitrary account rows.
 const sourceResult=await db.prepare(sql).bind(keys[1],now,now+900,now,now,now,now,now+900).run<{attempts:number}>();
 const sourceAttempts=Number(sourceResult.results[0]?.attempts);
 if(!Number.isSafeInteger(sourceAttempts)||sourceAttempts<1)throw new ApiError(503,'admin_unavailable');
 if(sourceAttempts>30)throw new ApiError(429,'login_throttled');
 const accountResult=await db.prepare(sql).bind(keys[0],now,now+900,now,now,now,now,now+900).run<{attempts:number;window_start:number}>();
 const accountAttempts=Number(accountResult.results[0]?.attempts);
 if(!Number.isSafeInteger(accountAttempts)||accountAttempts<1)throw new ApiError(503,'admin_unavailable');
 if(accountAttempts>5)throw new ApiError(429,'login_throttled');
 return {accountKey:keys[0],windowStart:Number(accountResult.results[0].window_start)};
}
export async function login(db:Database,input:unknown,source:string,now:number,previousToken?:string){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new ApiError(400,'invalid_credentials');
 const value=input as Record<string,unknown>;
 if(Object.keys(value).sort().join(',')!=='email,password'||validatePasswordShape(value.password)!==null)throw new ApiError(400,'invalid_credentials');
 let email:string;try{email=parseOperatorEmail(value.email)}catch{throw new ApiError(400,'invalid_credentials')}
 const reservation=await reserveLogin(db,email,source,now);
 const account=await db.prepare('SELECT id,email_normalized,password_verifier,credential_version,enabled FROM admin_accounts WHERE email_normalized=?').bind(email).first<Account>();
 const {verifyPassword}=await import('./passwords.ts');
 const valid=await verifyPassword(value.password as string,account?.enabled===1?account.password_verifier:DUMMY);
 if(!valid||!account||account.enabled!==1)throw new ApiError(401,'invalid_credentials');
 const token=createOpaqueToken(),digest=await digestOpaqueToken(token),csrfToken=await csrfFor(token),csrfDigest=await digestOpaqueToken(csrfToken);
 const expires=getSessionDeadlines(now).absoluteExpiresAt;
 let previous='';try{if(previousToken)previous=await digestOpaqueToken(previousToken)}catch{/* Invalid previous cookie confers no authority. */}
 const result=await db.batch([
  db.prepare(`INSERT INTO admin_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at)
   SELECT ?,id,credential_version,?,?,?,? FROM admin_accounts WHERE id=? AND enabled=1 AND credential_version=? AND password_verifier=?`)
   .bind(digest,csrfDigest,now,now,expires,account.id,account.credential_version,account.password_verifier),
  db.prepare('DELETE FROM admin_sessions WHERE token_digest=? AND account_id=? AND EXISTS(SELECT 1 FROM admin_sessions WHERE token_digest=?)').bind(previous,account.id,digest),
  db.prepare('UPDATE auth_throttles SET attempts=MAX(attempts-1,0) WHERE throttle_key=? AND window_start=? AND EXISTS(SELECT 1 FROM admin_sessions WHERE token_digest=?)').bind(reservation.accountKey,reservation.windowStart,digest)
 ]);
 if(result[0].meta.changes!==1)throw new ApiError(401,'invalid_credentials');
 return {token,csrfToken,actor:{id:account.id,email:account.email_normalized},expiresAt:expires};
}
export async function authenticate(db:Database,token:string,now:number):Promise<AdminSession>{
 let digest:string;try{digest=await digestOpaqueToken(token)}catch{throw new ApiError(401,'unauthorized')}
 const sql=`SELECT s.account_id,s.credential_version AS session_credential_version,
 a.credential_version AS account_credential_version,a.enabled,a.email_normalized,s.csrf_digest,
 s.created_at,s.last_seen_at,s.expires_at FROM admin_sessions s JOIN admin_accounts a ON a.id=s.account_id WHERE s.token_digest=?`;
 const row=await db.prepare(sql).bind(digest).first<StoredSession>();
 requireActiveSession(row,now);
 const touched=await db.prepare(`UPDATE admin_sessions SET last_seen_at=MAX(last_seen_at,?) WHERE token_digest=?
 AND expires_at>? AND last_seen_at>? AND created_at<=? AND EXISTS(SELECT 1 FROM admin_accounts a
 WHERE a.id=admin_sessions.account_id AND a.enabled=1 AND a.credential_version=admin_sessions.credential_version)`).bind(now,digest,now,now-1800,now).run();
 if(touched.meta.changes!==1)throw new ApiError(401,'unauthorized');
 return {actor:{id:row!.account_id,email:row!.email_normalized},digest,credentialVersion:row!.session_credential_version,csrfDigest:row!.csrf_digest};
}
export async function requireCsrf(session:AdminSession,value:string|null):Promise<void>{
 let digest='';try{digest=await digestOpaqueToken(value??'')}catch{throw new ApiError(403,'csrf_forbidden')}
 if(digest!==session.csrfDigest)throw new ApiError(403,'csrf_forbidden');
}
