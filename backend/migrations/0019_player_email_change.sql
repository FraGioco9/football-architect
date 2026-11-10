CREATE TABLE player_email_changes (
  account_id TEXT PRIMARY KEY REFERENCES player_accounts(id) ON DELETE CASCADE,
  new_email TEXT NOT NULL,
  credential_version INTEGER NOT NULL,
  old_digest TEXT NOT NULL UNIQUE,
  new_digest TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  old_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (old_confirmed IN (0,1)),
  new_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (new_confirmed IN (0,1))
);
