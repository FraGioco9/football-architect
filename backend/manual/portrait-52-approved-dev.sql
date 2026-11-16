-- PR #640 player #52 Emilio Rigotto: MANUAL DEV-ONLY; DO NOT EXECUTE during staging.
-- Only after separately authorized publication of verified 52.webp. NEVER Production.
-- Do not change immutable snapshot_json; require exactly 1 changed row on first approved run.
UPDATE player_portrait_profiles
SET status='approved', asset_key='assets/players/portraits/52.webp'
WHERE player_id=52 AND status='pending' AND asset_key IS NULL
  AND schema_version='player-portraits-v2' AND prompt_version='player-portrait-v3'
  AND json_extract(snapshot_json,'$.player_id')=52
  AND json_extract(snapshot_json,'$.appearance_fingerprint')='fff5faeef7005b1a'
  AND EXISTS (SELECT 1 FROM generated_players WHERE id=52
    AND json_extract(payload_json,'$.display_name')='Emilio Rigotto');
SELECT changes() AS rows_updated;
SELECT player_id,status,asset_key,json_extract(snapshot_json,'$.appearance_fingerprint') AS fingerprint
FROM player_portrait_profiles WHERE player_id=52;
