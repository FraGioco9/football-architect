# CLEAN-UI-03 — generated-page and template asset dependency audit

This record closes the **existing P4 dependency-audit checkbox** of issue #322, on Draft PR #323. It is an analysis of real checked-in HTML and generator code, **not** a measured network/runtime performance optimization.

## Observed direct script links (in DOM declaration order)

| Page | Scripts |
| --- | --- |
| Dashboard / Settings | `theme.js`, `landing.js`, `app.js`, `app-search.js`, `sidebar-evolution.js` |
| Calendar | `routes-registry.js`, `theme.js`, `landing.js`, `app.js`, `app-search.js`, `world-calendar-model.js`, `world-clock-adapter.js`, `world-calendar.js`, `calendar-simplified.js`, `sidebar-evolution.js` |
| Competitions index | `routes-registry.js`, `theme.js`, `landing.js`, `app.js`, `app-search.js`, `international-cups.js`, `sidebar-evolution.js` |
| Clubs directory | Above competition-index assets, plus `competition-tabs.js`, `clubs-directory.js` |
| Domestic / international competition page | `routes-registry.js`, `theme.js`, `competition-model.js`, `competition-page.js`, `sidebar-evolution.js` |
| App template | `theme.js`, `landing.js`, `app.js`, `app-search.js` |
| Guide | `theme.js`, `landing.js` (relative paths, separate page) |

## Stylesheets

The app template includes `landing.css` and `app.css`. Dashboard, Calendar, Settings and Competitions add `sidebar-evolution.css`; Clubs additionally loads `clubs-directory.css`. Competition detail pages use `landing.css`, `app.css` and `sidebar-evolution.css`. Guide uses `landing.css` and `guide.css`.

## Generator ownership and dependency boundaries

`tools/generate-app-pages.mjs` produces 23 principal HTML outputs and intentionally swaps the base application scripts for competition-specific `competition-model.js` + `competition-page.js`. It inserts the Calendar model/clock/rendering stack only for the Calendar output, and adds competition, clubs and sidebar resources for designated routes. Generated HTML must never be edited directly.

**`landing.css` is shared application CSS, not a candidate for landing-only pruning.** The source-template inclusion and all verified generated pages above demonstrate that dependency. **`landing.js` is used by shared app pages as well as the Guide**, so pruning it solely based on its filename would be unsafe. The competition detail renderer already excludes `landing.js` and `app.js` in its separate shell: there is no universal load rule to simplify safely without runtime tests.

The separate read-only utilities `tools/audit-shell-assets.mjs` and `tools/audit-page-dependencies.mjs` cover direct page links and conservative literal import traversal. They deliberately classify dynamic script insertion, global bindings, calculated imports and browser-only dependencies as **unknown**. All measurements in this file were taken from checked-in source, not an interactive browser.

## Decision and remaining P4 acceptance

The HTML/template/generator **asset-dependency audit is complete** for the named shared and competition shells. No asset can yet be marked safely removable from this evidence; no JavaScript loading order was changed. The other **existing** P4 acceptance items remain open: network request/transfer-size baselines, actual load behavior and performance comparison, and generator/route/search/keyboard/publication regression checks. Those require a controlled browser and final CI review. No additional issue checklist item is warranted.
