# #545 — One authoritative Club Fixtures endpoint

**Branch status:** Draft/HOLD. Changes to the backend source and client are not deployed by opening a PR.

## Public contract

`GET /api/clubs/{COUNTRY}-{CLUB_ID}/seasons/{n}/fixtures`

- Anonymous GET; no query string; no write behavior, D1 migrations or token/session access.
- `COUNTRY` is one of IT/ENG/ES/DE/FR/PT/NL/BR; `CLUB_ID` is 1–40 without leading zeros; `n` is a positive safe integer.
- Same `schemaVersion:1`, `providerId:'authoritative-world'`, `clubKey`, `selectedSeason`, `world`, `status`, `reason`, `provenance`, `data` envelope as the existing public sporting endpoints.
- An available publication includes `data:{season,seasonState:{day,phase},competitions:[ids],fixtures:[...]}`. Only fixtures involving the requested club are returned. Fixtures retain the canonical competition ID, home/away identities, sporting day, phase/round/tie/leg/marker, neutral venue and verified score or `null`. Unresolved future ties cannot appear before they exist in authoritative progression.
- Exact-world `409 stale_world`, unsupported public seasons and no-publication states use the established empty/unavailable envelopes. Results beyond the verified sporting day are never sent. Season 0 is unstarted and is handled without a fixture request in the Club Fixtures client.
- Historical seasons 1–2 use the closed historical day 56 and archived proof chain. Future/unimplemented seasons are explicitly unavailable and never remapped to Season 1.
- Response is `Cache-Control: no-store`; the current per-world public read cache remains in the browser. Error bodies expose only public error codes.

## Backend implementation

`backend/src/public-sporting-read.ts` reuses the same `readPublicProjection` validation path for D1 calendar hashes, stored daily receipts, knockout plans and archive/closure proofs. After one shared reconstruction, it filters league and published knockout fixtures for the club. No per-competition backend projections, new source of scores, new DB query scheme or write path.

The request may still be CPU/D1 heavy because reconstructing a validated season is substantial. The API reduces **client HTTP fan-out and redundant server projections**; it does not imply a measured latency improvement until benchmarks are collected.

## Frontend integration and compatibility

`assets/club-fixtures-source.mjs` reads the new endpoint once and verifies: club, season, exact world snapshot, publication status, provenance, competition membership, fixture participants and played-day/result coherence. It projects the same club-perspective rows and competition definitions as before. The controller, per-world read cache, parser-time skeleton, protected DEV fixture preview, filtering, links, focus and responsive layout are otherwise unchanged.

**Deployment sequencing:** The old Worker does not implement this route. The new site code and new Worker must be published together after separate authorization; publishing only the client before the Worker would make authoritative Club Fixtures unavailable. No deployment occurs in this task.

## QA and concurrency

Targeted tests:

```powershell
node --test tests/club-fixtures-source.test.mjs tests/club-pages.test.mjs
node --test --test-name-pattern="CLUB-FIXTURES browser" tests/club-pages-browser.test.mjs
npm --prefix backend run typecheck
npm --prefix backend run test:contracts
```

The backend runtime fixture test additionally covers Season 0, unpublished calendar, live results and 36 expected domestic+international league fixtures from one club. Browser QA verifies the new route is used without a fallback to per-competition HTTP calls.

**Parallel:** PR #542 for mobile QA #527 modifies Club Fixtures CSS, the next-match action and responsive checks. The #545 PR is based on the latest main, separate from #542, and does not claim the pending mobile improvements. Integrate/rebase carefully after the owner authorizes the necessary merges. No automatic merge, deploy or remote D1 operations.
