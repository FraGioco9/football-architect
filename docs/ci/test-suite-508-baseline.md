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
