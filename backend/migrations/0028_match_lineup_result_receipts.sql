-- #613: local-only additive proposal, NOT deployed, not called by official day processing.
-- A future authorized finalization batch must guard player affiliations and match identity.
-- Public numeric match IDs survive world reset; these immutable receipts survive too.
CREATE TABLE IF NOT EXISTS match_lineup_result_receipts (
 public_match_id INTEGER PRIMARY KEY REFERENCES public_match_numbers(id) ON DELETE RESTRICT,
 slot_match_id TEXT NOT NULL CHECK(length(slot_match_id)=35),
 generation TEXT NOT NULL CHECK(length(generation)=36),
 season_number INTEGER NOT NULL CHECK(season_number>0),
 day INTEGER NOT NULL CHECK(day BETWEEN 1 AND 56),
 fixture_id TEXT NOT NULL CHECK(length(fixture_id) BETWEEN 12 AND 256),
 algorithm_version TEXT NOT NULL CHECK(algorithm_version='temporary-lineup-v1'),
 receipt_hash TEXT NOT NULL CHECK(length(receipt_hash)=64 AND receipt_hash NOT GLOB '*[^0-9a-f]*'),
 receipt_json TEXT NOT NULL CHECK(json_valid(receipt_json) AND json_type(receipt_json)='object' AND
  json_extract(receipt_json,'$.authority')='official' AND
  json_extract(receipt_json,'$.algorithmVersion')=algorithm_version),
 created_at INTEGER NOT NULL CHECK(created_at>0),
 UNIQUE(generation,season_number,fixture_id)
);
CREATE INDEX IF NOT EXISTS match_lineup_receipts_by_season
 ON match_lineup_result_receipts(generation,season_number,day,public_match_id);
CREATE TRIGGER IF NOT EXISTS match_lineup_receipts_no_update
 BEFORE UPDATE ON match_lineup_result_receipts
 BEGIN SELECT RAISE(ABORT,'finalized match receipt is immutable'); END;
CREATE TRIGGER IF NOT EXISTS match_lineup_receipts_no_delete
 BEFORE DELETE ON match_lineup_result_receipts
 BEGIN SELECT RAISE(ABORT,'finalized match receipt cannot be deleted'); END;
