-- Local-first D1/SQLite schema. Never deploy this migration automatically.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS world_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  generation TEXT NOT NULL CHECK (length(generation) = 36),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  season_number INTEGER NOT NULL DEFAULT 0 CHECK (season_number >= 0),
  day INTEGER NOT NULL DEFAULT 0 CHECK (day BETWEEN 0 AND 56),
  phase TEXT NOT NULL DEFAULT 'unstarted'
    CHECK (phase IN ('unstarted','preparing','active','closed')),
  CHECK (
    (phase = 'unstarted' AND revision = 0 AND season_number = 0 AND day = 0)
    OR (phase = 'preparing' AND season_number > 0 AND day = 0)
    OR (phase = 'active' AND season_number > 0 AND day BETWEEN 1 AND 56)
    OR (phase = 'closed' AND season_number > 0 AND day = 56)
  )
);

CREATE TRIGGER IF NOT EXISTS world_cannot_delete
BEFORE DELETE ON world_state
BEGIN
  SELECT RAISE(ABORT, 'world singleton cannot be deleted');
END;

-- Seed only on first migration. Random UUIDv4 is not regenerated on repeat.
INSERT OR IGNORE INTO world_state (id, generation)
VALUES (1, lower(
  hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', 1 + (abs(random()) % 4), 1) ||
  substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))
));

CREATE TABLE IF NOT EXISTS seasons (
  season_number INTEGER PRIMARY KEY CHECK (season_number > 0),
  generation TEXT NOT NULL,
  participants_hash TEXT NOT NULL CHECK (length(participants_hash) = 64),
  rules_hash TEXT NOT NULL CHECK (length(rules_hash) = 64),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  UNIQUE(generation, season_number)
);

CREATE TRIGGER IF NOT EXISTS season_snapshot_immutable
BEFORE UPDATE OF generation, participants_hash, rules_hash, snapshot_json ON seasons
BEGIN
  SELECT RAISE(ABORT, 'season snapshot is immutable');
END;

CREATE TABLE IF NOT EXISTS admin_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE CHECK (length(email_normalized) BETWEEN 3 AND 254),
  password_verifier TEXT NOT NULL,
  credential_version INTEGER NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL CHECK (created_at > 0)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_digest TEXT PRIMARY KEY NOT NULL CHECK (length(token_digest) = 64),
  account_id TEXT NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
  credential_version INTEGER NOT NULL CHECK (credential_version > 0),
  csrf_digest TEXT NOT NULL CHECK (length(csrf_digest) = 64),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (last_seen_at >= created_at AND expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS sessions_by_account ON admin_sessions(account_id);

CREATE TABLE IF NOT EXISTS auth_throttles (
  throttle_key TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > window_start)
);
CREATE INDEX IF NOT EXISTS throttles_by_expiry ON auth_throttles(expires_at);

CREATE TABLE IF NOT EXISTS admin_operations (
  id TEXT PRIMARY KEY NOT NULL,
  generation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  account_id TEXT NOT NULL REFERENCES admin_accounts(id),
  command TEXT NOT NULL,
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision > expected_revision),
  outcome_json TEXT NOT NULL CHECK (json_valid(outcome_json)),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  UNIQUE(generation, idempotency_key)
);
