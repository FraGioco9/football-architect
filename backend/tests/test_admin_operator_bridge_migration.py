"""Local D1 bridge preserves existing admin audit rows and never self-grants."""
from pathlib import Path
import sqlite3
import unittest
ROOT=Path(__file__).resolve().parents[1]
class BridgeTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for path in sorted((ROOT/'migrations').glob('*.sql')):self.db.executescript(path.read_text(encoding='utf-8'))
  self.db.execute('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)',('operator','operator@example.invalid','synthetic',1))
  self.db.execute('INSERT INTO player_accounts(id,email_normalized,password_verifier,status,email_verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',('player','player@example.invalid','synthetic','active',1,1,1))
 def tearDown(self):self.db.close()
 def test_link_requires_explicit_insert_not_email_matching(self):
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_admin_operator_links').fetchone()[0],0)
  self.db.execute('INSERT INTO player_admin_operator_links VALUES(?,?,?)',('player','operator',2))
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM account_permissions').fetchone()[0],0)
 def test_link_restricts_missing_operator_and_preserves_historical_audit(self):
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute('INSERT INTO player_admin_operator_links VALUES(?,?,?)',('player','missing',2))
  self.db.execute('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',('op','gen','key','a'*64,'operator','test',0,1,'{}',1))
  self.db.execute('INSERT INTO player_admin_operator_links VALUES(?,?,?)',('player','operator',2))
  self.db.execute('DELETE FROM player_accounts WHERE id=?',('player',))
  self.assertEqual(self.db.execute('SELECT account_id FROM admin_operations WHERE id=?',('op',)).fetchone()[0],'operator')
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM player_admin_operator_links').fetchone()[0],0)
if __name__=='__main__':unittest.main()
