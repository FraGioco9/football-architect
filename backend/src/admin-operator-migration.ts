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

/** Trusted offline cutover for a complete, explicitly approved set of Admin operators.
 * All mappings are committed in one D1 batch, or none are. No HTTP exposure.
 */
export async function migrateAdminOperatorsBatch(
 db:Database,
 selections:ReadonlyArray<{playerAccountId:string;legacyAdminId:string}>,
 approvedBy:string,
 now:number
):Promise<{linked:number;permissionsGranted:number}>{
 const valid=(x:unknown)=>typeof x==='string'&&x.length>0&&x.length<=128;
 if(!Array.isArray(selections)||selections.length===0||selections.length>32||
    !valid(approvedBy)||!Number.isSafeInteger(now)||now<=0)
  throw new ApiError(422,'invalid_admin_migration');
 const players=new Set<string>(),operators=new Set<string>();
 for(const pair of selections){
  if(!pair||!valid(pair.playerAccountId)||!valid(pair.legacyAdminId)||
    players.has(pair.playerAccountId)||operators.has(pair.legacyAdminId))
   throw new ApiError(422,'invalid_admin_migration');
  players.add(pair.playerAccountId);operators.add(pair.legacyAdminId);
 }
 const statements=[];
 for(const {playerAccountId,legacyAdminId} of selections){
  statements.push(abortUnless(db,`SELECT 1 FROM player_accounts p JOIN admin_accounts a ON a.id=?
   WHERE p.id=? AND p.status='active' AND p.email_verified_at IS NOT NULL
   AND a.enabled=1 AND p.email_normalized=a.email_normalized
   AND NOT EXISTS (SELECT 1 FROM player_admin_operator_links l
    WHERE l.player_account_id=p.id OR l.legacy_admin_account_id=a.id)
   AND NOT EXISTS (SELECT 1 FROM account_permissions g
    WHERE g.account_id=p.id AND g.permission IN ('admin.access','admin.world.read','admin.world.write'))`,
   [legacyAdminId,playerAccountId]));
  statements.push(db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
   .bind(playerAccountId,legacyAdminId,now));
  for(const permission of ['admin.access','admin.world.read','admin.world.write']){
   statements.push(db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at,granted_by) VALUES(?,?,?,?)')
    .bind(playerAccountId,permission,now,approvedBy));
  }
 }
 const result=await db.batch(statements);
 if(result.some((row,index)=>index%5!==0&&row.meta.changes!==1))
  throw new ApiError(503,'admin_migration_unavailable');
 return {linked:selections.length,permissionsGranted:selections.length*3};
}

/** Offline-only preflight for an explicitly approved operator mapping.
 * It never infers identity from email, mints grants or changes D1.
 */
export async function preflightAdminOperatorMigration(
 db:Database,selection:{playerAccountId:string;legacyAdminId:string}
):Promise<{eligible:boolean;reason:'eligible'|'invalid_identity'|'already_linked'|'existing_grants'}>{
 const {playerAccountId,legacyAdminId}=selection;
 if(![playerAccountId,legacyAdminId].every(x=>typeof x==='string'&&x.length>0&&x.length<=128))
  throw new ApiError(422,'invalid_admin_migration');
 const account=await db.prepare(`SELECT p.id,p.status,p.email_verified_at,p.email_normalized AS playerEmail,
  a.enabled,a.email_normalized AS legacyEmail FROM player_accounts p
  JOIN admin_accounts a ON a.id=? WHERE p.id=?`)
  .bind(legacyAdminId,playerAccountId).first<{
   id:string;status:string;email_verified_at:number|null;playerEmail:string;legacyEmail:string;enabled:number
  }>();
 if(!account||account.status!=='active'||account.email_verified_at===null||
    account.enabled!==1||account.playerEmail!==account.legacyEmail)
  return {eligible:false,reason:'invalid_identity'};
 const link=await db.prepare(`SELECT 1 FROM player_admin_operator_links
  WHERE player_account_id=? OR legacy_admin_account_id=? LIMIT 1`)
  .bind(playerAccountId,legacyAdminId).first();
 if(link)return {eligible:false,reason:'already_linked'};
 const grant=await db.prepare(`SELECT 1 FROM account_permissions WHERE account_id=?
  AND permission IN ('admin.access','admin.world.read','admin.world.write') LIMIT 1`)
  .bind(playerAccountId).first();
 if(grant)return {eligible:false,reason:'existing_grants'};
 return {eligible:true,reason:'eligible'};
}

/** Read-only cutover plan: require an explicit one-to-one mapping for every enabled
 * historical Admin. Does not infer IDs from email, award privileges, or change D1.
 */
export async function preflightAdminOperatorsBatch(
 db:Database,selections:ReadonlyArray<{playerAccountId:string;legacyAdminId:string}>
):Promise<{ready:boolean;totalEnabled:number;approved:number;blockers:Array<{legacyAdminId:string;reason:string}>}>{
 const valid=(x:unknown)=>typeof x==='string'&&x.length>0&&x.length<=128;
 if(!Array.isArray(selections)||selections.length===0||selections.length>32)
  throw new ApiError(422,'invalid_admin_migration');
 const players=new Set<string>(),operators=new Set<string>();
 for(const pair of selections){
  if(!pair||!valid(pair.playerAccountId)||!valid(pair.legacyAdminId)||
     players.has(pair.playerAccountId)||operators.has(pair.legacyAdminId))
   throw new ApiError(422,'invalid_admin_migration');
  players.add(pair.playerAccountId);operators.add(pair.legacyAdminId);
 }
 const inventory=await adminOperatorMigrationInventory(db);
 const enabled=inventory.filter(row=>row.enabled===1);
 const blockers:Array<{legacyAdminId:string;reason:string}>=[];
 for(const row of enabled){
  const selected=selections.find(item=>item.legacyAdminId===row.legacyAdminId);
  if(!selected){blockers.push({legacyAdminId:row.legacyAdminId,reason:'unmapped_operator'});continue}
  const result=await preflightAdminOperatorMigration(db,selected);
  if(!result.eligible)blockers.push({legacyAdminId:row.legacyAdminId,reason:result.reason});
 }
 for(const selected of selections){
  if(!enabled.some(row=>row.legacyAdminId===selected.legacyAdminId))
   blockers.push({legacyAdminId:selected.legacyAdminId,reason:'operator_not_enabled'});
 }
 const orphan=await db.prepare(`SELECT 1 FROM account_permissions p
  LEFT JOIN player_admin_operator_links l ON l.player_account_id=p.account_id
  WHERE p.permission IN ('admin.access','admin.world.read','admin.world.write')
  AND l.player_account_id IS NULL LIMIT 1`).first();
 if(orphan)blockers.push({legacyAdminId:'',reason:'orphan_admin_grants'});
 return {ready:blockers.length===0,totalEnabled:enabled.length,approved:selections.length,blockers};
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
  status:row.enabled!==1?(row.playerAccountId===null?'disabled':'disabled_linked'):
   row.playerAccountId===null?'unlinked':
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

/** Trusted offline rollback of an explicitly selected group of migrated operators.
 * D1 batch atomicity prevents partial privilege/session revocation.
 * Historic audit principals are intentionally untouched.
 */
export async function revokeMigratedAdminOperatorsBatch(
 db:Database,playerAccountIds:ReadonlyArray<string>,now:number
):Promise<{revoked:number;sessionsRevoked:number}>{
 const valid=(id:unknown)=>typeof id==='string'&&id.length>0&&id.length<=128;
 if(!Array.isArray(playerAccountIds)||playerAccountIds.length===0||playerAccountIds.length>32||
   !Number.isSafeInteger(now)||now<=0||playerAccountIds.some(id=>!valid(id))||
   new Set(playerAccountIds).size!==playerAccountIds.length)
  throw new ApiError(422,'invalid_admin_migration');
 const statements=[];
 for(const playerId of playerAccountIds){
  // A disabled operator or changed email must not prevent emergency rollback.
  statements.push(abortUnless(db,'SELECT 1 FROM player_admin_operator_links WHERE player_account_id=?',[playerId]));
  statements.push(db.prepare("DELETE FROM account_permissions WHERE account_id=? AND permission IN ('admin.access','admin.world.read','admin.world.write')").bind(playerId));
  statements.push(db.prepare('DELETE FROM player_admin_operator_links WHERE player_account_id=?').bind(playerId));
  statements.push(db.prepare('DELETE FROM player_sessions WHERE account_id=?').bind(playerId));
 }
 const results=await db.batch(statements);
 if(results.some((row,index)=>index%4===2&&row.meta.changes!==1))
  throw new ApiError(503,'admin_migration_unavailable');
 return {revoked:playerAccountIds.length,sessionsRevoked:results.reduce((sum,row,index)=>
  sum+(index%4===3?row.meta.changes:0),0)};
}
