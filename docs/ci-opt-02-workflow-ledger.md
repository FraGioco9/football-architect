# CI-OPT-02 — workflow cost and verification ledger

Status: Draft/HOLD, not yet benchmarked. Owner wants full exact-head CI only at the final acceptance. #170 / PR #329 is separate.

## Confirmed workflow inventory (main at issue creation)
| Workflow | Discovery | Expensive work | Change in PR #332 |
| --- | --- | --- | --- |
| Admin World foundation checks | `.github/workflows/admin-world-checks.yml` | Full backend Vitest, D1 operator, Chromium setup + browser | Cache npm and Chromium; reuse cached npm downloads; run historical Worker test files only once in full Vitest; run local operator persistence as a separate parallel final job with its own exact-head check |
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

## Parallel final operator gate
- `operator-final` runs independently of the main Admin World test job, only for non-Draft or Draft with the existing explicit final-verification marker. This moves the local persistence/restart suite off the browser/Worker critical path while keeping it mandatory for the complete workflow conclusion.
- Each job checks out and verifies the identical PR head SHA and uses the lockfile-keyed npm cache. Independent runner queue time and cold installs may outweigh any time saved; benchmark before claiming improvement.
- Standard Draft checks still perform syntax, contracts, migration and typecheck in the primary job; the explicit final marker retains full Worker, Chromium and the now parallel operator suite. Other Site/Browser workflow conditions are not changed.

## New static regression contract
- `tests/ci-opt-02-workflow-contract.test.mjs` verifies exact SHA, least-privilege checkout, full Worker, operator, D1 migration, typecheck and Chromium final gates, cached dependency installs and elimination of the duplicate Vitest invocation. No local/CI execution is claimed yet.
- Workflow identity discovery constraint: GitHub Actions reports Site checks and Browser QA as separate workflow names with observed jobs, but their source filenames are not exposed by the currently accessible GitHub connector. Those files are not guessed or modified. C01 remains open until an authoritative file listing or workflow metadata resolves the filenames and complete matrix.

## First observed optimized-run measurements — PR #332
Exact HEAD `34e07f1e9db66fc4f62d522461c571a490ffa32c`, GitHub Actions:
- Admin World foundation `41108131853`: **SUCCESS**; full main Admin contracts job log timestamps span approximately **20 seconds**. The independent `operator-final` job was **SKIPPED**, as intended for an ordinary Draft without final-verification opt-in. Therefore this is **not** evidence of the final operator gate.
- Site checks `41108131600`: exact-head job SUCCESS (~4 seconds from log timestamps); landing still running when checked.
- Browser QA `41108131696`: scope SUCCESS (~4 seconds from log timestamps); Chromium still running when checked.
- These are approximate execution durations derived from available job log timestamp boundaries, **not** overall workflow elapsed time including runner queueing. No before/after comparable benchmark or full final-gate PASS has been established.

## Outstanding blocks
- **C01:** Site and Browser are independently identified by actual run IDs/jobs but their canonical workflow files are not confirmed by the available GitHub connector. Do not guess paths or edit unidentified YAML.
- **C07:** Obtain completed comparable cold/warm workflow times, verify all mandatory exact-head jobs (including operator-final) and record a complete final cycle before claiming performance improvement.

## Latest ordinary Draft workflow results (HEAD ea9f335b, 30 October 2026)
- Admin World run `41108456673`: success; foundation job log duration ~19 s; `operator-final` skipped (Draft; not final verification).
- Site checks run `41108456670`: success; landing job log duration ~311 s (5 min 11 s).
- Football Architect Browser QA run `41108456675`: success; chromium job log duration ~350 s (5 min 50 s).
- All three ordinary workflows succeed on the same exact HEAD. Execution times exclude runner queue and are not before/after controlled benchmark. The long critical path is now Site and Browser, not Admin. Because workflow paths for those two are unverified, do not alter them based on assumptions.
- **Final full operator gate not tested.** A final opt-in on exact head is necessary before C07 can close.
