# CI-OPT-06 — Reduce redundant pull-request workflow launches

## Verified historical baseline

On 20–21 November 2026, four representative Draft heads of PR #732
(`60abbd0b`, `999af2a8`, `003fd68a`, `ebd903d8`)
each launched **8** GitHub Actions workflows. Their observed longest
completion intervals were 462, 494, 441 and 463 seconds, respectively.
These are historical, not matched before/after controlled comparisons.

The eight were Site, Browser, Admin, exact-head FULL evidence, first-name
catalog, surname catalog, Match Engine, and a skipped Cloudflare Preview
package run. The latter package was conditional on the historical PR #496,
already merged. The separate RENDER-01 workflow only admitted PR #263,
also already merged. Both had dead automatic trigger paths.

## Changes in Draft/HOLD PR #737

- First-name and surname **dedicated workflows removed**. Their catalog
  tests remain discoverable, each executed once in the mandatory
  `Site checks` FULL Node runner. The source-only surname catalog
  scope guard and PLAYERS-03 isolation check are integrated into the
  Site job; a data edit with unrelated paths fails conservatively.
- Match Engine workflow launches only for `match-engine/**` or an edit
  to that workflow, **not** for
  `tools/dev-standings-preview.mjs`. Existing physics tests,
  real Chromium QA, benchmarks and exact PR HEAD checkout are preserved.
  Edits to the Match Engine workflow **in this PR** legitimately trigger
  its own run; evaluate routine PRs separately.
- The separate Cloudflare Preview package workflow is removed:
  it only admitted the already-merged `feat/dev-preview-shared-d1`
  branch, and launched an irrelevant skipped workflow on ordinary
  backend/frontend edits. The **owner-only, exact-main-HEAD,
  `workflow_dispatch`** Cloudflare DEV Preview release workflow
  remains unchanged. Its builder, immutable package verification,
  local Worker/D1 security contracts and publication guards remain.
- The legacy RENDER-01 workflow is removed: its job had a strict
  `pull_request.number == 263` gate. The standalone benchmark tool
  remains available; the workflow never validated other PRs.
- Admin Draft classifier reuses the reviewed Site scope map. Isolated
  public-calendar, clubs, competitions, guide and documentation edits
  can skip unrelated Admin full-runtime checks. Shared, backend,
  security, CSS, unknown, cross-area and CI changes fail closed to FULL.

## Safety boundaries

The four primary workflows remain:
`landing-checks.yml`, `int24-browser-qa.yml`,
`admin-world-checks.yml`, `ci-opt-03-full-gate.yml`.
Protected `main` still requires `landing` and
`CI FULL exact-head evidence` on the exact current PR HEAD/base.
Retain full Chromium/WebKit, Worker/D1, admin, security, publication
and five-locales contracts; do not infer PASS from skipped or narrow
runs. No manual workflow dispatch, deployment or remote DB action.

**Expected routine trigger reduction:** from the historically observed
8 launches to 4, for a comparable broad feature PR where optional
workflow paths do not match. The implementation PR legitimately starts
Match Engine because it edits its own workflow; it is *not* a routine
feature-PR sample.

**Performance:** fewer launched workflows do not prove faster critical
path. Wall time, runner-minutes, flakiness and matched Draft/Ready
comparisons remain unverified until equivalent change sets exist.
Do not claim the issue's >=25% wall-time target as achieved from these
workflow counts alone.

Verify automatically triggered FULL CI once on the final exact HEAD.
Retain Draft/HOLD; no merge without separate owner authorization.

## Follow-up: reduce FULL browser latency without trimming coverage

Pre-change Site FULL #44845366417 executed 196 Node files and 1,672 tests
in 293.2s. Club Chrome test took 80.7s with 874 readiness polls; Theme
Chrome took 79.8s with 586 readiness polls. Both now check readiness
at 20ms intervals rather than 50ms, with 500 instead of 200 maximum
polls to retain the original nominal ten-second wait budget. All
screenshots, routes, locales, viewports and assertions are unchanged.

Pre-change Browser FULL #44845366390 spent about 502s inside one browser
command. FE-02 Chromium and WebKit now execute concurrently in the same
job with separate browser contexts and engine-specific artifacts; both
results are awaited and either failure fails FULL. Real-shell contract
tests inject failure in each engine independently to prevent masking.
This adds no workflows, jobs, manual dispatches or skipped coverage.

These are bounded optimizations, not a proven savings claim until exact-head
FULL reruns measure elapsed time and failure rate. The stale Node audit
fingerprints are intentionally left fail-closed until independently reviewed.

## Next follow-up — exact-head failure repair and scoped Browser preflight

The first attempt on `502e15086ab8` exposed one **real CI-contract
failure**: `tests/chrome-profile.test.mjs` still hard-coded the former
200×50ms polling implementation. It is now a parameterized contract
requiring exactly 10,000ms total and a positive interval <=50ms; both
real Chrome suites still have 500×20ms and all original checks.
The fail-closed FULL observer correctly rejected the failing Site run.

The extra Browser `ci-opt-01-scenarios.mjs --browser` scenario matrix
previously launched for *any* file under `.github/workflows/`. Its
last measured runs took ~85.7s in total, primarily the Competitions
scenario (70.3s). It is now triggered only by the scenario code,
impact classifier, browser fixtures or the Browser workflow itself.
Mandatory Browser FULL still runs independently on all review/main
changes, including workflow-only updates. A real-shell Git diff test
demonstrates that an unrelated workflow edit skips only the optional
preflight, while an edit to the Browser workflow triggers it.

INT24 Chromium now emits read-only `INT24_PHASE|{...}` milestones for
compact network, player stats, player scrolling, canonical initial
navigation, standings transitions, competition history/matrix, form
layout and accessibility. Timing does not change browser behavior,
assertion counts, locales, viewports, screenshot capture or exit
semantics. Compare durations on the next exact-head result before
considering further changes; no parallelization of INT24 suites yet.

## Follow-up — INT24 critical path: resource-specific readiness (2026-11-21)

The exact-head INT24 phase profile on `015339cb` measured **54.891s**
for PERF-API-657's 9 network checks. These were followed by nine
`waitForLoadState('networkidle', {timeout:6000}).catch(()=>{})`
operations: a possible 54s of inconclusive global-network waiting.
The network inventory now requires **compact/legacy-manifest resources**
to finish and watches same-origin API *request starts* for a 250 ms
quiet period, with a **fail-closed 6s bound for catalogue resources**.
The loopback /api/world endpoint can remain pending indefinitely; it is
still recorded in API request evidence, but is **not** a prerequisite
for static first-paint/catalogue validation.
No network count, first-paint, response, refresh, season-selection or
error assertion was removed. Synthetic lifecycle tests cover completion,
request failures, unrelated traffic, and the fail-closed timeout.

The canonical-state SH-03 browser matrix now navigates by
`domcontentloaded` for the original public-route/refresh and protected
Debug-route loops. Instead of global `networkidle`, each navigation must
observe the required world season, correct localized header/theme, or
explicit protected source and empty season/day. All former assertions,
widths, locales, route visits and other interaction-specific waits remain.
Other SH-03 navigations using networkidle are intentionally unchanged.

These are bounded hypotheses, **not a proven speedup** until the next
FULL exact-head run. If a *catalogue* request never settles, tests fail
rather than hiding a timeout as a PASS. Keep branch Draft/HOLD, unchanged
mandatory Site/Browser/Admin gate and no manual dispatch/deploy/DB.

### Loopback long-running public API correction

The first CI browser attempt on `5c734a8d` failed with
`PERF-API-657 ... direct /competitions/it-1/standings?season=1 [".../api/world"]`.
This is expected for the deliberately isolated public-world API, which
must not gate a compact-catalogue first-paint audit. The tracker now waits
for the catalogue's completed response but treats public API request starts
as evidence only. A regression test keeps intentionally unresolved
`/api/world` and `/api/competitions/...` requests in flight while
expecting the catalogue gate to pass, while an unfinished compact response
still fails closed. No API inventory assertions were removed.

## CI-OPT-06 follow-up — bounded INT24 cup matrix concurrency (2026-11-21)

The exact-head green baseline `e89e0942` gives 53.146s for the
combined Competition/History matrix and 106.965s for all 407 INT24
checks/52 screenshots. The two international cups (Sovereign and
Federation) have fully separate Playwright pages/contexts, source fixtures,
URLs and artifact filenames; within each cup the **four widths and seven
views stay serial**, retaining real cold-document navigation and all
original assertions. The two cups may therefore run at the same time,
with a hard concurrency cap of **two**, while both results are awaited.
The code reports `INT24_MATRIX` per cup/width timing and elapsed matrix
time for benchmark comparison; the existing `INT24_PHASE` aggregate remains
unchanged for meaningful comparisons. Five Node contracts verify all
8 cup-width visits, intra-cup ordering, a strict 2-cup limit, and both
single and simultaneous failures. No screenshot, browser, language, locale,
view, assertion, source payload, or required CI check is skipped.

This is a controlled experiment: compare real exact-head Browser time and
run stability with `e89e0942`; revert if Chromium resource contention
outweighs savings. Maintain Draft/HOLD; no merge, deploy, manual dispatch
or remote database changes.

## Final scoped optimization trial — Account and container cache (2026-11-21)

At verified `502ce5d1` the critical jobs were Browser 379s, Site 363s,
Account WebKit 368s (Chromium 235s). Inside Site, stale reviewed
fingerprints deliberately made **all 198 files serial**; do **not** silently
rebaseline an audited dependency just to achieve parallelism.

Two independent Account matrices (interaction and layout) now overlap the
**dark/light themes only** (at most two concurrent contexts). Each theme's
viewports remain serial; languages complete in order. Each test script keeps
its own local preview server on port 2000 and therefore the nine scripts
remain strictly serial. Counts remain 100 interaction cases and 80 layout
cases per browser engine, with all five languages and responsive widths.
The helper waits for both themes and fails FULL on either or both errors;
its dedicated site-owned tests verify the exact coverage, concurrency cap,
ordering and injected failures. It logs `CI_OPT_06_ACCOUNT_MATRIX` timing
by locale to compare contention versus elapsed-time savings.

The official pinned Playwright container uses `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`;
its Browser and Account jobs no longer restore a mismatched
`~/.cache/ms-playwright` cache. The non-container Admin lifecycle job retains
its legitimate cache. Site FULL retains its exact Node inventory and
serial safety fallback but now logs `CI_OPT_06_SITE_LANE` elapsed time and
fingerprint validity. No assertions are removed, no optional suite is
misreported as PASS, and no required gates are changed.

This is **unverified until automatic exact-head FULL CI**. If Account WebKit
contention or flakiness regresses, revert the scoped theme overlap; do not
claim >=25% matched median speedup from a single run. Maintain Draft/HOLD;
no manual dispatch, merge, deploy, remote D1 or ruleset changes.

## Selective WebKit serial fallback (2026-11-21)

Exact-head `70bb95c` passed all five automatic FULL workflows including required
`landing` and `CI FULL exact-head evidence`, but total gate time rose from
407s to 529s in one comparison. Account Chromium job improved 235s to
206s while Account WebKit worsened 368s to 421s. The changed interaction
and layout suites together were ~61.6s to ~38.1s on Chromium, but
~98.4s to ~105.2s on WebKit. Even unchanged INT24 407-check browser
coverage rose 75.931s to 94.548s, so one run is not a causal benchmark.

To avoid accepting a speculative WebKit concurrency benefit, the Account
interaction and layout matrices now use **serial themes on WebKit**, while
retaining at-most-two theme contexts on Chromium. Both themes still execute
even after an earlier failure and surface all errors. All case counts, locales,
routes, mobile widths and assertions remain intact, with independent preview
servers still started **serially** per suite. A site-owned contract covers both
failed WebKit themes, exact ordering, the concurrency cap and caller policy.

This is a risk-reduction follow-up, **not a verified runtime saving**.
Run only automatically triggered required CI, measure and report the next
exact-head result honestly, keep #735 open for matched Draft median evidence,
and keep #737 Draft/HOLD without merge, deployment, manual dispatch, remote
database or main-protection changes.
