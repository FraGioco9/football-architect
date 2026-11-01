-- Local-only transition bridge: preserve historic admin_operations foreign keys.
-- Linking an account does not grant authorization: every request must verify
-- the current account_permissions in D1. No implicit email-based linking.
CREATE TABLE IF NOT EXISTS player_admin_operator_links (
 player_account_id TEXT PRIMARY KEY REFERENCES player_accounts(id) ON DELETE CASCADE,
 legacy_admin_account_id TEXT NOT NULL UNIQUE REFERENCES admin_accounts(id) ON DELETE RESTRICT,
 linked_at INTEGER NOT NULL CHECK (linked_at > 0)
);
-- Existing admin_operations rows remain untouched and continue to reference
-- their historical operator. Migration into a unified actor model is deferred
-- until all command guards and audit readers have been updated and tested.
