-- Temporary automatic match authority. Local test migration only; remote execution gated.
CREATE TABLE IF NOT EXISTS season_day_outcomes (
 season_number INTEGER NOT NULL REFERENCES seasons(season_number) ON DELETE RESTRICT,
 generation TEXT NOT NULL CHECK(length(generation)=36),
 day INTEGER NOT NULL CHECK(day BETWEEN 1 AND 56),
 calendar_hash TEXT NOT NULL CHECK(length(calendar_hash)=64),
 simulation_version TEXT NOT NULL CHECK(simulation_version='temporary-score-v1'),
 outcome_hash TEXT NOT NULL CHECK(length(outcome_hash)=64),
 outcome_json TEXT NOT NULL CHECK(json_valid(outcome_json) AND json_type(outcome_json)='object'),
 created_at INTEGER NOT NULL CHECK(created_at>0),
 PRIMARY KEY(season_number,day)
);
CREATE TRIGGER IF NOT EXISTS season_day_outcome_immutable BEFORE UPDATE ON season_day_outcomes
BEGIN SELECT RAISE(ABORT,'finalized daily sporting outcomes are immutable'); END;
