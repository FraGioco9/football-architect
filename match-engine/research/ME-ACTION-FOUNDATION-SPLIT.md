# Action foundation extraction from PR #481

**Scope:** safe first slice of the action-first roadmap in [#620](https://github.com/FraGioco9/football-architect/issues/620), tracked from [#480](https://github.com/FraGioco9/football-architect/issues/480).

This **does not merge #481** or replace its physical 22-player Rapier runtime. PR #481 remains Draft/HOLD, and action-LAB PR #621 remains stacked on it for now. The goal is to land small, testable foundation pieces before reviewing the wider, mixed physical/tactical implementation.

## Copied without behavioral edits from #481

- `src/player-ball-uniform-autonomous-action.mjs`: pure candidate selection for physical PASS, SHOT, CLEARANCE and bounded CARRY from structurally consistent canonical player positions and the reported exclusive same-tick shoe-START/ACTIVE. Includes original lane/range checks and deterministic frozen metadata.
- `src/player-ball-action-outcome-observation.mjs`: read-only provisional action/receiving/opposition contact evidence over observed later ticks. Never awards an official completed pass, tackle, goal or possession.
- `tests/player-ball-uniform-autonomous-action.test.mjs`: full existing pure source-bound contract/regression tests, registered with the existing `npm --prefix match-engine test` command.

**Critical provenance boundary:** these exported pure functions cannot authenticate Rapier colliders from caller-supplied shapes. A proposed action or recorded geometric lane cannot cause a physical shoe START, apply an impulse or authorize match results. No runtime integration is added in this small PR. That requires the separately audited **private closed Rapier producer** and tests in a subsequent small extraction.

## Deferred (do not silently bring across)

- 22-player physical fixture/world and backend calendar bridge, to be split by physical authority and ownership.
- Legacy movement AI, PRESS/COVER and natural-11v11-shot experiments, P1/P2 intent advisers and tactical thresholds.
- Research-heavy historic diagnostics and reports, to keep accessible on #481 until explicitly reduced.
- Action LAB #621 base retargeting, until its real physics APIs exist on a merged foundation.

## Acceptance

- [ ] Exact-HEAD targeted test and current main regressions pass.
- [ ] Verify source files are byte-for-byte identical to #481 at `82bf5d8`.
- [ ] Subsequent physical runtime extraction preserves genuine Rapier provenance and the five verified action LAB scenarios.
- [ ] Keep the foundation and both existing PRs Draft/HOLD until a distinct merge authorization.

Progress in #480 stays 11/20; a green contract test is **not** a new accepted C2/C3/C4 physical action.
