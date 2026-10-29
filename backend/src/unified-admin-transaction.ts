import type {Database} from './database.ts';
import {abortUnless} from './command-guards.ts';

/** Execute inside the same D1 batch as an Admin mutation. */
export function unifiedAdminMutationGuard(db:Database, actorId:string, sessionDigest:string, csrfDigest:string, now:number){
 return abortUnless(db, `SELECT 1 FROM player_sessions s JOIN player_accounts a ON a.id=s.account_id WHERE s.account_id=? AND s.token_digest=? AND s.csrf_digest=? AND a.status='active' AND a.email_verified_at IS NOT NULL AND a.credential_version=s.credential_version AND s.last_seen_at<=? AND s.last_seen_at>? AND s.expires_at>? AND s.expires_at<=s.created_at+2592000 AND EXISTS (SELECT 1 FROM account_permissions p WHERE p.account_id=a.id AND p.permission='admin.access') AND EXISTS (SELECT 1 FROM account_permissions p WHERE p.account_id=a.id AND p.permission='admin.world.write')`, [actorId,sessionDigest,csrfDigest,now,now-604800,now]);
}
