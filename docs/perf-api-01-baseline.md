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

The opt-in browser tool writes int24-browser-artifacts/perf-api-01-before.json (and the after equivalent for the second label). Keep these artifacts untracked and review before sharing. It opens fresh anonymous Chromium contexts, includes a genuine Club Roster Info → Technical pushState transition plus browser Back when the control is actionable (otherwise an explicit SKIPPED record), captures local GET/HEAD requests, explicitly blocks state-changing /api/* requests, and records per-scenario URL path, method, query **keys**, selected non-sensitive numeric selectors, initiator page path, status, cache-control, request duration, response size when available, and counts. Response bodies, cookies, CSRF, authorization headers and full query values are **not** written. Repeated request shapes are **candidates**, not proof of duplication. Missing transfer measurements are unknown, not zero.

Compare before and after on the same Node version, CPU/network, Worker and D1 dataset, Playwright/Chromium build, route list, browser profile and account state; record exact HEAD for each sample. The tool does **not** prove browser paint, data correctness or host parity. The Roster subview is the only automated in-document transition at this stage; all other tab/selector cases remain manual and unverified. No baseline counts are manufactured from source searches.

## Outstanding test matrix (not yet executed)

| Route group | Cold direct / reload | Same-tab revisit | Tab/subview, history & selectors | After write or world change | Authenticated / Safari / Preview |
| --- | --- | --- | --- | --- | --- |
| Dashboard / Explore | script | script | manual | manual | manual |
| Clubs: Overview, Roster, Fixtures, Stats, History | script | script | Roster Info → Technical + Back (script, conditional); others manual | manual | manual |
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

## Focused client call-site review (source-only evidence; request counts remain unknown)

| Page / owner | Request(s) | Evidence and invalidation |
| --- | --- | --- |
| Public world — `assets/world-clock-adapter.js` | `GET /api/world` | Initial mount and explicit world/source invalidation; BFCache restore refreshes, ordinary focus does not. Competition reads may verify the world **after** a season projection to fence an intervening reset. Do not classify this safety read as waste without proof. |
| Public sidebar — `assets/profile-navigation.js` | `GET /api/player/permissions`; Profile click: `GET /api/player/session` | UI-only per-tab permissions and known-anonymous cache; refresh and session rotation must invalidate appropriately. Historical 404 requires Worker/proxy revision check. |
| Admin — `assets/admin-settings.js` | `GET /api/admin/session`, `/api/player/permissions`, `/api/admin/world`, `/api/admin/seasons/events`, conditional next-candidate | Authorization is sequential, with generation mismatch revalidation. Admin session response does **not** include permissions; never bypass the security gate. |
| Players — `assets/players-directory.js` | `GET /api/players` with offset/filters/sort | Different query keys/selectors can represent intentionally different pages; HTTP 409 stale-world is handled separately. |
| Player detail — `assets/player-detail.js` | `GET /api/players/:id` | Protected drafts require fresh permissions and Admin session reads, not anonymous result reuse. |
| Club Roster — `assets/club-page.js` | `GET /api/clubs/:clubKey/roster` | PR #573 reuses in-flight and successful reads across in-document subviews and clears on pagehide; the new audit measures Info → Technical and Back if actionable. |
| Club Overview/History — `assets/club-history-source.mjs` + `assets/club-public-read-cache.mjs` | `GET /api/clubs/:clubKey/history` | Shared per world generation/revision/day/source; failures retry and source changes clear. |
| Static asset — `assets/players-directory.js`, `assets/player-detail.js` | `/clubs/_shared/manifest.json` | Crest/club identity manifest is a static asset and must **not** inflate API request counts. |

This is a **focused source-level** review, not the full endpoint inventory or a measured before/after improvement. The complete browser request matrix, authenticated actions, post-write invalidation and Safari/Preview parity remain unverified.

## Measurement integrity and privacy follow-up (2026-11-14)

- Route labels and initiator URLs now use the same allowlisted numeric-selector redaction as API query metadata. Opaque path segments of 24+ characters are obscured; raw query values and navigation error messages are not persisted.
- Request grouping uses ephemeral, per-browser-context URL variant IDs: different filter values cannot be misclassified as identical API calls, yet no raw query values or unsalted deterministic fingerprints enter the JSON.
- Failed navigation, HTTP document errors and network-idle timeouts produce `requestCount: null` and `incomplete: true` instead of misleading zero-request results. Successfully settled zero-request scenarios still report `0`.
- Standalone Node.js 22 pure tests: **7/7 PASS**. A synthetic local Chromium probe in this execution environment returned `ERR_BLOCKED_BY_ADMINISTRATOR`; no Football Architect Network/HAR measurement was obtained. This is not evidence of an application bug or a traffic reduction.

Real before/after counts and Safari/Preview parity remain **NOT MEASURED**. Run against a controlled, isolated local DEV Worker/D1 to collect valid baseline metrics.

## CI 404 diagnosis and local baseline guard (2026-11-14)

The exact-head Browser QA log (`43599480085`, Chromium job `132460985991`) has **14 HTTP 404 entries for `/api/player/permissions`**. This is a repeated symptom *within a CI browser test*, **not** 14 same-document calls or evidence of production request duplication. Its workflow starts `tools/dev-standings-preview.mjs` without a Worker API target. The loopback static preview consequently cannot forward this account endpoint (`tools/dev-admin-api-proxy.mjs` returns `false` when no target is configured). The real backend source defines the endpoint and an anonymous request should be a 401, not 404. Do not modify permission cache/security semantics to suppress a static-preview 404.

The sampler now checks anonymous `GET /api/world` (expect 200 JSON) and `GET /api/player/permissions` (expect 401 or 200) **before** launching Chromium. Invalid local API routing fails clearly instead of generating misleading 404-based baselines. These two preliminary GETs are excluded from scenario request counts. Use `node tools/dev.mjs --local` for actual baseline; the standalone static preview is not a valid measurement target.

The current issue still requires actual before/after performance measurements on an isolated real Worker/D1. No public-code optimization or measured performance claim is made by this guard.

## Focused stable navigation cleanup (2026-11-14)

Source inspection identified an avoidable **UI refresh** on Club Fixtures `popstate`: the controller cleared `lastKey` on *every* history navigation, including Back/Forward between competition-filter values for the same club, season, source and world generation/revision/day. The existing `createClubPublicReadCache` normally prevents a second HTTP GET for completed data, so **no API request reduction is claimed** for this fix. However, the redundant refresh can synchronously replace valid rows with the loading skeleton, abort the current consumer, and repaint from cache.

The controller now retains the verified identity on ordinary `popstate` and lets `refresh()` decide from the existing season/world/source key. A changed season/source still refreshes; an error state may retry on history navigation. The existing Chromium Club Fixtures flow now checks a real filter-only Back/Forward sequence for **zero additional fixture endpoint calls and zero loading-skeleton flashes** while keeping all 30 rows. This test is a regression guard, **not** a substitute for an isolated real-Worker before/after baseline. Dedicated exact-head CI results remain necessary.

## Players directory: abort obsolete in-flight requests (2026-11-14)

Source review found an avoidable request-lifecycle cost: changing a Players Directory sort, filter, page or list identity invalidated the old response ticket but left its `GET /api/players?...` running. The obsolete response was ignored, but could still transfer and parse an unused payload. New `load()` aborts the prior batch signal before issuing its replacement GET, covering both initial list reads and an in-flight Load more append, while preserving the existing ticket fence.

One focused regression uses the real production `fetchBatch`, `load` and `appendNext` functions with deferred GETs: superseded list and append requests are aborted and only the latest list is rendered. This prevents unnecessary browser transfer when cancellation wins the race; it does **not** prove the backend skipped work that already began. API shapes, caching, pagination and authorization remain unchanged. No measured before/after real Worker request-count or byte reduction is claimed until the isolated baseline.

## First real local Worker/D1 browser capture (opt-in CI)

The repository's existing full Admin lifecycle CI job already starts a disposable Wrangler Worker, isolated synthetic D1, and Chromium. Rather than create another browser workflow or access a shared database, an opt-in marker on PR #597 runs the **same** anonymous sampler after the lifecycle has reset the disposable world to Season 0. The audit checks the standard GitHub Actions `GITHUB_EVENT_PATH` `pull_request` payload at the exact checked-out PR head, requiring a Draft PR and its `<!-- local-anonymous-api-audit -->` description marker; or `FA_LOCAL_API_AUDIT=1` for explicit local-only execution. No `.github/workflows` edit or extra workflow is needed. Because the existing disposable Worker/D1 lifecycle job runs only in FULL mode, PR #597 temporarily opts in to `<!-- admin-world-final-verification -->` for this evidence run. Remove the FULL marker after capture to avoid extra full gates on subsequent Draft changes. All other PRs pay no audit overhead.

Selected read-only routes: Dashboard, Players, Club Overview and Club Roster. The sampler records direct load, refresh, same-tab return and an in-page Roster view only when actionable, including explicit skipped and incomplete states. The resulting sanitized `perf-api-01-anonymous-local.json` is uploaded by the existing Admin job's diagnostic-artifact step and its per-scenario counts are printed in job logs. No passwords, cookies, CSRF, response bodies or raw query values are collected. CI checks out the exact HEAD before the audit.

These are **real browser-to-local-Worker HTTP observations**, but only for a synthetic Season 0 database and four anonymous routes; they do not provide an apples-to-apples before/after performance comparison or authenticated/real-device coverage. The first workflow-modifying commit `0402125` did not receive any GitHub Actions runs, so no report exists for that commit. A documentation-only synchronization follows it on an exact new HEAD with the two opt-in markers set, to request the required real-worker evidence. Do not count the previous head's successful workflows as evidence for the new HEAD. Collect the CI result first, then choose the next measured optimization. Do not confuse synthetic empty-data traffic with production usage.

The first attempt at opt-in introduced a workflow-file change, after which GitHub reported no workflow runs for `0402125` or the following documentation-only synchronization `1d55e26`. The final approach removes that workflow diff entirely. **No cause is asserted for the missing runs**, and the next exact-head CI must still verify that it executes and uploads the report.

## Real local Worker/D1 measurement result and sampler repair (2026-11-14)

Draft PR #597 exact head `996e50e` successfully completed the disposable local Wrangler/D1 + Chromium Admin lifecycle; a sanitized artifact `perf-api-01-anonymous-local.json` was uploaded in `diagnostics-operator-final-1` (run `43608390998`, job `132487906233`). It contains 12 scenarios across four anonymous routes: 3 complete, 8 marked incomplete, and 1 Roster subview intentionally skipped (`control-unavailable`). All 8 incomplete scenarios had `NetworkIdleTimeout` even though their observed API responses had finished successfully (HTTP 200 or expected anonymous permissions HTTP 401). The 3 complete same-tab returns each recorded two GETs and no repeated request shape. **No before/after improvement claim can be made from this synthetic Season 0 evidence.**

The earlier no-workflow-run state was caused by the Draft PR becoming merge-conflicted (`mergeable_state: dirty`) while `main` advanced. Merge commit `996e50e` safely merged latest `main` into the PR branch and retained Players accessibility plus API-abort changes and both test suites; workflows resumed. No merge into `main` occurred.

The sampler used `page.waitForLoadState('networkidle')`, which is overly broad for API auditing and invalidated the cold-load samples due to unrelated page activity. It now waits for only tracked `/api/*` requests to settle plus a bounded quiet period. A still-pending API request causes an incomplete record. A pure Node regression checks successful settling, a valid zero-request quiet scenario, and an unresolved API timeout. The intermediate dashboard transition also uses the API-only condition rather than page-wide idle. Re-run on an exact new HEAD before treating formerly incomplete cold-load counts as valid.

## Real 401 response lifecycle diagnostic (2026-11-14)

The exact-head second local Worker/D1 capture (`f900828`, run `43609130257`, job `132490187744`) confirms that **all eight incomplete cold-load/refresh samples have exactly one lingering request**: the anonymous `GET /api/player/permissions` with HTTP 401. Every observed `/api/world`, `/api/players`, Club History and Club Roster HTTP 200 request reached `requestfinished`. The 401 has neither `requestfinished` nor `requestfailed`, explaining the earlier global `networkidle` timeouts and the subsequent API-only `ApiRequestsUnsettled` timeouts. This is evidence of a browser request lifecycle, **not** evidence of redundant auth calls.

The public sidebar's permission-check code intentionally ignores error bodies; it now explicitly cancels the unread body stream on non-2xx responses so the browser can release the request. The authorization, session caching and Admin access decisions are unchanged. One existing Node test validates one request, body cleanup for both 401 and 503, and only 401 being cached as anonymous. A fresh real Worker/D1 capture is still required to confirm that Playwright observes a terminal request event and that all anonymous cold-load samples become valid.

## Disposable populated-D1 API baseline — opt-in diagnostic

On this opt-in PR, the pre-existing FULL local Wrangler/D1 Chromium lifecycle runner seeds exactly **250 entirely synthetic players**, including 73 assigned to IT-1 and 37 to IT-2, using the real migrated tables. It does so strictly before the Worker starts, in a fresh temporary Miniflare state folder that is deleted on exit. This seed is never written to local user data, shared DEV, Cloudflare Preview or production. All 20 public attributes are present with valid synthetic values, with no real personal data or credentials in reports.

The same private audit recorder measures Dashboard, Players page 1, Players page 2 (offset=50), age sort, player detail, Club Overview and Club Roster. It also exercises Info-to-Technical and Back on the non-empty 73-member roster; the in-page view must not repeat a completed Roster API GET. These samples compare empty vs populated *data coverage*, not equivalent-code before/after; no speedup is claimed until a measured optimization is available.

Output is the existing sanitized `perf-api-01-anonymous-local.json` under Admin CI diagnostics, augmented with synthetic population counts. Run once with the existing PR-body opt-in, then remove markers to avoid recurring FULL gates. Future regressions or optimizations should use this same populated fixture for comparable before/after evidence.

## Authenticated Admin command world-GET reuse (2026-11-14)

Code-path review identified one deterministically redundant authenticated HTTP call after successful Admin writes: the mutation response contains a validated resulting `world`, then `worldRead()` fetched `/api/admin/world` before reading the separate protected `/api/admin/seasons/events` projection. The controller now accepts that validated response world and relies on the protected events payload's world generation/revision as the normal second check. On this stable path, it eliminates **one authenticated `/api/admin/world` GET per successful operation**. The public world's explicit invalidation read remains intact.

If the post-write protected events response has a different world revision/generation or the read fails for an ordinary availability reason, the original authenticated world and events reread is used. Auth revocation errors 401/403 continue to clear Admin state; session/permission checks on initial and manual refresh remain untouched. Three focused tests cover successful reuse, a concurrent revision fallback, and permission revocation.

This is a measured *controller call sequence* before and after at the test harness level; no claim about production latency savings or full real Worker browser call counts. Existing full local Worker/D1 lifecycle and CI must validate correctness on this new exact head, while manual Chrome/iPhone Safari and broader world invalidation QA remain open.
