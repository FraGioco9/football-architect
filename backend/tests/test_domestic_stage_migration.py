"""SQLite D1-compatible staged domestic scheduling invariants, no remote database."""
import sqlite3
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]/'migrations'
class DomesticStageMigrationTest(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for name in ('0001_world.sql','0006_domestic_stage.sql'):
   self.db.executescript((ROOT/name).read_text(encoding='utf-8'))
  self.db.execute("INSERT INTO seasons VALUES (1, ?, ?, ?, '{}', 1)",('a'*36,'a'*64,'b'*64))
 def tearDown(self): self.db.close()
 def test_immutable_stage_and_foreign_key(self):
  row=(1,'a'*36,'initial-leagues-v1','seed-123456789abcdef','a'*64,'b'*64,'c'*64,'[]',1)
  self.db.execute('INSERT INTO season_domestic_stages VALUES(?,?,?,?,?,?,?,?,?)',row)
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("UPDATE season_domestic_stages SET fixtures_json='[1]'")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute('INSERT INTO season_domestic_stages VALUES(?,?,?,?,?,?,?,?,?)',row)
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute('INSERT INTO season_domestic_stages VALUES(?,?,?,?,?,?,?,?,?)',(2,*row[1:]))
if __name__=='__main__':unittest.main()
