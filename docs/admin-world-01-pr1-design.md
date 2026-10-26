# ADMIN-WORLD-01 — PR 1 technical design (Draft / HOLD)

Issue: #315. Baseline: `74cd993d4434a7fb696d3e754b7da0f2f157198e`.

## Decision and boundaries

Use **Cloudflare Workers + D1 (SQLite)** for a single persistent shared world. Retain the existing static site, generated routes, canonical catalogues, Rules Registry and publication guard. The existing loopback-only DEV server, fictional provider, DEV clock and session storage are not authoritative game data. Do not ship Worker source, migrations, credentials or debug modules in the static publication artifact. No deploy, remote D1 operation, migration execution, or production credentials are authorized.

This document is design-only. No implementation checkbox in #315 is complete merely because this document exists.

## Repo integration evidence

- `tools/generate-app-pages.mjs` owns generated HTML; edit its templates/source modules, not generated output by hand.
- `tools/publication-guard.mjs` is a fail-closed static artifact allowlist. Worker/backend paths must remain outside it.
- `tools/dev-standings-preview.mjs` is a loopback-only fictional preview and must remain independent.
- `assets/competition-model.js` marks domestic allocations provisional and not approved. The production prepare command must fail closed until canonical participants/rules are approved.
- `assets/routes-registry.mjs` exposes canonical route parsing; public read adapters should preserve routes and viewed-season independence.
- Existing Node 22 tests and Chromium checks remain mandatory, along with generator parity.

## Proposed repository structure (not yet implemented)

```text
backend/
  src/index.ts                 # Worker request router
  src/auth.ts                  # Admin session verification, CSRF and origin checks
  src/commands.ts              # Versioned command envelope and structured errors
  src/world-repository.ts      # D1 conditional mutation / transaction boundary
  src/public-projections.ts    # Versioned read-only public world contract
  src/catalogue-snapshot.ts    # Canonical approved participant/rules binding
  migrations/0001_world.sql    # Local-first schema
  tests/                      # Worker/D1 local integration tests
  wrangler.toml                # Local config; no secrets or deploy binding
```

## Persistence model v1

- `world_state`: exactly one row, fixed `id=1`, `generation` (opaque non-reused identifier), monotonically increasing `revision`, `season_number=0`, `day=0`, `phase='unstarted'`, `schema_version`, `updated_at`.
- `seasons`: unique season number, `preparing|active|closed` lifecycle, immutable catalogue/rules snapshot hash and version, creation/closure metadata.
- `admin_operations`: unique `(generation, idempotency_key)`, actor, command type, canonical request hash, expected revision, status, resulting revision, timestamp and sanitized response/error. Do not retain deleted sporting payloads after reset.
- `admin_sessions`: opaque hashed session identifiers, expiry, revocation, administrator subject. Use HttpOnly Secure SameSite cookies, CSRF protection and server-side verification. Production credential bootstrap and recovery require a separately reviewed mechanism.
- Future PR 2: fixtures, draws, outcomes and projections keyed to season/generation, with versioned provenance and reproducibility metadata.

Use foreign keys, uniqueness and CHECK constraints. Canonical identity assets and rule definitions remain source-controlled, not season-owned rows. Never use localStorage as authority.

## API contract (proposed)

- `GET /api/world`: anonymous, validated, versioned projection; no admin secrets, `Cache-Control: no-store` initially.
- `GET /api/admin/world`: authenticated state and safe operation summary.
- `POST /api/admin/seasons/prepare`: authenticated, CSRF-protected, requires `expectedGeneration`, `expectedRevision`, `Idempotency-Key`, approved participant/rules snapshots. In Season 0, creates Season 1 in preparing state, but does not start or fabricate results.
- Errors: 400 invalid input, 401 unauthenticated, 403 unauthorized, 409 stale revision/conflicting idempotency key, 422 missing approved prerequisites, 503 unavailable storage; no partial sporting writes.

## D1 atomicity and concurrency

Do not assume multiple HTTP requests or a read followed by a write are transactional. For each command, use D1-supported atomic SQL/batch semantics and a conditional world-row compare-and-swap on `generation` and `revision`. If the conditional update affects zero rows, reject the command without exposing changes. Persist the idempotency record, season mutation and world revision together; prove rollback on failure with local D1 tests. Duplicate keys with the same canonical request return the stored outcome; mismatched payloads are rejected. Verify actual D1 behavior before choosing a final statement/batch layout; do not claim serializable isolation without evidence.

The world generation is replaced on full reset (PR 3), so pre-reset commands cannot target a new Season 0 even if a numeric revision repeats. Browser responses must compare generation/revision and discard stale data.

## Lifecycle and authority

Season 0 is real and unstarted, with no seasons, fixtures, results or archives. A prepared season is not active. Starting requires all approved calendars/draws and prerequisites. Day advancement cannot invent played matches; result authority (manual entry vs future engine), finalization, and which scheduled activities are implemented must be resolved before PR 2. Preserve the approved 56-day world calendar and competition-owned events. Viewed Season is a read selector, never a world-clock mutation.

## PR 1 acceptance gates

1. Local D1 migration and schema constraints; exactly one world row, durable across local Worker restart.
2. Server-enforced admin authentication, anonymous public read, no browser-only privilege checks.
3. Season 0 public read and protected Season 1 prepare path, blocked for provisional/unapproved participants.
4. Idempotency replay, conflicting replay, stale generation/revision, concurrent requests, failed batch rollback, unauthorized and CSRF-negative cases.
5. Operation audit, safe structured errors, no secrets in public projections.
6. Existing Node 22 tests, generator `--check`, Chromium where applicable, publication isolation, exact-head CI.

## Unresolved decisions / HOLD

- Confirm production admin identity bootstrap, recovery and secret management before implementation.
- Decide the canonical approval source for participants/rules; current preview allocations are explicitly provisional.
- Decide results authority and match finalization before enabling day activities.
- Confirm static-host-to-Worker API origin, CORS/cookie domain and deployment topology without deploying.
- Confirm D1 local tooling/dependency lock strategy and transaction guarantees by tests.

**Scope control:** PR 1 foundation only; PR 2 operations/integration; PR 3 complete console/reset. Draft/HOLD, no merge, workflow dispatch, deploy, remote DB, or changes to unrelated PRs.
