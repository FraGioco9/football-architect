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
