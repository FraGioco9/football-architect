import sqlite3,unittest
from pathlib import Path
class KnockoutMigrationTest(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  for p in sorted((Path(__file__).parent.parent/'migrations').glob('*.sql')):self.db.executescript(p.read_text())
  self.db.execute('INSERT INTO seasons VALUES(1,?,?,?,?,?)',('a'*36,'b'*64,'c'*64,'{}',1));self.db.commit()
 def tearDown(self):self.db.close()
 def row(self):return (1,'a'*36,'int-1','playoffs','p512','b'*64,'{}',1)
 def test_ties_empty_unique_immutable_and_season_owned(self):
  self.assertEqual(self.db.execute('SELECT count(*) FROM season_knockout_ties').fetchone()[0],0)
  self.db.execute('INSERT INTO season_knockout_ties VALUES(?,?,?,?,?,?,?,?)',self.row())
  for sql,args in [('INSERT INTO season_knockout_ties VALUES(?,?,?,?,?,?,?,?)',self.row()),("UPDATE season_knockout_ties SET plan_json='{}'",()),('INSERT INTO season_knockout_ties VALUES(?,?,?,?,?,?,?,?)',(2,*self.row()[1:]))]:
   with self.assertRaises(sqlite3.IntegrityError):self.db.execute(sql,args)
 def test_invalid_hash_and_json_rejected(self):
  for index,value in [(1,'short'),(2,''),(3,''),(4,''),(5,'short'),(6,'[]'),(6,'broken')]:
   row=list(self.row());row[index]=value
   with self.assertRaises(sqlite3.IntegrityError):self.db.execute('INSERT INTO season_knockout_ties VALUES(?,?,?,?,?,?,?,?)',row)
