import sqlite3
import unittest
import json
from pathlib import Path

MIGRATION=Path(__file__).parents[1]/"migrations"/"0029_lineup_day_outcomes.sql"
GEN="11111111-1111-4111-8111-111111111111"
HASH="a"*64

class LineupDayOutcomesMigrationTest(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript("CREATE TABLE seasons(season_number INTEGER PRIMARY KEY); INSERT INTO seasons VALUES(1);")
        self.db.executescript(MIGRATION.read_text())
        self.payload={"schemaVersion":2,"simulationVersion":"temporary-lineup-v1",
                      "generation":GEN,"season":1,"day":1,"calendarHash":HASH,"results":[]}
        self.sql=("INSERT INTO season_lineup_day_outcomes("
          "season_number,generation,day,calendar_hash,simulation_version,"
          "outcome_hash,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?)")
        self.values=[1,GEN,1,HASH,"temporary-lineup-v1",HASH,json.dumps(self.payload),12345]

    def tearDown(self): self.db.close()

    def test_new_day_immutable_and_unique(self):
        self.db.execute(self.sql,self.values)
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute(self.sql,self.values)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE season_lineup_day_outcomes SET created_at=2")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM season_lineup_day_outcomes")

    def test_reject_old_version_wrong_generation_day_and_source(self):
        for key,value in [("simulation_version","temporary-score-v1"),
                          ("generation","2"*36),("day",2),("calendar_hash","b"*64),
                          ("schemaVersion",1),("season",2)]:
            vals=list(self.values)
            body=dict(self.payload)
            if key in ("simulation_version","generation","day","calendar_hash"):
                pos={"simulation_version":4,"generation":1,"day":2,"calendar_hash":3}[key]
                vals[pos]=value
                if key=="simulation_version":body["simulationVersion"]=value
            else:
                body[key]=value
            vals[6]=json.dumps(body)
            with self.subTest(key=key), self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(self.sql,vals)

    def test_empty_day_is_accepted_without_phantom_fixtures(self):
        self.db.execute(self.sql,self.values)
        row=self.db.execute("SELECT outcome_json FROM season_lineup_day_outcomes").fetchone()
        self.assertEqual(json.loads(row[0])["results"],[])

if __name__=="__main__":
    unittest.main()
