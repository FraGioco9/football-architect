-- PR #640 player #51 Giampiero Caione: MANUAL DEV-ONLY; DO NOT EXECUTE during staging.
-- Run only after separately authorized publication of verified 51.webp. NEVER Production.
-- Do not modify immutable snapshot_json. Require exactly one updated row on first authorized execution.
UPDATE player_portrait_profiles
SET status='approved', asset_key='assets/players/portraits/51.webp'
WHERE player_id=51 AND status='pending' AND asset_key IS NULL
  AND schema_version='player-portraits-v2' AND prompt_version='player-portrait-v3'
  AND json_extract(snapshot_json,'$.player_id')=51
  AND json_extract(snapshot_json,'$.appearance_fingerprint')='3ac282c49a28f65c'
  AND EXISTS (SELECT 1 FROM generated_players WHERE id=51
    AND json_extract(payload_json,'$.display_name')='Giampiero Caione');
-- Expect rows_updated=1 on first, separately authorized run.
SELECT changes() AS rows_updated;
SELECT player_id,status,asset_key,json_extract(snapshot_json,'$.appearance_fingerprint') AS fingerprint
FROM player_portrait_profiles WHERE player_id=51;
