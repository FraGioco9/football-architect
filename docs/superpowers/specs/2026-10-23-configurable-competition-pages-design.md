# Configurable competition rules and shared pages

Status: proposed written specification, awaiting owner review.
Baseline: PR #253, `23197b29104341a1a8e449787c4e3f32451051c3`.

## Goal and boundaries

All 16 domestic divisions and both international cups use one competition page pipeline. Tournament configuration determines applicable phases, controls, ranking bands, metrics, awards and Rules content. Preserve the existing domestic visual language and EN/DE/ES/FR/IT support.

The owner approved the architectural direction in conversation: editable division rules in JSON, shared competition pages and separate season data. This document defines the proposed contract; it does not claim implementation or authorize merge, deployment or database work.

Configuration is maintained in repository JSON. An administrative rules editor is outside scope. Supported format algorithms remain explicit code; JSON is not an arbitrary programming language.

## Findings at the baseline

- `tools/render-competition-page.mjs` already supplies shared panel markup.
- `tools/generate-app-pages.mjs` uses different initialization paths for domestic divisions and international cups. Cup records are synthesized from the first domestic division.
- `assets/competition-model.js` embeds one global 16-club, double-round-robin profile and 30-round schedule. Its manifest validator accepts only domestic divisions.
- `assets/competition-page.js` loads domestic context and then the shared client modules; cups bypass this context loader.
- The DEV Stats interface exists only in `tools/dev-competition-stats-client.mjs`, behind a `fa-division` check and a domestic manifest lookup. Public Stats is a heading and status message. Both cups therefore miss Overview/Teams/Players even in DEV.
- Fixtures markup contains 30 choices for cups. Its runtime exits without a domestic division context.
- Rules, standings bands, postseason layout and awards contain separate domestic assumptions. These must not become competing rule sources.

## Chosen approach

Extend existing catalogue entries with validated structured rules and normalize them into one competition definition. Use the same definition at build time and in the browser.

Rejected alternatives: separate copies of each page would preserve drift; a single global profile with more slug/tier branches would keep rules hidden in code. Existing presentation components will be reused rather than replaced by a new framework.

## Sources and ownership

| Source | Responsibility |
| --- | --- |
| `data/divisions.json` | Existing domestic identity, capacity and new `rules` object for each division |
| `data/international-competitions.json` (new) | Two cup identities, capacity and the same rules contract |
| `data/division-allocations.provisional.json` | Existing provisional domestic memberships; remains separate from rules |
| Season inputs / historical snapshots | Supplied participants, fixtures, results and the rules snapshot used for that season |
| `assets/world-calendar-model.js` | Canonical 56-day event placement; configuration refers to its identities |

`capacity` remains the single declared number of participants. Do not duplicate it inside rules. Preserve domestic IDs, names, palettes, crest bytes and the 16+16+8 allocation. Use country-qualified club IDs for all competition types.

For historical seasons, use their stored rules snapshot rather than interpreting old results under current rules. If a legacy record has no snapshot, resolve the fixed baseline rules version with a documented legacy adapter. This change does not require rewriting stored history or inventing historical results.

## Rules contract, version 1

Each competition has `rules.schemaVersion: 1`, a stable `rules.version` identifier, and these sections:

| Section | Fields and interpretation |
| --- | --- |
| `phases` | Ordered phase records: unique `id`, supported `type`, `labelKey`, `calendarEvents`; phase-specific settings below |
| Table phase | `points` (win/draw/loss), ordered `tiebreakers`, `rankOutcomes` with inclusive `from`/`to`, `kind` and optional `targetPhaseId` |
| Round-robin phase | `type: roundRobin`, `meetingsPerPair`; derive rounds and matches from capacity for supported even participant counts |
| Incomplete league phase | `type: leaguePhase`, `rounds`, `matchesPerClub`, `homeMatchesPerClub`, `awayMatchesPerClub`, `drawPolicyId`; do not apply the full round-robin formula |
| Knockout phase | `type: knockout`, `ties` with unique IDs, two participant references per tie, `legs`, `homePolicy`, and `resolution` |
| Participant reference | A table rank (`phaseId`, `rank`) or the winner of an earlier tie (`tieId`); references form an acyclic graph |
| `qualificationPolicyId` | Supported versioned policy, or `none`; complex qualification and pot assignment algorithms remain validated code |
| `awards` | Explicit ordered award IDs applicable to this tournament; no tier inference |

Rank outcomes are explicit and non-overlapping. The validator checks bounds and requires complete coverage of table positions, including neutral remain/eliminated bands. Points are finite non-negative integers. Tiebreakers are supported identifiers in an explicit order, with structured head-to-head reapplication semantics where needed.

Resolution explicitly states aggregate or single-match scoring, away-goals applicability, extra time and penalties. Home policies include higher-original-table-rank in the return leg, higher-original-table-rank in a single final, and a neutral final. Winning a tie does not transfer the defeated team's original rank.

Derived round/match totals are computed by shared pure helpers and are not independently editable. Calendar references identify existing events; they do not define a second clock. Unsupported capacity/phase/calendar combinations are rejected with a precise field-level build error. Changing the number of clubs is supported only when memberships and the calendar contract also support that change.

## Baseline rule migration

### Domestic divisions

Preserve 16 participants, two meetings per pair, 30 league rounds, eight matches per round and 240 regular-season matches. Points are 3/1/0. Preserve the current approved ordering: points, head-to-head mini-table points/goal difference/goals scored with subgroup reapplication, overall goal difference, overall goals scored, total wins, then an auditable reproducible draw.

First division: rank 1 champion, 2–12 remain, 13–14 playout, 15–16 directly relegated. The playout has two legs; rank 14 hosts first and rank 13 hosts second; winner remains and loser is relegated. Preserve extra time and penalties after a tied return-leg aggregate.

Second division: ranks 1–2 directly promoted, 3–6 promotion playoffs, 7–16 remain, no third-division relegation. Semifinals 3–6 and 4–5 have two legs, better rank hosts second. The final is one match hosted by the better regular-season rank; its winner is promoted. Preserve no points-gap threshold and extra time/penalties. Keep N31–N33 distinct from the 30-round league phase.

Migration preserves these sporting outcomes and current DEV result semantics; it does not silently change ranking or simulation algorithms. Any discrepancy between approved rules and a current consumer is reported and tested before changing behavior.

### Sovereign and Federation cups

Use the governing decisions in [issue #234](https://github.com/FraGioco9/football-architect/issues/234): 24 clubs, three per country, three pots, six distinct league opponents, three home and three away, no domestic opponents in the league phase, 12 games per round and 72 league-phase games.

Use the approved table ordering: points, goal difference, goals for, wins, away goals, away wins, opponents' points sum, opponents' goal-difference sum, opponents' goals-for sum, stable composite club ID. Ranks 1–4 advance directly to quarterfinals; 5–12 enter playoffs; 13–24 are eliminated.

Playoff ties are 5–12, 6–11, 7–10, 8–9. Quarterfinals are 1 vs winner(8–9), 4 vs winner(5–12), 2 vs winner(7–10), 3 vs winner(6–11). Semifinals pair the first two and last two quarterfinal winners. All these rounds have two legs; the original better league-phase rank hosts second. One neutral final, no away-goals rule, extra time and penalties when tied. Total: 93 matches per cup.

Qualification and pot-policy identifiers refer to the approved inaugural club IDs and subsequent champion-aware country quotas in #234. Defining the contract and rendering Rules does not generate participants, run a draw or fabricate matches/results. Those datasets stay unavailable until supplied by a separately implemented and validated provider.

Calendar references use I01–I06 for the league phase, I07–I12 for the two-leg knockout stages, and the separate Federation/Sovereign final events on days 53/54. Preserve the existing 56-day model and day-56 transition; no 43-slot migration.

## Shared data flow and client contract

1. Build loads both catalogues and validates identities, rules, references and known sporting invariants.
2. A shared normalizer resolves each record into a competition definition with derived metrics and view capabilities.
3. The generator renders each route with the same shell and panel functions. Initial HTML already contains the correct controls and empty states.
4. One browser loader resolves the competition definition and selected season, then initializes the shared components once.
5. A season provider supplies participants/results independently. Public absence of data is an empty state; DEV domestic fixtures remain explicitly fictional.

Expose a generic `window.faCompetitionContext` containing the immutable definition, selected season and supplied season data. Migrate consumers from `faCompetitionDivision`, domestic-only meta checks and slug/tier inference. Keep a temporary domestic compatibility adapter only for callers awaiting migration; it must not contain rules or treat cups as domestic divisions.

Add generic competition definitions to the generated manifest with an explicit schema version change and matching validator. Existing `divisions` consumers keep a validated domestic projection during the transition. Do not weaken legacy validation or pass cup objects to domestic simulation functions.

## Panel behavior

| Component | Required shared behavior |
| --- | --- |
| Header/Season/navigation | Same markup, accessibility, language binding, keyboard, history and scroll restoration; content from the definition |
| Standings | Shared desktop/mobile table; actual supplied participants; bands and ranking explanations from configured rules |
| Fixtures | Choices from configured phases and rounds; current round derived from the canonical clock; browsing never advances simulation |
| Postseason | Shared bracket renderer consumes configured ties; label Playoffs/Playout/Knockouts from applicable phases |
| Stats | Shared public presentation with Overview/Teams/Players, three Overview cards, seven Teams categories and current Players categories; retain dimensions, keyboard, dialog and language behavior |
| History | Shared archive and records; completed seasons only, using each season's own rules and results |
| Awards | Applicable IDs from configuration; recipients only from supplied season data |
| Rules | Localized structured text, metrics, ranking criteria, outcomes and knockout explanations derived from the same rules consumed by the UI |

Extract the current Stats DOM presentation from the protected DEV module into a public shared runtime. Keep deterministic fixture generation and aggregation in protected DEV providers. With no data, both cups and domestic pages still show the full Stats interface and localized empty cards; no fake zero totals or fabricated rankings. Show all appears only when enough verified rows exist and uses actual participant count rather than 16.

Localization uses typed template keys and parameters for counts, ranks, phase names and criteria. Do not preserve separate hardcoded paragraphs that can disagree with JSON, or place executable code/HTML in the rules catalogue. Schema/provenance diagnostics belong in build logs, not ordinary page flows.

## Season, Debug and unavailable data

Preserve the #253 correction: unavailable/invalid viewed seasons fall back to Season 1. Debug Season 0 is an inactive simulation state only; competition and Calendar selectors still offer Season 1, the selected panel remains visible, Day is disabled, and stale results are cleared. Do not show a No active season selector state or create a season-0 sporting snapshot.

Rules exist independently of an active season. Missing participants, schedules or statistics do not prevent reading Rules or navigating other panels. Malformed supplied data fails closed for the affected panel without inventing values or falling back to a different competition. Invalid build configuration prevents generation/publication.

## Migration and integration boundaries

Migrate in coherent steps: configuration/validation and manifest; common generator/context; Stats presentation/provider separation; standings/fixtures/postseason/rules/awards consumers; cross-tournament regression verification. Each step must keep domestic behavior working and delete superseded constants/branches when all their callers migrate.

Retain existing route contracts, DOM hooks and seven-tab navigation where applicable. This work does not rename postseason URLs, redesign the sidebar, alter club identities/assets, change qualification rules, create a new world clock, or introduce a database. Coordinate touched generator, routing, Debug and app paths with PRs #254 and #255 before integration. Keep #253 Draft/HOLD; merge/deploy/DB require separate authorization.

## Acceptance and verification

1. All 18 definitions validate. Mutations of supported rules drive derived controls and Rules text together; invalid points, overlapping/out-of-range ranks, cyclic/unknown tie references, unsupported policies and invalid calendar mappings are rejected.
2. Domestic baseline produces unchanged 16/30/240 metrics, outcomes and postseason geometry. Test ranking, tie resolution and configured home advantage against independent approved examples.
3. Cup metrics are 24/6/72 and 93 total; correct stage graph and 24-position bands; no 30-round domestic selector, domestic relegation text or promotion awards.
4. Both cups and a representative domestic division mount the same Stats presentation in public and DEV. Test Overview/Teams/Players content and switching, empty cards, actual-count Show all behavior, Escape/outside/close and focus restoration.
5. Verify direct routes, refresh, Back/Forward, invalid season fallback and Debug transitions 1→0→reload→1. No simulated progress/results in inactive state, no leaked domestic participants on cup routes.
6. Chromium matrix covers 320/390/768/1440, Dark/Light, five languages, keyboard and horizontal overflow. Inspect screenshots of actual panel content rather than only tab visibility. iPhone Safari remains a manual review step.
7. Run focused tests, generated-output checks, the complete site suite and exact-head CI. Publication isolation tests prove that public Stats imports no protected DEV sources. Deployment triggers and publication approval guard remain unchanged.

## Review result

Self-review: configuration ownership, versioning, historical behavior, cup source decisions, calendar boundaries, public/DEV separation, validation and acceptance criteria are specified. No product code is changed by this document. Next stage after owner approval is a written implementation plan with concrete file changes and ordered verification steps.
