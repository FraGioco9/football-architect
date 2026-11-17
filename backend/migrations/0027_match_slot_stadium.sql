-- #614: immutable stadium allocation in the published fixture slot.
-- Existing historical slots retain NULL and read via the official catalogue.
-- Do not apply to remote D1 without explicit owner approval.
ALTER TABLE season_match_slots ADD COLUMN stadium_name TEXT
 CHECK (stadium_name IS NULL OR
   (length(trim(stadium_name)) BETWEEN 1 AND 120 AND stadium_name=trim(stadium_name)));
