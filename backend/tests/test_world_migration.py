"""SQLite checks for the D1-compatible initial migration (no remote database)."""
from pathlib import Path
import sqlite3
import unittest
import re

MIGRATION = Path(__file__).resolve().parents[1] / "migrations" / "0001_world.sql"

class WorldMigrationTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    def row(self):
        return self.db.execute("SELECT * FROM world_state").fetchone()

    def test_initial_world_and_empty_season_tables(self):
        row = self.row()
        self.assertEqual(row[0], 1)
        self.assertEqual(row[1], 1)
        self.assertRegex(row[2], r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
        self.assertEqual(row[3:], (0, 0, 0, "unstarted"))
        for table in ("seasons", "admin_accounts", "admin_sessions", "auth_throttles", "admin_operations"):
            self.assertEqual(self.db.execute(f"SELECT count(*) FROM {table}").fetchone()[0], 0)

    def test_repeat_migration_does_not_reset_generation(self):
        before = self.row()
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))
        self.assertEqual(before, self.row())

    def test_singleton_cannot_be_deleted_or_duplicated(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM world_state WHERE id=1")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO world_state (id,generation) VALUES (2,'random')")

    def test_invalid_phase_and_day_rejected(self):
        for values in (
            {"phase": "active", "season_number": 0},
            {"phase": "preparing", "season_number": 1, "day": 1},
            {"phase": "closed", "season_number": 1, "day": 40},
            {"phase": "unstarted", "revision": 1},
            {"phase": "unexpected"},
            {"day": 57},
        ):
            clause = ", ".join(f"{key}=?" for key in values)
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(f"UPDATE world_state SET {clause} WHERE id=1", tuple(values.values()))
        self.assertEqual(self.row()[3:], (0, 0, 0, "unstarted"))

    def test_immutable_snapshot_and_unique_operations(self):
        self.db.execute(
            "INSERT INTO seasons VALUES (1, ?, ?, ?, '{}', 1)",
            ("generation", "a" * 64, "b" * 64),
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE seasons SET rules_hash=? WHERE season_number=1", ("c" * 64,))
        self.db.execute(
            "INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES ('actor','admin@example.invalid','synthetic',1)"
        )
        payload = ("op1", "generation", "key", "a" * 64, "actor", "prepare", 0, 1, "{}", 1)
        self.db.execute("INSERT INTO admin_operations VALUES (?,?,?,?,?,?,?,?,?,?)", payload)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO admin_operations VALUES (?,?,?,?,?,?,?,?,?,?)",
                            ("op2", *payload[1:]))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO admin_sessions VALUES (?,?,?,?,?,?,?)",
                            ("a" * 64, "unknown", 1, "b" * 64, 1, 1, 2))

if __name__ == "__main__":
    unittest.main()
