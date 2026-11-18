-- V4.2-only portrait identity cutover; DESTRUCTIVE and irreversible by design.
-- NEVER apply remotely without explicit owner authorisation.
-- No historical portrait identities or compatibility tables are retained.
-- Old pending/approved portrait rows (including old asset_key references) are
-- deliberately discarded; generated_players records and WebP files are untouched.
-- Coordinate cutover with a full prevalidated V4.2 regeneration plan: the
-- portraits table is EMPTY after applying this migration and until V4.2 rows are inserted.
CREATE TABLE player_portrait_profiles_v42_next (
 player_id INTEGER PRIMARY KEY NOT NULL REFERENCES generated_players(id) ON DELETE CASCADE,
 schema_version TEXT NOT NULL CHECK(schema_version='player-portraits-v5'),
 prompt_version TEXT NOT NULL CHECK(prompt_version='player-portrait-v4.2'),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND json_type(snapshot_json)='object'),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 asset_key TEXT,
 created_at INTEGER NOT NULL CHECK(created_at>0),
 CHECK ((status='approved' AND asset_key IS NOT NULL) OR
        (status!='approved' AND asset_key IS NULL))
);
DROP TABLE player_portrait_profiles;
ALTER TABLE player_portrait_profiles_v42_next RENAME TO player_portrait_profiles;
-- Clean up legacy backup created by migration 0031; retain no archived identities.
DROP TABLE IF EXISTS player_portrait_v3_replacement_backup;
