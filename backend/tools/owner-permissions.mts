// Trusted offline owner tooling. Never import into a Worker/HTTP route.
import type {Database} from '../src/database.ts';
import {abortUnless} from '../src/atomic-guard.ts';
import {parseOperatorEmail} from '../src/email-identity.ts';
import {readAccountPermissions,ACCOUNT_PERMISSIONS} from '../src/account-permissions.ts';

export type AccountPool='dev-preview'|'production';
export function accountPool(environment:string):AccountPool{
 if(environment==='dev'||environment==='preview')return 'dev-preview';
 if(environment==='production')return 'production';
 throw Error('invalid_environment');
}
function checkTime(now:number){if(!Number.isSafeInteger(now)||now<=0)throw Error('invalid_time')}
async function requirePool(db:Database,environment:string){
 const pool=accountPool(environment);
 const row=await db.prepare('SELECT pool FROM account_environment_pool WHERE id=1').first<{pool:string}>();
 if(!row)throw Error('account_pool_unbound');
 if(row.pool!==pool)throw Error('account_pool_mismatch');
 return pool;
}
export async function initializeAccountPool(db:Database,environment:string,now:number){
 const pool=accountPool(environment);checkTime(now);
 const existing=await db.prepare('SELECT pool FROM account_environment_pool WHERE id=1').first<{pool:string}>();
 if(existing&&existing.pool!==pool)throw Error('account_pool_mismatch');
 await db.batch([
  db.prepare('INSERT INTO account_environment_pool(id,pool,initialized_at) SELECT 1,?,? WHERE NOT EXISTS(SELECT 1 FROM account_environment_pool WHERE id=1)').bind(pool,now),
  abortUnless(db,'SELECT 1 FROM account_environment_pool WHERE id=1 AND pool=?',[pool])
 ]);
 return {pool};
}
type AccountRow={id:string;email:string;status:string;verified:number|null;legacyId:string|null;legacyEmail:string|null;enabled:number|null};
export async function inspectAdminPermissions(db:Database,environment:string,emailInput:string){
 const pool=await requirePool(db,environment),email=parseOperatorEmail(emailInput);
 const row=await db.prepare(`SELECT p.id,p.email_normalized AS email,p.status,p.email_verified_at AS verified,
 l.legacy_admin_account_id AS legacyId,a.email_normalized AS legacyEmail,a.enabled
 FROM player_accounts p LEFT JOIN player_admin_operator_links l ON l.player_account_id=p.id
 LEFT JOIN admin_accounts a ON a.id=l.legacy_admin_account_id WHERE p.email_normalized=?`).bind(email).first<AccountRow>();
 if(!row)throw Error('account_not_found');
 const candidate=await db.prepare('SELECT id,enabled FROM admin_accounts WHERE email_normalized=?').bind(email).first<{id:string;enabled:number}>();
 const raw=await db.prepare('SELECT count(*) AS n FROM account_permissions WHERE account_id=?').bind(row.id).first<{n:number}>();
 return {pool,accountId:row.id,email:row.email,status:row.status,verified:row.verified!==null,
  legacyId:row.legacyId,legacyEmail:row.legacyEmail,legacyEnabled:row.enabled,
  legacyCandidateId:candidate?.id??null,rawGrants:raw?.n??0,
  permissions:await readAccountPermissions(db,row.id)};
}
export type PermissionChange={action:'grant'|'revoke';environment:string;email:string;expectedAccountId:string;legacyId?:string};
export async function changeAdminPermissions(db:Database,input:PermissionChange,now:number){
 checkTime(now);
 if(!input||!['grant','revoke'].includes(input.action))throw Error('invalid_action');
 if(input.action==='revoke'&&input.legacyId!==undefined)throw Error('invalid_arguments');
 const target=await inspectAdminPermissions(db,input.environment,input.email);
 if(!input.expectedAccountId||target.accountId!==input.expectedAccountId)throw Error('account_selection_changed');
 const grant=input.action==='grant';
 if(grant&&(target.status!=='active'||!target.verified))throw Error('account_not_verified');
 if(!grant&&target.rawGrants===0&&!target.legacyId)return {changed:false,pool:target.pool};
 if(input.legacyId&&target.legacyId&&input.legacyId!==target.legacyId)throw Error('legacy_selection_conflict');
 let legacyId=target.legacyId??input.legacyId??null;
 if(grant&&!legacyId&&target.legacyCandidateId)throw Error('explicit_legacy_selection_required');
 const createPrincipal=grant&&!legacyId;
 if(createPrincipal)legacyId=crypto.randomUUID();
 if(grant&&!createPrincipal){
  const legacy=await db.prepare(`SELECT id FROM admin_accounts a WHERE a.id=? AND a.email_normalized=? AND a.enabled=1
   AND NOT EXISTS(SELECT 1 FROM player_admin_operator_links l WHERE l.legacy_admin_account_id=a.id AND l.player_account_id<>?)`)
   .bind(legacyId,target.email,target.accountId).first();
  if(!legacy)throw Error('legacy_selection_conflict');
 }
 const statements=[
  abortUnless(db,'SELECT 1 FROM account_environment_pool WHERE id=1 AND pool=?',[target.pool]),
  abortUnless(db,`SELECT 1 FROM player_accounts WHERE id=? AND email_normalized=?${grant?" AND status='active' AND email_verified_at IS NOT NULL":''}`,[target.accountId,target.email])
 ];
 if(target.legacyId)statements.push(abortUnless(db,'SELECT 1 FROM player_admin_operator_links WHERE player_account_id=? AND legacy_admin_account_id=?',[target.accountId,target.legacyId]));
 else statements.push(abortUnless(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM player_admin_operator_links WHERE player_account_id=?)',[target.accountId]));
 if(grant){
  if(createPrincipal){
   statements.push(abortUnless(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM admin_accounts WHERE email_normalized=?)',[target.email]));
   statements.push(db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(legacyId,target.email,'!unified-player-audit-only',now));
  }
  statements.push(abortUnless(db,`SELECT 1 FROM admin_accounts a WHERE a.id=? AND a.email_normalized=? AND a.enabled=1
   AND NOT EXISTS(SELECT 1 FROM player_admin_operator_links WHERE (player_account_id=? AND legacy_admin_account_id<>?) OR (legacy_admin_account_id=? AND player_account_id<>?))`,[legacyId,target.email,target.accountId,legacyId,legacyId,target.accountId]));
  statements.push(db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?) ON CONFLICT(player_account_id) DO NOTHING').bind(target.accountId,legacyId,now));
  for(const permission of ACCOUNT_PERMISSIONS)statements.push(db.prepare(`INSERT INTO account_permissions(account_id,permission,granted_at,granted_by) VALUES(?,?,?,'local-owner-cli') ON CONFLICT(account_id,permission) DO NOTHING`).bind(target.accountId,permission,now));
 }else{
  statements.push(db.prepare('DELETE FROM account_permissions WHERE account_id=?').bind(target.accountId));
 }
 // No old Player session or recovery link may silently gain/recover new Admin access.
 statements.push(db.prepare('DELETE FROM player_sessions WHERE account_id=?').bind(target.accountId));
 statements.push(db.prepare('DELETE FROM player_one_time_tokens WHERE account_id=?').bind(target.accountId));
 if(legacyId)statements.push(db.prepare('DELETE FROM admin_sessions WHERE account_id=?').bind(legacyId));
 if(!grant)statements.push(db.prepare('DELETE FROM player_admin_operator_links WHERE player_account_id=?').bind(target.accountId));
 statements.push(db.prepare("INSERT INTO account_permission_events(id,action,pool,player_account_id,legacy_admin_account_id,approved_by,created_at) VALUES(?,?,?,?,?,'local-owner-cli',?)")
  .bind(crypto.randomUUID(),input.action,target.pool,target.accountId,legacyId,now));
 // Validate authorization postconditions before COMMIT; late errors roll back all writes.
 statements.push(grant?abortUnless(db,`SELECT 1 FROM player_accounts p JOIN player_admin_operator_links l ON l.player_account_id=p.id
 JOIN admin_accounts a ON a.id=l.legacy_admin_account_id WHERE p.id=? AND p.email_normalized=? AND p.status='active'
 AND p.email_verified_at IS NOT NULL AND a.enabled=1 AND a.email_normalized=p.email_normalized AND a.id=?
 AND (SELECT COUNT(*) FROM account_permissions WHERE account_id=p.id)=3`,[target.accountId,target.email,legacyId]):
 abortUnless(db,`SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM account_permissions WHERE account_id=?)
 AND NOT EXISTS(SELECT 1 FROM player_admin_operator_links WHERE player_account_id=?)`,[target.accountId,target.accountId]));
 await db.batch(statements);
 return {changed:true,pool:target.pool};
}
