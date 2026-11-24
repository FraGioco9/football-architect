# Migration numbering correction (31–36)

The canonical order follows the observed shared DEV D1 ledger. The duplicate 0031 prefix is historical. Migration SQL blobs are unchanged; only filenames and live references are renamed.

| ID | Historical filename | Canonical filename |
| --- | --- | --- |
| 31 | 0031_reset_public_match_numbers.sql | unchanged |
| 32 | 0031_portrait_v41_replacement.sql | 0032_portrait_v41_replacement.sql |
| 33 | 0032_season_zero_entrant_approvals.sql | 0033_season_zero_entrant_approvals.sql |
| 34 | 0033_portrait_v42_replacement.sql | 0034_portrait_v42_replacement.sql |
| 35 | 0034_club_licenses.sql | 0035_club_licenses.sql |
| 36 | 0035_player_retirement_seed.sql | 0036_player_retirement_seed.sql |

## Shared DEV cutover — manual, owner-authorized only

On 2026-11-24, retirement migration ID 36 was applied and registered under its then-canonical filename `0035_player_retirement_seed.sql`. Verified 150/150 players with valid distinct seeds and no foreign-key violations. Until this renumbering is merged, the existing database registry remains aligned with the existing main filenames.

Do not run Wrangler migration apply across the rename boundary. Pause migration runners, verify all six exact historic rows using `SELECT id,name,applied_at FROM d1_migrations WHERE id>=31 ORDER BY id`, and verify the correct DEV database and a recovery point. After the renamed files are integrated and clients synchronized, run the explicitly guarded manual script `backend/maintenance/reconcile-dev-migration-names-31-36.sql`. It changes names only, not IDs, timestamps or application data. Expect five changed rows on the first run and zero on replay. Re-query the ledger; verify IDs 31–36 match the canonical names, no pending old migrations and all 150 existing retirement seeds remain valid (or updated total if players were created meanwhile). Never run the historical migration bodies again. Do not apply this script against Production.

For any other existing local/remote database, inspect its actual ledger first; some fresh installations may have executed the duplicate 0031 filenames in the opposite lexical order. Reconcile by verified historical **filename**, preserving IDs and applied timestamps, rather than blindly applying the DEV-specific script. New isolated databases use the new sequential filenames directly. Do not rewrite unrelated migration history or reset databases.
