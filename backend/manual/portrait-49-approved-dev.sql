-- #640 ID 49: MANUAL DEV-ONLY. Staging does NOT authorize execution.
-- Run only after separate approval and published 49.webp, NEVER in Production.
UPDATE player_portrait_profiles
SET status='approved', asset_key='assets/players/portraits/49.webp'
WHERE player_id=49 AND status='pending' AND asset_key IS NULL
  AND schema_version='player-portraits-v2' AND prompt_version='player-portrait-v3'
  AND json_extract(snapshot_json,'$.player_id')=49
  AND json_extract(snapshot_json,'$.appearance_fingerprint')='49aae634f4ff8519'
  AND EXISTS (SELECT 1 FROM generated_players WHERE id=49
    AND json_extract(payload_json,'$.display_name')='Gianfranco Patry');
SELECT changes() AS rows_updated;
SELECT player_id,status,asset_key,json_extract(snapshot_json,'$.appearance_fingerprint') AS fingerprint
FROM player_portrait_profiles WHERE player_id=49;
