-- PR #640 player #63 Fiorenzo Colarusso: MANUAL DEV-ONLY; DO NOT EXECUTE during staging.
-- Run only after separately authorized publication of verified 63.webp. NEVER Production.
-- Immutable snapshot_json must not be changed. First authorized run requires exactly one updated row.
UPDATE player_portrait_profiles
SET status='approved', asset_key='assets/players/portraits/63.webp'
WHERE player_id=63 AND status='pending' AND asset_key IS NULL
  AND schema_version='player-portraits-v2' AND prompt_version='player-portrait-v3'
  AND json_extract(snapshot_json,'$.player_id')=63
  AND json_extract(snapshot_json,'$.appearance_fingerprint')='ee345d86a80d6e16'
  AND EXISTS (SELECT 1 FROM generated_players WHERE id=63
    AND json_extract(payload_json,'$.display_name')='Fiorenzo Colarusso');
-- Expected rows_updated=1 ONLY after separate permission.
SELECT changes() AS rows_updated;
SELECT player_id,status,asset_key,json_extract(snapshot_json,'$.appearance_fingerprint') AS fingerprint
FROM player_portrait_profiles WHERE player_id=63;
