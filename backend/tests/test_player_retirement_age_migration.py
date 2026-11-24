"""Test the real retirement age conversion SQL and every conditional boundary."""
import json
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL = (ROOT / 'migrations' / '0037_player_retirement_age.sql').read_text()
HAZARDS = [(33, 2), (34, 5), (35, 12), (36, 25), (37, 45), (38, 70), (39, 90)]

class RetirementAgeMigrationTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('CREATE TABLE generated_players(id INTEGER PRIMARY KEY, payload_json TEXT NOT NULL)')

    def tearDown(self):
        self.db.close()

    def insert(self, payload):
        self.db.execute('INSERT INTO generated_players VALUES(1,?)', (json.dumps(payload),))

    def read(self):
        return json.loads(self.db.execute('SELECT payload_json FROM generated_players').fetchone()[0])

    def test_each_conditional_boundary_and_guaranteed_age_40(self):
        for idx, (age, probability) in enumerate(HAZARDS + [(40, 100)]):
            with self.subTest(age=age):
                self.db.execute('DELETE FROM generated_players')
                original = {'age': 18, 'career_status': 'active', 'development_aptitude': 44, 'retirement_seed': 'legacy'}
                self.insert(original)
                # Exact threshold at each earlier age must survive; one below the chosen threshold retires.
                rolls = iter([p for _, p in HAZARDS[:idx]] + ([probability - 1] if age < 40 else []))
                self.db.create_function('random', 0, lambda: next(rolls))
                self.db.executescript(SQL)
                expected = {k: v for k, v in original.items() if k != 'retirement_seed'}
                expected['retirement_age'] = age
                self.assertEqual(self.read(), expected)
                self.db.executescript(SQL)  # no additional random draws, even with exhausted iterator
                self.assertEqual(self.read(), expected)

    def test_preserves_existing_age_and_removes_legacy_seed(self):
        self.insert({'age': 17, 'retirement_age': 38, 'retirement_seed': 'legacy'})
        self.db.create_function('random', 0, lambda: self.fail('must not redraw'))
        self.db.executescript(SQL)
        self.assertEqual(self.read(), {'age': 17, 'retirement_age': 38})

    def test_missing_seed_or_null_age_also_backfills(self):
        self.insert({'age': 16, 'retirement_age': None})
        self.db.create_function('random', 0, lambda: 0)
        self.db.executescript(SQL)
        self.assertEqual(self.read(), {'age': 16, 'retirement_age': 33})

    def test_confirmed_generation_uses_same_conditional_thresholds(self):
        source = (ROOT / 'src' / 'players-generation-command.ts').read_text()
        for age, probability in HAZARDS:
            self.assertIn(f'WHEN abs(random()) % 100 < {probability} THEN {age}', source)
        self.assertIn('ELSE 40 END', source)
