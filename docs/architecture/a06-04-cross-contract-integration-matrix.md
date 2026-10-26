# A06-04 — Cross-contract integration test matrix

**Baseline main:** `51439dbf743ff417e561e08fea38fb67d162c6dd`. **Issue:** #268 / A06-04. This matrix maps interactions that cross contract boundaries. It is an acceptance specification; it does not claim that any not-yet-executed case is already covered.

## Required interactions

| ID | Boundary path | Cases required | Existing reusable evidence | Acceptance / failure mode |
| --- | --- | --- | --- | --- |
| X01 | A01 identity → A03 route → A02 definition | Canonical domestic ID, each international cup ID, unknown ID, legacy alias, query-based viewed season | `tests/world-catalog.test.mjs`, `tests/subpage-routes.test.mjs`, `tests/app-canonical-routes.test.mjs` | Correct identity survives round-trip; unknown identities fail closed, no substitution |
| X02 | A02 season/rules → A04 provider request → A04 validated response | Matching season+rules version, mismatched version, bad competition identity, malformed response | `tests/provider-contract.test.mjs`, `tests/competition-season-rules.test.mjs`, `tests/competition-stats-provider.test.mjs` | Mismatch rejected before commit; no stale season data presented as current |
| X03 | A04 provider lease/revision → consumer commit | Response delayed across a new view, invalidation, or competition switch; response resolves out of order | `tests/provider-contract.test.mjs`, `tests/a04-11-isolation-boundary.test.mjs` | Consumer commits only if its exact lease remains current; old completion cannot overwrite current view |
| X04 | A05 world snapshot → adapter → scoped projection → Fixtures navigation | Valid day, unavailable clock, Season 0, changed viewed season, wrong season snapshot, competition changes, stale clock event | `tests/world-clock-adapter.test.mjs`, `tests/a05-07-world-equivalence.test.mjs`, `tests/a05-10-competition-projection.test.mjs`, `tests/a05-10-final-consumer-evidence.test.mjs` | Navigation remains competition-scoped; invalid/missing snapshot returns no current choice; never changes score/results |
| X05 | A05 global projection → Calendar UI | 56-day baseline, historical/current/future viewed season, no clock, current-day update | `tests/world-calendar-model.test.mjs`, `tests/world-calendar-ui.test.mjs`, `tests/world-calendar-navigation.test.mjs` | Calendar keeps all global events and changes only temporal labels; no single-competition filter or inferred completion |
| X06 | A04 validated statistics → Stats display | Valid canonical empty response, valid populated response, invalid payload, season/rules mismatch, older revision | `tests/competition-stats-provider.test.mjs`, `tests/competition-stats-view.test.mjs`, `tests/a05-10-final-consumer-evidence.test.mjs` | Empty stays empty; invalid stays fail-closed; no clock-generated zeros, scorelines or player data |
| X07 | A04 canonical history → History view | Approved records, no approved records, malformed/partial records, past viewed season, current clock advancing | `tests/competition-history.test.mjs`, `tests/competition-season-history-view.test.mjs`, `tests/a05-10-final-consumer-evidence.test.mjs` | Historical record set is independent of clock; only verified records can mark a season completed |
| X08 | A04/A05 public module → static generator → publication guard | Required public allowlist entry, protected DEV/provider module, generated HTML drift, unresolved template marker | `tests/publication-gate.test.mjs`, `tests/a05-11-dev-publication-boundaries.test.mjs`, `tests/a05-12-final-generator-ci.test.mjs` | Public projections stay allowlisted; protected modules stay excluded; generator drift fails check without write mode |
| X09 | A03 routing + A05 viewed season + A04 data revision | Refresh/deep-link to historical season while a newer world snapshot arrives; browser back/forward; competition route change | `tests/calendar-season-link.test.mjs`, `tests/subpage-routes.test.mjs`, `tests/world-calendar-navigation.test.mjs` | Viewed season and route remain stable, stale async response discarded; no resimulation |
| X10 | Desktop/mobile/five languages → rendered consumers | 1440/390/320, dark/light, EN/DE/ES/FR/IT, keyboard navigation, empty/unavailable data | `tests/int24-browser-qa.mjs`, `tests/theme-browser.test.mjs`, relevant `world-calendar-*browser.test.mjs` | Real Chromium execution with reports/screenshots; layout/accessibility regressions fail visibly |

## Execution order and boundaries

1. Run small unit/contract cases (X01–X03, X08), reusing owning suites.
2. Run focused temporal/consumer integration (X04–X07, X09); add only the uncovered interleaving or failure mode needed for changed behavior.
3. Run actual Chromium and generated-page parity after functional tests (X10); preserve exact-head SHA assertions.
4. Record each ID as PASS, FAIL or NOT RUN with a specific evidence link on issue #268. A source-regex assertion alone is inventory evidence, not end-to-end runtime proof.

## Explicit exclusions and caveats

- No Cartesian product of every route × locale × clock day × provider state; use representative boundaries and targeted cases.
- Reaching a calendar day never constitutes played/finalized evidence. No simulation, artificial zero results, new source of data or wall-clock fallback.
- DEV Season 0, fictional provider and world-clock storage remain outside public publication.
- This PR only specifies the matrix. A06-05 owns focused fail-closed cases, A06-08 owns actual seasonal/stale-async execution coverage, and A06-12 audits all acceptance evidence.
- No runtime, generator, publication guard, workflow, deploy or DB change is included.
