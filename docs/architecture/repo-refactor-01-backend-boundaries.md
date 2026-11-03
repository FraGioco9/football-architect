# Backend canonical boundaries — R02 working inventory

Baseline: `main@c179b227` (2026-11-03). Implementation branch: `chore/repo-refactor-01-backend`. This is a source-level dependency and responsibility map, **not** a dead-code certification or architectural change authorization.

## Request entrypoints and trust boundaries

| Layer | Existing owner(s) | Responsibility / decision |
|---|---|---|
| Worker ingress | `backend/src/index.ts` | Distinguishes public sporting/world reads, Player, Admin, environment diagnostics and local inbox. Preserve public response headers separately from authenticated responses. |
| Authenticated HTTP | `http-player.ts`, `http-admin.ts`, `account-http.ts` (R03) | Preserve **distinct** Player/Admin route maps, permissions and failure codes; common bounded JSON reader, cookie duplicate policy and private response serialization are implemented in `account-http.ts`. |
| Runtime/environment | `environment-pool.ts`, `origin-policy.ts`, `database.ts` | Validate configured origin/pool and local/preview/production authority before DB operations. Never infer trust from Host or forwarded headers. |
| Identity/auth | `player-auth.ts`, `unified-admin-authorization.ts`, `account-permissions.ts`, `session-repository.ts`, `session-tokens.ts`, `session-policy.ts`, `passwords.ts`, `password-policy.ts`, `password-core.ts` | Player credentials/sessions and unified Admin permission checks are security-sensitive and must not be merged by name similarity alone. |
| Account lifecycle | `player-registration.ts`, `player-password-reset.ts`, `player-account-management.ts`, `player-profile.ts`, `email-identity.ts` | Do not change account state transitions during generic cleanup. |
| Email transports | `cloudflare-email-delivery.ts`, `gmail-email-delivery.ts`, `local-dev-inbox.ts`, `account-email-content.ts` | Provider alternatives are configured by environment; preserve fail-closed production and local inbox restrictions. |
| Command boundaries | `command-contract.ts`, `command-guards.ts`, `commands.ts`, `atomic-guard.ts`, `unified-admin-transaction.ts` | Parse expected revisions and idempotency keys; enforce atomic mutation, audit and concurrency. |
| Season lifecycle | `lifecycle-*.ts`, `season-*-command.ts`, `season-two-*.ts`, `reset-world-command.ts`, `next-season-membership.ts`, `season-snapshot-authority.ts` | Maintain preparation/approval/close/archive semantics, immutable history and world consistency. |
| Calendar/sporting | `admin-calendar-*.ts`, `calendar-command.ts`, `calendar-rules-compat.ts`, `admin-domestic-stage.ts`, `admin-international-draw.ts`, `knockout-progression.ts`, `league-standings.ts` | Single sporting/time authority; keep stage-specific commands distinct until proven identical by contract tests. |
| Read models and storage | `world-repository.ts`, `public-sporting-read.ts`, `public-projections.ts`, `season-archive-read.ts`, `season-archive-summary.ts`, `catalogue-snapshot.ts` | Separate public redacted projections from authorized and historical reads; do not substitute raw tables for public DTOs. |
| Configuration / fixtures | `backend/catalogues/`, `data/`, `assets/world-calendar-model.js` | Catalogues and seasonal snapshots are authority-sensitive; `calendar-rules-compat.ts` intentionally restores legacy markers for validation only. |
| Data migrations | `backend/migrations/0001_world.sql` … `0018_owner_permissions_insert_guards.sql` | Keep migrations append-only, protect triggers, archive and audit rows. A consolidated fresh-DB bootstrap requires separate parity proof. |

## Existing shared domain/front-end pieces to reuse, not duplicate

- `assets/rules-registry.js` and `assets/competition-rules.js`: existing domestic/international rule profiles; validate consumers and version semantics before moving definitions.
- `assets/competition-model.js`, `assets/competition-page.js`, `assets/competition-fixtures.js`, `assets/international-cups.js`: existing shared and specialized competition presenters.
- `assets/world-catalog.mjs`, `assets/authoritative-season.mjs`, `assets/authoritative-calendar.mjs`, `assets/authoritative-history.mjs`: existing identity and authoritative-state boundaries.
- `assets/provider-contract.mjs`, `assets/provider-selectors.mjs`, `assets/routes-registry.mjs`, `assets/subpage-routes.mjs`: existing provider/routing contracts. Browser/Worker formats require explicit compatibility tests; avoid importing DOM-bound modules into Worker code.

## Concrete deduplication already implemented: R03

`http-admin.ts` and `http-player.ts` previously independently implemented the same private JSON security headers, duplicate-cookie rejection and 4096-byte UTF-8 JSON request parser. Both now depend on `account-http.ts`. Differences in business and security authorization remain intact. Focused `node:test` contract `backend/tests/account-http.test.ts` supplements existing Admin and Player runtime coverage.

## Candidate work queue (not proven deletable)

1. **R04:** inventory all calendar/admin command call sites and their idempotency/audit receipts, compare concrete command guards before any factoring. Do not merge versioned state machines on shared naming alone.
2. **R05:** map SQL statements to schema/indexes and local migrations, preserving append-only history; audit query plans before removing or changing repository methods.
3. **R06:** check error/status/header parity for all Player/Admin endpoints, including retries and duplicate-cookie rejection, against targeted runtime tests.
4. **R08–R09:** trace actual generated script loads and provider consumers before centralizing shared competition page state; maintain first-paint and Season 0 semantics.
5. **R13–R14:** classify historical issues and 30 branches by unique commits and active PR bases before proposing closures. Existing active draft PRs #255, #337, #340 and #342 are protected from blind cleanup.

## Validation and restrictions

Use `npm --prefix backend run test:contracts`, relevant `vitest run` groups (Admin/Player HTTP), `npm --prefix backend run typecheck`, and only related browser routes when behavior changes. The existing GitHub workflow may still launch unrelated runs automatically until #341/#342 is accepted; do not confuse a CI trigger with intentional FULL validation. No production deploy, D1 remote mutation, branch deletion, or merge.
