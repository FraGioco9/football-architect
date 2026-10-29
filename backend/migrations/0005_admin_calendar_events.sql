-- ADMIN-WORLD-01: season-owned placement of discrete administrative milestones.
-- Schema only; no remote D1 operation or enabled administrative mutation route.
CREATE TABLE IF NOT EXISTS season_admin_events (
 season_number INTEGER NOT NULL REFERENCES seasons(season_number) ON DELETE RESTRICT,
 event_id TEXT NOT NULL CHECK(length(event_id) BETWEEN 3 AND 120),
 kind TEXT NOT NULL CHECK(kind IN (
  'confirm-domestic-entrants','confirm-international-entrants',
  'generate-domestic-calendar','draw-international','generate-international-calendar')),
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
CREATE TRIGGER IF NOT EXISTS season_admin_event_no_retroactive_update
BEFORE UPDATE ON season_admin_events
WHEN OLD.status='completed' OR NEW.season_number<>OLD.season_number
 OR NEW.event_id<>OLD.event_id OR NEW.kind<>OLD.kind OR NEW.scope<>OLD.scope
 OR NEW.created_at<>OLD.created_at
BEGIN SELECT RAISE(ABORT,'administrative event identity or completed event is immutable'); END;
CREATE TRIGGER IF NOT EXISTS season_admin_event_no_delete_completed
BEFORE DELETE ON season_admin_events WHEN OLD.status='completed'
BEGIN SELECT RAISE(ABORT,'completed administrative event is immutable'); END;
