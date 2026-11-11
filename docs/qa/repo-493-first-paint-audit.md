# REPO-IMPROVEMENT-01 — Step 05: first-paint audit inventory (Draft/HOLD)

**Issue:** [#493](https://github.com/FraGioco9/football-architect/issues/493) · **Related:** [#408](https://github.com/FraGioco9/football-architect/issues/408), [#469](https://github.com/FraGioco9/football-architect/issues/469), [#471](https://github.com/FraGioco9/football-architect/issues/471), [#485](https://github.com/FraGioco9/football-architect/issues/485).

**Source baseline when this work began:** main `b60ce0f58c84208cfdcec52679e7c4702808f14a`, 2026-11-11. Always compare with live main and the exact HEAD before testing. This is an **audit foundation, not completed visual QA**. Nothing here proves Production, Preview, local Worker/D1, Safari or real browser outcomes.

## Reconciliation before starting

- #483 (Admin) merged on 2026-11-11; generated Admin and protected Players pages now belong in QA.
- #492 (Fixtures crest skeleton centering) merged on 2026-11-11; do not duplicate its implementation. Its tests still need risk-based runtime verification (step 06).
- #491 (D1 public directory) closed **without merge**. Inspect actual merged implementation rather than presuming that original PR head was integrated; step 13 is dependent on this check.
- #474 (shared crest/History) merged on 2026-11-10. #471 still has unchecked QA: implementation does not prove physical QA acceptance.
- #481 and #454 remain independent experimental Draft/HOLD workstreams, excluded from authorized feature implementation in #493.

## Coverage model

The read-only generator `tools/repo-493-first-paint-matrix.mjs` inventories authoritative competition and club identities from **current source**, not a hand-typed team list. The generated matrix is intentionally **all UNKNOWN** until actual per-case evidence is recorded. Its statuses are not CI passes.

| Surface | Exhaustive source inventory | Representative browser matrix |
| --- | ---: | --- |
| Domestic competitions | 16 competitions; seven visible shared competition tabs each | All 16 × seven views |
| International cups | 2 competitions; seven supported tabs each | Both × seven views |
| Club detail | 320 clubs × five canonical views = 1,600 URLs | 2 club IDs per nation (IDs 1 and 40) × five views |
| Primary/shell/account/Admin | 17 explicit paths including calendar season/week and Admin children | All 17 |
| State variants | Season 0/1 × Debug OFF/ON (local-only Debug) | Four states per representative route |
| Actions | Direct load, refresh, in-app view switch, season switch, rapid view switch, Back/Forward, slow/failing data, retry/reset | Eight actions per representative state |

Additional tests must cover public Season 2+ or unavailable years, postseason/knockout phases, unknown participants, selected matchday 0/15/30 where meaningful, revoked Admin rights, denied access, invalid URLs and public no-Debug behavior. Mark not-applicable situations N/A **with the reason**, rather than forcing a PASS. Source-only checks are different from Chromium/WebKit, and emulated WebKit is different from **physical iPhone Safari**.

### Commands (read-only; Node 22)

```powershell
node tools/repo-493-first-paint-matrix.mjs
node tools/repo-493-first-paint-matrix.mjs --csv
node --test tests/repo-493-first-paint-matrix.test.mjs
node tools/ci-discovery.mjs
node tools/generate-app-pages.mjs --check
```

`--csv` prints the case table to stdout and **does not write files**. Manually record the exact run SHA, environment, browser, viewport, locale, theme, data mode, actual outcome, reproduction steps and evidence URL when moving a row out of UNKNOWN.

## Existing source-level evidence (not re-run by this document)

| Area / obligation | Existing source or test | Classification |
| --- | --- | --- |
| 18 generated routes: static tabs, Rules and reserved Stats/History/Awards | `tests/page-load-03c-first-paint.test.mjs` | **Source test exists; result on this HEAD not executed here** |
| Anonymous identities for 28 static HTML shells | `tests/page-load-04-club-html.test.mjs` | Source test exists; visual hydration UNKNOWN |
| 320 club IDs and five canonical views; anonymous detail first paint | `tests/club-pages.test.mjs` | Source test exists; full browser/slow/error matrix UNKNOWN |
| Fixtures skeleton slots and sizes | `tests/fixtures-crest-skeleton-alignment.test.mjs` | Source test exists; real computed layout/visual UNKNOWN |
| History skeleton/archive row updates | `tests/history-archive-skeleton-rows.test.mjs` | Source test exists; season and provider-switch browser QA UNKNOWN |
| Stats rendering, supplied results, nonfabricated player metrics | `tests/competition-stats-view.test.mjs` | Source test exists; selected mode/per-view runtime UNKNOWN |
| Competition URL/season/Back-Forward | `tests/competition-navigation.test.mjs` | Source test exists; full browser route matrix UNKNOWN |
| Admin hidden until verified authorization | `tests/admin-page.test.mjs` | Source test exists; live permission and refresh QA UNKNOWN |
| Canonical URL and public preview host | `tests/app-canonical-routes.test.mjs` | Source test exists; unknown route HTTP 404 still in #485 |

### Required acceptance evidence for every selected browser case

1. **First paint (before API/manifest settles):** static heading/tabs, view controls, season/matchday selectors and space reservations visible; no guessed names, crests, standings or scores.
2. **Hydration:** real data from the authorized provider replaces placeholders at stable geometry; verify identity and source, not only element count.
3. **Refresh/state change:** preserve selected season, view, day and resolved image nodes where valid; reject stale/late responses; never flicker to unrelated season.
4. **Verified empty/error/retry:** distinguish empty versus unavailable/error; no false zero/placeholder shield while a known crest is pending.
5. **Isolation:** Debug ON only in local DEV; Debug OFF uses the genuine world; public and protected endpoints never leak fictional or private data.
6. **Visual/accessibility:** 320, 390, 768, 1440px; Dark/Light; EN/DE/ES/FR/IT; keyboard focus, no overflow, physical Safari listed UNKNOWN until actually tested.

## Next implementation buckets — not yet PASS

- **05** Execute/record browser matrix, prioritize reproducible failures; no shotgun rewrites.
- **06–07** Use the smallest shared-component fixes for confirmed crest/loading, History/Fixtures/Stats issues; keep one coherent Frontend Draft/HOLD branch where possible.
- **08** Separate routing/404 Draft/HOLD only after redirect matrix and owner's UI review. HTTP 404 vs 401/403 is a required acceptance criterion.
- **09–12** CI/test/documentation improvements in a separate grouped workstream; avoid coupling CI edits to UI behavior.
- **13–15** Players E2E only after checking merged source; player–club relationship is **design-only** until explicit contract approval.
- **19–20** Profile before optimization; final exact-head QA and report once prerequisite work is ready.

**Safety:** No merge, deploy, remote DB/D1 read or write, migration, production operation, real player generation or change to official sporting outcomes is authorized by this audit.

## Step 05 focused browser verification

The new `tests/repo-493-first-paint-browser.mjs` is included once in the existing **Browser FULL** workflow. It checks initial active panels, tabs and control reservations on **4 representative competitions × 7 views (28 loads)**, plus **4 club routes** under an intentionally delayed club identity manifest, followed by verified hydration. It writes detailed status evidence to the already-uploaded `int24-browser-artifacts/repo-493-first-paint-chromium.json`.

This is a **targeted browser sample**, not proof for the whole 7,136-case matrix. All other season/Debug, slow/error/retry, locale/theme, physical Safari and real hosted cases remain UNKNOWN until verified. Run manually on an isolated local checkout with Playwright installed: `node tests/repo-493-first-paint-browser.mjs`; optional WebKit: set `FA_REPO_493_ENGINE=webkit`.

Do not mark step 05 complete until the exact-head run finishes and its evidence has been reviewed.

## Step 06 — Real-browser crest lifecycle verification

The existing first-paint browser suite now exercises real DOM and the shared `app.css` and `club-crests.js` resources, holding a known SVG URL to observe four stages: missing club → neutral fallback; known SVG pending → circular skeleton with no shield and hidden image; loaded SVG → visible image, stable DOM node and no duplicate request; failed SVG → neutral fallback.

The test document is intercepted by Playwright on the loopback origin and **not** exposed through the production publication allowlist. This is a deterministic representative case, not a PASS for unrelated routes, locales, modes or physical Safari.

## Step 06 first crest-loading defect (Draft/HOLD)

Source review found `data-club-crest-fallback="true"` could linger on an existing crest host changing from a missing/failed identity to a known SVG. Under `.fa-crest-loading`, the neutral fallback shield could appear while the real crest was still pending, contrary to the agreed first-paint policy.

**Minimal correction:** clear the old fallback immediately when accepting a known crest (also when reusing a pre-existing prepaint image); keep fallback for missing, malformed or failed assets. A new `tests/club-crests.test.mjs` regression checks missing → known → failed → different known → loaded, including pending/fallback/loaded flags. No CSS, club logo asset/palette, sporting logic, D1 or deployment change.

**Evidence:** source-level finding and specific regression committed; targeted Node/Browser/FULL acceptance awaits exact-head checks. Step 06 overall remains open pending broader loading/error/refresh QA.

## CI reconciliation — exact HEAD 5841879037bd423b991c6f66ff8c6e4e21d04317

- [Browser QA run 43072760226](https://github.com/FraGioco9/football-architect/actions/runs/43072760226): **PASS**; risk-based 493 suite and existing browser regressions ran.
- [Admin World run 43072760713](https://github.com/FraGioco9/football-architect/actions/runs/43072760713): **PASS**.
- [Site Checks run 43072760575](https://github.com/FraGioco9/football-architect/actions/runs/43072760575): **FAIL**, 4 out of 1,138 reported Node tests, all in `tests/ci-opt-01-workflow-events.test.mjs`. Cause: fixed expected FULL browser command arrays omitted the **newly and intentionally inserted** `tests/repo-493-first-paint-browser.mjs` invocation. The additional suite shifted CSS parity command indices by one. This is **CI contract fixture drift**, not evidence of a UI regression.
- [FULL evidence run 43072760342](https://github.com/FraGioco9/football-architect/actions/runs/43072760342): **FAIL** because it correctly observed Site Checks failure (not an independent app failure).
- This patch updates the expected exact command order (and corresponding SHA-bearing command indices), and asserts that a failure in the new audit stops the shell before later suites. No suite, security guard, exact-head requirement, or fail-closed behavior is removed.

**Status: regression repair committed; do not mark acceptance green until the new exact-head checks finish.**

## Step 07 — Risk-based parser-time browser checks

The existing Browser FULL suite now checks **six additional real HTML/CSS first-paint cases** on a domestic competition and an INT-24 cup at 390px / 1440px: History, Fixtures and Stats. The Playwright test deliberately holds the external competition runtime script while browser parsing and inline first-paint bootstrap finish; it uses `waitUntil:'commit'` rather than waiting for `DOMContentLoaded`, which cannot occur until the held deferred script is released.

- History: selected and reserved panel, unknown archive count represented by a skeleton row, no falsely confirmed empty state
- Fixtures: reserved match rows with two crest slots each, no fabricated club identity/result, initial selector label
- Stats: Overview's three cards; parser-time click to Teams (seven top-five lists) and ArrowRight to Players (four top-five lists), preserving view selection before hydration
- All cases: visible selected tab only, panel busy state and measurable skeleton geometry

This specifically covers **the unresolved pre-hydration state**, not completed data hydration, Admin, Debug ON/OFF, real public-season history results, complex postseason schedule or physical Safari. Their acceptance checks remain open. Results are recorded per case in the existing `repo-493-first-paint-chromium.json` artifact. Until exact-head Browser QA completes, these cases must be treated as **UNVERIFIED**, not PASS.

## Step 07 exact-head test correction

[Browser QA run #43079689335](https://github.com/FraGioco9/football-architect/actions/runs/43079689335) failed the **new test** at `/competitions/it-1/fixtures?season=1` on `d3e6e431bc09ae43cb99d8b4f4291910194f5d6c`, where a generic Stats/History `[data-competition-skeleton-root]` was incorrectly assumed to exist for Fixtures. Fixtures has a dedicated match skeleton (`#app-fixtures-skeleton`) whose CSS visibility is controlled by global loading state and a permanently reserved matchday toolbar (`#app-fixtures-toolbar`). The failed height measurement was of a nonexistent generic selector, **not evidence of a production regression**. The corrected assertion now measures the actual visible static fixture toolbar; fixture skeleton rows, their paired crest slots and absence of invented identities are checked separately. Do not mistake presence of dormant rows for their verified visible loading state—broader hydration/first-paint QA remains open.

No UI/source renderer change, CI bypass or additional workflow; acceptance awaits new exact HEAD.

## Step 07 — controlled History clock probe (six cases)

The browser QA now covers **IT-1 and INT-1 × three pre-hydration clock states** by injecting the local Debug flag and clock before the actual inline History bootstrap, while the external competition runtime is held:

- **Debug OFF, stale local Season 0, unknown public clock:** exactly one reserved archive row, no confirmed empty state.
- **Debug ON, explicitly isolated Season 0:** no pending History archive skeleton, static empty archive confirmation is permitted.
- **Debug OFF, confirmed public Season 3 at day 1:** exactly two completed-season placeholders, without invented club identities or a false empty state.

These assertions inspect **real browser DOM with controlled clock inputs**, not a user-end-to-end Debug Settings workflow, authoritative API completion, or real generated sporting history. They do not imply public Seasons 3+ are published. Runtime source switching, historic record values, invalid sources, 320px and physical iPhone Safari remain **UNKNOWN / OPEN** until separately exercised. The cases write individual PASS/FAIL records to the same existing Browser QA artifact. Acceptance requires the exact-head Site/Browser/Admin/FULL gates.

## Step 07 clock probe injection correction — failed synthetic setup

[Browser QA #43083880632](https://github.com/FraGioco9/football-architect/actions/runs/43083880632) failed the new `local-debug-season-zero` synthetic History case: one archive row remained instead of zero. The test used Playwright `page.addInitScript` to set `window.faDebugEnabled` and immediately access `document.documentElement.dataset`. Browser initialization can happen before the HTML root exists, leaving the clock probe partially configured; the error alone does **not** establish an app regression.

The probe now intercepts its own loopback document response and inserts an inline synthetic state script immediately before the existing History first-paint bootstrap, after the HTML root has been parsed. New assertions explicitly confirm one injection, the chosen Debug flag and season. Original application HTML, production routes, data providers, sporting records and remote D1 are unchanged. Real Settings Debug ON/OFF/Reset still requires separate browser QA.

**Corrected CI exact-head verification: pending.**

## Step 10 — delayed Standings hydration before crest identity snapshot

The current prior-head [Browser QA run 43084986311](https://github.com/FraGioco9/football-architect/actions/runs/43084986311) failed before entering the REPO-493 History clock probe, in pre-existing `tests/int24-browser-qa.mjs:73` on `fr-2/postseason`: the stored Standings crest host was no longer connected. The test captured that node immediately after the Standings tab became visible, **before verifying Standings loading had settled**. This can record a provisional node that a legitimate deferred source/standings hydration later replaces. The prior PR HEAD `196aa046863e998a09ebe1c83a97217a77a5d999` passed this suite and intervening changes were test-only; the isolated failure is therefore **suspected asynchronous fixture instability, not proven product regression**.

The specific regression test now waits for all of: the selected Standings panel visible, `data-fa-standings-loading="false"`, matching competition context, and (on all domestic routes) the complete 16-club table with a crest host. **It still pins the exact same crest DOM node and rejects replacement across every subsequent tab**, with no bypasses, assertion removal, global sleeps or workflow reduction. International no-data tables do not invent a club crest. If a true post-hydration replacement occurs, the original assertion still fails. This correction touches only test code and this audit record; further exact-head CI evidence is required.
