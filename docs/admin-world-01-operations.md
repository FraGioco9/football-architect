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
- `POST /api/admin/seasons/prepare` requires configuration, authentication, exact Origin, CSRF, strict command fields and Idempotency-Key. It returns422 `catalogue_not_approved` while the server-owned production manifest is absent. No caller approval flag or fictional data can enable it; no sporting state is written. Successful atomic preparation, synthetic positive command scenarios and minimal generated Admin Settings remain subsequent work in the same approved plan.

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

The configured development application origin is `http://app.localhost:2000`. Mutation Origin must match exactly; local API requests must terminate on approved loopback hosts. The static application does not yet have the Admin console or API bridge, so this backend batch does not claim a usable browser Admin Settings flow. The restart integration test temporarily uses its own loopback origin/port and synthetic operator; it does not change development configuration or create a real account.

To replace a local operator password and revoke all sessions:

```sh
npm --prefix backend run admin:account -- replace-password --email operator@example.invalid --persist-to /absolute/local-state
```

No command accepts `--remote`, database URLs or production credentials. Do not send passwords in chat. Back up local persistence using appropriate offline filesystem procedures before operator maintenance. There is no public reset-email or SMTP flow.

## Deployment and acceptance gates still open

Production Admin requires HTTPS, exact configured origin and explicit Cloudflare trusted-source configuration; missing/inconsistent configuration fails503. Production source trust and topology have not been exercised remotely and must not be enabled merely by copying local variables. No remote database ID, production account or deployment was created by this work.

Still required for PR 1 acceptance: approved-catalogue snapshot validation and atomic positive prepare/idempotency/concurrency/rollback behavior, generated Admin Settings and same-origin preview bridge, browser stale-response/locales/accessibility checks, complete publication/fixture isolation and final exact-head acceptance. Production Season 1 remains blocked without approved canonical participants/rules. Season lifecycle/calendar/draw/public integration and full sporting reset remain the later approved slices; do not implement a match engine or promote DEV output into production.

The source of truth for test counts and exact HEAD is PR #316 CI and issue #315, not a green check on a previous SHA. Keep Draft/HOLD while these gates are missing. API errors omit SQL, verifiers, passwords and session/CSRF secrets. Static publication remains an explicit allowlist; backend source, lockfiles, migrations, operator tools and WASM are excluded by a dedicated actual-publication-plan regression.

## Review and regressions

Independent review identified persistence-descendant symlinks and unbounded denied-source throttle growth. Both were reproduced by failing tests and fixed; expiry cleanup is bounded and source denial occurs before new account rows. Additional negatives cover cookie ambiguity, session rotation, absolute/idle expiry, disabled accounts, storage failure and logout replay. Real Wrangler restart tests verify a synthetic session and singleton generation across restarts and two independent anonymous clients. The inspector uses an explicit ephemeral loopback port to avoid unnecessary network-interface discovery in restricted environments; no test is skipped or replaced by a mock for that case.

Primary runtime references: [D1 database/batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Cloudflare Vitest test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/). Actual local transactional and restart tests remain necessary; documentation alone is not acceptance evidence.
