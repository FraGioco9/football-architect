# REPO-493 / Step 09 — CI orchestration inventory and first optimization

Date: 2026-11-12 · Branch: `audit/repo-493-first-paint-matrix` · PR #500 (Draft/HOLD)

## Current workflow owners (source-level)

| Workflow | Trigger | Ownership / safe behavior |
| --- | --- | --- |
| `landing-checks.yml` | PR and main; optional manual | Site Node tests; uses `ci-opt-01-impact.mjs` for FAST/TARGETED Draft, otherwise FULL; explicit exact-head checkout |
| `int24-browser-qa.yml` | PR and main; optional manual | Browser Chromium/WebKit, first paint, responsive, visual suites; conservative CSS/full policy |
| `admin-world-checks.yml` | PR | Admin contracts, local Worker/D1 and account/lifecycle browsers; Draft impact routing, FULL required at final |
| `ci-opt-03-full-gate.yml` | PR, optional manual | Observes Site/Browser/Admin completed FULL on the same exact head and base, without dispatch/deploy |
| `match-engine-01.yml` | Selected match-engine/preview changes | Focused physics, routing/security, viewport and benchmark tests |
| `cloudflare-preview-package.yml` | Scoped CI | Preview packaging only; deployment remains separately authorized |

Other domain-specific catalog/performance workflows continue to own their own gates. The existing `ci-discovery.mjs` manifests all Node/browser/Worker test ownership; `ci-selected.mjs` and `ci-opt-01-node-runner.mjs` handle narrowed and complete Node lanes.

## Confirmed inefficiency and fix

Before this step, `ci-opt-03-full-gate.yml` started its 45-minute evidence observer on *every* PR synchronize, including ordinary Draft commits classified by Site/Browser/Admin as FAST or TARGETED. Such runs intentionally cannot provide FULL markers, producing avoidable waiting or a misleading 'missing FULL evidence' result.

**Implemented policy:** classify impact once in a short, exact-head, read-only scope job using the existing fail-closed `tools/ci-opt-01-impact.mjs`. Run the FULL evidence observer only when that mode is `full`. Unknown paths, styles, shared code, CI workflow changes and cross-area diffs still classify FULL. Ready-for-review, non-Draft, explicit final verification marker and manual dispatch also force FULL. No test execution or required final evidence was removed. A narrowed Draft **never counts as FULL success**; its observer is explicitly skipped, and the future full gate still checks the exact SHA, base, actual executed coverage and all required jobs.

**Expected benefit:** eliminate long, unproductive FULL observer waits for FAST/TARGETED Draft iterations. No numeric time or cost reduction claimed without measured Actions history. The small scope job itself adds checkout/classification overhead; quantify after CI evidence.

## Actions evidence sampled on the same PR (12 November 2026)

Actual GitHub Actions workflow run timestamps are measured here as **created → last update**, not as per-step CPU time; they include queue/startup and finalization. All times are UTC. Both candidates changed sensitive/shared files and therefore ran FULL; they **cannot demonstrate** a FAST/TARGETED speed improvement. The 2bd Admin cancellation is due to the subsequent synchronize and is not a passing run.

| PR HEAD | Workflow / run | Result | Observed elapsed |
| --- | --- | --- | --- |
| `2bd173b3` | [Site #43131317326](https://github.com/FraGioco9/football-architect/actions/runs/43131317326) | FAIL, 1/1,142 Node tests | 387 s |
| `2bd173b3` | [Browser #43131317333](https://github.com/FraGioco9/football-architect/actions/runs/43131317333) | PASS | 325 s |
| `2bd173b3` | [Admin #43131317538](https://github.com/FraGioco9/football-architect/actions/runs/43131317538) | CANCELLED on next head | 444 s |
| `2bd173b3` | [FULL gate #43131317350](https://github.com/FraGioco9/football-architect/actions/runs/43131317350) | FAIL, inherits Site failure | 401 s |
| `df64256a` | [Site #43132210028](https://github.com/FraGioco9/football-architect/actions/runs/43132210028) | FAIL, two test regressions | 327 s |
| `df64256a` | [Browser #43132210072](https://github.com/FraGioco9/football-architect/actions/runs/43132210072) | PASS | 343 s |
| `df64256a` | [Admin #43132210059](https://github.com/FraGioco9/football-architect/actions/runs/43132210059) | PASS | 428 s |
| `df64256a` | [FULL gate #43132210145](https://github.com/FraGioco9/football-architect/actions/runs/43132210145) | FAIL, inherits Site failure | 346 s |

### Failure classification and corrective patch

1. The earlier 404 update extended `publication-guard.mjs` with a **required public `404.html`**. The `PUBLIC-03` test at `tests/dev-preview-artifact.test.mjs` builds a temp source tree with an explicit list of copied files but omitted `404.html`. A real stage from this artificial fixture therefore correctly rejects the missing file. This is a **stale test fixture** (not evidence that the real public artifact lacks 404). Fix only the fixture and explicitly assert the public and protected-debug staging manifests retain `404.html`; **do not relax required allowlist/security**.
2. The prior Step 09 change added an exact-HEAD checkout in the **new classifier job**, but `tests/ci-opt-04-05.test.mjs` incorrectly forbade `actions/checkout` throughout the whole workflow, despite its genuine security intention being *the read-only evidence observer cannot evaluate candidate code*. Scope that negative assertion strictly to the `full-evidence` job and positively assert the short classifier has checkout. No FULL markers, source-hash checks, or verification conditions are weakened.

The log classifier on `df64256a` labeled its first failure "Missing or pending CI evidence" provisionally. The targeted static diagnosis above separates a stale contract assertion from actual missing FULL evidence. No redundant manual dispatch was run.

### Browser/Worker duplication audit (read-only)

Source confirms the full Browser workflow installs the pinned Playwright dependency once in its isolated container and runs Chromium, WebKit and frontend suites there. Admin uses independent account Chromium/WebKit containers and an operator Worker/browser job because their authentication, runtime, D1 setup and browser matrix are separate required safety contracts. Repeated Playwright package/binary setup across **different jobs** is not automatically redundant; removing tests or conflating jobs without timing/profiling would weaken required coverage. Cache and official image are already in use. Site FULL runs `ci-opt-01-node-runner.mjs`; Admin FULL runs separate Node contracts and Worker/D1 suites. No duplicate historical Vitest invocation was identified in the audited Admin full path. **No additional installation or test lane was removed** on unverified performance assumptions.

A future narrow Draft sample and a comparable earlier narrow run are still needed to quantify the skipped-observer benefit and runner-minute savings. The current candidate includes CI changes, therefore must run full checks.

## Safety and next checks

- [x] Inventory workflow owners and classify an observed duplicate/waiting pattern from source.
- [x] Keep single existing classifier (no second allowlist); require exact-head checkout and fail-closed unknown mode.
- [x] Add a fast Node contract that protects narrowing conditions and the untouched FULL check/production guard.
- [ ] Prove Site + Browser + Admin + FULL on the new commit; CI changes always classify FULL.
- [x] Capture two exact-head FULL workflow timing/status samples (above), including failed/cancelled reasons; **FAST/TARGETED before/after benefit unmeasured**.
- [ ] Measure comparable narrowed Draft Actions duration and duplicate job counts when that evidence exists.
- [x] Inventory Browser and Admin independent Playwright jobs and distinct Site Node vs Worker/D1 runtime coverage; no unsupported deduplication.
- [ ] Investigate measured provisioning bottlenecks separately after validating current CI.
- [ ] Perform complete final browser/physical QA separately; source tests do not certify hardware Safari.

No merge, deployment, remote D1 reads/writes or PR publication authorization was given.
