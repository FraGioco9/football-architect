# Canonical Football Architect Preview — Cloudflare only

**Official Preview URL:** https://preview.football-architect.workers.dev

**Sole manual release workflow:** [Manual Cloudflare DEV Preview](https://github.com/FraGioco9/football-architect/actions/workflows/manual-cloudflare-dev-preview.yml). The former Manual Vercel Preview workflow has been retired; historical Vercel Preview URLs are not official application entry points.

## Immutable nonproduction boundary

The only Worker deployment target is `preview`, within Cloudflare account `e20c88bb42826f59efea469af0f82f96`, using existing D1 `football-architect-dev` (`6a6c7803-56d3-4e7f-bd01-752d06a32341`, pool `dev-preview`). Preserve existing login sessions, Player accounts, Admin permissions, world data, numeric-ID players, and Preview email settings. No Production, D1 migrations/imports/resets or credential changes are part of a release.

## Uncommitted player Preview retention

Player previews expire after one hour and cannot then be committed. New authenticated preview generation prunes a bounded set of expired, uncommitted drafts. The canonical hosted Preview Worker package also declares an hourly Cloudflare Cron Trigger (`15 * * * *`, UTC) to physically remove expired uncommitted previews when no one uses the generator. Confirmed batches remain FK parents for permanent players.

The cron requires a separately authorized manual Preview deployment; adding this source does not change the currently deployed Worker, its D1, or Production. Publishing this package will configure Preview triggers, so review the current schedule inventory, rollback path and Cron Events after deployment.

## Owner-only release

1. Ensure the **latest** push-triggered Site checks and Browser QA are `success` on the **exact** `main` SHA.
2. The owner runs `Manual Cloudflare DEV Preview` manually from `main`, with `expected_sha` equal to that exact SHA. The GitHub Actions secret `CLOUDFLARE_PREVIEW_API_TOKEN` must exist.
3. A secret-free job stages immutable frontend/Worker code and verifies source SHA, the public asset allowlist, target account, exact Worker name and existing D1 binding. The publishing job checks the downloaded file hashes independently, then deploys with pinned Wrangler and `--keep-vars`.
4. Read-only smoke checks must pass at the canonical domain: `/api/environment`, `/api/world`, `/api/players/page/1`, `/account/login`, `/players`, plus unauthenticated `/api/player/session` and `/api/player/permissions` (HTTP 401, not 302, 404 or 503).
5. Verify Football Architect login using an actual account, then world, calendar, competitions, clubs, players and permissions in the browser. Anonymous smoke checks do not prove authenticated login works.

Shared DEV uses the same backend and D1 only when explicitly selected:

```powershell
node tools/dev.mjs --shared https://preview.football-architect.workers.dev
```

The legacy Vercel Preview alias and redundant Worker `football-architect-preview` must be retired only **after** canonical smoke and authenticated QA succeed. Keep the historical Vercel project and any Production-related configuration unaffected.
