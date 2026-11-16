"""SQLite compatibility and immutability checks for published stadium assignments (#614)."""
import sqlite3
import unittest
from pathlib import Path

MIGRATIONS=Path(__file__).resolve().parents[1]/"migrations"

class StadiumMigration(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(":memory:")
  self.db.execute("PRAGMA foreign_keys=ON")
  for name in ("0001_world.sql","0023_match_slots.sql"):
   self.db.executescript((MIGRATIONS/name).read_text(encoding="utf-8"))
  self.generation=self.db.execute("SELECT generation FROM world_state WHERE id=1").fetchone()[0]
  self.db.execute("INSERT INTO seasons VALUES(1,?,?,?,'{}',1)",(self.generation,"a"*64,"b"*64))
 def tearDown(self):self.db.close()
 def insert(self,**extra):
  fields={
   "match_id":"m1_"+"a"*32,"generation":self.generation,"season_number":1,
   "competition_id":"IT-1","phase_id":"league","slot_id":"round:1:match:1",
   "source_fixture_id":"season:1:IT-1:N01:IT-1:IT-2","marker":"N01",
   "scheduled_day":13,"round_number":1,"home_club_id":"IT-1","away_club_id":"IT-2",
   "source_kind":"calendar","source_hash":"c"*64,"published_at":1,
  }
  fields.update(extra)
  cols=", ".join(fields)
  qmarks=", ".join("?" for _ in fields)
  self.db.execute(f"INSERT INTO season_match_slots ({cols}) VALUES ({qmarks})",tuple(fields.values()))
 def test_legacy_rows_retained_with_null_assignment(self):
  self.insert()
  self.db.executescript((MIGRATIONS/"0027_match_slot_stadium.sql").read_text(encoding="utf-8"))
  self.assertIsNone(self.db.execute("SELECT stadium_name FROM season_match_slots").fetchone()[0])
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("UPDATE season_match_slots SET stadium_name='Tampered' WHERE season_number=1")
 def test_new_rows_enforce_venue_constraints_and_immutability(self):
  self.db.executescript((MIGRATIONS/"0027_match_slot_stadium.sql").read_text(encoding="utf-8"))
  self.insert(stadium_name="Stadio dei Navigli")
  self.assertEqual(self.db.execute("SELECT stadium_name FROM season_match_slots").fetchone()[0],"Stadio dei Navigli")
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("UPDATE season_match_slots SET stadium_name='New stadium' WHERE season_number=1")
 def test_rejects_malformed_stadium(self):
  self.db.executescript((MIGRATIONS/"0027_match_slot_stadium.sql").read_text(encoding="utf-8"))
  for name in ("","  "," "+("X"*8), "X"*121):
   with self.subTest(name=name):
    with self.assertRaises(sqlite3.IntegrityError):self.insert(stadium_name=name)

if __name__=="__main__":unittest.main()
