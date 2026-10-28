"""Regression contracts for local D1 calendar/draw artifact schema (no remote writes)."""
from pathlib import Path
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[1] / "migrations"

class SeasonArtifactMigrationTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        for filename in ("0001_world.sql", "0002_season_artifacts.sql"):
            self.db.executescript((ROOT / filename).read_text(encoding="utf-8"))
        self.db.execute("INSERT INTO seasons VALUES (1, ?, ?, ?, '{}', 1)",
                        ("generation", "a" * 64, "b" * 64))

    def tearDown(self):
        self.db.close()

    def test_empty_initial_artifacts_and_reapplication(self):
        self.assertEqual(self.db.execute("SELECT count(*) FROM season_calendars").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT count(*) FROM season_draws").fetchone()[0], 0)
        self.db.executescript((ROOT / "0002_season_artifacts.sql").read_text(encoding="utf-8"))
        self.assertEqual(self.db.execute("SELECT count(*) FROM season_calendars").fetchone()[0], 0)

    def test_calendar_foreign_key_unique_integrity_and_immutability(self):
        values=(1,"cal-v1","c"*64,'{"days":[]}',"generated",1)
        self.db.execute("INSERT INTO season_calendars VALUES (?,?,?,?,?,?)",values)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO season_calendars VALUES (?,?,?,?,?,?)",values)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE season_calendars SET calendar_hash=? WHERE season_number=1",("d"*64,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO season_calendars VALUES (?,?,?,?,?,?)",
                            (2,*values[1:]))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE season_calendars SET status='unknown' WHERE season_number=1")

    def test_draw_primary_key_version_seed_json_and_immutable_outcome(self):
        values=(1,"int-1","league","draw-v1","seed-123456789abc","d"*64,'{"pairs":[]}',"generated",1)
        self.db.execute("INSERT INTO season_draws VALUES (?,?,?,?,?,?,?,?,?)",values)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO season_draws VALUES (?,?,?,?,?,?,?,?,?)",values)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE season_draws SET seed=? WHERE season_number=1",("other-seed-123456789",))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO season_draws VALUES (?,?,?,?,?,?,?,?,?)",
                            (2,*values[1:]))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO season_draws VALUES (?,?,?,?,?,?,?,?,?)",
                            (1,"int-2","league","draw-v1","seed-123456789abc","d"*64,"[]","validated",1))
        self.db.execute("UPDATE season_draws SET status='validated' WHERE season_number=1")
        self.assertEqual(self.db.execute("SELECT status FROM season_draws").fetchone()[0],"validated")

if __name__ == "__main__":
    unittest.main()
