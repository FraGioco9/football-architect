# BE-03 — D1 repository and transaction inventory

> **Living contract — REPO-04 #358, 2026-11-06.** The current section describes reviewed repository source at `main@f9b595636d02d4a1ebfdbd967e1a97c18f2dd41d`. Dates, SHA baselines, Draft/HOLD labels and gates in the following original record are **historical evidence**, not today's release state. No merge/deploy/remote D1 authorization is implied.

## Current D1 persistence and transaction authority

`backend/wrangler.toml` is **local-only**, with reserved local DB binding; `backend/migrations/` contains the schema sequence (18 SQL migrations at this review). `world-repository.ts` and related read repositories preserve world state, sporting data, revisions, archives, sessions and idempotency receipts. Pure sporting policy and write transaction guards remain distinct. **Read-side multi-statement queries do not automatically become snapshot-isolated transactions**; preserve the recorded concurrency limitations. Never rewrite historical migrations, original SQL identifiers, receipt hashes or archived snapshots for documentation clarity. Migration/recovery commands against *remote* D1 require independent authorization. [Lifecycle](docs-season-lifecycle-be-04.md), [Auth](docs-auth-security-be-05.md), [HTTP](docs-http-contracts-be-02.md). Historical BE-03 review SHAs and prior CI evidence below are dated, not exact-head proof for the current commit.

## Historical implementation audit (retained)

Baseline: `9a0d440a90845d899fd812b105fc16d010cd5317` (2026-11-05). Scope: read-side persistence consolidation; no sporting rules, lifecycle commands, remote data, secrets or historical migration edits.

## Dependency / ownership

- #359: issue closed 2026-11-04 and approved PRs #378 and #381 squash-merged into main. The issue's P01–P23 audit checkboxes are not all marked verified; closure is not a blanket browser certification. BE-03 touches no UI files. The CI test ownership manifest retains all newly integrated #359 test entries.
- #351 (BE-04) is now merged into this baseline, and owns lifecycle command/policy changes. BE-03 does **not** change `src/*-command.ts`, `admin-calendar-advance-plan.ts`, D1 write ordering, lifecycle invariants or command idempotency logic. New terminal milestone policy/tests are retained.
- #354 shared competition rendering and #380 local development entrypoints are now merged into this baseline. Both are unaffected, and their CI test registrations are retained.
- No domain-to-storage contract additions; the extracted methods preserve result shapes and existing service-level error/status behavior.

## Schema, indexes and migrations (read-only inventory)

Migrations `0001`–`0018` are append-only; none changed here. Primary keys, constraints, triggers and existing secondary indexes stay intact.

| Migration group | Tables | Notable keys / guards |
| --- | --- | --- |
| 0001 | world_state, seasons, admin_accounts, admin_sessions, auth_throttles, admin_operations | Singleton world + deletion guard; season snapshot immutability; `admin_operations(generation,idempotency_key)` UNIQUE; admin-session/account and throttle-expiry indexes |
| 0002–0004 | season_calendars, season_draws, season_day_outcomes, season_knockout_ties | Season-scoped PKs; generated schedule/draw and finalized outcome/tie immutability |
| 0005, 0011 | season_admin_events (recreated/extended by 0011) | PK (season_number,event_id), day/order uniqueness, immutable completed events |
| 0006 | season_domestic_stages | Season-scoped stage snapshots and immutable evidence |
| 0007–0009 | season_archives, reset guards | Immutable archives, deletion guards and reset-specific restrictions |
| 0010 | season_two_approvals | Owner approval snapshot and immutable authorization evidence |
| 0012 | season_archive_summaries | Season PK, hash-bearing summary, immutable history / generation reset boundary |
| 0013–0016 | player_accounts, player_sessions, player_one_time_tokens, player_auth_throttles, account_permissions, player_admin_operator_links, profile fields | Token digest PKs, account/expiry/permission indexes, environment-separated player identity |
| 0017–0018 | account_environment_pool, account_permission_events | Immutable environment pool and audit receipt rows; INSERT/REPLACE guards |

Secondary indexes inspected: `sessions_by_account`, `throttles_by_expiry`, `player_sessions_by_account`, `player_sessions_by_expiry`, `player_tokens_by_account_purpose`, `player_throttles_by_expiry`, `account_permissions_by_permission`, `player_accounts_username_unique`. No new index/migration is justified by the extracted reads.

## SQL consumers and consolidation

| Table(s) | Original query owners / callers | BE-03 result |
| --- | --- | --- |
| season_day_outcomes | `public-sporting-read`, `season-two-candidate-read`; command-specific reads in `lifecycle-command`, `season-archive-command` | One typed, parameterized `readSeasonDayOutcomes` for the first two; command-specific snapshots remain command-owned |
| season_knockout_ties | Same read consumers; transaction-specific snapshot/guard paths | One typed, parameterized `readSeasonKnockoutTies`; preserves key order |
| season_calendars, season_day_outcomes COUNT | `public-sporting-read`, `admin-calendar-read` and command guards | Common calendar-hash / day-count read for public projection; distinct authoritative count-and-CAS guards unchanged |
| season_archive_summaries, season_admin_events closing receipt | `public-sporting-read`, `season-archive-read` | Same parameterized row shape and query for published-history checks; independent hash validation retained |
| season_admin_events listing | Two paths in `admin-calendar-read` | A private shared SQL helper, no extra world read or change to authorization |
| world_state | `world-repository`, `command-guards`, command CAS checks | Distinct read validation vs atomic write preconditions deliberately preserved |
| admin/player auth, permission and session tables | `auth`, `player-auth`, `account-permissions`, `session-repository`, unified admin guard | Kept distinct: legacy and player flows have different security/credential semantics |
| seasons, draws, stages, approvals | `season-sporting-evidence`, `season-snapshot-authority`, seasonal command guards | No false abstraction across immutable sporting receipts vs transactional predicates |

The extracted repository is a **read-only** SQL adapter. It never verifies a result on its own. Callers still enforce stored hashes, generation, revision, expected number of results, closure receipts and public/private source policy. No query switches from stored data to generated fallback. Prepared statements replace the previous numeric string interpolation on the public read path, without changing accepted season values.

## Transaction, concurrency and idempotency boundaries

- Writes remain in **single D1 batches** with the same `abortUnless` and world generation/revision compare-and-swap checks. Guard failures abort the batch rather than returning success after partial mutation.
- The `admin_operations` unique `(generation,idempotency_key)` guard and prior actor/request-hash replay contract are unchanged; caller still re-authenticates on replay.
- Neither `abortUnless` nor authorization preconditions are generalized: cross-table timing, changed principals, and receipt integrity need their exact command-specific predicates.
- Read-only projections use multiple statements, not a snapshot transaction. They validate hashes and world revision on exit. Potential race during long historical reads remains a documented existing design concern; a new read transaction interface would require explicit contract agreement with #351.
- Completed day receipts, knockout tie plans, season archive summaries, permission events and historic approval rows remain immutable. Existing reset is a tightly guarded command; the extraction never invokes it.
- Security-sensitive session refresh and auth-throttle mutations retain their existing independent boundaries; coalescing them with sporting writes would change security semantics.

## Local-only query plan evidence

SQLite `EXPLAIN QUERY PLAN` over matching table/PK DDL confirms:

| Query | Observed access path |
| --- | --- |
| day receipts by season ordered by day | `sqlite_autoindex_season_day_outcomes_1` |
| knockout ties by season ordered by competition/phase/tie | `sqlite_autoindex_season_knockout_ties_1` |
| calendar hash, archived season summary by season | INTEGER PRIMARY KEY |
| day receipt COUNT by season | covering composite PK index |
| season close receipt by season/event | `sqlite_autoindex_season_admin_events_1` |

None required a temporary ORDER BY B-tree in the preliminary local SQLite check. The new `d1-repositories-runtime.test.ts` executed on an ephemeral Cloudflare D1/Miniflare test binding in GitHub Actions on prior BE-03 HEADs, and passed its query-plan, season isolation, migration and rollback assertions. The current rebased commit still requires its own exact-head evidence.

## QA / review gate

Executed in this environment:
- Standalone SQLite query-plan checks for all six repository read shapes: indexed lookups, no additional index indicated.
- Node 22 type-stripping import + mock adapter check for all six repository methods: PASS.

Previous BE-03 HEADs `f3f2080f950af8881c35624651e5f2dd313a078b` and `623425f500a6b4b462d0f3060981f30b9bbda8ba`: GitHub Actions Site, Browser, Admin and FULL gate all completed **PASS**. Admin evidence included TypeScript typecheck, 86 Node contracts, 44 Python migrations, 247/247 Miniflare/Worker/D1 tests across 40 files (new repository D1 4/4 PASS), local operator persistence and a two-season Worker/D1 browser lifecycle. These tests ran on disposable local runner DBs, never remote databases. This historical evidence does **not** certify the freshly rebased HEAD; check exact-head results before review.

Run once on the exact pushed commit from a full checkout:

```powershell
npm --prefix backend ci
npm --prefix backend run typecheck
npm --prefix backend run test:contracts
npm --prefix backend run test -- tests/d1-repositories-runtime.test.ts tests/d1-integration.test.ts tests/public-sporting-runtime.test.ts tests/season-two-persistence-runtime.test.ts tests/season-two-authority-runtime.test.ts tests/season-two-activation-runtime.test.ts tests/admin-calendar-clock-runtime.test.ts
```

Then record exact-head status, any failures, and the final BE-03 review decision. Owner has separately authorized the BE-03 squash merge **only after exact-head CI is green and main is verified**. The authorization does not cover deploy, remote D1 access, secrets or other cleanup.
