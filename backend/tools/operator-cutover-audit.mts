// Read-only, disposable/local D1 preflight. Does not create links, permissions or sessions.
import type {Database} from '../src/database.ts';

export type OperatorCutoverFinding='operator_missing'|'operator_disabled'|'player_missing'|'player_unverified'|'player_inactive'|'operator_link_missing'|'operator_link_conflict'|'missing_access'|'missing_read'|'missing_write';
type Row={operator_id:string|null;operator_enabled:number|null;player_id:string|null;player_status:string|null;verified:number|null;linked_operator:string|null;access_grant:number;read_grant:number;write_grant:number};
/** Never includes email, password verifier, token or account identifiers in the report. */
export async function auditOperatorCutover(db:Database,email:string){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email!==email.trim().toLowerCase())throw Error('normalized_email_required');
 const row=await db.prepare(`SELECT
 legacy.id AS operator_id,legacy.enabled AS operator_enabled,
 player.id AS player_id,player.status AS player_status,
 CASE WHEN player.email_verified_at IS NOT NULL THEN 1 ELSE 0 END AS verified,
 link.legacy_admin_account_id AS linked_operator,
 CASE WHEN EXISTS(SELECT 1 FROM account_permissions p WHERE p.account_id=player.id AND p.permission='admin.access') THEN 1 ELSE 0 END AS access_grant,
 CASE WHEN EXISTS(SELECT 1 FROM account_permissions p WHERE p.account_id=player.id AND p.permission='admin.world.read') THEN 1 ELSE 0 END AS read_grant,
 CASE WHEN EXISTS(SELECT 1 FROM account_permissions p WHERE p.account_id=player.id AND p.permission='admin.world.write') THEN 1 ELSE 0 END AS write_grant
 FROM (SELECT ? AS email) requested
 LEFT JOIN admin_accounts legacy ON legacy.email_normalized=requested.email
 LEFT JOIN player_accounts player ON player.email_normalized=requested.email
 LEFT JOIN player_admin_operator_links link ON link.player_account_id=player.id`).bind(email).first<Row>();
 const findings:OperatorCutoverFinding[]=[];
 if(!row?.operator_id)findings.push('operator_missing');
 else if(row.operator_enabled!==1)findings.push('operator_disabled');
 if(!row?.player_id)findings.push('player_missing');
 else{
  if(row.player_status!=='active')findings.push('player_inactive');
  if(row.verified!==1)findings.push('player_unverified');
  if(!row.linked_operator)findings.push('operator_link_missing');
  else if(row.linked_operator!==row.operator_id)findings.push('operator_link_conflict');
  if(row.access_grant!==1)findings.push('missing_access');
  if(row.read_grant!==1)findings.push('missing_read');
  if(row.write_grant!==1)findings.push('missing_write');
 }
 return {ready:findings.length===0,findings};
}
