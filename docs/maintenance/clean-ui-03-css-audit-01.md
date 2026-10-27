# CLEAN-UI-03 — CSS consolidation: first-pass audit (2026-10-27)

Tracking: [issue #322](https://github.com/FraGioco9/football-architect/issues/322). Baseline: `main` commit `4cfd9b3b92983f47979b45567d260ae10e4158ac`.

## What was confirmed

- `assets/app.css` has 1,140 physical lines and 111,652 JavaScript string characters in the GitHub file read.
- There are 68 literal occurrences of `@media` (this is not necessarily a count of unique media-query conditions).
- A preliminary text-level scan saw 137 repeated block-header strings; this included `from` and `to` keyframe headers and **must not** be described as a CSS duplicate count.
- An exact adjacent identical-line rule check yielded **zero** matches. No trivially provable adjacent duplicate was identified by that test.
- The first areas to inspect are (approximate **baseline** line positions):
  - History record layout and responsive adjustments around L618–L630 and L874–L883.
  - Calendar simplified selectors and dialog around L911–L954.
  - Calendar / Fixtures common control refinements around L955–L1000.
- Multiple selectors are deliberately scoped to `#world-calendar`, `#competition-panel-history`, `html[data-theme="light"]` and different responsive contexts. A repeated selector name by itself does not prove redundancy.

## Required before changing CSS declarations

1. Produce a parser-based list of rules with containing `@media`, `@supports`, keyframes, and source order. Compare declarations, importance and specificity in the **same cascade context**.
2. Identify exact, demonstrably shadowed declarations only after checking states, themes and responsive breakpoints.
3. Record the **ordered** CSSOM and a per-route computed-style/geometry baseline. Keep `@media` / declaration order stable unless the browser-equivalence proof is compelling.
4. Test Calendar, Fixtures, History, shared navigation, light/dark, EN/DE/ES/FR/IT and 320/390/768/1440 widths. Include hover/focus, touch emulation, dialogs, animations/reduced motion. Existing Chromium screenshot suite is necessary but not sufficient for claiming Safari parity.
5. Check generator and manifest outputs plus public/DEV boundaries. No production deployment or remote database work.

## First-pass decision

**No CSS declaration deletion is authorized from this initial scan.** The first PR records the audit and gates; a subsequent update on this same Draft branch may include a minimal demonstrated-equivalent CSS change when an appropriate baseline is available. This avoids turning an inconclusive textual repeat scan into a purported semantics-preserving refactor.

## Related completed work

PR #321 reconciled README and added navigation comments to CSS, with ordered CSSOM and visual parity checks. Those checks covered the **documentation/comment-only tree**; they do not automatically prove a later CSS consolidation safe.

## Implementation checkpoint 02 (same Draft PR)

- Removed the **later** copy of the same `@media(max-width:620px)` / `.app-competition-header` custom property assignment to `64px`, and the later `@media(max-width:360px)` assignment to `58px`. Earlier originals at the same breakpoints remain intact. Commit `f496ced0140620f032fc11f18faee2f645056de5`. This removes 166 source characters, not a claimed 166-byte minified payload reduction.
- Prior History mobile override removal commit `c97d2d0854867c38be632a2e445501b21b5592b1` passed exact-head landing, head-exact and chromium jobs.
- A follow-up brace/context scanner over the new file found 986 simple leaf declarations and no exact identical selector/body/context groups under its **limited** parser model. Its output is not a substitute for a CSS Syntax Level 3-compliant parser; nested media/keyframes and the scanner's context recovery limit its negative result.
- More aggressive cleanup is **deferred** until full AST proof and route-level computed-style equivalence. The CSS remains intentionally mostly unchanged.

## Candidate classification and next work

- Identical text in different breakpoints (such as standing-table row height at min-width 621 and 1160) is **not** necessarily redundant: removing it changes cascade priority and can expose intervening overrides.
- `@keyframes from`/`to` duplicates cannot be deduplicated across named animations.
- Selector reuse across History record layouts and Calendar/Fixtures controls is intentional until responsive and keyboard/touch behaviors are mapped.
- Only exact same-condition responsive assignments with an earlier preserved source have been targeted in this batch. Full visual/browser parity for the newest HEAD remains an acceptance gate.

## Adjacent workstream reconnaissance (P3/P4, no implementation yet)

On the current `main`, `tools/generate-app-pages.mjs` (25,717 source characters) already inserts route-specific scripts and template dependencies. It contains separate `landing.js`, `competition-page.js`, `international-cups.js`, and Calendar bootstrap/model references; these are **not** proof that landing scripts are dead on non-Landing pages because runtime language/state initialization may depend on them. Current `assets/app.js` is approximately 73,130 characters and `assets/landing.js` approximately 12,049 characters. A removal/split requires ordered script-dependency traces in actual generated HTML and a five-language/theme/bootstrap regression first.

P3 controls must similarly distinguish Calendar current-week navigation, Fixtures matchday selectors, History season selector, native dialog focus handling and touch/mobile behavior before sharing a primitive. **No shared-controls or asset-loading change is made in this PR.**

## Checkpoint 03 — regression contracts

Added `tests/clean-ui-03-css-contract.test.mjs` (Node built-in test runner) to pin the three proven same-condition responsive deduplications: a single History `display:none` source declaration at max-width 620, a single logo-size `64px` at max-width 620, and a single `58px` at max-width 360, while retaining the default `82px`. It also asserts presence of the shared template's current script/style dependencies rather than changing load order prematurely.

These are **source contracts**, not replacement for browser CSSOM/visual parity. The earlier checked-in cross-route Chromium workflows must pass on the exact new HEAD. If the contract conflicts with an intentional later design change, update the contract and supporting QA together rather than deleting guards silently.

## Checkpoint 04 — exact-head CI and test hardening

The pre-hardening HEAD `782069ca61c1a90c53ea2442cd91707c9bf1d040` completed all 3 checks successfully: `landing`, `head-exact`, `chromium`. The source-contract tests originally used multi-line regex spans that could inadvertently cross outside the intended `@media` block; follow-up commit `6e5b40e0d313f5237cc1acba1802ef61295c3d76` replaces these checks with balanced-brace `mediaBlocks`/ `mediaHas` assertions and retains exact declaration counts. This helper is intentionally narrow and only validates the three known declarations; it is **not** a full CSS parser or computed-style proof. Recheck CI on the newer HEAD.

## Checkpoint 05 — navigation, focus, touch and palette contract expansion

After confirming that the previous HEAD has passed `head-exact` while `landing` and `chromium` were still running, expanded `tests/clean-ui-03-css-contract.test.mjs` with **four** targeted protections (Calendar/Fixtures arrow and selector hover state, Calendar reduced-motion and touch overrides, History breakpoint scopes, four Calendar event types in dark/light palettes). This stage adds **no CSS edits**; the checks safeguard the most sensitive shared-controls styles in preparation for later consolidation. These regex and media-block source assertions are necessary guardrails, not full browser appearance/accessibility evidence. Exact-head CI must be checked after the final commit.

## Checkpoint 06 — single-batch offline CSS audit

Added a standalone, **read-only** Node 22 inventory command `node tools/audit-css-cascade.mjs assets/app.css`. It records leaf rule selectors, containing at-rule contexts and source lines, and reports only identical selector/body/context candidates. Named keyframes and distinct media conditions stay separate. Four synthetic fixtures cover repeated scopes, breakpoint/keyframe separation, comments/quoted braces, and fail-closed unbalanced input; a fifth smoke test scans the existing stylesheet. This is a diagnostic aid, not a fully standards-compliant CSS parser (e.g. selector syntax edge cases) and it never rewrites styles.

**CI cadence:** Owner requests tests **only after completing the batch/PR**, not polling every intermediate commit. This checkpoint is prepared as one tree/commit update; no manual workflow was dispatched. Automatic push-triggered workflows may still be scheduled by GitHub repository policy. Review the exact-head results at the final acceptance gate.

## Checkpoint 07 — audit robustness and strict context guards

Follow-up hardening handles unmatched closing parentheses/brackets as fail-closed errors and adds scoped fixtures for distinct `@supports`/`@container` rules, accurate source line reporting and mismatched delimiters. These are deliberate **audit-only** changes; no new CSS styling rules were removed. The candidate inventory must still be treated as a conservative locator rather than a complete standards parser.

The owner has requested **one CI acceptance run at the end of the PR**. Changes are grouped in a single tree/commit where possible. GitHub's automated push workflows remain under repository policy; no manual workflow dispatch or interim check polling is performed.

## Checkpoint 08 — cross-context CSS candidate triage
The read-only audit now also emits `crossContextCandidates`, listing selectors repeated across distinct at-rule contexts with their original context, source line, and normalized declaration text. These are **review-only** entries, not redundant rules eligible for deletion; computed rendering and specificity must still be checked. Added tests for cross-breakpoint same-selector cases, differing declarations, and ordered `vh`/`svh`/`dvh` fallback declarations, which are intentionally repeated and must not be removed. No stylesheet changes in this checkpoint. CI remains a final acceptance gate only.

## Checkpoint 09 — responsive ownership summary

The read-only CSS inventory now reports `scopedRuleCounts` keyed by the first containing `@media` condition (or `(unscoped)`). This makes dense Calendar / Fixtures / History responsive regions easier to prioritize without treating identical selectors across different breakpoints as safe deletion candidates. The new summary is deliberately **diagnostic only**; it is not a CSS cascade rewrite, an equivalence certificate or a percentage of redundant declarations.

Added two focused tests for scoped counts and nonmutation of the input CSS string. Changes batched on the existing Draft PR, with no manual CI dispatch or interim CI polling as requested. The final exact-head CI and rendered parity gate remain outstanding.

## Checkpoint 10 — actionable CSS audit summary

The auditor now offers `formatCssAuditSummary`, a deterministic, nonmutating summary ranking the 12 densest containing media scopes, plus separate counts of truly identical scoped-rule groups and cross-context selector reuse. These two categories cannot be conflated. Two new tests cover ordering and the distinction. The underlying source remains unchanged and no automatic CSS rewrite is performed.

Issue #322's body checklist is updated directly at each implementation batch. Only narrowly completed **subtasks** are checked; major P1 consolidation, render equivalence and CI remain uncompleted. Test scheduling follows owner's final-PR-only requirement.

## Checkpoint 11 — shared control and page asset baseline (read-only)

The canonical `templates/app-page.html` currently loads, in order, `/assets/theme.js`, `/assets/landing.css`, `/assets/app.css`, `/assets/landing.js`, `/assets/app.js`, and `/assets/app-search.js`. The template's scripts and styles are deliberately preserved until dependency tracing demonstrates safe page-specific removal. The app-page generator also conditionally assembles Calendar, competition and navigation assets; selective loading must evaluate those branches and the generated outputs, not the source template alone.

Control ownership reference (source-token inventory, **not** rendered component count):

| Component | CSS token occurrences | Generator token occurrences |
|---|---:|---:|
| Calendar week | 7 | 0 |
| Calendar arrows | 9 | 0 |
| Fixtures | 17 | 0 |
| History | 12 | 0 |
| Dialog | 36 | 0 |

Interaction contracts to retain before shared extraction: Calendar week buttons and current-week reset; Fixtures matchday navigation and disabled states; History archive season controls; event dialogs and Escape/focus return; touch/coarse-pointer tooltip suppression; reduced-motion animations; light/dark event palettes. CSS class reuse alone does not prove equivalent keyboard or layout behavior. No template/JS/CSS behavior change in this batch.

## Checkpoint 12 — asset presence without false unused-file claims

Repository tree read-only baseline at this checkpoint: 561 tracked blobs, of which 353 paths under `assets/` (directory entries excluded). These counts are **not** an unused-asset inventory. The shared-template inventory now includes a pure `classifyAssetReferences(urls,knownPaths)` helper that distinguishes `present`, `unresolved`, and `non-asset` URLs, while stripping only URL query/hash from path comparisons. It never calls a file dead just because it is not linked directly from the shell: generators, dynamic references, catalogs, manifests, flags, licensed artifacts and DEV/public guards must all be considered. Two tests protect query-string comparison, unresolved links and head-only extraction. No loading changes, no deletion, no CSS behavior changes.

## Checkpoint 13 — page asset dependency comparison and path classification fix

Fixed the exact pathname normalization for root-relative asset URLs in the read-only presence checker, then added `comparePageAssetInventory([{route,html},...])`: a deterministic comparison of *direct head links* across supplied generated pages. It reports shared and route-specific resources with route membership but makes **no inference of unused or removable code**. Added regression tests for root-relative asset path normalization, page-specific vs common script comparisons and empty pages. This is groundwork for an eventual real generated-page dependency walk; it does not alter template scripts, DOM behavior, CSS or deployment gates. Tests remain reserved for the PR final acceptance stage.

## Checkpoint 14 — actual generated-page direct-link audit

The shell inventory now accepts multiple checked-in/generated HTML file paths through `node tools/audit-shell-assets.mjs dashboard/index.html calendar/index.html settings/index.html competitions/index.html clubs/index.html`. It emits shared and route-specific head links with route provenance and makes no filesystem changes. Tests read these five *actual* route files and protect common `app.css` / `app.js` links, page-specific links, provenance and nonmutation. This advances direct HTML dependency evidence, **not** proof of safe script unloading, dynamic reachability, browser timing or transfer-size improvements.

No HTML output, shared template, generator, CSS declarations or JS runtime modified. CI is reserved for final PR acceptance; GitHub may still start repository-configured automatic checks following the atomic commit.

## Checkpoint 15 — measured direct-link counts per generated route

Extended the generated-page inventory with deterministic per-route counts of head script references, head link references, cross-route shared references and route-specific URL lists. This is **source measurement**, not network traffic or load-time measurement. A new synthetic test locks shared/specific counts. The command can be run against five generated pages listed in checkpoint 14 without mutating source files. Runtime dependency tracing remains necessary before removing `landing.js` or `landing.css`, and no asset is marked safe for deletion from direct-link absence alone.

No CI runs manually dispatched or polled mid-PR; no merge/deploy/DB operations.

## Checkpoint 16 — static script-reference evidence

Added a read-only `inspectStaticScriptReferences(source)` helper reporting only literal ESM imports, literal dynamic imports and literal CommonJS `require` specifiers. Computed dynamic imports are intentionally **unknown**, not absent dependencies. The helper is conservative, not a JavaScript parser and does not inspect runtime-created DOM script elements. Two regression tests cover literal and computed cases. This improves candidate discovery without authorizing removal of landing scripts or changing any runtime file. No intermediate CI polling/dispatch; final PR gate unchanged.

## Checkpoint 17 — conservative transitive literal-import linkage

Added `traceLiteralPageImports(report,sourceByUrl)` to connect each page's direct HTML script roots to literal relative ESM imports in supplied source text, following only local relative specifiers with deterministic visited ordering. Missing sources and package-style specifiers are **explicitly unresolved**, not classified as safe to remove. Cycles are bounded. Three tests cover nested imports, unresolved dependencies and cycles. This is an in-memory advisory; computed dynamic imports, classic script globals, DOM-injected scripts and browser timing remain unknown, and no runtime loading has changed. It is not evidence that Landing assets may be removed.

## Checkpoint 18 — import graph completeness classification

Added `summarizeImportReachability(traces)`, reporting HTML script roots, visited literal import modules, unresolved references and status `partial` / `literal-only-complete`. The latter deliberately **does not** mean full runtime reachability: scripts may rely on globals, calculated dynamic imports or DOM injection. Two tests guard missing-module counts and this distinction. There is no app behavior change, asset removal or optimization claim. Final exact-head CI remains deferred by owner request.

## P3 implemented overlap — existing shared arrow styling (no new components)

Code review on the branch confirms Calendar and Fixtures **already share** four paired geometry declarations for both standard chevrons and SVG icon viewport alignment. Keeping them as joint selector rules is the most conservative extraction of the genuinely identical styling contract: no new component, no change to selector order or specificity, and no coupling of their distinct enabled/disabled, week/matchday, tooltip, hover and keyboard rules. Two regression tests now lock the already-shared geometry and the four-ID Calendar enabled-state consolidation. Calendar event dialogs remain distinct, and real browser/iPhone, five-language and both-theme P3 verification remains outstanding.

The resolved P3 scope is only **shared-arrow style extraction**; it does not certify identical behavior of all navigation controls or finish the entire P3 workstream.

## P1 direct before/after proof (source-level)

Compared the actual PR stylesheet to current main: 111,652 vs 111,152 characters (500 characters less). All five previously duplicated declarations appear once in the PR. The four Calendar active selectors collapse into one shared `:is()` rule, with the same ID-level specificity and declaration body. The comparison is source-based; ordered CSSOM, live computed styles, snapshots and Chromium remain unverified and are NOT approved by this evidence alone. The PR retains Draft/HOLD.
