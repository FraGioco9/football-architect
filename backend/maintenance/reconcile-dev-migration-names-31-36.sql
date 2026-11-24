-- MANUAL registry name reconciliation for football-architect-dev only.
-- Do NOT put this in migrations/ or run it before all clients use the renamed files.
-- Requires the exact historical six-row ledger verified on 2026-11-24.
-- No migration bodies, IDs, timestamps or application tables are changed.
UPDATE d1_migrations
SET name=CASE id
 WHEN 32 THEN '0032_portrait_v41_replacement.sql'
 WHEN 33 THEN '0033_season_zero_entrant_approvals.sql'
 WHEN 34 THEN '0034_portrait_v42_replacement.sql'
 WHEN 35 THEN '0035_club_licenses.sql'
 WHEN 36 THEN '0036_player_retirement_seed.sql'
 ELSE name END
WHERE id BETWEEN 32 AND 36
 AND (SELECT COUNT(*) FROM d1_migrations WHERE (id=31 AND name='0031_reset_public_match_numbers.sql') OR
  (id=32 AND name='0031_portrait_v41_replacement.sql') OR
  (id=33 AND name='0032_season_zero_entrant_approvals.sql') OR
  (id=34 AND name='0033_portrait_v42_replacement.sql') OR
  (id=35 AND name='0034_club_licenses.sql') OR
  (id=36 AND name='0035_player_retirement_seed.sql'))=6
 AND NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name IN ('0032_portrait_v41_replacement.sql', '0033_season_zero_entrant_approvals.sql', '0034_portrait_v42_replacement.sql', '0035_club_licenses.sql', '0036_player_retirement_seed.sql'));
