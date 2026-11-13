# MOBILE-QA #527 — Players, player details, Club Fixtures

**Status:** In progress; source/test audit completed on 2026-11-13. **No physical iPhone Safari or VoiceOver PASS claimed.** This document is the live QA ledger, not a blanket acceptance statement.

## Scope and dependency checkpoint

- Base at start: `main@64791005f1c5357b455775617dd9c5a16e006d3a`, including merged Players filters (#515), Club Fixtures (#529) and Admin Contracts (#534).
- Public `/players`: available on main; directory, filter drawer, sorting, pagination, Overview and Attributes are eligible for QA.
- Club `/clubs/<country>/<id>/fixtures`: available on main; include season, competition filter, next match, opponent links and venue explanations.
- `/players/<numeric-id>` and protected draft player detail: **integrated into `main` via merged PR #535 (#502)**. Their responsive QA is now actionable, but real iPhone Safari/VoiceOver and Android touch acceptance remain unverified.
- Scope excludes product redesign, backend schema, D1 writes, deployment and changes to other page families.

## Automated coverage inventory

| Page | Already present in repository | #527 extension / remaining |
| --- | --- | --- |
| Players | `tests/players-directory.test.mjs` checks generated shell, 5 locales, first-paint state, attributes, filters, URL semantics and responsive CSS contracts. | Actual touch/visual mobile session, horizontal table behavior, long names, filter drawer scrolling and all theme/locale combinations remain unverified in this task. |
| Club Fixtures | Dedicated `CLUB-FIXTURES browser` scenario in `tests/club-pages-browser.test.mjs`: actual Chromium, 320/390/768/1440, URL/history, season, errors, tooltip focus and pending/hydrated row geometry. | #527 adds **375 and 430px** to responsive and skeleton matrices, checks shell overflow as well as page/panel overflow, and allows screenshots at those widths. Exact-head run **PENDING**; this does not equal physical Safari. |
| Player detail | Merged #535 supplies `tests/player-detail.test.mjs`, public and protected canonical shells, Overview/Info and responsive CSS. | Integrated mobile browser/device acceptance remains open: identity, silhouette, pitch, positions, first-paint values, tabs, Back/Forward and protected candidate flow. |

## Responsive acceptance matrix (all three page families, when available)

Record each result as **PASS / FAIL / BLOCKED / NOT TESTED**, with browser/OS, actual viewport width, route, theme, locale and screenshot evidence. **Do not substitute Chromium emulation for a physical iPhone.**

| Width | Browser/device | Focus |
| --- | --- | --- |
| 320px | Chromium narrow / small iPhone-like viewport | No unintentional page overflow; readable tabs, actions and row content |
| 375px | Chromium + physical iPhone Safari | Compact header, sidebar, filters, controls and table scrolling |
| 390px | Chromium + physical iPhone Safari | First paint, refresh and tab/view changes while loading |
| 430px | Chromium + physical iPhone Safari | Long translations, two-column versus stacked content, touch actions |
| 768px | Chromium/WebKit tablet-sized | Panels, tab line, selectors and intentional horizontal scroll |
| 1440px | Chromium desktop | Desktop parity; no regressions from mobile fixes |

### Route-by-route manual checks

**`/players`**
- Load directly, refresh, change Overview ↔ Attributes and all four groups while requests are pending; check reserved count and row geometry, sorting, page/filters state, Back/Forward.
- Use Filters by touch: open and dismiss with X/backdrop, scroll the full drawer without scrolling the page, choose multiple nationality/position options, include secondaries, enter ranges, Apply and Reset; inspect focus and mobile keyboard behavior.
- Check row/header alignment and any intentionally scrolling table, with at least one long player name, empty results and API error. Check flag labels via accessible focus/touch, not hover alone.

**Club Fixtures**
- Verify Season 0 and multiple seasons where data exists, direct/refresh/back/forward, competition filter, next match, same-club score perspective and future-result absence.
- Check opponent crest/name and competition links, home/away/neutral venue icon **accessible explanation by touch and keyboard focus**, long translated labels and late API response after leaving the tab.
- Compare six first-paint row skeleton positions with loaded rows; check season label first paint and no text/crest flash or unexpected horizontal overflow.

**Player detail — integrated on main; mobile/device acceptance pending**
- Open from persisted player name and protected Admin draft preview; direct URL, refresh, Back/Forward, expired/missing record and sign-out/permission loss.
- Verify header silhouette, name, nationality/age, club/Free Agent state and crest/name skeletons after affiliation integration; Overview pitch/Attributes panel and separate Info view.
- Check mobile stacking, position marker accessibility, visible skill values, no loading text, no clipping of the portrait, tabs or dividers. Stats/History/Progression remain disabled until their own features exist.

**Cross-cutting:** Light/Dark; EN/DE/ES/FR/IT; iPhone Safari portrait/landscape, address-bar movement, keyboard and VoiceOver; Android Chrome touch; 320px overflow; screen reader labels. Capture **before and after** for each real fix.

## Reproducible targeted checks (Node.js 22, Windows PowerShell)

```powershell
node --test tests/players-directory.test.mjs tests/player-detail.test.mjs
node --test --test-name-pattern="CLUB-FIXTURES browser" tests/club-pages-browser.test.mjs
node tools/generate-app-pages.mjs --check
```

Optional Chromium screenshots (only when a local Chrome binary is available):

```powershell
$env:CLUB_FIXTURES_QA_DIR = "$PWD\artifacts\mobile-527"
node --test --test-name-pattern="CLUB-FIXTURES browser" tests/club-pages-browser.test.mjs
Remove-Item Env:CLUB_FIXTURES_QA_DIR
```

These are targeted local checks, not FULL CI, hosted acceptance, touch simulation or physical Safari. Keep one Draft/HOLD PR and do not manually dispatch duplicate CI. No merges, publication, remote database writes or issue closure without separate authorization.

## Evidence / unresolved

- [x] Reviewed issue #527, related #502/#504/#512 and current main; player detail #535 is merged and now eligible for integrated QA.
- [x] Inspected existing static and dedicated browser test coverage; identified missing intermediate fixture widths and main-vs-branch detail QA boundary.
- [x] Extended the existing Club Fixtures browser source with 375/430px cases, broader overflow assertion and optional captures.
- [ ] Run exact-head targeted checks and observe GitHub CI status; record the result rather than assuming PASS.
- [ ] Actual visual/mobile interactions on Players and Club Fixtures, including physical Safari/VoiceOver; attach screenshots and file defects.
- [ ] Execute integrated player-detail Chromium/mobile checks after #535 merge; physical Safari/VoiceOver remains untested.
- [x] Requested mobile fix: increase row side padding beside the next-match accent and natively disable the next-match button outside the current season or without a verified future fixture; apply the existing Matchday-style muted disabled presentation (45% opacity, no click/hover feedback). Source and test changes committed; runtime/CI verification pending.
- [ ] Final desktop regression and owner acceptance; close #527 only after approval.


## Continuation — 2026-11-13, main alignment

- Current integration base: `main@20c0aaa70c5bc22bddacf180808f23538d56ab7f` (merged public/protected player detail #535 and Club Roster #543). The original `main@64791005` statements above are historical baseline information.
- Rebased the six-file #542 mobile QA changes onto current main by preserving the complete main tree; no generated HTML, new public API or database edits. Keep #545 / Draft PR #546 separate for subsequent explicit reconciliation.
- Prior `b21833a9` CI: **Browser PASS; Admin PASS; Site FAIL; FULL FAIL**. The two Site errors were (1) content-dependent wrapped mobile fixture meta causing an overly rigid day/league skeleton center check at 320px; and (2) a stale renderer signature matcher after adding canonical `currentSeason`. Tests now distinguish a genuinely anchored row from a wrapped text line, and match the revised signature. **These corrections are not yet CI-certified at the new HEAD.**
- Integrated player-detail QA is no longer BLOCKED; a source/test inventory is available, but physical Safari and VoiceOver are still NOT TESTED. Do not mark full #527 PASS.


## Mobile fixture geometry correction and merged #545 integration — 2026-11-13

- Aligned against merged `main@44e34c45c5f8002d3edbbb3bb27c5a1af0dad933`, including #545's single verified club-season fixtures endpoint. Preserved its server-side verification, existing source code and one-request/zero-fan-out browser assertions.
- Corrects the 320px first-paint mismatch at the layout level. A tall/wrapped opponent name and/or metadata row could move day and competition between loading and hydration. Mobile fixtures reserve 52px for opponent names and a stable 34px, two-column day/competition region; contents stay fully readable.
- Reinstated strict 8px skeleton-to-hydrated positional assertions instead of tolerating 26px drift. The full 320/375/390/430/768/1440 Chromium matrix remains. This is not yet CI-verified on the new HEAD.
- Manual physical iPhone Safari/VoiceOver and Android acceptance remain untested. PR Draft/HOLD; no merge, deploy or remote D1 writes.


## Follow-up exact-head CI: fix remaining 320px 8.42px drift

- `48a711e8` Site/FULL failed only on the 320px day center (pending `437.9921875`, loaded `446.4140625`, drift `8.421875px`). Chromium Browser QA and Admin succeeded; this is not a complete QA pass.
- Root cause: hydrated three-line competition labels expand the **grid metadata track** beyond its prior 34px reserved skeleton height, shifting the day label despite a stable opponent row. Set the shared mobile metadata track minimum to 52px, for both loading and hydrated rows; retain natural wrapping.
- Browser test now directly checks that metadata heights match within 2px across hydration on widths 320/375/390/430, while retaining the strict 8px center assertions for all six visible text slots. The previous assertion is not weakened.
- Latest merged main test setup retained when aligning. New exact-head Site + Browser + FULL results must be verified; real-device Safari checks remain NOT TESTED.


## Follow-up fix — 2026-11-13

- `d18ee072` Site FAIL: 320px day center 446.9921875 (skeleton) vs 455.4140625 (hydrated), 8.421875px drift. The prior metadata reservation did not reduce this difference. Reserve 62px in the adjacent opponent-name grid track (three 13px lines at inherited line height), preserving the 52px metadata track. Verify opponent row heights are equal within 2px, without weakening the 8px center test.
- The Browser CSS parity 4 Calendar/History diffs arose from PR's old base SHA (64791005) rather than the branch-scoped CSS. Explicitly refreshed PR base metadata to the current main and preserved parity testing.
- Integrated main@58a7ada278b1a51514b397bdbb1533cade3dc907 seasonless routes, fixture links and related browser/unit assertions on the existing #542 branch; no new PR or unrelated source files.
- Exact-head CI, Safari/VoiceOver mobile and manual device checks remain pending; Draft/HOLD, no merge/deploy/remote DB changes.


## Players subview strip — mobile owner request (2026-11-13)

- `/players` Attributes now matches Club Roster's mobile subgroup navigation: Technical, Mental, Physical and Goalkeeper remain on **one 34px row**, in a horizontally scrollable (touch/keyboard) strip showing approximately 2.5 tabs. The total Players count stays fixed outside the strip at the right.
- Mobile toolbar is a reserved single 44px row in both Overview (groups hidden but space retained) and Attributes (groups visible). Desktop retains four grid columns; main Overview/Attributes tabs are unchanged.
- `tests/players-directory.test.mjs` updates source contracts and `tests/fe-02-responsive-browser.mjs` measures real scroll reachability, no page overflow and desktop parity at 320/375/390/430/768/1440 in Chromium/WebKit.
- Real physical iPhone Safari and VoiceOver remain NOT TESTED; PR Draft/HOLD, no merge/deploy/remote DB writes.


## Mobile Players subgroup edge fade — 2026-11-13

- The one-line scrollable `/players` Attributes strip now uses the **same conditional 16px gradient mask** as Club Roster. Initially the right edge fades; while scrolling both edges may fade; at the end only the left edge fades. No fade is shown on an edge with no hidden tabs.
- The scroll range is measured using `scrollWidth/clientWidth/scrollLeft`; refreshed after user scroll, resize, localized tab labels, group/view changes and popstate. The selected group is revealed on keyboard navigation and direct deep links.
- Unit and Chromium/WebKit browser assertions cover mask, edge attributes and left/right transitions, with the existing 320–1440px responsive checks unchanged.
- PR #542 stays Draft/HOLD, no merge, deploy or remote DB changes. Physical Safari/VoiceOver acceptance remains NOT TESTED.
