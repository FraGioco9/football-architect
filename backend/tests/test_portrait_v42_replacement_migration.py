import json
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V3 = (ROOT / 'migrations' / '0026_player_portrait_profiles.sql').read_text()
V41 = (ROOT / 'migrations' / '0031_portrait_v41_replacement.sql').read_text()
V42 = (ROOT / 'migrations' / '0033_portrait_v42_replacement.sql').read_text()
STAGE_DDL = V42.split('CREATE TABLE IF NOT EXISTS player_portrait_v42_cutover_guard')[0]


class PortraitV42IdentityOnlyMigration(unittest.TestCase):
    @staticmethod
    def snapshot(pid):
        return json.dumps({'schema_version': 'player-portraits-v5',
                           'prompt_version': 'player-portrait-v4.2',
                           'player_id': pid,
                           'appearance_fingerprint': f'{pid:016x}'})

    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript('CREATE TABLE generated_players(id INTEGER PRIMARY KEY,payload_json TEXT NOT NULL);')
        self.db.executemany('INSERT INTO generated_players(id,payload_json) VALUES (?,?)',
                            [(pid, '{}') for pid in (44, 47, 93)])
        self.db.executescript(V3)
        old = json.dumps({'prompt_version': 'player-portrait-v3'})
        for pid in (44, 93):
            self.db.execute("""INSERT INTO player_portrait_profiles
              (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
              VALUES (?,'player-portraits-v2','player-portrait-v3',?,'pending',NULL,1600000000)""", (pid, old))
        self.db.executescript(V41)
        old_approved = json.dumps({'prompt_version': 'player-portrait-v4.1'})
        self.db.execute("""INSERT INTO player_portrait_profiles
         (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
         VALUES (47,'player-portraits-v4','player-portrait-v4.1',?,'approved',
         'assets/players/portraits/47.webp',1600000001)""", (old_approved,))
        self.db.execute("""INSERT INTO player_portrait_v3_replacement_backup
         (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
         VALUES (47,'player-portraits-v2','player-portrait-v3',?,'approved',
         'assets/players/portraits/47.webp',1600000001)""", (old,))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def stage(self, ids):
        self.db.executescript(STAGE_DDL)
        for pid in ids:
            self.db.execute("""INSERT INTO player_portrait_v42_cutover_candidates
             (player_id,snapshot_json) VALUES (?,?)""", (pid, self.snapshot(pid)))
        self.db.commit()

    def test_no_stage_rejects_cutover_before_touching_legacy_rows(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.executescript(V42)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 3)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_v3_replacement_backup').fetchone()[0], 1)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles WHERE status="approved"').fetchone()[0], 1)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_partial_stage_rejected_without_modifying_existing_portraits(self):
        self.stage((44, 47))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.executescript(V42)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 3)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_v3_replacement_backup').fetchone()[0], 1)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_complete_stage_replaces_every_identity_with_pending_no_assets(self):
        self.stage((44, 47, 93))
        self.db.executescript(V42)
        rows = self.db.execute("""SELECT player_id,schema_version,prompt_version,status,asset_key,
              json_extract(snapshot_json,'$.appearance_fingerprint')
              FROM player_portrait_profiles ORDER BY player_id""").fetchall()
        self.assertEqual(rows, [
            (i,'player-portraits-v5','player-portrait-v4.2','pending',None,f'{i:016x}')
            for i in (44,47,93)])
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM generated_players').fetchone()[0], 3)
        table_names = {r[0] for r in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        for name in ('player_portrait_v3_replacement_backup',
                     'player_portrait_v42_cutover_candidates','player_portrait_v42_cutover_guard',
                     'player_portrait_profiles_v42_next'):
            self.assertNotIn(name, table_names)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_stage_rejects_wrong_snapshot_id_version_duplicate_face_or_invalid_hash(self):
        self.stage((44,))
        bad = [
            (47, json.dumps({'schema_version': 'player-portraits-v5',
                'prompt_version': 'player-portrait-v4.2','player_id': 44,'appearance_fingerprint':'1'*16})),
            (47, json.dumps({'schema_version': 'player-portraits-v4',
                'prompt_version': 'player-portrait-v4.2','player_id': 47,'appearance_fingerprint':'1'*16})),
            (47, json.dumps({'schema_version': 'player-portraits-v5',
                'prompt_version': 'player-portrait-v4.2','player_id': 47,'appearance_fingerprint':'x'*16})),
            (47, json.dumps({'schema_version': 'player-portraits-v5',
                'prompt_version': 'player-portrait-v4.2','player_id': 47,'appearance_fingerprint':f'{44:016x}'})),
            (47, '{}'),
        ]
        for row in bad:
            with self.subTest(row=row):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute('INSERT INTO player_portrait_v42_cutover_candidates(player_id,snapshot_json) VALUES (?,?)',row)

    def test_new_schema_rejects_old_versions_and_wrong_embedded_id(self):
        self.stage((44, 47, 93))
        self.db.executescript(V42)
        self.db.execute('DELETE FROM player_portrait_profiles WHERE player_id=93')
        for schema,prompt,snap in [
            ('player-portraits-v2','player-portrait-v3',self.snapshot(93)),
            ('player-portraits-v4','player-portrait-v4.1',self.snapshot(93)),
            ('player-portraits-v5','player-portrait-v4.2',self.snapshot(44)),
            ('player-portraits-v5','player-portrait-v4.2','{}')]:
            with self.subTest(schema=schema,prompt=prompt,snap=snap):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute("""INSERT INTO player_portrait_profiles
                      (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
                      VALUES (93,?,?,?,'pending',NULL,1600000003)""", (schema,prompt,snap))

    def test_150_player_stage_preserves_all_players_without_images(self):
        extra=list(range(94,241))
        self.db.executemany('INSERT INTO generated_players(id,payload_json) VALUES (?,?)',[(i,'{}') for i in extra])
        old = json.dumps({'prompt_version':'player-portrait-v3'})
        self.db.executemany("""INSERT INTO player_portrait_profiles(
          player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
          VALUES (?,'player-portraits-v2','player-portrait-v3',?,'pending',NULL,1600000000)""",
          [(i,old) for i in extra])
        self.db.commit()
        self.stage([44,47,93,*extra])
        self.db.executescript(V42)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM generated_players').fetchone()[0], 150)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 150)
        self.assertEqual(self.db.execute("""SELECT COUNT(*) FROM player_portrait_profiles
          WHERE schema_version='player-portraits-v5' AND prompt_version='player-portrait-v4.2'
          AND status='pending' AND asset_key IS NULL""").fetchone()[0], 150)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_empty_new_world_can_install_v42_without_stage(self):
        db=sqlite3.connect(':memory:')
        db.execute('PRAGMA foreign_keys=ON')
        try:
            db.execute('CREATE TABLE generated_players(id INTEGER PRIMARY KEY,payload_json TEXT)')
            db.executescript(V3)
            db.executescript(V41)
            db.executescript(V42)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 0)
            table_names={r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            self.assertNotIn('player_portrait_v3_replacement_backup',table_names)
        finally:
            db.close()


if __name__ == '__main__':
    unittest.main()
