-- Additive hardening: SQLite REPLACE can bypass DELETE triggers unless recursive
-- triggers are enabled. Reject an existing primary key before any replacement.
CREATE TRIGGER IF NOT EXISTS account_pool_cannot_replace
BEFORE INSERT ON account_environment_pool
WHEN EXISTS(SELECT 1 FROM account_environment_pool WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'account pool is immutable'); END;

CREATE TRIGGER IF NOT EXISTS permission_receipts_cannot_replace
BEFORE INSERT ON account_permission_events
WHEN EXISTS(SELECT 1 FROM account_permission_events WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'permission receipt is immutable'); END;
