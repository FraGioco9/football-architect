import {ApiError} from './errors.ts';
import type {AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {abortUnless} from './atomic-guard.ts';
export {abortUnless} from './atomic-guard.ts';
import type {PrepareRequest} from './command-contract.ts';
import {parseWorldV1,type WorldV1} from './types.ts';
import {requireActiveSession,type SessionRow} from './session-policy.ts';
import {unifiedAdminMutationGuard} from './unified-admin-transaction.ts';
import {requireAccountPermission} from './account-permissions.ts';
import {playerSessionValid} from './player-auth.ts';
export interface Outcome {world:WorldV1;operationId:string}
interface OperationRow {id:string;account_id:string;request_hash:string;outcome_json:string}
export function sessionGuard(db:Database,session:AdminSession,now:number){
 if(session.unified)return unifiedAdminMutationGuard(db,session.unified.playerId,session.actor.id,session.unified.sessionDigest,session.unified.csrfDigest,now);
 return abortUnless(db,`SELECT 1 FROM admin_sessions s JOIN admin_accounts a ON a.id=s.account_id
  WHERE s.token_digest=? AND s.account_id=? AND s.credential_version=? AND s.csrf_digest=?
  AND a.enabled=1 AND a.credential_version=s.credential_version
  AND s.created_at>=0 AND s.created_at<=? AND s.last_seen_at>=s.created_at
  AND s.last_seen_at<=? AND s.last_seen_at>? AND s.expires_at>?
  AND s.expires_at<=s.created_at+28800`,
 [session.digest,session.actor.id,session.credentialVersion,session.csrfDigest,now,now,now-1800,now]);
}
function savedOutcome(row:OperationRow,session:AdminSession,hash:string):Outcome{
 if(row.account_id!==session.actor.id||row.request_hash!==hash)throw new ApiError(409,'idempotency_conflict');
 try{
  const value=JSON.parse(row.outcome_json) as Outcome;
  if(value.operationId!==row.id)throw Error('invalid outcome');
  return {world:parseWorldV1(value.world),operationId:value.operationId};
 }catch{throw new ApiError(503,'prepare_unavailable')}
}
export async function replay(db:Database,session:AdminSession,command:PrepareRequest,key:string,hash:string,now:number):Promise<Outcome|null>{
 // An idempotent result still requires a live credential/session and the original world generation.
 try{await db.batch([sessionGuard(db,session,now)])}catch{
  // A failed integrity guard and unavailable storage must not share a 401 response.
  if(session.unified){
   const live=await db.prepare(`SELECT s.account_id,a.email_normalized,s.credential_version,
    a.credential_version AS account_version,a.status,a.email_verified_at,s.csrf_digest,
    s.created_at,s.last_seen_at,s.expires_at
    FROM player_sessions s JOIN player_accounts a ON a.id=s.account_id
    WHERE s.token_digest=? AND s.account_id=?`)
    .bind(session.unified.sessionDigest,session.unified.playerId).first<any>();
   if(!playerSessionValid(live,now)||live.csrf_digest!==session.unified.csrfDigest)
    throw new ApiError(401,'unauthorized');
   const match=await db.prepare(`SELECT 1 AS linked FROM player_admin_operator_links l
    JOIN admin_accounts a ON a.id=l.legacy_admin_account_id
    JOIN player_accounts p ON p.id=l.player_account_id
    WHERE l.player_account_id=? AND l.legacy_admin_account_id=? AND a.enabled=1
    AND p.status='active' AND p.email_verified_at IS NOT NULL
    AND p.email_normalized=a.email_normalized`)
    .bind(session.unified.playerId,session.actor.id).first<{linked:number}>();
   if(!match)throw new ApiError(403,'permission_denied');
   await requireAccountPermission(db,session.unified.playerId,'admin.access');
   await requireAccountPermission(db,session.unified.playerId,'admin.world.write');
   throw new ApiError(503,'prepare_unavailable');
  }
  const row=await db.prepare(`SELECT s.account_id,s.credential_version AS session_credential_version,
   a.credential_version AS account_credential_version,a.enabled,s.created_at,s.last_seen_at,s.expires_at,s.csrf_digest
   FROM admin_sessions s JOIN admin_accounts a ON a.id=s.account_id WHERE s.token_digest=?`)
   .bind(session.digest).first<SessionRow&{csrf_digest:string}>();
  requireActiveSession(row,now);
  if(row!.account_id!==session.actor.id||row!.session_credential_version!==session.credentialVersion||row!.csrf_digest!==session.csrfDigest)throw new ApiError(401,'unauthorized');
  throw new ApiError(503,'prepare_unavailable');
 }
 const world=await db.prepare('SELECT generation FROM world_state WHERE id=1').first<{generation:string}>();
 if(!world)throw new ApiError(503,'prepare_unavailable');
 if(world.generation!==command.expectedGeneration)throw new ApiError(409,'stale_world');
 const row=await db.prepare('SELECT id,account_id,request_hash,outcome_json FROM admin_operations WHERE generation=? AND idempotency_key=?')
  .bind(command.expectedGeneration,key).first<OperationRow>();
 return row?savedOutcome(row,session,hash):null;
}
