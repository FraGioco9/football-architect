"""#629: additive private D1 portrait schema and guarded approved DEV legacy backfill."""
from pathlib import Path
import json
import sqlite3
import unittest

BACKEND=Path(__file__).resolve().parents[1]
SCHEMA=(BACKEND/'migrations'/'0026_player_portrait_profiles.sql').read_text()
BACKFILL=(BACKEND/'manual'/'portrait-approved-dev-backfill.sql').read_text()
SAMPLE={
 44:('Giacinto Lello','ITA',73,69,82,64,'49d9a18b0f2df2bb'),
 98:('Arthur Kiesel','GER',51,77,57,78,'927b9d9ee029f2e3'),
 145:('Steven Sellen','ENG',77,68,67,61,'db6cf3b4ea78f434')
}
def make_db(wrong_name=False):
 db=sqlite3.connect(':memory:')
 db.execute('PRAGMA foreign_keys=ON')
 db.executescript('CREATE TABLE generated_players (id INTEGER PRIMARY KEY AUTOINCREMENT,payload_json TEXT NOT NULL);')
 db.executescript(SCHEMA)
 for player_id,(name,nat,strength,speed,agility,stamina,_) in SAMPLE.items():
  if wrong_name and player_id==98:name='Unrelated player'
  payload={'display_name':name,'nationality':nat,'attributes':{
   'strength':strength,'speed':speed,'agility':agility,'stamina':stamina}}
  db.execute('INSERT INTO generated_players(id,payload_json) VALUES(?,?)',(player_id,json.dumps(payload)))
 db.commit()
 return db

class PortraitD1MigrationTest(unittest.TestCase):
 def test_three_guards_and_idempotent_dev_backfill(self):
  db=make_db()
  try:
   db.executescript(BACKFILL)
   rows=db.execute('SELECT player_id,snapshot_json,status,asset_key FROM player_portrait_profiles ORDER BY player_id').fetchall()
   self.assertEqual([r[0] for r in rows],[44,98,145])
   for player_id,snapshot_raw,status,asset_key in rows:
    snapshot=json.loads(snapshot_raw)
    self.assertEqual(snapshot['player_id'],player_id)
    self.assertEqual(snapshot['appearance_fingerprint'],SAMPLE[player_id][-1])
    self.assertEqual(snapshot['prompt_version'],'player-portrait-v3')
    self.assertEqual(status,'approved')
    self.assertEqual(asset_key,f'assets/players/portraits/{player_id}.webp')
    self.assertNotIn('portrait_prompt',snapshot)
   db.executescript(BACKFILL)
   self.assertEqual(db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0],3)
   self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
   db.execute('DELETE FROM generated_players WHERE id=44')
   self.assertIsNone(db.execute('SELECT player_id FROM player_portrait_profiles WHERE player_id=44').fetchone())
  finally:db.close()

 def test_never_attaches_approved_image_to_unrelated_matching_numeric_id(self):
  db=make_db(wrong_name=True)
  try:
   db.executescript(BACKFILL)
   ids={r[0] for r in db.execute('SELECT player_id FROM player_portrait_profiles').fetchall()}
   self.assertEqual(ids,{44,145})
  finally:db.close()

 def test_private_constraints_prevent_orphan_or_fake_approved_without_asset(self):
  db=make_db()
  try:
   for query in [
    "INSERT INTO player_portrait_profiles(player_id,schema_version,prompt_version,snapshot_json,status,created_at) VALUES (999,'player-portraits-v2','player-portrait-v3','{}','pending',1)",
    "INSERT INTO player_portrait_profiles(player_id,schema_version,prompt_version,snapshot_json,status,created_at) VALUES (44,'player-portraits-v2','player-portrait-v3','{}','approved',1)",
    "INSERT INTO player_portrait_profiles(player_id,schema_version,prompt_version,snapshot_json,status,created_at) VALUES (44,'player-portraits-v2','player-portrait-v4','{}','pending',1)"
   ]:
    with self.assertRaises(sqlite3.IntegrityError):db.execute(query)
   self.assertEqual(db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0],0)
  finally:db.close()

if __name__=='__main__':unittest.main()
