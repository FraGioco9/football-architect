"""#509 V1 migration: one current affiliation per persisted footballer, no backfill."""
from pathlib import Path
import json
import sqlite3
import unittest

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"
GENERATION = "00000000-0000-4000-8000-000000000001"
DRAFT = "00000000-0000-4000-8000-000000000002"


def prepared_db():
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript((MIGRATIONS / "0020_player_generation.sql").read_text())
    db.executescript((MIGRATIONS / "0021_player_numeric_ids.sql").read_text())
    db.execute("""INSERT INTO player_generation_drafts
      (id,world_generation,season_number,account_id,options_json,candidates_json,
       count,seed,status,created_at,expires_at,committed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
      (DRAFT,GENERATION,0,"local-test-operator","{}","[]",3,"test-seed","committed",10,100,20))
    for player_id in (1,2,3):
        db.execute("""INSERT INTO generated_players
          (id,batch_id,world_generation,entry_season,payload_json,created_at)
          VALUES (?,?,?,?,?,?)""",
          (player_id,DRAFT,GENERATION,0,json.dumps({"id":player_id,"first_name":"Test",
             "development_aptitude":70}),30))
    db.commit()
    return db


class PlayerClubAffiliationMigration(unittest.TestCase):
    def setUp(self):
        self.db = prepared_db()
        self.before = self.db.execute("SELECT * FROM generated_players ORDER BY id").fetchall()
        self.db.executescript((MIGRATIONS / "0022_player_club_affiliations.sql").read_text())

    def tearDown(self):
        self.db.close()

    def test_new_table_is_empty_and_does_not_mutate_existing_player_payloads(self):
        self.assertEqual(self.db.execute("SELECT * FROM player_club_affiliations").fetchall(), [])
        self.assertEqual(self.db.execute("SELECT * FROM generated_players ORDER BY id").fetchall(), self.before)
        columns = self.db.execute("PRAGMA table_info(player_club_affiliations)").fetchall()
        self.assertEqual([column[1] for column in columns], ["player_id", "club_key"])
        self.assertEqual([column[1] for column in columns if column[5] > 0], ["player_id"])
        keys = self.db.execute("PRAGMA foreign_key_list(player_club_affiliations)").fetchall()
        self.assertEqual(len(keys), 1)
        self.assertEqual((keys[0][2], keys[0][3], keys[0][4], keys[0][6]),
                         ("generated_players", "player_id", "id", "CASCADE"))
        indexes = self.db.execute("PRAGMA index_list(player_club_affiliations)").fetchall()
        self.assertIn("player_club_affiliations_club_player", [row[1] for row in indexes])
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_assignment_reassignment_and_unassignment_are_current_state_only(self):
        self.db.execute("INSERT INTO player_club_affiliations VALUES (?,?)", (1,"IT-1"))
        self.db.execute("INSERT INTO player_club_affiliations VALUES (?,?)", (2,"IT-1"))
        self.assertEqual(self.db.execute("""SELECT player_id FROM player_club_affiliations
          WHERE club_key=? ORDER BY player_id""", ("IT-1",)).fetchall(), [(1,), (2,)])
        self.db.execute("UPDATE player_club_affiliations SET club_key=? WHERE player_id=?",
                        ("ENG-4", 1))
        self.assertEqual(self.db.execute("SELECT club_key FROM player_club_affiliations WHERE player_id=1").fetchone(),
                         ("ENG-4",))
        self.db.execute("DELETE FROM player_club_affiliations WHERE player_id=1")
        self.assertIsNone(self.db.execute("SELECT 1 FROM player_club_affiliations WHERE player_id=1").fetchone())
        self.assertEqual(len(self.db.execute("PRAGMA table_info(player_club_affiliations)").fetchall()), 2)
        self.assertEqual(self.db.execute("SELECT * FROM generated_players ORDER BY id").fetchall(), self.before)

    def test_strict_player_fk_single_club_and_explicit_nonempty_keys(self):
        self.db.execute("INSERT INTO player_club_affiliations VALUES (?,?)", (1,"IT-1"))
        for sql,args in [
            ("INSERT INTO player_club_affiliations VALUES (?,?)",(1,"DE-2")),
            ("INSERT INTO player_club_affiliations VALUES (?,?)",(0,"IT-1")),
            ("INSERT INTO player_club_affiliations VALUES (?,?)",(-1,"IT-1")),
            ("INSERT INTO player_club_affiliations VALUES (?,?)",(99,"IT-1")),
            ("INSERT INTO player_club_affiliations VALUES (?,?)",(2,"   ")),
            ("INSERT INTO player_club_affiliations (club_key) VALUES (?)",("IT-1",))
        ]:
            with self.subTest(sql=sql,args=args):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute(sql,args)
        self.assertEqual(self.db.execute("SELECT * FROM player_club_affiliations").fetchall(), [(1,"IT-1")])
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_explicit_player_deletion_cascades_but_unrelated_players_survive(self):
        self.db.executemany("INSERT INTO player_club_affiliations VALUES (?,?)",
                            [(1,"IT-1"),(2,"IT-1"),(3,"BR-40")])
        self.db.execute("DELETE FROM generated_players WHERE id=1")
        self.assertEqual(self.db.execute(
            "SELECT player_id,club_key FROM player_club_affiliations ORDER BY player_id").fetchall(),
            [(2,"IT-1"),(3,"BR-40")])
        self.assertEqual(self.db.execute("SELECT id FROM generated_players ORDER BY id").fetchall(), [(2,),(3,)])
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(), [])


if __name__ == "__main__":
    unittest.main()
