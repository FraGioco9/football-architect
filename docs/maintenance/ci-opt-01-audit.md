# CI-OPT-01 — workflow inventory and validation (#324)

One implementation PR: #325, Draft/HOLD. Issue #324 has a fixed 19-item checklist; do not add nodes. No merge, deployment, DB operation or manual workflow dispatch is authorized by this work.

## Workflow inventory

Baseline: `main` at `e4db9ad954ba9ea93305cd3612bdceaaa8796fed` (27 October 2026 UTC): 91 Node test files / 645 observed tests, six workflows.

| Workflow | Triggers | Work and dependencies | Policy |
| --- | --- | --- | --- |
| `landing-checks.yml` / Site checks | PR opened/synchronize/reopened/ready_for_review/converted_to_draft, main push, manual | Exact source HEAD and integration SHA; Node 22; syntax; Node contracts | Draft impact selection; mandatory FULL on non-draft/main |
| `int24-browser-qa.yml` / Browser QA | Same | Exact source HEAD, Node 22, pinned Playwright 1.58.2, Chromium/WebKit, loopback preview :2000 | FAST defers browser; TARGETED functional checks; FULL regression |
| `render-01-perf.yml` | Path-filtered PR, manual; job historically restricted to PR #263 | Archived Chrome performance benchmark | Retained unchanged; #263 is merged/closed |
| `manual-debug-manifest-hash.yml` | Manual only | Debug manifest hash | Unchanged |
| `manual-public-debug-audit.yml` | Manual only | Offline public Debug audit | Unchanged |
| `manual-vercel-preview.yml` | Manual only | Guarded preview | Unchanged, never dispatched here |

PR #254 (NAV-01) is merged/closed. Its unreachable PR-number-specific Chrome installer, environment and screenshot upload were removed from Site checks. No browser test source was deleted. The separate historical RENDER-01 workflow remains intact.

## Draft selection and acceptance

| Changed paths | Draft mode | Node work | Browser work |
| --- | --- | --- | --- |
| Docs only | FAST | Essential safety/provider/CI contracts | Deferred, explicitly not browser validation |
| One bounded Calendar, Clubs, Competitions or Guide area | TARGETED | Essentials plus area contracts, including any changed area test file | Area-specific Chromium and WebKit smoke |
| Workflow/CI orchestration, shared model/provider/registry/runtime/context, any CSS, unknown paths, multiple areas | FULL | Every discovered `tests/*.test.mjs` | Full Chromium, WebKit; CSS parity when applicable |
| Non-draft PR or main push | FULL regardless of paths | Every discovered test file | Full regression |

`tools/ci-opt-01-impact.mjs` defaults to FULL for missing/invalid base, invalid paths, empty changes and ambiguous/shared paths. It reads the actual git base-to-HEAD diff; no manual mode override is exposed. CI-only edits must run FULL rather than validate themselves by skipping their own execution. Docs mixed with a bounded area retain that area's selection. Unknown mixed paths and all CSS changes require FULL, preserving exact-base CSS parity even for an area-specific stylesheet. Explicit cross-area modules `club-crests.js`, `competition-tabs.js` and `competition-rules.js` also require FULL: competition runtime consumes club crests, the Clubs directory loads competition tabs, and shared catalogue tooling consumes competition rules. Filename prefixes do not override these verified consumer boundaries.

Exact source classification runs before expensive jobs; Site contracts additionally run against GitHub's integration SHA. Browser runs on exact PR source HEAD (or push SHA). These are two distinct checks. Review-ready updates always select FULL again; old Draft FAST greens are never acceptance evidence.

## Cancellation and artifacts

Only FAST/TARGETED PR jobs share cancellable concurrency groups. FULL PR and main jobs use unique run-ID groups and `cancel-in-progress: false`, protecting running **and pending** FULL jobs. A canceled job is not a pass. New commits cannot erase the requirement for successful checks on the latest SHA.

Failure artifacts include server logs, existing full screenshots and targeted screenshot/JSON context. Successful TARGETED creates no screenshots. Uploads use failure-only conditions and seven-day retention. No assertions are suppressed to save artifact space.

## Browser coverage and setup

TARGETED smoke exercises the actual area route: `/calendar`, `/clubs/it/1/overview`, `/competitions/it-1/standings`, `/guide`. It checks HTTP 200, selected language/theme, overflow, JS errors, real navigation, touch activation on mobile and keyboard interaction. Functional checks include season-picker contents, club history/overview, competition tabs, and Guide sections.

The bounded matrix has twenty cases per area/engine: every EN/DE/ES/FR/IT language at all 320/390/768/1440 widths, alternating Dark/Light so every pair of dimensions is covered. It is **pairwise coverage, not all 40 Cartesian combinations**. Desktop contexts do not pretend to be mobile devices; `hasTouch` explicitly tests taps at mobile widths. Existing FULL Chromium retains its broader checks (baseline 245 checks / 52 screenshots), including five languages, themes, responsive layouts and keyboard controls. FULL WebKit retains four iPhone-emulated route checks and adds the same twenty-case area matrix across all four areas. These are automated WebKit checks, not physical Safari certification.

Changes to CI-OPT files or workflow sources also exercise all four TARGETED Node selections and all four Chromium area scenarios within automatic FULL PR CI. This tests the real suites on the current checkout without modifying app files or dispatching a manual workflow. It is scenario execution, not a claim that an area-only PR trigger was observed.

CSS base-versus-HEAD parity is PR-only, requires the exact base SHA, and runs only for CSS diffs. Main push never attempts a PR-only CSS baseline; ordinary Chromium/WebKit still run. The seven-route network footprint report is diagnostic on manual dispatch only. The workflow remains manual-capable but no dispatch was performed.

Playwright is pinned to 1.58.2. TARGETED installs only the Playwright npm package; FULL additionally retains pixelmatch 7.1.0 and pngjs 7.0.0. Both non-FAST modes install Chromium and WebKit with OS dependencies. The browser cache key includes OS, pinned version, mode and revision v2. The cache saves browser binaries only, never test results or screenshots. Cache efficacy must be measured from actual job logs.

## Node isolation audit and partition

`node tools/ci-opt-01-node-inventory.mjs --json` screens every current Node test source for network/listeners, filesystem mutation, subprocesses and global/process state. The original 91 modules and new CI contracts are all included. Text signals are **not a proof of safety**: indirect imports, VM evaluation, reads and helpers require inspection. Unreviewed modules never become parallel merely because the screen reports no signals.

Four modules form the explicitly reviewed lane:

| Test | Executable dependencies reviewed | Shared effects |
| --- | --- | --- |
| `competition-model.test.mjs` | `competition-model.js`, `competition-rules.js` | Reads manifest/static pages; module/global assignments isolated in each Node process |
| `routes-registry.test.mjs` | ESM facade and classic `routes-registry.js` | Pure functions and isolated VM contexts; reads only |
| `world-calendar-model.test.mjs` | `world-calendar-model.js` | Pure projections; isolated VM contexts, immutable fixtures; no real clock/network/storage |
| `guide.test.mjs` | `landing.js` evaluated in isolated VM | Read-only HTML/CSS/JSON; mocked storage and document scoped to each context |

No lane module opens a port, starts a subprocess, changes process environment/cwd or writes repository/temp files. Their CommonJS/global caches are isolated by Node's default file-process isolation. Read-only data inputs may be shared. All four test files and all six executable dependencies have SHA-256 fingerprints in `tools/ci-opt-01-node-review.json`. If **any** fingerprint changes/is missing, the entire lane falls back to serial; no unsafe opt-in is inferred. A future audit can deliberately refresh the review file.

`tools/ci-opt-01-node-runner.mjs` discovers all `.test.mjs` files each time, runs only the matching audited lane at concurrency 2, then runs all remaining files at concurrency 1. The lanes never overlap. New/unknown files are serial. Unit contracts compare the union to the real directory listing, enforce no duplicates and verify changed-dependency fallback. Sensitive suites include browser/preview listeners, generators, filesystem/temp writes, publication guard, security, world runtime and subprocesses; they remain serial.

Controlled trials run the four reviewed modules serially and in parallel three times, alternating order and requiring equal test counts, zero failures and successful TAP summaries. Trial failure blocks CI. On the PR, trials are required when the audit manifest changes; normal FULL runs always use the verified partition (or serial fallback). No tests are dropped.

## Measured evidence and limits

| Scenario | Evidence | Observation |
| --- | --- | --- |
| Baseline PR #323 Site FULL | Actions #40589046819 | ~314s, 645/645 |
| Baseline PR #323 Browser FULL | #40589046815 | ~279s |
| Main Site FULL | #40592430091 | ~303s PASS |
| Main browser before fix | #40592430135 | ~185s FAIL after Chromium: CSS baseline wrongly required PR_BASE_SHA on push |
| Earlier Draft FAST Site | #40598106213 | ~28s; narrower coverage, not equivalent to FULL |
| Earlier Draft FAST browser | #40598106060 | ~9s; browser intentionally deferred |
| Local paired Node trials, Node 24 | 3 serial/parallel pairs, 23 tests each | Serial 572/651/607ms; concurrency 2: 378/413/358ms; all PASS |
| Local real TARGETED Node scenarios | Calendar/Clubs/Competitions/Guide selected contracts | Four areas PASS after keeping npm dependencies outside the source tree |

The Node gain measured so far is about **0.2 seconds for the bounded lane**, not minutes for the entire suite. Local Node 24 is not CI Node 22; CI measurements take precedence. These runs do not establish flakiness rates or runner-minute savings. FAST 30–60s, TARGETED 1–2m and FULL 2–4m remain targets, not promised outcomes.

The initial local full attempt found transient npm symlinks inside the source directory (publication scanning correctly rejects them), missing system Chrome, and old source-string assertions for the serial command. Dependencies were moved outside the source tree and assertions now verify the exhaustive runner contract. Playwright browser download returned invalid ZIP data in this environment, so browser acceptance must come from automatic GitHub CI. Record final exact-head results on issue #324 / PR #325; do not call these environmental failures a passing FULL run.

## Diagnosis, fallback and rollback

1. Read current PR HEAD and main SHA. Require exact-HEAD evidence, not a green run from an old commit.
2. Inspect classification outputs and step results. FAST skip is expected only for eligible Draft scope. FULL never skips the Node or browser gate.
3. On failure, inspect logs/artifacts and reproduce the specific cause. Retry only bounded diagnosed infrastructure failures; do not rerun blindly or remove assertions.
4. Unknown scope or changed isolation fingerprints select FULL/serial. If classification is questionable, fall back to FULL.
5. Keep #325 Draft/HOLD until implementation and final acceptance are reviewed. Before any authorized merge, mark ready and require fresh exact-HEAD FULL success; then obtain explicit merge authorization.
6. After an authorized merge, verify push FULL on the resulting main SHA without deployment. This cannot be certified before merging.
7. Roll back the CI-OPT changes via the single PR/integration commit after authorization, retaining application code and original tests. No automatic deploy or DB action is part of rollback.

## Hosted FULL evidence — 28 October 2026 Europe/Rome

Both automatic workflows passed on two distinct source HEADs without cancellation of the earlier FULL jobs:

| Source HEAD | Site workflow | Browser workflow | Results |
| --- | --- | --- | --- |
| `0757e78` | #40601722370, 315s | #40601722346, 359s | 661 Node tests; all four Node/TARGETED browser scenarios; legacy Chromium/WebKit PASS |
| `2060dc0` | #40601831739, 316s | #40601831644, 317s | **662 Node tests** (23+639), all95 files; TARGETED Node50/29/74/7; Chromium245 checks/52 screenshots plus80 area cases; WebKit80 area cases plus4 legacy routes PASS |

For `2060dc0`, Site also verified integration SHA `e6b3412a03aa43e0dfb9eed8ff3bd85c27630128`. Node22 paired trials were serial371/343/350ms versus concurrency2 271/239/217ms,23 passing tests in every trial. This confirms a small lane gain, not a meaningful FULL-suite acceleration. All source files uploaded were byte-compared with the remote commit.

Final Site job wall times were7+303s and browser jobs6+304s, approximately620s total (10.33 unrounded runner-minutes, not billed usage). Workflow critical path was317s. The baseline314s/279s had less browser coverage: the new full run includes160 additional area cases. The2–4min FULL target is not met; do not advertise a whole-pipeline speedup. TARGETED Chromium area scenarios took14.9/15.0/17.6/13.3s excluding setup, WebKit and queue. These are scenario timings, not measured area-only workflow durations.

Both browser caches were cold because the FULL runs overlapped. The first saved `Linux-playwright-browsers-1.58.2-full-v2`; the second finished successfully but lost the same-key reservation race, without weakening any checks. Browser dependency installation took53s and44s respectively. A subsequent automatic FULL run from this documentation update verifies restoring the saved cache; record its actual outcome on #324/#325 rather than asserting a cache benefit in advance.

Independent read-only review found three issues, all corrected: preview home links use the actual localhost home origin; the20-case browser matrix now covers every pair of width/locale/theme; discovering zero Node test files fails closed. Dedicated matrix/empty-suite tests were observed failing before their fixes and passing after. The final focused set has16 passing contracts. Local whole-suite execution still had six Chrome-dependent failures solely because system Chrome was unavailable; hosted FULL results above supply the actual browser acceptance evidence.

Nine classifier CLI fixtures used actual temporary Git histories: docsFAST; four bounded areasTARGETED; mixed/unknown/CSS/workflowFULL. Invalid base fell back toFULL in every case. These plus live FULL CI do not replace a live area-only PR event, review-ready lifecycle event, or post-merge main run. Those lifecycle limits and warm-cache measurements remain explicitly tracked in the unchanged19-item issue checklist. #325 stays Draft/HOLD; no manual workflow, merge, deploy or DB action occurred.
