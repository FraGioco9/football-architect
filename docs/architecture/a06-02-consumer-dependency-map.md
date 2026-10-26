# A06-02 — Cross-contract dependency and consumer map

Baseline: `main` `3520bcbb32edfa83af7ecde970eea8f4f56770d9` after A05-12. This is an inventory of existing ownership and observable boundaries, **not** an authorization to make consumers derive verified results from world time.

| Producer / owner | Public boundary | Direct consumers / surfaces | Proof and failure boundary |
| --- | --- | --- | --- |
| A01 competition identity and catalogue | `assets/world-catalog.mjs`, `assets/competition-model.js` | Competition page, competition rules, fixtures and routing | `tests/arch-clean-02-baseline.test.mjs`; unknown identity fails closed |
| A02 rules, seasons and archive | `assets/competition-rules.js`, `assets/competition-rules-view.js` | Competition tabs, Fixtures navigation, Stats and History views | `tests/competition-season-rules.test.mjs`, `tests/competition-rules-model.test.mjs`; viewed season does not change canonical history |
| A03 canonical routes | `assets/subpage-routes.mjs`, `assets/routes-registry.mjs`, `assets/routes-registry.js` | Competition, club and calendar deep links | `tests/subpage-routes.test.mjs`, `tests/app-canonical-routes.test.mjs`; invalid links and legacy redirects retain explicit semantics |
| A04 providers and selectors | `assets/provider-selectors.mjs`, `assets/provider-selectors-bootstrap.mjs` (public); provider implementations remain protected | Competition context, Stats and History canonical records, public empty states | `tests/a04-11-isolation-boundary.test.mjs`, `tests/competition-stats-provider.test.mjs`, `tests/a05-10-final-consumer-evidence.test.mjs`; selectors do not simulate fixtures or fabricate records |
| A05 immutable 56-day schedule | `assets/world-calendar-model.js` | `assets/world-clock-adapter.js`, global `assets/world-calendar.js`, competition-scoped `assets/competition-fixtures.js` | `tests/world-calendar-model.test.mjs`, `tests/a05-10-competition-projection.test.mjs`; marker reached is not verified completed |
| A05 clock snapshot normalization | `assets/world-clock-adapter.js` (public read-only) | World Calendar global day context and separate competition projections; Fixtures navigation consumes a scoped projection | `tests/world-clock-adapter.test.mjs`, `tests/a05-10-clock-competition-adapter.test.mjs`; null clock means unavailable, untrusted lifecycle is rejected |
| Protected DEV source | `tools/dev-world-clock.mjs`, `tools/dev-standings-preview-client.mjs` (never public artifacts) | DEV session and its emitted `fa:world-clock-snapshot` event | `tests/a05-08-dev-world-integration.test.mjs`, `tests/a05-11-dev-publication-boundaries.test.mjs`; Season 0 emits null and forbids day advancement |
| Publishing | `tools/publication-guard.mjs` | Checked-in static pages and allowlisted public assets only | `tests/publication-gate.test.mjs`, `tests/a05-11-dev-publication-boundaries.test.mjs`; fail-closed DEV exclusion |

## End-to-end consumer ownership

- **Fixtures** — uses `faWorldCalendarModel.projectCompetition(viewedSeason, definition.id)` for competition-scoped navigation, and `currentFixtureChoice` with an explicit clock snapshot. Match results remain owned by the data provider.
- **Calendar** — uses `faWorldClockAdapter.project(1, snapshot)` to display the **global** 56-day timeline. Its global scope must not be replaced by a single-competition selector.
- **Stats** — validates `context.seasonData` and `selectedSeason`. Clock days must not produce played matches, goals or player statistics.
- **History** — accepts canonical records through `applyCanonicalHistory(payload)` after `compute(payload)` validation. Viewed historical seasons are read-only; reaching a world day does not authorize completion.

## Dependencies to retain in A06-03 through A06-12

1. **Identity → route → definition → view:** assert canonical IDs, route parsing/building and season query semantics together.
2. **Clock snapshot → normalization → scoped projection → Fixtures:** test day/season bounds, Season 0, missing snapshot, new and stale clock events, and matching competition IDs. Only the navigation target may change; scores may not.
3. **World projection → Calendar:** verify the 56-day global display, separate viewed season and future/past labels without simulated results.
4. **Provider → selectors → Stats/History:** test canonical revision and input validation; stale, missing or invalid data must fail closed independently of clock movement.
5. **Source files → generated static shell → publication allowlist → browser:** run the generator parity check, Node suite, desktop/mobile and language Chromium coverage, exact-head CI; DEV files remain excluded.

## Explicit evidence limits

This document maps checked-in code and existing tests. It does not assert that every stale-async/revision interleaving or negative provider transition has already been exercised end-to-end. A06-03 (suite specification), A06-04 (cross-contract matrix), A06-05 (negative scenarios), A06-08 (temporal and stale async integration) and A06-12 (final audit) remain independent acceptance gates. No deployment, DB operation or publication modification is authorized.
