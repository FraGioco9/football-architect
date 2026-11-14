-- Immutable knockout reservations are separate from final score/tie evidence.
CREATE TABLE IF NOT EXISTS season_knockout_match_slots (
 match_id TEXT PRIMARY KEY CHECK(length(match_id)=35 AND match_id GLOB 'm1_[0-9a-f]*'),
 generation TEXT NOT NULL CHECK(length(generation)=36),
 season_number INTEGER NOT NULL REFERENCES seasons(season_number) ON DELETE RESTRICT,
 competition_id TEXT NOT NULL CHECK(length(competition_id) BETWEEN 3 AND 16),
 phase_id TEXT NOT NULL CHECK(length(phase_id) BETWEEN 2 AND 64),
 tie_id TEXT NOT NULL CHECK(length(tie_id) BETWEEN 1 AND 64),
 leg INTEGER NOT NULL CHECK(leg IN (1,2)),
 slot_id TEXT NOT NULL CHECK(length(slot_id) BETWEEN 3 AND 128),
 marker TEXT NOT NULL CHECK(length(marker) BETWEEN 2 AND 32),
 scheduled_day INTEGER NOT NULL CHECK(scheduled_day BETWEEN 1 AND 56),
 round_number INTEGER CHECK(round_number BETWEEN 1 AND 33),
 home_policy TEXT NOT NULL CHECK(home_policy IN ('higherOriginalTableRank','neutral')),
 rules_version TEXT NOT NULL CHECK(length(rules_version) BETWEEN 3 AND 128),
 participant_a_json TEXT NOT NULL CHECK(json_valid(participant_a_json) AND json_type(participant_a_json)='object'),
 participant_b_json TEXT NOT NULL CHECK(json_valid(participant_b_json) AND json_type(participant_b_json)='object'),
 source_kind TEXT NOT NULL CHECK(source_kind IN ('calendar','domestic','international')),
 source_hash TEXT NOT NULL CHECK(length(source_hash)=64),
 published_at INTEGER NOT NULL CHECK(published_at>0),
 UNIQUE(season_number,competition_id,phase_id,tie_id,leg),
 UNIQUE(season_number,competition_id,phase_id,slot_id)
);
CREATE INDEX IF NOT EXISTS knockout_match_slots_by_competition
 ON season_knockout_match_slots(season_number,competition_id,scheduled_day,match_id);
CREATE TRIGGER IF NOT EXISTS knockout_match_slot_immutable BEFORE UPDATE ON season_knockout_match_slots
BEGIN SELECT RAISE(ABORT,'published knockout match slot cannot change'); END;
CREATE TRIGGER IF NOT EXISTS knockout_match_slot_no_delete BEFORE DELETE ON season_knockout_match_slots
WHEN NOT EXISTS (
 SELECT 1 FROM world_state WHERE id=1 AND phase='unstarted' AND season_number=0
 AND revision=0 AND generation<>OLD.generation
)
BEGIN SELECT RAISE(ABORT,'knockout match slot cannot be deleted outside world reset'); END;
