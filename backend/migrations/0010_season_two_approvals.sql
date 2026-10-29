-- Approved Season 2 membership is immutable, archived against the verified source.
-- No implicit transition, no remote D1 migration invocation.
CREATE TABLE IF NOT EXISTS season_two_approvals (
 target_season INTEGER PRIMARY KEY CHECK(target_season=2),
 generation TEXT NOT NULL CHECK(length(generation)=36),
 source_archive_hash TEXT NOT NULL CHECK(length(source_archive_hash)=64),
 snapshot_hash TEXT NOT NULL CHECK(length(snapshot_hash)=64),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND json_type(snapshot_json)='object'),
 approved_by TEXT NOT NULL REFERENCES admin_accounts(id),
 approved_at INTEGER NOT NULL CHECK(approved_at>0)
);
CREATE TRIGGER IF NOT EXISTS season_two_approvals_immutable
BEFORE UPDATE ON season_two_approvals
BEGIN SELECT RAISE(ABORT,'season two approval immutable'); END;
