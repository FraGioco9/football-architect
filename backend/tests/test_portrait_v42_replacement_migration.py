import json
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V3 = (ROOT / 'migrations' / '0026_player_portrait_profiles.sql').read_text()
V41 = (ROOT / 'migrations' / '0031_portrait_v41_replacement.sql').read_text()
V42 = (ROOT / 'migrations' / '0033_portrait_v42_replacement.sql').read_text()


class PortraitV42Migration(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript('CREATE TABLE generated_players(id INTEGER PRIMARY KEY,payload_json TEXT NOT NULL);')
        self.db.executemany('INSERT INTO generated_players(id,payload_json) VALUES (?,?)',
                            [(i, '{}') for i in (44, 47, 93)])
        self.db.executescript(V3)
        old = json.dumps({'player_id': 44, 'prompt_version': 'player-portrait-v3'})
        self.db.execute("""INSERT INTO player_portrait_profiles
           (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
           VALUES (44,'player-portraits-v2','player-portrait-v3',?,'pending',NULL,1600000000)""", (old,))
        self.db.executescript(V41)
        approved = json.dumps({'player_id': 47, 'prompt_version': 'player-portrait-v4.1'})
        self.db.execute("""INSERT INTO player_portrait_profiles
           (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
           VALUES (47,'player-portraits-v4','player-portrait-v4.1',?,'approved',
             'assets/players/portraits/47.webp',1600000001)""", (approved,))
        self.before = list(self.db.execute('SELECT * FROM player_portrait_profiles ORDER BY player_id'))

    def tearDown(self):
        self.db.close()

    def test_schema_only_migration_preserves_legacy_portraits_and_adds_v42(self):
        self.db.executescript(V42)
        self.assertEqual(self.before, list(self.db.execute('SELECT * FROM player_portrait_profiles ORDER BY player_id')))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_v42_replacement_backup').fetchone()[0], 0)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])
        v42 = json.dumps({'schema_version': 'player-portraits-v5',
                          'prompt_version': 'player-portrait-v4.2', 'player_id': 93})
        self.db.execute("""INSERT INTO player_portrait_profiles
            (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
            VALUES (93,'player-portraits-v5','player-portrait-v4.2',?,'pending',NULL,1600000002)""", (v42,))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 3)
        self.db.execute("""INSERT INTO player_portrait_v42_replacement_backup
          (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
          SELECT player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at
          FROM player_portrait_profiles WHERE player_id IN (44,47)""")
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_v42_replacement_backup').fetchone()[0], 2)
        self.db.execute('DELETE FROM generated_players WHERE id=47')
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_v42_replacement_backup').fetchone()[0], 1)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_fails_closed_on_mismatched_versions_and_incomplete_assets(self):
        self.db.executescript(V42)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""UPDATE player_portrait_profiles
             SET schema_version='player-portraits-v5' WHERE player_id=47""")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE player_portrait_profiles SET asset_key=NULL WHERE player_id=47")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO player_portrait_profiles
                (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
                VALUES (93,'player-portraits-v5','player-portrait-v4.1','{}','pending',NULL,1600000002)""")
        self.assertEqual(self.before, list(self.db.execute('SELECT * FROM player_portrait_profiles ORDER BY player_id')))


if __name__ == '__main__':
    unittest.main()
