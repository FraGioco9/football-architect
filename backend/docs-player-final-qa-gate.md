# PLAYER-AUTH-01 — Final consolidated validation gate (not executed)

## Policy
Owner requested a **single final test phase**, without full suites on every implementation commit. Draft/HOLD, no deploy, no production D1 and no outbound email provider. All assertions below are pending until actually run and reviewed.

## Unified authentication tests
- `backend/tests/auth-runtime.test.ts` — Player cookie on Admin routes, old Admin login/logout HTTP 410, origin/CSRF, read/write isolation, credential revocation.
- `backend/tests/player-auth-runtime.test.ts` — verified/unverified identities, sessions, failed login, privilege boundaries.
- `backend/tests/admin-operator-migration-runtime.test.ts` — explicit 1:1 operator mapping, no auto-grant, atomic rollback and audit preservation.
- `backend/tests/admin-calendar-command-runtime.test.ts` — Admin HTTP mutation with verified Player session, write permission and CSRF.
- `backend/tests/admin-calendar-bridge-runtime.test.ts` — archival and next-season read HTTP routes with Player session.
- `backend/tests/admin-calendar-clock-runtime.test.ts` — event calendar read HTTP routes with Player session.
- Existing standalone command fixtures using synthetic legacy `AdminSession` test only historical audit/transaction internals, **not** the retired Admin HTTP login. They must not be counted as evidence of live legacy login support.

## Additional acceptance
- Local D1 migrations and fixture isolation with foreign keys enabled.
- Worker auth/recovery/session tests, including privacy headers, replay and invalid/missing Origin.
- Site checks/ESLint/TypeScript/browser QA desktop and iPhone, five locales.
- Existing sporting world public read regressions and administrative event lifecycle.
- Exact-head CI, independent review of flaky failures, and only then release approval.

No statement of PASS until this gate has been executed.
