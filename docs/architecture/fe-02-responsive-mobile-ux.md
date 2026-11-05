# FE-02 — Responsive & Mobile UX (#366)

## Baseline and ownership
- Implementation authorized 2026-11-05 from exact `main@eef67365dbcd5445a7121a0dfe5351dbfa4b5232`, after FE-01 #365 squash PR #393. Separate merge/deploy/remote DB authorization required.
- All FE-01 design tokens and colors remain unchanged. Domestic/int-24 sporting contracts, routing, crests, static first paint, and the 7-view competition structure remain unchanged.
- FE-04 #368 owns ARIA, accessible naming, Escape, focus return, keyboard state machines and translations. FE-02 does **not** edit `assets/competition-tabs.js`, `assets/calendar-simplified.js`, `assets/clubs-directory.js`, `assets/account-ui.js`, `assets/app-search.js`, `assets/app.js`, `templates/app-page.html` or i18n.
- A tiny delegated presentation-only adapter lives in `assets/sidebar-evolution.js` **before** its static-sidebar early return. It measures already-open menus after click/keyboard/scroll/resize with `visualViewport`, the inner scroll-pane bounds, and positions them above or below. It writes only data-menu-placement and max-height, never ARIA/selection/focus/labels or input handling. Existing Account menus keep their own positioning.

## Implemented geometry
- Mobile up to 620px: >=44px high navigation/tab, Fixtures, and Calendar control hit surfaces; keep FE-01 44px regular token. At <=360px, Fixtures arrow/current shortcut widths are 40px (previously 28px) to retain the selected 100px round label and stay within the narrow main column; heights remain 44px. Do not overlap neighbors.
- Calendar Season keeps all seven columns, day-cell heights, calendar structure and full detail dialog. Narrow event chips explicitly ellipsize within the current cell instead of clipping silently. Week controls reserve space for the current-week shortcut.
- Fixtures at 621–800px reserve bottom space for a 320px full single-line stadium label below the teams/scores, preventing painting across their narrower middle track; all fixture states use the same CSS.
- No generated HTML or manifests and no backend/security/permissions, sporting policy, routes, D1, secrets, hosting, deploy or publication changes.
- The existing FE-01 and CLEAN-UI visual parity checks stay strict outside approved mobile geometry; positive geometry is asserted in `tests/fe-02-responsive-browser.mjs`.

## Reproduction and test plan
| Scope | Widths | Test |
|---|---|---|
| Clubs dropdown / sidebar | 320,390,621,768,1159,1160,1440 and 844x390 | Real listbox near scroll pane edge, viewport containment, overflow, desktop/landscape |
| Calendar | 320,390 | 44px week controls, seven columns, nonoverlapping shortcut |
| Competitions and Club detail | 320,390 | 44px tabs on real loaded pages |
| Fixtures | 621,768,800 | Stadium under clubs, within container, unwrapped |
| First paint / themes / 5 languages / domestic+international / accounts+admin / Season 0 | Existing Site, Browser, Admin, FE-01, SH-02, PAGE-LOAD-02 contracts | Exact-head FULL; no unexecuted PASS claim |
| Safari physical iPhone | portrait, landscape, address-bar movement, keyboard open/close, touch, safe-area | **UNKNOWN: mandatory owner-provided device QA before final FE-02 acceptance** |

Known exception: constrained 320px Fixtures horizontal hit width 40px, knockout score-help icons constrained by 22–26px score columns (FE-04 to review). Account virtual-keyboard and authorized Admin long-text states require device/fixture evidence, not simulated PASS claims. No automatic CI can certify physical Safari.

## Workflow
One branch, one grouped commit, one Draft/HOLD PR. Run targeted Node + generator checks and automatic exact-head Site/Browser/Admin/FULL; run Chromium and WebKit geometry in the existing Browser workflow once each, no manual duplicate runs. Record SHA, PASS/FAIL/UNKNOWN and remaining manual gate. No merge/deploy/DB actions without separate authorization.
