-- ADMIN-WORLD-01 PR2: durable, season-owned schedule and draw evidence.
-- Schema only. No generation or admin HTTP commands are enabled by this migration.
-- Never run against a remote D1 instance without separately approved provisioning.
CREATE TABLE IF NOT EXISTS season_calendars (
  season_number INTEGER NOT NULL REFERENCES seasons(season_number) ON DELETE RESTRICT,
  calendar_version TEXT NOT NULL CHECK (length(calendar_version) BETWEEN 1 AND 128),
  calendar_hash TEXT NOT NULL CHECK (length(calendar_hash) = 64),
  calendar_json TEXT NOT NULL CHECK (json_valid(calendar_json) AND json_type(calendar_json) = 'object'),
  status TEXT NOT NULL CHECK (status IN ('generated','validated')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  PRIMARY KEY (season_number)
);
CREATE TRIGGER IF NOT EXISTS season_calendar_immutable
BEFORE UPDATE OF season_number,calendar_version,calendar_hash,calendar_json,created_at ON season_calendars
BEGIN SELECT RAISE(ABORT,'canonical season calendar is immutable'); END;

CREATE TABLE IF NOT EXISTS season_draws (
  season_number INTEGER NOT NULL REFERENCES seasons(season_number) ON DELETE RESTRICT,
  competition_id TEXT NOT NULL CHECK (length(competition_id) BETWEEN 1 AND 64),
  stage_id TEXT NOT NULL CHECK (length(stage_id) BETWEEN 1 AND 64),
  algorithm_version TEXT NOT NULL CHECK (length(algorithm_version) BETWEEN 1 AND 128),
  seed TEXT NOT NULL CHECK (length(seed) BETWEEN 16 AND 256),
  outcome_hash TEXT NOT NULL CHECK (length(outcome_hash) = 64),
  outcome_json TEXT NOT NULL CHECK (json_valid(outcome_json) AND json_type(outcome_json) = 'object'),
  status TEXT NOT NULL CHECK (status IN ('generated','validated')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  PRIMARY KEY (season_number,competition_id,stage_id)
);
CREATE TRIGGER IF NOT EXISTS season_draw_immutable
BEFORE UPDATE OF season_number,competition_id,stage_id,algorithm_version,seed,outcome_hash,outcome_json,created_at ON season_draws
BEGIN SELECT RAISE(ABORT,'canonical season draw is immutable'); END;

-- No rows or user-controlled booleans are trusted by the lifecycle executor yet.
-- Validated status is only an input to future server-owned integrity checks.
