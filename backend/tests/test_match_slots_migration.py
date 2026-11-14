"""Local SQLite contract for immutable published match slots (issue #601)."""
import sqlite3
import unittest
from pathlib import Path

MIGRATIONS=Path(__file__).resolve().parents[1]/"migrations"

class MatchSlotMigration(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(":memory:")
  self.db.execute("PRAGMA foreign_keys=ON")
  for name in ("0001_world.sql","0023_match_slots.sql"):
   self.db.executescript((MIGRATIONS/name).read_text(encoding="utf-8"))
  self.generation=self.db.execute("SELECT generation FROM world_state WHERE id=1").fetchone()[0]
  self.db.execute("INSERT INTO seasons VALUES(1,?,?,?,'{}',1)",(self.generation,"a"*64,"b"*64))
 def tearDown(self):self.db.close()
 def insert(self,match_id="m1_"+"a"*32):
  self.db.execute("""INSERT INTO season_match_slots VALUES(
   ?,?,1,'IT-1','league','round:1:match:1','season:1:IT-1:N01:IT-1:IT-2',
   'N01',13,1,'IT-1','IT-2','domestic',?,1)""",(match_id,self.generation,"c"*64))
 def test_unique_and_reset_only_deletion(self):
  self.insert()
  with self.assertRaises(sqlite3.IntegrityError):self.insert()
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("UPDATE season_match_slots SET round_number=2")
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("DELETE FROM season_match_slots")
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("DELETE FROM seasons")
  self.db.execute("UPDATE world_state SET generation=?,revision=0,season_number=0,day=0,phase='unstarted'",("0"*36,))
  self.db.execute("DELETE FROM season_match_slots")
  self.db.execute("DELETE FROM seasons")
  self.assertEqual(self.db.execute("SELECT count(*) FROM season_match_slots").fetchone()[0],0)
 def test_conflicting_identity_and_source(self):
  self.insert()
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("""INSERT INTO season_match_slots VALUES(
   ?,?,1,'IT-1','league','round:1:match:2','season:1:IT-1:N01:IT-1:IT-2',
   'N01',13,1,'IT-1','IT-2','domestic',?,1)""",("m1_"+"b"*32,self.generation,"c"*64))
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("""INSERT INTO season_match_slots VALUES(
   ?,?,1,'IT-1','league','round:1:match:1','season:1:IT-1:N01:IT-2:IT-3',
   'N01',13,1,'IT-2','IT-3','domestic',?,1)""",("m1_"+"b"*32,self.generation,"c"*64))
if __name__=="__main__":unittest.main()
