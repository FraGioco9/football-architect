import sqlite3
import unittest
import json
from pathlib import Path

MIGRATION = Path(__file__).parents[1] / "migrations" / "0028_match_lineup_result_receipts.sql"

class MatchLineupReceiptsMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript("CREATE TABLE public_match_numbers (id INTEGER PRIMARY KEY);")
        self.db.execute("INSERT INTO public_match_numbers(id) VALUES (19)")
        self.db.executescript(MIGRATION.read_text())
        self.sql = ("INSERT INTO match_lineup_result_receipts("
                    "public_match_id,slot_match_id,generation,season_number,day,fixture_id,"
                    "algorithm_version,receipt_hash,receipt_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
        self.valid = [19, "m1_"+"a"*32, "1"*36, 1, 13,
                      "season:1:IT-1:N01:IT-1:IT-2", "temporary-lineup-v1",
                      "a"*64, json.dumps({"authority":"official","algorithmVersion":"temporary-lineup-v1"}), 123456]

    def tearDown(self):
        self.db.close()

    def test_immutable_unique_receipt(self):
        self.db.execute(self.sql, self.valid)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM match_lineup_result_receipts").fetchone()[0], 1)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(self.sql, self.valid)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE match_lineup_result_receipts SET created_at=123457 WHERE public_match_id=19")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM match_lineup_result_receipts WHERE public_match_id=19")

    def test_unpublished_id_and_nonofficial_receipt_rejected(self):
        for id_value,payload in [(20,self.valid[8]),(19,json.dumps({"authority":"candidate-only","algorithmVersion":"temporary-lineup-v1"}))]:
            values=list(self.valid)
            values[0]=id_value
            values[8]=payload
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(self.sql, values)

if __name__ == "__main__":
    unittest.main()
