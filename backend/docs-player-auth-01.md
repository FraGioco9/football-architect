# PLAYER-AUTH-01 — foundation / design review

Issue: #170. Draft/HOLD. No remote D1, deployment, workflow modification or provisioning.

## Existing trust boundary
The current Worker dispatches `/api/admin/*` to `handleAdmin`; public world and sporting GETs are anonymous. Admin identity lives in `admin_accounts`, `admin_sessions` and `auth_throttles`. Admin passwords use the existing Worker-compatible Argon2id implementation. Token digests and CSRF digests are stored server-side. The player route must be a separate `/api/player/*` dispatch and may **never** call admin command handlers.

## First implemented increment
`0013_player_auth.sql` adds only four player-prefixed tables; it does not add player privileges or touch world tables. Account status and verification timestamps are persisted without deciding the registration UX. Token purposes are restricted to verification and password reset. Digests are SHA-256-sized columns, not raw bearer tokens. Player sessions refer only to player accounts and cascade on account deletion. Migration and isolation contracts live in `tests/test_player_auth_migration.py`.

The next backend increment implements opt-in /api/player/login, /api/player/session and /api/player/logout. Player bindings PLAYER_MODE and PLAYER_ORIGIN are required; absent configuration fails closed. Existing Admin endpoints and public routes are unchanged. Login requires an active, email-verified Player account; public registration and email dispatch remain deliberately disabled until delivery integration is approved. Worker tests cover login/session restore/CSRF/logout/rotation prerequisites and isolation; their execution is not yet confirmed.

## Follow-on engineering plan (2–3 cohesive PRs)
1. This PR: D1 schema, verified local migration contracts, Player Worker service with scoped auth, session lifecycle and security tests after product decisions.
2. UX/integration: five locales, mobile/keyboard accessibility, protected routing and functional player account journeys.
3. Only if needed: final independent QA/CI fixes; exact-head and no-deploy guard checked before merge authorization.

## Recommended decisions requiring owner approval before dependent implementation
- Registration: email + password only; no username, real name or date of birth.
- Verification: mandatory before usable login; pending account stays non-privileged.
- Email: adapter interface first; choose an explicit Cloudflare Workers-compatible delivery provider after free-tier/terms review; no external account setup without consent.
- Sessions: 30 days absolute, idle expiry 7 days, rolling last-seen, revocable across devices, rotate on login/password reset. Keep admin 8h/30m policy unchanged.
- Reset: opaque single-use hashed token valid 30 minutes; generic public response, invalidate prior reset tokens; credential-version increment and revoke all sessions upon successful reset.
- Deletion: require recent password confirmation, revoke sessions immediately, delete credentials/tokens; define minimal retention for security logs and future sporting participation before implementing.
- Destination: /account after first login, and allow only relative same-origin safe return paths.
- Registration: small initial rate limits per IP/email, with Turnstile enabled for suspicious traffic if free/available.

## Non-negotiable security before enabling auth
Server-side origin + CSRF verification on state-changing operations; httpOnly Secure SameSite cookies; scoped throttle keys; constant-cost unknown email handling; password Argon2id with random salt; digest-only token storage; transactional one-time token consumption; no player-to-admin escalation; no cached private data; public routes remain anonymous; forbid remote D1 in tests. Turnstile never replaces backend rate limits.

## Validation
Targeted checks: `python -m unittest backend/tests/test_player_auth_migration.py` from repository root, then `cd backend && npx vitest run tests/player-auth-runtime.test.ts` in a locally provisioned Worker/D1 test environment. New targeted tests are committed but not yet confirmed PASS.
Full integration, real Worker+D1 and browser checks are deferred by owner instruction.
