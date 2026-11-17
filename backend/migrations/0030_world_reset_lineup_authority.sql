-- #613: no ordinary update/delete of immutable V2 match and day receipts.
-- Explicit authenticated RESET SEASON 0 is the sole permitted destructive
-- transaction, authorized by a short-lived, same-batch generation-scoped permit.
CREATE TABLE IF NOT EXISTS world_reset_permits (
 generation TEXT PRIMARY KEY NOT NULL CHECK(length(generation)=36),
 operation_id TEXT NOT NULL CHECK(length(operation_id)=36)
);
DROP TRIGGER IF EXISTS match_lineup_receipts_no_delete;
CREATE TRIGGER match_lineup_receipts_no_delete
 BEFORE DELETE ON match_lineup_result_receipts
 WHEN NOT EXISTS (SELECT 1 FROM world_reset_permits
                  WHERE generation=OLD.generation)
 BEGIN SELECT RAISE(ABORT,'finalized match receipt cannot be deleted'); END;
DROP TRIGGER IF EXISTS season_lineup_day_outcomes_no_delete;
CREATE TRIGGER season_lineup_day_outcomes_no_delete
 BEFORE DELETE ON season_lineup_day_outcomes
 WHEN NOT EXISTS (SELECT 1 FROM world_reset_permits
                  WHERE generation=OLD.generation)
 BEGIN SELECT RAISE(ABORT,'finalized lineup day cannot be deleted'); END;
