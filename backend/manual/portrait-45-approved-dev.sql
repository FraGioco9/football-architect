-- #640 / #639. MANUAL DEV-ONLY; requires explicit separate approval before use.
-- Run ONLY against football-architect-dev after binary validation and authorized deployment.
-- Does not modify immutable snapshot_json. Never run in Production.
UPDATE player_portrait_profiles
SET status = 'approved',
    asset_key = 'assets/players/portraits/45.webp'
WHERE player_id = 45
  AND status = 'pending'
  AND asset_key IS NULL
  AND schema_version = 'player-portraits-v2'
  AND prompt_version = 'player-portrait-v3'
  AND json_extract(snapshot_json, '$.player_id') = 45
  AND json_extract(snapshot_json, '$.appearance_fingerprint') = 'b7a293c6d7061ec2'
  AND EXISTS (
    SELECT 1 FROM generated_players
    WHERE id = 45
      AND json_extract(payload_json, '$.display_name') = 'Paolo Andrian'
  );
-- Require exactly 1 updated row on first explicitly authorized run.
SELECT changes() AS rows_updated;
SELECT player_id,status,asset_key,json_extract(snapshot_json,'$.appearance_fingerprint') AS fingerprint
FROM player_portrait_profiles WHERE player_id = 45;
