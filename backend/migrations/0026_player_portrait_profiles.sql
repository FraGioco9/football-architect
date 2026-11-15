-- PLAYER-PORTRAITS-04 (#629): private immutable appearance snapshots.
-- Apply to the selected local environment first. Never automatically backfill
-- unrelated production rows with the DEV pilot's numeric IDs.
CREATE TABLE IF NOT EXISTS player_portrait_profiles (
 player_id INTEGER PRIMARY KEY NOT NULL
  REFERENCES generated_players(id) ON DELETE CASCADE,
 schema_version TEXT NOT NULL CHECK(schema_version='player-portraits-v2'),
 prompt_version TEXT NOT NULL CHECK(prompt_version='player-portrait-v3'),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND json_type(snapshot_json)='object'),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 asset_key TEXT,
 created_at INTEGER NOT NULL CHECK(created_at>0),
 CHECK ((status='approved' AND asset_key IS NOT NULL) OR
        (status!='approved' AND asset_key IS NULL))
);
