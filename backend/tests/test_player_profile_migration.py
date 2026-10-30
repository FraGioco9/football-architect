import pathlib
import sqlite3
import unittest

MIGRATIONS = pathlib.Path(__file__).resolve().parents[1] / 'migrations'

class PlayerProfileMigration(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        for path in sorted(MIGRATIONS.glob('*.sql')):
            if path.name >= '0016':
                break
            self.db.executescript(path.read_text())
        self.db.execute("INSERT INTO player_accounts(id,email_normalized,password_verifier,created_at,updated_at) VALUES('old','old@example.invalid','verifier',1,1)")
        self.db.commit()
        self.db.executescript((MIGRATIONS / '0016_player_profile.sql').read_text())

    def tearDown(self):
        self.db.close()

    def add(self, id, username):
        self.db.execute('INSERT INTO player_accounts(id,email_normalized,password_verifier,created_at,updated_at,username) VALUES(?,?,?,1,1,?)', (id, id+'@example.invalid', 'verifier', username))

    def test_existing_account_survives_without_invented_profile(self):
        self.assertEqual(self.db.execute("SELECT username,nationality,city FROM player_accounts WHERE id='old'").fetchone(), (None,None,None))

    def test_case_insensitive_unique_username_and_optional_profiles(self):
        self.add('one', 'Francesco')
        with self.assertRaises(sqlite3.IntegrityError):
            self.add('two', 'francesco')
        self.assertEqual(self.db.execute("SELECT count(*) FROM player_accounts WHERE id='two'").fetchone()[0],0)

    def test_username_constraints_are_enforced_in_database(self):
        for value in ['', 'ab', 'a'*25, 'a b', 'àbc', 'abc-']:
            with self.subTest(value=value), self.assertRaises(sqlite3.IntegrityError):
                self.add(value, value)

    def test_profile_disappears_with_account(self):
        self.add('one','Francesco')
        self.db.execute("UPDATE player_accounts SET nationality='IT',city='Bologna' WHERE id='one'")
        self.db.execute("DELETE FROM player_accounts WHERE id='one'")
        self.assertEqual(self.db.execute("SELECT count(*) FROM player_accounts WHERE username='Francesco'").fetchone()[0],0)

if __name__ == '__main__':
    unittest.main()
