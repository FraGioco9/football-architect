"""0021 preserves existing generated footballers while replacing their primary keys."""
from pathlib import Path
import json
import sqlite3
import unittest

MIGRATIONS=Path(__file__).resolve().parents[1] / "migrations"
WORLD_GENERATION="00000000-0000-4000-8000-000000000001"
DRAFT_ID="00000000-0000-4000-8000-000000000002"

def old_id(n):
    return f"00000000-0000-4000-8000-{n:012x}"

def prepared_db(size):
    db=sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript((MIGRATIONS/"0020_player_generation.sql").read_text())
    records=[]
    for index in range(size):
        # Identical creation timestamps deliberately exercise the deterministic tie-break.
        previous=old_id(size-index+2)
        payload={"id":previous,"first_name":f"First{index}","last_name":"Example",
                 "initial_age":18,"age":18,"development_aptitude":70}
        records.append((previous,100+(index//4),payload))
    candidates=json.dumps([p for _,_,p in records])
    db.execute("""INSERT INTO player_generation_drafts
      (id,world_generation,season_number,account_id,options_json,candidates_json,
       count,seed,status,created_at,expires_at,committed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
       (DRAFT_ID,WORLD_GENERATION,0,"test-actor","{}",candidates,
        max(size,1),"test-seed","committed",1,200,150))
    for previous,created,payload in records:
        db.execute("""INSERT INTO generated_players
          (id,batch_id,world_generation,entry_season,payload_json,created_at)
          VALUES (?,?,?,?,?,?)""",
          (previous,DRAFT_ID,WORLD_GENERATION,0,json.dumps(payload),created))
    db.commit()
    return db,records

class NumericPlayerIdsMigration(unittest.TestCase):
    def migrate(self,db):
        db.executescript((MIGRATIONS/"0021_player_numeric_ids.sql").read_text())

    def test_eleven_existing_players_preserve_all_fields_and_receive_ids_one_to_eleven(self):
        db,records=prepared_db(11)
        try:
            expected=[payload for _,_,payload in sorted(records,key=lambda r:(r[1],r[0]))]
            self.migrate(db)
            rows=db.execute("SELECT id,payload_json,batch_id FROM generated_players ORDER BY id").fetchall()
            self.assertEqual([row[0] for row in rows],list(range(1,12)))
            for i,(number,raw,batch) in enumerate(rows):
                player=json.loads(raw)
                self.assertEqual(player["id"],number)
                self.assertIsInstance(player["id"],int)
                self.assertEqual({k:v for k,v in player.items() if k!="id"},
                                 {k:v for k,v in expected[i].items() if k!="id"})
                self.assertEqual(batch,DRAFT_ID)
            drafts=json.loads(db.execute("SELECT candidates_json FROM player_generation_drafts").fetchone()[0])
            self.assertEqual(len(drafts),11)
            self.assertTrue(all("id" not in entry for entry in drafts))
            self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(),[])
            self.assertEqual(db.execute("SELECT seq FROM sqlite_sequence WHERE name='generated_players'").fetchone(),(11,))
            db.execute("""INSERT INTO generated_players
                (batch_id,world_generation,entry_season,payload_json,created_at)
                VALUES (?,?,?,?,?)""",(DRAFT_ID,WORLD_GENERATION,0,'{"first_name":"Next"}',120))
            self.assertEqual(db.execute("SELECT MAX(id) FROM generated_players").fetchone(),(12,))
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("""INSERT INTO generated_players
                   (id,batch_id,world_generation,entry_season,payload_json,created_at)
                   VALUES (?,?,?,?,?,?)""",
                   (old_id(20),DRAFT_ID,WORLD_GENERATION,0,'{}',121))
        finally:
            db.close()

    def test_fresh_database_starts_at_one_and_never_reuses_deleted_ids(self):
        db,_=prepared_db(0)
        try:
            self.migrate(db)
            for _ in range(2):
                db.execute("""INSERT INTO generated_players
                 (batch_id,world_generation,entry_season,payload_json,created_at)
                 VALUES (?,?,?,?,?)""",(DRAFT_ID,WORLD_GENERATION,0,'{}',100))
            self.assertEqual(db.execute("SELECT id FROM generated_players ORDER BY id").fetchall(),[(1,),(2,)])
            db.execute("DELETE FROM generated_players")
            db.execute("""INSERT INTO generated_players
             (batch_id,world_generation,entry_season,payload_json,created_at)
             VALUES (?,?,?,?,?)""",(DRAFT_ID,WORLD_GENERATION,0,'{}',100))
            self.assertEqual(db.execute("SELECT id FROM generated_players").fetchone(),(3,))
        finally:
            db.close()

if __name__=="__main__":
    unittest.main()
