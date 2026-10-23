# Configurable Competition Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution method awaits owner selection.

**Goal:** Build all 18 competition pages from validated tournament rules while preserving domestic behavior and sharing the complete Stats interface.

**Architecture:** Extend domestic records with rules and introduce an equivalent international catalogue. Normalize both into immutable definitions consumed by one generator and browser context. Keep season datasets and protected DEV simulation separate from public presentation.

**Tech Stack:** Existing JavaScript/Node.js 22, JSON, static HTML/CSS, Node test runner and existing Playwright Chromium workflow; no new application framework or runtime dependency.

**Spec:** `docs/superpowers/specs/2026-10-23-configurable-competition-pages-design.md` (owner approved 2026-10-23).

## Global Constraints

- All 16 domestic divisions and both international cups use one competition page pipeline.
- Preserve the existing domestic visual language and EN/DE/ES/FR/IT support.
- `capacity` remains the single declared number of participants.
- Preserve domestic IDs, names, palettes, crest bytes and the 16+16+8 allocation.
- Preserve the existing 56-day model and day-56 transition; no 43-slot migration.
- Debug Season 0 is an inactive simulation state only; competition and Calendar selectors still offer Season 1, the selected panel remains visible, Day is disabled, and stale results are cleared.
- Keep #253 Draft/HOLD; merge/deploy/DB require separate authorization.
- Configuration edits do not fabricate international participants, draws, fixtures, results or historical records. Existing supplied season data remains authoritative.
- Repository text and commits are English. Preserve canonical routes and existing DOM hooks during migration. Do not change sidebar work or deployment triggers.

## Review Focus

1. Missing, malformed or stale manifest/context: display an affected-panel error without leaking another competition's clubs (Tasks 2–3).
2. Late domestic DEV responses after switching season or entering Season 0: reject stale data and keep navigation usable (Tasks 3 and 6).
3. New rules configuration viewed alongside historical season data: render the historical rules version and never rewrite results (Task 7).
4. A supported field changes but an old language paragraph or rank band remains fixed: derive all representations from the same definition (Tasks 4–5).
5. Public Stats accidentally imports a protected generator or assumes 16 rows: enforce import isolation and actual participant counts (Tasks 6 and 8).

## File and interface map

| File | Responsibility |
| --- | --- |
| `data/divisions.json` | Existing 16 records plus structured rules |
| `data/international-competitions.json` (new) | Two cup records using the same rules contract |
| `assets/competition-rules.js` (new) | Pure browser/CommonJS validation, normalization, derived metrics and outcome/tie helpers |
| `tools/competition-catalogue.mjs` (new) | Build-time loading and cross-catalogue validation |
| `assets/competition-model.js` | Manifest v2 validator, domestic compatibility projection and existing route/view contract |
| `assets/competition-page.js` | Generic initialization and publication of `faCompetitionContext` |
| `tools/render-competition-page.mjs` | Shared initial markup using normalized rules |
| `tools/generate-app-pages.mjs` | One route generation path and manifest emission |
| `assets/competition-rules-view.js` (new) | Pure localized Rules markup from validated rules; used in Node and browser |
| `assets/competition-stats.js` (new) | Public Stats mounting, tabs, cards and dialogs; no simulation |
| Existing fixtures/history/awards/DEV modules | Consumers of generic context and supplied data |

Common contract: `CompetitionDefinition = {id, slug, name, category, countryId?, tier?, capacity, rules, metrics, capabilities}`. `category` is `domestic` or `international`; it never implies sporting outcomes. Phase metrics are `{rounds, matchesPerRound, matches}` and tournament metrics include `totalMatches`. `capabilities` contains derived phase IDs and applicable award IDs, not independently editable duplicate rules.

Season contract: `SeasonData = {season, rulesVersion, participants, fixtures, results, statistics, status}`. Missing datasets are `null`, not generated arrays. `status` is `unavailable`, `partial` or `available`; field validity is checked separately. Existing domestic membership arrays remain provisional and do not imply a generated official season.

Context contract: `faCompetitionContext = {definition, selectedSeason, seasonData, revision}`. Definition and data are immutable. On accepted updates, replace the context and emit `fa:competition-context-change` with that context. Retain `fa:competition-route-change` for navigation. A generic context is available before panel initialization, even when season data is unavailable.

## Task 1: Rule catalogues and pure validation

**Files:** Create `assets/competition-rules.js`, `tools/competition-catalogue.mjs`, `data/international-competitions.json`, `tests/competition-rules-model.test.mjs`; modify `data/divisions.json`.

**Interfaces:** `normalizeCompetition(record) -> CompetitionDefinition` throws a field-path error; `validateCompetition(record) -> {valid, errors: [{path, message}]}`; `phaseMetrics(definition, phaseId) -> {rounds, matchesPerRound, matches}`; `outcomeAt(definition, phaseId, rank) -> outcome | null`; `loadCompetitionCatalogue() -> readonly CompetitionDefinition[]` in the build loader. UMD export is `faCompetitionRules` in browsers and CommonJS in Node.

- [ ] Write failing Node tests loading the JSON and normalizing the definitions. Pin `definitions.length === 18`, all domestic league metrics `{rounds:30,matchesPerRound:8,matches:240}`, cup league metrics `{rounds:6,matchesPerRound:12,matches:72}`, cup `metrics.totalMatches === 93`. Independently assert domestic rank bands and the exact approved cup tie graph from the spec.
- [ ] Run `node --test tests/competition-rules-model.test.mjs`; confirm failure because the new catalogue/model is missing, rather than from malformed test code.
- [ ] Implement the interfaces and the explicit v1 rules contract from the spec. Preserve existing `capacity`, identity and palette fields. Add rule versions `domestic-top-v1`, `domestic-second-v1`, `international-int24-v1`; reference the existing canonical calendar identities. Store ordered tiebreakers and named qualification/draw policies; do not implement cup scheduling.
- [ ] Extend tests: reject negative/nonfinite points, duplicate phase IDs, incomplete/overlapping rank coverage, out-of-range seeds, unknown/later/cyclic tie references, inconsistent home/away totals, unsupported policy IDs and incompatible calendar mappings. Tie participant references cannot consume winners from the same or a later phase; rank outcomes may correctly target later phases. Ties may reference earlier completed phases. Preserve semantic distinction between approved rules and provisional participants.
- [ ] Run the new test file and `node --test tests/world-calendar-model.test.mjs`; expect PASS and unchanged calendar bytes. Commit `feat: define validated competition rules catalogues` with only this task's files.

## Task 2: Manifest v2 with a domestic compatibility projection

**Files:** Modify `assets/competition-model.js`, `tools/generate-app-pages.mjs`, `competitions/_shared/manifest.json`, `tests/competition-model.test.mjs`, `tests/world-divisions.test.mjs`, `tests/competition-rules.test.mjs`; create `tests/competition-manifest-v2.test.mjs`.

**Interfaces:** `faCompetitionModel.validManifest(data) -> boolean` accepts only the documented current manifest v2; `competitionById(manifest, id) -> CompetitionDefinition | null`; `resolveSeasonRules(definition, seasonRecord) -> rules | null` is added in Task 7. Manifest v2 has `{schemaVersion:2, approved:false, competitions, divisions, clubCrests}`. `competitions` has 18 normalized definitions; `divisions` retains the 16 existing membership records and domestic `profile` compatibility data remains at its existing top-level location until callers migrate.

- [ ] Write failing v2 tests: exactly 18 distinct IDs/slugs, 16 domestic projections, 256 distinct provisional active memberships, same crest catalogue; `competitionById` returns null for unknown IDs. Mutating a definition or swapping domestic members between countries fails validation. Stale v1 data is rejected by the v2 runtime with a controlled reload/error path.
- [ ] Run `node --test tests/competition-manifest-v2.test.mjs` and confirm the intended failure.
- [ ] Generate definitions with Task 1's loader and validate their domestic projections without fabricating cup participants. Retain the legacy global profile only as a documented domestic compatibility API, never as authoritative rules for generic pages. Update old tests which incorrectly require every tournament's rules to remain undefined; retain their allocation and immutability assertions.
- [ ] Run `node tools/generate-app-pages.mjs`, then `node tools/generate-app-pages.mjs --check` and the four listed test files. Expect PASS, deterministic v2 JSON and no unrelated generated differences. Commit `feat: publish generic competition definitions in manifest v2`.

## Task 3: One route generator and competition context

**Files:** Modify `tools/generate-app-pages.mjs`, `tools/render-competition-page.mjs`, `assets/competition-page.js`, `assets/competition-tabs.js`, `assets/international-cups.js`, `tools/dev-standings-preview-client.mjs`; update all generated competition HTML; modify `tests/world-competition-runtime.test.mjs`, `tests/international-cups-ui.test.mjs`, `tests/competition-navigation.test.mjs`.

**Interfaces:** `createContext(definition, selectedSeason, seasonData, revision) -> frozen context`; `publishCompetitionContext(context) -> void` replaces the global and emits the context event. A shared `meta[name="fa-competition"]` contains the canonical ID. Keep `fa-division` and `faCompetitionDivision` only on domestic routes while legacy consumers remain.

- [x] Add failing tests for the same loader on all 18 routes, exactly one initialization per panel, early generic context with null datasets, invalid/unknown metadata, a rejected stale manifest, and no first-domestic-division data on cups. Assert Season 0 still displays selected season 1 and exactly one visible panel after refresh.
- [x] Run the three affected test files and confirm the new context/loader expectations fail.
- [x] Replace the separate `internationalRoute` generation path with `competitionRoute(definition)` and stop synthesizing cups from `divisionData[0]`. Initialize generic context before loading shared scripts. Limit `international-cups.js` to index/category translation until equivalent shared localization exists; it must not rewrite tables or Rules paragraphs after render.
- [x] Adapt DEV lifecycle to update context revision and drop stale data on route/season changes. Empty cup contexts never call domestic simulation. Preserve route canonicalization and tab scroll restoration.
- [x] Regenerate HTML, run generation check and the three tests; expect PASS for all 18 routes. Commit `refactor: initialize all competitions through one page context`.

## Task 4: Rules presentation and applicable awards from configuration

**Files:** Create `assets/competition-rules-view.js`; modify `tools/render-competition-page.mjs`, `assets/app.js`, `assets/competition-awards.js`, `tools/generate-app-pages.mjs`, `tests/competition-rules.test.mjs`; create `tests/competition-rules-view.test.mjs`; regenerate affected HTML.

**Interfaces:** `renderRules(definition, locale) -> escaped HTML string` is exposed by `faCompetitionRulesView` and CommonJS. Dynamic fragments carry rule-template IDs and scalar parameters so language changes rerender from the same definition. Awards uses `definition.rules.awards` ordered IDs and supplied recipients.

- [x] Write failing tests: domestic and cup metrics, exact rank outcomes, ordered tiebreakers, configured home advantage and match resolution; unsupported configuration never renders a plausible domestic fallback. Changing win points to 2 changes the displayed value in all five locales; changing a valid rank band updates its text and metadata together. Escape names and reject executable/HTML configuration.
- [x] Run `node --test tests/competition-rules-view.test.mjs tests/competition-rules.test.mjs`; confirm failures for the new contract.
- [x] Implement localized rule templates with parameters instead of independent fixed sporting paragraphs. Use Task 1 derived totals and explicit tie policies. Remove domestic relegation/promotions from cup Rules and remove award tier inference; use the existing champion/performance award presentation without inventing award recipients or extra competition-specific trophies.
- [x] Regenerate and rerun both tests; expect semantic domestic parity, five-locale coverage, no stale language strings after switching locale and correct cup 72/93 totals. Commit `feat: derive competition rules and awards from tournament configuration`.

## Task 5: Standings, fixtures and knockout consumers

**Files:** Modify `assets/competition-page.js`, `assets/competition-fixtures.js`, `assets/competition-tabs.js`, `tools/render-competition-page.mjs`, `tools/dev-standings-preview-data.mjs`, `tools/dev-standings-preview-client.mjs`; modify `tests/competition-fixtures.test.mjs`, `tests/postseason-preview.test.mjs`, `tests/world-competition-runtime.test.mjs`, `tests/competition-navigation.test.mjs`.

**Interfaces:** `fixtureChoices(definition) -> [{value, phaseId, round, labelKey, labelParams}]` lives in `assets/competition-rules.js`; regular numeric rounds remain compatible with current URLs, named legacy domestic playoffs/playout remain supported, cup knockout choices use stable phase/leg tokens. `tieParticipants(definition, tieId, table, completedTies) -> [club | null, club | null]`; `homeOrder(definition, tieId, clubs, originalTable) -> ordered clubs` are pure helpers in the same model. Neither helper computes results.

- [ ] Add failing tests for domestic 30-round controls and cup six-round plus configured knockout choices, outcome bands from rules, no domestic playout on cups, cup 1/4/2/3 quarterfinal seeds and higher original rank at home second after an upset. Missing results leave participants unresolved; browsing fixture choices never changes simulation progress.
- [ ] Run the four tests and confirm new cases fail for global schedule assumptions.
- [ ] Replace capacity, outcome rank and phase/tier branches in shared consumers with Task 1/5 helpers. Derive current progress from existing calendar markers, preserving 56-day semantics. Render empty fixture/knockout states before datasets arrive. Support supplied country-qualified cup participants with existing crest fallback.
- [ ] Adapt domestic DEV fixture/postseason presentation to consume its normalized rules without changing deterministic scores or approved sporting semantics. If a baseline algorithm conflicts with approved rules, preserve a recorded reproduction and resolve that scoped discrepancy before claiming parity; never silently mask it in JSON.
- [ ] Regenerate HTML and run these tests plus `node --test tests/cal-world-56a.test.mjs tests/dev-standings-preview.test.mjs`; expect PASS, unchanged domestic results and no 30-round cup picker. Commit `refactor: drive competition phases and controls from rules`.

## Task 6: Public shared Stats and protected data adapter

**Files:** Create `assets/competition-stats.js`, `tests/competition-stats-view.test.mjs`; modify `tools/dev-competition-stats-client.mjs`, `tools/check-dev-competition-stats.mjs`, `assets/app.css`, `assets/competition-page.js`, `tools/render-competition-page.mjs`, `tests/int24-browser-qa.mjs`.

**Interfaces:** `faCompetitionStats.mount(panel, context) -> {update(context), destroy()}`; `context.seasonData.statistics` is null or `{overview:{matchesPlayed,totalGoals,goalsPerMatch}, teams, players}`. Each team row uses `clubKey` (country-qualified identity), `clubName` and the seven current metric values; player records remain absent until supplied. The protected adapter translates `aggregatePreviewStats` output into this contract and publishes accepted context revisions. It imports the existing DEV generator; public Stats never does.

- [ ] Write failing behavior tests for Overview/Teams/Players on public domestic and both cup contexts: 3 overview cards, 7 team categories, 4 current player categories, empty cards when datasets are null, two-decimal averages, and no fabricated numeric zero records. Test Show all with independently supplied 16- and 24-participant data, ties, country-qualified identities and no fixed limit of 16.
- [ ] Run `node --test tests/competition-stats-view.test.mjs` and confirm missing shared mounting fails. Use the existing VM/DOM testing style, not a new test framework.
- [ ] Extract the DOM/dialog presentation and existing style declarations into the public runtime and shared CSS, retaining visual dimensions and existing hooks. Mount once from the generic context; update without duplicate listeners, observers or dialogs. Initialize the empty interface in static HTML so initial paint does not expose a heading-only interim page.
- [ ] Keep Club summary injection working in the protected adapter. Remove the `fa-division` gate from presentation, while domestic aggregation remains explicitly limited to domestic definitions. Verify a late Season 1 payload cannot restore data after Debug 0 or a newer context revision.
- [ ] Extend Chromium assertions to inspect actual subviews, empty cards, keyboard switching and dialog close/Escape/outside/focus, including reload at Season 0/1. Run the new Node test, `node tools/check-dev-competition-stats.mjs`, and existing Stats/Club summary tests; expect PASS. Commit `feat: share complete competition stats presentation across tournaments`.

## Task 7: Historical rules resolution and consumer cleanup

**Files:** Modify `assets/competition-model.js`, `assets/competition-history.js`, `assets/competition-page.js`, `tools/dev-standings-preview-data.mjs`, `tests/competition-history.test.mjs`, `tests/club-competition-summary.test.mjs`; create `tests/competition-season-rules.test.mjs`.

**Interfaces:** `resolveSeasonRules(definition, seasonRecord) -> frozen rules | null`: validated stored `rulesSnapshot` wins; absent snapshot with the known baseline legacy format maps to its immutable baseline version; an explicitly unknown version or malformed snapshot returns null. Do not infer completed seasons from a definition alone.

- [ ] Add failing tests for current configuration differing from a valid historical snapshot, known legacy records with no snapshot, malformed/unknown versions, and missing cup history. Assert supplied historical scores and standings are byte-identical before and after viewing under changed current configuration.
- [ ] Run the new test and confirm failure before implementing resolution.
- [ ] Implement the version resolver, attach snapshots to newly created DEV season records only, and make History/context honor the resolved rules. Existing saved records remain untouched. Remove obsolete domestic-only presentation gates and constants only after searches prove all generic callers migrated; retain legacy compatibility APIs used by unrelated Club features.
- [ ] Run `node --test tests/competition-season-rules.test.mjs tests/competition-history.test.mjs tests/club-competition-summary.test.mjs`; expect PASS and unchanged Club summaries. Commit `feat: preserve season-specific rules in shared competition history`.

## Task 8: Publication isolation, generated output and complete verification

**Files:** Modify `tools/publication-guard.mjs`, `tools/dev-standings-preview.mjs`, `tools/dev-preview-artifact.mjs` only where new public assets need explicit inclusion/ordering; modify `tests/publication-gate.test.mjs`, `tests/dev-preview-artifact.test.mjs`, `tests/int24-browser-qa.mjs`, `.github/workflows/int24-browser-qa.yml`, `README.md`; regenerate affected HTML/manifests.

**Interfaces:** Existing publication gates remain authoritative. Add only the three public presentation/model assets to the explicit runtime allowlist; raw source catalogues are build inputs, with resolved definitions delivered through the validated generated manifest. Protected providers remain under their existing protected paths.

- [ ] Add failing isolation tests that stage both actual artifact contracts: public Stats and rules imports resolve using only public assets; no public source imports `/__fa_dev__/` or a generator; exact protected asset membership remains intentional; catalogue source files and repository root are not accidentally published.
- [ ] Run the publication/isolation tests; confirm intended failures for missing asset allowlisting, then add the exact new assets and correct script ordering. Preserve deployment triggers, authorization/approval checks and frozen calendar bytes.
- [ ] Expand Chromium path filters to cover shared competition/model/rules/Stats/CSS/DEV changes. Preserve workflow permissions and exact-head checkout. Test all 18 routes; use both cups and domestic top/second representatives for all seven panels, 320/390/768/1440 widths, both themes and five languages. Record screenshot coverage by panel; exercise invalid season, 1→0→reload→1, navigation/back/forward, Stats subviews/dialogs and first-paint content.
- [ ] Run `node tools/generate-app-pages.mjs --check`, JavaScript syntax checks on changed runtimes, then `node --test --test-concurrency=1 tests/*.test.mjs` and `node tests/int24-browser-qa.mjs` with the existing server/browser dependencies. Report missing browser support as a blocker to local browser claims, then verify CI instead. All product checks must PASS on the final exact head; record actual counts rather than presuming baseline counts.
- [ ] Inspect the final diff for unintended identity/assets/sidebar/calendar/deployment changes. Update README with configuration ownership, supported edits and derived Rules/Stats behavior. Commit `test: verify configurable competition pages and public stats isolation`, update PR title/body to final scope and coordinate overlap with #254/#255. Keep Draft/HOLD; request real-device iPhone Safari verification with local sync instructions. Do not merge or deploy.

## Self-review and handoff

All spec sections map to tasks: rules/catalogues (1), manifest (2), one initialization (3), localized Rules/awards (4), configurable phases and existing sporting behavior (5), public/DEV Stats separation (6), season versioning (7), and routes/Debug/accessibility/publication verification (8). The five review-focus cases have explicit owning tests. Function and event names are consistent across tasks; no task silently adds cup simulation or changes the world clock.

Recommended execution method: native implementation in this session, task by task, because the changes share context/manifest interfaces and the existing branch. Use a final independent whole-branch review if the owner selects that method. Subagent-driven implementation is available if the owner prefers independent per-task review. Await review of this concrete plan and execution-method selection before implementation.
