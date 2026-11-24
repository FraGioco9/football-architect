"""#646: additive V4.1 schema allows guarded replacement and V3 rollback."""
from pathlib import Path
import json
import sqlite3
import unittest

ROOT=Path(__file__).resolve().parents[1]
V3=(ROOT/'migrations'/'0026_player_portrait_profiles.sql').read_text()
V41=(ROOT/'migrations'/'0032_portrait_v41_replacement.sql').read_text()

class PortraitV41ReplacementMigration(unittest.TestCase):
 def make_db(self):
  db=sqlite3.connect(':memory:')
  db.execute('PRAGMA foreign_keys=ON')
  db.executescript("CREATE TABLE generated_players(id INTEGER PRIMARY KEY,payload_json TEXT NOT NULL);")
  db.execute("INSERT INTO generated_players(id,payload_json) VALUES(44,'{}')")
  db.executescript(V3)
  old=json.dumps({'player_id':44,'schema_version':'player-portraits-v2',
   'prompt_version':'player-portrait-v3','appearance_fingerprint':'legacy_v3'})
  db.execute("""INSERT INTO player_portrait_profiles(
   player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
   VALUES(44,'player-portraits-v2','player-portrait-v3',?,'approved',
   'assets/players/portraits/44.webp',1600000000)""",(old,))
  db.commit()
  return db,old

 def test_expands_version_contract_without_touching_v3_or_backups(self):
  db,old=self.make_db()
  try:
   db.executescript(V41)
   row=db.execute("SELECT schema_version,prompt_version,snapshot_json,status,asset_key FROM player_portrait_profiles").fetchone()
   self.assertEqual(row[0:3],('player-portraits-v2','player-portrait-v3',old))
   self.assertEqual(row[3],'approved')
   self.assertEqual(db.execute('SELECT COUNT(*) FROM player_portrait_v3_replacement_backup').fetchone()[0],0)
   self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
   new=json.dumps({'player_id':44,'schema_version':'player-portraits-v4',
    'prompt_version':'player-portrait-v4.1','appearance_fingerprint':'46163acf3ae85a04'})
   db.execute("""INSERT INTO player_portrait_v3_replacement_backup(
    player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
    SELECT player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at
    FROM player_portrait_profiles WHERE player_id=44""")
   db.execute("""UPDATE player_portrait_profiles SET schema_version='player-portraits-v4',
    prompt_version='player-portrait-v4.1',snapshot_json=? WHERE player_id=44""",(new,))
   self.assertEqual(db.execute('SELECT prompt_version FROM player_portrait_profiles').fetchone()[0],
    'player-portrait-v4.1')
   original=db.execute('SELECT snapshot_json FROM player_portrait_v3_replacement_backup').fetchone()[0]
   self.assertEqual(original,old)
   with self.assertRaises(sqlite3.IntegrityError):
    db.execute("UPDATE player_portrait_profiles SET prompt_version='player-portrait-v3' WHERE player_id=44")
   db.execute("""UPDATE player_portrait_profiles SET
    schema_version='player-portraits-v2',prompt_version='player-portrait-v3',snapshot_json=?
    WHERE player_id=44""",(original,))
   self.assertEqual(db.execute('SELECT snapshot_json FROM player_portrait_profiles').fetchone()[0],old)
   db.execute('DELETE FROM generated_players WHERE id=44')
   self.assertEqual(db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0],0)
   self.assertEqual(db.execute('SELECT COUNT(*) FROM player_portrait_v3_replacement_backup').fetchone()[0],0)
  finally:db.close()

 def test_rejects_invalid_version_pair_and_approved_without_asset(self):
  db,_=self.make_db()
  try:
   db.executescript(V41)
   with self.assertRaises(sqlite3.IntegrityError):
    db.execute("""UPDATE player_portrait_profiles SET schema_version='player-portraits-v4'
     WHERE player_id=44""")
   with self.assertRaises(sqlite3.IntegrityError):
    db.execute("""UPDATE player_portrait_profiles SET asset_key=NULL WHERE player_id=44""")
  finally:db.close()

if __name__=='__main__':unittest.main()
