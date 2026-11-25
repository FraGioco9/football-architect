// Disposable test-D1 fixture only: never provision production operators here.
import type {Database} from '../../src/database.ts';
import type {AdminSession} from '../../src/auth.ts';
import {createOpaqueToken,digestOpaqueToken} from '../../src/session-tokens.ts';
import {playerCsrfFor} from '../../src/player-auth.ts';

export async function seedUnifiedOperator(db:Database,operatorId:string,email:string,now:number,token:string){
 const playerId='unified-fixture-'+operatorId;
 const csrf=await playerCsrfFor(token);
 const digest=await digestOpaqueToken(token);
 const csrfDigest=await digestOpaqueToken(csrf);
 const session:AdminSession={
  actor:{id:operatorId,email},digest,credentialVersion:1,csrfDigest,
  unified:{playerId,sessionDigest:digest,csrfDigest}
 };
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(operatorId,email,'synthetic-no-login',now-100).run();
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(playerId,email,'synthetic-no-login',1,now-100,'active',now-100,now-100).run();
 await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)').bind(playerId,operatorId,now-100).run();
 await db.prepare('INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(digest,playerId,1,csrfDigest,now-100,now-10,now+3600).run();
 await db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind(playerId,permission,now-100)));
 return {session,csrf,cookie:'fa_player_local='+token,playerId};
}

/** Disposable test-only reauthentication: issue a new credential for the same
 * synthetic operator and revoke its old token. No permission/expiry policy change. */
export async function rotateUnifiedOperatorFixtureSession(db:Database,previous:AdminSession,now:number){
 if(!previous.unified)throw Error('unified fixture required');
 const token=createOpaqueToken(),digest=await digestOpaqueToken(token),csrfDigest=await digestOpaqueToken(await playerCsrfFor(token));
 const expiresAt=now+3600;
 const result=await db.batch([
  db.prepare("INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) SELECT ?,id,credential_version,?,?,?,? FROM player_accounts WHERE id=? AND status='active' AND email_verified_at IS NOT NULL AND credential_version=?").bind(digest,csrfDigest,now,now,expiresAt,previous.unified.playerId,previous.credentialVersion),
  db.prepare("DELETE FROM player_sessions WHERE token_digest=? AND account_id=? AND EXISTS(SELECT 1 FROM player_sessions WHERE token_digest=?)").bind(previous.unified.sessionDigest,previous.unified.playerId,digest)
 ]);
 if(result[0].meta.changes!==1||result[1].meta.changes!==1)throw Error('fixture session rotation failed');
 const session:AdminSession={...previous,digest,csrfDigest,unified:{...previous.unified,sessionDigest:digest,csrfDigest}};
 return {session,expiresAt};
}
