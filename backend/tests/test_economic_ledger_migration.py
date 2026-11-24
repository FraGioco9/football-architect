"""SQLite invariant tests for inert #775 migration; runtime D1 tests are separate."""
import json
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL = (ROOT / 'migrations' / '0039_economic_ledger.sql').read_text()

class EconomicLedgerMigrationTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript((ROOT / 'migrations' / '0013_player_auth.sql').read_text())
        self.db.executescript((ROOT / 'migrations' / '0001_world.sql').read_text())
        self.db.executescript(SQL)
        self.assertEqual(self.db.execute('SELECT count(*) FROM economic_accounts').fetchone()[0], 0)
        self.db.executemany('INSERT INTO economic_accounts VALUES(?,?,?,1)', [
            ('issuance', 'ISSUANCE_CONTROL', 'platform'), ('reserve', 'PLATFORM_RESERVE', 'platform'),
            ('club:IT-1', 'CLUB_TREASURY', 'IT-1')])
        self.db.execute("INSERT INTO economic_policy_versions VALUES('v',1,'test',100,200,?, '{}')",
                        (json.dumps({'IT-1': 20}),))
        self.db.execute("INSERT INTO economic_control VALUES(1,'v',1)")
        self.n = 0

    def tearDown(self):
        self.db.close()

    def post(self, purpose, lines, source='test', reversal=None):
        self.n += 1
        key = str(self.n)
        txid = key.zfill(36)
        self.db.execute('INSERT INTO economic_transactions(id,business_key,request_key,request_hash,purpose,actor_kind,actor_id,config_version,source_id,generation,season,day,occurred_at,reversal_of,lines_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                        (txid,key,key,'a'*64,purpose,'system','fixture','v',source,None,None,None,1,reversal,
                         json.dumps([dict(accountId=a,amountArc=v) for a,v in lines])))
        return txid

    def balance(self, account):
        return self.db.execute('SELECT balance_arc FROM economic_balances WHERE id=?',(account,)).fetchone()[0]

    def test_invariants(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.post('GENESIS_RESERVE',[('issuance',-100),('reserve',99)])
        original = self.post('GENESIS_RESERVE',[('issuance',-100),('reserve',100)])
        self.assertEqual(self.balance('reserve'),100)
        with self.assertRaises(sqlite3.IntegrityError):
            self.post('ISSUE_RESERVE',[('issuance',-101),('reserve',101)])
        with self.assertRaises(sqlite3.IntegrityError):
            self.post('CLUB_OPENING',[('reserve',-21),('club:IT-1',21)],'IT-1')
        self.post('CLUB_OPENING',[('reserve',-20),('club:IT-1',20)],'IT-1')
        with self.assertRaises(sqlite3.IntegrityError):
            self.post('CLUB_OPENING',[('reserve',-20),('club:IT-1',20)],'IT-1')
        with self.assertRaises(sqlite3.IntegrityError):
            self.post('PAYROLL_AI',[('club:IT-1',-21),('reserve',21)])
        self.assertEqual(self.balance('club:IT-1'),20)
        self.assertEqual(self.balance('reserve'),80)
        with self.assertRaises(sqlite3.IntegrityError):
            self.post('REVERSAL',[('reserve',-100),('issuance',100)],reversal=original)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('DELETE FROM economic_transactions WHERE id=?',(original,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('INSERT OR REPLACE INTO economic_accounts VALUES(?,?,?,1)',('reserve','PLATFORM_RESERVE','platform'))
        self.assertEqual(self.db.execute('SELECT SUM(balance_arc) FROM economic_balances').fetchone()[0],0)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
