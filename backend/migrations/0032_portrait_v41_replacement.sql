-- #646 / PR #648 — opt-in schema compatibility for V4.1 replacements.
-- This changes NO existing portrait row, status, asset path or profile.
-- Never apply to DEV/Preview/Production without separate owner authorisation.
-- SQLite/D1 migrations runner must execute this entire migration atomically.
CREATE TABLE player_portrait_profiles_v41_next (
 player_id INTEGER PRIMARY KEY NOT NULL REFERENCES generated_players(id) ON DELETE CASCADE,
 schema_version TEXT NOT NULL CHECK(schema_version IN ('player-portraits-v2','player-portraits-v4')),
 prompt_version TEXT NOT NULL CHECK(prompt_version IN ('player-portrait-v3','player-portrait-v4.1')),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND json_type(snapshot_json)='object'),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 asset_key TEXT,
 created_at INTEGER NOT NULL CHECK(created_at>0),
 CHECK ((schema_version='player-portraits-v2' AND prompt_version='player-portrait-v3')
     OR (schema_version='player-portraits-v4' AND prompt_version='player-portrait-v4.1')),
 CHECK ((status='approved' AND asset_key IS NOT NULL) OR
        (status!='approved' AND asset_key IS NULL))
);
INSERT INTO player_portrait_profiles_v41_next(
 player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
SELECT player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at
FROM player_portrait_profiles;
DROP TABLE player_portrait_profiles;
ALTER TABLE player_portrait_profiles_v41_next RENAME TO player_portrait_profiles;

-- Preserve the exact previous per-ID state for separately authorised rollback.
-- The backup table is empty until the explicit, guarded cutover.
CREATE TABLE IF NOT EXISTS player_portrait_v3_replacement_backup (
 player_id INTEGER PRIMARY KEY NOT NULL REFERENCES generated_players(id) ON DELETE CASCADE,
 schema_version TEXT NOT NULL CHECK(schema_version='player-portraits-v2'),
 prompt_version TEXT NOT NULL CHECK(prompt_version='player-portrait-v3'),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND json_type(snapshot_json)='object'),
 status TEXT NOT NULL CHECK(status='approved'),
 asset_key TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 backed_up_at INTEGER NOT NULL DEFAULT (unixepoch())
);
