-- PLAYER-AUTH-01 local-only additive schema. No remote migration authorization.
-- Independent of admin_accounts/admin_sessions, world_state and sporting data.
CREATE TABLE IF NOT EXISTS player_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE CHECK (length(email_normalized) BETWEEN 3 AND 254),
  password_verifier TEXT NOT NULL CHECK (length(password_verifier) > 0),
  credential_version INTEGER NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  email_verified_at INTEGER CHECK (email_verified_at > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','disabled')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
);
CREATE TABLE IF NOT EXISTS player_sessions (
  token_digest TEXT PRIMARY KEY NOT NULL CHECK (length(token_digest) = 64),
  account_id TEXT NOT NULL REFERENCES player_accounts(id) ON DELETE CASCADE,
  credential_version INTEGER NOT NULL CHECK (credential_version > 0),
  csrf_digest TEXT NOT NULL CHECK (length(csrf_digest) = 64),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (last_seen_at >= created_at AND expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS player_sessions_by_account ON player_sessions(account_id);
CREATE INDEX IF NOT EXISTS player_sessions_by_expiry ON player_sessions(expires_at);
CREATE TABLE IF NOT EXISTS player_one_time_tokens (
  token_digest TEXT PRIMARY KEY NOT NULL CHECK (length(token_digest) = 64),
  account_id TEXT NOT NULL REFERENCES player_accounts(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
  issued_at INTEGER NOT NULL CHECK (issued_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > issued_at),
  consumed_at INTEGER CHECK (consumed_at >= issued_at),
  CHECK (consumed_at IS NULL OR consumed_at <= expires_at)
);
CREATE INDEX IF NOT EXISTS player_tokens_by_account_purpose
  ON player_one_time_tokens(account_id,purpose,expires_at);
CREATE TABLE IF NOT EXISTS player_auth_throttles (
  throttle_key TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > window_start)
);
CREATE INDEX IF NOT EXISTS player_throttles_by_expiry ON player_auth_throttles(expires_at);
