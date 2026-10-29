"""Local SQLite archive migration invariants, no remote D1."""
import unittest, sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'migrations'
class ArchiveMigrationTest(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for file in ('0001_world.sql','0007_season_archives.sql','0008_archive_reset_guard.sql'):self.db.executescript((ROOT/file).read_text())
  self.db.execute("INSERT INTO seasons VALUES(1,?,?,?,'{}',1)",('a'*36,'a'*64,'b'*64))
 def tearDown(self):self.db.close()
 def test_once_only_immutable_and_foreign_key(self):
  values=(1,'a'*36,*('f'*64 for _ in range(4)),4082,56,54,1)
  self.db.execute('INSERT INTO season_archives VALUES(?,?,?,?,?,?,?,?,?,?)',values)
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute('INSERT INTO season_archives VALUES(?,?,?,?,?,?,?,?,?,?)',values)
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute('UPDATE season_archives SET results_count=1')
  self.db.execute("UPDATE world_state SET generation=?,phase='preparing',season_number=1,revision=1",('a'*36,))
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute('DELETE FROM season_archives')
 def test_reset_guard_requires_unstarted_world_with_new_generation(self):
  values=(1,'a'*36,*('f'*64 for _ in range(4)),4082,56,54,1)
  self.db.execute('INSERT INTO season_archives VALUES(?,?,?,?,?,?,?,?,?,?)',values)
  # A closed/active world or same-generation unstarted state never permits deletion.
  self.db.execute("UPDATE world_state SET generation=?,phase='preparing',season_number=1,revision=1",('a'*36,))
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute('DELETE FROM season_archives')
  self.db.execute("UPDATE world_state SET phase='closed',day=56,revision=2")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute('DELETE FROM season_archives')
  self.db.execute("UPDATE world_state SET generation=?,phase='unstarted',day=0,season_number=0,revision=0",('b'*36,))
  self.db.execute('DELETE FROM season_archives')
  self.assertEqual(self.db.execute('SELECT count(*) FROM season_archives').fetchone()[0],0)
if __name__=='__main__':unittest.main()

