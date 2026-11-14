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
