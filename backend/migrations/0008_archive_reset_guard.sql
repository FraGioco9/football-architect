-- Reset-compatible immutable archives. Normal updates/deletes remain prohibited.
-- A future authenticated Season-0 reset must atomically rotate the world
-- generation, set unstarted/revision0 and only then purge old-generation rows.
-- D1 batch rollback protects the whole transition on any failed statement.
DROP TRIGGER IF EXISTS season_archive_no_delete;
CREATE TRIGGER season_archive_no_delete BEFORE DELETE ON season_archives
WHEN NOT EXISTS (
 SELECT 1 FROM world_state
 WHERE id=1 AND phase='unstarted' AND season_number=0 AND day=0
 AND revision=0 AND generation<>OLD.generation
)
BEGIN SELECT RAISE(ABORT,'archive cannot be deleted outside generation reset'); END;
