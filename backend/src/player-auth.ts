import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {parseOperatorEmail} from './email-identity.ts';
import {validatePasswordShape} from './password-policy.ts';
import {createOpaqueToken,digestOpaqueToken} from './session-tokens.ts';
import {hashText} from './auth.ts';

const MAX_AGE=30*86400,IDLE=7*86400;
const DUMMY='$argon2id$v=19$m=19456,t=2,p=1$MDEyMzQ1Njc4OWFiY2RlZg$'+'A'.repeat(43);
type Account={id:string;email_normalized:string;password_verifier:string;credential_version:number;status:string;email_verified_at:number|null};
type Session={account_id:string;email_normalized:string;credential_version:number;account_version:number;status:string;email_verified_at:number|null;csrf_digest:string;created_at:number;last_seen_at:number;expires_at:number};
const invalid=()=>new ApiError(401,'invalid_credentials');
export function playerSessionValid(row:Session|null,now:number):boolean {
 return !!row&&row.status==='active'&&row.email_verified_at!==null&&row.account_version===row.credential_version&&
 Number.isSafeInteger(row.created_at)&&Number.isSafeInteger(row.last_seen_at)&&Number.isSafeInteger(row.expires_at)&&
 row.created_at>0&&row.last_seen_at>=row.created_at&&row.last_seen_at<=now&&
 row.expires_at>now&&row.expires_at<=row.created_at+MAX_AGE&&now-row.last_seen_at<IDLE;
}
async function throttle(db:Database,email:string,source:string,now:number){
 const sql=`INSERT INTO player_auth_throttles(throttle_key,window_start,attempts,expires_at) VALUES(?,?,1,?)
 ON CONFLICT(throttle_key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,
 window_start=CASE WHEN expires_at<=? THEN ? ELSE window_start END,
 expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING attempts`;
 const sourceKey='source:'+await hashText(source),accountKey='account:'+await hashText(email);
 const reserve=async(key:string)=>db.prepare(sql).bind(key,now,now+900,now,now,now,now,now+900).first<{attempts:number}>();
 const src=await reserve(sourceKey);if(!src||src.attempts>30)throw new ApiError(429,'login_throttled');
 const acct=await reserve(accountKey);if(!acct||acct.attempts>5)throw new ApiError(429,'login_throttled');
}
export async function playerLogin(db:Database,input:unknown,source:string,now:number,previous?:string){
 if(!input||typeof input!=='object'||Array.isArray(input))throw invalid();
 const obj=input as Record<string,unknown>;
 if(Object.keys(obj).sort().join(',')!=='email,password'||validatePasswordShape(obj.password)!==null)throw invalid();
 let email:string;try{email=parseOperatorEmail(obj.email)}catch{throw invalid()}
 await throttle(db,email,source,now);
 const account=await db.prepare('SELECT id,email_normalized,password_verifier,credential_version,status,email_verified_at FROM player_accounts WHERE email_normalized=?').bind(email).first<Account>();
 const {verifyPassword}=await import('./passwords.ts');
 const good=await verifyPassword(obj.password as string,account?.status==='active'&&account.email_verified_at?account.password_verifier:DUMMY);
 if(!good||!account||account.status!=='active'||!account.email_verified_at)throw invalid();
 const token=createOpaqueToken(),digest=await digestOpaqueToken(token);
 const csrfToken=await hashText('fa-player-csrf-v1:'+token),csrfDigest=await digestOpaqueToken(csrfToken);
 let previousDigest='';try{if(previous)previousDigest=await digestOpaqueToken(previous)}catch{/* malformed cookie ignored */}
 const result=await db.batch([
  db.prepare(`INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at)
 SELECT ?,id,credential_version,?,?,?,? FROM player_accounts
 WHERE id=? AND status='active' AND email_verified_at IS NOT NULL AND credential_version=? AND password_verifier=?`)
   .bind(digest,csrfDigest,now,now,now+MAX_AGE,account.id,account.credential_version,account.password_verifier),
  db.prepare('DELETE FROM player_sessions WHERE token_digest=? AND account_id=? AND EXISTS(SELECT 1 FROM player_sessions WHERE token_digest=?)')
   .bind(previousDigest,account.id,digest)
 ]);
 if(result[0].meta.changes!==1)throw invalid();
 return {token,csrfToken,expiresAt:now+MAX_AGE,actor:{id:account.id,email:account.email_normalized}};
}
export async function playerAuthenticate(db:Database,token:string,now:number){
 let digest:string;try{digest=await digestOpaqueToken(token)}catch{throw new ApiError(401,'unauthorized')}
 const row=await db.prepare(`SELECT s.account_id,a.email_normalized,s.credential_version,a.credential_version AS account_version,
 a.status,a.email_verified_at,s.csrf_digest,s.created_at,s.last_seen_at,s.expires_at
 FROM player_sessions s JOIN player_accounts a ON a.id=s.account_id WHERE s.token_digest=?`).bind(digest).first<Session>();
 if(!playerSessionValid(row,now))throw new ApiError(401,'unauthorized');
 const result=await db.prepare(`UPDATE player_sessions SET last_seen_at=MAX(last_seen_at,?) WHERE token_digest=? AND expires_at>?
 AND last_seen_at>? AND last_seen_at<=? AND created_at<=? AND EXISTS(SELECT 1 FROM player_accounts a WHERE a.id=player_sessions.account_id
 AND a.status='active' AND a.email_verified_at IS NOT NULL AND a.credential_version=player_sessions.credential_version)`)
 .bind(now,digest,now,now-IDLE,now,now).run();
 if(result.meta.changes!==1)throw new ApiError(401,'unauthorized');
 return {actor:{id:row!.account_id,email:row!.email_normalized},digest,csrfDigest:row!.csrf_digest};
}
export async function playerRequireCsrf(digest:string,token:string|null){
 let actual='';try{actual=await digestOpaqueToken(token??'')}catch{throw new ApiError(403,'csrf_forbidden')}
 if(actual!==digest)throw new ApiError(403,'csrf_forbidden');
}

export const playerCsrfFor=async(token:string)=>hashText('fa-player-csrf-v1:'+token);
