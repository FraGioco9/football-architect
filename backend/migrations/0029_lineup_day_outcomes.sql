-- #613 single replacement result authority. New table is append-only.
-- Existing score-only tables are not read by this contract; no auto-migration of results.
-- This migration MUST NOT run on remote D1 until separate cutover authorization.
CREATE TABLE IF NOT EXISTS season_lineup_day_outcomes (
 season_number INTEGER NOT NULL REFERENCES seasons(season_number) ON DELETE RESTRICT,
 generation TEXT NOT NULL CHECK(length(generation)=36),
 day INTEGER NOT NULL CHECK(day BETWEEN 1 AND 56),
 calendar_hash TEXT NOT NULL CHECK(length(calendar_hash)=64 AND calendar_hash NOT GLOB '*[^0-9a-f]*'),
 simulation_version TEXT NOT NULL CHECK(simulation_version='temporary-lineup-v1'),
 outcome_hash TEXT NOT NULL CHECK(length(outcome_hash)=64 AND outcome_hash NOT GLOB '*[^0-9a-f]*'),
 outcome_json TEXT NOT NULL CHECK(
  json_valid(outcome_json) AND json_type(outcome_json)='object' AND
  json_extract(outcome_json,'$.schemaVersion')=2 AND
  json_extract(outcome_json,'$.simulationVersion')='temporary-lineup-v1' AND
  json_extract(outcome_json,'$.season')=season_number AND
  json_extract(outcome_json,'$.generation')=generation AND
  json_extract(outcome_json,'$.day')=day AND
  json_extract(outcome_json,'$.calendarHash')=calendar_hash
 ),
 created_at INTEGER NOT NULL CHECK(created_at>0),
 PRIMARY KEY(season_number,day),
 UNIQUE(generation,season_number,day)
);
CREATE TRIGGER IF NOT EXISTS season_lineup_day_outcomes_no_update
 BEFORE UPDATE ON season_lineup_day_outcomes
 BEGIN SELECT RAISE(ABORT,'finalized lineup day is immutable'); END;
CREATE TRIGGER IF NOT EXISTS season_lineup_day_outcomes_no_delete
 BEFORE DELETE ON season_lineup_day_outcomes
 BEGIN SELECT RAISE(ABORT,'finalized lineup day cannot be deleted'); END;
