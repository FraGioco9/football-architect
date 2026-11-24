-- Manual club licensing V1. No purchase, expiry, wallet or sporting authority.
-- One durable versioned state row per touched canonical club; revoked rows stay
-- to make optimistic comparisons detect assign/revoke ABA changes.
CREATE TABLE IF NOT EXISTS club_license_state (
  club_key TEXT PRIMARY KEY NOT NULL CHECK(length(club_key) BETWEEN 4 AND 6),
  account_id TEXT REFERENCES player_accounts(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK(version > 0),
  updated_at INTEGER NOT NULL CHECK(updated_at > 0),
  updated_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS club_license_state_by_account ON club_license_state(account_id);
-- Historical events retain opaque account IDs even after profile edits.
CREATE TABLE IF NOT EXISTS club_license_events (
  id TEXT PRIMARY KEY NOT NULL,
  club_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('assign','replace','revoke')),
  previous_account_id TEXT,
  account_id TEXT,
  operator_account_id TEXT NOT NULL,
  previous_version INTEGER NOT NULL CHECK(previous_version >= 0),
  version INTEGER NOT NULL CHECK(version = previous_version + 1),
  occurred_at INTEGER NOT NULL CHECK(occurred_at > 0),
  CHECK (
    (action = 'assign' AND previous_account_id IS NULL AND account_id IS NOT NULL)
    OR (action = 'replace' AND previous_account_id IS NOT NULL AND account_id IS NOT NULL AND previous_account_id != account_id)
    OR (action = 'revoke' AND previous_account_id IS NOT NULL AND account_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS club_license_events_by_club
  ON club_license_events(club_key,occurred_at DESC);
CREATE TRIGGER IF NOT EXISTS club_license_events_immutable_update
BEFORE UPDATE ON club_license_events BEGIN SELECT RAISE(ABORT,'license event immutable'); END;
CREATE TRIGGER IF NOT EXISTS club_license_events_immutable_delete
BEFORE DELETE ON club_license_events BEGIN SELECT RAISE(ABORT,'license event immutable'); END;
