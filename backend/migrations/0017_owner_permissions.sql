-- Trusted local owner tooling only. Does not connect or synchronize environments.
CREATE TABLE IF NOT EXISTS account_environment_pool (
 id INTEGER PRIMARY KEY CHECK (id=1),
 pool TEXT NOT NULL CHECK (pool IN ('dev-preview','production')),
 initialized_at INTEGER NOT NULL CHECK (initialized_at>0)
);
CREATE TRIGGER IF NOT EXISTS account_pool_cannot_relabel BEFORE UPDATE ON account_environment_pool
BEGIN SELECT RAISE(ABORT,'account pool is immutable'); END;
CREATE TRIGGER IF NOT EXISTS account_pool_cannot_delete BEFORE DELETE ON account_environment_pool
BEGIN SELECT RAISE(ABORT,'account pool is immutable'); END;
-- Opaque account IDs are retained as audit receipts; no email/password/token payloads.
CREATE TABLE IF NOT EXISTS account_permission_events (
 id TEXT PRIMARY KEY NOT NULL,
 action TEXT NOT NULL CHECK (action IN ('grant','revoke')),
 pool TEXT NOT NULL CHECK (pool IN ('dev-preview','production')),
 player_account_id TEXT NOT NULL,
 legacy_admin_account_id TEXT,
 approved_by TEXT NOT NULL CHECK (approved_by='local-owner-cli'),
 created_at INTEGER NOT NULL CHECK (created_at>0)
);
CREATE TRIGGER IF NOT EXISTS permission_receipts_cannot_update BEFORE UPDATE ON account_permission_events
BEGIN SELECT RAISE(ABORT,'permission receipt is immutable'); END;
CREATE TRIGGER IF NOT EXISTS permission_receipts_cannot_delete BEFORE DELETE ON account_permission_events
BEGIN SELECT RAISE(ABORT,'permission receipt is immutable'); END;
