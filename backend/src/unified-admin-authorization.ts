import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {playerAuthenticate,playerRequireCsrf} from './player-auth.ts';
import {requireAccountPermission,type AccountPermission} from './account-permissions.ts';
import {linkedAuditOperator} from './unified-admin-transaction.ts';

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
 await requireAccountPermission(db,session.actor.id,'admin.access');
 await requireAccountPermission(db,session.actor.id,permission);
 if(permission==='admin.world.write')await playerRequireCsrf(session.csrfDigest,csrfToken??null);
 const legacyOperatorId=await linkedAuditOperator(db,session.actor.id);
 if(!legacyOperatorId)throw new ApiError(403,'permission_denied');
 return {actor:session.actor,digest:session.digest,csrfDigest:session.csrfDigest,legacyOperatorId};
}

/** Enforce explicit authorization; 'access' alone never grants read/write. */
export function adminPermissionForMethod(method:string):AccountPermission {
 if(method==='GET'||method==='HEAD')return 'admin.world.read';
 if(method==='POST'||method==='PUT'||method==='PATCH'||method==='DELETE')return 'admin.world.write';
 throw new ApiError(405,'method_not_allowed');
}
