# A06-12 Behavioral Evidence Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this approved test-only lot inline.

**Goal:** Supply the missing X04/X07/X09 behavioral evidence for issue #268.

**Architecture:** Extend existing Fixtures VM and real Chromium tests. Exercise shipped consumers through their actual event handlers, routing and context APIs; control only timing and supplied fixtures. Do not alter application behavior.

**Tech Stack:** Node test runner, existing VM DOM fixture, existing Chrome/CDP loopback harness.

**Spec:** Issue #268 final audit and `docs/architecture/a06-04-cross-contract-integration-matrix.md`.

## Global Constraints

- Test-only changes; no runtime, data, generator, publication, workflow, deploy or DB changes.
- Preserve accepted A02/A03 exceptions and A04 bounded baseline; do not reopen SEARCH-16.
- One Draft/HOLD PR; a later merge requires separate authorization.
- CI uses Node 22 and actual Chromium on the exact proposed commit/integration.

## Review Focus

- A missing clock listener must be detected by the actual Fixtures UI state.
- Cup-specific final days must not be substituted across competitions.
- An old-season or unavailable clock must not expose a current-round action.
- Advancing world time must leave viewed season and populated canonical History unchanged.
- Back/Forward, reload and competition changes must not permit obsolete success or source-failure publication.

### Task 1: Fixtures clock-event behavior

**Files:** Modify `tests/competition-fixtures.test.mjs`.

**Interfaces:** Existing `setup()` exposes the real mounted Fixtures controller, captured event listeners, route and rendered fields. Supply real `world-calendar-model` projections.

- [ ] Mount each international cup with supplied participants/matches; invoke its registered `fa:world-clock-snapshot` listener.
- [ ] Assert valid current-round control/click, distinct final-day ownership, null/invalid/wrong-season snapshots, changed viewed season and byte-unchanged provider data/rendered scores.
- [ ] Run `node --test tests/competition-fixtures.test.mjs`; expect PASS on existing behavior. Characterization adds no missing production feature.
- [ ] Temporarily remove the clock-event update in scratch, run the new test and require a relevant assertion failure; restore production bytes and rerun PASS.

### Task 2: Historical browser interleaving

**Files:** Modify `tests/a04-provider-baseline-evidence.test.mjs` inside the existing real-browser parent.

**Interfaces:** Reuse `visit`, `cmd`, `run`, `wait`, `snapshot`, context `replaceSeasonData`, route API and canonical History API.

- [ ] Open and reload a historical Fixtures deep link; mount approved canonical History and positive supplied season data.
- [ ] Capture delayed success and source-failure branches against actual context revisions; advance a world snapshot while historical data is mounted.
- [ ] Assert unchanged viewed season, URL and canonical History; traverse actual browser Back/Forward across views and a provider revision change, rejecting old work after return (ABA). Public competition season availability stays unchanged; #313 separately covers season-changing provider leases.
- [ ] Navigate to another competition and release old-document work; assert no overwrite of the new document or History.
- [ ] Run the browser parent with real Chrome, then temporarily bypass the production revision guard and require the new regression to fail; restore bytes and rerun PASS.
- [ ] Run full CI Site checks and Chromium, record counts and exact SHAs; no skipped browser proof.

### Delivery

- [ ] Review the complete diff and mutation results; only the two test files and this plan may change.
- [ ] Open a Draft/HOLD PR and update #268 with actual evidence. Keep A06-12 pending integration; do not merge or close the program in this lot.

## Execution evidence and boundaries

- Local full suite: 577/577 PASS, zero failures/skips, Node 24 / Chromium 153. Final review refinements were also rerun in the owning suites: Fixtures 19/19 and the real-browser parent 7/7 PASS. Exact-commit CI on Node 22 is the delivery gate; these local results do not substitute for it.
- Mutation proofs: disabling the actual Fixtures clock update fails its positive current-round assertion; hardcoding the cup projection to `int-1` fails the positive `int-2` final assertion; removing the real context revision guard fails the new browser stale-publication assertion. All production bytes were restored; no mutation is part of the proposed diff.
- Independent read-only review found one missing positive second-cup final control. Added day-52 final navigation for both cups, retaining day-53 divergence, and verified the wrong-cup mutation fails.
- Browser ABA uses public view navigation plus actual provider revision invalidation; public season availability remains unchanged. Merged #313 supplies separate cross-season lease evidence.
- After navigation to another competition, the test observes the old source response settling or being aborted and verifies the new document stays isolated. It does not claim that an old-document callback executes; same-document obsolete success/unavailable publication is independently awaited and rejected by the real revision guard.
- Direct generator check: 23/23 pages plus competition manifest, club template and club manifest match. Existing CSV line-ending status noise is not staged; raw CSV bytes equal the base commit.
