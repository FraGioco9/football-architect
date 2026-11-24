-- #791: local-first opening run journal. No automatic activation or player inserts.
-- A root (-1) pins the run; each subsequent row is one immutable batch receipt.
CREATE TABLE opening_world_runs (
 run_key TEXT NOT NULL CHECK(length(run_key)=64 AND run_key NOT GLOB '*[^0-9a-f]*'),
 world_generation TEXT NOT NULL CHECK(length(world_generation)=36),
 batch_index INTEGER NOT NULL CHECK(typeof(batch_index)='integer' AND batch_index BETWEEN -1 AND 255),
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
 before_high_water INTEGER NOT NULL CHECK(typeof(before_high_water)='integer' AND before_high_water>=0),
 after_high_water INTEGER NOT NULL CHECK(typeof(after_high_water)='integer' AND after_high_water>=before_high_water AND after_high_water-before_high_water<=25),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND json_type(payload_json)='object'),
 draft_id TEXT REFERENCES player_generation_drafts(id) ON DELETE RESTRICT,
 created_at INTEGER NOT NULL CHECK(typeof(created_at)='integer' AND created_at>0),
 PRIMARY KEY(run_key,batch_index),
 CHECK((batch_index=-1 AND request_hash=run_key AND before_high_water=after_high_water AND draft_id IS NULL)
 OR (batch_index>=0 AND ((after_high_water=before_high_water AND draft_id IS NULL) OR (after_high_water>before_high_water AND draft_id IS NOT NULL))))
);
CREATE UNIQUE INDEX opening_world_one_run_per_generation ON opening_world_runs(world_generation) WHERE batch_index=-1;
CREATE UNIQUE INDEX opening_world_one_receipt_per_draft ON opening_world_runs(draft_id) WHERE draft_id IS NOT NULL;
CREATE TRIGGER opening_world_run_insert_guard BEFORE INSERT ON opening_world_runs
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
  OR json_type(NEW.payload_json,'$.baseline') IS NOT 'array'
  OR json_array_length(NEW.payload_json,'$.baseline')<>(SELECT COUNT(*) FROM generated_players)
 ) THEN RAISE(ABORT,'invalid opening root') END;
 SELECT CASE WHEN NEW.batch_index>=0 AND (
  NOT EXISTS(SELECT 1 FROM opening_world_runs WHERE run_key=NEW.run_key AND world_generation=NEW.world_generation AND batch_index=-1)
  OR NEW.batch_index<>(SELECT COUNT(*) FROM opening_world_runs WHERE run_key=NEW.run_key AND batch_index>=0)
  OR NEW.before_high_water IS NOT (SELECT after_high_water FROM opening_world_runs WHERE run_key=NEW.run_key AND batch_index=NEW.batch_index-1)
  OR json_extract(NEW.payload_json,'$.runKey') IS NOT NEW.run_key OR json_extract(NEW.payload_json,'$.index') IS NOT NEW.batch_index
  OR json_extract(NEW.payload_json,'$.requestHash') IS NOT NEW.request_hash
  OR json_extract(NEW.payload_json,'$.beforeHighWater') IS NOT NEW.before_high_water OR json_extract(NEW.payload_json,'$.afterHighWater') IS NOT NEW.after_high_water
  OR json_type(NEW.payload_json,'$.entries') IS NOT 'array' OR json_array_length(NEW.payload_json,'$.entries')<>25
  OR (SELECT COUNT(DISTINCT json_extract(value,'$.playerId')) FROM json_each(NEW.payload_json,'$.entries'))<>25
  OR (SELECT COUNT(DISTINCT json_extract(value,'$.slotKey')) FROM json_each(NEW.payload_json,'$.entries'))<>25
  OR EXISTS(SELECT 1 FROM json_each(NEW.payload_json,'$.entries') j WHERE json_type(j.value,'$.playerId') IS NOT 'integer' OR json_type(j.value,'$.slotKey') IS NOT 'text'
    OR json_type(j.value,'$.fingerprint') IS NOT 'text' OR length(json_extract(j.value,'$.fingerprint'))<>64 OR json_extract(j.value,'$.fingerprint') GLOB '*[^0-9a-f]*'
    OR COALESCE(json_extract(j.value,'$.kind'),'') NOT IN ('reuse','generate')
    OR NOT EXISTS(SELECT 1 FROM generated_players p WHERE p.id=json_extract(j.value,'$.playerId'))
    OR (json_extract(j.value,'$.kind')='generate' AND (json_extract(j.value,'$.playerId')<=NEW.before_high_water OR json_extract(j.value,'$.playerId')>NEW.after_high_water))
    OR (json_extract(j.value,'$.kind')='reuse' AND NOT EXISTS(SELECT 1 FROM opening_world_runs root,json_each(root.payload_json,'$.baseline') b WHERE root.run_key=NEW.run_key AND root.batch_index=-1 AND json_extract(b.value,'$.id')=json_extract(j.value,'$.playerId') AND json_extract(b.value,'$.fingerprint')=json_extract(j.value,'$.fingerprint'))))
  OR (SELECT COUNT(*) FROM json_each(NEW.payload_json,'$.entries') WHERE json_extract(value,'$.kind')='generate')<>NEW.after_high_water-NEW.before_high_water
  OR EXISTS(SELECT 1 FROM opening_world_runs old,json_each(old.payload_json,'$.entries') o,json_each(NEW.payload_json,'$.entries') n WHERE old.run_key=NEW.run_key AND old.batch_index>=0 AND (json_extract(o.value,'$.playerId')=json_extract(n.value,'$.playerId') OR json_extract(o.value,'$.slotKey')=json_extract(n.value,'$.slotKey')))
  OR (NEW.draft_id IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM player_generation_drafts d WHERE d.id=NEW.draft_id AND d.status='committed' AND d.world_generation=NEW.world_generation AND d.season_number=0 AND d.count=NEW.after_high_water-NEW.before_high_water)
   OR (SELECT COUNT(*) FROM generated_players p WHERE p.batch_id=NEW.draft_id AND p.world_generation=NEW.world_generation AND p.id>NEW.before_high_water AND p.id<=NEW.after_high_water)<>NEW.after_high_water-NEW.before_high_water))
 ) THEN RAISE(ABORT,'invalid opening batch receipt') END;
END;
CREATE TRIGGER opening_world_run_no_update BEFORE UPDATE ON opening_world_runs BEGIN SELECT RAISE(ABORT,'immutable opening journal'); END;
CREATE TRIGGER opening_world_run_no_delete BEFORE DELETE ON opening_world_runs BEGIN SELECT RAISE(ABORT,'immutable opening journal'); END;

-- Local staging lock. No release/activation path in this checkpoint.
-- Existing normal workflows are unchanged when no current-generation root exists.
CREATE TRIGGER opening_world_block_clock BEFORE UPDATE ON world_state
WHEN EXISTS(SELECT 1 FROM opening_world_runs WHERE world_generation=OLD.generation AND batch_index=-1)
 AND (NEW.generation IS NOT OLD.generation OR NEW.revision IS NOT OLD.revision OR NEW.season_number IS NOT OLD.season_number OR NEW.day IS NOT OLD.day OR NEW.phase IS NOT OLD.phase)
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;
CREATE TRIGGER opening_world_block_other_generation BEFORE INSERT ON generated_players
WHEN EXISTS(SELECT 1 FROM opening_world_runs r JOIN world_state w ON w.generation=r.world_generation WHERE r.batch_index=-1 AND w.id=1)
 AND NOT EXISTS(
  SELECT 1 FROM player_generation_drafts d JOIN opening_world_runs r ON r.run_key=json_extract(d.options_json,'$.runKey') AND r.batch_index=-1
   JOIN world_state w ON w.generation=r.world_generation AND w.id=1
  WHERE d.id=NEW.batch_id AND d.status='committed' AND d.world_generation=r.world_generation AND NEW.world_generation=r.world_generation
   AND d.season_number=0 AND NEW.entry_season=0 AND json_extract(d.options_json,'$.mode')='opening-world-internal'
   AND json_extract(d.options_json,'$.index')=(SELECT COUNT(*) FROM opening_world_runs b WHERE b.run_key=r.run_key AND b.batch_index>=0)
   AND json_extract(d.options_json,'$.index') BETWEEN 0 AND 255
   AND NOT EXISTS(SELECT 1 FROM opening_world_runs b WHERE b.draft_id=d.id)
 )
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;
CREATE TRIGGER opening_world_block_player_update BEFORE UPDATE ON generated_players
WHEN EXISTS(SELECT 1 FROM opening_world_runs r JOIN world_state w ON w.generation=r.world_generation WHERE r.batch_index=-1 AND w.id=1)
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;
CREATE TRIGGER opening_world_block_player_delete BEFORE DELETE ON generated_players
WHEN EXISTS(SELECT 1 FROM opening_world_runs r JOIN world_state w ON w.generation=r.world_generation WHERE r.batch_index=-1 AND w.id=1)
BEGIN SELECT RAISE(ABORT,'opening world staging lock'); END;
