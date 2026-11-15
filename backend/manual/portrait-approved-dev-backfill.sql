-- MANUAL DEV-ONLY operation, NOT a D1 migration. Requires separate user approval.
-- Player portraits already approved on 2026-11-15: #44, #98, #145.
-- Apply ONLY to the verified football-architect-dev database AFTER migration 0026.
-- Never run on Production and never infer other players from these numeric IDs.
-- This is a guarded, idempotent initial backfill; no photographs are altered.

-- #44: Giacinto Lello — checked with read-only DEV D1 before this file was prepared.
INSERT INTO player_portrait_profiles(player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
SELECT p.id,'player-portraits-v2','player-portrait-v3','{"schema_version":"player-portraits-v2","prompt_version":"player-portrait-v3","player_id":44,"nationality":"ITA","secondary_nationality":null,"body_profile":"balanced-athletic","body_conditioning":"natural","appearance_traits":{"face":"long oval face","complexion":"deep brown complexion","hairTexture":"coily hair","hairStyle":"closely trimmed haircut","hairColor":"auburn hair","eyes":"green eyes","eyebrows":"fine eyebrows","nose":"narrow nose","jaw":"square jawline","facialHair":"clean-shaven face","detail":"subtle smile lines"},"appearance_fingerprint":"49d9a18b0f2df2bb"}',
 'approved','assets/players/portraits/44.webp',CAST(strftime('%s','now') AS INTEGER)
FROM generated_players AS p
WHERE p.id=44 AND json_extract(p.payload_json,'$.display_name')='Giacinto Lello'
 AND json_extract(p.payload_json,'$.nationality')='ITA'
 AND json_extract(p.payload_json,'$.attributes.strength')=73
 AND json_extract(p.payload_json,'$.attributes.speed')=69
 AND json_extract(p.payload_json,'$.attributes.agility')=82
 AND json_extract(p.payload_json,'$.attributes.stamina')=64
 AND NOT EXISTS(SELECT 1 FROM player_portrait_profiles WHERE player_id=p.id);

-- #98: Arthur Kiesel — checked with read-only DEV D1 before this file was prepared.
INSERT INTO player_portrait_profiles(player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
SELECT p.id,'player-portraits-v2','player-portrait-v3','{"schema_version":"player-portraits-v2","prompt_version":"player-portrait-v3","player_id":98,"nationality":"GER","secondary_nationality":null,"body_profile":"lean-athletic","body_conditioning":"endurance","appearance_traits":{"face":"rounded face","complexion":"light olive complexion","hairTexture":"slightly wavy hair","hairStyle":"short curly top","hairColor":"dark blond hair","eyes":"brown eyes","eyebrows":"gently arched eyebrows","nose":"straight nose","jaw":"narrow jawline","facialHair":"short mustache and stubble","detail":"faint natural under-eye creases"},"appearance_fingerprint":"927b9d9ee029f2e3"}',
 'approved','assets/players/portraits/98.webp',CAST(strftime('%s','now') AS INTEGER)
FROM generated_players AS p
WHERE p.id=98 AND json_extract(p.payload_json,'$.display_name')='Arthur Kiesel'
 AND json_extract(p.payload_json,'$.nationality')='GER'
 AND json_extract(p.payload_json,'$.attributes.strength')=51
 AND json_extract(p.payload_json,'$.attributes.speed')=77
 AND json_extract(p.payload_json,'$.attributes.agility')=57
 AND json_extract(p.payload_json,'$.attributes.stamina')=78
 AND NOT EXISTS(SELECT 1 FROM player_portrait_profiles WHERE player_id=p.id);

-- #145: Steven Sellen — checked with read-only DEV D1 before this file was prepared.
INSERT INTO player_portrait_profiles(player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
SELECT p.id,'player-portraits-v2','player-portrait-v3','{"schema_version":"player-portraits-v2","prompt_version":"player-portrait-v3","player_id":145,"nationality":"ENG","secondary_nationality":null,"body_profile":"power-athletic","body_conditioning":"natural","appearance_traits":{"face":"rounded face","complexion":"very deep brown complexion","hairTexture":"loose curly hair","hairStyle":"medium length natural haircut","hairColor":"blond hair","eyes":"brown eyes","eyebrows":"thick eyebrows","nose":"straight nose","jaw":"rounded jawline","facialHair":"clean-shaven face","detail":"subtle freckles"},"appearance_fingerprint":"db6cf3b4ea78f434"}',
 'approved','assets/players/portraits/145.webp',CAST(strftime('%s','now') AS INTEGER)
FROM generated_players AS p
WHERE p.id=145 AND json_extract(p.payload_json,'$.display_name')='Steven Sellen'
 AND json_extract(p.payload_json,'$.nationality')='ENG'
 AND json_extract(p.payload_json,'$.attributes.strength')=77
 AND json_extract(p.payload_json,'$.attributes.speed')=68
 AND json_extract(p.payload_json,'$.attributes.agility')=67
 AND json_extract(p.payload_json,'$.attributes.stamina')=61
 AND NOT EXISTS(SELECT 1 FROM player_portrait_profiles WHERE player_id=p.id);

-- The operator MUST verify all three rows/fingerprints and image keys afterward.
SELECT player_id,status,asset_key,json_extract(snapshot_json,'$.appearance_fingerprint') AS face_fingerprint
 FROM player_portrait_profiles WHERE player_id IN (44,98,145) ORDER BY player_id;
