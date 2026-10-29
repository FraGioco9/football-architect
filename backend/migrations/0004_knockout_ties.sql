-- Season-owned immutable outcome-derived knockout plans; local tests only.
CREATE TABLE IF NOT EXISTS season_knockout_ties (
 season_number INTEGER NOT NULL REFERENCES seasons(season_number) ON DELETE RESTRICT,
 generation TEXT NOT NULL CHECK(length(generation)=36),
 competition_id TEXT NOT NULL CHECK(length(competition_id) BETWEEN 1 AND 64),
 phase_id TEXT NOT NULL CHECK(length(phase_id) BETWEEN 1 AND 64),
 tie_id TEXT NOT NULL CHECK(length(tie_id) BETWEEN 1 AND 64),
 plan_hash TEXT NOT NULL CHECK(length(plan_hash)=64),
 plan_json TEXT NOT NULL CHECK(json_valid(plan_json) AND json_type(plan_json)='object'),
 created_at INTEGER NOT NULL CHECK(created_at>0),
 PRIMARY KEY(season_number,competition_id,phase_id,tie_id)
);
CREATE TRIGGER IF NOT EXISTS season_knockout_tie_immutable BEFORE UPDATE ON season_knockout_ties
BEGIN SELECT RAISE(ABORT,'canonical knockout tie is immutable'); END;
