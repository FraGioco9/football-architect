# TEST-SUITE-02 (#738) — Account browser startup consolidation (Draft/HOLD)

## Owner-approved pilot (2026-11-21)

The existing `admin-world-checks.yml` Account Chromium and WebKit FULL jobs sequentially ran nine scripts; each script launched a fresh pinned Playwright browser and local preview listener. Consolidate **only two adjacent Account suites** into one Node process and browser launch. All other scripts remain independent. Do not change required workflow names, main protections, FULL classification, runner engine or local Worker/D1 behavior.

| Before (each launched its own browser) | After (one shared browser launch) | Unique assertions and scenarios preserved |
|---|---|---|
| `tests/account-interaction-browser.mjs` | exported `runAccountInteractionMatrix` | **100 cases** = 5 languages × 2 themes × 2 device variants × 5 routes: field hover/focus/selection, accessible labels, country menu ESC/restore, canonical account routes, authenticating API mocking and JS error checks |
| `tests/account-layout-browser.mjs` | exported `runAccountLayoutMatrix` | **80 cases** = 5 languages × 2 themes × 3 widths × 2 pages (60) + 5 languages × 4 auth routes (20): dropdown menu geometry, keyboard scroll, typography, persisted login return and localization |

The new `tests/account-interaction-layout-browser.mjs` invokes both sequentially through `tools/ci-opt-07-account-browser-batch.mjs` with one pinned Chromium or WebKit launch, and **separate preview servers/isolated contexts per suite**. The batch verifies exact executed counts **100 and 80**, awaits both suites even when one fails, then closes the browser, and surfaces failures as an AggregateError. The two old scripts **remain executable directly** with the same scenarios. The existing `runIndependentAccountMatrix` keeps **WebKit maxConcurrent=1** and Chromium maxConcurrent=2. No assertions, viewport, locales or test cases removed. Unit contracts check shared launch, case-count mismatch, failure propagation, original standalone support and workflow coverage.

### Baseline and honest measurement

From the natural #736 FULL at `cd13202a`: Account WebKit job **349s**, Account Chromium **196s**, full Admin across jobs **843s**. These numbers include many other scripts and setup and are **not** isolated per-script startup timings; no performance claim is made. Prior #737 experiments showed WebKit concurrency noise. The new `TEST_SUITE_02_ACCOUNT_BATCH` emitted per-suite durations and counts allow a before/after comparison in **natural** CI without manual benchmark workflows. One saved browser launch is plausible, but wall-time impact is unverified.

### Verification and HOLD

Use the automatically triggered PR workflow and its exact HEAD/base evidence to confirm **both** real browser engines, 100+80 cases on each engine, existing Worker/D1/security, and the required `landing` + `CI FULL exact-head evidence`. Any missing scenario, runner failure or WebKit instability should cause rollback, not weakening a check. Keep the PR **Draft/HOLD** and leave #738 open; no merge, deploy, remote DB or manual workflow dispatch without separate authorization.
