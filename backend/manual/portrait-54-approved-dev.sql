-- PR #640 player #54 Massimo Bottineri: MANUAL DEV-ONLY; DO NOT EXECUTE during staging.
-- Only after separately authorized publication of verified 54.webp. NEVER Production.
-- Preserve immutable snapshot_json; require exactly one changed row on FIRST authorized run.
UPDATE player_portrait_profiles
SET status='approved', asset_key='assets/players/portraits/54.webp'
WHERE player_id=54 AND status='pending' AND asset_key IS NULL
  AND schema_version='player-portraits-v2' AND prompt_version='player-portrait-v3'
  AND json_extract(snapshot_json,'$.player_id')=54
  AND json_extract(snapshot_json,'$.appearance_fingerprint')='9a51467599ad501c'
  AND EXISTS (SELECT 1 FROM generated_players WHERE id=54
    AND json_extract(payload_json,'$.display_name')='Massimo Bottineri');
SELECT changes() AS rows_updated;
SELECT player_id,status,asset_key,json_extract(snapshot_json,'$.appearance_fingerprint') AS fingerprint
FROM player_portrait_profiles WHERE player_id=54;
