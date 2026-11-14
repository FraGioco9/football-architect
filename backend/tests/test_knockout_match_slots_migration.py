"""Local-only SQLite immutability for reserved TBD knockout matches."""
import sqlite3
import unittest
from pathlib import Path
M=Path(__file__).resolve().parents[1]/'migrations'
class KnockoutReservationMigration(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for name in ('0001_world.sql','0024_knockout_match_slots.sql'):
   self.db.executescript((M/name).read_text(encoding='utf-8'))
  self.g=self.db.execute('SELECT generation FROM world_state').fetchone()[0]
  self.db.execute("INSERT INTO seasons VALUES (1, ?, ?, ?, '{}', 1)",(self.g,'a'*64,'b'*64))
 def tearDown(self):self.db.close()
 def put(self):
  self.db.execute("""INSERT INTO season_knockout_match_slots VALUES
   (?, ?,1,'IT-2','promotionPlayoffs','semi36',1,'tie:semi36:leg:1',
   'N31',52,31,'higherOriginalTableRank','domestic-second-v1',
   '{"kind":"leagueRank","rank":3}','{"kind":"leagueRank","rank":6}',
   'domestic',?,1)""",('m1_'+'a'*32,self.g,'c'*64))
 def test_no_overwrite_and_reset_scoping(self):
  self.put()
  with self.assertRaises(sqlite3.IntegrityError):self.put()
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute('UPDATE season_knockout_match_slots SET leg=2')
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute('DELETE FROM season_knockout_match_slots')
  self.db.execute("UPDATE world_state SET generation=?,revision=0,season_number=0,day=0,phase='unstarted'",('0'*36,))
  self.db.execute('DELETE FROM season_knockout_match_slots')
  self.db.execute('DELETE FROM seasons')
  self.assertEqual(self.db.execute('SELECT count(*) FROM season_knockout_match_slots').fetchone()[0],0)
if __name__=='__main__':unittest.main()
