-- The authenticated reset command rotates the world generation before deleting.
-- A completed milestone may only be deleted after that exact reset transition.
DROP TRIGGER IF EXISTS season_admin_event_no_delete_completed;
CREATE TRIGGER season_admin_event_no_delete_completed
BEFORE DELETE ON season_admin_events
WHEN OLD.status='completed' AND NOT EXISTS (
 SELECT 1 FROM world_state w JOIN seasons s ON s.season_number=OLD.season_number
 WHERE w.id=1 AND w.phase='unstarted' AND w.season_number=0 AND w.day=0
 AND w.revision=0 AND w.generation<>s.generation
)
BEGIN SELECT RAISE(ABORT,'completed event cannot be deleted outside generation reset'); END;
