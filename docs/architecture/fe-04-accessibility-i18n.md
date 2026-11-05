# FE-04 — Accessibility & i18n implementation contract (#368)

## Baseline and FE-02 coordination
- `main@eef67365dbcd5445a7121a0dfe5351dbfa4b5232` is the true #365/PR #393 squash merge, parent `4b28fd3d47f05c7bd8ccf4f04fcfc99a179fc133` after #352/#356.
- #366 is open without an active PR or GitHub issue comments at baseline. FE-02 owns breakpoints, touch target geometry, safe areas, viewport and scrolling; FE-04 owns only keyboard semantics, semantic landmarks, accessible names, error/feedback and UI translations. No structural overlap.
- Preserve FE-01 palettes, typography, responsive layout, shared first-paint HTML, 18 competitions/seven views, clubs/cup names, canonical routes, Season 0/Debug and Auth/D1 security. No generated HTML/manifest edits, backend, deployment or remote D1 changes.

## Changes and evidence
| Surface | Source and action | Acceptance |
|---|---|---|
| Native labels | `assets/theme.js` removes global label click suppression; custom selects retain click/keyboard handlers | Account real browser label activation |
| Shared menus | `assets/competition-tabs.js` restores trigger focus on Escape and trigger-close; Tab remains native | Node mock, Account/browser keyboard |
| Skip repeated navigation | `assets/landing.js` inserts one localized skip link for Landing, Guide, App before their static shells, focusing original main without URL changes | Five-language Node and Chromium tests |
| Focus on Search Escape | Inherited `assets/landing.css` feature-scoped outline uses existing `--focus`; no resting appearance or FE-01 token changes | Search Node, focus browser |
| Competition startup error | `assets/competition-page.js` removes nested main, emits localized `role=alert` plus canonical recovery; language changes repaint | Node |
| Fixtures labels | Five `fixturesMatches` accessible labels distinct from five `fixturesMatchUnit` count suffixes | Node, real browser |
| Search and Clubs | Five-language singular/plural results and club count | Existing Search/Clubs and FE-04 Node |
| Calendar | Localized 'final' descriptor, canonical Sovereign Cup/Federation Cup names retained, aria-label refresh on language change; tooltip visibility retains existing fine-pointer focus policy even on coarse pointer | Node, existing Calendar/browser |

## Known limits and non-overlap
- The previously identified `competition-rules-view.js` form `leg(s)` is generator-owned. Changing the module also changes 18 generated HTML snapshots; keep as remaining P2 grammatical enhancement requiring synchronized generator-parity review rather than a source-only inconsistent patch.
- Existing loading/empty/error/status contracts (`aria-busy`, `aria-live`, `role=status`) remain unchanged; adding announcements to every sports refresh would be noisy and risk first-paint behavior.
- Full WCAG 2.2 AA, axe, NVDA/VoiceOver, actual iPhone Safari and forced-colors are NOT certified by source scans or Chromium/WebKit emulation; mark UNKNOWN, not PASS.

## Exact-head QA
- One branch, one grouped commit, one Draft/HOLD PR. New Site Node `tests/fe-04-accessibility-i18n.test.mjs` is `site-node`; `tests/fe-04-accessibility-browser.mjs` is imported once as `support` into existing FULL `tests/int24-browser-qa.mjs`, so no new workflow or manual duplicate dispatch.
- Retain `node tools/generate-app-pages.mjs --check`, existing 18 x 7 competition browser coverage, Account Chromium/WebKit, five locales, both themes and 320/390/768/1440, Site, Admin and FULL exact-head gates. Record pending versus PASS honestly.
- [x] Prerequisites #352/#356/#365 verified; [x] #366 boundaries reviewed; [ ] Site exact-head; [ ] Browser exact-head; [ ] Admin exact-head; [ ] FULL evidence gate; [ ] physical AT/device test UNKNOWN.

## Source-level CI reconciliation (before final exact-head acceptance)
- Initial head `e4c53c9da6c7aad9d6e3b00f42a841f224e53119` was superseded after the first four-workflow pass found 5 legacy tests and FE-01 CSS parity fixtures that predated FE-04 skip/focus behavior. No manual reruns or extra PRs.
- Second one-commit head `057cb50e85aef49a8f9e12afb2ec1b5417121383` proved Browser FULL **PASS** ([41962345967](https://github.com/FraGioco9/football-architect/actions/runs/41962345967)), including FE-01 pixel/style parity and new FE-04 real Chromium focus/locale checks. Site achieved **884/885 PASS**; the final failure was a source harness assertion indexing the previous nested error link instead of the now canonical sibling recovery link. Admin Node/Worker and local operator lifecycle jobs **PASS**, while Chromium/WebKit Account tests required updating remaining legacy Escape focus assertions.
- The final grouped source replaces the superseded commit without adding commits or changing production code beyond the already Browser-verified second candidate. Three additional tests now document intended accessibility semantics: `tests/account-interaction-browser.mjs` nationality Escape, `tests/account-layout-browser.mjs` shared selector Escape, and `tests/world-competition-runtime.test.mjs` canonical error recovery link. **All required checks must be repeated automatically on the final new SHA**; no earlier PASS can substitute for exact-head acceptance.
- Restore the existing fine-pointer Calendar tooltip policy while making marker names accurately localized; touch-tooltip geometry belongs to #366. No redesign, changes to canonical IDs or remote data.
