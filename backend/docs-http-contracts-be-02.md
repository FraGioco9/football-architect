# BE-02 — Backend HTTP wire-contract consolidation

> **Living contract — REPO-04 #358, 2026-11-06.** The current section describes reviewed repository source at `main@f9b595636d02d4a1ebfdbd967e1a97c18f2dd41d`. Dates, SHA baselines, Draft/HOLD labels and gates in the following original record are **historical evidence**, not today's release state. No merge/deploy/remote D1 authorization is implied.

## Current public, Player and Admin HTTP contract

`backend/src/index.ts` dispatches public routes; `http-player.ts`, `http-admin.ts` and `http-contract.ts` own methods, envelopes, errors, auth and origin rules. This is a **source-implemented endpoint inventory**, not permission to call hosted endpoints.

| Access | Implemented routes | Boundary |
| --- | --- | --- |
| Anonymous world | `GET /api/world` | Validated global projection; never fictional DEV data |
| Anonymous sporting | `GET /api/competitions/{IT,ENG,ES,DE,FR,PT,NL,BR}-{1,2}/seasons/{n}`; `GET /api/competitions/int-{1,2}/seasons/{n}` | Verified season data, no inferred future scores |
| Anonymous calendar | `GET /api/calendar/seasons/{n}/days/{1..56}` | Read-only day projection |
| Nonproduction handshake | `GET /api/environment` | Explicit configured `dev-preview` pool only; fail closed elsewhere |
| Private local inbox | `/api/local-dev/inbox` | Local loopback-only, never public or hosted |
| Player account | `/api/player/*` | Registration, verification, login, recovery, permissions and account actions; exact method table in `http-player.ts` |
| Admin operations | `/api/admin/*` | Verified Player session **and** linked enabled Admin grants, CSRF/Origin, idempotency and transaction checks |

Input validation, `409 stale_world`, `422` invalid request and `503` unavailable responses follow actual implementation. The intentional method/Allow differences must not be flattened. [Auth policy](docs-auth-security-be-05.md), [Debug/state](../docs/state/sh-03.md), [lifecycle](docs-season-lifecycle-be-04.md). API paths/public identifiers are **not** part of #370 private renames.

## Historical implementation audit (retained)

Baseline: `main` `08c04e7363c19cc227264e0c170760317512cbb5` (squash of #373).
Issue: #349. Historical #346 was closed unmerged; no files were copied from that branch.

## Inventory and ownership

| Boundary | Handler | Shared wire contract | Preserved route authority |
| --- | --- | --- | --- |
| Anonymous public | `src/index.ts` | JSON content-type, `no-store`, `nosniff`, method 405 without Allow | Environment-pool gate; anonymous world projection; 409 stale-world and 503 availability concealment |
| Player | `src/http-player.ts` | Account-private headers, JSON, 4 KiB strict UTF-8 body, duplicate-cookie rejection, method 405 with Allow, error shape and 429 retry | Origin requirement; account sessions, CSRF, cookie flags and expiry, registration/reset delivery, rate limits |
| Admin | `src/http-admin.ts` | Same account-private wire contract | Unified Player identity and Admin grants, operator bridge, mutation CSRF, idempotency, mutation preconditions |
| Local-only inbox | `src/local-dev-inbox.ts` | Local-private headers, JSON and method 405 | Explicit local opt-in, origin/fetch-site checks, HTML CSP, no Production availability |

`src/http-contract.ts` owns only header profiles and protocol-level helpers. It has no DB, role, origin, environment, authentication or domain dependencies. The profiles are intentionally **not interchangeable**. Local inbox HTML keeps its existing CSP and HTML content-type override.

## Behavior-preserving decisions

- Strict `application/json` (case-insensitive token before semicolon); 4,096 **raw bytes** at most; fatal UTF-8; malformed/no body is `invalid_json`; media mismatch is `json_required`; overflow is `request_too_large`. Streaming cancels on overflow.
- Duplicate exact-name session cookie is `401 unauthorized`, even if one value is empty; missing is an empty value and cannot authorize a user.
- Account responses retain `private, no-store, max-age=0`, `Pragma`, `Vary: Cookie`, `noindex`, `nosniff`, and no-referrer. Public retains plain `no-store`; local-only inbox retains its previous private response policy.
- Account method rejection retains `Allow`; the existing public/local-only method rejection deliberately does **not** add it, to avoid a response contract change.
- API errors still expose only `{error:{code}}`; rate-limit errors preserve `Retry-After: 900`; unexpected exceptions are sanitized to each boundary's existing availability code.
- CORS/Origin checks are **not** extracted into a universal bypassable middleware: `requireMutationOrigin` and local-inbox origin/fetch-site policy remain unchanged.
- No changes to session issuance/revocation, CSRF, permissions, SQL, D1 schema, calendar or sport rules, static pages, Debug transports, secrets or deploys.
- Timeout policy: no new global timeout is imposed on DB/command execution by BE-02. Request bodies remain size bounded; any future deadline needs independent per-route cancellation and idempotency review.

## Acceptance

Focused test: `cd backend && npx vitest run tests/http-contract-runtime.test.ts tests/http-public-runtime.test.ts tests/auth-runtime.test.ts tests/player-auth-runtime.test.ts tests/player-registration-runtime.test.ts tests/player-password-reset-runtime.test.ts tests/local-dev-inbox-runtime.test.ts`

Typecheck: `cd backend && npm run typecheck`. Existing security/runtime suites must be preserved. Record final HEAD and exact-head CI evidence on the PR before requesting merge approval.

## Parallel scopes

#359 owns page first-paint/refresh; #353 owns canonical sporting rules/data contracts; #350 owns D1 repository/SQL/transactions. None of these are modified in BE-02.
