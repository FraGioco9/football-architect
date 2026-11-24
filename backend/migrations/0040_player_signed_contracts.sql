-- #777 phase A: empty contract/mandate schema. No backfill, signing, grants or money.
-- Existing affiliation remains the sporting read model. Initial AI representation is
-- implicit until a human mandate has been acquired; do not create one row per AI player.
-- Sporting coordinates are ordinal days: (season - 1) * 56 + day - 1.
-- End coordinates are exclusive. Real signing timestamps are milliseconds UTC.
CREATE TABLE player_agent_mandates (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 player_id INTEGER NOT NULL REFERENCES generated_players(id) ON DELETE RESTRICT,
 world_generation TEXT NOT NULL CHECK(length(world_generation)=36),
 account_id TEXT NOT NULL REFERENCES player_accounts(id) ON DELETE RESTRICT,
 start_tick INTEGER NOT NULL CHECK(typeof(start_tick)='integer' AND start_tick>=0),
 end_tick INTEGER CHECK(end_tick IS NULL OR (typeof(end_tick)='integer' AND end_tick>=start_tick)),
 acquired_at_ms INTEGER NOT NULL CHECK(typeof(acquired_at_ms)='integer' AND acquired_at_ms>0),
 acquisition_key TEXT NOT NULL UNIQUE CHECK(length(acquisition_key) BETWEEN 1 AND 240),
 CHECK(typeof(player_id)='integer' AND player_id>0)
);
CREATE UNIQUE INDEX player_agent_mandates_current
 ON player_agent_mandates(player_id) WHERE end_tick IS NULL;
CREATE INDEX player_agent_mandates_account ON player_agent_mandates(account_id,player_id);
CREATE INDEX player_agent_mandates_history ON player_agent_mandates(player_id,start_tick);
CREATE TRIGGER player_agent_mandates_insert_guard BEFORE INSERT ON player_agent_mandates
BEGIN
 SELECT CASE WHEN NEW.world_generation<>(SELECT generation FROM world_state WHERE id=1)
  OR NEW.end_tick IS NOT NULL OR EXISTS(
   SELECT 1 FROM player_agent_mandates m WHERE m.player_id=NEW.player_id
    AND (m.end_tick IS NULL OR m.end_tick>NEW.start_tick))
  THEN RAISE(ABORT,'invalid mandate interval') END;
END;
CREATE TRIGGER player_agent_mandates_close_only BEFORE UPDATE ON player_agent_mandates
BEGIN
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.player_id IS NOT OLD.player_id
  OR NEW.world_generation IS NOT OLD.world_generation OR NEW.account_id IS NOT OLD.account_id
  OR NEW.start_tick IS NOT OLD.start_tick OR NEW.acquired_at_ms IS NOT OLD.acquired_at_ms
  OR NEW.acquisition_key IS NOT OLD.acquisition_key
  OR OLD.end_tick IS NOT NULL OR NEW.end_tick IS NULL
  THEN RAISE(ABORT,'immutable mandate history') END;
END;
CREATE TRIGGER player_agent_mandates_no_delete BEFORE DELETE ON player_agent_mandates
 BEGIN SELECT RAISE(ABORT,'immutable mandate history'); END;
CREATE TABLE player_signed_contracts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 player_id INTEGER NOT NULL REFERENCES generated_players(id) ON DELETE RESTRICT,
 world_generation TEXT NOT NULL CHECK(length(world_generation)=36),
 club_key TEXT NOT NULL CHECK(length(club_key) BETWEEN 4 AND 6),
 signed_at_ms INTEGER NOT NULL CHECK(typeof(signed_at_ms)='integer' AND signed_at_ms>0),
 start_tick INTEGER NOT NULL CHECK(typeof(start_tick)='integer' AND start_tick>=0),
 duration_seasons INTEGER NOT NULL CHECK(typeof(duration_seasons)='integer' AND duration_seasons BETWEEN 1 AND 3),
 scheduled_end_tick INTEGER NOT NULL CHECK(typeof(scheduled_end_tick)='integer'
  AND scheduled_end_tick=((start_tick/56)+duration_seasons)*56 AND scheduled_end_tick>start_tick),
 annual_salary_arc INTEGER NOT NULL CHECK(typeof(annual_salary_arc)='integer' AND annual_salary_arc BETWEEN 1 AND 1000000000000),
 minimum_arc INTEGER NOT NULL CHECK(typeof(minimum_arc)='integer' AND minimum_arc IN (20,40)),
 reference_arc INTEGER NOT NULL CHECK(typeof(reference_arc)='integer' AND reference_arc BETWEEN minimum_arc AND 500000000000),
 maximum_arc INTEGER NOT NULL CHECK(typeof(maximum_arc)='integer' AND maximum_arc=2*reference_arc),
 policy_version TEXT NOT NULL CHECK(length(policy_version) BETWEEN 1 AND 100),
 signed_mandate_id INTEGER REFERENCES player_agent_mandates(id) ON DELETE RESTRICT,
 signing_key TEXT NOT NULL UNIQUE CHECK(length(signing_key) BETWEEN 1 AND 240),
 closed_tick INTEGER CHECK(closed_tick IS NULL OR (typeof(closed_tick)='integer'
  AND closed_tick BETWEEN start_tick AND scheduled_end_tick)),
 close_reason TEXT CHECK(close_reason IN ('expiry','release','transfer','retirement')),
 CHECK(typeof(player_id)='integer' AND player_id>0),
 CHECK(annual_salary_arc BETWEEN minimum_arc AND maximum_arc),
 CHECK(signed_mandate_id IS NOT NULL OR annual_salary_arc=(5*reference_arc+3)/4),
 CHECK((closed_tick IS NULL)=(close_reason IS NULL)),
 CHECK(close_reason IS NULL OR close_reason<>'expiry' OR closed_tick=scheduled_end_tick)
);
-- Phase A only: one unresolved term. Renewal scheduling/activation is a later command,
-- not a second live contract row. Signed history is indexed directly; no mirror table.
CREATE UNIQUE INDEX player_signed_contracts_current
 ON player_signed_contracts(player_id) WHERE closed_tick IS NULL;
CREATE INDEX player_signed_contracts_club ON player_signed_contracts(club_key,player_id) WHERE closed_tick IS NULL;
CREATE INDEX player_signed_contracts_history ON player_signed_contracts(player_id,signed_at_ms DESC,id DESC);
CREATE TRIGGER player_signed_contracts_insert_guard BEFORE INSERT ON player_signed_contracts
BEGIN
 SELECT CASE WHEN NEW.world_generation<>(SELECT generation FROM world_state WHERE id=1)
  OR NEW.closed_tick IS NOT NULL OR EXISTS(
   SELECT 1 FROM player_signed_contracts c WHERE c.player_id=NEW.player_id
    AND (c.closed_tick IS NULL OR c.closed_tick>NEW.start_tick))
  OR (NEW.signed_mandate_id IS NULL AND EXISTS(
   SELECT 1 FROM player_agent_mandates m WHERE m.player_id=NEW.player_id AND m.end_tick IS NULL))
  OR (NEW.signed_mandate_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM player_agent_mandates m WHERE m.id=NEW.signed_mandate_id
    AND m.player_id=NEW.player_id AND m.end_tick IS NULL AND m.start_tick<=NEW.start_tick))
  THEN RAISE(ABORT,'invalid contract interval or mandate') END;
END;
CREATE TRIGGER player_signed_contracts_close_only BEFORE UPDATE ON player_signed_contracts
BEGIN
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.player_id IS NOT OLD.player_id
  OR NEW.world_generation IS NOT OLD.world_generation OR NEW.club_key IS NOT OLD.club_key
  OR NEW.signed_at_ms IS NOT OLD.signed_at_ms OR NEW.start_tick IS NOT OLD.start_tick
  OR NEW.duration_seasons IS NOT OLD.duration_seasons OR NEW.scheduled_end_tick IS NOT OLD.scheduled_end_tick
  OR NEW.annual_salary_arc IS NOT OLD.annual_salary_arc OR NEW.minimum_arc IS NOT OLD.minimum_arc
  OR NEW.reference_arc IS NOT OLD.reference_arc OR NEW.maximum_arc IS NOT OLD.maximum_arc
  OR NEW.policy_version IS NOT OLD.policy_version OR NEW.signed_mandate_id IS NOT OLD.signed_mandate_id
  OR NEW.signing_key IS NOT OLD.signing_key OR OLD.closed_tick IS NOT NULL OR NEW.closed_tick IS NULL
  THEN RAISE(ABORT,'immutable contract history') END;
END;
CREATE TRIGGER player_signed_contracts_no_delete BEFORE DELETE ON player_signed_contracts
 BEGIN SELECT RAISE(ABORT,'immutable contract history'); END;
-- Do not let affiliation-only Admin V1 replace/remove a signed active affiliation.
-- A future trusted signing/closure command must update both within one D1 batch.
CREATE TRIGGER player_signed_affiliation_insert_guard BEFORE INSERT ON player_club_affiliations
WHEN EXISTS(SELECT 1 FROM player_signed_contracts c
 WHERE c.player_id=NEW.player_id AND c.closed_tick IS NULL AND c.club_key<>NEW.club_key)
 BEGIN SELECT RAISE(ABORT,'signed contract affiliation'); END;
CREATE TRIGGER player_signed_affiliation_update_guard BEFORE UPDATE ON player_club_affiliations
WHEN EXISTS(SELECT 1 FROM player_signed_contracts c WHERE c.closed_tick IS NULL
 AND ((c.player_id=OLD.player_id AND NEW.player_id<>OLD.player_id)
 OR (c.player_id=NEW.player_id AND c.club_key<>NEW.club_key)))
 BEGIN SELECT RAISE(ABORT,'signed contract affiliation'); END;
CREATE TRIGGER player_signed_affiliation_delete_guard BEFORE DELETE ON player_club_affiliations
WHEN EXISTS(SELECT 1 FROM player_signed_contracts c WHERE c.player_id=OLD.player_id AND c.closed_tick IS NULL)
 BEGIN SELECT RAISE(ABORT,'signed contract affiliation'); END;
-- Prevent existing sporting reset from silently invalidating contractual time coordinates.
-- #788 must implement an explicit compatible test reset/recovery design before use.
CREATE TRIGGER player_contract_generation_guard BEFORE UPDATE OF generation ON world_state
WHEN OLD.generation<>NEW.generation AND
 (EXISTS(SELECT 1 FROM player_signed_contracts) OR EXISTS(SELECT 1 FROM player_agent_mandates))
 BEGIN SELECT RAISE(ABORT,'contract reset requires reviewed procedure'); END;
