-- PR #640 player #59 Andrea Cusenza: MANUAL DEV-ONLY; DO NOT EXECUTE during staging.
-- Run only after separately authorized publication of verified 59.webp. NEVER Production.
-- Do not modify immutable snapshot_json. Require exactly one row changed on first authorized run.
UPDATE player_portrait_profiles
SET status='approved', asset_key='assets/players/portraits/59.webp'
WHERE player_id=59 AND status='pending' AND asset_key IS NULL
  AND schema_version='player-portraits-v2' AND prompt_version='player-portrait-v3'
  AND json_extract(snapshot_json,'$.player_id')=59
  AND json_extract(snapshot_json,'$.appearance_fingerprint')='ddb5407331e92ab9'
  AND EXISTS (SELECT 1 FROM generated_players WHERE id=59
    AND json_extract(payload_json,'$.display_name')='Andrea Cusenza');
-- Expected rows_updated=1 ONLY after separate permission.
SELECT changes() AS rows_updated;
SELECT player_id,status,asset_key,json_extract(snapshot_json,'$.appearance_fingerprint') AS fingerprint
FROM player_portrait_profiles WHERE player_id=59;
