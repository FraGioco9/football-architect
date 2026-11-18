-- V4.2-only portrait cutover. Destructive, irreversible, OWNER-AUTHORISED ONLY.
-- NO previous portrait identities/backups/legacy compatibility are retained.
-- Fail CLOSED if any permanent player lacks an approved V4.2 replacement.
-- Do not apply this migration before 150 owner-QA-approved NEW WebP assets
-- have been staged by the separately-authorised V4.2 stage import tool.
-- In a brand-new EMPTY world only, allow the initial V4.2 schema to install.
--
-- Stage schema is reusable after a failed preflight (NO old profile rows are
-- changed before both guards succeed). Never store old profile snapshots here.
CREATE TABLE IF NOT EXISTS player_portrait_v42_cutover_candidates (
 player_id INTEGER PRIMARY KEY NOT NULL REFERENCES generated_players(id) ON DELETE CASCADE,
 snapshot_json TEXT NOT NULL
  CHECK(json_valid(snapshot_json) AND json_type(snapshot_json)='object'),
 asset_key TEXT NOT NULL UNIQUE,
 image_sha256 TEXT NOT NULL UNIQUE CHECK(
   length(image_sha256)=64 AND
   image_sha256 NOT GLOB '*[^0-9a-f]*'
 ),
 CHECK(json_type(snapshot_json,'$.schema_version') IS 'text'
       AND json_extract(snapshot_json,'$.schema_version') IS 'player-portraits-v5'),
 CHECK(json_type(snapshot_json,'$.prompt_version') IS 'text'
       AND json_extract(snapshot_json,'$.prompt_version') IS 'player-portrait-v4.2'),
 CHECK(json_type(snapshot_json,'$.player_id') IS 'integer'
       AND json_extract(snapshot_json,'$.player_id') IS player_id),
 CHECK(asset_key IS ('assets/players/portraits/' || player_id || '.webp'))
);
CREATE TABLE IF NOT EXISTS player_portrait_v42_cutover_guard (
 ok INTEGER NOT NULL CHECK(ok=1)
);
DELETE FROM player_portrait_v42_cutover_guard;
INSERT INTO player_portrait_v42_cutover_guard(ok)
SELECT CASE WHEN (
 -- Empty-world migrations may initialise the exclusive V4.2 schema.
 (SELECT COUNT(*) FROM generated_players)=0
 AND (SELECT COUNT(*) FROM player_portrait_profiles)=0
 AND (SELECT COUNT(*) FROM player_portrait_v42_cutover_candidates)=0
) OR (
 -- An inhabited world needs the complete 1:1 old->new set. No partial cutover.
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
-- New faces and validated assets are inserted BEFORE dropping any old identity.
INSERT INTO player_portrait_profiles_v42_next(
 player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at
)
SELECT player_id,'player-portraits-v5','player-portrait-v4.2',
 snapshot_json,'approved',asset_key,unixepoch()
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
 THEN 1 ELSE 0 END;

DROP TABLE player_portrait_profiles;
ALTER TABLE player_portrait_profiles_v42_next RENAME TO player_portrait_profiles;
-- No archived identities and no staging artifacts survive successful cutover.
DROP TABLE IF EXISTS player_portrait_v3_replacement_backup;
DROP TABLE player_portrait_v42_cutover_candidates;
DROP TABLE player_portrait_v42_cutover_guard;
