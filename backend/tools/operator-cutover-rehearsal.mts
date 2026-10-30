// Disposable-D1 rehearsal only. Not exposed as an HTTP route or a CLI.
// A real cutover requires separate authorization and must NEVER call this module.
import type {Database} from '../src/database.ts';
import {auditOperatorCutover} from './operator-cutover-audit.mts';

const grants=['admin.access','admin.world.read','admin.world.write'] as const;
type Identity={playerId:string;legacyId:string;email:string};

/** Require two exact existing identities; never create an account or infer authority from email alone. */
export async function rehearseLocalOperatorGrant(db:Database,identity:Identity,now:number){
 if(!Number.isSafeInteger(now)||now<=0)throw Error('invalid_rehearsal_time');
 const existing=await db.prepare(`SELECT p.id AS player_id,l.id AS legacy_id
 FROM player_accounts p JOIN admin_accounts l ON l.email_normalized=p.email_normalized
 WHERE p.id=? AND l.id=? AND p.email_normalized=?
 AND p.status='active' AND p.email_verified_at IS NOT NULL AND l.enabled=1`)
  .bind(identity.playerId,identity.legacyId,identity.email).first<{player_id:string;legacy_id:string}>();
 if(!existing||!identity.playerId||!identity.legacyId)throw Error('rehearsal_identity_mismatch');
 const already=await db.prepare('SELECT legacy_admin_account_id AS id FROM player_admin_operator_links WHERE player_account_id=?')
  .bind(identity.playerId).first<{id:string}>();
 if(already&&already.id!==identity.legacyId)throw Error('rehearsal_link_conflict');
 // Rehearsal must never inherit a pre-existing foreign operator's grants.
 const otherLink=await db.prepare('SELECT player_account_id AS id FROM player_admin_operator_links WHERE legacy_admin_account_id=?')
  .bind(identity.legacyId).first<{id:string}>();
 if(otherLink&&otherLink.id!==identity.playerId)throw Error('rehearsal_link_conflict');
 await db.batch([
  db.prepare(`INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at)
   SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM player_accounts p JOIN admin_accounts a ON a.email_normalized=p.email_normalized
   WHERE p.id=? AND a.id=? AND p.email_normalized=? AND p.status='active' AND p.email_verified_at IS NOT NULL AND a.enabled=1)
   ON CONFLICT(player_account_id) DO NOTHING`).bind(identity.playerId,identity.legacyId,now,identity.playerId,identity.legacyId,identity.email),
  ...grants.map(permission=>db.prepare(`INSERT INTO account_permissions(account_id,permission,granted_at)
   SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM player_admin_operator_links WHERE player_account_id=? AND legacy_admin_account_id=?)
   ON CONFLICT(account_id,permission) DO NOTHING`).bind(identity.playerId,permission,now,identity.playerId,identity.legacyId))
 ]);
 const result=await auditOperatorCutover(db,identity.email);
 if(!result.ready)throw Error('rehearsal_not_ready');
 return {ready:true};
}
/** Rehearsal rollback is restrictive: drops rights and the synthetic link without deleting audit history. */
export async function rehearseLocalOperatorRevoke(db:Database,playerId:string){
 if(!playerId)throw Error('invalid_rehearsal_identity');
 const changes=await db.batch([
  db.prepare("DELETE FROM account_permissions WHERE account_id=? AND permission IN ('admin.access','admin.world.read','admin.world.write')").bind(playerId),
  db.prepare('DELETE FROM player_admin_operator_links WHERE player_account_id=?').bind(playerId),
  db.prepare('DELETE FROM player_sessions WHERE account_id=?').bind(playerId)
 ]);
 return {revoked:true,sessionCount:changes[2].meta.changes};
}
