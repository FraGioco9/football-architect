-- Issue #639, PR #640. MANUAL DEV-ONLY; never run without separate explicit owner approval.
-- Apply ONLY to verified Cloudflare D1 football-architect-dev after asset 47.webp is published.
-- Do not alter immutable snapshot_json; do not apply this numeric ID in Production.
UPDATE player_portrait_profiles
SET status = 'approved',
    asset_key = 'assets/players/portraits/47.webp'
WHERE player_id = 47
  AND status = 'pending'
  AND asset_key IS NULL
  AND schema_version = 'player-portraits-v2'
  AND prompt_version = 'player-portrait-v3'
  AND json_extract(snapshot_json, '$.player_id') = 47
  AND json_extract(snapshot_json, '$.appearance_fingerprint') = 'b1acddd2bf187186'
  AND EXISTS (
    SELECT 1 FROM generated_players
    WHERE id = 47 AND json_extract(payload_json, '$.display_name') = 'Matthew Tiamiyu'
  );
-- Require exactly 1 row changed during the first authorized run.
SELECT changes() AS rows_updated;
SELECT player_id,status,asset_key,json_extract(snapshot_json,'$.appearance_fingerprint') AS fingerprint
FROM player_portrait_profiles WHERE player_id = 47;
