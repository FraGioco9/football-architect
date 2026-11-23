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


## Local API bridge and environment readiness

- The loopback DEV proxy must forward protected `GET/POST /api/admin/club-licenses` and exact `GET /api/admin/club-licenses/accounts?q=...` without widening anonymous/LAN access. The list response may exceed 64 KiB with 320 licensees, so it has a protected-only 256 KiB cap.
- Use this branch's local Worker, not an older hosted Preview Worker. A static preview alone cannot serve the protected API. `node tools/dev.mjs --shared ...` requires a separately approved Worker publish.
- **Local isolated D1 only:** From PowerShell in the repository's `backend` folder, run `npx wrangler d1 migrations apply fa-admin-world-local --local --config wrangler.toml`, then start `node tools/dev.mjs --local` from the repository root. Verify the local binding and the CLI confirmation before applying any migration.
- Never add `--remote` or apply migrations to `football-architect-dev` or Production without separate owner approval. The default `node tools/dev.mjs` uses shared remote DEV D1, which needs its own separately authorized additive schema application.
- The UI distinguishes an unavailable endpoint (404), missing schema (503), authentication failure, unavailable backend and unexpected API data instead of showing one generic message.

## Cloudflare DEV D1 migration (2026-11-23)

Verified `football-architect-dev` (`6a6c7803-56d3-4e7f-bd01-752d06a32341`) had `0033_portrait_v42_replacement.sql` applied and no license tables. With owner approval, applied the exact additive `0034_club_licenses.sql` schema via Cloudflare D1 REST batch and registered `0034_club_licenses.sql` in `d1_migrations`. The two tables, two indexes, two immutable-history triggers and migration entry were independently verified; `PRAGMA foreign_key_check` was clean. There were zero license rows or events; the player/portrait row counts stayed 150/150. **No hosted Worker deployment, Production migration, license assignment or PR merge occurred.**

For ordinary shared DEV, use `node tools/dev.mjs` from the project root, without `--local`. A new locally executed Worker reads this already-migrated remote database. Avoid repeating migrations; `--local` points at a different database.
