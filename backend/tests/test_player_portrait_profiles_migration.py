"""Generic private portrait profile schema contracts (no DEV pilot backfill)."""
from pathlib import Path
import json
import sqlite3
import unittest

BACKEND = Path(__file__).resolve().parents[1]
SCHEMA = (BACKEND / 'migrations' / '0026_player_portrait_profiles.sql').read_text()
PLAYER_IDS = (7, 19)


def make_db():
 db = sqlite3.connect(':memory:')
 db.execute('PRAGMA foreign_keys=ON')
 db.executescript('CREATE TABLE generated_players (id INTEGER PRIMARY KEY AUTOINCREMENT, payload_json TEXT NOT NULL);')
 for player_id in PLAYER_IDS:
  db.execute('INSERT INTO generated_players(id, payload_json) VALUES (?, ?)', (
   player_id, json.dumps({'display_name': f'Synthetic Footballer {player_id}', 'nationality': 'ITA'})
  ))
 db.executescript(SCHEMA)
 db.commit()
 return db


def insert_profile(db, player_id, status='pending', asset_key=None):
 snapshot = json.dumps({
  'player_id': player_id, 'schema_version': 'player-portraits-v2',
  'prompt_version': 'player-portrait-v3', 'appearance_fingerprint': 'synthetic-test-only'
 })
 db.execute("""INSERT INTO player_portrait_profiles(
  player_id, schema_version, prompt_version, snapshot_json, status, asset_key, created_at
 ) VALUES (?, 'player-portraits-v2', 'player-portrait-v3', ?, ?, ?, 1600000000)""",
  (player_id, snapshot, status, asset_key))
 return snapshot


class PortraitD1MigrationTest(unittest.TestCase):
 def test_schema_does_not_backfill_or_approve_players(self):
  db = make_db()
  try:
   self.assertEqual(db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 0)
   db.executescript(SCHEMA)
   self.assertEqual(db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 0)
   self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])
  finally:
   db.close()

 def test_generic_pending_approval_and_cascade(self):
  db = make_db()
  try:
   snapshot = insert_profile(db, PLAYER_IDS[0])
   insert_profile(db, PLAYER_IDS[1], 'approved',
    f'assets/players/portraits/{PLAYER_IDS[1]}.webp')
   rows = db.execute('SELECT player_id, snapshot_json, status, asset_key FROM player_portrait_profiles ORDER BY player_id').fetchall()
   self.assertEqual([row[0] for row in rows], list(PLAYER_IDS))
   self.assertEqual(rows[0], (PLAYER_IDS[0], snapshot, 'pending', None))
   self.assertEqual(rows[1][2:], ('approved', 'assets/players/portraits/19.webp'))
   self.assertEqual(json.loads(rows[1][1])['player_id'], PLAYER_IDS[1])
   db.execute('UPDATE player_portrait_profiles SET status=?, asset_key=? WHERE player_id=?',
    ('approved', 'assets/players/portraits/7.webp', PLAYER_IDS[0]))
   self.assertEqual(db.execute('SELECT status FROM player_portrait_profiles WHERE player_id=7').fetchone()[0],
    'approved')
   db.execute('DELETE FROM generated_players WHERE id=?', (PLAYER_IDS[0],))
   self.assertEqual([row[0] for row in db.execute('SELECT player_id FROM player_portrait_profiles')], [PLAYER_IDS[1]])
   self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])
  finally:
   db.close()

 def test_private_constraints_reject_invalid_profiles(self):
  db = make_db()
  try:
   for query, params in [
    ("""INSERT INTO player_portrait_profiles(player_id,schema_version,prompt_version,snapshot_json,status,created_at)
     VALUES (999,'player-portraits-v2','player-portrait-v3','{}','pending',1)""", ()),
    ("""INSERT INTO player_portrait_profiles(player_id,schema_version,prompt_version,snapshot_json,status,created_at)
     VALUES (7,'player-portraits-v2','player-portrait-v3','{}','approved',1)""", ()),
    ("""INSERT INTO player_portrait_profiles(player_id,schema_version,prompt_version,snapshot_json,status,created_at)
     VALUES (7,'player-portraits-v2','player-portrait-v4','{}','pending',1)""", ()),
    ("""INSERT INTO player_portrait_profiles(player_id,schema_version,prompt_version,snapshot_json,status,created_at)
     VALUES (7,'player-portraits-v2','player-portrait-v3','not-json','pending',1)""", ()),
    ("""INSERT INTO player_portrait_profiles(player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
     VALUES (7,'player-portraits-v2','player-portrait-v3','{}','rejected','assets/players/portraits/7.webp',1)""", ())
   ]:
    with self.subTest(query=query), self.assertRaises(sqlite3.IntegrityError):
     db.execute(query, params)
   self.assertEqual(db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 0)
  finally:
   db.close()


if __name__ == '__main__':
 unittest.main()
