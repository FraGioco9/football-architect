import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {abortUnless} from './atomic-guard.ts';

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
    AND NOT EXISTS(SELECT 1 FROM player_admin_operator_links WHERE player_account_id=p.id OR legacy_admin_account_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM account_permissions WHERE account_id=p.id AND permission IN ('admin.access','admin.world.read','admin.world.write'))`,
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

/** Reconcile migration readiness without granting any permissions. */
export async function adminOperatorMigrationReadiness(db:Database){
 const rows=await adminOperatorMigrationInventory(db);
 const permissions=await db.prepare(`SELECT p.account_id AS playerAccountId,
  COUNT(DISTINCT CASE WHEN p.permission IN ('admin.access','admin.world.read','admin.world.write')
  THEN p.permission END) AS permissionCount
  FROM account_permissions p JOIN player_admin_operator_links l ON l.player_account_id=p.account_id
  GROUP BY p.account_id`).all<{playerAccountId:string;permissionCount:number}>();
 const grants=new Map(permissions.results.map(row=>[row.playerAccountId,row.permissionCount]));
 const operators=rows.map(row=>({
  legacyAdminId:row.legacyAdminId,
  status:row.enabled!==1?'disabled':row.playerAccountId===null?'unlinked':
   row.playerStatus!=='active'||row.verifiedAt===null||row.playerEmail!==row.legacyEmail?'invalid_player':
   grants.get(row.playerAccountId)!==3?'missing_permissions':'linked'
 }));
 const blocked=operators.filter(x=>x.status!=='linked'&&x.status!=='disabled');
 // Any unlinked administrative grant is a privilege outside the approved cutover.
 // Report account IDs only: no email or password material leaves this offline inventory.
 const orphanRows=await db.prepare(`SELECT DISTINCT p.account_id AS playerAccountId
  FROM account_permissions p LEFT JOIN player_admin_operator_links l
   ON l.player_account_id=p.account_id
  WHERE p.permission IN ('admin.access','admin.world.read','admin.world.write')
   AND l.player_account_id IS NULL ORDER BY p.account_id`)
  .all<{playerAccountId:string}>();
 const orphanGrants=orphanRows.results.map(x=>x.playerAccountId);
 return {total:operators.length,linked:operators.filter(x=>x.status==='linked').length,
  disabled:operators.filter(x=>x.status==='disabled').length,
  blocked,orphanGrants,ready:blocked.length===0&&orphanGrants.length===0&&operators.some(x=>x.status==='linked')};
}

/** Read-only inventory for a trusted migration review, never exposed to web clients. */
export async function adminOperatorMigrationInventory(db:Database){
 const rows=await db.prepare(`SELECT a.id AS legacyAdminId,a.email_normalized AS legacyEmail,
   a.enabled, l.player_account_id AS playerAccountId,
   p.status AS playerStatus,p.email_normalized AS playerEmail,p.email_verified_at AS verifiedAt
   FROM admin_accounts a LEFT JOIN player_admin_operator_links l ON l.legacy_admin_account_id=a.id
   LEFT JOIN player_accounts p ON p.id=l.player_account_id ORDER BY a.id`)
 .all<{legacyAdminId:string;legacyEmail:string;enabled:number;playerAccountId:string|null;playerStatus:string|null;playerEmail:string|null;verifiedAt:number|null}>();
 return rows.results;
}

/** Trusted rollback of a prepared link. Historic admin_accounts and audit rows
 * are never removed. Revocation is atomic with session invalidation.
 */
export async function revokeMigratedAdminOperator(db:Database,playerAccountId:string,now:number){
 if(typeof playerAccountId!=='string'||!playerAccountId||!Number.isSafeInteger(now)||now<=0)
  throw new ApiError(422,'invalid_admin_migration');
 const results=await db.batch([
  // Rollback must remain available even after identity drift or operator disablement.
  abortUnless(db,'SELECT 1 FROM player_admin_operator_links WHERE player_account_id=?',[playerAccountId]),
  db.prepare("DELETE FROM account_permissions WHERE account_id=? AND permission IN ('admin.access','admin.world.read','admin.world.write')").bind(playerAccountId),
  db.prepare('DELETE FROM player_admin_operator_links WHERE player_account_id=?').bind(playerAccountId),
  db.prepare('DELETE FROM player_sessions WHERE account_id=?').bind(playerAccountId)
 ]);
 if(results[2].meta.changes!==1)throw new ApiError(503,'admin_migration_unavailable');
 return {revoked:true,sessionsRevoked:results[3].meta.changes};
}
