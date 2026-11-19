-- V4.2-only identity cutover; OWNER-AUTHORISED remote D1 migration ONLY.
-- Generate and stage 100% V4.2 snapshots from frozen ORIGINAL player data
-- BEFORE running. No images, image approvals, WebP hashes or asset publication
-- are required for this *identity-only* phase.
-- The historic V3/V4.1 profiles and the V3 backup table are DESTROYED
-- upon successful cutover; no legacy compatibility/rollback is retained.
-- On a nonempty world, incomplete or stale staging fails BEFORE old rows drop.
-- An empty new world may initialise the exclusive V4.2 schema with zero rows.

CREATE TABLE IF NOT EXISTS player_portrait_v42_cutover_candidates (
 player_id INTEGER PRIMARY KEY NOT NULL REFERENCES generated_players(id) ON DELETE CASCADE,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND json_type(snapshot_json)='object'),
 CHECK(json_type(snapshot_json,'$.schema_version') IS 'text'
       AND json_extract(snapshot_json,'$.schema_version') IS 'player-portraits-v5'),
 CHECK(json_type(snapshot_json,'$.prompt_version') IS 'text'
       AND json_extract(snapshot_json,'$.prompt_version') IS 'player-portrait-v4.2'),
 CHECK(json_type(snapshot_json,'$.player_id') IS 'integer'
       AND json_extract(snapshot_json,'$.player_id') IS player_id),
 CHECK(json_type(snapshot_json,'$.appearance_fingerprint') IS 'text'
       AND length(json_extract(snapshot_json,'$.appearance_fingerprint'))=16
       AND json_extract(snapshot_json,'$.appearance_fingerprint') NOT GLOB '*[^0-9a-f]*')
);
CREATE UNIQUE INDEX IF NOT EXISTS player_portrait_v42_candidate_fingerprints
 ON player_portrait_v42_cutover_candidates(json_extract(snapshot_json,'$.appearance_fingerprint'));

CREATE TABLE IF NOT EXISTS player_portrait_v42_cutover_guard (
 ok INTEGER NOT NULL CHECK(ok=1)
);
DELETE FROM player_portrait_v42_cutover_guard;
INSERT INTO player_portrait_v42_cutover_guard(ok)
SELECT CASE WHEN (
 (SELECT COUNT(*) FROM generated_players)=0
 AND (SELECT COUNT(*) FROM player_portrait_profiles)=0
 AND (SELECT COUNT(*) FROM player_portrait_v42_cutover_candidates)=0
) OR (
 (SELECT COUNT(*) FROM generated_players)>0
 AND (SELECT COUNT(*) FROM player_portrait_profiles)=
     (SELECT COUNT(*) FROM generated_players)
 AND (SELECT COUNT(*) FROM player_portrait_v42_cutover_candidates)=
     (SELECT COUNT(*) FROM generated_players)
 AND NOT EXISTS (
   SELECT 1 FROM generated_players AS g
   LEFT JOIN player_portrait_v42_cutover_candidates AS c ON c.player_id=g.id
   WHERE c.player_id IS NULL
 )
) THEN 1 ELSE 0 END;

CREATE TABLE player_portrait_profiles_v42_next (
 player_id INTEGER PRIMARY KEY NOT NULL REFERENCES generated_players(id) ON DELETE CASCADE,
 schema_version TEXT NOT NULL CHECK(schema_version='player-portraits-v5'),
 prompt_version TEXT NOT NULL CHECK(prompt_version='player-portrait-v4.2'),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND json_type(snapshot_json)='object'),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 asset_key TEXT,
 created_at INTEGER NOT NULL CHECK(created_at>0),
 CHECK ((status='approved' AND asset_key IS NOT NULL) OR
        (status!='approved' AND asset_key IS NULL)),
 CHECK(json_type(snapshot_json,'$.schema_version') IS 'text'
       AND json_extract(snapshot_json,'$.schema_version') IS 'player-portraits-v5'),
 CHECK(json_type(snapshot_json,'$.prompt_version') IS 'text'
       AND json_extract(snapshot_json,'$.prompt_version') IS 'player-portrait-v4.2'),
 CHECK(json_type(snapshot_json,'$.player_id') IS 'integer'
       AND json_extract(snapshot_json,'$.player_id') IS player_id)
);
-- All replacement identities are inserted FIRST. None is approved or has
-- a public image until its independent, post-merge image QA and publication.
INSERT INTO player_portrait_profiles_v42_next(
 player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at
)
SELECT player_id,'player-portraits-v5','player-portrait-v4.2',
 snapshot_json,'pending',NULL,unixepoch()
FROM player_portrait_v42_cutover_candidates ORDER BY player_id;

DELETE FROM player_portrait_v42_cutover_guard;
INSERT INTO player_portrait_v42_cutover_guard(ok)
SELECT CASE WHEN
 (SELECT COUNT(*) FROM player_portrait_profiles_v42_next)=
 (SELECT COUNT(*) FROM generated_players)
 AND NOT EXISTS (
  SELECT 1 FROM generated_players AS g
  LEFT JOIN player_portrait_profiles_v42_next AS p ON p.player_id=g.id
  WHERE p.player_id IS NULL
 )
 AND NOT EXISTS (
  SELECT 1 FROM player_portrait_profiles_v42_next
  WHERE status!='pending' OR asset_key IS NOT NULL
 )
 THEN 1 ELSE 0 END;

DROP TABLE player_portrait_profiles;
ALTER TABLE player_portrait_profiles_v42_next RENAME TO player_portrait_profiles;
-- No old identity snapshot, backup, or staging table survives cutover.
DROP TABLE IF EXISTS player_portrait_v3_replacement_backup;
DROP TABLE player_portrait_v42_cutover_candidates;
DROP TABLE player_portrait_v42_cutover_guard;
