# A06-03 — A01–A05 unit and contract test-suite specification

**Baseline main:** `b5cbe4e831c4f1161d3bbda5bb6b64132d54acc3`. **Issue:** #268 / A06-03. This is a test plan, not a statement that unimplemented test coverage already exists.

## Existing reusable test suites

| Contract | Existing focused tests | Primary invariants |
| --- | --- | --- |
| A01 — catalogue and identity | `tests/arch-clean-02-baseline.test.mjs`, `tests/world-catalog.test.mjs`, `tests/competition-model.test.mjs` | Canonical identities, cardinality, valid/unknown IDs fail closed |
| A02 — rules and history | `tests/competition-rules-model.test.mjs`, `tests/competition-season-rules.test.mjs`, `tests/competition-stats-provider.test.mjs`, `tests/competition-history.test.mjs` | Season/rules version binding, only canonical completed history, empty versus invalid data |
| A03 — routes | `tests/subpage-routes.test.mjs`, `tests/app-canonical-routes.test.mjs`, `tests/calendar-season-link.test.mjs` | Deep links, canonical paths, redirects/query preservation, invalid route rejection |
| A04 — provider contract | `tests/provider-contract.test.mjs`, `tests/static-provider.test.mjs`, `tests/verified-history-provider.test.mjs`, `tests/provider-selectors.test.mjs`, `tests/a04-11-isolation-boundary.test.mjs` | Request/response validation, provenance, lease/revision validity, typed source failures, no cross-provider fallback, publication separation |
| A05 — world time | `tests/world-calendar-model.test.mjs`, `tests/world-clock-adapter.test.mjs`, `tests/a05-07-world-equivalence.test.mjs`, `tests/a05-08-dev-world-integration.test.mjs`, `tests/a05-10-clock-competition-adapter.test.mjs`, `tests/a05-10-competition-projection.test.mjs`, `tests/a05-10-final-consumer-evidence.test.mjs`, `tests/a05-11-dev-publication-boundaries.test.mjs`, `tests/a05-12-final-generator-ci.test.mjs` | 56-day schedule, immutable projections, relative season display, Season 0, separate world/view context, no inferred results, public/DEV boundary and generator parity |

Before relying on a named path in a change, confirm it exists on the tested HEAD. This catalogue intentionally reuses existing coverage rather than creating a duplicate golden corpus.

## Required test commands and acceptance gates

1. Unit/contract suite on Node 22: `node --test --test-concurrency=1 tests/*.test.mjs`; report exact test/pass/fail/skip counts.
2. Generated output parity: `node tools/generate-app-pages.mjs --check`; do not run a generator in write mode.
3. Browser suite: CI `INT-24 Chromium QA` on the exact commit; check screenshot/report artifacts and fail if browser launch is skipped or only simulated.
4. Full Site checks on the exact commit: check the exact-head assertion, landing contract suite, publication gate and generator checks actually executed by that workflow.
5. For provider or temporal code, preserve failing-input tests and show the test observes public contract behavior; source regex alone is not behavioral proof.
6. At least one authoritative linked run must reference the candidate's exact SHA. After merge, run IDs and new main SHA are recorded separately.

## Missing dedicated coverage to add only when a concrete change needs it

- A04 provider revision race: delayed response resolves after invalidation/new revision; it cannot overwrite current data or another competition's state.
- A04 error taxonomy: declared `ProviderSourceError` becomes unavailable; unexpected exception propagates.
- A05 transition lifecycle: invalid/no-op/current-day changes do not publish partial state or double-advance revisions; DEV storage rollback is tested with a failing storage adapter.
- A05 consumer behavior: real Fixtures clock event updates only its competition's navigation; Calendar stays global; Stats/History remain provider/canonical-data driven.
- Public/DEV negative route: unavailable/Season 0 cannot cause generated fixture outcomes; the publication allowlist excludes protected providers and DEV clock.

The items above are **gaps to cover as concrete changes reach them**, not claims they all lack any related test. Prefer a focused test in the existing owning suite where possible. Do not add every possible combinations matrix; require a test only for a new behavior or a concrete uncovered failure mode.

## Explicit exclusions

No changes to application runtime, generated assets, the publication guard, workflows, databases, or provider contracts in this test-plan checkpoint. Cross-contract integration matrix (A06-04), negative/fail-closed scenarios (A06-05), temporal/stale async execution (A06-08) and final audit (A06-12) remain separate acceptance gates.
