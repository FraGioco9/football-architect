import type {Database} from '../../src/database.ts';
import {digestOpaqueToken} from '../../src/session-tokens.ts';
import {playerCsrfFor} from '../../src/player-auth.ts';

/** Authenticates a synthetic operator via the unified Player session.
 * Use only in disposable Worker/D1 test fixtures, never production provisioning.
 */
export async function seedUnifiedAdminHttp(db:Database,legacyId:string,email:string,now:number,token:string){
 const playerId='test-player-'+legacyId,csrf=await playerCsrfFor(token),digest=await digestOpaqueToken(token);
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
  .bind(playerId,email,'fixture-no-login',1,now-100,'active',now-100,now-100).run();
 await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
  .bind(playerId,legacyId,now-100).run();
 await db.prepare('INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)')
  .bind(digest,playerId,1,await digestOpaqueToken(csrf),now-100,now-10,now+3600).run();
 await db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>
  db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind(playerId,permission,now-100)));
 return {cookie:'fa_player_local='+token,csrf,playerId};
}
