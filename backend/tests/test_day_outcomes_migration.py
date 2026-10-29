import json,sqlite3,unittest
from pathlib import Path
class DayOutcomesMigrationTest(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  for p in sorted((Path(__file__).parent.parent/'migrations').glob('*.sql')):self.db.executescript(p.read_text())
  self.db.execute('INSERT INTO seasons VALUES(1,?,?,?,?,?)',('a'*36,'b'*64,'c'*64,'{}',1));self.db.commit()
 def tearDown(self):self.db.close()
 def row(self,day=1):return (1,'a'*36,day,'b'*64,'temporary-score-v1','c'*64,json.dumps({'results':[]}),1)
 def test_valid_receipt_unique_immutable_and_fk(self):
  self.db.execute('INSERT INTO season_day_outcomes VALUES(?,?,?,?,?,?,?,?)',self.row())
  for sql,args in [('INSERT INTO season_day_outcomes VALUES(?,?,?,?,?,?,?,?)',self.row()),("UPDATE season_day_outcomes SET outcome_json='{}'",()),('INSERT INTO season_day_outcomes VALUES(?,?,?,?,?,?,?,?)',(2,*self.row()[1:]))]:
   with self.assertRaises(sqlite3.IntegrityError):self.db.execute(sql,args)
 def test_invalid_day_version_or_json_rejected(self):
  for index,value in [(2,0),(2,57),(4,'future-engine'),(5,'short'),(6,'[]'),(6,'broken')]:
   row=list(self.row());row[index]=value
   with self.assertRaises(sqlite3.IntegrityError):self.db.execute('INSERT INTO season_day_outcomes VALUES(?,?,?,?,?,?,?,?)',row)
