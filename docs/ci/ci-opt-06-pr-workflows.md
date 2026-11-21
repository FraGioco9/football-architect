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
