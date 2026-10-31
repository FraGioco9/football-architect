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

    def test_replace_cannot_relabel_an_initialized_pool(self):
        self.db.execute("INSERT INTO account_environment_pool VALUES(1,'dev-preview',1)")
        for clause in ('INSERT OR REPLACE', 'REPLACE'):
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(clause + " INTO account_environment_pool VALUES(1,'production',2)")
            self.assertEqual(self.db.execute('SELECT pool FROM account_environment_pool').fetchone()[0], 'dev-preview')

    def test_replace_cannot_overwrite_an_existing_receipt(self):
        self.db.execute("INSERT INTO account_permission_events VALUES('receipt','grant','dev-preview','opaque-player',NULL,'local-owner-cli',1)")
        for clause in ('INSERT OR REPLACE', 'REPLACE'):
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(clause + " INTO account_permission_events VALUES('receipt','revoke','production','other-player',NULL,'local-owner-cli',2)")
            self.assertEqual(self.db.execute("SELECT action,pool,player_account_id FROM account_permission_events WHERE id='receipt'").fetchone(), ('grant','dev-preview','opaque-player'))

    def test_upgrade_preserves_preexisting_pool_and_receipt(self):
        self.db.close()
        self.db = sqlite3.connect(':memory:')
        for path in sorted(MIGRATIONS.glob('*.sql')):
            if path.name >= '0018':
                break
            self.db.executescript(path.read_text())
        self.db.execute("INSERT INTO account_environment_pool VALUES(1,'dev-preview',1)")
        self.db.execute("INSERT INTO account_permission_events VALUES('old','grant','dev-preview','opaque-player',NULL,'local-owner-cli',1)")
        before = tuple(self.db.execute('SELECT * FROM ' + table).fetchall() for table in ('account_environment_pool', 'account_permission_events', 'world_state'))
        for _ in range(2):
            self.db.executescript((MIGRATIONS / '0018_owner_permissions_insert_guards.sql').read_text())
        after = tuple(self.db.execute('SELECT * FROM ' + table).fetchall() for table in ('account_environment_pool', 'account_permission_events', 'world_state'))
        self.assertEqual(after, before)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("REPLACE INTO account_environment_pool VALUES(1,'production',2)")
