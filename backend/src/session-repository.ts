import { ApiError } from './errors.ts';
import { digestOpaqueToken } from './session-tokens.ts';
import { requireActiveSession, type SessionRow } from './session-policy.ts';

interface Query {
  bind(...params: unknown[]): {first<T>(): Promise<T|null>};
}
export interface SessionDatabase {
  prepare(sql:string): Query;
}

/** Look up only by a SHA-256 digest; plaintext cookies never reach SQL. */
export async function requireStoredSession(
  database: SessionDatabase | null | undefined,
  token: string,
  nowSeconds: number,
): Promise<string> {
  if (!database || typeof database.prepare !== 'function') {
    throw new ApiError(503,'admin_unavailable');
  }
  let digest: string;
  try { digest = await digestOpaqueToken(token); }
  catch { throw new ApiError(401,'unauthorized'); }
  try {
    const row = await database.prepare(
      `SELECT s.account_id, s.credential_version AS session_credential_version,
              a.credential_version AS account_credential_version, a.enabled,
              s.created_at, s.last_seen_at, s.expires_at
         FROM admin_sessions s
         JOIN admin_accounts a ON a.id = s.account_id
        WHERE s.token_digest = ?`
    ).bind(digest).first<SessionRow>();
    return requireActiveSession(row,nowSeconds);
  } catch(error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503,'admin_unavailable');
  }
}
