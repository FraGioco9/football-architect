"""PLAYER-AUTH-01: local SQLite/D1 migration and Admin/Player isolation contracts."""
from pathlib import Path
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations"

class PlayerAuthMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        for path in sorted(MIGRATIONS.glob("*.sql")):
            self.db.executescript(path.read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    def test_isolated_schema_and_no_admin_foreign_keys(self):
        for table in ("player_accounts", "player_sessions", "player_one_time_tokens", "player_auth_throttles"):
            self.assertIsNotNone(self.db.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
            ).fetchone())
            foreign_tables = {fk[2] for fk in self.db.execute(f"PRAGMA foreign_key_list({table})")}
            self.assertNotIn("admin_accounts", foreign_tables)
            self.assertNotIn("admin_sessions", foreign_tables)
            self.assertNotIn("world_state", foreign_tables)
        self.assertEqual({row[2] for row in self.db.execute("PRAGMA foreign_key_list(player_sessions)")}, {"player_accounts"})

    def test_player_email_uniqueness_independent_of_admin(self):
        self.db.execute("INSERT INTO admin_accounts (id,email_normalized,password_verifier,created_at) VALUES (?,?,?,?)",
                        ("admin-1", "test@example.com", "admin-only", 1))
        self.db.execute("INSERT INTO player_accounts (id,email_normalized,password_verifier,created_at,updated_at) VALUES (?,?,?,?,?)",
                        ("player-1", "test@example.com", "player-only", 1, 1))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO player_accounts (id,email_normalized,password_verifier,created_at,updated_at) VALUES (?,?,?,?,?)",
                            ("player-2", "test@example.com", "player-only", 1, 1))
        self.assertEqual(self.db.execute("SELECT password_verifier FROM admin_accounts WHERE id='admin-1'").fetchone()[0], "admin-only")

    def test_cascade_revokes_player_sessions_and_tokens_only(self):
        self.db.execute("INSERT INTO admin_accounts (id,email_normalized,password_verifier,created_at) VALUES (?,?,?,?)",
                        ("admin-1", "admin@example.com", "admin-only", 1))
        self.db.execute("INSERT INTO player_accounts (id,email_normalized,password_verifier,created_at,updated_at) VALUES (?,?,?,?,?)",
                        ("player-1", "player@example.com", "player-only", 1, 1))
        self.db.execute("INSERT INTO player_sessions VALUES (?,?,?,?,?,?,?)",
                        ("a"*64, "player-1", 1, "b"*64, 1, 1, 2))
        self.db.execute("INSERT INTO player_one_time_tokens(token_digest,account_id,purpose,issued_at,expires_at) VALUES (?,?,?,?,?)",
                        ("c"*64, "player-1", "verify_email", 1, 2))
        self.db.execute("DELETE FROM player_accounts WHERE id='player-1'")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM player_sessions").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM player_one_time_tokens").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM admin_accounts").fetchone()[0], 1)

    def test_reject_invalid_token_purpose_and_bad_expiry(self):
        self.db.execute("INSERT INTO player_accounts (id,email_normalized,password_verifier,created_at,updated_at) VALUES (?,?,?,?,?)",
                        ("player-1", "player@example.com", "player-only", 1, 1))
        for purpose,issued,expires in (("admin_reset", 1, 2), ("reset_password", 2, 2)):
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute("INSERT INTO player_one_time_tokens(token_digest,account_id,purpose,issued_at,expires_at) VALUES (?,?,?,?,?)",
                                ("d"*64, "player-1", purpose, issued, expires))

if __name__ == "__main__":
    unittest.main()
