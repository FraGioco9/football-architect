"""Schema-only regression for the immutable derived season summary."""
from pathlib import Path
import sqlite3
import unittest
ROOT=Path(__file__).resolve().parents[1]/"migrations"
class ArchiveSummaryMigrationTest(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(":memory:")
  self.db.execute("PRAGMA foreign_keys=ON")
  for name in ("0001_world.sql","0012_season_archive_summaries.sql"):
   self.db.executescript((ROOT/name).read_text(encoding="utf8"))
  self.generation=self.db.execute("SELECT generation FROM world_state WHERE id=1").fetchone()[0]
  self.db.execute("INSERT INTO seasons VALUES(1,?,?,?,'{}',1)",(self.generation,"a"*64,"b"*64))
 def tearDown(self):self.db.close()
 def test_immutable_summary_and_reset_guard(self):
  self.db.execute("INSERT INTO season_archive_summaries VALUES (1,?,?,?,?,1)",(self.generation,"a"*64,"b"*64,'{}'))
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("UPDATE season_archive_summaries SET summary_json='[]' WHERE season_number=1")
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("DELETE FROM season_archive_summaries WHERE season_number=1")
  self.db.execute("UPDATE world_state SET generation=?,revision=0,season_number=0,day=0,phase='unstarted' WHERE id=1",("f"*36,))
  self.db.execute("DELETE FROM season_archive_summaries WHERE season_number=1")
  self.assertEqual(self.db.execute("SELECT count(*) FROM season_archive_summaries").fetchone()[0],0)
 def test_invalid_digest_or_json_rejected(self):
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("INSERT INTO season_archive_summaries VALUES(1,?,?,?,?,1)",(self.generation,"bad","b"*64,'{}'))
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("INSERT INTO season_archive_summaries VALUES(1,?,?,?,?,1)",(self.generation,"a"*64,"b"*64,"not-json"))
if __name__=="__main__":unittest.main()
