# Admin World Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the local, durable Season 0 foundation, dedicated email/password Admin access, atomic season preparation and a minimal Settings surface within existing PR #316.

**Architecture:** A Workers request handler uses D1 for the singleton world, operator accounts, sessions and command audit. Generated Settings consumes same-origin APIs; public reads remain anonymous. Preparing Season 1 fails closed without an approved server-bundled participant/rules manifest; isolated fixtures prove the positive path without approving real participants.

**Tech Stack:** TypeScript; Cloudflare Workers and D1; maintained Worker-compatible Argon2id WASM; Cloudflare's current Vitest integration; existing Node 22 generator/contracts and real Chromium checks. Pin runtime/development dependencies and their lockfile under `backend/` only.

**Spec:** `docs/admin-world-01-pr1-design.md`, owner-approved on 2026-10-27; issue #315. PR head containing the approved design: `9b1bda41b0febe627c11be94d520a9d27e18f961`.

## Global Constraints

- Keep all foundation work on `feat/admin-world-01-foundation`, PR #316. Target three cohesive PRs for #315; do not open authentication, documentation or test-only PRs.
- Recheck current main before integration; preserve #317/#318 club and DEV-reset changes, both new crests and generated manifests. Reviewed main: `c40710cc2ccfcacb785d06aa51594e2ed07968de`.
- No merge to main, workflow dispatch, deployment, hosting configuration, remote migrations/databases, real operator credentials or paid services. Local disposable migrations are permitted.
- Keep English code-facing prose, English-default EN/DE/ES/FR/IT UI, existing routes, public anonymous access and the 56-day calendar.
- Keep canonical identity/assets/rules source-controlled and outside season-owned sporting data. Preview allocations remain `approved:false`.
- Use Argon2id with at least 19 MiB memory, two iterations, parallelism one, a 16-byte random salt and a 32-byte output. No PBKDF2 downgrade, custom cryptographic primitive or runtime downloaded code.
- Passwords: 15–128 Unicode code points, bounded UTF-8 request, local compromised/common-password rejection, no transformation/truncation. No credentials in chat, git, logs, browser storage or public artifacts.
- Sessions: random 256-bit tokens, digests in storage; eight-hour absolute and 30-minute idle expiry, credential-version revocation; production `__Host-fa_admin; Secure; HttpOnly; SameSite=Strict; Path=/`, no Domain.
- Same-origin JSON mutations require valid Origin and session-bound CSRF. Insecure local cookies are available only in explicit loopback-only development mode. Production source identity/topology are release gates.
- Do not change accepted ARCH-CLEAN-02 exceptions or relabel live data as `dev-fictional`/`verified-historical`.
- Design and plan completion do not complete implementation checklist items. Existing local baseline: Node 24, 566 pass / six Chrome-unavailable failures. Require fresh Node 22, browser and exact-head evidence for implemented changes.

## Review Focus

1. Concurrent duplicate commands and stale revisions must cause exactly one durable mutation and one sanitized outcome, including after process restart (Task 4).
2. Account recovery between request authorization and command commit must prevent the old session from writing (Tasks 3–4).
3. Unknown accounts, Unicode passwords, concurrent login attempts and unavailable storage must not leak account existence, bypass throttles or create sessions (Task 3).
4. A delayed signed-in response arriving after logout must not restore Admin controls or overwrite a newer generation/revision (Task 5).
5. Test-only approval fixtures, password dictionaries, WASM and backend source must never enter the static public artifact or turn provisional participants into production approval (Tasks 1, 4 and 6).

---

## File and responsibility map

| Files | Responsibility |
| --- | --- |
| `backend/package.json`, `backend/package-lock.json`, `backend/tsconfig.json`, `backend/vitest.config.mts`, `backend/wrangler.toml`, `backend/.gitignore` | Isolated pinned local Worker/D1 tooling; no deploy scripts or real bindings |
| `backend/src/types.ts`, `backend/src/errors.ts` | Versioned API/domain types and safe structured errors |
| `backend/src/passwords.ts`, `backend/tests/password-runtime.test.ts` | Argon2id adapter, bounds, known vectors and Worker feasibility evidence |
| `backend/migrations/0001_world.sql`, `backend/src/world-repository.ts` | Singleton world, season snapshots, account/session/throttle tables and atomic command storage |
| `backend/src/auth.ts`, `backend/src/auth-repository.ts`, `backend/tools/admin-account.mjs` | Authentication, persisted limits, session lifecycle, explicit local bootstrap/recovery |
| `backend/src/commands.ts`, `backend/src/catalogue-snapshot.ts`, `backend/src/public-projections.ts`, `backend/src/index.ts` | Request boundary, trusted approval, atomic prepare and minimal public projections |
| `backend/tests/*`, `backend/tests/fixtures/*`, `backend/tests/apply-migrations.ts` | Local Worker/D1 integration and explicitly synthetic approval fixtures |
| `tools/render-admin-settings.mjs`, `templates/app-page.html`, `assets/admin-settings.js`, `assets/admin-settings.css`, `tools/generate-app-pages.mjs` | Generated Admin Settings section and same-origin UI; source changes precede generated HTML |
| `tools/dev-admin-api-proxy.mjs`, `tools/dev-standings-preview.mjs` | Optional fixed-target loopback-only API bridge for the existing preview launcher |
| `tests/admin-settings.test.mjs`, `tests/admin-settings-browser.test.mjs`, `tests/dev-admin-api-proxy.test.mjs` | Frontend behavior, late-response tests, languages, keyboard and mobile verification |
| `tools/publication-guard.mjs`, `tests/publication-gate.test.mjs` | Explicit allowlisting of only the new public UI assets, backend/fixture exclusion |
| `.github/workflows/admin-world-checks.yml`, `docs/admin-world-01-operations.md`, `README.md` | Test-only exact-head CI, local setup/recovery and honest acceptance evidence |

### Task 1: Establish local Worker tooling and password feasibility

**Interfaces:** Export `hashPassword(password: string): Promise<string>` and `verifyPassword(password: string, encoded: string): Promise<boolean>` from `passwords.ts`; encoded verifiers carry algorithm, version, parameters and salt. Unrecognized/understrength encodings fail closed. Library selection and exact patch versions are implementation choices, recorded in the committed lock and operations notes.

- [ ] Recheck remote main and #316 head; integrate main into the existing PR branch locally without modifying main. Preserve the pre-existing CSV line-ending difference outside all commits.
- [ ] Write `backend/tests/password-runtime.test.ts`: an independent published Argon2id vector matches; two hashes of the same synthetic password use different salts; correct password succeeds, wrong password fails; malformed and below-minimum encodings fail; astral Unicode bounds are code-point based and passwords are not normalized.
- [ ] Create the minimal local-only TypeScript/Vitest Worker harness, pin dependencies and record a baseline failing test run with the password adapter absent. Use the official current Cloudflare Vitest plugin; no remote credentials, binding IDs or deploy scripts.
- [ ] Implement the adapter using a maintained Worker-compatible WASM implementation whose compiled module can be bundled statically. Record upstream version/license/integrity. Use a pinned local common-password dictionary and test that dictionary bytes are not a public asset. Do not assume a Node-only hash test demonstrates Worker compatibility.
- [ ] Run the vectors in the Worker test runtime, benchmark hash/verify memory and CPU under bounded concurrent logins, and record local measurements. If the Argon2id floor cannot run, stop at the documented feasibility gate and propose an execution change; never silently weaken security. Production performance remains unverified until separately authorized infrastructure exists.
- [ ] Commit only backend tooling, adapter, tests and evidence after `npm --prefix backend test -- password-runtime` and `npm --prefix backend run typecheck` pass.

### Task 2: Create durable singleton storage and Season 0 reads

**Interfaces:** In `types.ts`, define `WorldV1 = {schemaVersion:1, generation:string, revision:number, seasonNumber:number, day:number, phase:'unstarted'|'preparing'|'active'|'closed'}`. `readWorld(db: D1Database): Promise<WorldV1>` returns validated storage, while `projectWorld(world: WorldV1)` exposes only this public shape. `ApiError` carries `status`, stable `code` and safe `details`.

- [ ] Write failing `backend/tests/world-storage.test.ts` and `public-world.test.ts`: fresh migration yields one real Season 0, revision/day/season zero, zero season-owned rows; a second world, invalid IDs/states and deletion of the singleton are rejected; public JSON contains no operator/session/throttle data.
- [ ] Run the new tests and confirm the missing schema/repository failure. Apply migrations only through isolated local D1 test bindings using the official migration helpers.
- [ ] Implement `0001_world.sql`: singleton `world_state` with fixed ID and guarded deletion; `seasons` with immutable snapshot metadata; `admin_operations` unique by generation/key; `admin_accounts` unique normalized email and credential version; `admin_sessions` referencing accounts; bounded-expiry `auth_throttles`. Add CHECK, foreign key and uniqueness constraints. Seed a fresh random generation once, not on every read or restart.
- [ ] Implement `readWorld`, `projectWorld` and safe errors. An uninitialized, malformed or unavailable database yields 503, never an invented fallback Season 0. Public reads do not mutate world revisions.
- [ ] Test migration rerun, independent clients and a real local Worker restart using the same disposable persistence directory: generation/revision and rows survive; missing storage never claims success. Run `npm --prefix backend test -- world-storage public-world` and typecheck; commit the verified storage slice.

### Task 3: Implement dedicated operator accounts and sessions

**Interfaces:** `normalizeEmail(input:string): string` trims/lowercases only the identifier. `login(db, credentials:{email:string,password:string}, context:{now:number,sourceKey:string}): Promise<{token:string,csrfToken:string,actor:{id:string,email:string},expiresAt:number}>`; `authenticate(db, token:string, now:number): Promise<AdminSession>` checks enabled account/version and both expiries. `AdminSession` includes actor ID, session digest and credential version for commit-time checks. `revokeSession(db,digest)` is repeat-safe. The operator CLI supports `create` and `replace-password` only on an explicit local target, with hidden password input and remote targets rejected.

- [ ] Write failing `backend/tests/auth.test.ts`, `sessions.test.ts`, `admin-account.test.ts`: no signup/default user; duplicate bootstrap cannot replace credentials; normalization is consistent; unknown/disabled/wrong-password responses are generic; long/short/Unicode/common passwords obey the spec; raw passwords/tokens never persist or appear in captured logs.
- [ ] Add concurrency tests proving persisted attempt reservation precedes hashing, account/source limits survive independent clients and restart, and unavailable throttle/session storage rejects login. Use five failed attempts per account/15 minutes and a separate source ceiling of 30 attempts/15 minutes; bounded global in-flight hashing must not multiply WASM memory without limit.
- [ ] Run the tests to observe missing auth behavior; implement the repository/CLI and verifier integration. Use cryptographically random tokens, store digests, rotate on successful login, set eight-hour absolute/30-minute idle expiry and avoid timing differences from skipping unknown-account verification.
- [ ] Test absolute/idle boundary times, logout replay, account disable and password recovery. Recovery atomically increments credential version and invalidates sessions; the CLI refuses remote execution and never prints secrets. Cleanup expired throttle/session entries with bounded local maintenance, not a remote scheduled job.
- [ ] Run `npm --prefix backend test -- auth sessions admin-account`, typecheck and log-leak assertions; commit the verified authentication slice. Use synthetic credentials only; do not create the owner's real account.

### Task 4: Add protected HTTP commands and atomic prepare

**Interfaces:** Default Worker export implements `fetch(request:Request, env:Env):Promise<Response>`. `Env` has D1 `DB`, explicit local/production mode and exact allowed application origin; it never trusts a browser admin flag. `PrepareCommand = {expectedGeneration:string, expectedRevision:number}`, with a bounded `Idempotency-Key` header. `prepareSeason(db, session:AdminSession, command:PrepareCommand, key:string, snapshot:ApprovedSnapshot|null, now:number): Promise<{world:WorldV1,operationId:string}>`. The server loads `ApprovedSnapshot`; clients cannot supply approved data. `loadApprovedSnapshot()` returns null until a reviewed production manifest exists.

- [ ] Write failing `backend/tests/http-auth.test.ts`: anonymous `/api/world` works; admin reads need a session; login/logout/session/world/prepare obey method and content-type rules; request size and malformed JSON are bounded; missing, null, foreign Origin and wrong CSRF cannot mutate; production refuses insecure local cookies/configuration; safe 401/403/409/422/429/503 bodies contain no SQL or secrets.
- [ ] Write failing `backend/tests/prepare.test.ts`: absent production approval returns 422 with zero mutations; forged client approval is rejected. Synthetic server-only approved fixtures prepare Season 1 without results, calendars or active status. Capture exact canonical rules/participants hashes and all 18 bindings. Corrupt identities, counts, hashes, versions or references are rejected.
- [ ] Add races: same key/same request returns one saved outcome; same key/different payload returns 409; concurrent distinct keys with the same expected revision produce one success; stale generation/revision and revoked credentials fail; inject a later SQL failure and assert world, season and audit all roll back.
- [ ] Implement routing, safe error mapping, no-store headers, exact-origin checks, production/local cookie separation and CSRF. Do not enable credentialed cross-origin CORS, public signup/recovery, deploy routes or a raw database API.
- [ ] Implement prepare using D1's verified atomic batch semantics. Put an aborting SQL guard for expected world generation/revision and still-valid actor/session/credential version in the same transaction as season, audit and world mutation. Zero affected rows alone must not let later statements commit. A duplicate race re-reads and validates the saved idempotency outcome after rollback; a conflicting request cannot inherit another outcome.
- [ ] Validate the trusted approval manifest server-side against canonical identities/rules. Keep positive fixtures in `backend/tests/fixtures/`, with a production build test proving they are not imported or bundled. Keep actual production prepare blocked; do not fabricate an approval file.
- [ ] Run the HTTP/prepare suite, failed-batch and restart durability tests on local D1, plus typecheck. Verify two independent clients see one committed revision. Commit the protected vertical slice only after these tests pass.

### Task 5: Add the generated minimal Admin Settings surface

**Interfaces:** `tools/render-admin-settings.mjs` exports `renderAdminSettings():string`; `assets/admin-settings.js` initializes only a `[data-admin-settings]` host, uses same-origin fetch with credentials and an in-memory CSRF token, and never stores credentials/session tokens. A local request epoch rejects stale login/read responses after logout or a newer request. Settings consumes backend `WorldV1` with generation/revision guards; a changed generation forces a fresh authenticated read rather than ordering random generation strings.

- [ ] Write failing `tests/admin-settings.test.mjs`: generated Settings has labelled email/password inputs, `autocomplete=username/current-password`, no signup/recovery form, no credential storage, explicit unavailable/unauthorized/prerequisite states and EN/DE/ES/FR/IT copy with English fallback. Ensure other generated pages do not make admin API requests.
- [ ] Write behavioral tests with controlled deferred fetches: logout supersedes pending login/world responses; a lower revision cannot overwrite newer state; a missing API remains honestly unavailable; unauthorized reads clear privileged controls; failed/repeated prepare does not duplicate a submission.
- [ ] Run the tests to confirm missing renderer/client behavior. Implement the renderer, accessible form and signed-in Season 0/revision/prepare/logout surface. Preserve existing fictional Debug settings and ordinary Settings preferences. Disable submit while pending and restore useful focus/error announcements; never infer server authorization from visible controls.
- [ ] Add only the two public UI asset names to the publication guard, invoke the renderer from source generation and regenerate checked-in HTML. Do not edit generated files by hand or add backend/catalogue/dictionary/WASM paths to the static allowlist.
- [ ] Add `tests/admin-settings-browser.test.mjs` against an isolated local Worker + preview adapter. Exercise signed-out and signed-in sessions, public independence, five languages, dark/light, 320/390/1440 widths, keyboard/password-manager attributes and missing-prerequisite UI. Implement `proxyAdminApi(req,res): Promise<boolean>` in `tools/dev-admin-api-proxy.mjs`, called before static routing by `tools/dev-standings-preview.mjs`. It is disabled unless an explicit local API target is configured; accept only a fixed HTTP loopback target and exact `/api/world` or `/api/admin/` paths. Preserve Origin and response cookies without enabling arbitrary destination URLs. Reject non-loopback callers and unapproved source hosts; never expose bootstrap or credentials. `tests/dev-admin-api-proxy.test.mjs` must prove disabled mode is unchanged, external destinations/callers are rejected, and browser requests remain on the existing app origin. The existing canonical launcher still works without backend dependencies or npm.
- [ ] Run the frontend behavioral tests, real Chromium check and `node tools/generate-app-pages.mjs --check`; commit source and generated output together after review of the output diff.

### Task 6: Verify the full foundation and prepare the same PR for review

**Interfaces:** `backend/package.json` provides non-deploy `test`, `typecheck`, `dev` and explicit local migration commands. `admin-world-checks.yml` runs tests only on pull requests, checks out/asserts the exact PR head, uses Node 22, and needs no Cloudflare, email or hosting credentials. It must not use `pull_request_target` or workflow dispatch.

- [ ] Add regression tests that stage the actual public artifact and reject backend files, fixtures, lockfiles, password lists, WASM and credentials. Confirm new Admin assets work from staged bytes and fixture approval cannot be imported into production. Run existing publication regressions unchanged alongside the new assertions.
- [ ] Write local-only setup, migrations, synthetic operator bootstrap/recovery and restart instructions in `docs/admin-world-01-operations.md`. Explain that email is an identifier, recovery is operator-only, production topology/performance remain unverified, Season 1 prepare remains blocked without approved participants, and reset/lifecycle beyond preparation belong to PRs 2–3.
- [ ] Add exact-head backend/browser CI and run all required checks: `npm --prefix backend ci`, backend test/typecheck; Node 22 syntax and `node --test --test-concurrency=1 tests/*.test.mjs`; generator parity; real Chromium and publication isolation. Record counts, exact source/main SHAs and failures accurately. Do not rerun broad suites unless changes/failures justify it.
- [ ] Perform whole-branch review for session/command races, crypto/runtime limits, client stale responses, scope and artifact isolation. Resolve material findings, run affected checks again and preserve any remaining UNKNOWN gates explicitly.
- [ ] Push to the same #316 branch, update its title/body around the implemented foundation and report the exact new head and CI evidence. Keep Draft/HOLD while required acceptance gates are missing. Update #315 progress only for implemented and verified items; never count design/plan or fixture-only Season 1 as production completion. Do not merge, deploy, dispatch workflows or create additional PRs.

## Plan self-review

- Design coverage: Task 1 covers runtime/crypto/tooling; Task 2 durability/singleton/projections; Task 3 account/bootstrap/recovery/throttling; Task 4 authorization/commands/approval/idempotency/rollback; Task 5 minimal generated UI/stale responses/locales; Task 6 end-to-end evidence, publication and operations.
- Interface consistency: one `WorldV1`, `AdminSession` passed to commit-time guards, one server-owned `ApprovedSnapshot`, one command envelope and one origin policy. No client approval or public authoritative browser storage.
- Remaining release dependencies are explicit: actual approved participant/rules manifest, production HTTPS/trusted-source routing, production runtime resource evidence and exact-head CI/browser results. These cannot be claimed from local fixtures.
- Execution recommendation: native implementation in this session, task by task, because storage/auth/commands share the same transaction boundary and a single implementer can keep the interfaces coherent; one independent whole-branch review before readiness.
- The plan changes no approved product behavior. It does not authorize real credentials, infrastructure, merge or deployment.
