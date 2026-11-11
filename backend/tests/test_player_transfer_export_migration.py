"""Offline transfer preparation never opens a remote DB or copies auth/session tables."""
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
import sys

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/"tools"))
from prepare_player_transfer import load_local_bundle, write_bundle


class PlayerTransferExport(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.folder=Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def source(self, count=11, legacy=False, wrong_batch=False):
        db=sqlite3.connect(":memory:")
        db.executescript("""
            CREATE TABLE world_state (id INTEGER PRIMARY KEY, generation TEXT, season_number INTEGER);
            INSERT INTO world_state VALUES (1,'world-1',0);
            CREATE TABLE player_accounts (id TEXT PRIMARY KEY,password_verifier TEXT);
            INSERT INTO player_accounts VALUES ('secret-actor','never-export-this-verifier');
            CREATE TABLE player_generation_drafts
             (id TEXT PRIMARY KEY,world_generation TEXT,season_number INTEGER,account_id TEXT,
              options_json TEXT,candidates_json TEXT,count INTEGER,seed TEXT,status TEXT,
              created_at INTEGER,expires_at INTEGER,committed_at INTEGER);
        """)
        kind="TEXT" if legacy else "INTEGER"
        db.execute(f"""CREATE TABLE generated_players (
          id {kind} PRIMARY KEY,batch_id TEXT,world_generation TEXT,entry_season INTEGER,
          payload_json TEXT,created_at INTEGER)""")
        candidates=[]
        for i in range(count):
            ident=f"uuid-{i+1}" if legacy else i+1
            payload={"id":ident,"first_name":f"Player{i+1}","last_name":"Example",
                     "age":18,"development_aptitude":70}
            candidates.append({k:v for k,v in payload.items() if k!="id"})
            db.execute("INSERT INTO generated_players VALUES(?,?,?,?,?,?)",
              (ident,'batch-1','world-1',0,json.dumps(payload),100+i))
        db.execute("INSERT INTO player_generation_drafts VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
          ('batch-1','world-1',0,'secret-actor','{}',json.dumps(candidates),
           count+(1 if wrong_batch else 0),'test-seed','committed',50,200,150))
        db.commit()
        dump=self.folder/"backup.sql"
        dump.write_text("\n".join(db.iterdump())+"\n",encoding="utf-8")
        db.close()
        return dump

    def test_eleven_numeric_players_preserve_identity_and_metadata(self):
        bundle=load_local_bundle(self.source(),11)
        self.assertEqual(bundle["player_count"],11)
        self.assertEqual(bundle["batch_count"],1)
        self.assertEqual([p["id"] for p in bundle["players"]],list(range(1,12)))
        self.assertEqual(bundle["players"][0]["payload"]["id"],1)
        self.assertEqual(bundle["batches"][0]["account_id"],'secret-actor')
        self.assertEqual(bundle["remote_import_authorized"],False)
        text=json.dumps(bundle)
        self.assertNotIn("never-export-this-verifier",text)
        self.assertNotIn("player_accounts",text)
        file=self.folder/"bundle.json"
        write_bundle(bundle,file)
        self.assertEqual(json.loads(file.read_text()),bundle)
        with self.assertRaises(FileExistsError):write_bundle(bundle,file)

    def test_refuses_legacy_identifiers_count_mismatch_and_bad_batch_receipt(self):
        with self.assertRaisesRegex(ValueError,"INTEGER PRIMARY KEY"):
            load_local_bundle(self.source(legacy=True),11)
        with self.assertRaisesRegex(ValueError,"count mismatch"):
            load_local_bundle(self.source(count=10),11)
        with self.assertRaisesRegex(ValueError,"differs from the committed"):
            load_local_bundle(self.source(wrong_batch=True),11)


if __name__=="__main__":
    unittest.main()
