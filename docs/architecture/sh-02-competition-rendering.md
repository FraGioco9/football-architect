# SH-02 — Unified competition rendering (DOM equivalence)

Base: main `600ba19439add3c6535511540d225f30bb753fa7` after PAGE-LOAD-02 #359 closed (#381 and #384 squash-merged).

## Existing owners

- `tools/render-competition-page.mjs` and `tools/generate-app-pages.mjs` own the static HTML of 16 domestic divisions and both international cups; the seven tab buttons/underline and skeleton dimensions remain unchanged.
- `assets/competition-tabs.js` owns view/season/round routing and native Back/Forward.
- SH-03 owns world/Debug source authority, revision, source/selection leases and out-of-order response rejection.
- SH-01 `assets/competition-rules.js` and the versioned definitions own postseason topology, leg order, domestic tiers and INT-24 advancement.

## Consolidation and equivalence

| View | Previous work duplicated or unnecessarily rebuilt | After SH-02 |
| --- | --- | --- |
| Standings desktop | Replace entire 16/24-row tbody after every accepted sporting revision | Reconcile keyed club rows in place; preserve static pre-rendered identities, crest hosts, focus after reordering and correctly updated rank/points |
| Standings compact | Own recursive DOM reconciler and append order | Use same keyed reconciler and preserve expanded details, keyboard focus, crest images and updated values |
| Domestic/international postseason | Restore every configurable placeholder before re-applying a known winner | Reset only unbound slots; same club identity keeps its mounted crest host and anchor |
| Fixtures | Independent match-list reordering and result/selector replacement | Reuse the shared DOM reorder owner; skip equal result/selector nodes; keep isolated-fixture harness behavior |
| Stats | Recreate matching statistics cards on unrelated context revisions | Keep cards and focus when normalized data/view/status are unchanged |
| History | Rebuild identical player records for same data and locale | Cache the rendered immutable data/identity/locale presentation, but hydrate newly mounted card nodes even when records are unchanged |
| Awards | Replace all mounted award cards, medallion SVGs and pitch placeholders | Reconcile only direct-child mounted content, never first-paint skeletons; skip building detached icons when recipients/award identities are unchanged |
| Rules / selectors / skeletons | Already have independent state/signature/first-paint ownership | Intentionally unchanged; no sporting, HTTP, CSS or generated markup refactor |

These optimizations do not invent sporting data. The existing context validation and rendering paths are retained for confirmed empty/unavailable and Season 0; no source transition is inferred from UI. The shared helper is DOM-only and does not subscribe to async events.

## Validation contract

Targeted Node regression suite, generator byte equality, syntax, existing fixtures/standings/stats/history/awards/state tests and exact-head Site/Browser/Admin checks must be recorded at the final SHA. Browser evidence distinguishes actual Chromium/WebKit from real iPhone Safari (not available unless independently performed). The SH-02 browser matrix now navigates all seven real views in each of 18 competition identities while asserting static tab/panel/crest DOM identity; existing INT-24 Browser QA additionally covers four widths, five locales, both themes, Season 0/history, knockout legs and source transitions. Delayed/empty/failed/out-of-order API and Debug transitions need explicit evidence before acceptance.

One Draft/HOLD PR, no merge/deploy/remote D1, no changes to backend, CSS-wide styles or DEV startup.
