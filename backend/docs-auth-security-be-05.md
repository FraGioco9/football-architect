# BE-05 — Backend authentication/security audit and compatibility guarantees

> **Living contract — REPO-04 #358, 2026-11-06.** The current section describes reviewed repository source at `main@f9b595636d02d4a1ebfdbd967e1a97c18f2dd41d`. Dates, SHA baselines, Draft/HOLD labels and gates in the following original record are **historical evidence**, not today's release state. No merge/deploy/remote D1 authorization is implied.

## Current implemented security and release boundary

`backend/src/http-player.ts` provides verified Player sessions, registration, verification, login and recovery. `http-admin.ts` authorizes Admin requests only with the **current verified Player session plus explicitly enabled linked audit operator and D1 permission grants**; self-registration does not grant Admin. Argon2id, rate-limit reservation, CSRF, trusted origin/source, cookie and operation idempotency checks remain server-owned. Local loopback and HTTPS Preview/Production use distinct security and cookie configurations. [API routes](docs-http-contracts-be-02.md), [local DEV](../docs/architecture/dev-env-01-startup.md), [nonproduction pool](docs-shared-nonproduction.md).

Merged [PR #329](https://github.com/FraGioco9/football-architect/pull/329) and the closed technical acceptance #170 establish implementation; they do **not** certify Production release, live email deliverability, DNS, remote D1, secrets, or operator cutover. The old BE-05 Draft/HOLD wording below is a dated implementation gate, **not** an assertion that code remains unmerged. All remote provisioning still needs separate owner approval.

## Historical implementation audit (retained)

Issue #352. Starting point: `main@2b7a671aad738a7ac0b8645b39fb32d0761514b1`; squash merges #380/#354/#351/#350 and earlier #348/#349 verified. Discarded pre-#347 branches are not implementation inputs. Draft/HOLD, no auth cutover, remote D1, deploy or secret changes.

## Threat boundaries and endpoint permission matrix

| Exact route group | Anonymous | Player without Admin grants | Linked Admin with grants | Gate |
| --- | --- | --- | --- | --- |
| `GET /api/world`; `GET /api/competitions/{IT,ENG,ES,DE,FR,PT,NL,BR}-{1,2}/seasons/{n}`; `GET /api/competitions/int-{1,2}/seasons/{n}`; `GET /api/calendar/seasons/{n}/days/{1..56}` | Read | Read | Read | Public projection, input check, environment pool guard; no bearer authority |
| `POST /api/player/login` | Yes | Yes | Yes | JSON, exact Origin, hashed source+account throttling, active verified identity, Argon2id, new opaque cookie |
| `POST /api/player/register`, `/api/player/verify-email` | Yes | Yes | Yes | Exact Origin, registration limits, pending/verified transition, generic duplicate-email result, single-use verification digest; delivery gate |
| `POST /api/player/password-reset/request`, `/api/player/password-reset/complete` | Yes | Yes | Yes | Origin, reset throttle and generic unknown-email result, expiring single-use token, password rotation/revocation; delivery gate |
| `GET /api/player/session`, `/api/player/sessions`, `/api/player/permissions` | 401 | Own account | Own account | Valid Player cookie, account version, verification, 30d absolute/7d idle session and DB recheck |
| `POST /api/player/logout`, `/api/player/account/change-password`, `/api/player/account/revoke-other-sessions`, `/api/player/account/delete` | 401 | Own account only | Own account; linked Admin deletion denied | Player session, Origin, CSRF, atomic preconditions; password changes revoke linked legacy sessions |
| `GET /api/player/admin/world` | 401 | 403 | `admin.access` + `admin.world.read` | Verified enabled audit link, same email, current D1 grants |
| `GET /api/admin/session`, `/api/admin/world`, `/api/admin/seasons/events`, `/api/admin/seasons/archives`, `/api/admin/seasons/history`, `/api/admin/seasons/next-candidate` | 401 | 403 | `admin.access` + `admin.world.read` | Unified Player session + linked historical audit identity |
| `POST /api/admin/seasons/next-approve`, `/next-prepare`, `/prepare`, `/calendar`, `/start`, `/advance`, `/archive`, `/close` | 401 | 403 | `admin.access` + `admin.world.write` | Origin + Player CSRF, current D1 grants, transaction-time guard and sporting/idempotency preconditions |
| `POST /api/admin/seasons/events/reschedule`, `/initialize`, `/confirm`, `/start`, `/advance`, `/domestic-calendar`, `/international-draw`, `/international-calendar`; `POST /api/admin/world/reset` | 401 | 403 | `admin.access` + `admin.world.write` | Same Admin mutation boundary with domain-specific commands |
| `POST /api/admin/login`, `POST /api/admin/logout` | 410 | 410 | 410 | Legacy Admin credentials retired: no session issuance or revocation |
| `GET /api/environment` | Preview pool metadata | Same | Same | Preview only, `dev-preview` D1 marker, no query or private identity fields |
| `GET /api/local-dev/inbox` | Local opt-in | Local opt-in | Local opt-in | Local loopback, origin/fetch-site restrictions, private headers + HTML CSP |
| Unrecognized API route or wrong method | 404/405 | 404/405 | 404/405 | Exact match before auth; no fallback dispatch |

401/403 assume an otherwise correctly configured Worker, correct HTTP method and, for mutations, an allowed Origin. Invalid environment returns 503 first. Wrong method returns 405 before auth; missing/foreign Origin returns 403 before session validation. No implicit Admin power from being a Player, front-end flag, email match, or legacy credential.

## Session, credential, CSRF and rate-limit inventory

- **Player session:** `player_sessions` stores SHA-256 token/CSRF digests, not bearer secrets. `fa_player_local` on local loopback; `__Host-fa_player` on HTTPS Preview/Production. `HttpOnly; SameSite=Strict; Path=/`, with `Secure` outside local. Reject duplicate cookie names, stale credential versions, unverified/disabled identity and invalid session timestamps; idle 7 days, absolute 30 days. Session listing returns only sanitized timestamps and `current` boolean.
- **Admin:** requests use the same Player cookie plus explicit `admin.access` and read/write grants, an enabled linked audit operator whose normalized email matches. The legacy `admin_sessions` lifetime (30m idle, 8h absolute) remains separate but has no HTTP Admin authority. A live Admin write must re-pass the D1 link, session and grant guard in the same batch as the world mutation.
- **CSRF/Origin:** `requireMutationOrigin` is exact-match to server-configured origin for every POST and any request including Origin. Invalid/missing/wrong CSRF digest is `403 csrf_forbidden`. Shared verifier keeps independent `fa-player-csrf-v1` and `fa-admin-csrf-v1` token derivation. Unified Admin uses the Player CSRF namespace. Local inbox has its own fetch-site gate; no generic middleware weakens it.
- **Passwords:** Argon2id m=19456 KiB, t=2, p=1 with 16-byte random salt, 32-byte tag, 15–128 Unicode code points, maximum 512 UTF-8 bytes, no normalization/truncation, synthetic verifier for unknown/disabled login; bounded WASM queue. Password update/recovery invalidates sessions and one-time links, including legacy Admin sessions for linked accounts. Never log/return verifiers, raw tokens or token digests.
- **Rate limits:** Player login `source:`/`account:` — 30/5 attempts per 900s; registration `registration-source:`/`registration-account:` — 10/3 per 3600s; recovery `reset-source:`/`reset-account:` — 10/3 per 3600s. Keys are SHA-256 of trusted source and normalized email, source reserved first, SQL atomic. All 429 responses retain the existing `Retry-After: 900` wire contract. Legacy Admin throttles use **different** table/cleanup/decrement logic and are deliberately not combined.
- **Request/response:** Account APIs use `Cache-Control: private, no-store, max-age=0`, `Vary: Cookie`, `Pragma: no-cache`, `Referrer-Policy: no-referrer`, `X-Robots-Tag` and `nosniff`; public endpoints use no-store. JSON input is bounded to 4096 UTF-8 bytes; unexpected failures expose only stable error codes.

## Environment isolation / external dependencies

- Local app Origin must be loopback HTTP with local D1. Separate opt-in local inbox and Debug boundaries remain unchanged.
- Dev bridge + hosted Preview can share an explicitly stamped `dev-preview` D1 and world; each browser frontend signs in independently and has a separate host-only cookie/session. The bridge checks the pool before forwarding cookies and sends `X-FA-Expected-Pool: dev-preview`; Production rejects this request claim.
- Preview requires exact HTTPS configured Origin, Cloudflare trusted source, and `dev-preview` pool marker. Production must use a separate Worker, D1 and account pool and the secure cookie configuration. **Known exception:** unstamped local/Production D1 is still accepted for legacy compatibility; a missing marker does not demonstrate isolation. Changing that requires separately authorized rollout.
- Neither the source tree nor disposable CI proves actual remote D1 bindings, Cloudflare edge source behavior, DNS, email delivery, Gmail sender, physical iPhone Safari, or completed operator cutover. These remain **UNKNOWN pending separately approved live QA**, not silent PASS. See `docs-shared-nonproduction.md`, `docs-gmail-preview.md`, `docs-cloudflare-auth-environments.md` and owner runbooks.

## Measured duplication and intentionally distinct boundaries

1. Identical Player login/registration/reset D1 throttle reservation SQL consolidated in `src/auth-throttle-policy.ts` with original table, namespace, ordering, timings, limits, result and error behavior. Admin throttle remains its own state machine.
2. Duplicate digest comparison and malformed-token handling consolidated in `src/csrf-policy.ts`; `requireCsrf` and `playerRequireCsrf` remain separate wrappers and the existing CSRF namespace derivations are unchanged.
3. Retained deliberately: Player vs Admin handlers, authorization joins, transaction-time guards, HTTP profiles (BE-02 #349), request-Origin vs inbox fetch-site rules, lifecycle clocks, password & one-time-token D1 transactions. No schema, cookie format, role, external provider or HTTP route changed.

## Verification plan / evidence ledger

- New pure Node tests: `auth-throttle-policy.test.ts` (source-first and account denial; separate hashed namespaces/limits/expiry SQL); `csrf-policy.test.ts` (valid tokens, cross-namespace rejection, missing/malformed/foreign).
- New Worker/D1 negative matrix: `auth-boundaries-runtime.test.ts` (every protected active Admin path, private Player paths, anonymous denials, unprivileged Player denials, legacy retired endpoints, origin/cookie failure and anonymous public world).
- Existing suites must remain passing: `auth-runtime`, `player-auth-runtime`, `player-registration-runtime`, `player-password-reset-runtime`, `session-policy`, `origin-policy`, `http-contract-runtime`, `shared-nonproduction-runtime`, `hosted-preview-runtime`, account UI and operator lifecycle.
- Commands: `npm --prefix backend run test:contracts`; `npm --prefix backend run typecheck`; `npm --prefix backend test`, then exact-head required GitHub CI. Record PASS/FAIL/UNKNOWN based on observed runs only. **No remote DB/email/provider or deployment test is authorized.**
