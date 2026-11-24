"""Phase A contract schema checks using disposable SQLite (no remote DB)."""
import sqlite3
import unittest
from pathlib import Path

SQL = (Path(__file__).resolve().parents[1] / 'migrations' / '0040_player_signed_contracts.sql').read_text()
GEN = '00000000-0000-4000-8000-000000000001'

class SignedContractsMigrationTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        # Minimal parent schema mirrors the fields referenced by 0040; full D1 chain tested separately.
        self.db.executescript("""
        CREATE TABLE generated_players(id INTEGER PRIMARY KEY);
        CREATE TABLE player_accounts(id TEXT PRIMARY KEY);
        CREATE TABLE world_state(id INTEGER PRIMARY KEY, generation TEXT NOT NULL);
        CREATE TABLE player_club_affiliations(player_id INTEGER PRIMARY KEY REFERENCES generated_players(id),club_key TEXT NOT NULL);
        """)
        self.db.execute('INSERT INTO world_state VALUES(1,?)',(GEN,))
        self.db.executemany('INSERT INTO generated_players VALUES(?)',[(1,),(2,)])
        self.db.execute("INSERT INTO player_accounts VALUES('agent')")
        self.db.executescript(SQL)
    def tearDown(self):
        self.db.close()
    def sign(self, player=1, wage=125, start=0, duration=1, mandate=None, key='sign1', generation=GEN):
        end=(start//56+duration)*56
        self.db.execute("""INSERT INTO player_signed_contracts
         (player_id,world_generation,club_key,signed_at_ms,start_tick,duration_seasons,
          scheduled_end_tick,annual_salary_arc,minimum_arc,reference_arc,maximum_arc,policy_version,signed_mandate_id,ai_demand_arc,signing_key)
          VALUES(?,?,'IT-1',1000,?,?,?, ?,40,100,200,'contract-draft-v1',?,?,?)""",
          (player,generation,start,duration,end,wage,mandate,125 if mandate is None else None,key))
    def mandate(self, player=1, start=0, key='acquire1'):
        return self.db.execute("""INSERT INTO player_agent_mandates
         (player_id,world_generation,account_id,start_tick,acquired_at_ms,acquisition_key)
         VALUES(?,?,'agent',?,1000,?)""",(player,GEN,start,key)).lastrowid
    def test_empty_and_ai_fixed_salary(self):
        for name in ['player_agent_mandates','player_signed_contracts']:
            self.assertEqual(self.db.execute('SELECT count(*) FROM '+name).fetchone()[0],0)
        for wage in [39,100,124,126,200,201]:
            with self.assertRaises(sqlite3.IntegrityError):
                self.sign(wage=wage)
        self.sign(start=28,duration=3)
        self.assertEqual(self.db.execute('SELECT scheduled_end_tick FROM player_signed_contracts').fetchone()[0],168)
        with self.assertRaises(sqlite3.IntegrityError):
            self.sign(key='duplicate')
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('UPDATE player_signed_contracts SET annual_salary_arc=150')
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('DELETE FROM player_signed_contracts')
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
    def test_mandate_and_intervals(self):
        m=self.mandate()
        with self.assertRaises(sqlite3.IntegrityError):
            self.mandate(key='duplicate')
        with self.assertRaises(sqlite3.IntegrityError):
            self.sign() # Human mandate cannot be bypassed as AI.
        with self.assertRaises(sqlite3.IntegrityError):
            self.sign(player=2,mandate=m)
        self.sign(wage=200,mandate=m)
        self.db.execute("UPDATE player_signed_contracts SET closed_tick=56,close_reason='expiry'")
        self.db.execute('UPDATE player_agent_mandates SET end_tick=56')
        with self.assertRaises(sqlite3.IntegrityError):
            self.mandate(start=55,key='overlap')
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT OR REPLACE INTO player_agent_mandates (id,player_id,world_generation,account_id,start_tick,acquired_at_ms,acquisition_key) VALUES(?,1,?,'agent',56,1000,'acquire1')",(m,GEN))
        new=self.mandate(start=56,key='acquire2')
        with self.assertRaises(sqlite3.IntegrityError):
            self.sign(start=55,mandate=new,key='early')
        self.sign(start=56,wage=40,mandate=new,key='sign2')
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('DELETE FROM generated_players WHERE id=1')
    def test_affiliation_and_reset_guard(self):
        self.sign()
        self.db.execute("INSERT INTO player_club_affiliations VALUES(1,'IT-1')")
        for statement in ["UPDATE player_club_affiliations SET club_key='IT-2'",
                          "DELETE FROM player_club_affiliations",
                          "UPDATE world_state SET generation='00000000-0000-4000-8000-000000000002'"]:
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(statement)
        with self.assertRaises(sqlite3.IntegrityError):
            self.sign(player=2,key='stale',generation='00000000-0000-4000-8000-000000000002')

if __name__ == '__main__':
    unittest.main()
