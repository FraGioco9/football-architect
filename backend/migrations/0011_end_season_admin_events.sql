-- ADMIN-WORLD-02 #327: widen the existing event kind constraint, preserving legacy rows.
-- SQLite does not support ALTER CHECK; rebuild this table in-place rather than
-- adding a parallel scheduler. Applying this migration is local/CI only for now.
CREATE TABLE season_admin_events_extended (
 season_number INTEGER NOT NULL REFERENCES seasons(season_number) ON DELETE RESTRICT,
 event_id TEXT NOT NULL CHECK(length(event_id) BETWEEN 3 AND 120),
 kind TEXT NOT NULL CHECK(kind IN (
  'confirm-domestic-entrants','confirm-international-entrants',
  'generate-domestic-calendar','draw-international','generate-international-calendar',
  'archive-season','close-season','prepare-next-season')),
 scope TEXT NOT NULL CHECK(length(scope) BETWEEN 2 AND 64),
 scheduled_day INTEGER NOT NULL CHECK(scheduled_day BETWEEN 1 AND 56),
 event_order INTEGER NOT NULL CHECK(event_order BETWEEN 0 AND 9999),
 status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed')),
 completed_at INTEGER CHECK(completed_at > 0),
 receipt_hash TEXT CHECK(length(receipt_hash)=64),
 created_at INTEGER NOT NULL CHECK(created_at > 0),
 PRIMARY KEY(season_number,event_id),
 UNIQUE(season_number,scheduled_day,event_order),
 UNIQUE(season_number,scope,kind),
 CHECK((status='scheduled' AND completed_at IS NULL AND receipt_hash IS NULL)
    OR (status='completed' AND completed_at IS NOT NULL AND receipt_hash IS NOT NULL))
);
INSERT INTO season_admin_events_extended
 (season_number,event_id,kind,scope,scheduled_day,event_order,status,completed_at,receipt_hash,created_at)
 SELECT season_number,event_id,kind,scope,scheduled_day,event_order,status,completed_at,receipt_hash,created_at
 FROM season_admin_events;
DROP TABLE season_admin_events;
ALTER TABLE season_admin_events_extended RENAME TO season_admin_events;

CREATE TRIGGER IF NOT EXISTS season_admin_event_no_retroactive_update
BEFORE UPDATE ON season_admin_events
WHEN OLD.status='completed' OR NEW.season_number<>OLD.season_number
 OR NEW.event_id<>OLD.event_id OR NEW.kind<>OLD.kind OR NEW.scope<>OLD.scope
 OR NEW.created_at<>OLD.created_at
BEGIN SELECT RAISE(ABORT,'administrative event identity or completed event is immutable'); END;

CREATE TRIGGER season_admin_event_no_delete_completed
BEFORE DELETE ON season_admin_events
WHEN OLD.status='completed' AND NOT EXISTS (
 SELECT 1 FROM world_state w JOIN seasons s ON s.season_number=OLD.season_number
 WHERE w.id=1 AND w.phase='unstarted' AND w.season_number=0 AND w.day=0
 AND w.revision=0 AND w.generation<>s.generation
)
BEGIN SELECT RAISE(ABORT,'completed event cannot be deleted outside generation reset'); END;
