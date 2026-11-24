-- #777 Phase B: owner explicitly accepts discarding V1 assignments.
-- No conversion or backfill. Keep all signed terms, mandates, player identities,
-- sporting receipts, ledger and world state. Forward-only; remote approval separate.
DROP TRIGGER player_signed_affiliation_insert_guard;
DROP TRIGGER player_signed_affiliation_update_guard;
DROP TRIGGER player_signed_affiliation_delete_guard;
DROP TABLE player_club_affiliations;
