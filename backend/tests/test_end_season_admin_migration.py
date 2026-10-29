"""ADMIN-WORLD-02 #327: lossless in-place upgrade of season-owned event rows."""
from pathlib import Path
import sqlite3
import unittest
MIGRATIONS=Path(__file__).resolve().parents[1]/"migrations"

class EndSeasonCalendarMigrationTest(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        for name in ("0001_world.sql","0005_admin_calendar_events.sql","0009_reset_event_guard.sql"):
            self.db.executescript((MIGRATIONS/name).read_text(encoding="utf8"))
        self.db.execute("INSERT INTO seasons VALUES (1,?,?,?,'{}',1)",(self.db.execute("SELECT generation FROM world_state WHERE id=1").fetchone()[0],"a"*64,"b"*64))
        self.db.execute("INSERT INTO season_admin_events(season_number,event_id,kind,scope,scheduled_day,event_order,created_at) VALUES(1,'domestic:entrants','confirm-domestic-entrants','domestic',1,1,1)")
        self.db.execute("INSERT INTO season_admin_events(season_number,event_id,kind,scope,scheduled_day,event_order,status,completed_at,receipt_hash,created_at) VALUES(1,'international:entrants','confirm-international-entrants','international',1,2,'completed',12,?,1)",("f"*64,))
        self.before=self.db.execute("SELECT * FROM season_admin_events ORDER BY event_id").fetchall()
        self.db.executescript((MIGRATIONS/"0011_end_season_admin_events.sql").read_text(encoding="utf8"))
    def tearDown(self): self.db.close()
    def test_legacy_rows_and_receipts_are_unchanged(self):
        self.assertEqual(self.db.execute("SELECT * FROM season_admin_events ORDER BY event_id").fetchall(),self.before)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE season_admin_events SET event_order=5 WHERE event_id='international:entrants'")
    def test_terminal_kinds_are_accepted_with_receipt_guard(self):
        for kind,identity,order in (("archive-season","season:archive",9000),("close-season","season:close",9100),("prepare-next-season","season:next-prepare",9200)):
            self.db.execute("INSERT INTO season_admin_events(season_number,event_id,kind,scope,scheduled_day,event_order,created_at) VALUES(1,?,?, 'season',56,?,1)",(identity,kind,order))
        self.assertEqual(self.db.execute("SELECT count(*) FROM season_admin_events WHERE scope='season'").fetchone()[0],3)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE season_admin_events SET status='completed' WHERE event_id='season:archive'")
        self.db.execute("UPDATE season_admin_events SET status='completed',completed_at=99,receipt_hash=? WHERE event_id='season:archive'",("c"*64,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM season_admin_events WHERE event_id='season:archive'")
    def test_unknown_kind_still_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO season_admin_events(season_number,event_id,kind,scope,scheduled_day,event_order,created_at) VALUES(1,'season:unknown','unknown','season',56,9300,1)")
if __name__=="__main__": unittest.main()
