# PAGE-LOAD-02 — independent page-by-page first-paint and refresh audit

Baseline: `08c04e7363c19cc227264e0c170760317512cbb5` (squash merge of SH-03 #373).
Branch: `fix/page-load-02-first-paint-refresh`. Draft/HOLD, no merge/deploy/remote D1.
Scope exclusions: SH-01 #353 canonical sporting rules and catalogues; BE-02 #349 HTTP/auth contracts; SH-02 #354 shared renderer consolidation.

## Verification semantics

Each P-item requires independent evidence of **direct cold navigation, warm/hard refresh, Back/Forward, delayed/failed/empty/obsolete data, global/Debug/season transitions, locale/theme/responsive/focus/scroll and exact-head browser execution**. Do not infer PASS from existing SH-03 or historical #338 coverage. Mark **UNKNOWN** when the current branch has no genuinely executed evidence. A code change or a browser test written but not run is **not** a PASS.

| Item | Page/view | Status | Current evidence/gap |
| --- | --- | --- | --- |
| P01 | Landing/root/navigation | UNKNOWN | Browser matrix not executed |
| P02 | Dashboard | UNKNOWN | Browser matrix not executed |
| P03 | Competitions directory | UNKNOWN | Browser matrix not executed |
| P04 | Domestic Standings/Form | UNKNOWN | Initial DOM, delayed payload and geometry QA required |
| P05 | Domestic Fixtures/postseason | UNKNOWN | First/second leg and selector QA required |
| P06 | Domestic Overview | UNKNOWN | Dynamic source transition QA required |
| P07 | Domestic Stats | UNKNOWN | Independent subview QA required |
| P08 | Domestic History | UNKNOWN | Archives and explicit season QA required |
| P09 | Domestic Rules/Awards | UNKNOWN | Independent static/locale QA required |
| P10 | International Overview | UNKNOWN | Debug OFF/ON authoritative source QA required |
| P11 | International Fixtures | UNKNOWN | Leg/arrow/round topology QA required |
| P12 | International Standings | UNKNOWN | No fictitious ranking/flash QA required |
| P13 | International ancillary views | UNKNOWN | Independent subview QA required |
| P14 | Calendar Season | UNKNOWN | 56-day stable first paint QA required |
| P15 | Calendar Week/details | UNKNOWN | Dialog and in-place refresh QA required |
| P16 | Clubs directory/search | UNKNOWN | Direct/warm/search-state QA required |
| P17 | Club Overview | UNKNOWN | Crest/focus fix implemented; new real-browser regression not yet run |
| P18 | Club subviews | UNKNOWN | Crest/focus fix implemented; per-view matrix not yet run |
| P19 | Settings/Debug | UNKNOWN | Source/toggle/reset QA required |
| P20 | Protected Admin | UNKNOWN | Read-only protected state QA required |
| P21 | Account/auth/profile | UNKNOWN | Session, controls and form QA required |
| P22 | Guide/sidebar/locale | UNKNOWN | Five-locale interaction QA required |
| P23 | Final cross-page handoff | UNKNOWN | Requires P01–P22 evidence |

## Confirmed code finding and proposed correction

Before this branch, `assets/club-page.js` performed unconditional `paint()` on every observed `lang` mutation, with `innerHTML` replacement of the entire club page. Competition summary changes replaced the complete `.club-competition` subtree. These operations discard already-loaded crest image nodes, can alter focus, and can create visual refresh flashes.

The branch reuses loaded canonical crest hosts by their exact identity and class inside the relevant rendered region; it preserves the same-club header during tab navigation and Back/Forward, but intentionally regenerates translated header text on locale changes. It restores a focused tab or translate control without scrolling, and avoids a rebuild when the effective language did not change. A new independent Playwright script exercises four widths, five locales, image-node identity, focus, tab navigation and Back.

Run targeted checks at final HEAD:

```sh
node --check assets/club-page.js
node --check tests/page-load-02-club-browser.mjs
node tests/page-load-02-club-browser.mjs
node --test tests/club-pages.test.mjs tests/canonical-world-state.test.mjs
node tools/generate-app-pages.mjs --check
```

Do not claim the above commands have passed unless their outputs are actually captured. In this execution environment, the GitHub connector exposes source/commit operations but no local browser or full repository checkout, so execution evidence remains pending. SH-03 browser coverage is background context only, not substituted for P01–P23 acceptance. No sporting results are synthesized by this branch.

## Follow-up implementation batch

This batch extends the original P17/P18 change without moving sporting/HTTP ownership:

- **P04/P12:** keyed desktop standings row reconciliation; compact standings card reconciliation without unnecessary detach/reappend. Known club identity, loaded crest and expanded mobile details are retained across valid updates.
- **P04/P05/P11:** known bracket participant crest nodes survive subsequent validated updates with the same tie identity; a changed or cleared tie still resets its participant slots.
- **P07/P13:** stats refresh compares fully normalized, validated content and does not rebuild cards or close an open dialog for a revision carrying identical statistics.
- **P15:** inline calendar detail disclosures retain matching event expansion/focus when the locale changes; domestic event links use the explicitly selected season, not a hard-coded Season 1.
- **P16:** the clubs directory caches canonical cards across search/filter/retranslation, retaining image elements; the existing browser suite now asserts card identity after filtering and clearing.
- **P04/P17/P18/P23:** the shared Chromium/WebKit canonical-state browser helper now independently visits domestic and international competition views, Calendar season/week, all five club views, settings and other app pages. It tests cold/refresh/Debug sources, language/theme and four breakpoints. Dedicated assertions probe P04 row stability across validated authoritative revisions and P17/P18 club crest/focus/Back.
- **Pending treatment:** the competition source-status announcement is screen-reader-only while loading; confirmed empty/error remains visible. The sporting cells continue to be governed by the verified canonical provider contract.

## Interpretation of test coverage

The extra automated navigation/geometry probes are a **cross-page smoke audit**, not proof of all six mandatory cases for each P-item. In particular, the original issue requires genuine delayed/failed/empty/stale payload and five-language/dual-theme scenarios *per* page and independent native Safari where available. Do not convert any UNKNOWN item into PASS merely because this shared test matrix succeeds.

The exact source HEAD, workflow URLs, node test counts, browser reports and outstanding per-view scenarios must be recorded after final tests complete. Browser scripts that are only written (rather than executed) remain UNKNOWN. No automatic merge is authorized.

## Evidence-led diagnostics

Chromium initially reported an unknown cup Overview route. The canonical route registry currently exposes standings, postseason, fixtures, stats, history, rules and awards for international cups, but no separate Overview URL. P10 remains UNKNOWN rather than being counted as an implemented view. The smoke matrix now visits existing routes only.

A separate Chromium failure showed that authoritative recent Form arrives as W/D/L letters, whereas mobile standings require match metadata. The view now verifies each letter against completed, supplied league fixtures and attaches their real round and participants. A mismatch fails validation; no sporting outcomes are generated.

A Site run exposed legacy DOM test-stub incompatibilities. Optional selectors and literal DOM nodeType values restore compatibility without reducing assertions.

The full P01-P23 independent audit remains incomplete. Final exact-head execution, full source/error/delay coverage by view and Safari verification where available are still mandatory. The PR remains Draft/HOLD and cannot be merged without separate approval.

## Mainline coordination checkpoint

The main branch advanced to `c0031787568d843f321804c6b5e3a9d29b192db1` as BE-02 and SH-01 were squash-merged independently. The resumed PR HEAD `812138812d3bd04f4ae320a71986f066f57d24b4` already includes that mainline commit in its ancestry. No new branch, PR, rebase or mainline merge is needed. This branch leaves their HTTP and sporting contract modules untouched.

## Resumed verification — 2026-11-03

At source HEAD `812138812d3bd04f4ae320a71986f066f57d24b4`, GitHub Browser QA run `41639698624` and Admin run `41639698616` passed. Site run `41639698644` reported 830/832 passing tests and two failures:

- `world-calendar-ui.test.mjs`: its simulated details element did not implement DOM `contains`.
- `world-competition-runtime.test.mjs`: simulated bracket slots did not implement `querySelector`; the missing method threw inside the renderer, which correctly cleared the supplied table through its failure path. This made the test observe one empty-state row instead of 24 standings rows.

Both failures were reproduced locally before editing the test harnesses. The harnesses now model descendant containment and querying, with the original fixture/link/standings assertions preserved. The focused four-file regression command passed **51/51**, test discovery passed, syntax checks passed, and generated HTML remained **23/23** byte-equivalent. The separate club-browser script also now captures the translated header immediately before testing tab navigation, matching the already-correct FULL helper.

The complete local Site command was attempted. After removing an incidental local dependency symlink, its remaining six failures were browser prerequisites: no executable browser initially, then Chrome launch denied by the environment (`socket() failed: Operation not permitted`). These are not recorded as product PASS or used to weaken CI. Browser QA must execute in GitHub Actions; no native iPhone Safari result is claimed.

`tests/page-load-02-matrix.mjs` adds **42 separately identified routes** to both existing FULL browser engines. For every route it records a delayed-transport cold shell, confirmed-empty shell, hard refresh, same-document Back/Forward, failed transport/private boundaries, five locales, both themes and four widths. Stats Overview/Teams/Players are clicked independently where implemented. Account requests are mocked with a synthetic identity, Admin stays unauthorized, and all outgoing mutations fail the audit. Per-engine JSON records the exact checked-out SHA and each route's actual result in `int24-browser-artifacts/page-load-02-<engine>.json`.

This expanded matrix is not yet executed at this checkpoint. It explicitly does **not** certify every populated sporting outcome, per-view Debug transition, focus/menu/scroll case, or native Safari behavior. Same-document history checks do not substitute for the separate cross-route checks. The five locales and two themes cover each dimension per route, not their full Cartesian product. P01–P23 acceptance therefore remains open until the corresponding missing evidence is collected.

### Mobile crest reconciliation correction

A new deterministic regression reproduced a genuine P04 issue: compact-row reconciliation compared a loaded crest host against a fresh empty host of the same identity, removed the image-renderer's load attributes, and deleted its image child. It now preserves the renderer-owned host when `data-club-crest` is unchanged. The regression checks both same-identity image/load-state retention and changed-identity clearing. The Chromium/WebKit shared scenario additionally checks the real compact card, loaded image, expanded details and focused summary across consecutive authoritative revisions.

The full focused nine-file block now passes **123/123** locally, with syntax and **23/23** generator verification passing. Browser execution remains delegated to the exact-head CI runners because local Chrome cannot open its required socket.

The first expanded-matrix CI run at `b2fd970483e2d6375620fd7dfb6985d11406bc48` passed the 185 existing Chromium page/state checks and the new Landing and Dashboard scenarios, then exposed a test-selector defect on the Competitions directory: the shared shell intentionally contains several hidden page titles, and `main h1:first` selected the hidden Dashboard title. The audit now selects and measures the visible title, retaining the visibility/geometry assertions. This failed run is not treated as full acceptance.
