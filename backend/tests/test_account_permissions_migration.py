"""Unified Player identity permission boundaries; SQLite/D1 local migration."""
from pathlib import Path
import sqlite3
import unittest
ROOT=Path(__file__).resolve().parents[1]
class PermissionsMigration(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for file in sorted((ROOT/'migrations').glob('*.sql')):
   self.db.executescript(file.read_text(encoding='utf-8'))
  self.db.execute('INSERT INTO player_accounts(id,email_normalized,password_verifier,email_verified_at,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',('p1','p1@example.invalid','synthetic',1,'active',1,1))
 def tearDown(self): self.db.close()
 def test_new_account_has_no_permissions(self):
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM account_permissions').fetchone()[0],0)
 def test_permissions_are_account_scoped(self):
  self.db.execute('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES (?,?,?)',('p1','admin.access',2))
  self.assertEqual(self.db.execute('SELECT permission FROM account_permissions WHERE account_id=?',('p1',)).fetchone()[0],'admin.access')
  for invalid in ('admin','superuser','admin.grant','admin.world.reset'):
   with self.assertRaises(sqlite3.IntegrityError):
    self.db.execute('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES (?,?,?)',('p1',invalid,2))
 def test_deleting_player_revokes_permission_without_touching_admin(self):
  self.db.execute('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES (?,?,?,?)',('a1','p1@example.invalid','synthetic',1))
  self.db.execute('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES (?,?,?)',('p1','admin.access',2))
  self.db.execute('DELETE FROM player_accounts WHERE id=?',('p1',))
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM account_permissions').fetchone()[0],0)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM admin_accounts').fetchone()[0],1)
if __name__=='__main__':unittest.main()
