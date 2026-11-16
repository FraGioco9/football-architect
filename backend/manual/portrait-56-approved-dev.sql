-- PR #640 player #56 Ferdinando Guerriero: MANUAL DEV-ONLY; DO NOT EXECUTE during staging.
-- Run only after separately authorized publication of verified 56.webp. NEVER Production.
-- Do not modify immutable snapshot_json. Require exactly one row changed on first authorized run.
UPDATE player_portrait_profiles
SET status='approved', asset_key='assets/players/portraits/56.webp'
WHERE player_id=56 AND status='pending' AND asset_key IS NULL
  AND schema_version='player-portraits-v2' AND prompt_version='player-portrait-v3'
  AND json_extract(snapshot_json,'$.player_id')=56
  AND json_extract(snapshot_json,'$.appearance_fingerprint')='9bdcd229a0c5c6c8'
  AND EXISTS (SELECT 1 FROM generated_players WHERE id=56
    AND json_extract(payload_json,'$.display_name')='Ferdinando Guerriero');
-- Expected rows_updated=1 ONLY after separate permission.
SELECT changes() AS rows_updated;
SELECT player_id,status,asset_key,json_extract(snapshot_json,'$.appearance_fingerprint') AS fingerprint
FROM player_portrait_profiles WHERE player_id=56;
