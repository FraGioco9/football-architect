# PLAYER-AUTH-01 — Unified Admin runtime cutover

This draft replaces the separate Admin sign-in runtime with the Player account session.
The historical `admin_accounts` table remains **only** as an immutable audit principal for existing `admin_operations`; it is not a login provider for Admin HTTP requests.

## Runtime
- `/api/admin/login` and `/api/admin/logout` return 410, and the Admin Settings UI has no old password form.
- Admin Worker now uses only `PLAYER_MODE`, `PLAYER_ORIGIN` and `PLAYER_TRUSTED_SOURCE` for transport trust, matching Player cookie mode and origin. No `ADMIN_MODE`, `ADMIN_ORIGIN` or legacy Admin cookie dependency remains in its HTTP configuration.
- A valid unified Player session and explicit D1 `admin.access` plus `admin.world.read` (GET) or `admin.world.write` (POST) are required for Admin HTTP access. POST also requires Origin and CSRF.
- Each historic operator must be linked explicitly by the trusted offline migration step; the legacy Admin ID is used only to maintain audit foreign keys, never as a separate credential.
- Admin write commands use a transaction-bound unified account/permission/session/audit-link guard. `atomic-guard.ts` contains the single shared D1 guard mechanism, avoiding circular dependencies.

## Outstanding gates
- Locally provision and verify explicitly authorized operators before enabling the cutover.
- Update existing Admin contract fixtures and execute exact-head Worker+D1/browser regressions, including auth revocation and rollback, in the owner-approved final test phase.
- Do not remove historical `admin_accounts` or `admin_operations`, or release/merge without separately approved QA and rollback.

Draft/HOLD. No deploy, remote D1, provider configuration or test execution.
