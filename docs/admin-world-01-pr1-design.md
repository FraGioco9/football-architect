# ADMIN-WORLD-01 — PR 1 technical design (Draft / HOLD)

Issue: #315. Original baseline: `74cd993d4434a7fb696d3e754b7da0f2f157198e`.

Rechecked main on 2026-10-27: `c40710cc2ccfcacb785d06aa51594e2ed07968de`. Existing PR: #316, branch `feat/admin-world-01-foundation`. Continue the full foundation on this branch; keep the issue's three cohesive PRs, with no extra authentication-only or documentation-only PR.

## Decision and boundaries

Approved backend: **Cloudflare Workers + D1 (SQLite)** for a single persistent shared world. Retain the existing static site, generated routes, canonical catalogues, Rules Registry and publication guard. The canonical loopback-only DEV launcher, opt-in LAN preview, fictional provider, DEV clock and session storage are not authoritative game data. Do not ship Worker source, migrations, credentials or debug modules in the static publication artifact. No deploy, remote D1 operation, remote migration execution, or production credentials are authorized.

This document is design-only. No implementation checkbox in #315 is complete merely because this document exists.

Owner approval, 2026-10-27: the complete design and the push to existing PR #316 are approved, including the repository's residual external-integration UNKNOWN risk for that push. This authorizes continued foundation development, not merge, deployment, remote database execution or real credential provisioning.

## Repo integration evidence

- `tools/generate-app-pages.mjs` owns generated HTML; edit its templates/source modules, not generated output by hand.
- `tools/publication-guard.mjs` is a fail-closed static artifact allowlist. Worker/backend paths must remain outside it.
- `tools/dev-app-preview.mjs` is the canonical loopback-only launcher; `tools/dev-standings-preview.mjs` also supports opt-in LAN preview. Both fictional previews must remain independent from the real world.
- `assets/competition-model.js` marks domestic allocations provisional and not approved. The production prepare command must fail closed until canonical participants/rules are approved.
- `assets/routes-registry.js` exposes canonical route parsing; public read adapters should preserve routes and viewed-season independence.
- Existing Node 22 tests and Chromium checks remain mandatory, along with generator parity.

## Main advancement review

The four new main commits are #317 (club overview, DEV Season 0 and international rule presentation), the US Capitolina crest integration, #320 (FC Parisien crest), and #318 (club summaries, persistent DEV reset and rule outcomes). A local merge-tree check reports no conflicts with the current design-only PR. This is compatibility evidence, not a branch update or a merge authorization.

- Preserve the new DEV reset behavior: its Season 0 lives in browser session storage and cannot initialize, erase or certify a real world.
- Canonical data, Rules Registry, provider contract and publication guard did not change in these four commits. New crest catalogue entries and generated pages must survive integration.
- The current provider contract only accepts `static`, `dev-fictional` and `verified-historical`. PR 2 must introduce an explicit validated real-world contract; do not insert live data under a fictional or historical label.
- Existing independent world/view/provider revisions remain relevant; the backend generation/revision is additional authority, not a replacement for view-request leases.
- Main generator parity passed. Local main tests on Node 24: 566 passed, six browser tests failed because Chrome is absent. These results are not Node 22 or browser acceptance. Existing PR-head Site checks and INT-24 Chromium runs succeeded on `e57e05b57e938dbfdee04710e3bf472091f5a1cf`; they do not establish readiness for a later implementation head or current-main integration.

## Authentication decision and proposed implementation

**Owner decision, 2026-10-27:** use dedicated email and password credentials for Admin access. Public visitors continue to read without login. The email identifies the operator account; this choice does not authorize email delivery, paid services, credentials in chat or production provisioning.

### Approaches

| Approach | Tradeoff | Decision |
| --- | --- | --- |
| Dedicated email/password with server-side sessions in the selected backend | Fits the owner decision; adds responsibility for password storage, throttling, revocation and recovery | Proposed implementation |
| GitHub OAuth | Delegates credential handling but requires a GitHub identity and OAuth setup | Not selected by the owner |
| Hosted email/password identity service | Outsources credential lifecycle but adds a provider, integration and provisioning dependency | No provider selected; not assumed |

The following details are engineering proposals, not additional owner decisions:

- Provision one initial administrator through an explicit operator-only CLI, with passwords read from hidden interactive input. There is no public signup, default password, browser bootstrap endpoint or first-visitor admin claim. Enforce a unique normalized email; define the same trim/lowercase identifier normalization for bootstrap and login. Never transform the password.
- Store only a versioned password verifier with a unique random salt. Proposed baseline: Argon2id with at least 19 MiB memory, two iterations, parallelism one, a 16-byte random salt and a 32-byte output. Use a maintained, pinned Worker-compatible WASM implementation with known-vector tests and constant-time verification; do not implement cryptographic primitives. Library selection, artifact provenance/license and dependency lock are builder decisions. Benchmark CPU, memory and bounded concurrent login behavior in the target Worker runtime before acceptance. Workers Web Crypto support for PBKDF2 alone is insufficient evidence of an acceptable password verifier: the workerd project tracks a 100,000-iteration ceiling, below OWASP's 600,000 SHA-256 guidance. No silent downgrade or home-grown hash chaining is allowed. If the selected Worker resource envelope cannot support the Argon2id baseline, keep sign-in fail-closed and obtain a revised execution design rather than provisioning or weakening it.
- Require passwords of 15–128 Unicode code points with a bounded UTF-8 request size, allow spaces/paste/password managers, and never truncate or impose composition rules. Reject known compromised/common passwords using a pinned local list, without sending passwords to another service.
- Authenticate each protected request server-side. Login yields a cryptographically random 256-bit session token; store only its SHA-256 digest, administrator ID, credential version, expiry and revocation metadata. Proposed expiry: eight hours absolute and 30 minutes idle. Password replacement, recovery and account disable revoke all sessions; every session lookup checks the current credential version and enabled account.
- Production cookie: `__Host-fa_admin`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, no `Domain`. Serve app and API through the same origin; reject unexpected/missing/`null` Origin on browser mutations, require JSON and a session-bound CSRF token, and do not enable credentialed cross-origin CORS. Local HTTP uses a distinct explicitly development-only cookie and loopback-only origin allowlist. Production mode must refuse the insecure local configuration.
- Login, session and protected responses use `Cache-Control: no-store`. Login failure is generic for absent, disabled and incorrect accounts, with dummy password verification for unknown emails. Apply persisted, atomic throttling before expensive verification, keyed by normalized-account digest and trusted request source; no process-memory-only limiter. Proposed initial policy: five failed attempts per account in 15 minutes, with a separate source limit and bounded retry delay. Do not trust forwarded client-IP headers in local mode; production source identity is a deployment gate. Rate-limit logs must omit credentials, cookie values and CSRF tokens.
- Recovery is operator-only password replacement through the same controlled CLI, requiring host/database administrative access. It increments credential version and revokes old sessions atomically. No unauthenticated recovery endpoint, email reset or SMTP service is included in PR 1. Local tooling must reject remote targets by default; production bootstrap/recovery execution remains separately authorized infrastructure work.
- Retain administrator identities, credential verifiers and access during full sporting-world reset. Audit actor IDs and sanitized operation metadata; never include password verifiers, session tokens, email/password request bodies or old sporting payloads in public projections or audit responses.

### Minimal Admin surface and API

Extend the generated Settings page from its source template with a separate Admin entry and a minimal signed-out/signed-in surface in EN/DE/ES/FR/IT. Keep the existing fictional DEV controls separate. The sign-in form uses labelled email/password inputs, correct autocomplete, password-manager support, keyboard focus and a generic error state. It never stores credentials or session tokens in browser storage. Signed-in Admin shows authoritative Season 0/revision and a prepare action with actionable missing-prerequisite messages; hiding a control never authorizes a request. There is no public registration or recovery form.

- `POST /api/admin/login`: bounded email/password JSON, origin validation and persisted throttling; issue a new session only after successful verification. Structured 401/429/503 responses leak no account existence or storage details.
- `GET /api/admin/session`: authenticated minimal actor identity and CSRF token; never password or session verifier data.
- `POST /api/admin/logout`: authenticated, origin/CSRF protected; revoke server-side and expire the cookie. Repeated logout safely leaves the browser signed out.
- Keep the world read and season-prepare routes below; protect every admin route regardless of UI state.

### Authentication evidence required in PR 1

Verify credential bootstrap and safe rerun, wrong/unknown/disabled account responses, password bounds, verifier vectors, cookie attributes, session rotation/expiry/idle timeout, concurrent throttling, unavailable storage, missing/foreign/null Origin, wrong CSRF, logout and recovery revocation, no browser credential storage, restart durability, and public artifact isolation. Use synthetic test credentials only. Production sign-in is not claimed until HTTPS topology and trusted source handling are verified.

References: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Cloudflare Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/), [workerd password-derivation limit issue](https://github.com/cloudflare/workerd/issues/1346). These describe algorithm guidance and runtime support, not a completed implementation or security certification.

## Proposed repository structure (not yet implemented)

```text
backend/
  src/index.ts                 # Worker request router
  src/auth.ts                  # Email/password, session verification, CSRF and origin checks
  src/passwords.ts             # Versioned password verifier; never plaintext persistence
  tools/admin-account.mjs      # Explicit local bootstrap/recovery; hidden password input
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
- `admin_accounts`: stable actor ID, unique normalized email, versioned salted password verifier, credential version and enabled status. No plaintext passwords or public registration.
- `admin_sessions`: hashed session token, absolute/idle expiry, revocation, administrator subject and credential version. Use HttpOnly Secure SameSite cookies, CSRF protection and server-side verification.
- `auth_throttles`: persisted atomic attempt windows/counters for bounded account/source digests, with expiry cleanup and no credential payloads.
- Future PR 2: fixtures, draws, outcomes and projections keyed to season/generation, with versioned provenance and reproducibility metadata.

Use foreign keys, uniqueness and CHECK constraints. Canonical identity assets and rule definitions remain source-controlled, not season-owned rows. Never use localStorage as authority.

## API contract (proposed)

- `GET /api/world`: anonymous, validated, versioned projection; no admin secrets, `Cache-Control: no-store` initially.
- `GET /api/admin/world`: authenticated state and safe operation summary.
- `POST /api/admin/seasons/prepare`: authenticated, CSRF-protected, requires `expectedGeneration`, `expectedRevision`, `Idempotency-Key`, approved participant/rules snapshots. In Season 0, creates Season 1 in preparing state, but does not start or fabricate results.
- Errors: 400 invalid input, 401 unauthenticated, 403 unauthorized, 409 stale revision/conflicting idempotency key, 422 missing approved prerequisites, 503 unavailable storage; no partial sporting writes.

## Approved initialization source

The production prepare command trusts only a server-bundled versioned approval manifest, proposed path `backend/catalogues/world-initialization.approved.json`, reviewed in source control alongside immutable rules and participant snapshots. It contains schema version, approval decision reference, the exact participant/rules hashes and all 18 competition bindings. Hash the canonical snapshot bytes with SHA-256 and validate identities, counts, version bindings and approval references before enabling prepare. Do not accept client-provided approval booleans, file paths, rules bodies or hashes as authority.

The existing preview allocation records an owner-approved future ID rule (IDs 1–16 tier 1, 17–32 tier 2, 33–40 outside gameplay), but remains `approved:false`. Preserve both facts. PR 1 may validate and bind this rule but must not promote the preview catalogue automatically. Until an explicit approval manifest exists, prepare returns a structured 422 prerequisite response without writing sporting state. Positive local integration tests use clearly isolated synthetic approved fixtures that cannot be bundled into production. The public Admin surface must show this blocked state honestly; a production Season 1 success is not claimed from fixture tests. An approved production manifest is required to complete that acceptance gate, not to test Season 0/authentication locally.

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

- Dedicated email/password and this complete Workers + D1 design are owner-approved. No production identity, credential or secret has been created, and no provider provisioning is implied.
- The server-bundled approval manifest is the proposed authority. The actual participant/rules approval record remains absent; preview data stays provisional. Production prepare remains blocked until that record is explicitly approved.
- Decide results authority and match finalization before enabling day activities.
- Proposed topology is same-origin app/API with host-only cookies. Verify actual HTTPS routing and trusted client-source handling before any production authentication; configure no host, reverse proxy or deployment in this design step.
- Select and pin the local Worker/D1 tooling with a committed dependency lock; prove password-runtime cost, throttle/session atomicity and world-command transaction guarantees in local integration tests. Local tests may execute isolated disposable migrations; remote migration execution remains unauthorized.

**Scope control:** PR 1 foundation only; PR 2 operations/integration; PR 3 complete console/reset. Draft/HOLD, no merge, workflow dispatch, deploy, remote DB, or changes to unrelated PRs.
