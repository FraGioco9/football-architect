"""Isolated SQLite tests of payroll evidence guards. Parent columns are minimal
fixtures; actual sealed-ledger and full D1 integration are separate tests."""
import sqlite3
import unittest
from pathlib import Path

SQL = (Path(__file__).resolve().parents[1] / 'migrations' / '0044_payroll_obligations.sql').read_text()
GEN = '00000000-0000-4000-8000-000000000001'

class PayrollEvidenceTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript("""
        CREATE TABLE world_state(id INTEGER PRIMARY KEY,generation TEXT,season_number INTEGER,day INTEGER,revision INTEGER,phase TEXT);
        CREATE TABLE economic_policy_versions(version TEXT PRIMARY KEY);
        CREATE TABLE economic_accounts(id TEXT PRIMARY KEY);
        CREATE TABLE player_signed_contracts(id INTEGER PRIMARY KEY,player_id INTEGER,world_generation TEXT,club_key TEXT,start_tick INTEGER,scheduled_end_tick INTEGER,closed_tick INTEGER,annual_salary_arc INTEGER);
        CREATE TABLE player_agent_mandates(id INTEGER PRIMARY KEY,player_id INTEGER,world_generation TEXT,start_tick INTEGER,end_tick INTEGER,account_id TEXT);
        CREATE TABLE economic_transactions(id TEXT PRIMARY KEY,source_id TEXT,generation TEXT,season INTEGER,day INTEGER,config_version TEXT,actor_kind TEXT,actor_id TEXT,purpose TEXT,reversal_of TEXT);
        CREATE TABLE economic_entries(transaction_id TEXT REFERENCES economic_transactions(id),account_id TEXT,amount_arc INTEGER);
        INSERT INTO economic_policy_versions VALUES('v');
        INSERT INTO economic_accounts VALUES('reserve'),('user:agent'),('club:IT-1');
        """)
        self.db.execute("INSERT INTO world_state VALUES(1,?,1,28,1,'active')",(GEN,))
        self.db.execute("INSERT INTO player_signed_contracts VALUES(1,7,?,'IT-1',0,112,NULL,101)",(GEN,))
        self.db.execute("INSERT INTO player_agent_mandates VALUES(1,7,?,14,NULL,'agent')",(GEN,))
        self.db.executescript(SQL)
        self.run_row('r1',1,28,1)
    def tearDown(self):
        self.db.close()
    def run_row(self,key,season,day,revision):
        self.db.execute("INSERT INTO payroll_runs VALUES(?,?,?,?,'IT-1',?,'v',?)",(key,GEN,season,day,revision,'a'*64))
    def claim(self,key,start,end,due,mandate=None,recipient='reserve',run='r1'):
        self.db.execute("INSERT INTO payroll_claims VALUES(?,?,1,?,?,?,?,101,?)",(key,run,mandate,recipient,start,end,due))
    def allocation(self,key,claim,amount,run='r1'):
        self.db.execute("INSERT INTO payroll_allocations VALUES(?,?,?,?)",(key,run,claim,amount))
    def seal(self,run='r1'):
        self.db.execute("INSERT INTO payroll_run_milestones VALUES(?,'sealed',?)",(run,'b'*64))
    def finish(self,run='r1'):
        self.db.execute("INSERT INTO payroll_run_milestones VALUES(?,'completed',?)",(run,'c'*64))
    def post(self,tx,allocation,amount,recipient='reserve',purpose='PAYROLL_AI',season=1,day=28):
        self.db.execute("INSERT INTO economic_transactions VALUES(?,?,?,?,?,'v','system','payroll-settlement-v1',?,NULL)",(tx,allocation,GEN,season,day,purpose))
        self.db.executemany("INSERT INTO economic_entries VALUES(?,?,?)",[(tx,'club:IT-1',-amount),(tx,recipient,amount)])
    def receipt(self,tx,allocation):
        self.db.execute("INSERT INTO payroll_payment_receipts VALUES(?,?)",(tx,allocation))
    def prepare(self):
        self.claim('ai',0,14,25)
        self.claim('human',14,28,25,1,'user:agent')
        self.allocation('a1','ai',10)
        self.allocation('a2','human',15)
        self.seal()
    def test_omitted_contract_cannot_seal(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.seal()
        self.claim('ai',0,14,25)
        self.allocation('a1','ai',0)
        with self.assertRaises(sqlite3.IntegrityError):
            self.seal()
    def test_historical_claim_and_no_replacement(self):
        for args in [('wrong',0,14,26),('wrong',0,28,50),('wrong',14,28,25)]:
            with self.assertRaises(sqlite3.IntegrityError):
                self.claim(*args)
        self.prepare()
        for statement in ["DELETE FROM payroll_claims","UPDATE payroll_allocations SET planned_arc=0",
                          "INSERT OR REPLACE INTO payroll_run_milestones VALUES('r1','sealed','"+'d'*64+"')"]:
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(statement)
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(),[])
    def test_partial_receipts_and_next_payday(self):
        self.prepare()
        with self.assertRaises(sqlite3.IntegrityError):
            self.finish()
        self.post('t1','a1',10)
        self.receipt('t1','a1')
        self.post('t2','a2',15,'user:agent','PAYROLL_HUMAN')
        self.receipt('t2','a2')
        with self.assertRaises(sqlite3.IntegrityError):
            self.receipt('t2','a2')
        self.finish()
        self.assertEqual(self.db.execute("SELECT id,outstanding_arc FROM payroll_claim_outstanding ORDER BY id").fetchall(),[('ai',15),('human',10)])
        self.db.execute("UPDATE world_state SET day=56,revision=2")
        self.run_row('r2',1,56,2)
        self.claim('new',28,56,51,1,'user:agent','r2')
        self.allocation('a3','ai',15,'r2')
        with self.assertRaises(sqlite3.IntegrityError):
            self.seal('r2')
        self.allocation('a4','human',10,'r2')
        self.allocation('a5','new',0,'r2')
        self.seal('r2')
        self.post('t3','a3',15,day=56)
        self.receipt('t3','a3')
        self.post('t4','a4',10,'user:agent','PAYROLL_HUMAN',day=56)
        self.receipt('t4','a4')
        self.finish('r2')
        self.assertEqual(self.db.execute("SELECT SUM(outstanding_arc) FROM payroll_claim_outstanding").fetchone()[0],51)
    def test_wrong_recipient_stale_and_orphan(self):
        self.prepare()
        self.db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db:
                self.post('bad','a2',15)
                self.receipt('bad','a2')
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM economic_transactions WHERE id='bad'").fetchone()[0],0)
        self.db.execute("UPDATE world_state SET revision=2")
        self.db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db:
                self.post('stale','a1',10)
                self.receipt('stale','a1')
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM economic_transactions WHERE id='stale'").fetchone()[0],0)
    def test_orphan_and_reversal(self):
        self.prepare()
        self.post('t1','a1',10)
        self.receipt('t1','a1')
        self.post('t2','a2',15,'user:agent','PAYROLL_HUMAN')
        self.receipt('t2','a2')
        self.db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db:
                self.post('orphan','a2',1,'user:agent','PAYROLL_HUMAN')
                self.finish()
        self.db.execute("UPDATE world_state SET revision=2")
        with self.assertRaises(sqlite3.IntegrityError):
            self.finish()
        self.db.execute("UPDATE world_state SET revision=1")
        self.finish()
        self.db.execute("INSERT INTO economic_transactions VALUES('rev','reversal',?,1,28,'v','system','fixture','REVERSAL','t1')",(GEN,))
        self.assertEqual(self.db.execute("SELECT paid_arc,reversed FROM payroll_allocation_paid WHERE id='a1'").fetchone(),(0,1))
        self.db.execute("UPDATE world_state SET day=56,revision=2")
        with self.assertRaises(sqlite3.IntegrityError):
            self.run_row('r2',1,56,2)

if __name__ == '__main__':
    unittest.main()
