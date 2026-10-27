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
