# DEBUG-DATA-01 — I04 initial protected reader block

Branch: `feat/debug-data-01-foundation` (PR #340, Draft/HOLD).

## Handoff from I03

The owner chose to proceed to I04 despite failing broad Node/browser regressions.
I03 is frozen, **not accepted or complete**. The full regression is deferred
to I06; no failing tests are reclassified as passing. Existing DEV/public UI
is unchanged; the experimental I03 renderer is still not injected.

## Implemented in this block

- `tools/debug-data-i04-reader.mjs` exposes a local-only factory with explicit
  `activate`, `read`, `history`, `close`, and source epoch tracking.
- Strict source namespace and dataset identity, season/day/competition checks,
  manifest/corpus validation before projection, and defensive output copies.
- In-flight reads are invalidated by source changes and Debug OFF. Projection
  results are cached per dataset, season, day, and competition within an epoch.
- History returns **unsealed candidate summaries only** for prior seasons;
  it never manufactures an authoritative D1 receipt or reports them as approved.
- Initial focused tests cover input rejection and epoch invalidation.

## Remaining I04 acceptance

- [ ] Complete pure projection/historical-seal semantics with a real, approved
      closure boundary and end-of-season visibility (not just candidate history).
- [ ] Ensure a second activation cannot mix an older pending loader with a new
      dataset; validate all race permutations and failed loads.
- [ ] Integrate the reader with the protected transport, preserving manifest
      hashes and avoiding repeated full-corpus generation.
- [ ] Exercise real S1–S5 fixtures and day redaction for all 18 competitions
      and historical boundaries (targeted I04 checks).
- [ ] Full I06 Node/browser/regression/performance gates remain deferred.

No public endpoints, deployment, remote D1, mail, or merge in this block.

## Second implementation block — concurrent loads and cached verification

- The source epoch now invalidates pending loads before they can be accepted
  into a newer dataset session, including changes between two Debug IDs.
- The manifest/export plan is validated once per successfully loaded dataset
  epoch, then reused by per-day projections instead of generating the 90-file
  plan for every day/competition request.
- A focused race regression covers old- and new-dataset pending promises.
- Failed loads do not publish data and can be retried on the next request.

**Still pending:** source-integrity tests against real generated S1–S5 data,
formal season completion/receipt semantics and complete temporal redaction
coverage, integration with protected transport, and final I06 regression.
The unsealed corpus remains non-runtime and does not feed public pages.

## Third block — defensive temporal and history boundaries

- A fragment must match the exact requested season and competition; every
  fixture day must be an integer within the 56-day world calendar.
- Day 56 alone is insufficient for a completed projection: every recorded
  fixture must have a result before final standings, champion and knockout
  tie summaries are exposed. Earlier days continue to redact future results
  and knockout participants.
- Historical summaries reject incomplete prior-season sequences. History is
  still **candidate-only**, never an authoritative historical seal or D1 receipt.

These are implementation guards, **not a passing acceptance report**. Broad
Node/browser failures from I03 remain deferred to I06 by owner decision;
targeted real-corpus projection verification is still required before I04
can be marked complete. No runtime cutover.

## Fourth block — focused reader regression cases

The isolated reader test suite now additionally checks invalid historical
boundaries, retry following a failed local load, and a history promise that
resolves after Debug OFF. These tests are committed as regression coverage,
but have **not been executed in this block**; no PASS claim is made.

The next remaining gate is a targeted execution against actual generated
S1–S5 corpus artifacts, plus transport integration and formal closure
semantics. The deferred I06 full suite is unchanged.
