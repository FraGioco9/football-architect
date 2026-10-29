import type {Database} from './database.ts';
import {abortUnless} from './command-guards.ts';

/**
 * Atomic bridge for unified Admin commands. A linked historic operator is an
 * audit reference only, never an authority. Require current permissions and
 * link together inside the same batch as the sporting mutation.
 */
export function unifiedAdminMutationGuard(db:Database, actorId:string, legacyOperatorId:string, sessionDigest:string, csrfDigest:string, now:number){
 return abortUnless(db,`SELECT 1 FROM player_sessions s
 JOIN player_accounts a ON a.id=s.account_id
 JOIN player_admin_operator_links l ON l.player_account_id=a.id
 JOIN admin_accounts legacy ON legacy.id=l.legacy_admin_account_id
 WHERE s.account_id=? AND l.legacy_admin_account_id=?
 AND legacy.enabled=1 AND s.token_digest=? AND s.csrf_digest=?
 AND a.status='active' AND a.email_verified_at IS NOT NULL
 AND a.credential_version=s.credential_version
 AND s.created_at>0 AND s.created_at<=? AND s.last_seen_at>=s.created_at
 AND s.last_seen_at<=? AND s.last_seen_at>? AND s.expires_at>?
 AND s.expires_at<=s.created_at+2592000
 AND EXISTS (SELECT 1 FROM account_permissions p WHERE p.account_id=a.id AND p.permission='admin.access')
 AND EXISTS (SELECT 1 FROM account_permissions p WHERE p.account_id=a.id AND p.permission='admin.world.write')`,
 [actorId,legacyOperatorId,sessionDigest,csrfDigest,now,now,now-604800,now]);
}

/** Only an explicit D1 link may identify the legacy audit principal. */
export async function linkedAuditOperator(db:Database,playerAccountId:string):Promise<string|null>{
 const row=await db.prepare(`SELECT l.legacy_admin_account_id AS id
 FROM player_admin_operator_links l JOIN admin_accounts a ON a.id=l.legacy_admin_account_id
 WHERE l.player_account_id=? AND a.enabled=1`).bind(playerAccountId).first<{id:string}>();
 return row?.id??null;
}
