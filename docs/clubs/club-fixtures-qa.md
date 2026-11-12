# Club Fixtures — QA block 21 / #504

Status: implemented on `feat/504-club-fixtures`, **Draft/HOLD**. This is automatic evidence plus a manual acceptance checklist; it does not accept block 21 in [#408](https://github.com/FraGioco9/football-architect/issues/408). Base: current `main@ff83a2a` at task start, after fetching origin and reading AGENTS.md. Open PRs #481/#454 were inspected before editing; their shared CSS/backend/DEV routing/CI ownership files were avoided. Existing checkout registry line endings were preserved and excluded from commits.

## Automatic evidence

| Check | Evidence / result |
| --- | --- |
| V01 First paint | Generated Fixtures structure includes translated season/filter/next controls, six row placeholders and shared crest skeletons before deferred scripts/API. Browser holds canonical API response, then compares control geometry before/after hydration. PASS. |
| V02 Loading / refresh / errors | Chromium direct load and reload, delayed response after leaving the tab, explicit unavailable competition and HTTP error states, Season 0. PASS. |
| V03 Club-only schedule | 30 domestic games for the selected club in browser; projection tests for deterministic same-day order, away perspective, neutral final, extra time, shootout and unknown opponent presentation. Future results rejected by shared authoritative validation; no real dates inferred. The canonical season number is reserved while unknown and the loading placeholder is removed on confirmed source failure. PASS. |
| V04 Source and viewed season | Public clock versus protected DEV, Debug ON→OFF, Season 0, unavailable season, historical season contract validation and cancellation/cache fences. Public and DEV state remain distinct. PASS in the bounded fixtures test; physical/live reset remains manual. |
| V05 Navigation / controls | Opponent and competition links, configured knockout leg tokens, season/filter dropdowns, next-match scroll/focus, Fixtures→Roster→Fixtures during a read, direct/refresh/Back/Forward. Locale redraw retains the focused combobox; repeated opponents keep separate crest nodes. PASS. |
| V06 Responsive | Actual headless Chromium at 320/390/768/1440: no content overflow, readable opponent/venue/result, visible next command. Mobile day/competition use a secondary row. 320 dark IT and 1440 light FR screenshots inspected. PASS. |
| V07 Locale / theme / accessibility | EN/DE/ES/FR/IT and dark/light sampled across widths, translated accessible venue labels and focus tooltip/Escape, shared keyboard dropdown binding, first-paint label regression. PASS automatically; assistive technology remains manual. |
| V08 Special phases | Source/presentation tests: neutral final, selected-club score and shootout perspective, canonical knockout phase/leg links, unresolved-opponent label. No future tie participants are inferred. End-to-end hosted cup/postseason and physical Safari remain manual. |

Reproduction (Node.js 22, repository root):

```powershell
node --test tests/club-pages.test.mjs tests/authoritative-season.test.mjs tests/competition-fixtures.test.mjs tests/club-public-read-cache.test.mjs tests/club-season-memberships.test.mjs tests/club-history-source.test.mjs tests/page-load-04-club-html.test.mjs
node --test --test-name-pattern="CLUB-FIXTURES browser" tests/club-pages-browser.test.mjs
node --test tests/publication-gate.test.mjs tests/club-competition-skeleton-layout.test.mjs tests/club-competition-summary.test.mjs
node tools/generate-app-pages.mjs --check
node tools/ci-discovery.mjs
```

The first command passed **101/101** at the implementation milestone. The dedicated Chromium scenario passed, including protected DEV and public API states. Generator consistency, discovery and syntax checks passed. The additional publication/layout tests and broader Club browser regression are recorded in the final evidence below. These targeted checks are **not FULL**, a hosted deployment test, or physical Safari acceptance. Existing PR-triggered CI is observed once; no manual workflow dispatch or rerun.

## Canonical coverage and limits

- Public data comes from verified Club History memberships plus the existing validated competition season endpoints and shared per-world read cache. All supplied domestic, cup and postseason fixtures involving the club are included; failed/unpublished competition reads cannot fabricate games or discard valid games from other competitions.
- Same-day order is deterministic: sporting day, canonical competition ID, marker, round, tie ID, leg, fixture ID; it is independent of response arrival or translated names.
- Public historical support follows the existing API/validator boundary of **seasons 1–2**. Later unsupported public seasons show unavailable; Season 0 always shows unstarted and requests no fixture data.
- The protected existing DEV adapter supplies domestic league/postseason data. It does not supply a club-level international snapshot, so DEV explicitly reports partial competition coverage. International fixtures are displayed when public canonical membership/season data supplies them. Future postseason pairs absent from canonical data are not manufactured.
- The current public validator publishes resolved fixture participants. The UI has a translated unknown-opponent presentation, but cannot assign an unresolved future tie to a club without canonical evidence.
- There is no separate match-detail route in this contract. Competition/phase links open existing Fixtures routes with season and configured matchday/phase; opponent crest/name open that opponent's Fixtures in the same viewed season.

## Manual owner acceptance — all still UNKNOWN

- [ ] V01–V02: visually inspect first paint/hard refresh with slow networking, both themes, and actual hosted API state; check for flashes or unwanted scroll.
- [ ] V03–V04: inspect real available club seasons, both international cups and applicable postseason, unavailable snapshots, Debug OFF/ON and canonical Reset; verify against independent sporting records.
- [ ] V05: repeat direct, refresh, Back/Forward, fast season/tab changes, filter and next command in the owner's local browser. Modified/middle-click links and returning from an opponent/competition should preserve applicable season context.
- [ ] V06–V08: physical iPhone Safari at narrow widths, hover/focus equivalents, VoiceOver/screen reader labels and dropdown keyboard behavior; sample all five locales and both themes.
- [ ] Owner accepts QA block 21 in #408 after the above. Keep its master checkbox open until then.

No merge, deploy/publication, remote D1 write, secret change or unattended task was performed.

## Codex Cloud pilot measurements

- Observed manual Cloud tasks: **1** for #504. Platform retry/attempt counter: **UNKNOWN** (not exposed).
- Quota/credits consumed: **UNKNOWN** (no usage indicator available). No estimate from tokens or file size.
- Owner intervention during implementation: **0 observed**. Remaining intervention: review Draft/HOLD, perform manual QA above and separately authorize any merge/deploy/remote DB action.
- Local development iterations: failing tests first for missing source/renderer/DEV projection, Season 0, phase-leg routing, parser-time locale, redraw focus and duplicate crest reuse. Chromium harness also required explicit focus emulation. These are local checks/fixes, not Cloud relaunches or CI reruns.
- Independent review: two P2 findings (redraw focus and first-paint locale), addressed with failing-then-passing regressions. Screenshot review found duplicate crest reuse; a 15-versus-30 crest assertion reproduced it before correction.

## Final evidence

- Stable final source: **118/118** targeted Node checks PASS across the source, Club presentation/history/loading, Fixtures, public cache and publication/layout suites.
- Dedicated Chromium Club Fixtures scenario: **1/1 PASS**, including public/DEV source transition, delayed tab changes, focus/crest retention, responsive locale/theme matrix, navigation, errors and Season 0.
- Generator `--check`, CI discovery, modified JavaScript syntax and scoped `git diff --check`: PASS.
- Broader pre-existing Club browser scenario: **TIMEOUT at 300 seconds** locally; not PASS. The same unchanged `main@ff83a2a` scenario also timed out at 300 seconds in this Cloud environment. This establishes a baseline timeout too; it does not certify FULL or establish the cause of either timeout.
- Automatic PR exact-head CI: PENDING when preparing the QA commit; observe in GitHub before any future merge decision. No workflow was manually dispatched/rerun.
- Manual acceptance remains UNKNOWN regardless of automatic status.

Final venue audit: the away glyph uses an actual monochrome airplane silhouette. This small approved-requirement correction follows the initial PR creation, so its normal push starts a new exact-head CI cycle; no manual CI dispatch/rerun is used.

## Windows owner follow-up — CRLF bootstrap generation

The owner reported 52/53 tests passing on Windows / Node 24.19.0, with generation consistency failing at `calendar/index.html` offset 952. Reproduced the **same mismatch on Node 22.23.5** by converting generator/bootstrap `.mjs` sources to CRLF: `Function.toString()` retains source line endings, while only the checked-in HTML had been normalized before comparison.

The shared output writer now normalizes assembled CRLF output to LF before structural checks, comparison and writing. This covers Calendar, Competition and Club bootstraps without editing generated HTML or source/artwork bytes. The Windows fixture now includes the Club Fixtures renderer dependency.

Automatic follow-up: **80/80 targeted checks PASS on Node 22**, covering generator Windows fixtures, Club pages, authoritative season, app shell and generated boundaries. The new regression first failed at the reported offset, then passed for both `--check` and generation from CRLF sources; a deliberately modified HTML attribute still fails, preserving content-drift detection. Generator consistency, discovery and scoped diff checks PASS. Active PR #528 touches distinct Admin sections of the generator; this fix is confined to the shared output writer.

Actual owner Windows rerun remains UNKNOWN until reported; Node 24 compatibility is not certified. Use the project's Node.js 22. This is one owner-reported follow-up validation failure after the initial delivery; quota/credits and platform retry counter remain UNKNOWN. No merge, deployment or remote database operation.

## Owner follow-up — History freeze

Reproduced a Debug-only feedback loop: History snapshot publication repainted the club shell; Fixtures `mount()` then requested the shared DEV provider again, which republished History indefinitely. A bounded Chromium regression captured repeated Fixtures requests on the History tab. Fixtures now requests preview data only while its own tab is active, once per selection/world identity. The same browser regression passes after the fix, including returning to Fixtures. Layout/season/notice refinements requested alongside this report are handled in the next grouped change.
