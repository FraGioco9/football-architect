-- PR #640 player #53 Paolo Lacasa: MANUAL DEV-ONLY; DO NOT EXECUTE during staging.
-- Only after separately authorized publication of verified 53.webp. NEVER Production.
-- Do not alter immutable snapshot_json. Require exactly 1 changed row on first run.
UPDATE player_portrait_profiles
SET status='approved', asset_key='assets/players/portraits/53.webp'
WHERE player_id=53 AND status='pending' AND asset_key IS NULL
  AND schema_version='player-portraits-v2' AND prompt_version='player-portrait-v3'
  AND json_extract(snapshot_json,'$.player_id')=53
  AND json_extract(snapshot_json,'$.appearance_fingerprint')='7981292a11708feb'
  AND EXISTS (SELECT 1 FROM generated_players WHERE id=53
    AND json_extract(payload_json,'$.display_name')='Paolo Lacasa');
SELECT changes() AS rows_updated;
SELECT player_id,status,asset_key,json_extract(snapshot_json,'$.appearance_fingerprint') AS fingerprint
FROM player_portrait_profiles WHERE player_id=53;
