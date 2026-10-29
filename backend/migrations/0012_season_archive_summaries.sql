-- Immutable derived history, separately from source result receipts.
CREATE TABLE IF NOT EXISTS season_archive_summaries (
 season_number INTEGER PRIMARY KEY REFERENCES seasons(season_number) ON DELETE RESTRICT,
 generation TEXT NOT NULL CHECK(length(generation)=36),
 archive_hash TEXT NOT NULL CHECK(length(archive_hash)=64),
 summary_hash TEXT NOT NULL CHECK(length(summary_hash)=64),
 summary_json TEXT NOT NULL CHECK(json_valid(summary_json)),
 created_at INTEGER NOT NULL CHECK(created_at>0)
);
CREATE TRIGGER season_archive_summary_immutable BEFORE UPDATE ON season_archive_summaries
BEGIN SELECT RAISE(ABORT,'archive summary is immutable'); END;
CREATE TRIGGER season_archive_summary_no_delete BEFORE DELETE ON season_archive_summaries
WHEN NOT EXISTS (SELECT 1 FROM world_state w JOIN seasons s ON s.season_number=OLD.season_number
 WHERE w.id=1 AND w.phase='unstarted' AND w.season_number=0 AND w.day=0 AND w.revision=0 AND w.generation<>s.generation)
BEGIN SELECT RAISE(ABORT,'archive summary cannot be deleted outside generation reset'); END;
