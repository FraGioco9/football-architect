-- #601: independently published league fixtures; remote D1 remains separately gated.
CREATE TABLE IF NOT EXISTS season_match_slots (
 match_id TEXT PRIMARY KEY NOT NULL CHECK(length(match_id)=35 AND match_id GLOB 'm1_[0-9a-f]*'),
 generation TEXT NOT NULL CHECK(length(generation)=36),
 season_number INTEGER NOT NULL REFERENCES seasons(season_number) ON DELETE RESTRICT,
 competition_id TEXT NOT NULL CHECK(length(competition_id) BETWEEN 3 AND 16),
 phase_id TEXT NOT NULL CHECK(phase_id='league'),
 slot_id TEXT NOT NULL CHECK(length(slot_id) BETWEEN 3 AND 128),
 source_fixture_id TEXT NOT NULL CHECK(length(source_fixture_id) BETWEEN 12 AND 256),
 marker TEXT NOT NULL CHECK(length(marker) BETWEEN 2 AND 32),
 scheduled_day INTEGER NOT NULL CHECK(scheduled_day BETWEEN 1 AND 56),
 round_number INTEGER NOT NULL CHECK(round_number BETWEEN 1 AND 33),
 home_club_id TEXT NOT NULL CHECK(length(home_club_id) BETWEEN 4 AND 16),
 away_club_id TEXT NOT NULL CHECK(length(away_club_id) BETWEEN 4 AND 16),
 source_kind TEXT NOT NULL CHECK(source_kind IN ('calendar','domestic','international')),
 source_hash TEXT NOT NULL CHECK(length(source_hash)=64),
 published_at INTEGER NOT NULL CHECK(published_at>0),
 UNIQUE(season_number,competition_id,phase_id,slot_id),
 UNIQUE(season_number,source_fixture_id),
 CHECK(home_club_id<>away_club_id)
);
CREATE INDEX IF NOT EXISTS match_slots_by_competition ON season_match_slots(season_number,competition_id,scheduled_day,match_id);
CREATE INDEX IF NOT EXISTS match_slots_by_club_home ON season_match_slots(season_number,home_club_id,scheduled_day);
CREATE INDEX IF NOT EXISTS match_slots_by_club_away ON season_match_slots(season_number,away_club_id,scheduled_day);
CREATE TRIGGER IF NOT EXISTS match_slot_immutable BEFORE UPDATE ON season_match_slots
BEGIN SELECT RAISE(ABORT,'published match slot cannot change'); END;
CREATE TRIGGER IF NOT EXISTS match_slot_no_delete BEFORE DELETE ON season_match_slots
WHEN NOT EXISTS (
 SELECT 1 FROM world_state WHERE id=1 AND phase='unstarted' AND season_number=0
 AND revision=0 AND generation<>OLD.generation
)
BEGIN SELECT RAISE(ABORT,'published match slot cannot be deleted outside world reset'); END;
