-- #613: forward-only, local-first proposal. NEVER run against remote D1 without approval.
-- Immutable generation+season authority selection; survives world reset as audit history.
-- New lineage must be pinned before the first day; never rewrite existing score-only seasons.
-- Does NOT enable lineup results: season_day_outcomes v1 remains legacy-only until
-- a separate versioned v2 daily evidence migration and reader/cutover are authorized.
CREATE TABLE IF NOT EXISTS season_result_authorities (
 generation TEXT NOT NULL CHECK(length(generation)=36),
 season_number INTEGER NOT NULL CHECK(season_number>0),
 simulation_version TEXT NOT NULL CHECK(simulation_version='temporary-lineup-v1'),
 pinned_at INTEGER NOT NULL CHECK(pinned_at>0),
 PRIMARY KEY(generation,season_number)
) WITHOUT ROWID;

CREATE TRIGGER IF NOT EXISTS season_result_authorities_preflight
 BEFORE INSERT ON season_result_authorities
 BEGIN
  SELECT RAISE(ABORT,'simulation authority can only be pinned to a new preparing season')
   WHERE NOT EXISTS(SELECT 1 FROM world_state
    WHERE id=1 AND generation=NEW.generation AND season_number=NEW.season_number
      AND phase='preparing' AND day=0);
  SELECT RAISE(ABORT,'simulation authority needs an approved season snapshot')
   WHERE NOT EXISTS(SELECT 1 FROM seasons
    WHERE generation=NEW.generation AND season_number=NEW.season_number);
  SELECT RAISE(ABORT,'simulation authority cannot change existing daily results')
   WHERE EXISTS(SELECT 1 FROM season_day_outcomes WHERE season_number=NEW.season_number);
  SELECT RAISE(ABORT,'simulation authority cannot change existing match results')
   WHERE EXISTS(SELECT 1 FROM match_lineup_result_receipts
    WHERE generation=NEW.generation AND season_number=NEW.season_number);
 END;

CREATE TRIGGER IF NOT EXISTS season_result_authorities_no_update
 BEFORE UPDATE ON season_result_authorities
 BEGIN SELECT RAISE(ABORT,'season simulation authority is immutable'); END;
CREATE TRIGGER IF NOT EXISTS season_result_authorities_no_delete
 BEFORE DELETE ON season_result_authorities
 BEGIN SELECT RAISE(ABORT,'season simulation authority is permanent historical evidence'); END;
