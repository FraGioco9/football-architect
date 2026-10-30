# CI-OPT-02 — workflow cost and verification ledger

Status: Draft/HOLD, not yet benchmarked. Owner wants full exact-head CI only at the final acceptance. #170 / PR #329 is separate.

## Confirmed workflow inventory (main at issue creation)
| Workflow | Discovery | Expensive work | Change in PR #332 |
| --- | --- | --- | --- |
| Admin World foundation checks | `.github/workflows/admin-world-checks.yml` | Full backend Vitest, D1 operator, Chromium setup + browser | Cache npm and Chromium; reuse cached npm downloads; run historical Worker test files only once in full Vitest |
| Site checks | GitHub Actions run named `Site checks`; source path still to confirm | Head-exact and landing jobs observed | None; do not alter an unidentified workflow |
| Football Architect Browser QA | GitHub Actions run named `Football Architect Browser QA`; source path still to confirm | Chromium and scope jobs observed | None; do not alter an unidentified workflow |

## Baseline
Prior #170 exact-head workflow run IDs (before optimization): Admin `41100209254`, Site `41100209153`, Browser `41100209272`. These runs do **not** measure PR #332 improvement. Obtain queue, setup, dependency installation, browser download and test durations for comparable warm/cold runs before making speed claims.

## Reviewable safety invariants
- Exact-head checkout and `EXPECTED_SHA` assertion unchanged.
- The separate historical Vitest call duplicated tests discovered by the full `npm --prefix backend test`; removing that extra call changes *execution count*, not the final suite selection.
- `actions/setup-node@v4` npm cache is keyed to `backend/package-lock.json`; `npm ci` still reconstructs node_modules from the lockfile. The optional `--prefer-offline` requests cache reuse but does not skip integrity checks.
- Browser cache is scoped by OS and pinned Playwright version; Playwright installation is retained to fill cache misses and install required browser dependencies.
- Final full Worker, local operator, Chromium, Site and WebKit gates and all publication safeguards remain mandatory. Do not mark omitted/skipped jobs as PASS.
- Any later Site/Browser changes require identifying their *actual* workflow source and documenting old/new test matrix before editing.

## Exit criteria
1. Confirm all workflow filenames and runner queue vs execution timings.
2. Verify no test suite moved out of the mandatory final path.
3. Record baseline and optimized cold/warm executions on comparable exact heads.
4. Require complete final gate PASS; keep Draft/HOLD and no merge/deploy until separately approved.
