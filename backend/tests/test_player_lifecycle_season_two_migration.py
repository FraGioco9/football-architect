"""Isolated SQLite checks against the real signed-term and payroll migrations."""
import json
import sqlite3
import unittest
from pathlib import Path

M = Path(__file__).resolve().parents[1] / 'migrations'
GEN = '00000000-0000-4000-8000-000000000001'

class PlayerLifecycleSeasonTwoTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript("""
        CREATE TABLE world_state(id INTEGER PRIMARY KEY,generation TEXT,season_number INTEGER,day INTEGER,revision INTEGER,phase TEXT);
        CREATE TABLE generated_players(id INTEGER PRIMARY KEY,entry_season INTEGER,payload_json TEXT);
        CREATE TABLE player_accounts(id TEXT PRIMARY KEY);
        CREATE TABLE player_club_affiliations(player_id INTEGER,club_key TEXT);
        CREATE TABLE seasons(season_number INTEGER PRIMARY KEY,generation TEXT,snapshot_json TEXT);
        CREATE TABLE economic_policy_versions(version TEXT PRIMARY KEY);
        CREATE TABLE economic_accounts(id TEXT PRIMARY KEY);
        CREATE TABLE economic_transactions(id TEXT PRIMARY KEY,source_id TEXT,generation TEXT,season INTEGER,day INTEGER,config_version TEXT,actor_kind TEXT,actor_id TEXT,purpose TEXT,reversal_of TEXT);
        CREATE TABLE economic_entries(transaction_id TEXT REFERENCES economic_transactions(id),account_id TEXT,amount_arc INTEGER);
        INSERT INTO player_accounts VALUES('agent');
        INSERT INTO economic_policy_versions VALUES('v');
        INSERT INTO economic_accounts VALUES('reserve'),('user:agent'),('club:IT-1');
        """)
        self.db.execute("INSERT INTO world_state VALUES(1,?,1,56,1,'active')",(GEN,))
        for name in ('0037_player_market_values.sql','0040_player_signed_contracts.sql','0041_remove_legacy_player_affiliations.sql','0044_payroll_obligations.sql'):
            self.db.executescript((M / name).read_text())
        self.db.execute("INSERT INTO seasons VALUES(1,?,?)",(GEN,self.snapshot(['IT-2'],['IT-1','IT-3'])))
        self.player(1,22,40,'IT-1',2,25)
        self.player(2,39,40,'IT-1',3,25)
        self.player(3,25,40,'IT-1',1,25)
        self.player(4,23,40,'IT-3',2,25)
        self.player(5,24,40,'IT-1',2,50)
        self.db.execute("INSERT INTO player_agent_mandates(player_id,world_generation,account_id,start_tick,acquired_at_ms,acquisition_key) VALUES(2,?,'agent',28,1,'agent-2')",(GEN,))
        self.db.execute("INSERT INTO payroll_runs VALUES('old',?,1,56,'IT-1',1,'v',?)",(GEN,'a'*64))
        self.db.execute("INSERT INTO payroll_claims VALUES('old-claim','old',1,NULL,'reserve',28,56,25,13)")
        self.db.execute("UPDATE player_market_values SET config_version='v',market_value_arc=100")
        self.db.executescript((M / '0046_player_lifecycle_season_two.sql').read_text())
        self.db.commit()
    def tearDown(self):
        self.db.close()
    def snapshot(self,d1,d2):
        return json.dumps({'bindings':[{'competitionId':'IT-1','clubIds':d1},{'competitionId':'IT-2','clubIds':d2},{'competitionId':'int-1','clubIds':['IT-3']}]})
    def player(self,i,age,retirement,club,term,salary):
        data={'id':i,'age':age,'retirement_age':retirement,'career_status':'active','attributes':{'pace':73},'first_name':'Fixture'}
        self.db.execute("INSERT INTO generated_players VALUES(?,0,?)",(i,json.dumps(data)))
        ref=salary*4//5
        self.db.execute("""INSERT INTO player_signed_contracts
        (player_id,world_generation,club_key,signed_at_ms,start_tick,duration_seasons,scheduled_end_tick,annual_salary_arc,minimum_arc,reference_arc,maximum_arc,policy_version,ai_demand_arc,signing_key)
        VALUES(?,?,?,1,0,?,?,?,?,?,?,'contract-draft-v1',?,?)""",(i,GEN,club,term,term*56,salary,20,ref,ref*2,salary,'sign-'+str(i)))
    def transition(self):
        self.db.execute("UPDATE world_state SET phase='closed'")
        self.db.execute("INSERT INTO seasons VALUES(2,?,?)",(GEN,self.snapshot(['IT-1'],['IT-2','IT-3'])))
        self.db.execute("UPDATE world_state SET season_number=2,day=0,phase='preparing',revision=revision+1")
    def payload(self,i):
        return json.loads(self.db.execute("SELECT payload_json FROM generated_players WHERE id=?",(i,)).fetchone()[0])
    def test_transition_and_replay(self):
        prior=[self.payload(i) for i in range(1,6)]
        self.transition()
        for i,p in enumerate(prior,1):
            expected={**p,'age':p['age']+1,'career_status':'retired' if i==2 else 'active'}
            self.assertEqual(self.payload(i),expected)
        self.assertEqual(self.db.execute("SELECT player_id,closed_tick,close_reason,annual_salary_arc FROM player_signed_contracts ORDER BY player_id").fetchall(),
          [(1,None,None,25),(2,56,'retirement',25),(3,56,'expiry',25),(4,None,None,25),(5,None,None,50)])
        self.assertEqual(self.db.execute("SELECT end_tick FROM player_agent_mandates").fetchone()[0],56)
        self.assertEqual(self.db.execute("SELECT contract_id,annual_salary_arc FROM player_contract_promotion_salary").fetchall(),[(1,40)])
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM player_market_values WHERE input_revision=1 AND config_version IS NULL AND market_value_arc IS NULL").fetchone()[0],5)
        self.db.execute("UPDATE world_state SET season_number=2")
        self.assertEqual(self.payload(1)['age'],23)
        self.assertEqual(self.db.execute("SELECT annual_salary_arc,due_arc,outstanding_arc FROM payroll_claim_outstanding WHERE id='old-claim'").fetchone(),(25,13,13))
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(),[])
    def test_rollback_and_invalid_private_age(self):
        with self.assertRaises(RuntimeError):
            with self.db:
                self.transition()
                raise RuntimeError('rollback')
        self.assertEqual(self.payload(2)['age'],39)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM player_signed_contracts WHERE closed_tick IS NOT NULL").fetchone()[0],0)
        self.db.execute("UPDATE generated_players SET payload_json=json_remove(payload_json,'$.retirement_age') WHERE id=1")
        self.db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db:
                self.transition()
        self.assertEqual(self.payload(2)['age'],39)
        self.assertEqual(self.db.execute("SELECT season_number FROM world_state").fetchone()[0],1)
    def test_prospective_rate_and_seal(self):
        # Complete the first-season run with all canonical claims and arrears.
        self.db.execute("INSERT INTO payroll_claims VALUES('old-2','old',2,1,'user:agent',28,56,25,13)")
        self.db.execute("INSERT INTO payroll_claims VALUES('old-3','old',3,NULL,'reserve',28,56,25,13)")
        self.db.execute("INSERT INTO payroll_claims VALUES('old-5','old',5,NULL,'reserve',28,56,50,25)")
        for i,c in enumerate(['old-claim','old-2','old-3','old-5']):
            self.db.execute("INSERT INTO payroll_allocations VALUES(?,'old',?,0)",('old-a'+str(i),c))
        self.db.execute("INSERT INTO payroll_run_milestones VALUES('old','sealed',?)",('b'*64,))
        self.db.execute("INSERT INTO payroll_run_milestones VALUES('old','completed',?)",('c'*64,))
        self.transition()
        self.db.execute("UPDATE world_state SET day=28,phase='active'")
        self.db.execute("INSERT INTO payroll_runs VALUES('new',?,2,28,'IT-1',2,'v',?)",(GEN,'d'*64))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO payroll_claims VALUES('bad','new',1,NULL,'reserve',56,84,25,12)")
        self.db.execute("INSERT INTO payroll_claims VALUES('new-1','new',1,NULL,'reserve',56,84,40,20)")
        self.db.execute("INSERT INTO payroll_claims VALUES('new-5','new',5,NULL,'reserve',56,84,50,25)")
        for i,c in enumerate(['old-claim','old-2','old-3','old-5','new-1','new-5']):
            self.db.execute("INSERT INTO payroll_allocations VALUES(?,'new',?,0)",('new-a'+str(i),c))
        self.db.execute("INSERT INTO payroll_run_milestones VALUES('new','sealed',?)",('e'*64,))
        self.assertEqual(self.db.execute("SELECT annual_salary_arc,due_arc,outstanding_arc FROM payroll_claim_outstanding WHERE id='old-claim'").fetchone(),(25,13,13))
        self.assertEqual(self.db.execute("SELECT annual_salary_arc,due_arc FROM payroll_claims WHERE id='new-1'").fetchone(),(40,20))

if __name__ == '__main__':
    unittest.main()
