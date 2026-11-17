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

## #615 — Single club API during partial draw publication

Before the full world calendar exists, the backend obtains an evidence-checked view of **already committed** domestic and international draws using internal D1 reads. The existing `GET /api/clubs/{club}/seasons/{n}/fixtures` returns `status:'partial'`, `provenance.resultAuthority:'published-draw-v1'`, and official future league rows with numeric `id`/`matchId`, `result:null`, and the normal club fixture data shape. The provenance hash is constructed from verified competition publication hashes. If no official draw exists, the endpoint retains its `calendar-unpublished` empty response. After calendar publication, the original scored/archived authority and contract remain unchanged.

The browser calls **only the club endpoint**, including during partial publication; it no longer probes four competition APIs. The Worker discovers only published scopes containing this club and reuses existing validated public competition draw logic internally. Zero per-competition HTTP requests, no staged fixture leakage, no fabricated results, no new database writes. Source, season, world, count and fixture identity checks fail closed. Deploy the matching site and Worker versions together only with separate authorization; the PR remains Draft/HOLD on #612.

## #657 — Club Fixtures published match links without competition HTTP fan-out

The verified Club Fixtures payload now carries `matchId: string | null` on each fixture. These IDs come **only** from the persisted `public_match_numbers` table joined with generation/season-scoped `season_match_slots` or the reserved knockout slots. The Worker checks their source, competition, phase/slot, marker, day, round and participants against the verified sporting fixture. Absent published mappings remain `null`; nothing is derived from pairing, row order, team names or results.

Club Fixtures now renders `/matches/{matchId}` directly from the single club API response. It no longer fetches the two `/api/matches/seasons/:season/competitions/:id` full match collections; those API endpoints remain available to other consumers. The early published-draw path retains its existing verified match IDs. No new sporting results, scoring authority, API route, migration or write path is introduced.

Frontend and Worker must be deployed **together** after separate owner authorization to retain complete/historical match links; the previous Worker does not provide the new fields. QA covers direct links, nullable/corrupt IDs, active and historical seasons, tab navigation and absence of published match-collection HTTP fan-out. Real network byte savings remain unmeasured until local isolated Worker/D1 samples are collected.
