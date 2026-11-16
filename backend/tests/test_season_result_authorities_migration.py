import sqlite3
import unittest
from pathlib import Path

M = Path(__file__).parents[1]/"migrations"/"0029_season_result_authorities.sql"
GEN = "11111111-1111-4111-8111-111111111111"

class SeasonResultAuthorityMigrationTest(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(":memory:")
        self.db.executescript("""
          CREATE TABLE world_state (id INTEGER PRIMARY KEY, generation TEXT, season_number INTEGER, phase TEXT, day INTEGER);
          CREATE TABLE seasons (generation TEXT, season_number INTEGER);
          CREATE TABLE season_day_outcomes (season_number INTEGER);
          CREATE TABLE match_lineup_result_receipts (generation TEXT, season_number INTEGER);
          INSERT INTO world_state VALUES (1, '11111111-1111-4111-8111-111111111111', 1, 'preparing', 0);
          INSERT INTO seasons VALUES ('11111111-1111-4111-8111-111111111111', 1);
        """)
        self.db.executescript(M.read_text())
        self.insert="INSERT INTO season_result_authorities VALUES(?,?,?,?)"
        self.record=(GEN,1,"temporary-lineup-v1",1234)

    def tearDown(self):
        self.db.close()

    def test_only_pristine_preparing_seasons_can_be_pinned(self):
        self.db.execute(self.insert,self.record)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(self.insert,self.record)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE season_result_authorities SET pinned_at=1")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM season_result_authorities")

    def test_preexisting_results_and_active_world_are_blocked(self):
        self.db.execute("INSERT INTO season_day_outcomes VALUES(1)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(self.insert,self.record)
        self.db.execute("DELETE FROM season_day_outcomes")
        self.db.execute("UPDATE world_state SET phase='active',day=12 WHERE id=1")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(self.insert,self.record)

    def test_generation_isolation_and_reset_retains_history(self):
        self.db.execute(self.insert,self.record)
        self.db.execute("UPDATE world_state SET generation=?,phase='preparing',day=0",("22222222-2222-4222-8222-222222222222",))
        self.db.execute("INSERT INTO seasons VALUES (?,?)",("22222222-2222-4222-8222-222222222222",1))
        self.db.execute(self.insert,("22222222-2222-4222-8222-222222222222",1,"temporary-lineup-v1",1235))
        self.assertEqual(self.db.execute("SELECT count(*) FROM season_result_authorities").fetchone()[0],2)

if __name__=="__main__":
    unittest.main()
