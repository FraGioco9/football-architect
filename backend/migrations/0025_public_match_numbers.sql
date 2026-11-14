-- Numeric public match IDs persist across season changes and world resets. Never reuse an ID.
-- Keep cryptographic m1_ slot digests as internal source identities.
CREATE TABLE IF NOT EXISTS public_match_numbers (
 id INTEGER PRIMARY KEY AUTOINCREMENT CHECK(id>0),
 slot_match_id TEXT NOT NULL UNIQUE CHECK(length(slot_match_id)=35 AND slot_match_id GLOB 'm1_[0-9a-f]*'),
 generation TEXT NOT NULL CHECK(length(generation)=36),
 season_number INTEGER NOT NULL CHECK(season_number>0)
);
CREATE INDEX IF NOT EXISTS public_match_numbers_by_world ON public_match_numbers(generation,season_number,id);
CREATE TRIGGER IF NOT EXISTS public_match_numbers_immutable BEFORE UPDATE ON public_match_numbers
BEGIN SELECT RAISE(ABORT,'published numeric match identity cannot change'); END;
CREATE TRIGGER IF NOT EXISTS public_match_numbers_no_delete BEFORE DELETE ON public_match_numbers
BEGIN SELECT RAISE(ABORT,'published numeric match identity cannot be reused'); END;

-- Backfill already published V2 slots in deterministic order, across both competition types.
INSERT INTO public_match_numbers(slot_match_id,generation,season_number)
SELECT slot_match_id,generation,season_number FROM (
 SELECT match_id AS slot_match_id,generation,season_number,competition_id,scheduled_day FROM season_match_slots
 UNION ALL
 SELECT match_id AS slot_match_id,generation,season_number,competition_id,scheduled_day FROM season_knockout_match_slots
) ORDER BY season_number,competition_id,scheduled_day,slot_match_id;
