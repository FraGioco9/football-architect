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
        self.db.execute("""INSERT INTO player_portrait_v3_replacement_backup(
            player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
            VALUES (47,'player-portraits-v2','player-portrait-v3',?,'approved',
              'assets/players/portraits/47.webp',1600000001)""", (old,))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_cutover_drops_old_identities_and_all_legacy_backup_tables(self):
        self.db.executescript(V42)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 0)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM generated_players').fetchone()[0], 3)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])
        names = {r[0] for r in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertNotIn('player_portrait_v3_replacement_backup', names)
        self.assertNotIn('player_portrait_v42_replacement_backup', names)
        self.assertNotIn('player_portrait_profiles_v42_next', names)

        v42 = json.dumps({'schema_version': 'player-portraits-v5',
                          'prompt_version': 'player-portrait-v4.2', 'player_id': 93})
        self.db.execute("""INSERT INTO player_portrait_profiles
            (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
            VALUES (93,'player-portraits-v5','player-portrait-v4.2',?,'pending',NULL,1600000002)""", (v42,))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 1)

    def test_rejects_all_legacy_version_pairs_and_incorrect_asset_states(self):
        self.db.executescript(V42)
        for schema, prompt in [
            ('player-portraits-v2', 'player-portrait-v3'),
            ('player-portraits-v4', 'player-portrait-v4.1'),
            ('player-portraits-v5', 'player-portrait-v4.1'),
            ('player-portraits-v2', 'player-portrait-v4.2')
        ]:
            with self.subTest(schema=schema, prompt=prompt):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute("""INSERT INTO player_portrait_profiles(
                      player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at
                     ) VALUES (93,?,?, '{}','pending',NULL,1600000002)""", (schema, prompt))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO player_portrait_profiles(
             player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at
            ) VALUES (93,'player-portraits-v5','player-portrait-v4.2','{}','approved',NULL,1600000002)""")
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 0)

    
    def test_150_player_cutover_keeps_players_but_drops_legacy_identities(self):
        extra = list(range(94, 241))  # 147 additional players; 150 total
        self.db.executemany('INSERT INTO generated_players(id,payload_json) VALUES (?,?)',
                            [(i, '{}') for i in extra])
        old = json.dumps({'schema_version': 'player-portraits-v2',
                          'prompt_version': 'player-portrait-v3'})
        self.db.executemany("""INSERT INTO player_portrait_profiles
          (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
          VALUES (?,'player-portraits-v2','player-portrait-v3',?,'pending',NULL,1600000000)""",
                            [(i, old) for i in extra])
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM generated_players').fetchone()[0], 150)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 149)
        self.db.executescript(V42)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM generated_players').fetchone()[0], 150)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 0)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_version_and_player_id_inside_snapshot_are_enforced(self):
        self.db.executescript(V42)
        valid = {'schema_version': 'player-portraits-v5',
                 'prompt_version': 'player-portrait-v4.2', 'player_id': 93}
        for bad in [
            {**valid, 'schema_version': 'player-portraits-v4'},
            {**valid, 'prompt_version': 'player-portrait-v4.1'},
            {**valid, 'player_id': 47},
            {**valid, 'player_id': '93'},
            {'schema_version': valid['schema_version'], 'prompt_version': valid['prompt_version']},
            {}
        ]:
            with self.subTest(snapshot=bad):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute("""INSERT INTO player_portrait_profiles(
                       player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at
                    ) VALUES (93,'player-portraits-v5','player-portrait-v4.2',?,'pending',NULL,1600000002)""",
                                    (json.dumps(bad),))
        self.db.execute("""INSERT INTO player_portrait_profiles(
          player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at
        ) VALUES (93,'player-portraits-v5','player-portrait-v4.2',?,'pending',NULL,1600000002)""",
                        (json.dumps(valid),))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 1)


if __name__ == '__main__':
    unittest.main()
