-- #675: permit optimistic world revision changes before the inaugural season.
-- The singleton row and its identity are preserved. No sporting artefacts are created.
CREATE TABLE world_state_season_zero_revision (
 id INTEGER PRIMARY KEY CHECK(id=1),
 schema_version INTEGER NOT NULL DEFAULT 1 CHECK(schema_version=1),
 generation TEXT NOT NULL CHECK(length(generation)=36),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 season_number INTEGER NOT NULL DEFAULT 0 CHECK(season_number>=0),
 day INTEGER NOT NULL DEFAULT 0 CHECK(day BETWEEN 0 AND 56),
 phase TEXT NOT NULL DEFAULT 'unstarted' CHECK(phase IN ('unstarted','preparing','active','closed')),
 CHECK(
   (phase='unstarted' AND season_number=0 AND day=0)
   OR (phase='preparing' AND season_number>0 AND day=0)
   OR (phase='active' AND season_number>0 AND day BETWEEN 1 AND 56)
   OR (phase='closed' AND season_number>0 AND day=56)
 )
);
INSERT INTO world_state_season_zero_revision
 SELECT id,schema_version,generation,revision,season_number,day,phase FROM world_state;
-- Suspend the six existing dependent triggers while replacing the singleton.
-- Reinstall their exact protection predicates below; ordinary writes stay guarded.
DROP TRIGGER IF EXISTS season_archive_no_delete;
DROP TRIGGER IF EXISTS season_admin_event_no_delete_completed;
DROP TRIGGER IF EXISTS season_archive_summary_no_delete;
DROP TRIGGER IF EXISTS match_slot_no_delete;
DROP TRIGGER IF EXISTS knockout_match_slot_no_delete;
DROP TRIGGER IF EXISTS public_match_numbers_no_delete;
DROP TABLE world_state;
ALTER TABLE world_state_season_zero_revision RENAME TO world_state;
CREATE TRIGGER world_cannot_delete BEFORE DELETE ON world_state
 BEGIN SELECT RAISE(ABORT,'world singleton cannot be deleted'); END;

-- Exact, independently approved domestic/international Season 0 scopes.
CREATE TABLE season_zero_approvals (
 scope TEXT PRIMARY KEY NOT NULL CHECK(scope IN ('domestic','international')),
 generation TEXT NOT NULL CHECK(length(generation)=36),
 participants_hash TEXT NOT NULL CHECK(length(participants_hash)=64),
 rules_hash TEXT NOT NULL CHECK(length(rules_hash)=64),
 snapshot_hash TEXT NOT NULL CHECK(length(snapshot_hash)=64),
 receipt_hash TEXT NOT NULL CHECK(length(receipt_hash)=64),
 approved_by TEXT NOT NULL REFERENCES admin_accounts(id),
 approved_at INTEGER NOT NULL CHECK(approved_at>0),
 approved_revision INTEGER NOT NULL CHECK(approved_revision>0)
);
CREATE TRIGGER season_zero_approval_immutable BEFORE UPDATE ON season_zero_approvals
 BEGIN SELECT RAISE(ABORT,'season zero approval is immutable'); END;
CREATE TRIGGER season_zero_approval_no_delete BEFORE DELETE ON season_zero_approvals
 WHEN NOT EXISTS (SELECT 1 FROM world_reset_permits WHERE generation=OLD.generation)
 BEGIN SELECT RAISE(ABORT,'season zero approval requires generation reset'); END;

-- Restore existing immutable/reset guards verbatim from their latest migrations.
CREATE TRIGGER season_archive_no_delete BEFORE DELETE ON season_archives
WHEN NOT EXISTS (
 SELECT 1 FROM world_state
 WHERE id=1 AND phase='unstarted' AND season_number=0 AND day=0
 AND revision=0 AND generation<>OLD.generation
)
BEGIN SELECT RAISE(ABORT,'archive cannot be deleted outside generation reset'); END;
CREATE TRIGGER season_admin_event_no_delete_completed
BEFORE DELETE ON season_admin_events
WHEN OLD.status='completed' AND NOT EXISTS (
 SELECT 1 FROM world_state w JOIN seasons s ON s.season_number=OLD.season_number
 WHERE w.id=1 AND w.phase='unstarted' AND w.season_number=0 AND w.day=0
 AND w.revision=0 AND w.generation<>s.generation
)
BEGIN SELECT RAISE(ABORT,'completed event cannot be deleted outside generation reset'); END;
CREATE TRIGGER season_archive_summary_no_delete BEFORE DELETE ON season_archive_summaries
WHEN NOT EXISTS (SELECT 1 FROM world_state w JOIN seasons s ON s.season_number=OLD.season_number
 WHERE w.id=1 AND w.phase='unstarted' AND w.season_number=0 AND w.day=0 AND w.revision=0 AND w.generation<>s.generation)
BEGIN SELECT RAISE(ABORT,'archive summary cannot be deleted outside generation reset'); END;
CREATE TRIGGER match_slot_no_delete BEFORE DELETE ON season_match_slots
WHEN NOT EXISTS (
 SELECT 1 FROM world_state WHERE id=1 AND phase='unstarted' AND season_number=0
 AND revision=0 AND generation<>OLD.generation
)
BEGIN SELECT RAISE(ABORT,'published match slot cannot be deleted outside world reset'); END;
CREATE TRIGGER knockout_match_slot_no_delete BEFORE DELETE ON season_knockout_match_slots
WHEN NOT EXISTS (
 SELECT 1 FROM world_state WHERE id=1 AND phase='unstarted' AND season_number=0
 AND revision=0 AND generation<>OLD.generation
)
BEGIN SELECT RAISE(ABORT,'knockout match slot cannot be deleted outside world reset'); END;
CREATE TRIGGER public_match_numbers_no_delete BEFORE DELETE ON public_match_numbers
WHEN NOT EXISTS (
 SELECT 1 FROM world_reset_permits AS permit
 JOIN world_state AS world ON world.id=1
 WHERE permit.generation <> world.generation
)
BEGIN SELECT RAISE(ABORT,'published numeric match identity cannot be reused'); END;
