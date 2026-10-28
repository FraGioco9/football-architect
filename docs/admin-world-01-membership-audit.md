# ADMIN-WORLD-01 membership consumer audit — 28 October 2026

The audit covers repository-wide references to `clubIds`, the retired provisional file, and assignment readers. The sole stored initial selection is `backend/catalogues/season-1.participants.json`. It approves participants only; no production rules/hash/manifest approval is inferred.

| Boundary | Final source and behavior |
| --- | --- |
| Permanent division JSON and CSV | Removed the empty `clubIds` property/column from all 16 definitions. Identity, names, capacity, artwork and full canonical rules preserved. |
| Club and international catalogues | All 320 club identities and both cup definitions preserved; no assignments added. |
| `load-season-one-preview.mjs` | Reads and validates all 18 Season 1 selections, projects numeric domestic lists in memory with `approved:false`. No persisted duplicate lists. |
| `load-world-catalog.mjs`, `validate-provisional-allocations.mjs` | Consume the seasonal projection; enforce permanent membership absence and the 256 active/64 inactive identity partition. The validator name describes preview authority, not a second file source. |
| `assets/world-catalog.mjs` | Existing immutable provisional lookup API consumes that projection; no file loading or current-world authority. |
| `generate-app-pages.mjs`, `generate-club-pages.mjs` | Build domestic standings placeholders and club placement from the same projected selection; routes and UI remain stable. Generated competition/club manifests remain unapproved. |
| `competition-catalogue.mjs`, Rules Registry | Read permanent rules and identity, independent of membership. Canonical rule data remains separate from JavaScript validation/derivation engines. |
| `assets/competition-model.js` | Preview provenance points to the seasonal input; no runtime fetch of private backend sources. Existing public preview validation stays fail closed. |
| `assets/app-search.js` | Accepts permanent divisions without membership; rejects injected `clubIds`. |
| Backend selection/snapshot validation | Shared pure selection engine checks exact Season 1 ranges. Season 1 complete gate additionally checks server-owned identity/full-rule versions, immutable manifest and independent hashes. Generic season gate permits disjoint tier transitions and checks cup membership against that season's domestic participants. |
| Other retained `clubIds` | Snapshot participant sets, the club identity index, transient preview projections and two-club postseason ties. These are not permanent division assignments. |
| Tests | CSV parity, canonical key sets, catalogue/page/DEV baseline readers migrated; direct legacy-file readers removed. Selection/canonical-rule/hash, malformed input, cross-tier changes, search and publication regressions retained or added. |
| Documentation | README, initial allocation guide, configurable-page source table and operations runbook migrated. The retired file remains available only in Git history. |
| Debug Settings | Configuration in `tools/dev-debug-config.mjs` has no authoritative-data dependency. Local DEV serves it under a protected namespace; protected artifact bundles its bytes into the existing client. Public output omits it. sessionStorage, controls and independent publication verifier preserved. |

No consumers read `data/division-allocations.provisional.json` after migration. It was deleted after the migrated selection/catalogue/page suite passed before and after removal. Public source lists expose only unapproved presentation projections; fictional scores never become approvals. D1 remains the authoritative runtime world/snapshot source; later seasons require certified sporting outcomes, and `data/history/` is export-only.

The production loader remains null. Independent production approval of full rules, hashes and a complete immutable manifest is still required. No workflow, publication guard, routing, authorization, anti-deploy policy or remote resources changed. PR #316 stays Draft/HOLD, #315 stays 5/20 with the same 20 original entries.
