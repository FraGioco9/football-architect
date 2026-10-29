-- Staged domestic fixture evidence before international draw and final calendar publication.
CREATE TABLE IF NOT EXISTS season_domestic_stages (
 season_number INTEGER PRIMARY KEY REFERENCES seasons(season_number) ON DELETE RESTRICT,
 generation TEXT NOT NULL CHECK(length(generation)=36),
 algorithm_version TEXT NOT NULL CHECK(length(algorithm_version) BETWEEN 1 AND 128),
 seed TEXT NOT NULL CHECK(length(seed) BETWEEN 16 AND 256),
 participants_hash TEXT NOT NULL CHECK(length(participants_hash)=64),
 rules_hash TEXT NOT NULL CHECK(length(rules_hash)=64),
 fixtures_hash TEXT NOT NULL CHECK(length(fixtures_hash)=64),
 fixtures_json TEXT NOT NULL CHECK(json_valid(fixtures_json) AND json_type(fixtures_json)='array'),
 created_at INTEGER NOT NULL CHECK(created_at>0)
);
CREATE TRIGGER IF NOT EXISTS season_domestic_stage_immutable BEFORE UPDATE ON season_domestic_stages
BEGIN SELECT RAISE(ABORT,'domestic stage is immutable'); END;
