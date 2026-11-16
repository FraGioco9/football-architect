-- PR #640 player #50: MANUAL DEV-ONLY; DO NOT EXECUTE during staging.
-- Run only after separate owner approval and published, verified 50.webp.
-- Never run in Production; do not change immutable snapshot_json.
UPDATE player_portrait_profiles
SET status='approved', asset_key='assets/players/portraits/50.webp'
WHERE player_id=50 AND status='pending' AND asset_key IS NULL
  AND schema_version='player-portraits-v2' AND prompt_version='player-portrait-v3'
  AND json_extract(snapshot_json,'$.player_id')=50
  AND json_extract(snapshot_json,'$.appearance_fingerprint')='ca16d977229022e4'
  AND EXISTS (SELECT 1 FROM generated_players WHERE id=50
    AND json_extract(payload_json,'$.display_name')='Severino Cerboni');
-- Require exactly 1 changed row on FIRST separately authorized run.
SELECT changes() AS rows_updated;
SELECT player_id,status,asset_key,json_extract(snapshot_json,'$.appearance_fingerprint') AS fingerprint
FROM player_portrait_profiles WHERE player_id=50;
