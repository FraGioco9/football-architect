# Admin World — local authentication foundation (#315 / #316)

Status: development only, existing PR #316 remains **Draft/HOLD**. This batch aligns the branch with main `80027f8` and adds real Worker/D1 authentication and operator-only local account management. It does not complete PR 1 or the full Admin World feature. No real credentials, remote D1 operation, deployment, manual workflow or merge is authorized.

## Implemented boundary

- Anonymous `GET /api/world` returns validated persisted Season 0, never an invented fallback. It remains available without Admin login.
- Explicitly configured `POST /api/admin/login`, `GET /api/admin/session`, `GET /api/admin/world`, and `POST /api/admin/logout` enforce server-side access, generic failures and no-store JSON responses.
- The dedicated operator email is normalized consistently; the password is never trimmed, normalized or truncated. No public signup, default account, first-visitor bootstrap or public recovery route exists.
- Sessions use cryptographically random 256-bit cookies; only digests and expiry/version metadata persist. CSRF is a domain-separated SHA-256 derivation of the random session secret; its digest is stored, its value is returned only to authenticated clients. It is never stored in browser storage.
- Local cookies are `fa_admin_local`, HttpOnly, SameSite=Strict, Path=/; production uses the separate Secure `__Host-fa_admin` cookie and refuses HTTP. Successful login rotates a supplied current cookie only after conditional insertion against the still-enabled account, original verifier and credential version.
- Eight-hour absolute and thirty-minute idle expiry are enforced; activity refreshes idle time without extending the absolute deadline. Logout deletes the stored session and expires the cookie; replay remains safely signed out. Recovery increments credential version and deletes the account's sessions atomically.
- Source attempt reservation happens before account reservation and Argon2. The account budget is five failed attempts per fifteen-minute window; successful login releases only its own reservation, not concurrent failed attempts. Source budget is thirty total attempts per window. Local mode uses one conservative loopback source bucket and ignores forwarded IP headers. A denied source cannot create new account throttle rows. Each login prunes at most64 expired throttle rows and64 expired/idle sessions.
- `POST /api/admin/seasons/prepare` requires configuration, authentication, exact Origin, CSRF, strict command fields and Idempotency-Key. It returns422 `catalogue_not_approved` while the server-owned production manifest is absent. No caller approval flag or fictional data can enable it; no sporting state is written. Successful atomic preparation and synthetic positive command scenarios are implemented and tested in local D1. Generated Admin Settings and the same-origin bridge are implemented and covered by actual browser tests; production preparation remains blocked without an approved catalogue.

## Pinned crypto and runtime evidence

`argon2id@1.0.1` (OpenPGP.js project, MIT) is retained. Worker imports precompiled SIMD/non-SIMD WASM; no runtime download, dynamic compilation or weaker-algorithm fallback. Node-only operator tooling compiles those same installed bytes locally and shares `password-core.ts`, so verifier format and password validation do not diverge.

The floor remains Argon2id v19,19456KiB,2 iterations,1 lane,16-byte random salt and32-byte output. Passwords require15–128 Unicode code points and at most512 UTF-8 bytes; lone surrogates are rejected. The eleven-entry local common-password set is a limited pinned blocklist, not a comprehensive compromised-password screening service; broader screening remains a release-review limitation.

Independent known-answer fixtures were produced using `argon2-cffi==25.1.0`, `hash_secret_raw(secret, b'0123456789abcdef', time_cost=2, memory_cost=19456, parallelism=1, hash_len=32, type=Type.ID, version=19)`:

| Synthetic input | Base64 tag, unpadded |
| --- | --- |
| `independent-argon2-vector-2026` | `vkGKejmMYid+b4y79BCo6CA1EDcoxITIoX90Osr8sZM` |
| `Unicode 🔐 passphrase 2026` | `N4zUUixBd8zZ+qk3/uixLIWyDghj/U6V8nmNgUvKr7w` |

Both vectors pass in actual local workerd. Fresh salts, wrong passwords, malformed/weakened verifiers, concurrent correctness and queue overflow are tested. Upstream linear memory is1040 pages (about65MiB), and one serialized instance admits at most four running/waiting operations per isolate; a fifth fails closed. This is not a measured production peak-memory or CPU benchmark. Cloudflare plan/resource acceptance and production throughput remain UNKNOWN until separately authorized infrastructure review. The Worker test plugin and operator/Wrangler tooling use their separately pinned Miniflare builds; tests cover both, including real Wrangler restart.

## Local setup and operator recovery

Install the committed dependencies:

```sh
npm --prefix backend ci
npm --prefix backend run test:contracts
npm --prefix backend test
npm --prefix backend run test:operator
npm --prefix backend run typecheck
```

Choose an absolute, private, local persistence directory outside the static artifact. Create the operator from an interactive terminal:

```sh
npm --prefix backend run admin:account -- create --email operator@example.invalid --persist-to /absolute/local-state
```

`operator@example.invalid` is an example synthetic identifier, not a default account. Password and confirmation are read with terminal echo suppressed; no password argv, environment, file or log channel is supported. A non-TTY call fails. Duplicate creation cannot replace credentials. Existing ancestors and the entire D1 persistence subtree reject symlinks before access. Protect this directory with host filesystem permissions and do not expose it to untrusted local users; this is not protection against a privileged host attacker changing files after validation.

Start the backend against the same directory:

```sh
npm --prefix backend run dev -- --persist-to /absolute/local-state
```

`wrangler.toml` binds loopback port8787. The reserved UUID identifies **local** D1 persistence shared with operator tooling; it is not a provisioned Cloudflare database. Operator tooling has no remote database target/API. It applies only unapplied migration names via atomic local batches, using the official SQL migration splitter. Never use `D1.exec()` on a multiline migration: that API treats input differently and cannot safely split trigger bodies.

The configured development application origin is `http://app.localhost:2000`. Mutation Origin must match exactly; local API requests must terminate on approved loopback hosts. The generated static application now includes the Admin Settings surface and optional same-origin local API bridge. The complete browser path was verified against local Wrangler/D1 using synthetic operator credentials; this does not constitute production deployment or approval. The restart integration test temporarily uses its own loopback origin/port and synthetic operator; it does not change development configuration or create a real account.

To replace a local operator password and revoke all sessions:

```sh
npm --prefix backend run admin:account -- replace-password --email operator@example.invalid --persist-to /absolute/local-state
```

No command accepts `--remote`, database URLs or production credentials. Do not send passwords in chat. Back up local persistence using appropriate offline filesystem procedures before operator maintenance. There is no public reset-email or SMTP flow.

## Deployment and acceptance gates still open

Production Admin requires HTTPS, exact configured origin and explicit Cloudflare trusted-source configuration; missing/inconsistent configuration fails503. Production source trust and topology have not been exercised remotely and must not be enabled merely by copying local variables. No remote database ID, production account or deployment was created by this work.

The local foundation now has tested catalogue snapshot validation, atomic positive synthetic prepare/idempotency/concurrency/rollback, generated Admin Settings, same-origin preview bridge, stale-response/locales checks, publication/fixture isolation and exact-head Admin/Site/Browser CI acceptance. Still required for production release: an actual approved production catalogue, trusted HTTPS/source topology, deployed resource/throughput validation and comprehensive compromised-password screening; do not treat local synthetic preparation as production acceptance. Production Season 1 remains blocked without approved canonical participants/rules. Season lifecycle/calendar/draw/public integration and full sporting reset remain the later approved slices; do not implement a match engine or promote DEV output into production.

The source of truth for test counts and exact HEAD is PR #316 CI and issue #315, not a green check on a previous SHA. Keep Draft/HOLD while these gates are missing. API errors omit SQL, verifiers, passwords and session/CSRF secrets. Static publication remains an explicit allowlist; backend source, lockfiles, migrations, operator tools and WASM are excluded by a dedicated actual-publication-plan regression.

## Review and regressions

Independent review identified persistence-descendant symlinks and unbounded denied-source throttle growth. Both were reproduced by failing tests and fixed; expiry cleanup is bounded and source denial occurs before new account rows. Additional negatives cover cookie ambiguity, session rotation, absolute/idle expiry, disabled accounts, storage failure and logout replay. Real Wrangler restart tests verify a synthetic session and singleton generation across restarts and two independent anonymous clients. The inspector uses an explicit ephemeral loopback port to avoid unnecessary network-interface discovery in restricted environments; no test is skipped or replaced by a mock for that case.

Primary runtime references: [D1 database/batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Cloudflare Vitest test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/). Actual local transactional and restart tests remain necessary; documentation alone is not acceptance evidence.

## Prepare transaction and Settings continuation (28 October 2026)

The foundation now implements `prepareSeason` with a single D1 mutation batch: live account/session/credential checks, expected generation/revision/Season 0 guard, immutable season snapshot, world revision and sanitized idempotency outcome. A false guard intentionally violates a constraint to abort the entire batch; zero changed rows alone are never treated as a rollback. Identical keys replay the saved outcome only for the original actor/request and a currently valid session. Conflicting keys or stale worlds return409; unavailable storage returns503. Local tests cover concurrent identical/distinct keys, later audit failure, recovery between authorization and commit, and persisted outcome replay after closing/reopening local D1. This is local binding evidence, not a deployed consistency/throughput claim. D1 batch transaction semantics: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch .

`validateApprovedSnapshot` requires server-owned canonical identities and complete rules, exactly18 competition bindings, expected version/participant counts, disjoint international allocations and matching canonical SHA-256 hashes. Test hashes are independently calculated with Python hashlib. `backend/tests/fixtures/synthetic-approval.ts` is strictly synthetic and never a production approval. The production loader still returns null. No environment variable, browser body or operator CLI enables approval; production prepare still returns422 `catalogue_not_approved` without sporting writes.

Generated `/settings` now has a separate Admin section in EN/DE/ES/FR/IT. Public pages do not request Admin APIs. Login uses an HttpOnly cookie, CSRF stays in memory, and the password field is cleared on submit. Request epochs suppress late responses after logout; changed world generations require another authenticated read. Failed sign-out keeps a visible retry. The frontend never creates or starts a season itself.

For optional local browser integration, start the Worker with the existing local persistence directory, then set `FA_ADMIN_API_TARGET=http://127.0.0.1:8787` in the environment running `node tools/dev-app-preview.mjs`. Open `http://app.localhost:2000/settings`, matching the local Worker `ADMIN_ORIGIN`. In PowerShell: `$env:FA_ADMIN_API_TARGET='http://127.0.0.1:8787'`. Remove it afterward with `Remove-Item Env:FA_ADMIN_API_TARGET`. The bridge accepts only explicit fixed HTTP loopback targets, loopback clients, approved local Host values and the exact supported API paths; it preserves Origin/cookies and drops forwarding headers. It does not expose bootstrap or recovery. The preview works unchanged when the variable is absent, and LAN callers cannot use this bridge.

Validation commands: `npm --prefix backend test`, `npm --prefix backend run typecheck`, `npm --prefix backend run test:contracts`, `npm --prefix backend run test:operator`, `node --test tests/admin-settings.test.mjs tests/dev-admin-api-proxy.test.mjs`, `node tools/generate-app-pages.mjs --check`. The exact-head Admin workflow also runs `tests/admin-settings-browser.mjs` with isolated pinned Playwright/Chromium:30 real Worker/D1 cases (5 languages×2 themes×3 widths), plus public independence/API-unavailable behavior. Fixture-only success does not complete production Season1 approval, production HTTPS/source trust, resource-envelope validation or comprehensive compromised-password screening.

Local continuation evidence: Node22.23.3 passes38 Worker/D1 tests,29 contracts,6 operator/persistence/real-Worker-restart/local-compilation tests and13 client/proxy/publication tests; TypeScript,6 SQLite tests and generator23/23 pass. Independent review found a delayed-world-response race hiding failed-logout retry; the regression failed before the epoch fix and passes afterward. The local broad Node run reported674 PASS/6 FAIL, with all six failures explicitly requiring unavailable Chrome (A04 browser baseline, CLUB-01, G10-PUBLIC-02, UI-THEME, CAL-IMP-02 and CAL-IMP-04). Chromium install returned a corrupt archive; the new actual-browser test fails missing engine locally and is not claimed PASS. Exact-head hosted validation remains required.

Hosted first-batch evidence on `f26643f`: Admin #40676077674 PASS, including31 actual Settings→bridge→Wrangler→D1 Chromium cases. General gates exposed two harness defects: Browser #40676077611 passed245 legacy Chromium checks but failed an app.css-only parity assertion when only the new component stylesheet changed; Site #40676077712 failed UI-THEME because its static test server wrote200 headers before a missing API file read and then attempted404 headers. Both were reproduced locally. Corrective regressions use a real Git diff (component CSS retains FULL Chromium/WebKit while app.css changes additionally run its exact-base parity audit) and an actual HTTP404 request to the same static QA server. Both regressions fail before and pass after their fixes. The classifier still requires FULL for every CSS change. No browser failure or omitted later WebKit step is recorded as PASS; the corrective commit requires new automatic exact-head gates.


## Production security and dependency gate review (28 October 2026)

This is a source/configuration review, **not** a production certification or authorization to provision infrastructure. The real-world initialize command must remain fail-closed until an approved catalogue is committed and independently checked.

| Gate | Verified source behavior | Missing production evidence / decision |
| --- | --- | --- |
| Canonical Season 1 approval | `loadApprovedSnapshot()` returns `null`; production `prepare` responds with `catalogue_not_approved` and does not write sporting data. | Owner-approved complete canonical competition rules and eligible participants, signed-off version/hash provenance and reviewed immutable approval manifest. |
| Authentication and CSRF | Server-enforced sessions, exact configured mutation Origin and CSRF, dedicated operator account and generic failures; local Worker/D1 and browser tests pass on the previously recorded SHA. | Hosted trusted-source/origin topology, secure forwarding termination, session-cookie behavior under actual HTTPS. |
| Credential protection | Pinned Argon2id v19 (19456 KiB, 2 passes, 1 lane), known-answer vectors, bounded verifier concurrency and rate limiting. | Production CPU/memory/concurrency measurements; reviewed compromised-password screening beyond the current eleven-entry blocklist. No weaker hash fallback. |
| Persistence | Local transactional D1 preparation, rollback, replay and restart tests. | Actual remote D1 provisioning/migration/backup/recovery testing under separately authorized conditions. |
| Public boundary | Anonymous world read is separated from Admin operations; static publication allowlist excludes backend and fixtures. | Hosted end-to-end origin/access check and production acceptance. |

### Sequence and stop rules

1. Obtain and review the real Season 1 participant/rules approval **without** introducing DEV/fictional data as canonical. Until then, `catalogue_not_approved` is expected and correct.
2. Review trusted-origin/source routing and the Cloudflare resource envelope before enabling remote Admin access. Local browser results cannot substitute for deployed metrics.
3. Extend the password denylist/screening design without sending secrets to external services or weakening login behavior. Treat the current limited blocklist as an explicit release blocker requiring a decision.
4. After changes land on the PR, use FAST/TARGETED checks for eligible documentation and small code batches; run FULL exact-head acceptance only at the release gate or when required by CSS/security CI policy. Never count results from a prior HEAD as current-HEAD checks.
5. Remain Draft/HOLD. **Stop** before deployment, remote D1 operations, operator credential provisioning or merging, all of which require separate authorization.

No checkbox for a full initialize/read flow is checked based on synthetic approval fixtures, and no PR 2 or PR 3 checklist item is complete on this evidence.


## Season 1 approval handoff — evidence required before enabling prepare

The current manifest validator proves structural integrity of a **server-owned** approval, not the sporting correctness of a Season 1 selection. The approval is deliberately absent from production. The following is an acceptance handoff, not approval itself:

1. Freeze the canonical 320 club identifiers (`IT/ENG/ES/DE/FR/PT/NL/BR-1..40`) and the 18 competition IDs (16 domestic, `int-1`, `int-2`). Record the catalogue source revision and checksum independently from the test fixture.
2. For Season 1, explicitly confirm each domestic competition's 16 initial participants and the international 24-per-cup entries (**three per country per cup**, six disjoint international entries per country). The owner reconfirmed the three-per-country rule on 28 October 2026; a prior four-per-country description is incorrect. The individual Season 1 entries still require comparison with the owner-approved qualification model; **do not infer** entrants from current DEV standings, synthetic test fixtures or random draws.
3. Review the complete canonical rules for all 18 competition IDs, including domestic promotion/relegation/postseason outcomes, INT-24 draw/calendar constraints and the 56-day world calendar. Record the reviewed versions and full canonical hash inputs. Hash equality prevents silent drift but does not constitute sporting-policy approval.
4. Record an unambiguous approval reference with reviewer decision and immutable source commit. Validate the proposed manifest using `validateApprovedSnapshot` against the independent canonical catalogue; reject missing, duplicate, stale or inconsistent participants and changed rules.
5. Require an independently reviewed code change to replace the present `loadApprovedSnapshot() => null` boundary. Before that separate approval, an authenticated real `prepare` must continue to return HTTP 422 `catalogue_not_approved` without increasing world revision or creating Season 1.
6. After any approved enabling change, rerun real workerd/D1 positive and negative tests, exact-head public/static isolation, browser and required FULL acceptance. Record actor/command/time/resulting revision before marking the protected initialize/read checklist item complete.

Current source-only evidence: `backend/src/catalogue-snapshot.ts` validates 320 canonical identifiers, 18 bindings, rules versions, per-competition sizes, disjoint international allocations and SHA-256 digests. `backend/tests/catalogue-runtime.test.ts` includes synthetic positive and rejection cases, while `backend/tests/command-contract.test.ts` asserts the production approval remains null. These fixtures **must never** be promoted into production approval by renaming or copying them.

No catalogue approval, production initialization, deployment or database action was performed by this handoff.

## Owner-approved Season 1 participant slots — 28 October 2026

The owner explicitly approved these **exact initial international participant IDs**, for each of `IT`, `ENG`, `ES`, `DE`, `FR`, `PT`, `NL`, `BR`:

- Sovereign Cup (`int-1`): IDs **1, 2, 3** of each country (8 × 3 = 24).
- Federation Cup (`int-2`): IDs **4, 5, 6** of each country (8 × 3 = 24).
- These are 48 distinct club entries, six per country, with no inter-cup overlap.

Domestic Season 1 allocation remains IDs 1–16 (tier 1) and 17–32 (tier 2) per country; IDs 33–40 remain inactive. The former descriptions Federation 5–8 and fixture-only 5–7 were wrong and are superseded. Do not use synthetic fixture allocation as production authority. Participant **selection** is approved, but the full canonical rules, production snapshot hashes and immutable approval manifest still need independent validation before enabling `loadApprovedSnapshot()`. Production prepare remains blocked until that happens.

### Permanent catalogues and seasonal participants (28 October 2026)

`data/divisions.json` and its CSV define only permanent identity, capacity and canonical rules; they have no `clubIds`. `data/clubs.json` keeps all 320 identities and `data/international-competitions.json` keeps both cup definitions. Canonical JSON rules remain separate from their JavaScript engines.

`backend/catalogues/season-1.participants.json` is the single owner-approved Season 1 selection: domestic 1–16/17–32, Sovereign 1–3, Federation 4–6 in each of eight countries; 33–40 inactive. It is **not a complete production approval**. `season-one-selection.mjs` checks all 18 selections; `tools/load-season-one-preview.mjs` derives domestic presentation lists with `approved:false`, never a second persisted allocation file. The old provisional allocation source is retired after consumer migration. Existing public and fictional DEV projections remain unapproved; their scores, rankings and later fictional seasons cannot approve a real world.

`validateApprovedSeasonOneSnapshot` combines the exact Season 1 participant check with `validateApprovedSnapshot`'s independent server-owned identities, all full canonical rules/versions, participant/rule hashes and immutable approval validation. A selection alone fails complete-manifest validation. The generic validator allows disjoint domestic participants to change between tiers and requires cup participants to belong to that season's domestic set; this supports later certified outcomes without imposing Season 1 ID ranges. This validator does not certify those outcomes itself or implement the later lifecycle. Only the Season 1-specific path may reconcile an eventual Season 1 production manifest. **`loadApprovedSnapshot()` still returns null**; production preparation stays 422 until independent hashes, full rules, approval reference and complete manifest receive explicit verification. Tests with canonical rules are reconciliation tests, not production approval.

D1 is the authoritative current world and immutable season snapshot source. Season 2 onward must use certified promotions, relegations and qualifications, not the initialization selection or fictional providers. `data/history/` may contain official verified exports only; never use it as a second operational state source.

`tools/dev-debug-config.mjs` contains only DEV control limits, with no catalogue/backend/world dependency. The loopback server serves it under its protected DEV namespace. Protected artifact staging incorporates its bytes into the existing standings client, preserving the independent download verifier's exact module allowlist. The ordinary public artifact includes neither settings nor module. Existing sessionStorage keys, UI and behavior are preserved. No workflow/publication guard, routing, security or deployment policy changes are needed.
