-- #791: local-first opening run journal. No automatic activation or player inserts.
-- A root (-1) pins the run; rows 0..255 are batch receipts; 256 seals publication.
CREATE TABLE opening_world_runs (
 run_key TEXT NOT NULL CHECK(length(run_key)=64 AND run_key NOT GLOB '*[^0-9a-f]*'),
 world_generation TEXT NOT NULL CHECK(length(world_generation)=36),
 batch_index INTEGER NOT NULL CHECK(typeof(batch_index)='integer' AND batch_index BETWEEN -1 AND 256),
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
 before_high_water INTEGER NOT NULL CHECK(typeof(before_high_water)='integer' AND before_high_water>=0),
 after_high_water INTEGER NOT NULL CHECK(typeof(after_high_water)='integer' AND after_high_water>=before_high_water AND after_high_water-before_high_water<=25),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND json_type(payload_json)='object'),
 draft_id TEXT REFERENCES player_generation_drafts(id) ON DELETE RESTRICT,
 created_at INTEGER NOT NULL CHECK(typeof(created_at)='integer' AND created_at>0),
 PRIMARY KEY(run_key,batch_index),
 CHECK((batch_index=-1 AND request_hash=run_key AND before_high_water=after_high_water AND draft_id IS NULL)
 OR (batch_index BETWEEN 0 AND 255 AND ((after_high_water=before_high_water AND draft_id IS NULL) OR (after_high_water>before_high_water AND draft_id IS NOT NULL)))
 OR (batch_index=256 AND before_high_water=after_high_water AND draft_id IS NULL))
);
CREATE UNIQUE INDEX opening_world_one_run_per_generation ON opening_world_runs(world_generation) WHERE batch_index=-1;
CREATE UNIQUE INDEX opening_world_one_receipt_per_draft ON opening_world_runs(draft_id) WHERE draft_id IS NOT NULL;
CREATE VIEW opening_world_staging AS
 SELECT r.* FROM opening_world_runs r JOIN world_state w ON w.id=1 AND w.generation=r.world_generation
 WHERE r.batch_index=-1 AND NOT EXISTS(SELECT 1 FROM opening_world_runs seal WHERE seal.run_key=r.run_key AND seal.batch_index=256);
CREATE VIEW opening_world_contract_slots AS
 SELECT root.run_key,root.world_generation,json_extract(j.value,'$.playerId') AS player_id,
 json_extract(root.payload_json,'$.contractClubs['||b.batch_index||']') AS club_key,
 json_extract(root.payload_json,'$.contractTerms['||(b.batch_index*25+CAST(j.key AS INTEGER))||']') AS duration_seasons,
 json_extract(j.value,'$.slotKey') AS slot_key
 FROM opening_world_runs root JOIN opening_world_runs b ON b.run_key=root.run_key AND b.batch_index BETWEEN 0 AND 255
 CROSS JOIN json_each(b.payload_json,'$.entries') j WHERE root.batch_index=-1;
CREATE TRIGGER opening_world_run_insert_guard BEFORE INSERT ON opening_world_runs
WHEN NEW.batch_index<>256
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM world_state WHERE id=1 AND generation=NEW.world_generation AND revision=0 AND season_number=0 AND day=0 AND phase='unstarted')
 OR COALESCE((SELECT seq FROM sqlite_sequence WHERE name='generated_players'),0)<>NEW.after_high_water
 THEN RAISE(ABORT,'opening world changed or sequence mismatch') END;
 SELECT CASE WHEN NEW.batch_index=-1 AND (
  json_extract(NEW.payload_json,'$.runKey') IS NOT NEW.run_key OR json_extract(NEW.payload_json,'$.worldGeneration') IS NOT NEW.world_generation
  OR json_extract(NEW.payload_json,'$.worldRevision') IS NOT 0 OR json_extract(NEW.payload_json,'$.slotCount') IS NOT 6400
  OR json_extract(NEW.payload_json,'$.batchSize') IS NOT 25 OR json_extract(NEW.payload_json,'$.initialHighWater') IS NOT NEW.before_high_water
  OR json_extract(NEW.payload_json,'$.schema') IS NOT 'opening-persistence-v2'
  OR json_type(NEW.payload_json,'$.batchIntentHashes') IS NOT 'array' OR json_array_length(NEW.payload_json,'$.batchIntentHashes')<>256
  OR EXISTS(SELECT 1 FROM json_each(NEW.payload_json,'$.batchIntentHashes') WHERE type<>'text' OR length(value)<>64 OR value GLOB '*[^0-9a-f]*')
  OR json_type(NEW.payload_json,'$.contractClubs') IS NOT 'array' OR json_array_length(NEW.payload_json,'$.contractClubs')<>256
  OR (SELECT COUNT(DISTINCT value) FROM json_each(NEW.payload_json,'$.contractClubs'))<>256
  OR EXISTS(SELECT 1 FROM json_each(NEW.payload_json,'$.contractClubs') WHERE type<>'text' OR length(value)=0)
  OR json_type(NEW.payload_json,'$.contractTerms') IS NOT 'array' OR json_array_length(NEW.payload_json,'$.contractTerms')<>6400
  OR EXISTS(SELECT 1 FROM json_each(NEW.payload_json,'$.contractTerms') WHERE type<>'integer' OR value NOT BETWEEN 1 AND 3)
  OR EXISTS(SELECT 1 FROM club_license_state l JOIN json_each(NEW.payload_json,'$.contractClubs') c ON c.value=l.club_key WHERE l.account_id IS NOT NULL)
  OR json_type(NEW.payload_json,'$.baseline') IS NOT 'array'
  OR json_array_length(NEW.payload_json,'$.baseline')<>(SELECT COUNT(*) FROM generated_players)
  OR EXISTS(SELECT 1 FROM player_signed_contracts) OR EXISTS(SELECT 1 FROM player_agent_mandates)
  OR EXISTS(SELECT 1 FROM seasons) OR EXISTS(SELECT 1 FROM season_archives) OR EXISTS(SELECT 1 FROM match_lineup_result_receipts)
 ) THEN RAISE(ABORT,'invalid opening root') END;
 SELECT CASE WHEN NEW.batch_index BETWEEN 0 AND 255 AND (
  NOT EXISTS(SELECT 1 FROM opening_world_runs WHERE run_key=NEW.run_key AND world_generation=NEW.world_generation AND batch_index=-1)
  OR NEW.batch_index<>(SELECT COUNT(*) FROM opening_world_runs WHERE run_key=NEW.run_key AND batch_index BETWEEN 0 AND 255)
  OR NEW.before_high_water IS NOT (SELECT after_high_water FROM opening_world_runs WHERE run_key=NEW.run_key AND batch_index=NEW.batch_index-1)
  OR json_extract(NEW.payload_json,'$.runKey') IS NOT NEW.run_key OR json_extract(NEW.payload_json,'$.index') IS NOT NEW.batch_index
  OR json_extract(NEW.payload_json,'$.requestHash') IS NOT NEW.request_hash
  OR json_extract(NEW.payload_json,'$.beforeHighWater') IS NOT NEW.before_high_water OR json_extract(NEW.payload_json,'$.afterHighWater') IS NOT NEW.after_high_water
  OR json_type(NEW.payload_json,'$.entries') IS NOT 'array' OR json_array_length(NEW.payload_json,'$.entries')<>25
  OR (SELECT COUNT(DISTINCT json_extract(value,'$.playerId')) FROM json_each(NEW.payload_json,'$.entries'))<>25
  OR (SELECT COUNT(DISTINCT json_extract(value,'$.slotKey')) FROM json_each(NEW.payload_json,'$.entries'))<>25
  OR EXISTS(SELECT 1 FROM json_each(NEW.payload_json,'$.entries') j JOIN opening_world_runs root ON root.run_key=NEW.run_key AND root.batch_index=-1
   WHERE json_extract(j.value,'$.slotKey') IS NOT (json_extract(root.payload_json,'$.contractClubs['||NEW.batch_index||']')||'/'||printf('%03d',CAST(j.key AS INTEGER)+1)))
  OR EXISTS(SELECT 1 FROM json_each(NEW.payload_json,'$.entries') j WHERE json_type(j.value,'$.playerId') IS NOT 'integer' OR json_type(j.value,'$.slotKey') IS NOT 'text'
    OR json_type(j.value,'$.fingerprint') IS NOT 'text' OR length(json_extract(j.value,'$.fingerprint'))<>64 OR json_extract(j.value,'$.fingerprint') GLOB '*[^0-9a-f]*'
    OR COALESCE(json_extract(j.value,'$.kind'),'') NOT IN ('reuse','generate')
    OR NOT EXISTS(SELECT 1 FROM generated_players p WHERE p.id=json_extract(j.value,'$.playerId'))
    OR (json_extract(j.value,'$.kind')='generate' AND (json_extract(j.value,'$.playerId')<=NEW.before_high_water OR json_extract(j.value,'$.playerId')>NEW.after_high_water))
    OR (json_extract(j.value,'$.kind')='reuse' AND NOT EXISTS(SELECT 1 FROM opening_world_runs root,json_each(root.payload_json,'$.baseline') b WHERE root.run_key=NEW.run_key AND root.batch_index=-1 AND json_extract(b.value,'$.id')=json_extract(j.value,'$.playerId') AND json_extract(b.value,'$.fingerprint')=json_extract(j.value,'$.fingerprint'))))
  OR (SELECT COUNT(*) FROM json_each(NEW.payload_json,'$.entries') WHERE json_extract(value,'$.kind')='generate')<>NEW.after_high_water-NEW.before_high_water
  OR EXISTS(SELECT 1 FROM opening_world_runs old,json_each(old.payload_json,'$.entries') o,json_each(NEW.payload_json,'$.entries') n WHERE old.run_key=NEW.run_key AND old.batch_index BETWEEN 0 AND 255 AND (json_extract(o.value,'$.playerId')=json_extract(n.value,'$.playerId') OR json_extract(o.value,'$.slotKey')=json_extract(n.value,'$.slotKey')))
  OR (NEW.draft_id IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM player_generation_drafts d WHERE d.id=NEW.draft_id AND d.status='committed' AND d.world_generation=NEW.world_generation AND d.season_number=0 AND d.count=NEW.after_high_water-NEW.before_high_water)
   OR (SELECT COUNT(*) FROM generated_players p WHERE p.batch_id=NEW.draft_id AND p.world_generation=NEW.world_generation AND p.id>NEW.before_high_water AND p.id<=NEW.after_high_water)<>NEW.after_high_water-NEW.before_high_water))
 ) THEN RAISE(ABORT,'invalid opening batch receipt') END;
END;
CREATE TRIGGER opening_world_run_no_update BEFORE UPDATE ON opening_world_runs BEGIN SELECT RAISE(ABORT,'immutable opening journal'); END;
CREATE TRIGGER opening_world_run_no_delete BEFORE DELETE ON opening_world_runs BEGIN SELECT RAISE(ABORT,'immutable opening journal'); END;

-- The only allowed staged world revision change is a certified initial
-- signature, with its audit and matching term already in the same transaction.
CREATE TRIGGER opening_world_block_clock BEFORE UPDATE ON world_state
WHEN EXISTS(SELECT 1 FROM opening_world_staging)
 AND (NEW.generation IS NOT OLD.generation OR NEW.revision IS NOT OLD.revision OR NEW.season_number IS NOT OLD.season_number OR NEW.day IS NOT OLD.day OR NEW.phase IS NOT OLD.phase)
 AND NOT (NEW.generation=OLD.generation AND NEW.season_number=0 AND NEW.day=0 AND NEW.phase='unstarted'
  AND NEW.revision=OLD.revision+1 AND NEW.revision=(SELECT COUNT(*) FROM player_signed_contracts WHERE world_generation=OLD.generation)
  AND EXISTS(SELECT 1 FROM admin_operations a JOIN opening_world_staging root ON root.world_generation=a.generation
   JOIN player_signed_contracts c ON c.player_id=json_extract(a.outcome_json,'$.contract.playerId') AND c.world_generation=a.generation
   WHERE a.command='sign-opening-slot-v1' AND a.expected_revision=OLD.revision AND a.resulting_revision=NEW.revision
    AND json_extract(a.outcome_json,'$.openingRunKey')=root.run_key AND c.club_key=json_extract(a.outcome_json,'$.contract.clubKey')
    AND c.duration_seasons=json_extract(a.outcome_json,'$.contract.durationSeasons') AND c.annual_salary_arc=json_extract(a.outcome_json,'$.contract.annualSalaryArc')))
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;
CREATE TRIGGER opening_world_block_other_generation BEFORE INSERT ON generated_players
WHEN EXISTS(SELECT 1 FROM opening_world_staging)
 AND NOT EXISTS(
  SELECT 1 FROM player_generation_drafts d JOIN opening_world_runs r ON r.run_key=json_extract(d.options_json,'$.runKey') AND r.batch_index=-1
   JOIN world_state w ON w.generation=r.world_generation AND w.id=1
  WHERE d.id=NEW.batch_id AND d.status='committed' AND d.world_generation=r.world_generation AND NEW.world_generation=r.world_generation
   AND d.season_number=0 AND NEW.entry_season=0 AND json_extract(d.options_json,'$.mode')='opening-world-internal'
   AND json_extract(d.options_json,'$.index')=(SELECT COUNT(*) FROM opening_world_runs b WHERE b.run_key=r.run_key AND b.batch_index BETWEEN 0 AND 255)
   AND json_extract(d.options_json,'$.index') BETWEEN 0 AND 255
   AND NOT EXISTS(SELECT 1 FROM opening_world_runs b WHERE b.draft_id=d.id)
 )
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;
CREATE TRIGGER opening_world_block_player_update BEFORE UPDATE ON generated_players
WHEN EXISTS(SELECT 1 FROM opening_world_staging)
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;
CREATE TRIGGER opening_world_block_player_delete BEFORE DELETE ON generated_players
WHEN EXISTS(SELECT 1 FROM opening_world_staging)
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;

-- A certified fresh opening catalogue cannot acquire rights during staging.
CREATE TRIGGER opening_world_block_mandate_insert BEFORE INSERT ON player_agent_mandates
WHEN EXISTS(SELECT 1 FROM opening_world_staging)
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;
CREATE TRIGGER opening_world_block_contract_insert BEFORE INSERT ON player_signed_contracts
WHEN EXISTS(SELECT 1 FROM opening_world_staging)
 AND NOT EXISTS(
  SELECT 1 FROM opening_world_staging root JOIN opening_world_contract_slots s ON s.run_key=root.run_key
   JOIN world_state w ON w.id=1 AND w.generation=root.world_generation
   JOIN admin_operations a ON a.generation=w.generation AND a.command='sign-opening-slot-v1' AND a.expected_revision=w.revision AND a.resulting_revision=w.revision+1
  WHERE (SELECT COUNT(*) FROM opening_world_runs b WHERE b.run_key=root.run_key AND b.batch_index BETWEEN 0 AND 255)=256
   AND NEW.world_generation=root.world_generation AND s.player_id=NEW.player_id AND s.club_key=NEW.club_key AND s.duration_seasons=NEW.duration_seasons
   AND NEW.start_tick=0 AND NEW.signed_mandate_id IS NULL AND NEW.signing_key='initial:'||NEW.world_generation||':'||NEW.player_id
   AND NOT EXISTS(SELECT 1 FROM club_license_state l WHERE l.club_key=NEW.club_key AND l.account_id IS NOT NULL)
   AND w.revision=(SELECT COUNT(*) FROM player_signed_contracts WHERE world_generation=w.generation)
   AND json_extract(a.outcome_json,'$.openingRunKey')=root.run_key AND json_extract(a.outcome_json,'$.contract.playerId')=NEW.player_id
   AND json_extract(a.outcome_json,'$.contract.clubKey')=NEW.club_key AND json_extract(a.outcome_json,'$.contract.durationSeasons')=NEW.duration_seasons
   AND json_extract(a.outcome_json,'$.contract.annualSalaryArc')=NEW.annual_salary_arc)
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;
CREATE TRIGGER opening_world_block_contract_update BEFORE UPDATE ON player_signed_contracts
WHEN EXISTS(SELECT 1 FROM opening_world_staging)
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;
-- Publication requires a complete exact population and signed slot relation.
-- The local publication command additionally executes #802's readiness and
-- reconciliation statements atomically; the view is supplied by 0045.
CREATE TRIGGER opening_world_publish_guard BEFORE INSERT ON opening_world_runs
WHEN NEW.batch_index=256
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM opening_world_staging root JOIN world_state w ON w.id=1 AND w.generation=root.world_generation
  JOIN admin_operations a ON a.generation=w.generation AND a.command='publish-opening-world-v1' AND a.expected_revision=w.revision AND a.resulting_revision=w.revision+1
  WHERE root.run_key=NEW.run_key AND root.world_generation=NEW.world_generation AND w.phase='unstarted' AND w.season_number=0 AND w.day=0 AND w.revision=6400
   AND a.request_hash=NEW.request_hash AND json_extract(a.outcome_json,'$.openingRunKey')=root.run_key
   AND json_extract(NEW.payload_json,'$.schema')='opening-publication-v1' AND json_extract(NEW.payload_json,'$.runKey')=root.run_key
   AND NEW.before_high_water=(SELECT after_high_water FROM opening_world_runs WHERE run_key=root.run_key AND batch_index=255)
   AND NEW.after_high_water=COALESCE((SELECT seq FROM sqlite_sequence WHERE name='generated_players'),0)
   AND (SELECT COUNT(*) FROM opening_world_runs b WHERE b.run_key=root.run_key AND b.batch_index BETWEEN 0 AND 255)=256
   AND (SELECT COUNT(*) FROM generated_players)=6400 AND NOT EXISTS(SELECT 1 FROM generated_players WHERE world_generation<>w.generation OR entry_season<>0)
   AND (SELECT COUNT(*) FROM player_signed_contracts)=6400 AND NOT EXISTS(SELECT 1 FROM player_agent_mandates)
   AND NOT EXISTS(SELECT 1 FROM opening_world_contract_slots s WHERE s.run_key=root.run_key AND NOT EXISTS(
     SELECT 1 FROM player_signed_contracts c WHERE c.player_id=s.player_id AND c.world_generation=s.world_generation AND c.club_key=s.club_key
       AND c.duration_seasons=s.duration_seasons AND c.start_tick=0 AND c.closed_tick IS NULL AND c.signed_mandate_id IS NULL))
   AND NOT EXISTS(SELECT 1 FROM club_license_state l JOIN json_each(root.payload_json,'$.contractClubs') c ON c.value=l.club_key WHERE l.account_id IS NOT NULL)
   AND EXISTS(SELECT 1 FROM economic_genesis_status g WHERE g.generation=w.generation AND g.completed=1 AND g.funded_clubs=320 AND g.posting_enabled=1))
 THEN RAISE(ABORT,'opening publication incomplete') END;
END;

-- Freeze existing and receipted portrait/index evidence while staging. The
-- only value update permitted is the initial CAS for a new internal batch,
-- before its receipt exists; ordinary maintenance cannot modify frozen rows.
CREATE TRIGGER opening_world_block_portrait_update BEFORE UPDATE ON player_portrait_profiles
WHEN EXISTS(SELECT 1 FROM opening_world_staging)
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;
CREATE TRIGGER opening_world_block_portrait_delete BEFORE DELETE ON player_portrait_profiles
WHEN EXISTS(SELECT 1 FROM opening_world_staging)
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;
CREATE TRIGGER opening_world_block_index_delete BEFORE DELETE ON player_market_values
WHEN EXISTS(SELECT 1 FROM opening_world_staging)
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;
CREATE TRIGGER opening_world_block_index_update BEFORE UPDATE ON player_market_values
WHEN EXISTS(SELECT 1 FROM opening_world_staging)
 AND NOT (OLD.config_version IS NULL AND OLD.market_value_arc IS NULL AND OLD.input_revision=0
  AND NEW.player_id IS OLD.player_id AND NEW.input_revision=0 AND NEW.config_version IS NOT NULL
  AND EXISTS(SELECT 1 FROM generated_players p JOIN player_generation_drafts d ON d.id=p.batch_id
   JOIN opening_world_runs r ON r.run_key=json_extract(d.options_json,'$.runKey') AND r.batch_index=-1
   JOIN world_state w ON w.generation=r.world_generation AND w.id=1
   WHERE p.id=OLD.player_id AND p.world_generation=r.world_generation AND d.status='committed'
    AND d.world_generation=r.world_generation AND json_extract(d.options_json,'$.mode')='opening-world-internal'
    AND json_extract(d.options_json,'$.index')=(SELECT COUNT(*) FROM opening_world_runs b WHERE b.run_key=r.run_key AND b.batch_index BETWEEN 0 AND 255)
    AND NOT EXISTS(SELECT 1 FROM opening_world_runs b WHERE b.draft_id=d.id)))
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;
