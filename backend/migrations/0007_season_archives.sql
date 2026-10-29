-- Frozen season closure receipt; a season may be archived once, never overwritten.
CREATE TABLE IF NOT EXISTS season_archives (
 season_number INTEGER PRIMARY KEY REFERENCES seasons(season_number) ON DELETE RESTRICT,
 generation TEXT NOT NULL CHECK(length(generation)=36),
 calendar_hash TEXT NOT NULL CHECK(length(calendar_hash)=64),
 results_hash TEXT NOT NULL CHECK(length(results_hash)=64),
 knockout_hash TEXT NOT NULL CHECK(length(knockout_hash)=64),
 archive_hash TEXT NOT NULL CHECK(length(archive_hash)=64),
 results_count INTEGER NOT NULL CHECK(results_count=4082),
 days_count INTEGER NOT NULL CHECK(days_count=56),
 ties_count INTEGER NOT NULL CHECK(ties_count=54),
 created_at INTEGER NOT NULL CHECK(created_at>0)
);
CREATE TRIGGER IF NOT EXISTS season_archive_immutable BEFORE UPDATE ON season_archives BEGIN
 SELECT RAISE(ABORT,'archive is immutable');
END;
CREATE TRIGGER IF NOT EXISTS season_archive_no_delete BEFORE DELETE ON season_archives BEGIN
 SELECT RAISE(ABORT,'archive cannot be deleted');
END;
