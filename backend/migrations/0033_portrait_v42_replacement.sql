-- V4.2 exclusive generation target — staged schema-only D1 migration.
-- Applying to any remote database requires separate owner authorisation.
-- Existing approved images/status/snapshots must remain unchanged on migration.
-- Keep V3/V4.1 pairs for recovery and until an independent guarded cutover.
CREATE TABLE player_portrait_profiles_v42_next (
 player_id INTEGER PRIMARY KEY NOT NULL REFERENCES generated_players(id) ON DELETE CASCADE,
 schema_version TEXT NOT NULL CHECK(schema_version IN ('player-portraits-v2','player-portraits-v4','player-portraits-v5')),
 prompt_version TEXT NOT NULL CHECK(prompt_version IN ('player-portrait-v3','player-portrait-v4.1','player-portrait-v4.2')),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND json_type(snapshot_json)='object'),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 asset_key TEXT,
 created_at INTEGER NOT NULL CHECK(created_at>0),
 CHECK ((schema_version='player-portraits-v2' AND prompt_version='player-portrait-v3')
     OR (schema_version='player-portraits-v4' AND prompt_version='player-portrait-v4.1')
     OR (schema_version='player-portraits-v5' AND prompt_version='player-portrait-v4.2')),
 CHECK ((status='approved' AND asset_key IS NOT NULL) OR
        (status!='approved' AND asset_key IS NULL))
);
INSERT INTO player_portrait_profiles_v42_next(
 player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
SELECT player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at
FROM player_portrait_profiles;
DROP TABLE player_portrait_profiles;
ALTER TABLE player_portrait_profiles_v42_next RENAME TO player_portrait_profiles;

-- Empty by default. Each pre-cutover row must be backed up explicitly and
-- independently verified before an authorised V4.2 snapshot replacement.
CREATE TABLE IF NOT EXISTS player_portrait_v42_replacement_backup (
 player_id INTEGER PRIMARY KEY NOT NULL REFERENCES generated_players(id) ON DELETE CASCADE,
 schema_version TEXT NOT NULL CHECK(schema_version IN ('player-portraits-v2','player-portraits-v4')),
 prompt_version TEXT NOT NULL CHECK(prompt_version IN ('player-portrait-v3','player-portrait-v4.1')),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND json_type(snapshot_json)='object'),
 status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
 asset_key TEXT,
 created_at INTEGER NOT NULL CHECK(created_at>0),
 backed_up_at INTEGER NOT NULL DEFAULT (unixepoch()),
 CHECK ((schema_version='player-portraits-v2' AND prompt_version='player-portrait-v3')
     OR (schema_version='player-portraits-v4' AND prompt_version='player-portrait-v4.1')),
 CHECK ((status='approved' AND asset_key IS NOT NULL) OR
        (status!='approved' AND asset_key IS NULL))
);
