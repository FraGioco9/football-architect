"""Local SQLite archive migration invariants, no remote D1."""
import unittest, sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'migrations'
class ArchiveMigrationTest(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for file in ('0001_world.sql','0007_season_archives.sql'):self.db.executescript((ROOT/file).read_text())
  self.db.execute("INSERT INTO seasons VALUES(1,?,?,?,'{}',1)",('generation','a'*64,'b'*64))
 def tearDown(self):self.db.close()
 def test_once_only_immutable_and_foreign_key(self):
  values=(1,'generation',*('f'*64 for _ in range(4)),4082,56,54,1)
  self.db.execute('INSERT INTO season_archives VALUES(?,?,?,?,?,?,?,?,?,?)',values)
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute('INSERT INTO season_archives VALUES(?,?,?,?,?,?,?,?,?,?)',values)
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute('UPDATE season_archives SET results_count=1')
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute('DELETE FROM season_archives')
if __name__=='__main__':unittest.main()
