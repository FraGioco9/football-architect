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
