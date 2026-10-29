import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {playerAuthenticate,playerRequireCsrf} from './player-auth.ts';
import type {AccountPermission} from './account-permissions.ts';

/** Shared administrative authorization boundary for the unified account system.
 * Does not authenticate legacy admin_sessions, does not authorize mutations by UI flags,
 * and does not create any legacy admin operator/audit identity.
 */
export async function authorizeUnifiedAdmin(
 db:Database,
 playerToken:string,
 now:number,
 permission:AccountPermission,
 csrfToken?:string|null
){
 const session=await playerAuthenticate(db,playerToken,now);
 if(permission!=='admin.access'&&permission!=='admin.world.read'&&permission!=='admin.world.write')
  throw new ApiError(403,'permission_denied');
 if(permission==='admin.world.write')await playerRequireCsrf(session.csrfDigest,csrfToken??null);
 // Read the link and BOTH required grants in one authoritative D1 statement.
 // No independent permission/link lookups can observe different operator states.
 const operator=await db.prepare(`SELECT l.legacy_admin_account_id AS id
  FROM player_accounts a
  JOIN player_admin_operator_links l ON l.player_account_id=a.id
  JOIN admin_accounts legacy ON legacy.id=l.legacy_admin_account_id
  WHERE a.id=? AND a.status='active' AND a.email_verified_at IS NOT NULL
   AND legacy.enabled=1 AND legacy.email_normalized=a.email_normalized
   AND EXISTS(SELECT 1 FROM account_permissions p
    WHERE p.account_id=a.id AND p.permission='admin.access')
   AND EXISTS(SELECT 1 FROM account_permissions p
    WHERE p.account_id=a.id AND p.permission=?)`)
  .bind(session.actor.id,permission).first<{id:string}>();
 if(!operator)throw new ApiError(403,'permission_denied');
 return {actor:session.actor,digest:session.digest,csrfDigest:session.csrfDigest,legacyOperatorId:operator.id};
}

/** Enforce explicit authorization; 'access' alone never grants read/write. */
export function adminPermissionForMethod(method:string):AccountPermission {
 if(method==='GET'||method==='HEAD')return 'admin.world.read';
 if(method==='POST'||method==='PUT'||method==='PATCH'||method==='DELETE')return 'admin.world.write';
 throw new ApiError(405,'method_not_allowed');
}
