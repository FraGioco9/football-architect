"""Local SQLite contracts for movable season-owned administrative milestones."""
from pathlib import Path
import sqlite3
import unittest
ROOT=Path(__file__).resolve().parents[1] / "migrations"
class AdminCalendarMigrationTest(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        for name in ("0001_world.sql","0005_admin_calendar_events.sql"):
            self.db.executescript((ROOT/name).read_text(encoding="utf-8"))
        self.db.execute("INSERT INTO seasons VALUES (1, ?, ?, ?, '{}', 1)",("generation","a"*64,"b"*64))
    def tearDown(self): self.db.close()
    def insert(self,event="domestic:entrants",kind="confirm-domestic-entrants",day=1,order=1,season=1):
        self.db.execute("INSERT INTO season_admin_events(season_number,event_id,kind,scope,scheduled_day,event_order,created_at) VALUES(?,?,?,?,?,?,?)",
                        (season,event,kind,"domestic",day,order,1))
    def test_reschedule_future_and_reject_collision_or_invalid_day(self):
        self.insert()
        self.insert("domestic:calendar","generate-domestic-calendar",2,1)
        self.db.execute("UPDATE season_admin_events SET scheduled_day=3 WHERE event_id='domestic:calendar'")
        self.assertEqual(self.db.execute("SELECT scheduled_day FROM season_admin_events WHERE event_id='domestic:calendar'").fetchone()[0],3)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE season_admin_events SET scheduled_day=1 WHERE event_id='domestic:calendar'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE season_admin_events SET scheduled_day=57 WHERE event_id='domestic:calendar'")
    def test_completed_receipt_immutable_and_no_partial_receipt(self):
        self.insert()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE season_admin_events SET status='completed' WHERE event_id='domestic:entrants'")
        self.db.execute("UPDATE season_admin_events SET status='completed',completed_at=12,receipt_hash=? WHERE event_id='domestic:entrants'",("f"*64,))
        for sql in ("UPDATE season_admin_events SET scheduled_day=2 WHERE event_id='domestic:entrants'",
                    "DELETE FROM season_admin_events WHERE event_id='domestic:entrants'"):
            with self.assertRaises(sqlite3.IntegrityError): self.db.execute(sql)
    def test_enforce_identity_and_season_ownership(self):
        self.insert()
        with self.assertRaises(sqlite3.IntegrityError): self.insert("duplicate","confirm-domestic-entrants",2,3)
        with self.assertRaises(sqlite3.IntegrityError): self.insert("unknown","unknown",2,3)
        with self.assertRaises(sqlite3.IntegrityError): self.insert("future","generate-domestic-calendar",2,3,2)
if __name__=="__main__": unittest.main()
