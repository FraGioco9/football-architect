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
