# SH-04 — Frontend source, generator and asset consolidation

## Exact base and scope
Verified `main@2b7a671aad738a7ac0b8645b39fb32d0761514b1`; #380, #354, #351 and #350 squash-merged. Started from main only. Independent #352 Auth, #357 legacy and #365 design work are not modified. There are **no** edits to checked-in generated HTML, generated JSON, clubs, translations, artwork, backend, database, security, publishing or sporting policy.

## Dependency inventory and classification

| Family | Sources and consumers | Action |
| --- | --- | --- |
| CSS (9 stylesheets) | `assets/app.css` (~1,085 leaf rules in conservative audit), `landing.css`, `club-page.css`, `clubs-directory.css`, `competition-awards.css`, `sidebar-evolution.css`, `account.css`, `admin-settings.css`, `guide.css`. Used by shared app, clubs, 18 competitions, Accounts, Settings and Guide. | **KEEP**, except individually proven shadowed Club-directory selectors (**REMOVE**) |
| Shared HTML/templates | `templates/app-page.html` → `tools/generate-app-pages.mjs`, 23 core generated HTML outputs, plus generated Clubs directory/shared template. `tools/generate-club-pages.mjs`, `render-sidebar.mjs`, `render-world-calendar.mjs` own the specialized output. | **KEEP**; no HTML changes |
| Competitions | 16 domestic and 2 international generated routes plus `competitions/_shared`; `tools/render-competition-page.mjs` and `assets/competition-page.js`, `competition-tabs.js`, `competition-model.js`, fixtures, Stats, History and Awards owners. | **KEEP** SH-02 keyed DOM, crests and reserved skeletons |
| Clubs | `clubs/index.html`, `clubs/_shared`, `assets/clubs-directory.js`, `club-page.js`, `club-crests.js`. Rendered/filter controls have direct first-paint and dynamic consumers. | **KEEP** |
| Shared JS | `assets/theme.js`, `landing.js`, `app.js`, `app-search.js`, `sidebar-first-paint.js`, `sidebar-evolution.js`, route registry, profile navigation. | **KEEP** order/global contracts |
| Other HTML | Landing, Guide, Dashboard, Calendar, Settings, five Account pages. Some are non-generated; page ownership remains distinct. | **KEEP** |
| Artwork | 256 flag-directory entries (including provenance), 32 division SVGs, 9 existing club crest SVGs, 14 brand entries; consumers are catalogues, `club-crest-assets.mjs`, `validate-division-assets.mjs`, generated manifests and dynamic runtime hosts. | **KEEP**, no demonstrated unused asset |
| Data/i18n | 320 club identities, canonical CSV/JSON, division and cup catalogues, five-language descriptions, historical data, sporting rules. | **KEEP**, no pruning |
| Auditors | `tools/audit-css-cascade.mjs`, `audit-repository-assets.mjs`, `audit-page-dependencies.mjs`, `audit-shell-assets.mjs`. | **KEEP**, read-only, conservative |

A selector name or textual duplicate is **not** an unused selector. All remaining selector and asset candidates are **KEEP/UNRESOLVED** until individually proven. Reproduce the complete per-selector/context inventory with `node tools/audit-css-cascade.mjs assets/app.css` (and each other stylesheet); reproduce source/asset reference classifications with `node tools/audit-repository-assets.mjs`. The existing audit tool deliberately has an empty proven-unused removal list; no asset deletion passes generator, runtime and publication-boundary proof.

## Individual decisions and equivalence evidence

| Candidate | Action | Proof |
| --- | --- | --- |
| Original `.nav01-directory` max-width/margin and intermediate width/max-width rules | **REMOVE** | Later unconditional rule with exactly equal selector specificity sets `max-width:none;width:100%;margin:0;min-width:0`; it wins every earlier property at all breakpoints. |
| Earlier `.nav01-directory .app-page-title` base, <=720px title override and repeated <=720px final values | **REMOVE** | Later unconditional equal-specificity rule sets `margin:0;padding:0;border:0;font-size:var(--app-page-title-size);line-height:1.2;letter-spacing:-.035em`. The repeated later mobile rule changes none of those values. |
| HTML route/club caller-side link normalization | **REPLACE** | `writeOutput` already normalizes *after* sidebar generation, including sidebar links. Callers now pass raw HTML; the single final pass is the same idempotent URL operation. |
| `app.css` repeated 620px/360px logo overrides | **KEEP** | Intervening declarations require compensating later size restoration; do not treat exact textual duplicate as dead. |
| `club-page.css` 760px crest/fixture label repeats | **KEEP** | Intervening unscoped declarations change widths/font sizes. |
| `clubs-directory.css` 440px and both 500px single-column rules | **KEEP** | A later unscoped multi-column reset makes the final 500px restoration necessary. |
| Other selectors, logos, flags, icons, scripts, layouts and datasets | **KEEP/UNRESOLVED** | Dynamic consumers and CSS cascade interactions not proven removable. |

## Test and QA matrix

`tests/sh-04-frontend-cleanup.test.mjs` verifies the canonical CSS rule owners, responsive restore layers, normalized HTML ownership, runs **real generator `--check`** for byte-for-byte HTML and manifest parity, and scans all 18 generated competition first-paint shells + the Clubs directory. Existing Site checks cover route/skeleton i18n and security contracts. Existing Browser QA + Club and Theme tests cover the relevant **320/390/768/1440** widths, **dark/light**, **EN/DE/ES/FR/IT**, first paint/refresh, 18 competitions, focus and image-host identity; the exact-head conclusions must be separately recorded. Relevant suites include `tests/club-pages-browser.test.mjs`, `theme-browser.test.mjs`, `int24-browser-qa.mjs`, `page-load-02-club-browser.mjs`, `clean-ui-03-webkit-iphone.mjs`, and `sh-02-competition-rendering.test.mjs`. WebKit emulation is not a physical iPhone Safari test.

This is a declaration-order equivalence proof for the removed selectors, **not** an unperformed browser pixel-diff or performance claim. Source order of remaining selectors, JS loading order, first-paint HTML and responsive restore layers stay fixed. No merge/deploy/remote D1 authorization is implied.

## Rebase on merged #352 (BE-05), 2026-11-05

Rebased the sole SH-04 commit onto the verified `main@ed49e805dfbbd13605dbd01eb284766778ab9f0e` after authorized merge of #352. The updated `tools/ci-test-ownership.json` starts from the **new main** manifest and retains all three BE-05 authentication/security test entries along with SH-04. No other main files have overlapping source changes. The earlier 4/4 green GitHub workflows on pre-rebase SHA are **historical only**; require new exact-head CI before squash merge. No backend/security files changed by this PR.
