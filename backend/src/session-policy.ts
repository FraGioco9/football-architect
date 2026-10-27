import { ApiError } from './errors.ts';

export type SessionRow = Readonly<{
  account_id: string;
  session_credential_version: number;
  account_credential_version: number;
  enabled: number;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
}>;

const ABSOLUTE_SECONDS = 8 * 60 * 60;
const IDLE_SECONDS = 30 * 60;

/** Evaluate session validity at the point of use, not only on initial login. */
export function requireActiveSession(row: SessionRow | null, nowSeconds: number): string {
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0) {
    throw new ApiError(503, 'admin_unavailable');
  }
  if (!row ||
      row.enabled !== 1 ||
      !row.account_id ||
      !Number.isSafeInteger(row.session_credential_version) ||
      !Number.isSafeInteger(row.account_credential_version) ||
      row.session_credential_version < 1 ||
      row.account_credential_version !== row.session_credential_version ||
      !Number.isSafeInteger(row.created_at) ||
      !Number.isSafeInteger(row.last_seen_at) ||
      !Number.isSafeInteger(row.expires_at) ||
      row.created_at < 0 ||
      row.last_seen_at < row.created_at ||
      row.last_seen_at > nowSeconds ||
      row.expires_at <= row.created_at ||
      row.expires_at > row.created_at + ABSOLUTE_SECONDS ||
      nowSeconds >= row.expires_at ||
      nowSeconds - row.last_seen_at >= IDLE_SECONDS) {
    throw new ApiError(401, 'unauthorized');
  }
  return row.account_id;
}
