-- PR #640 / issue #639, player 148: MANUAL DEV-ONLY; NEVER execute during staging.
-- Requires separately authorized publication and DEV D1 approval. NEVER run in Production.
-- Do not modify immutable snapshot_json.
UPDATE player_portrait_profiles
SET status='approved', asset_key='assets/players/portraits/148.webp'
WHERE player_id=148 AND status='pending' AND asset_key IS NULL
  AND schema_version='player-portraits-v2' AND prompt_version='player-portrait-v3'
  AND json_extract(snapshot_json,'$.player_id')=148
  AND json_extract(snapshot_json,'$.appearance_fingerprint')='2c013bc6054a8073'
  AND EXISTS (SELECT 1 FROM generated_players WHERE id=148
    AND json_extract(payload_json,'$.display_name')='Craig Leaman');
-- Require exactly one updated row on FIRST separately authorized execution.
SELECT changes() AS rows_updated;
SELECT player_id,status,asset_key,json_extract(snapshot_json,'$.appearance_fingerprint') AS fingerprint
FROM player_portrait_profiles WHERE player_id=148;
