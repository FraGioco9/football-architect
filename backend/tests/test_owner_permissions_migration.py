import pathlib
import sqlite3
import unittest

MIGRATIONS = pathlib.Path(__file__).resolve().parents[1] / 'migrations'

class OwnerPermissionMigration(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        for path in sorted(MIGRATIONS.glob('*.sql')):
            self.db.executescript(path.read_text())

    def tearDown(self):
        self.db.close()

    def test_migration_never_assigns_a_pool_account_or_permission(self):
        for table in ('account_environment_pool', 'account_permission_events', 'account_permissions', 'admin_accounts', 'player_accounts'):
            self.assertEqual(self.db.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0], 0)
        self.db.executescript((MIGRATIONS / '0017_owner_permissions.sql').read_text())
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM world_state').fetchone()[0], 1)

    def test_pool_relabel_and_delete_are_rejected(self):
        self.db.execute("INSERT INTO account_environment_pool VALUES(1,'dev-preview',1)")
        for sql in ("UPDATE account_environment_pool SET pool='production'", 'DELETE FROM account_environment_pool'):
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(sql)
        self.assertEqual(self.db.execute('SELECT pool FROM account_environment_pool').fetchone()[0], 'dev-preview')

    def test_permission_receipts_are_append_only_and_bounded(self):
        self.db.execute("INSERT INTO account_permission_events VALUES('receipt','grant','dev-preview','opaque-player',NULL,'local-owner-cli',1)")
        for sql in ("UPDATE account_permission_events SET action='revoke'", 'DELETE FROM account_permission_events'):
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(sql)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO account_permission_events VALUES('other','owner','production','opaque',NULL,'local-owner-cli',1)")
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM admin_operations').fetchone()[0], 0)
