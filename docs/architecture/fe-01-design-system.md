# FE-01 — Design-system contract and visual equivalence (#365)

## Baseline and boundaries
- Exact main start: `4b28fd3d47f05c7bd8ccf4f04fcfc99a179fc133`, including owner-approved #352 security (`ed49e805dfbbd13605dbd01eb284766778ab9f0e`) and #356 frontend cleanup (`4b28fd3d47f05c7bd8ccf4f04fcfc99a179fc133`). #354 competition renderer and #359 first-paint contracts remain canonical.
- Single Draft/HOLD PR; code is CSS aliases + tests/CI ownership + this document only. No changes to generated HTML, templates, generator, routes, assets, images, i18n, JS runtime, backend, security, D1, publication policy or deployment.
- `landing.css` remains the inherited dark/light foundation. All consuming app and account routes load it before their local stylesheets. Retain the ten existing Graphite & Petrol palette tokens unchanged.

## Current visual inventory and canonical owners
| Family | Canonical ownership | FE-01 classification |
|---|---|---|
| Typography | `landing.css`, `app.css`, `account.css`, club/detail | Shared 15px body, 14px control, 18px panel heading aliases; local title/standings font hierarchy intentionally retained |
| Spacing | Shared shell, app panels, Account, Awards | Equivalent 12px/16px gap aliases; local padding/responsive spacing preserved |
| Sizing | `app.css`, `club-page.css`, `clubs-directory.css`, Account/Admin | Alias 44px regular / 32px compact / 48px filter control, 112px desktop tabs; preserve 28px mobile arrows and responsive tab widths |
| Radius / border | `landing.css`, `app.css`, Clubs, Account, Awards | Alias existing 10px control / 14px panel radii; preserve existing border color, strength and 8/9px local variants |
| Colors / shadows | `landing.css`, feature styling | Dark/light theme palette unchanged; identical dropdown shadow inherits a theme alias; Awards/standings/event semantics retained |
| Motion | `landing.css`, `app.css`, `account.css` | Identical field transition alias; existing reduced-motion, Calendar animations, dialogs and sidebar motion unchanged |
| States | `app.css`, `account.css`, Clubs/Calendar | Move exactly identical editable-field hover/focus definitions to theme root; error foreground uses same original dark/light values; keep pointer-only Account gating and keyboard focus rules |
| Buttons / tabs | `.cta`, `.app-link`, `.app-competition-tab`, `.club-tabs` | Share only geometrically equivalent aliases; keep active/disabled/focus semantics and 7-competition/5-club tab identity |
| Dropdowns / selectors | `.language-*`, Calendar week, Fixtures round, Clubs filters, Account nationality | Shared token values, deliberately separate keyboard state machines, aria and popup position |
| Tables, cards, popovers | Standings, History, Stats, Awards, tooltip, Calendar/Search dialogs | Preserve separate layouts and focus/close contracts, with shared equivalent panel radius/spacing only |
| Navigation | `.fa-shell-*`, `.nav01-*`, competition tabs | No reflow or changed active/hover state; first-paint skeleton and DOM keys preserved |

## New alias values (all copied exactly from existing CSS)
| Token | Baseline value |
|---|---|
| `--fa-text-body`, `--fa-text-control`, `--fa-text-panel-heading` | 15px, 14px, 18px |
| `--fa-space-3`, `--fa-space-4` | 12px, 16px |
| `--fa-radius-control`, `--fa-radius-panel` | 10px, 14px |
| `--fa-control-height-regular`, `--fa-control-height-compact`, `--fa-control-height-filter` | 44px, 32px, 48px |
| `--fa-tab-width-regular` | 112px |
| `--fa-dropdown-shadow` | Dark `0 10px 24px rgba(0,0,0,.22)`; Light `0 10px 24px rgba(28,49,41,.13)` |
| `--fa-field-hover-bg` | Dark #1a3738; Light #E5F1E9 |
| `--fa-field-hover-border` | Dark #506c64; Light #67917D |
| `--fa-field-focus-border` | Dark #84b8a4; Light #377F60 |
| `--fa-field-error-color` | Dark #C68F8F; Light #8A4040 |
| `--fa-field-transition` | border 160ms, shadow 180ms, background 160ms |

## Deliberately not consolidated
- `--award-*` and `--standing-outcome-color` have sporting semantic meaning, including champion, European qualification, playoff, playout and relegation bands; Calendar event palettes, final gold, national/international shades and club heraldry are protected.
- `--surface-raised` is referenced by multiple CSS components but not declared in the audited global stylesheets. Adding a value would change rendering: unresolved by design pending separate approval, **not** silently assigned here.
- Club-specific `--club-color` is supplied by club identity; `--panel` and `--playoff-connector-axis` have existing fallback declarations. Preserve `vh/svh/dvh`, mobile media restoring declarations, theme overrides, :focus-visible and :has semantics.
- Different dialogs, select/round state machines, keyboard focus restoration, touch/coarse-pointer hover suppressions and reduced-motion rules remain component-owned. SH-04 previously removed only selectors proven shadowed; no new speculative CSS deletion.

## Evidence and test matrix
- New Node `tests/fe-01-design-system.test.mjs` registers with Site ownership and pins colors, aliases, 18 competition shells with 7 initial tabs, stylesheet load order, focus/hover/motion guards and separate Awards/Calendar contracts.
- New Chromium `tests/fe-01-visual-parity.mjs` runs once in Browser FULL for a style-changing PR, intercepting baseline CSS from `git show PR_BASE_SHA:path` versus the exact HEAD CSS while keeping current HEAD HTML/JS/runtime unchanged. It compares computed styles, focus state, rect geometry, overflow and an unchanged static screenshot on Landing, Guide, Dashboard, Calendar, Settings, 2 competitions, Clubs directory/detail and 2 Account routes.
- Profiles cover widths 320/390/768/1440, dark/light and all five locales EN/DE/ES/FR/IT; dedicated existing browser checks cover additional combinations and WebKit iPhone emulation. The existing `clean-ui-03-css-parity.mjs` still checks responsive competition/Calendar properties across themes and reduced motion, and SH-04 generator `--check` protects generated parity.
- Run targeted tests at coherent batch end, then inspect exact-HEAD Site/Browser/Admin/FULL CI. Do not claim unexecuted CI or physical iPhone Safari; preserve Debug Season 0/public-source security. No remote Cloudflare D1, secrets, deploy, merge or branch cleanup.

## Acceptance rules
- Zero changed colors/geometry/states without separate owner design approval. No unmeasured selector removal. Compare actual browser CSS computed values and 4-width focus/rect snapshots, not just literal tokens.
- No new app features, functionality, route behavior, generated artifacts or sport rule changes.
- One grouped commit, one dedicated branch, one Draft/HOLD PR for review; final merge requires explicit authorization.
