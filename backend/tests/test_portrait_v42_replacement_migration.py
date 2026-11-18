import json
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V3 = (ROOT / 'migrations' / '0026_player_portrait_profiles.sql').read_text()
V41 = (ROOT / 'migrations' / '0031_portrait_v41_replacement.sql').read_text()
V42 = (ROOT / 'migrations' / '0033_portrait_v42_replacement.sql').read_text()
# The ONLY table created before owner-authorised staging. No old identities.
STAGE_DDL = V42.split('CREATE TABLE IF NOT EXISTS player_portrait_v42_cutover_guard')[0]


class PortraitV42Migration(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript(
            'CREATE TABLE generated_players(id INTEGER PRIMARY KEY,payload_json TEXT NOT NULL);')
        self.db.executemany('INSERT INTO generated_players(id,payload_json) VALUES (?,?)',
                            [(i, '{}') for i in (44, 47, 93)])
        self.db.executescript(V3)
        old = json.dumps({'player_id': 44, 'prompt_version': 'player-portrait-v3'})
        for pid in (44, 93):
            self.db.execute("""INSERT INTO player_portrait_profiles
              (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
              VALUES (?,'player-portraits-v2','player-portrait-v3',?,'pending',NULL,1600000000)""",
                            (pid, old))
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

    @staticmethod
    def new_snapshot(pid):
        return json.dumps({'schema_version': 'player-portraits-v5',
                           'prompt_version': 'player-portrait-v4.2', 'player_id': pid})

    def stage(self, ids):
        self.db.executescript(STAGE_DDL)
        for pid in ids:
            self.db.execute("""INSERT INTO player_portrait_v42_cutover_candidates
             (player_id,snapshot_json,asset_key,image_sha256)
             VALUES (?,?,?,?)""", (pid, self.new_snapshot(pid),
                                  f'assets/players/portraits/{pid}.webp', 'a' * 64))
        self.db.commit()

    def test_fail_closed_when_no_replacement_package(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.executescript(V42)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM generated_players').fetchone()[0], 3)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 3)
        names = {row[0] for row in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertIn('player_portrait_v3_replacement_backup', names)
        self.assertNotIn('player_portrait_profiles_v42_next', names)

    def test_fail_closed_on_partial_staging_without_touching_old_identities(self):
        self.stage((44, 47))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.executescript(V42)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 3)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_v3_replacement_backup').fetchone()[0], 1)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_full_cutover_replaces_old_rows_without_backups_or_compatibility(self):
        self.stage((44, 47, 93))
        self.db.executescript(V42)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM generated_players').fetchone()[0], 3)
        profiles = self.db.execute("""SELECT player_id,schema_version,prompt_version,status,asset_key
          FROM player_portrait_profiles ORDER BY player_id""").fetchall()
        self.assertEqual(profiles, [
            (i, 'player-portraits-v5', 'player-portrait-v4.2', 'approved',
             f'assets/players/portraits/{i}.webp') for i in (44, 47, 93)])
        names = {row[0] for row in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        for forbidden in ('player_portrait_v3_replacement_backup',
                          'player_portrait_profiles_v42_next',
                          'player_portrait_v42_cutover_candidates',
                          'player_portrait_v42_cutover_guard'):
            self.assertNotIn(forbidden, names)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_reject_legacy_pairs_and_mismatched_snapshot_after_cutover(self):
        self.stage((44, 47, 93))
        self.db.executescript(V42)
        bad_rows = [
            ('player-portraits-v2', 'player-portrait-v3', self.new_snapshot(93)),
            ('player-portraits-v4', 'player-portrait-v4.1', self.new_snapshot(93)),
            ('player-portraits-v5', 'player-portrait-v4.1', self.new_snapshot(93)),
            ('player-portraits-v5', 'player-portrait-v4.2', self.new_snapshot(44)),
            ('player-portraits-v5', 'player-portrait-v4.2', '{}')
        ]
        self.db.execute('DELETE FROM player_portrait_profiles WHERE player_id=93')
        for schema, prompt, snapshot in bad_rows:
            with self.subTest(schema=schema, prompt=prompt, snapshot=snapshot):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute("""INSERT INTO player_portrait_profiles
                      (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
                      VALUES (93,?,?,?,'pending',NULL,1600000003)""",
                                    (schema, prompt, snapshot))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 2)

    def test_stage_rejects_wrong_snapshot_id_version_duplicate_asset_or_bad_sha(self):
        self.stage((44,))
        base = (47, self.new_snapshot(47), 'assets/players/portraits/47.webp', 'b' * 64)
        bad = [
            (47, self.new_snapshot(44), base[2], base[3]),
            (47, '{"schema_version":"player-portraits-v5"}', base[2], base[3]),
            (47, base[1], 'assets/players/portraits/44.webp', base[3]),
            (47, base[1], base[2], 'not-a-sha'),
            (47, base[1], base[2], 'G' * 64),
        ]
        for row in bad:
            with self.subTest(row=row):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute("""INSERT INTO player_portrait_v42_cutover_candidates
                     (player_id,snapshot_json,asset_key,image_sha256) VALUES (?,?,?,?)""", row)

    def test_150_player_cutover_is_exact_and_preserves_all_players(self):
        extra = list(range(94, 241))
        self.db.executemany('INSERT INTO generated_players(id,payload_json) VALUES (?,?)',
                            [(i, '{}') for i in extra])
        old = json.dumps({'player_id': 44, 'prompt_version': 'player-portrait-v3'})
        self.db.executemany("""INSERT INTO player_portrait_profiles
          (player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
          VALUES (?,'player-portraits-v2','player-portrait-v3',?,'pending',NULL,1600000000)""",
                            [(i, old) for i in extra])
        self.db.commit()
        self.stage([44, 47, 93, *extra])
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM generated_players').fetchone()[0], 150)
        self.db.executescript(V42)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM generated_players').fetchone()[0], 150)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 150)
        self.assertEqual(self.db.execute("""SELECT COUNT(*) FROM player_portrait_profiles
         WHERE schema_version='player-portraits-v5' AND prompt_version='player-portrait-v4.2'
          AND status='approved' AND asset_key IS NOT NULL""").fetchone()[0], 150)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_empty_new_world_can_install_v42_without_old_portraits_or_staging(self):
        db = sqlite3.connect(':memory:')
        db.execute('PRAGMA foreign_keys=ON')
        try:
            db.execute('CREATE TABLE generated_players(id INTEGER PRIMARY KEY,payload_json TEXT)')
            db.executescript(V3)
            db.executescript(V41)
            db.executescript(V42)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM player_portrait_profiles').fetchone()[0], 0)
            names = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            self.assertNotIn('player_portrait_v3_replacement_backup', names)
            self.assertNotIn('player_portrait_v42_cutover_candidates', names)
        finally:
            db.close()


if __name__ == '__main__':
    unittest.main()
