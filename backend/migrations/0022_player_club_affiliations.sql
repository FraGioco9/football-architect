-- #509 V1: current player-to-club affiliation only. No dates, salary or history.
-- Forward-only, local-first migration; never deploy or migrate remote D1 implicitly.
-- Existing persisted players remain unassigned: no backfill or generator changes.
-- Canonical club-key membership (all 320 clubs, active or inactive) is validated
-- by the future authorized write API against the club manifest, not by this SQL.
CREATE TABLE player_club_affiliations (
 player_id INTEGER NOT NULL CHECK(player_id > 0)
  REFERENCES generated_players(id) ON DELETE CASCADE,
 club_key TEXT NOT NULL CHECK(length(trim(club_key)) > 0),
 PRIMARY KEY(player_id)
) WITHOUT ROWID;
-- Unpaginated roster lookup ordered by stable numeric player ID.
CREATE INDEX player_club_affiliations_club_player
 ON player_club_affiliations(club_key, player_id);
