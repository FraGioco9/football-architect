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
