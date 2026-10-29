import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {abortUnless} from './command-guards.ts';

/**
 * Trusted, offline-only migration operation. Never expose this function from
 * a self-service Player/Admin HTTP route. The operator supplies both explicit
 * immutable IDs after out-of-band identity verification.
 */
export async function linkExistingAdminOperator(
 db:Database,
 selection:{playerAccountId:string;legacyAdminId:string;approvedBy:string},
 now:number
):Promise<{linked:true;permissions:3}>{
 const {playerAccountId,legacyAdminId,approvedBy}=selection;
 if(![playerAccountId,legacyAdminId,approvedBy].every(x=>typeof x==='string'&&x.length>0&&x.length<=128)
    ||!Number.isSafeInteger(now)||now<=0)throw new ApiError(422,'invalid_admin_migration');
 // The same batch preserves old audit identities and prevents identity
 // reuse, implicit email matching and partial Admin permission grants.
 const results=await db.batch([
  abortUnless(db,`SELECT 1 FROM player_accounts p JOIN admin_accounts a ON a.id=?
    WHERE p.id=? AND p.status='active' AND p.email_verified_at IS NOT NULL
    AND a.enabled=1 AND p.email_normalized=a.email_normalized
    AND NOT EXISTS(SELECT 1 FROM player_admin_operator_links WHERE player_account_id=p.id OR legacy_admin_account_id=a.id)`,
    [legacyAdminId,playerAccountId]),
  db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
    .bind(playerAccountId,legacyAdminId,now),
  ...(['admin.access','admin.world.read','admin.world.write'] as const).map(permission=>
    db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at,granted_by) VALUES(?,?,?,?)')
      .bind(playerAccountId,permission,now,approvedBy))
 ]);
 if(results[1].meta.changes!==1||results.slice(2).some(row=>row.meta.changes!==1))
  throw new ApiError(503,'admin_migration_unavailable');
 return {linked:true,permissions:3};
}

/** Read-only inventory for a trusted migration review, never exposed to web clients. */
export async function adminOperatorMigrationInventory(db:Database){
 const rows=await db.prepare(`SELECT a.id AS legacyAdminId,a.email_normalized AS legacyEmail,
   a.enabled, l.player_account_id AS playerAccountId,
   p.status AS playerStatus,p.email_verified_at AS verifiedAt
   FROM admin_accounts a LEFT JOIN player_admin_operator_links l ON l.legacy_admin_account_id=a.id
   LEFT JOIN player_accounts p ON p.id=l.player_account_id ORDER BY a.id`)
 .all<{legacyAdminId:string;legacyEmail:string;enabled:number;playerAccountId:string|null;playerStatus:string|null;verifiedAt:number|null}>();
 return rows.results;
}

/** Trusted rollback of a prepared link. Historic admin_accounts and audit rows
 * are never removed. Revocation is atomic with session invalidation.
 */
export async function revokeMigratedAdminOperator(db:Database,playerAccountId:string,now:number){
 if(typeof playerAccountId!=='string'||!playerAccountId||!Number.isSafeInteger(now)||now<=0)
  throw new ApiError(422,'invalid_admin_migration');
 const results=await db.batch([
  abortUnless(db,'SELECT 1 FROM player_admin_operator_links WHERE player_account_id=?',[playerAccountId]),
  db.prepare("DELETE FROM account_permissions WHERE account_id=? AND permission IN ('admin.access','admin.world.read','admin.world.write')").bind(playerAccountId),
  db.prepare('DELETE FROM player_admin_operator_links WHERE player_account_id=?').bind(playerAccountId),
  db.prepare('DELETE FROM player_sessions WHERE account_id=?').bind(playerAccountId)
 ]);
 if(results[2].meta.changes!==1)throw new ApiError(503,'admin_migration_unavailable');
 return {revoked:true,sessionsRevoked:results[3].meta.changes};
}
