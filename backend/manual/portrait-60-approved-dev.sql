-- PR #640 player #60 Enrico Pasi: MANUAL DEV-ONLY; DO NOT EXECUTE during staging.
-- Run only after separately authorized publication of verified 60.webp. NEVER Production.
-- Immutable snapshot_json must never be changed. First authorized run expects exactly one updated row.
UPDATE player_portrait_profiles
SET status='approved', asset_key='assets/players/portraits/60.webp'
WHERE player_id=60 AND status='pending' AND asset_key IS NULL
  AND schema_version='player-portraits-v2' AND prompt_version='player-portrait-v3'
  AND json_extract(snapshot_json,'$.player_id')=60
  AND json_extract(snapshot_json,'$.appearance_fingerprint')='bd007438da15cb5b'
  AND EXISTS (SELECT 1 FROM generated_players WHERE id=60
    AND json_extract(payload_json,'$.display_name')='Enrico Pasi');
-- Expected rows_updated=1 ONLY after separate permission.
SELECT changes() AS rows_updated;
SELECT player_id,status,asset_key,json_extract(snapshot_json,'$.appearance_fingerprint') AS fingerprint
FROM player_portrait_profiles WHERE player_id=60;
