# CI-OPT-01 — workflow and test inventory (issue #324)

Recorded against `main` at `e4db9ad954ba9ea93305cd3612bdceaaa8796fed`. This is a measured inventory, not authorization to remove existing gates.

| Workflow | Trigger | Main checks / dependencies | Policy |
| --- | --- | --- | --- |
| `landing-checks.yml` / Site checks | PR open/synchronize/reopen; push main; manual dispatch | Independent exact-head job; Node 22, syntax, 91 Node test files (645 tests in observed FULL); narrow provider-safe selection in old main | FULL for ready-for-review and main; FAST essentials in draft, never remove exact-head |
| `int24-browser-qa.yml` / browser QA | PR open/synchronize/reopen; push main; manual dispatch | Node 22; Playwright Chromium; 245 browser checks / 52 screenshots in observed FULL; 64 CSS parity permutations; network timing and iPhone-emulated WebKit; DEV server port 2000 | FULL on ready-for-review/main; PR-only CSS parity; draft skips expensive browser |
| `render-01-perf.yml` / performance | PR path changes to benchmark/workflow; manual dispatch, job restricted to PR #263 | Fixed historical baseline and Chrome benchmark; no unconditional main run | Legacy project-specific; audit before removal |
| `manual-debug-manifest-hash.yml` | Manual dispatch only | Generate debug manifest hash | Keep manual and protected |
| `manual-public-debug-audit.yml` | Manual dispatch only | Offline public Debug audit | Keep manual and protected |
| `manual-vercel-preview.yml` | Manual dispatch only | Guarded preview workflow | Keep manual; do not dispatch or weaken guard |

## Actual timing baseline (GitHub Actions, 2026-10-27 UTC)

| Scenario | Run | Approx. wall time | Result |
| --- | --- | --- | --- |
| PR #323 Site checks FULL | #40589046819 | 5m14s | PASS, 645/645 |
| PR #323 browser FULL | #40589046815 | 4m39s | PASS |
| Squash main push Site checks FULL | #40592430091 | 5m03s | PASS |
| Squash main push browser FULL | #40592430135 | 3m05s | FAIL after 245 Chromium checks because PR_BASE_SHA unavailable for CSS PR baseline |
| Draft PR #325 Site checks FAST | #40595178589 | See run timestamps; PASS | PASS |
| Draft PR #325 browser deferred | #40595178667 | No browser setup/preview run | PASS |

These durations are observed whole-run times, not per-test CPU time. Concurrent Site and Browser workflows overlap. No before/after speed-up conclusion yet.

## Classification boundaries

Current Draft branch implements a fast essential Node contract set and defers browser checks; the current non-draft/main path remains FULL. `ci-fast-scope.mjs` predates this branch and remains provider-only; a generalized area map (Calendar, Clubs, Competitions, Guide, global CSS, routes and shared modules) is still pending. Unknown paths must fail closed into FULL. Final FULL must be enforced on exact PR HEAD after Ready-for-review (and repeated if HEAD changes), not inferred from earlier Draft success.

## Constraints and diagnostics

- Site checks run exact-head verification separately; main checks compare against `github.sha`.
- Browser tests use loopback DEV preview on port 2000, ephemeral Playwright dependencies and screenshots/log artifacts.
- CSS before/after parity is valid only when the event has a real PR base SHA; on main push it is inapplicable. The other browser checks continue on main.
- Preserve publication gate, anti-deploy, safety, routing and provider contracts.
- Cancel superseded runs only within the same PR; never cancel main runs.
- Keep all manual workflows manual. Do not touch Vercel/DB/deployment.
- Do not add checkboxes to issue #324: update its existing 19 items only.

## Operational selection matrix (Draft PR only)

| Changed paths | Selection | Checks on Draft | Final gate |
| --- | --- | --- | --- |
| Docs / CI machinery only | FAST | Exact-head + syntax + baseline safety/provider contracts + impact-classifier contracts | FULL after marking ready |
| Calendar-only | TARGETED | FAST + Calendar contracts + two-viewport Chromium smoke | FULL after marking ready |
| Clubs-only | TARGETED | FAST + Club contracts + two-viewport Chromium smoke | FULL after marking ready |
| Competitions-only | TARGETED | FAST + Competition contracts + two-viewport Chromium smoke | FULL after marking ready |
| Guide-only | TARGETED | FAST + Guide contracts + two-viewport Chromium smoke | FULL after marking ready |
| Shared / ambiguous / unrelated files | FULL | All Node and browser tests even when Draft | FULL on review and main |
| Ready-for-review, main push | FULL | All Node, Chromium, CSS PR parity only on PR, network, WebKit | Same exact-head full run |

TARGETED smoke must check HTTP 200, browser JS errors and horizontal overflow on mobile 390 and desktop 1440. This is narrower than full browser QA and must never be called equivalent. The full suite remains mandatory on review-ready exact HEAD, and any later commit returns the PR to pending until its checks finish.

## CI workflow changes and failure response

1. Verify latest PR `head.sha` and `main` commit; ignore green checks from older HEADs.
2. Inspect Site checks and Football Architect Browser QA job **steps**; a skipped browser on Draft FAST is expected, not a substitute for final FULL.
3. On a red status, retrieve failed step log and saved browser artifact. Do not rerun blindly, suppress assertions, or change test coverage to force green.
4. Reconcile unknown/shared paths with FULL. When diagnosis is inconclusive, select FULL instead of introducing a new exception.
5. Before merge, mark PR **Ready for review**, require both exact-HEAD FULL jobs success, ensure publication guard and no deployment workflow executed, then obtain explicit authorization.
6. Following authorized merge, verify push FULL on the resulting `main` SHA; PR-only CSS baseline does not run on push (no PR base exists).
7. If selection is unsafe or flaky, rollback only CI-OPT-01 changes from its single PR, or revert the integration commit after authorization; retain original source tests and publication guard unchanged.

The workflow `concurrency` grouping is isolated by workflow name and PR number. New commits can cancel older runs on the same PR; `main` runs use unique run IDs and are not cancellable by this mechanism. Canceled runs are not passing results.

## Manual workflows and artifacts

`manual-debug-manifest-hash.yml`, `manual-public-debug-audit.yml` and `manual-vercel-preview.yml` stay `workflow_dispatch`-only; this refactor adds no automatic invocation. `render-01-perf.yml` remains unchanged pending legacy review. Browser screenshot/log upload now runs on **failure** for the full/targeted runner instead of unconditional upload, conserving runner minutes and storage while preserving diagnostics. Never schedule a Vercel deployment or remote DB step as part of CI optimization.

## Node test isolation risk inventory (static conservative screen)

Before changing `--test-concurrency=1`, isolate high-risk suites rather than blindly parallelizing 91 files. Tests with explicit browser, preview, generator, world runtime, security, publication and integration names demand dependency inspection (ports, temporary files, subprocesses, environment, snapshot and generated-asset writes). Initial high-risk examples: `dev-standings-preview.test.mjs`, `app-subdomain-preview.test.mjs`, `generator-windows.test.mjs`, `club-pages-browser.test.mjs`, `g10-public-02-browser.test.mjs`, `world-calendar-browser.test.mjs`, `world-calendar-history-browser.test.mjs`, `theme-browser.test.mjs`, `publication-gate.test.mjs`, and `arch-clean-02-security.test.mjs`. This is a **candidate list, not a confirmed interference analysis**. Leave concurrency at 1 until a verified isolation report and repeated tests justify a change.

Network footprint baseline is diagnostic and does not validate app behavior; run on manual browser workflow dispatch only, with no automatic release/deploy. Normal FULL still runs Chromium, WebKit and PR-conditional CSS parity. This avoids recurring seven-route network profiling on every main push.

## Node isolation audit — source-inspected sample (12/91 test modules)

The following signals were verified in actual test source, not inferred solely from filenames. This is an initial conservative dependency audit, not proof of safe parallel execution.

| Test file | Source-detected shared-resource / isolation signals |
| --- | --- |
| dev-standings-preview.test.mjs | loopback listeners, temporary directories, async writes, environment use |
| app-subdomain-preview.test.mjs | local TCP listener, localhost |
| generator-windows.test.mjs | subprocess invocation, temp directory and sync file writes |
| club-pages-browser.test.mjs | HTTP server, subprocesses, temp files and environment |
| g10-public-02-browser.test.mjs | HTTP server, subprocesses, temp files and environment |
| world-calendar-browser.test.mjs | HTTP server, subprocesses, temp files and environment |
| world-calendar-history-browser.test.mjs | HTTP server, subprocesses, temp files and environment |
| theme-browser.test.mjs | HTTP server, subprocesses, temp files and environment |
| publication-gate.test.mjs | temporary paths and synchronous file writes/deletion |
| arch-clean-02-security.test.mjs | globalThis usage |
| calendar-season-link.test.mjs | localhost URL references; no listener observed in quick source scan |
| guide.test.mjs | none of the searched process/network/file-write signals observed |

This sample supports retaining `--test-concurrency=1` pending a complete 91-file audit, port allocation analysis and repeated isolated/sharded runs. Do not equate absence of these text patterns with a proof of independence. The user explicitly requested postponement of FULL testing; no concurrency acceleration should be made without that evidence.

## Historical workflow decision

PR #254 (NAV-01) and PR #263 (RENDER-01) were confirmed closed and merged. The Site checks branch which installed Chrome and uploaded NAV-01-only screenshots when the current PR number equaled 254 is now unreachable for new pull requests; removed its conditional setup, associated obsolete environment variables and screenshot upload. Keep `render-01-perf.yml` untouched as a historical opt-in benchmark tied to PR #263: avoiding an unproven deletion is safer than removing an archive without a replacement. No browser tests or application sources were removed.

## Full Node inventory — 91/91 source files screened

All 91 existing `tests/*.test.mjs` modules on the 2026-10-27 main baseline were read and screened for explicit network/server use (`listen`, `createServer`, localhost), temporary filesystem mutation (`mkdtemp`, writes, deletes), subprocesses (`spawn`, `execFileSync`) and global/process state (`process.env`, `globalThis`, `chdir`). Screening is a **static text-signal heuristic**: indirect imports, helper calls and generated side effects can remain hidden. This is not a concurrency-safe certification.

**Isolation candidates, pending controlled trial**:
- Potentially self-contained domain assertions with no detected resource signals, e.g. `competition-model.test.mjs`, `routes-registry.test.mjs`, `rules-registry.test.mjs`, `world-calendar-model.test.mjs`, `guide.test.mjs`.
- Shared-resource-sensitive suite group: `dev-standings-preview.test.mjs`, `club-pages-browser.test.mjs`, `g10-public-02-browser.test.mjs`, `theme-browser.test.mjs`, `world-calendar-browser.test.mjs`, `world-calendar-history-browser.test.mjs`, `generator-windows.test.mjs`, `publication-gate.test.mjs` and others with network/process/filesystem signals.
- Ambiguous modules with `process.env` or `globalThis` references, indirect helper dependencies or loopback URL literals must remain conservative until their imported dependencies are inspected.

**Decision**: retain `--test-concurrency=1` across FULL for now. A parallel lane cannot be declared safe until repeated bounded CI trials demonstrate no shared writes, collisions, flaky browser launches or assertion changes. The work is recorded under P1-01/P1-02, not marked as completed performance gains.

## Draft FAST measured wall-time comparison

From GitHub Actions run timestamps on the same date:

| Mode | GitHub run | Wall time | Notes |
| --- | --- | --- | --- |
| Before, FULL Site checks PR #323 | #40589046819 | ~314 seconds | 645/645 contracts |
| Before, FULL Chromium PR #323 | #40589046815 | ~279 seconds | full browser and WebKit |
| After, Draft FAST Site checks PR #325 | #40598106213 | ~28 seconds | essential contracts and scope checks; **not** the full suite |
| After, Draft FAST Browser PR #325 | #40598106060 | ~9 seconds | browser intentionally deferred; **not** browser PASS |

FAST feedback reached the 30–60-second target for Site checks in one observed PR run. This is **not an apples-to-apples performance acceleration of FULL**; coverage intentionally differs. The TARGETED and FULL-after-change timings, failure rate, cache effectiveness and runner-minute comparisons must be collected before claiming the overall targets are met. Do not green-light a merge from Draft FAST runs alone.

## Browser cache policy

The Playwright version remains pinned at 1.58.2. Browser installation can reuse `actions/cache@v4` at `~/.cache/ms-playwright` on non-FAST runs with a version-, platform- and mode-specific key (TARGETED Chromium-only versus FULL Chromium+WebKit); it does not cache generated browser outputs or alter source dependencies. Both Chromium and WebKit remain installed for FULL; cache hits and duration effects are unproven until measured in non-FAST workflow runs. No remote deploy triggered.

## Reproducible Node inventory and TARGETED assertions

`node tools/ci-opt-01-node-inventory.mjs --json` generates a read-only report of all current `tests/*.test.mjs` and four source-level signals (network, filesystem, subprocess and global state), with review-required or candidate-only classification. `candidate-only` must **never** be interpreted as parallel-safe: imported modules and other stateful effects are not exhaustively analyzed. The inventory has a Node contract test in Draft essential checks; it must not create persistent artifacts or require additional packages.

The impact-classifier contracts additionally assert that every test path selected for Calendar, Clubs, Competitions and Guide actually exists. These checks guard against silent false-greens from stale targeted test names. Final validation still requires actual TARGETED scenario execution, then exact-head FULL before merge.

## Targeted dependency installation boundary

TARGETED browser runs require Playwright Chromium only. The installer now uses `playwright@1.58.2` without the screenshot parity packages, because targeted smoke does not import `pixelmatch` or `pngjs`. FULL continues to install all three pinned packages (`playwright@1.58.2`, `pixelmatch@7.1.0`, `pngjs@7.0.0`) and Chromium/WebKit. Browser binaries use distinct cache keys for TARGETED and FULL, avoiding a Chromium-only cache incorrectly being reused as a completed WebKit cache. The reduction is a package/setup optimization, **not** evidence of a successful TARGETED browser run; final scenario QA remains open.
