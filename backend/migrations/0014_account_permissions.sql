-- Unified account permissions, PLAYER-AUTH-01. Local-only.
-- Never grant permissions during registration or through client-provided role values.
CREATE TABLE IF NOT EXISTS account_permissions (
 account_id TEXT NOT NULL REFERENCES player_accounts(id) ON DELETE CASCADE,
 permission TEXT NOT NULL CHECK (permission IN ('admin.access','admin.world.read','admin.world.write')),
 granted_at INTEGER NOT NULL CHECK (granted_at > 0),
 granted_by TEXT,
 PRIMARY KEY(account_id,permission)
);
CREATE INDEX IF NOT EXISTS account_permissions_by_permission ON account_permissions(permission);
