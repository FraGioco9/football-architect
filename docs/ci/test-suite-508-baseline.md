# TEST-SUITE-01 (#508) — Initial baseline and review queue

**Batch A0:** static inventory started. No existing tests were removed, rewritten or weakened. All issue checklist items remain open pending verification.

**Observed source:** main at 25d15d650191aea73dc6d17fbb223092f296bf01 (2026-11-14). This is a file and runner inventory, **not** execution, test coverage, flakiness or runtime evidence. Re-run on the latest branch HEAD: concurrent PRs are changing tests.

## Existing ownership and execution

Reuse **tools/ci-test-ownership.json** and **tools/ci-discovery.mjs** as the canonical ownership contract, rather than maintaining a parallel registry.

| Existing owner | Files | Intended execution |
| --- | ---: | --- |
| site-node | 161 | Site Node suite |
| browser | 20 | Browser/Account workflow selections |
| manual | 2 | Development diagnostics, not required FULL by default |
| backend-runtime | 48 | Worker/D1 Vitest |
| backend-contract | 31 | Node backend contracts |
| backend-operator | 7 | Node local operator |
| backend-import | 1 | Node import graph |
| migration | 18 | Python SQLite migration modules |
| support | 13 | Fixtures/helpers/declarations, not standalone tests |
| **Ownership subtotal** | **301** | tests/ and backend/tests/ |
| Match Engine | **10** | 9 Node tests in its npm script, 1 browser viewport test |
| **Combined observed files** | **311** | Includes support files; not executed test cases |

Directory evidence: tests/ contains 188 top-level files, tests/fixtures/ 2, tests/helpers/ 1; backend/tests/ contains 106 top-level files, backend/tests/fixtures/ 4. All 301 are classified in the existing ownership map. Match Engine tests are not in that manifest.

The new read-only **tools/test-suite-508-inventory.mjs** checks ownership listing and scans these three suites for canonical club names, fixed club IDs, possible shared-state/network/nondeterminism signals, and lexical test/assert call counts. It does **not** modify CI selection or test data. Lexical call counts are not executed test or coverage counts. Matching a candidate does not establish a defect.

## First manual review candidates

| Test source | Suspected redundancy | Required surviving behavior |
| --- | --- | --- |
| tests/club-identity-trafford.test.mjs | Repeated exact Trafford United / Foundry Park texts mixed with broader functionality | Owner-approved catalog identity, abbreviation uniqueness, JSON/CSV consistency, translations, manifests, historical rename and first-paint privacy |
| tests/club-crests.test.mjs | Special FR-2 load/registration/fallback cases partially overlap generic crest tests | Safe allowlisting, no guessed path, load once, dynamic updates, accessible rendering, five locales, fallback |
| tests/branding.test.mjs | Useful data-driven asset-variant loops, with some exact-source/CSS assertions | Actual brand assets, language, keyboard and responsive behavior |

**No test is approved for deletion by this inventory.** Exact approved club names can be valid *catalog-integrity* contracts. Generic UI behavior should be tested with representative fixtures. Every eventual deletion needs the old test, promised behavior, surviving or replacement test and targeted PASS evidence.

## CI protection boundary

- **landing-checks.yml**: Site Node and selected source checks.
- **admin-world-checks.yml**: Worker/D1, backend contracts, migrations, auth/security, operator lifecycle and account browser coverage.
- **int24-browser-qa.yml**: broad browser, first paint, responsive Chromium/WebKit, visual and network validation.
- **ci-opt-03-full-gate.yml**: exact-HEAD FULL evidence gate.
- Other workflows own generation/catalog parity, publication boundaries and Match Engine. Review their distinct contracts before touching selection.

Issue **#493 is cancelled**, so its obsolete steps are not an active dependency. Coordinate with live changes and historical #324/#341 without reopening abandoned work.

## Read-only Node.js 22 / PowerShell reproduction

From the repository root:

~~~powershell
node tools/ci-discovery.mjs
node tools/test-suite-508-inventory.mjs
node tools/test-suite-508-inventory.mjs --json > test-suite-508-inventory.local.json
~~~

The JSON is a local working artifact, not a committed fixture.

## Next work and evidence

1. Run inventory on the exact current HEAD; classify each runner, feature, invariant, dataset integrity, browser/E2E and overlap. Explicitly map Match Engine and browser selectors. Then complete section A of the issue.
2. Refactor small coherent batches with data-driven valid/invalid/edge cases. For any removal, document the old case, contract, replacement and targeted PASS before deleting it.
3. Compare actual before/after case counts, assertion behavior, job timings, flakiness and failure diagnostics; run targeted checks during development and a single required FULL gate at the stable exact HEAD. Do not weaken security, migrations, publication, locales or sporting rules.

**Evidence log A0:** 301 ownership-tracked files plus 10 Match Engine test files; three representative suites and four core workflows inspected. Helper Node 22 syntax check and a synthetic three-file inventory fixture passed. Full repository local execution, exact-HEAD CI status, runtime and real coverage deltas are **UNKNOWN**. Tests removed or replaced: **zero**.

## Batch A1 — generalized club/crest tests (2026-11-14)

**Intent:** stop asserting the literal name, nickname, stadium, color or narrative of arbitrary clubs as functional behavior. Canonical asset/identity protections are retained in bulk; the approved color fingerprint remains pinned.

| Removed/replaced test | Surviving/replacement protection |
| --- | --- |
| Four single-club cases in `club-identity-trafford.test.mjs` | All 320 club CSV fields and published club identities in `club-colors-integration.test.mjs` and `club-pages.test.mjs`; 320 catalog adapter identities in `world-catalog.test.mjs`; new all-352-rivalry name/CSV/manifest parity and all-320-translation locale/CSV/manifest parity |
| Literal ENG-2, IT-27, NL-22 identity/color checks in `club-colors-integration.test.mjs` | Existing pinned SHA-256 of approved 320-club color palette and all-club JSON/CSV/manifest comparison |
| FR-2 asset registration test in `club-crests.test.mjs` | Dynamic discovery and publication manifest/allowlist checks of **all** existing crests |
| FR-2 duplicate dynamic-load/fallback test | Existing general loading, repeat observation, stale-event handling and missing-asset tests |
| FR-2-only club header rendering across five locales | Same behavior with representative canonical crest fixtures, each five views and five locales, with absence fallback |
| ENG-5, DE-3 and ENG-7 bespoke vector/asset tests | One generic all-published-crest accessible title, SVG viewBox and prohibited embedded content test |

**Source-level case delta for these files:** 26 named Node tests before; 20 after (4 deleted, 4 replaced/removed crest cases net, 2 new catalog parity cases). Site file ownership becomes 160 site-node and 300 total manifest entries; Match Engine remains 10, unchanged. These are static counts, **not timing or coverage equivalence proof**.

**Important non-goals:** no modifications to 320 club records, club logos, historical data, sporting model, auth, Worker/D1 migrations, runtime JS, browser test selectors or exact-head CI gates. More suite classification is required before closing section A/B/C. Build/CI evidence must be attached to PR #598 once the updated SHA is tested.

## Batch A2 — representative browser categories, generator invariants and bounded runtime (2026-11-14)

Previous exact HEAD `84ed78a23a2b4cc1d76d093bc7cfe455bbf9b11f`: Browser QA and first/surname catalogs **PASS**; Site **FAIL** on a 10-second wait for `window.faCompetitionRoute` in the club page browser test (Node lane 1305 PASS / 1 FAIL); Admin **FAIL** on a Vitest 5-second timeout in `public-sporting-runtime.test.ts` after replaying 13 sporting days (304 PASS / 1 FAIL). FULL gate therefore failed by evidence propagation. These are observed failures, **not proof of a product regression or confirmed flakiness**.

| Existing check | Batch A2 behavior-preserving change | Rationale / retained coverage |
| --- | --- | --- |
| `tests/club-pages-browser.test.mjs`: two viewports × sixteen equivalent domestic direct fixtures URLs | One representative direct route per domestic tier per viewport; **all** baseline special cases (legacy query, HTML, season, cross-view, international, bad matchday) remain | All 16 domestic route contracts still exhaustively exercised in `tests/world-divisions.test.mjs`, `tests/club-pages.test.mjs` and route registry tests; browser matrix continues validating behavior, not individual country IDs |
| `tests/players-name-pools.test.mjs`: one BRA-only uppercase and one BRA/POR/ESP-only no-alias test | Remove two country-specific cases and enforce generated uppercase in existing seeded-catalog integration case | `tests/players-names-catalog.test.mjs` validates capitalized NFC Latin single names for **all 50 countries**; generator integration tests enforce `display_name`, no `known_as`, nationality source, determinism and attribute isolation |
| `tests/players-names-catalog.test.mjs`: four top-ranked names and one optional example in Batch E | Drop five incidental individual-name assertions | Entire 300-name-by-50-country schema, ranking and source provenance contracts still checked; Batch E retains romanization standards and cohort warnings |
| `backend/tests/public-sporting-runtime.test.ts`: day13 multi-step real-worker test with default 5-second Vitest timeout | Explicit **30-second bounded test timeout** (other full-lifecycle tests already use up to 120 seconds) | Identical sporting-day assertions and D1 isolation; startup variance is not an external 5-second performance contract |

No runner/CI gate suppression, skipped tests, error-catching or production code change. The browser test still visits desktop and mobile widths and checks legacy URL canonicalization.

**Further evidence:** executed case counts and wall-clock duration on new exact-HEAD CI, diagnosis of any persistent failure, and eventual full suite coverage mapping. Prior failing jobs are **not** marked fixed by these edits alone.

## Batch A3 — stop pinning arbitrary names in the catalog (2026-11-14)

The **all-50-country** format test already validates every given name: exactly 300 distinct entries per country, NFC Latin script, single word, uppercase initial, positive descending weights and recognized provenance. The separate runtime surname test likewise validates **all** national surnames against unapproved ALL-CAPS multi-letter tokens and duplicate normalization. Example name inclusions and precise top/bottom rank values therefore lock current content without protecting the generator's behavior.

- Removed isolated `given_names.some(name===...)` examples across batch F/J/K/D and country notes; removed a RUS three-name/weight micro-snapshot and ENG/WAL first/last name snapshots. Deleted the redundant six-compound-name negative sample loop already covered by the exhaustive per-name Latin/punctuation validation. All 50 country source identities, source file hashes, weights/rank *properties*, cohort/provenance warnings, romanization, source-limits and geographic restrictions are retained.
- Removed seven one-off surname inclusions across AUS/CMR/COD/BRA/KOR from the exhaustive runtime casing test. The isolated synthetic surname fixture still protects compound casing, particles, apostrophes and sampling order.
- No changes to generated player data, bank source files, corpus weights, defaults, sampling behavior or security/CI gates. No test cases were skipped. A3 reduces **assertion count**, not top-level test count.

**Current evidence:** static diff and existing full-file test coverage map; re-run exact-HEAD site/generator/catalog checks to establish passing behavior. A successful CI run is **required before claiming equivalence**.

## Batch A4 — sporting/qualification and initial-selection contract generalization (2026-11-14)

**Last observed verified exact HEAD before A4:** `f60a4c23674cb07cf80e2444457aea0562595d2d`: Site, Browser, Admin, Node first names, surnames, player trial and required FULL evidence gate all **PASS**. This is historical evidence, not a PASS claim for a later A4 commit.

| Test file / lane | Replaced brittle assertion or gap | New general invariant and retained failure evidence |
| --- | --- | --- |
| `backend/tests/next-season-membership.test.ts` (`backend-contract`, Node) | IT-1-only promotion/relegation inclusion, exclusion and cup qualifier prefix assertions | One **all-eight-country** source-derived test verifies both next-season divisions, 3 promotions/3 relegations, each 32-club preserved universe, cup qualification based on **final standings** instead of provisional new ranking, 48 distinct cup participants, input immutability and frozen output |
| Same file, negative test | Four isolated IT ID mutations with no checked error reason | Four grouped source-derived invalid evidence cases plus invalid season, all requiring the stable **422 `qualification_evidence_invalid`** contract |
| `tests/season-one-selection.test.mjs` (`site-node`) | One fixed IT-1 1–16 list and fixed IT cup trio | Every domestic preview binding must correspond to its canonical 16-club initial selection; both cups' quota must match three club IDs per nation drawn from all **eight** original top-division orders; production approval stays false |

**Safety/coverage:** no sporting rules changed, no fixture source rewritten, no changes to international pots, migration/data/runtime or production access. Existing negative validation and the 18-competition capacity checks survive. Two top-level tests per file remain; no CI selector changes, no skip/try-catch swallowing or changed runner assignment.

**Still pending**: whole-suite duplicate map beyond reviewed domains, reliable before/after runtime comparison, complete A/B/C checklist and exact-head validation for this batch.

## Batch A5 — consolidate overlapping public Worker/D1 API projections (2026-11-14)

**Observed before A5:** prior exact-HEAD `af7da1fa93359acb07fd211af7c180e08004e401` had Site PASS, Player Generator/First Names/Surnames PASS and **Browser QA FAIL** at `tests/canonical-state-browser.mjs:254` on a hidden Debug switch after an in-flight world revision; Admin WebKit and FULL evidence remained pending when inspected. The browser test is not changed by A4 and must be diagnosed as an independent gating failure; **do not presume unrelated flakiness or claim a successful gate**.

| Runtime test | Previous execution | A5 shared execution | Removed-to-surviving checks |
| --- | --- | --- | --- |
| `backend/tests/public-sporting-runtime.test.ts`: `uses saved day13 results for partial standings and score-only statistics` plus `projects one global day with the same saved scores as the competition source` | **Two** isolated D1 worlds each run `calendar()` and replay all **13 days** | **One** isolated D1 world, one calendar setup and one `through(13)`; assertions for both public endpoints are in one named scenario | All original score count, played fixtures, rankings, totals, club overview/history, cup, 128 global-day fixtures, 18 competition references, IT-1 per-day parity, and privacy/sensitive-field assertions preserved. The second competition GET is safely reused from the first check. |
 
**Net:** 14 → 13 top-level cases in one Worker runtime file; **one fewer expensive 13-day persisted lifecycle replay**, no change to expected scores, policies, request method, data validation, code under test, or CI requirements. All other isolated cases (missing receipts, corrupted hash, reset generation, full season closure, authentication, unsupported routes) remain independent.

**Validation needed:** exact-HEAD Admin Worker/D1 + browser + Site + FULL PASS, then recorded per-file timing from CI to determine the *actual* speed improvement. Reusing a setup in this narrow case does not authorize shared mutable D1 state across test cases.

## Batch A6 — measured CI, browser lifecycle investigation and static cost review (2026-11-14)

**Exact HEAD verification:** `4121f7192d10e533799fae74436c85859eefc908` finished **PASS** for Site, Browser, Admin, FULL, first-name catalog, SURNAMES and player generator. Cloudflare packaging was correctly skipped; no deployment.

### Worker/D1 runtime evidence from actual Admin jobs

| Exact HEAD | Public sporting Worker file | Worker test cases | Per-file duration | Overall Admin Vitest duration |
| --- | ---: | ---: | ---: | ---: |
| A2 `9507f21` | `public-sporting-runtime.test.ts` | 14 | 18.324 s | 101.79 s |
| A4 `af7da1f` | `public-sporting-runtime.test.ts` | 14 | 27.460 s | 122.51 s |
| A5 `4121f71` | `public-sporting-runtime.test.ts` | 13 | 28.575 s | 130.48 s |

A5 consolidates one exact-day-13 lifecycle replay while retaining assertions, **but measured duration did not decrease** in this sample. The 1.115 s difference versus A4 is not a reliable estimate of overhead or savings: unpaired runners have setup, cache and load variance. **Do not claim performance improvement** based on static replay counts; aggregate multiple equivalent observations before changing runtime gates or making speed claims. The backend Vitest `Duration` includes parallel work and is not the sum of per-file durations.

### Browser QA reliability evidence

- A4 Chromium Browser QA **FAIL** at `tests/canonical-state-browser.mjs:254`: the Debug Settings checkbox initially appeared, was unstable, then became hidden during Playwright `locator.check()` after reopening a mobile overlay. World state at failure was authoritative Season 2/day 21; no page errors were reported.
- A5 Browser QA **PASS** without modifying that browser test or local Debug widget. The existing browser runner exercised SH-03 Chromium **36** checks, SH-03 WebKit **36** checks, and all remaining Chromium/WebKit suites. This provides evidence of **intermittent behavior**, not proof of a particular race or a reason to hide a regression.
- Review candidate: local-only `tools/dev-debug-widget.mjs` uses `animationend` **and** an uncancelled 180 ms fallback timer to hide a closing panel. A reopen before its previous timer expires could hide the new panel. This is a plausible mechanism but **not root-cause confirmed**. Keep the browser gate intact; diagnose/reproduce before changing DEV UI or adding arbitrary waits.

### Read-only inventory enhancement

`tools/test-suite-508-inventory.mjs` now reports **manual review queues** for explicit sporting lifecycle replays/D1 rebuilds and focused/skipped/todo test declarations, in addition to ownership, one-off club IDs, names and global state/IO risk flags. The queues are source scans only; a replay or skipped marker is not automatically classified as duplication or a defect. No CI selector, Worker/runtime, migration, fixture, or product code change.

The 12-point whole-suite audit is still incomplete. A1–A6 are incremental evidence, not final coverage certification.

## Batch A7 — cancel stale DEV widget close callbacks; targeted browser regression (2026-11-14)

**Previous exact-HEAD `49cc75e354aeaf362267369ae4e22faabdafc97f` passed every required CI gate** (Site, Admin/Worker, Browser Chromium + WebKit, FULL, player generator and name/surname catalogues). Meanwhile `main` advanced with Players Directory scroll work. This batch incorporates the main change safely, preserving `tests/players-scroll-browser-532.mjs`, `backend/tests/public-players-directory-runtime.test.ts`, `tools/ci-test-ownership.json`, and associated assets/docs.

**Observed intermittent failure:** A4 `canonical-state-browser.mjs` timed out at the Debug Settings toggle; A5/A6 passed the same flow. Source inspection identified a concrete close/reopen race in **local-only** `tools/dev-debug-widget.mjs`: `setOpen(false)` used both `animationend` and an **uncancelled 180 ms** fallback. If animationend completed early and the button reopened the panel, the stale fallback could later hide the newly opened panel. Previously, each close could also leave a stale animationend listener attached after timeout closure. This is a real code-path hazard; evidence still does not establish it caused the particular A4 failure.

**Fix:** Track the active close's cleanup and cancel **both** fallback timer and event listener before reopening or starting another close. Ignore bubbled child animation events; guard stale finish callbacks. No changes to public output or animation duration. **Regression coverage:** extend existing `tests/canonical-state-browser.mjs` SH-03 Chromium/WebKit flow to reopen a mobile Debug panel immediately after close and assert it stays visible past 180 ms, then close it and continue the original world-state assertions. No new test file, no skipped gates, no added retry loops.

**Next evidence required:** current new exact-head Browser/Worker/Site/FULL workflows must PASS. Runtime benchmarks for A5 are still inconclusive; do not use this browser reliability fix to claim CI speed improvement.

## Batch A8 — preserve Browser Awards strict assertions; align readiness to settled panel (2026-11-14)

**Observed previous A7 exact HEAD** `e4a9433a120e17f43d45e16bfd9a71619af2351e`: SH-03 Chromium PASS (36 checks); later Chromium Browser QA FAIL at `tests/int24-browser-qa.mjs:511` because **22** Awards cards were present when exactly **11** live cards were directly mounted. FULL correctly FAIL as downstream gate. Site, first names, surnames and player generator PASS. The Awards test and renderer were unchanged in A7; this does not establish the cause of the residual skeleton.

**A8 test readiness:** previous `DOMContentLoaded` readiness required only `11` live awards cards, without waiting for retirement of first-paint skeletons. Readiness now requires a known content state, 11 directly mounted live cards, **11 total panel cards**, and no skeleton root. The following strict assertions still independently verify the same 11/11 counts, no skeleton, no fabricated promotion/playoff or recipients; **nothing skipped, weakened or retried**. Persistent duplicate cards remain a failure, not hidden by a timeout. No product, DB, authentication, CI selection, or sporting rule changes.

This is lifecycle synchronization, not a CI speed claim. Verify the new HEAD's required Site, Browser, Admin and FULL workflows; investigate product lifecycle if the panel never converges.

## Batch A9 — consolidate duplicate full-season sporting replay in Worker/D1 (2026-11-14)

**Previous exact-head A8 `48646745918d225938fb4e0598f0f45c5511a5c1`:** Site, Browser Chromium/WebKit, Admin Worker/D1, FULL evidence gate, generator, first names and surnames **all PASS**. A8 Awards hydration readiness passed without removing its strict assertions.

**Independent duplicate found:** `backend/tests/admin-calendar-bridge-runtime.test.ts` executed the full 56-day sporting lifecycle in two separate isolated Vitest cases: one asserted day 56 remained `active`, 56 durable receipts, 4,082 final results and 54 knockout ties; the other performed the *same* admin setup and 56-day sporting replay, then archived/closed the verified season and checked idempotency, immutable archive, provisional next-season candidate and HTTP authorization.

**A9:** remove only the redundant first 56-day replay, move its **four original assertions verbatim** into the second scenario *before* `archiveSeason`. Retain the entire closure/archival, next-season proposal, replay/idempotency, write-protected archives and auth checks. `5 → 4` top-level tests; **2 → 1** complete sporting 56-day replays in this Worker file. A test's dedicated failure label is adjusted to state both phases. This does not conflate alternate error states, skip any gate or share mutable fixture state between cases. The surviving scenario still separately verifies sporting completion while `world.phase === active` prior to archive and closure.

**Verification required:** new exact-head CI (especially Admin Worker/D1, Browser, FULL), and actual per-file timing versus prior A8 logs. Fewer simulation replays do not alone prove faster CI. New main HEAD introduces player suitability code/tests; retained via safe main sync with the new test entered in `tools/ci-test-ownership.json`, while the previously removed Trafford-only test remains absent.

No public product code changed as part of A9 beyond *carrying forward main's already merged additions*. No deploy, remote DB writes or merge authorization.

## Batch A10 — isolate the Season 2 activation integration tests (2026-11-14)

**A9 exact-head Worker evidence:** `80530b2b2cf1d8012bc4c503b7d08809cdc44f3f` Admin foundation Vitest reports **48 files PASS, 305 tests PASS**. `admin-calendar-bridge-runtime.test.ts` improved from A8 **29.233 s** (5 cases) to A9 **15.778 s** (4 cases) in an unpaired run; **46% faster in that file**, without losing assertions. Overall Vitest duration was **132.72 → 149.60 s**, so do **not** claim an end-to-end CI speedup. A9 other required workflows were in progress at the time of inspection. The remaining high-cost tests `season-two-persistence-runtime.test.ts` (**61.899 s**, 10 cases), `season-two-activation-runtime.test.ts` (**50.704 s**, 2 cases) and `lifecycle-command-runtime.test.ts` (**26.299 s**, 9 cases) protect distinct boundaries (season preservation, actual HTTP route, immutable closure and rollback), not proven removable duplicates.

**Concrete order-dependency found:** `backend/tests/season-two-activation-runtime.test.ts` prepared, closed and approved a real 56-day Season 1 once in `beforeAll` but its `beforeEach` only reread `world`. A preceding test could leave `seasons`, `season_day_outcomes`, `season_two_approvals` and the canonical world changed for the next case, including when cases are reordered or expanded.

**A10 correction:** Capture the approved closed-season test-D1 snapshot **once** after `beforeAll` and restore that snapshot in each `beforeEach` using the project's existing `fixtures/test-world.ts` utility, matching `season-two-persistence-runtime.test.ts`. Restore the legacy player↔operator bridge explicitly because `clearTestWorld` deletes it. Both original tests and all HTTP security, Origin, CSRF, idempotency, Season 1 history retention, Season 2 full activation and closure assertions remain. **No additional 56-day replay**, no shared mutable source state, no production code, migration or CI gate change. Snapshot restoration may add setup time; benchmark new exact-head CI instead of claiming a speedup.

**Scope still open:** A11 should classify other costly setups by whether their mutation and rollback boundaries are meaningfully distinct before consolidating more test scenarios.

## Batch A11 — classify lifecycle setup and order-dependency candidates (2026-11-14)

**A10 exact-head evidence** (`5587d2c1289f1d8b0f146ea8bb6059edcfccbea1`): Worker/D1 Vitest **305/305 PASS across 48 files**, including both independent Season 2 activation cases after snapshot restoration. Overall Vitest **77.69 s** (A9 149.60 s); the change in runner/import time and parallel scheduling prevents attributing this whole-job difference to snapshot isolation. The Season 2 activation file was **30.699 s** (A9 50.704 s), and the previously consolidated admin calendar bridge was **9.357 s** (A9 15.778 s). Those are observations from two unpaired CI jobs, not statistically established speedups. A10 **all required exact-head workflows PASS**: Site, Chromium/WebKit Browser QA, Admin Worker/D1 and Account UI, FULL evidence gate, first names, surnames and Player Generator. Preview packaging was skipped by design; no deployment.

**A11 classification refinement:** `tools/test-suite-508-inventory.mjs` now reports a distinct `lifecycleReview` queue in `--json`. It separates **explicit 56-day loops**, total sporting replay call sites, `beforeAll` and `beforeEach` hook call counts, and calls to `restoreTestWorld`/`clearTestWorld` within each Worker source file. This is a read-only, cross-suite discovery aid: lexical signals do **not** establish how often a path runs, root cause of order dependence, duplication, speed or coverage. Existing ownership mapping/strict drift validation remains; no test, gate, fixture, runtime or scheduler is changed.

**Manual review decision and retention map:**

| Worker source | Setup / lifecycle shape | Contract that remains independently protected | A11 action |
| --- | --- | --- | --- |
| `admin-calendar-bridge-runtime.test.ts` | One complete 56-day replay after A9 | Separate administrative staging, sporting boundary, immutable archive, HTTP permission and season closure | Retain |
| `season-two-persistence-runtime.test.ts` | One completed Season 1 in `beforeAll` plus real Season 2 scenarios; durable baseline restored before each case | Frozen source receipts, source archival, concurrency, rollback and source authorization | Retain |
| `season-two-activation-runtime.test.ts` | One completed/approved Season 1 in `beforeAll`; A10 now restores the baseline in `beforeEach`; Season 2 progresses via public HTTP | Authentication/Origin/CSRF, actual route, preserved Season 1 history and Season 2 closure | Retain |
| `lifecycle-command-runtime.test.ts` | Dedicated lifecycle, phase boundary and failure-injection cases | Idempotency, forged receipts, corruption/rollback, concurrency, knockout generation | Retain |
| `season-two-authority-runtime.test.ts` | One actual Season 1 closure within one test | Approved authority rejection/immutability, provisional Season 2 scheduling with unchanged active world | Retain |
| `public-sporting-runtime.test.ts` | Read-only public endpoints at different real world states; A5 consolidated overlapping day-13 projections | No future score leakage, historical visibility, corrupted-source rejection, reset/generation isolation | Retain |

This is a **bounded classification**, not certification of all 300+ owned files. Continue feature-level classification of Node, browser and Match Engine suites before closing inventory or equivalence checkboxes. Additional full-season replay deletion requires an independently proven surviving behavior path; do not deduplicate across different security/transaction boundaries.

## Batch A12 — consolidate duplicate DEV route/server checks in Node (2026-11-14)

**Previous A11 exact head `861b97079ea9b0081ebfe37b5b3cc007c8470de8`:** all required CI **PASS** (Site, Browser QA, Admin/Worker/D1, FULL, Player Generator, names and surnames); Cloudflare Preview packaging was skipped as designed.

**Demonstrated duplication:** `tests/subpage-routes.test.mjs` contained two Node cases, each creating a local `createPreviewServer` instance and issuing four equivalent redirect requests. They separately asserted explicit view availability and security/path rejection but shared the same DEV HTTP route behavior.

**A12:** merge the two cases into one lifecycle-managed server test. Preserve all previously distinct redirect inputs, including historical query normalization, slash removal, legacy club view redirects, percent-encoded club ID forbidden (403), invalid competition and view (404), and international cup root (200). Preserve the original view-availability checks, now derived from **all `competitionViews`** instead of a seven-item hard-coded subset, so supported new views are covered automatically. Use a common `{status,location}` response normalization that enforces no unexpected redirect on successful views. Original case count **8 → 7** in this file; two Node server boots → one; four repeated HTTP checks are deduplicated. No unique security, redirect, route or view assertion is removed.

**Coverage boundary:** `routes-registry.test.mjs` still validates exhaustive canonical route round-trip; `routes-compatibility.test.mjs` still checks hosting config and generated links; `app-canonical-routes.test.mjs` protects public/DEV canonical paths. No production route or hosting configuration changed.

**Validation:** syntax checked and exact-head CI required; fewer server boots do not by themselves certify a significant end-to-end speed improvement. No test skips, arbitrary retries, shared state between remaining cases, CI selector changes, deploys or remote DB operations.

## Batch A13 — consolidate default DEV HTTP server checks for canonical and removed routes (2026-11-14)

**Precondition:** A11 exact-head CI passed all required workflows. A12 exact-head `32711dbf4690fd1bf132f4f2919b5f09d3097561` had not finished Site/Browser/Admin/FULL at the last inspection, so no PASS is claimed for A12 yet.

**Source-proven redundant setup:** in `tests/app-canonical-routes.test.mjs` two separate cases started the **same default** `createPreviewServer()`: the first fetched all canonical site pages, followed their assets and asserted no legacy `/app` links; the second started another server, fetched 8 invalid `/app` aliases (404) and retested 11 canonical routes (200). Nine canonical routes were already checked in the first test; `/` and `/competitions/it-1/standings` remained unique.

**A13:** preserve all eight removed-alias 404 assertions and the two unique success paths in the existing canonical/asset test. Delete only the second, now fully redundant test case/server boot. File-level **6 → 5 Node cases; 4 → 3 server boots**, with no loss of distinct route behavior. Canonical pages still require HTTP 200, correct same-origin asset fetches and no `/app` links. The five other test topics remain, including public allowlist parity and both **distinct** 404 server modes (`devPreview:false` and `devPreview:true,subdomains:true`): these are not folded into the default server because they test different rendering/security behavior.

This intentionally favors a reusable behavior contract over duplicated host/server setup. No added timeout, retry, skipped assertion, product implementation change, routing/hosting config, workflow selector, migration, remote DB or deployment. Verify exact-head Site/Browser/Admin/FULL and per-file timing before making performance claims.

## Batch A14 — Match Engine execution audit and measured Node evidence (2026-11-14)

**Previous exact-head A13 `f73a5e02847decc14605e156d005746d4e773fd0`: all required Site, Browser QA, Admin/Worker/D1, FULL, Player Generator, first names and surnames PASS.** Site FULL Node: **161 files, 1,307 PASS, 0 FAIL, 294.152 s**. Previous A11: **161 files, 1,309 PASS, 0 FAIL, 352.473 s**. The 58.3-second wall-clock difference comes from two unpaired CI runs; do **not** ascribe it to two small deleted cases. Individual case timing comparisons: A11 ROUTE-02 and A03-04B redirects combined **132.275 ms** vs A13 combined case **120.330 ms**; A11 canonical+removed-app cases **289.688 ms** vs A13 consolidated case **224.212 ms**. These are exploratory, not statistically established speedups.

**Execution scope:** Match Engine has **10 independent test source files**: nine Node tests explicitly listed in `match-engine/package.json#scripts.test`, one browser viewport test launched from `.github/workflows/match-engine-01.yml`. The workflow is path-filtered to `match-engine/**`, the local preview server and its own definition. The general `CI-OPT-03 FULL` gate requires Site, Browser QA and Admin workflow evidence, **not** Match Engine's separate targeted workflow. A green #598 FULL therefore does not certify an engine test run.

**A14 change:** Extend the read-only `tools/test-suite-508-inventory.mjs` audit to verify that every discovered Match Engine Node source is registered in its npm script, every browser source in the targeted workflow's `node --test` command, and both scripts and workflow have no stale or missing files. Report `engineExecution` with the actual source paths in `--json`; fail with explicit drift diagnostics on future omissions. The existing 302 Site/Backend ownership entries remain unchanged, as do test execution workflow selection, engine physics and all test assertions.

**Retention:** `match-engine/tests/player-movement.test.mjs` has 172 static named cases, `physics-diagnostics.test.mjs` 46, with separate contact, spin, diagnostics, determinism and UI contracts. Those are **source-level** counts, not measured runtime counts or proof of duplication. Avoid modifying the active Match Engine implementation/#480 without a separate focused review.

**Validation:** current package script and workflow membership verified at 9 Node + 1 browser; JavaScript syntax validated. The helper is a diagnostic inventory and is not itself a Match Engine runtime test. Required exact-head CI after A14 must still be checked. No production code, targeted workflow trigger, CI selection, database, deploy or merge change.

## Batch A15 — generic INT-24 brackets and invalid-case contracts (2026-11-14)

**Review:** `tests/competition-rules-model.test.mjs` already validates the derived league metrics for all 18 competitions, but its bracket topology and nine invalid-input mutations only exercised the first international competition (`int-1`). The other independently configured cup, `int-2`, has the same format but a different, explicitly bound final event.

**A15:** replace the arbitrary `int-1` fixture with the complete `category === 'international'` catalogue collection (asserting that it contains both cups). Check **all four original bracket invariants** for each cup, and run the **same nine malformed-input mutations for each cup**. The wrong-final mutation selects the *other* cup's actual final marker, which keeps the cross-competition binding test meaningful in both directions. The 4 existing top-level Node tests remain **4**; bracket validation runs on 2 cups instead of 1; 9 invalid cases become 18. Each failed assertion names its cup, with malformed-case labels making failures actionable. No additional competition, duplicate test file, arbitrary name, timeout or external IO.

**Not modified:** published sport rules or calendar, live cup generation, rules registry, competition catalog, data, backend/Worker/D1, Match Engine, CI routing, deploy and remote DB. After the change, check exact-head Site and required FULL evidence. Individual test runtime and overall CI wall time must be measured rather than assumed.

**Previous A14 HEAD** `7aab99a822053b270c13b850c27b392ef180c1e1` had Site, Browser, Player Generator and both name catalog workflows PASS; Admin + FULL were still in progress when A15 was prepared. A15 exact-head result must be checked separately. PR remains Draft/HOLD; no merge authorization.

## Batch A16 — reject malformed domestic rules across all 16 divisions (2026-11-14)

**Previous A15 exact HEAD `2f5a37b17d5d633f005fc323708ed945e9cd7029`: all required CI PASS**, including full Site/Browser/Admin/Worker+D1, FULL evidence, player generator and both player-name catalogues. The PR remained aligned to `main@ba6e4b0d10ef749da8382dd2db5c0b220858fe83`.

**Uncovered boundary:** The existing rules-model test already checks valid metrics/version identities for all 18 catalogue definitions and malformed INT-24 rules for both cups (A15), but does not reject corrupted domestic rules across **all 16 independently defined leagues** and both promotion/relegation tiers. A single named league would be a poor proxy for this invariant.

**A16:** Extend the existing negative-rules Node test with the full `category === 'domestic'` collection and assert exactly 16 divisions. Apply seven labeled negative mutations to every definition: odd participant capacity; negative win points; unsupported qualification policy; foreign international calendar marker; duplicated national round marker; unknown rank-outcome kind; and rank starting outside the table. All **112 additional invalid domestic variants** must be rejected by the real `validateCompetition` API with the division ID and case label in the failure message. The original **18 invalid INT-24 variants** and all four original bracket topology rules remain unchanged; the file retains **four top-level Node test cases**.

**Independent direct source check before committing:** Evaluated the current canonical 16 division definitions (normalized through the real calendar/rules model): all 16 are valid unchanged, and all 16 × 7 = 112 mutated definitions are invalid. No production behavior, fixtures, labels, catalog, player/Match Engine code, CI runners/gates, D1 database or deployment changed.

**Measured outcome needed:** New exact-head Site/Browser/Admin/FULL after A16; compare affected Node test timing if CI logs are available. More assertions do not imply a faster suite. Overall issue #508 acceptance is not yet complete and the PR remains Draft/HOLD.

**A16 main synchronization:** While A16 was prepared, `main` advanced to `cb3ac032466414ceb43d3fceff4e7fb54a908645` with the new match-slot storage/public APIs (#601), two SQL migrations and additional match ID/knockout/migration tests. The branch deliberately retains every incoming match-slot assertion, including the public final slot before and after the actual 56-day sporting lifecycle. Their checks were transferred from main's redundant second season replay into A9's single consolidated closure scenario, **without recreating a second 56-day replay**. The unchanged downstream closure/archive assertions remain byte-identical; the first three Worker integration cases are retained from current main. The test-ownership manifest includes four newly introduced tests but continues to omit the removed Trafford-only identity test. All other incoming main files are copied unchanged. This is an integration of already merged main work, not additional #508 product behavior. The reconciled exact HEAD must pass current Site, Worker/D1, Browser and FULL CI.

## Batch A17 — DOM representation coverage across every domestic division (2026-11-14)

**Previously** `tests/competition-overview-teams.test.mjs` created one artificial Italian top-tier `IT-1` fixture with sequential IDs 1–16 and checked overview figures, links ending in `01` and `16`, missing/duplicate participants and a malicious player/club name. This did **not** cover the real second-tier club IDs 17–32 or any of the other seven nation URL prefixes, nor the approved manifest's real club identities.

**A17:** Replace the arbitrary synthetic league with all **16 domestic divisions from `competitions/_shared/manifest.json`**, preserving the same **three top-level Node cases**. For every league: assert league totals (16 clubs/30 matchdays/240 matches), approved title, absence of fabricated champion/results, all 16 canonical club-overview URLs (256 links across eight country prefixes and both tiers), invalid participant count, duplicate club identity, empty name and invalid ID, plus HTML escaping in competition title, club name **and stadium**. Each failure identifies the division; URL assertions identify the club ID. No fixed one-club name or one country is treated as representative of the whole product.

**Live-model verification before commit:** evaluated the actual pure `competitionSummary`, `renderCompetitionOverview` and `renderCompetitionTeams` implementations against the current approved manifest. All 16 unmodified inputs pass, all 256 canonical links are correct, all **64** malformed participant cases reject, and all 16 XSS-injection variants escape names, stadiums and titles. This is a source-level functional check, not an extra CI job.

**Boundary:** The existing `tests/club-competition-summary.test.mjs` protects *dynamic* standings, postseason progress, unplayed scores and next matches; the A17 test protects *static participant identity and HTML output*. They are distinct and neither is removed. No product code, D1, match engine, target CI selector, synthetic sleeps or deployment changes. New exact-head Site/Browser/Admin/FULL must pass; no CI runtime gain is asserted from broader coverage.

## Batch A18 — eliminate arbitrary IT-only world-catalog lookup samples (2026-11-14)

**Review:** The three existing `tests/world-catalog.test.mjs` cases checked generic 320/16/18/352 cardinalities, but most public accessor behavior was demonstrated with only `IT-1`, `IT-33`, one Italian rivalry and a handful of parser literals. These were incidental fixtures rather than a justified country-wide functional boundary.

**A18:** Keep the **same three top-level Node cases** and all existing negative categories. Compare all **320** canonical club identity lookups and parser results with their source records; verify each club's current provisional division assignment including **64 inactive**, all **16** actual divisions and their **256 unique active members**, 8 countries with 2 divisions and 40 correctly ordered clubs apiece, plus both INT-24 competition lookups. Check the full **320 × 5 localization matrix** (native text override preserved), all **352 bidirectional rivalry references**, unsupported locale, invalid club IDs, and immutable retrieved objects/arrays. Keep duplicate club, invalid approval, bad rivalry endpoint and missing non-native translation rejection tests; pick the corrupt sample from the real source rather than an arbitrarily named Italian club.

**Coverage retained/replaced:** Exact source-backed club identity, first/second-tier lookup, provisional status, zero-division inactive clubs, reversed rivalry indexing, language integrity, parser namespace/range and frozen public views. The new checks generalize the old one-off examples while preserving the 3 test labels and diagnostic ID/locale context. No test disabled or removed. Source-level reasoning alone is not an executed-test PASS; require new exact-head Site and FULL workflows, and record timing rather than attributing a speed gain to larger loops.

**Boundary:** No world-catalog implementation or dataset changes; no sporting calendar, backend/Worker/D1, player generator, Match Engine, CI selection, remote database, deployment or merge. Maintain PR #598 as Draft/HOLD pending separate authorization and issue #508 as incomplete.

## Batch A19 — generalize Club Competitions DOM contracts across countries and five locales (2026-11-14)

**Before:** The first three \`tests/club-competition-summary.test.mjs\` cases already covered all 16 divisions for standings/postseason and clock mapping, but the final two DOM and deterministic-rendering cases used a single invented representative (\`IT-1\`, club 1). That is too narrow for a generic country/tier presentation contract.

**Change:** Preserve **all five Node tests** and replace only the two IT-only UI cases with data-driven checks against **all 16 actual domestic divisions** from the approved manifest. Each representative real club is rendered with five locales (EN/DE/ES/FR/IT), covering unknown standings, localized status/fixture copy, correct division links, escaped fixture names, next-round route, unlinked rank, absence of speculative points, completed-season empty fixture, invalid negative-point snapshot and mismatched club identity. Repeat-render equality and wrong-club rejection now apply in all countries and both tiers; English ordinal formatting remains explicitly checked.

**Removal-to-survivor mapping:** The prior single-IT assertions for generic Club competition card, empty data, matching snapshot, fixture/rank, no upcoming match, and repeat idempotency are each retained inside the new all-division loops. No existing error category or top-level test is removed. This is Node DOM contract coverage, not a new browser suite and not a performance optimization. Failures include division/locale context.

**Safety:** Test source and this documentation only; no club data, gameplay, public runtime, DEV widget, Worker/D1, security, Match Engine/#480, CI selector/required checks, deployment or remote database touched. Record exact-head CI outcomes after A19. Draft/HOLD, no merge authorization; #508 whole-suite audit remains open.
