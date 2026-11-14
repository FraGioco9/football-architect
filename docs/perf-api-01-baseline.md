# PERF-API-01 (#550) — request audit baseline and measurement protocol

## State and evidence (2026-11-14)

**Phase 1: instrumentation, not optimization.** Baseline main when work started: 25d15d650191aea73dc6d17fbb223092f296bf01. No request-count reduction is claimed. No local DEV, hosted Preview, login, or real-device HAR has been executed for this issue; all request counts and timings are **UNKNOWN** until captured. The route list in the helper is representative, not an assertion that every route variant is covered.

Known source-level findings (not live network measurements):

| Scope | Method / path | Initiator / owner | Existing behavior | Next evidence needed |
| --- | --- | --- | --- | --- |
| Public sidebar | GET /api/player/permissions | assets/profile-navigation.js | Reads a validated per-tab UI-only permissions snapshot; new document refresh clears it. 401 is cached as anonymous. | Confirm calls per navigation, whether historical 404 was an old DEV Worker/proxy, and authenticated/anonymous parity. |
| Profile click | GET /api/player/session | assets/profile-navigation.js | Probe occurs on profile navigation; known anonymous session avoids a second 401. | Compare login, logout, full refresh, new tab and session rotation. |
| Club Roster | GET /api/clubs/:clubKey/roster | assets/club-page.js | In-flight and successful Roster snapshot reuse merged in #573; failures retry and pagehide clears identity. | Confirm no duplicate on tab switches and correct refresh after changes. |
| Club public reads | GET dynamic public club paths | assets/club-public-read-cache.mjs | Deduplicated per source/world revision, season, day and phase. | Measure calls on Overview/History/Fixtures and after world advance / Debug source change. |

Previously recorded symptom: #547 local DEV QA showed intermittent/repeated GET /api/player/permissions 404. The backend source (backend/src/http-player.ts) defines this GET endpoint, so 404 is **not** sufficient evidence that the frontend should cache or suppress it. First verify which Worker/proxy was active. A configured anonymous session is expected to return 401, not 404.

## Reproducible measurement (read-only, anonymous)

Use Node 22 and the isolated local Worker/D1. From the repository root, in PowerShell:

~~~powershell
npm --prefix backend ci
node tools/dev.mjs --local
# In a second PowerShell window:
node --test tests/perf-api-01-requests.test.mjs
node tools/perf-api-01-requests.mjs before --runs=2
# Narrow to representative endpoints:
node tools/perf-api-01-requests.mjs before --routes=/dashboard,/calendar,/clubs/it/1/roster --runs=2
~~~

The opt-in browser tool writes int24-browser-artifacts/perf-api-01-before.json (and the after equivalent for the second label). Keep these artifacts untracked and review before sharing. It opens fresh anonymous Chromium contexts, captures local GET/HEAD requests, explicitly blocks state-changing /api/* requests, and records per-scenario URL path, method, query **keys**, selected non-sensitive numeric selectors, initiator page path, status, cache-control, request duration, response size when available, and counts. Response bodies, cookies, CSRF, authorization headers and full query values are **not** written. Repeated request shapes are **candidates**, not proof of duplication. Missing transfer measurements are unknown, not zero.

Compare before and after on the same Node version, CPU/network, Worker and D1 dataset, Playwright/Chromium build, route list, browser profile and account state; record exact HEAD for each sample. The tool does **not** prove browser paint, data correctness or host parity. No baseline counts are manufactured from source searches.

## Outstanding test matrix (not yet executed)

| Route group | Cold direct / reload | Same-tab revisit | Tab/subview, history & selectors | After write or world change | Authenticated / Safari / Preview |
| --- | --- | --- | --- | --- | --- |
| Dashboard / Explore | script | script | manual | manual | manual |
| Clubs: Overview, Roster, Fixtures, Stats, History | script | script | manual | manual | manual |
| Domestic / international competitions | script | script | manual | manual | manual |
| Calendar | script | script | manual | manual | manual |
| Players directory and detail | partial script | partial script | manual | manual | manual |
| Profile / Account | anonymous script | anonymous script | manual | manual | manual |
| Admin: Calendar, Players, Contracts | anonymous script | anonymous script | manual | manual | manual |

Here, script means the route is configured for **future** measurement, not that it has been run. Partial means variants remain; manual means not yet automated. Safari requires a physical iPhone. The authenticated/admin/post-write matrix requires separately controlled local fixtures. Do not use real account data in artifacts.

## Optimization decisions, after evidence

1. **High candidate:** determine if permission 404s come from stale hosted Preview, DEV proxy routing or genuinely repeated public navigations. Do not turn 404 into a permanent anonymous permission cache.
2. **High candidate:** verify #573 Roster reuse and existing per-world club cache before adding any new abstraction.
3. **Medium candidate:** inspect overlapping competition/calendar/history response payloads and safe in-flight sharing, scoped to canonical world revision.
4. **Deferred:** composite endpoints and broad cache rewrites without measurements; any change across public/private/Admin security boundaries.

Acceptance remains in #550: full per-route before/after matrix with timings and byte sizes, invalidation on world/Debug/account/contract changes, regression tests, desktop Chrome and physical iPhone Safari QA, Preview parity **only after separately authorized publication**. No merge, deploy or remote D1 operation is implied by this phase.
