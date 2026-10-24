# ARCH-CLEAN-02 — PR-01 Baseline & Contract Tests

Status: **Draft/HOLD — tests and documentation only**. Tracking: [issue #268](https://github.com/FraGioco9/football-architect/issues/268).

## Baseline

- Starting main commit: `b73904d8f7dae3cf0fd01496401415c1408454ec`.
- Frozen specifications: A01–A06 v1.0 (design-only approvals; authoritative checklist in issue #268).
- Existing suite at the baseline: 55 `tests/*.test.mjs` files.
- Approved constraints: no production/source changes, no changed fixtures, no generator or workflow changes, no hosting/publication changes, no merges, no deployments, no DB operations.

## Contract matrix

| Contract | Baseline assertions | Existing regression coverage |
|---|---|---|
| A01 | 320 clubs, eight countries, 16 divisions, 256 provisional allocations, 64 unallocated, 352 rivalries | `division-allocations.test.mjs`, `club-pages.test.mjs` |
| A02 | Three versioned rule profiles across 18 competitions; historical fail-closed | `competition-rules-model.test.mjs`, `competition-season-rules.test.mjs` |
| A03 | 16 domestic routes, 320 × five club views, 29 redirects, seven rewrites | `subpage-routes.test.mjs`, `app-canonical-routes.test.mjs` |
| A04 | Provider isolation and validated historical rules | `competition-stats-provider.test.mjs`, `world-competition-runtime.test.mjs` |
| A05 | 56 calendar days; N01–N33, I01–I12, two finals; deterministic projections | `world-calendar-model.test.mjs`, `world-clock-adapter.test.mjs` |
| A06 | Allowlisted public artifact; invalid routes fail closed | `publication-gate.test.mjs`, `g10-public-02-content.test.mjs` |

## Added tests

- `tests/arch-clean-02-baseline.test.mjs`: existing canonical cardinalities and structural invariants.
- `tests/arch-clean-02-integration.test.mjs`: existing route identity, cup rules, historical rule resolution, calendar projections.
- `tests/arch-clean-02-security.test.mjs`: existing hosting configuration, public allowlist, invalid routing, clock lifecycle safeguards.

The first PR **does not implement** proposed registries or providers. No test should require unimplemented A01–A05 APIs. The baseline should compare existing observable behavior, and later implementation PRs must preserve or explicitly approve differences.

## Temporal mapping caveat

The approved 43 abstract sports slots are not identical to the 56 world days. Current implementation records national markers N01–N33, international markers I01–I12, and final markers FEDERATION-FINAL at day 53 and SOVEREIGN-FINAL at day 54. Record this discrepancy for a separate design decision, **never correct it as part of PR-01**.

## Validation and evidence requirements

1. `node --test --test-concurrency=1 tests/*.test.mjs` on Node 22.
2. `node tools/generate-app-pages.mjs --check`.
3. Relevant Chromium browser tests: verify real Chrome execution rather than inferred green Node checks.
4. Site checks CI verified against the exact PR head SHA (and not an earlier SHA).
5. Review changed filenames: precisely these three test files and this documentation file.
6. Publication guard must remain unmodified; no DEV code or fictional results may enter public output.
7. Record PASS/FAIL/NOT RUN truthfully in [issue #268](https://github.com/FraGioco9/football-architect/issues/268); do not mark A01–A06 feature checkpoints completed merely because test scaffolding is added.

No action here authorizes merge, deployment, or database changes.
