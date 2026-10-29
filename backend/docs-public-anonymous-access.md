# PLAYER-AUTH-01 — Anonymous public browsing contract

## Existing public pages
- `/`: landing page.
- `/clubs` and `/clubs/:country/:club/:view`: club directory and club detail pages.
- `/competitions` and competition detail views: domestic and international competitions.
- `/guide`: user guide.
- `/calendar` and `/dashboard`: existing public/read-only UI views; they do not require Player identity.
- `/settings`: public settings shell. Its embedded World Administration section is separately access-controlled and never implies that the entire settings page requires login.

## Server contract
- `GET /api/world`, `GET /api/competitions/:id/seasons/:season` and `GET /api/calendar/seasons/:season/days/:day` are routed before `/api/player/*` and `/api/admin/*`.
- Their authorization never checks cookies or account permissions. A missing Player origin/provider or malformed Player/Admin cookies must not block public read.
- World responses are schema-projected; sporting and calendar responses use public sporting repositories. No email, password verifier, session, account permission or reset token is projected.
- Requests to protected Player or Admin APIs still require server-side authentication and permissions. Public browsing does not grant rights to mutate sporting state.

## Final QA (deferred)
- Desktop and iPhone Safari in EN/DE/ES/FR/IT: landing, directory, club, competition, guide and public calendar with no cookie.
- Repeat public API reads with invalid and obsolete cookies, and with Player auth disabled.
- Confirm public pages do not redirect to sign-in; only the personal Account view and protected Admin section do.
- Verify Cloudflare and Vercel routing and no private data in public JSON or caching.

Implementation contract recorded; do not label final browser or Worker regressions as passed until executed. Draft/HOLD; no deploy or remote D1.
