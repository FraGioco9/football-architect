# A06-05 — Fail-closed and negative test scenarios

**Issue:** #268 / A06-05. **Baseline main:** `1726652c81f1bb93111d4f327ccad4f82de11fd9`.  
This specification assigns concrete negative cases to existing owners and reusable tests. It does **not** claim every scenario below has already been executed.

## Scenario matrix

| ID | Boundary | Negative/control cases | Required observable outcome | Reuse / owner suite |
| --- | --- | --- | --- | --- |
| N01 | A01 identity → provider request | Unknown or noncanonical competition ID; season 0/negative/string; malformed request scope or empty request ID | Reject before provider source I/O; no fallback identity | `tests/provider-contract.test.mjs`, `tests/world-catalog.test.mjs` |
| N02 | A04 response → request correlation | Wrong provider, competition, season, scope, request ID or context revision; unsupported schema; extra malformed JSON/cyclic values | Reject envelope; do not publish data from the mismatched request | `tests/provider-contract.test.mjs` |
| N03 | A04 status/data coherence | `empty` or `unavailable` with non-null data; `available/partial` without valid data; incoherent reason/provenance/coverage | Return the existing fail-closed invalid/unavailable contract; never convert invalid data into ordinary no-results | `tests/provider-contract.test.mjs`, `tests/static-provider.test.mjs` |
| N04 | A04 provenance | DEV marked approved; unknown/unapproved historical source; historical sourceRef mismatch; partial coverage used for canonical History | No verified historical payload is accepted; expected unavailability remains distinct from empty | `tests/provider-contract.test.mjs`, `tests/verified-history-provider.test.mjs` |
| N05 | A04 error taxonomy | Typed `ProviderSourceError`; unexpected source `TypeError`; validator itself throws, even a typed error | Only expected source failure maps to `unavailable/source-unavailable`; programming/validator errors propagate | `tests/provider-contract.test.mjs` |
| N06 | A04 request lease → consumer commit | Request A delayed; B becomes current; A succeeds, fails, or resolves after provider/view revision change. Include ABA progress and disposed owner | A must not overwrite, clear, or replace B and must not change B's loading/error state | `tests/provider-contract.test.mjs`, `tests/a04-11-isolation-boundary.test.mjs` |
| N07 | A05 clock normalization | Missing snapshot, malformed object, untrusted provenance, season <= 0, day 0/57, noninteger day, supplied lifecycle states | Missing clock yields null current/relative state; malformed/untrusted state rejects; never infer completion | `tests/world-clock-adapter.test.mjs`, `tests/a05-10-clock-competition-adapter.test.mjs` |
| N08 | A05 clock → scoped competition projection | Unknown competition ID, stale clock season, cross-cup final, missing snapshot, future/past viewed season | Fail closed on unknown ID; retain only owned events; no invented outcome and no mutation of global snapshot | `tests/a05-10-competition-projection.test.mjs`, `tests/a05-10-final-consumer-evidence.test.mjs` |
| N09 | A02 history/rules → A04 dataset | Corrupt/mismatched rules snapshot, incomplete canonical historical player records, invalid participants or outcomes | Reject without silently repairing/rewriting snapshots; prior valid dataset remains unaffected | `tests/competition-stats-provider.test.mjs`, `tests/competition-history.test.mjs`, `tests/competition-season-rules.test.mjs` |
| N10 | A04/A05 → public artifact | Protected DEV provider/clock imported by public runtime; nonallowlisted file; generated output drift or unresolved template token | Publication check fails closed; no protected file enters public output; check mode does not rewrite artifacts | `tests/publication-gate.test.mjs`, `tests/a05-11-dev-publication-boundaries.test.mjs`, `tests/a05-12-final-generator-ci.test.mjs` |

## Execution and evidence rules

1. Reuse the owning suite first. Add a new executable case only when the existing test does not cover the named outcome or a concrete interleaving.
2. Every rejection case must include a valid control case and assert observable behavior (rejection, `null`, unavailable reason, or unchanged prior state), not merely a source-text pattern.
3. For stale async behavior, assert both sides: the new current request is committed, and late success **and** late failure from the old lease are discarded without clearing the newer view.
4. For provider boundaries, distinguish expected source failure from unexpected exceptions; do not wrap all exceptions as empty/unavailable.
5. For historical data, preserve the difference among no records, partial fictional DEV data, invalid canonical data and a verified completed season.
6. For world time, distinguish scheduled/reached/past/future from played/live/completed. Neither day advancement nor the DEV source authorizes sports results.
7. For publication, test the independent allowlist and inspect the generated artifact set. Workflow existence or a string appearing in a workflow is not by itself evidence of a deploy.
8. Record exact commit SHA, per-case test ID, actual CI run links and PASS/FAIL/NOT RUN on #268. A red test stays red until fixed or explicitly documented as an unrelated existing environment failure; no broad flake waiver.

## Prioritized uncovered evidence

Existing tests already cover many entries in N01–N10. Prioritize only residual gaps that can be demonstrated on the current HEAD:
- latest lease wins when an **old source failure** resolves after the newer request is committed;
- source/validator error distinction through the complete `createProvider().read()` operation;
- rejected invalid clock events leave the last valid World Progress unchanged;
- negative publication check rejects protected source from the candidate artifact set.

Do not duplicate already-passing primitives or build a Cartesian product of all providers × routes × locales × clock days. A06-08 owns full seasonal/stale-async integration; A06-12 owns final evidence reconciliation.

No runtime, test, generator, publication guard, workflow, database or deployment changes are included in this specification-only lot.
