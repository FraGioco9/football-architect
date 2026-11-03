# Selective CI and failure diagnostics

Refs #360 and #371. Baseline is squash commit `75a672591085fbe4099deb7aee619e88c7a6b12a` from merged PR #364. Historical branch implementations were not reused. The owner authorized unified implementation on 2026-11-03; the prior planning-only/closed status of #360 is superseded by that authorization.

## Execution and coverage

- **FAST:** explicit documentation-only changes. Every lane audits test ownership before dependency installation; Site runs syntax and essential publication, security, provider, Admin and authority contracts. Browser reports that no application scenario was selected; this is not FULL evidence.
- **TARGETED:** one reviewed bounded Calendar, Clubs, Competitions, Guide or Admin surface. Site runs the union of essential, area and direct consumer contracts exactly once. Browser retains the pairwise viewport/locale/theme/touch matrix in both Chromium and WebKit. Admin runs Node contracts, SQLite migration checks, typecheck/import audit and isolated authentication runtime tests.
- **FULL:** ready-for-review, main, manual dispatch and unknown/shared/mixed/CI/CSS/routing/database/security changes. Backend source edits remain FULL: no unproven backend subset is introduced. All previous complete suites remain, including operator persistence, account WebKit and lifecycle verification. The previously omitted pure `admin-end-season-policy.test.mts` now belongs to the Node contract runner.
- Unknown asset/test names cannot opt into a lane just by matching a prefix. New reviewed paths require an explicit selector review. Renames are classified as both deletion and addition using `--no-renames`.
- Existing job/check identities remain. No branch protection, required-check setting, secret, publication guard, deployment or remote database configuration was changed. Branch-protection settings could not be inspected through the available connector; merge enforcement is therefore not claimed as independently audited.

`tools/ci-test-ownership.json` records every test/fixture, including non-code fixtures. `ci-discovery.mjs` rejects missing/unrecognized additions, unsupported new suffixes and owner/runner mismatches. Site Node files must match the actual runner glob, backend runtime files must match Vitest, and operator files must appear in its explicit command. Helpers and the separately documented Season 2 navigation diagnostic are not presented as independently executed regression suites.

## Exact-head final evidence

The required `CI FULL exact-head evidence` job observes the three workflows read-only. It does not dispatch suites or depend on itself. The verifier is inline in the workflow, with a byte-equivalence test against the unit-tested helper; no candidate checkout/code is loaded by that gate.

| Evidence | Gate behavior |
| --- | --- |
| Missing | Remain in progress, merge blocked |
| Queued/in progress/rerun | PENDING, merge blocked |
| Failed | FAIL, never fall back to older green |
| Cancelled | CANCELLED, never PASS |
| Successful narrowed/skipped source | Not FULL; inspect earlier actual FULL source or remain blocked |
| Successful reused run | Resolve to an earlier actually executed source run; never certify skipped source as fresh FULL |
| Completed complete source | PASS only at the exact requested SHA |
| New PR HEAD/closed/foreign PR/wrong target | BLOCKED immediately |

The observer checks all mandatory FULL jobs, their actual execution steps and final completion markers. It rechecks live PR HEAD before acceptance. Manual dispatch cannot substitute for PR coverage because it lacks the PR base-dependent CSS parity context. Final acceptance uses automatic complete PR workflows. Regular dispatch remains a separate explicit diagnostic.

Missing evidence is observed for at most 45 minutes (50-minute job budget), then reported as **BLOCKED CI evidence**, never as an inferred product regression. Once overdue evidence arrives, rerun only the gate on the unchanged SHA. This bounded wait consumes Actions runner time; it trades a bounded cost for eliminating premature red gates and repeated expensive suites.

Before expensive work, scope jobs may reuse earlier completed FULL PR evidence on the identical SHA and matching PR/base snapshot. The latest relevant failed/cancelled/in-progress run prevents reuse. Source run IDs and URLs are written into summaries. Status-only events queue behind existing work; new push events cancel superseded work. No retry-on-pass policy exists.

Site now tests PR source HEAD consistently with Browser and Admin; it no longer describes merge-ref tests as source-head evidence. This changes the Site checkout from the former synthetic merge commit to the requested source commit. Integration with future base changes still needs normal GitHub mergeability/protection review; no additional integration coverage is claimed.

## Failure categories and records

The wrapper streams original stdout/stderr unchanged and records the first actionable failure immediately. It preserves child failure/cancellation and emits JSON plus raw logs under the runner's temporary artifact directory, outside the publication source tree. Each record includes scenario, source when identifiable, root excerpt, expected/actual when emitted, a stable signature, exact checkout HEAD, tracked changes, duration/first-failure time, safe scenario environment, PowerShell reproduction and run/artifact link. Null expected/actual means the tool did not emit them; values are not fabricated.

Categories are Product regression, Test defect, Test data or environment problem, Infrastructure failure, Missing or pending CI evidence, and Flaky or non-deterministic test. Automated text-based classifications are explicitly **provisional**. Assertion failures require root-cause review; they are not proof of product defects. A successful run is not classified as a failure. `ci-history.mjs` groups recurring signatures and flags contradictory same-head outcomes as investigation candidates; it never converts a retry into reliability proof.

The two account request fixtures now signal handler entry with bounded promises. This removes one unbounded polling loop and one one-second timing assumption while retaining the pending-state, single-flight, disabled-control and error-feedback assertions. No application behavior, sporting result, tooltip identity contract or empty-standings expectation was altered.

## Local reproduction (Windows 11 PowerShell)

Use Node 22 matching CI, Python 3 (`py` on Windows), and a clean checkout of the reported SHA. Install backend tooling only for backend tests. Publication checks recursively reject symlinks, including installed `node_modules` under the source tree; run Site checks in a separate clean checkout or place tool dependencies outside its source root. Do not change that guard to accommodate a local installation.

| Category | Command |
| --- | --- |
| Discovery | `node tools/ci-discovery.mjs` |
| FAST/TARGETED Site | `node tools/ci-run.mjs selected -- node tools/ci-selected.mjs` |
| FULL Site | `node tools/ci-run.mjs site-full -- node tools/ci-opt-01-node-runner.mjs` |
| One Node scenario | `node --test --test-name-pattern='scenario name' tests/example.test.mjs` |
| Backend pure contracts | `npm --prefix backend run test:contracts` |
| Worker/D1 (local disposable) | `npm --prefix backend ci` then `npm --prefix backend test` |
| Backend operator | `npm --prefix backend run test:operator` |
| SQLite migrations | `py -m unittest discover -s backend/tests -p 'test_*migration.py' -v` |
| Account request fixture | `node tests/account-pages-browser.mjs` or `node tests/account-usability-browser.mjs` (each starts its own preview) |
| Evidence state machine | `node --test tests/ci-opt-04-05.test.mjs` |
| Downloaded failure history | `node tools/ci-history.mjs path/to/downloaded-artifacts` |
| Controlled duplicate benchmark | `node tools/ci-benchmark.mjs` |

Browser prerequisites: install `playwright@1.58.2`, then `npx playwright install chromium webkit`. FULL CSS parity also uses `pixelmatch@7.1.0` and `pngjs@7.0.0`. For shared preview scenarios, start `node tools/dev-standings-preview.mjs` in another terminal and wait until `/competitions` responds on `http://app.localhost:2000`. Run suites using fixed port 2000 sequentially. Standalone account suites create their own server; do not start another on that port.

Example targeted WebKit reproduction:

```powershell
$env:FA_TARGET_AREA='guide'
$env:FA_BROWSER_ENGINE='webkit'
node tools/ci-run.mjs guide-webkit -- node tests/ci-opt-01-browser-smoke.mjs
```

Account WebKit uses `$env:FA_AUTH_BROWSER='webkit'`. CSS parity requires `$env:PR_BASE_SHA='<reported 40-digit base SHA>'` and the fetched base commit. Clear a scenario override after reproducing it with `Remove-Item Env:FA_BROWSER_ENGINE -ErrorAction SilentlyContinue` (likewise for other overrides). Locale, theme and viewport cases are generated by the canonical suite matrix; failed targeted screenshots include their exact configuration.

## Historical cases verified from original job logs

| Run | Confirmed root observation | Current treatment |
| --- | --- | --- |
| 41566837487 | Gate failed immediately for missing Landing FULL | Observer waits for evidence; no application change |
| 41564420106 | Same gate signature at another HEAD | Same orchestration cause, not evidence of a flaky product test |
| 41565973603 | `/settings` standalone preview session fetch 404 | Narrow no-backend exception already on squash baseline; preserved |
| 41555721092 | Standings empty state 1 vs 24 assertion | Baseline already asserts the actual single empty-state row; no further rewrite |
| 41555720936 | Incidental tooltip ID mismatch; the same run also contains provider/browser failures | Baseline instance-aware assertions preserved; failures are not collapsed into one cause |
| 41556529519 | `account-http.test.ts` rejected by old discovery syntax assumption | Baseline contracts reproduce green; manifest now catches ownership errors before installs |

Raw logs, rather than historical commit implementations, were reviewed. Old CI results do not satisfy this branch's exact-head final acceptance.

## Measurements and limits

`ci-opt-04-05-benchmark.json` stores alternating before/after local samples. The reconstructed prior Admin selection executes 22 files (19 essential + 3 duplicate area files); the union executes the identical 19 unique files. No distinct test is removed. The former automatic FULL selector-scenario step also reran area contracts already covered by FULL; executable selector/workflow regression tests retain that coverage without executing identical files again.

The final alternating local samples averaged **13,749.7 ms before / 12,575.3 ms after (8.5% lower)**; individual trials include variance and one after-trial was slower. File executions decrease **22 to 19 (13.6%)**, with the same unique coverage. These are controlled orchestration measurements, not a promised FULL duration. Human diagnosis/repair timestamps cannot be recovered reliably from Actions start/end logs; no numeric improvement in real repair time is invented. The wrapper now records time to first actionable failure and total duration for future comparable runs. Download multiple attempts and use the history command to measure repeated signatures; investigate them instead of automatically retrying. Browser/Worker validation and cold dependency installation must be measured separately from warm local Node selection.

## Local validation before first push

- CI selection, workflow shell, discovery, evidence state-machine, reuse, diagnostics and request-handshake regressions: **68 PASS** at the last combined run; the inline-gate/diagnostics subset also passed after its final changes.
- Backend contracts: **86 PASS**, including the newly discovered end-season MTS contracts. Worker runtime: **238 PASS** in 38 files. SQLite migration tests: **44 PASS**. Import-graph tests: **3 PASS**; TypeScript typecheck PASS.
- Account usability Chromium: **27 cases PASS**; account pages/reset-handshake matrix: **35 cases PASS**. Assertions and browser matrices were retained.
- Full Site local attempt: **787 PASS / 788**, with the existing UI-THEME render matrix **cancelled at its 180-second deadline**. It is not a full PASS. The environment uses Node 24 and an externally extracted Chromium 143 because the pinned Playwright download returned empty archives; CI uses Node 22 and its supported browser provisioning. The isolated render-matrix reproduction also reached the unchanged 180-second deadline; this remains an explicit local limitation. No timeout or assertion was relaxed to hide this result.
- GitHub full evidence must come from this PR's final exact SHA; these working-tree local observations are not substituted for it. Local diagnostic records expose tracked changes explicitly.
