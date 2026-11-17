"""Guarded Season 0 world revision and approval persistence migration (SQLite-only)."""
from pathlib import Path
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[1] / 'migrations'

class SeasonZeroApprovalMigrationTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        for migration in sorted(ROOT.glob('*.sql')):
            if migration.name >= '0032':
                break
            self.db.executescript(migration.read_text())
        self.before = self.db.execute("SELECT generation,revision,phase FROM world_state").fetchone()
        self.db.executescript((ROOT/'0032_season_zero_entrant_approvals.sql').read_text())

    def tearDown(self):
        self.db.close()

    def test_initial_identity_retained_and_revision_allows_season_zero_approval(self):
        self.assertEqual(self.db.execute("SELECT generation,revision,phase FROM world_state").fetchone(), self.before)
        self.db.execute("UPDATE world_state SET revision=1 WHERE id=1 AND phase='unstarted'")
        self.assertEqual(self.db.execute("SELECT revision,season_number,day,phase FROM world_state").fetchone(),(1,0,0,'unstarted'))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE world_state SET day=1 WHERE id=1")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM world_state")

    def test_scoped_receipts_are_immutable_outside_generation_reset(self):
        generation = self.before[0]
        self.db.execute("INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES('a','a@example.test','fixture',1)")
        args=('domestic',generation,'a'*64,'b'*64,'c'*64,'d'*64,'a',1,1)
        self.db.execute('INSERT INTO season_zero_approvals VALUES(?,?,?,?,?,?,?,?,?)',args)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('INSERT INTO season_zero_approvals VALUES(?,?,?,?,?,?,?,?,?)',args)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE season_zero_approvals SET approved_revision=2")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('DELETE FROM season_zero_approvals')
        self.db.execute("INSERT INTO world_reset_permits VALUES(?,?)",(generation,'550e8400-e29b-41d4-a716-446655440000'))
        self.db.execute('DELETE FROM season_zero_approvals')
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM season_zero_approvals').fetchone()[0],0)

if __name__ == '__main__':
    unittest.main()
