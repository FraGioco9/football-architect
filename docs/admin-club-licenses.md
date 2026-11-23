# CLUB-LICENSES-01 — Admin manual club licenses (initial implementation)

**Scope:** Issue #757. This is not the future concession marketplace, transfer market, club treasury or ARC economy (#755 remains DRAFT).

## Current behavior

- The protected Admin directory includes **Club Licenses**, at `/admin/licenses`. The Admin can browse all 320 canonical clubs, search verified active user accounts, assign/replace a club licensee and revoke a license.
- A single current account per club is enforced by primary-key state. There is no limit on how many clubs an account may be assigned in this first implementation. No fee, expiration, inactivity, sale, compensation, or sporting privilege is implied.
- `0034_club_licenses.sql` adds `club_license_state` and immutable `club_license_events`. Each club tracks a persistent integer version, including after revocation, preventing stale writes or assign/revoke ABA overwrites.
- Admin read: `GET /api/admin/club-licenses` returns canonical club keys, current licensees and the latest 50 events. `GET /api/admin/club-licenses/accounts?q=<text>` searches at most 15 active, verified accounts and returns only IDs/emails.
- Admin mutation: `POST /api/admin/club-licenses` accepts exactly `{clubKey, accountId, expectedAccountId, expectedVersion}`; `accountId: null` revokes. All changes require unified Admin write access, session CSRF, allowed Origin and atomic transactional guards rechecking the current account, state version and live Admin privileges. Only canonical club keys are accepted. Response timestamps are real server UNIX seconds.
- License tables are separate from sporting data and remain untouched by a sporting-world reset. User account deletion is intentionally blocked by the current-row foreign key until the operator revokes that account's licenses, to prevent unlogged reassignment; this account-deletion interaction needs an explicit follow-up before enabling general-purpose licensing.

## Boundaries

Do **not** deploy or migrate any shared/remote D1, grant any actual live license, merge or close the issue without separate owner approval. Client-side displays/confirmation are convenience only, not authorization. No public licensee endpoint or manager gameplay permissions are introduced.

## Suggested QA

Run focused Backend Worker/D1 tests for `club-licenses-runtime.test.ts`, Node Admin page and route tests, canonical generator `node tools/generate-app-pages.mjs --check`, and verified UI in Chrome desktop/iPhone Safari on a truly local isolated Worker/D1. Review exact PR HEAD CI. All state-changing Admin flows require deliberate account/club selections.
