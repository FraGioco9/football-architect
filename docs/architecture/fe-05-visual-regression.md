# FE-05 — Visual Regression & Interaction Tests (#369)

> **Merged implementation / historical acceptance record — REPO-04 #358, 2026-11-06.** #369 was squash-merged in PR #401. FE-05 compares deterministic visual samples on the **same source SHA** and does not approve permanent cross-commit golden files or physical-device accessibility. See the [current CI/QA operating guide](../ci/README.md). Baseline SHAs, old open-PR wording and test run receipts below remain dated evidence; they are not current merge/deploy authorization.


## Baseline, scope and dependencies

Starting main: 071891ae8b7baf0f7ecaccf93bc105bb969d34b2, after FE-01 (#365), FE-02 (#366), FE-04 (#368), the Safari follow-up and FE-03 (#367) squash merge (PR #402). The FE-03 implementation only changes the Clubs directory card-update path; no FE-05 file overlaps. The visual suite is rebased onto the post-performance HEAD. Cross-commit historical golden files remain explicitly outside the scope of this bounded same-SHA visual stability suite. No application runtime, CSS, routing, backend, remote DB, publication or deployment changes are authorized by this PR.

The new suite measures deterministic **same-SHA** visual stability, not cross-commit visual approval. It must never auto-update a golden to make failures pass.

## Coverage and ownership

The existing tests continue to own the comprehensive behavioral matrix: int24-browser-qa.mjs covers domestic and international Fixtures, one-/two-leg knockouts, standings, Stats, History, Debug and tooltips; canonical-state-browser.mjs covers delayed/out-of-order responses, source transitions, Season 0, Back/Forward and resets; club-pages-browser.test.mjs and page-load-02-club-browser.mjs cover first paint and DOM identity; FE-02 Chromium/WebKit covers mobile/overflow; FE-04 covers keyboard and five locales; existing Account/Admin suites cover async form and permission states. FE-01/CLEAN-UI remain the CSS-base-vs-HEAD parity owners.

FE-05 adds 11 bounded visual samples: Landing, Dashboard, domestic Standings/Fixtures, international Postseason, Clubs directory, Club Overview/Roster, Calendar, anonymous Login and Admin Settings. Widths 320/390/768/1440, both themes and EN/DE/ES/FR/IT are distributed pairwise; do not expand to a Cartesian suite. Each Chromium test fixes viewport, DPR 1, reduced motion, browser locale, local theme/language and anonymous API fixtures. It captures stable chrome, computed style, position and element pixel data before and after refresh; permits at most 0.2% changed pixels, with geometry independently guarded. Dynamic scores/people are not masked or treated as approved source data.

A separate pre-hydration case holds the deferred competition controller while examining the static tabs/season/header DOM, then releases it and asserts the same control cardinality. A focused Back/Forward case checks URL, selection and stable tab geometry. Neither duplicates the existing full asynchronous or Debug engine.

Artifacts on failure include SHA, route, viewport, locale, theme, scenario, browser and screenshot. The test logs duration for each successful sample and emits one JSON result file. Historical cross-commit goldens are not committed or auto-updated; the selected screenshot comparisons are made against the same-HEAD pre-refresh rendering and require real post-#367 CI evidence. Any separately proposed historical golden collection requires manual baseline review.

## CI modes and commands

FAST: unchanged, no browser. TARGETED: unchanged area-local Chromium/WebKit pairwise smoke. FULL: run the FE-05 Chromium script **once** in the existing Browser QA workflow, using its existing Playwright 1.58.2, pixelmatch 7.1.0, pngjs 7.0.0 and local preview. The Node fixture/negative geometry unit test joins Site FULL. No new workflow, manual dispatch, publication exception, extra browser installation or DB task. Existing exact PR HEAD and FULL evidence gate remain authoritative.

On Windows PowerShell and Node 22, with the standard preview already started on port 2000 and pinned browser dependencies installed:

    node --test tests/fe-05-visual-contract.test.mjs
    node tests/fe-05-visual-browser.mjs

The new suite must not start a second port-2000 server. If browser dependencies/preview are unavailable, report UNKNOWN instead of PASS. Run negative assertions (frame displacement, hidden state, changed color and screenshot tolerance) to establish that meaningful regressions fail.

## CI cost and acceptance

Pre-change observed PR #393 source-SHA workflow wall times: Browser about 11.9 minutes, Site about 6.1, Admin about 5.5; the FULL evidence observer about 12.2 minutes, overlapping and not additive. These are historical reference observations, not current-head benchmarks. FE-05 measured ~8.7 and ~13.7 seconds for its own Browser runner on the pre-#367 branch, against the <2 minute budget; the post-#367 rebased source must pass new exact-HEAD hosted CI before merge. No additional FAST cost. Do not rerun successful full workflows needlessly.

PASS means Node negative tests, deterministic browser samples, existing Site/Browser/Admin FULL on the rebased exact PR source HEAD and no unexplained drift after #367. FAIL means reproducible mismatches. UNKNOWN: physical iPhone Safari/assistive-tech certification, long-run flakiness, long-run hosted CI cost trend, and cross-commit permanent golden approval (not part of this PR). One Draft/HOLD PR; no merge/deploy/remote D1 without separate authorization.
