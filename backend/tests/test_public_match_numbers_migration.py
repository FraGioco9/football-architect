"""Additive migration gives existing and future V2 fixtures stable, non-reused public integers."""
import sqlite3
import unittest
from pathlib import Path

MIGRATIONS=Path(__file__).resolve().parents[1]/"migrations"

class PublicMatchNumbersMigration(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(":memory:")
  self.db.execute("PRAGMA foreign_keys=ON")
  for name in ("0001_world.sql","0023_match_slots.sql","0024_knockout_match_slots.sql"):
   self.db.executescript((MIGRATIONS/name).read_text(encoding="utf-8"))
  self.gen=self.db.execute("SELECT generation FROM world_state WHERE id=1").fetchone()[0]
  self.db.execute("INSERT INTO seasons VALUES(1,?,?,?,'{}',1)",(self.gen,"a"*64,"b"*64))
 def tearDown(self):self.db.close()
 def league(self,key):
  self.db.execute("""INSERT INTO season_match_slots VALUES(
   ?,?,1,'IT-1','league',?,'season:1:IT-1:N01:IT-1:IT-2',
   'N01',13,1,'IT-1','IT-2','domestic',?,1)""",
   ("m1_"+key*32,self.gen,"round:1:match:"+str(ord(key)), "c"*64))
 def knockout(self):
  self.db.execute("""INSERT INTO season_knockout_match_slots VALUES(
   ?,?,1,'IT-1','playout','p1',1,'playout:p1:1','N31',52,31,
   'higherOriginalTableRank','domestic-v1','{}','{}','domestic',?,1)""",
   ("m1_"+"b"*32,self.gen,"c"*64))
 def test_existing_slots_are_backfilled_without_changing_them(self):
  self.league("a")
  self.knockout()
  self.db.executescript((MIGRATIONS/"0025_public_match_numbers.sql").read_text(encoding="utf-8"))
  mapped=self.db.execute("SELECT id,slot_match_id FROM public_match_numbers ORDER BY id").fetchall()
  self.assertEqual(mapped,[(1,"m1_"+"a"*32),(2,"m1_"+"b"*32)])
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM season_match_slots").fetchone()[0],1)
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM season_knockout_match_slots").fetchone()[0],1)
  for statement in (
   "UPDATE public_match_numbers SET id=3 WHERE id=1",
   "DELETE FROM public_match_numbers WHERE id=1",
   "INSERT INTO public_match_numbers(slot_match_id,generation,season_number) SELECT slot_match_id,generation,season_number FROM public_match_numbers WHERE id=1"):
   with self.assertRaises(sqlite3.IntegrityError):self.db.execute(statement)
  self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(),[])
 def test_ids_are_not_recycled_after_world_reset(self):
  self.league("a")
  self.db.executescript((MIGRATIONS/"0025_public_match_numbers.sql").read_text(encoding="utf-8"))
  self.db.execute("UPDATE world_state SET generation=?,revision=0,season_number=0,day=0,phase='unstarted'",("0"*36,))
  self.db.execute("DELETE FROM season_match_slots")
  self.db.execute("DELETE FROM seasons")
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM public_match_numbers").fetchone()[0],1)
  self.db.execute("INSERT INTO public_match_numbers(slot_match_id,generation,season_number) VALUES(?,?,1)",("m1_"+"c"*32,"0"*36))
  self.assertEqual(self.db.execute("SELECT id FROM public_match_numbers ORDER BY id").fetchall(),[(1,),(2,)])

if __name__=="__main__":unittest.main()
