# PLAYER-AUTH-01 — Protected entry and return routing

## Implemented destinations
- `/account/` is the currently implemented personal protected entry. It checks `GET /api/player/session` on load, including a server-side credential-version and expiry check. On 401, missing authentication or malformed session identity, navigate to `/account/login/?next=%2Faccount%2F` without rendering private account content.
- An account mutation returning 401 also triggers the same login redirect. Temporary service errors do not present the user as authenticated and expose no private content.
- The login page takes only `/account/` and `/settings/` as approved return destinations. Invalid or unrecognized `next` inputs fall back to `/account/`; no external URL, protocol-relative redirect, API path or arbitrary nested path is accepted.
- `/settings/` is a public page that also hosts an explicitly permission-gated Admin panel. Its public settings content stays browseable anonymously. For its protected Admin section, sign-in goes through `/account/login/?next=%2Fsettings%2F`. A valid Player session **without** `admin.access` AND `admin.world.read` shows localized denied access, not the Admin world. Write controls require `admin.world.write`; every Admin API independently enforces D1-derived grants.
- Public world views, competitions, club directory and guides remain accessible anonymously. Login does not create a new world or enable gameplay.

## Deferred final verification
Exercise redirects on expired, revoked, malformed and missing sessions; validate safe and rejected `next` strings; verify public settings remains accessible; verify non-admin Player cannot read or mutate shared Admin state, including by direct API calls, in all five locales and mobile/desktop browsers.
 
This is an implementation/scope contract, not a claim of test PASS. No deploy or remote D1 changes.
