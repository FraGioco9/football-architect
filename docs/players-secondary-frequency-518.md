# PLAYERS-GEN #518 — Secondary-position frequency, approved A and calibration evidence

**Status:** Owner approved **A** on 12 November 2026. Canonical Node generator and generated Worker core now use A for unconstrained automatic outfield counts. This document distinguishes source-backed probabilities from empirical seeded outcomes; exact-head CI and merge acceptance remain separate.

## Source audit (12 November 2026)

- Canonical function: `secondaryPositions` in `tools/players-generation-trial.mjs`. The Worker copy in `backend/src/players-generator-core.mjs` is **generated** by `tools/build-players-runtime.mjs`; do not edit it independently.
- Historical outfield count weights **[25, 35, 25, 11, 3.5, 0.5] percent** for 0, 1, 2, 3, 4, 5. **Approved A, now active:** **[45, 35, 15, 4, 0.9, 0.1] percent** (before normalizing counts to compatible available positions). Exported as `AUTO_SECONDARY_COUNT_WEIGHTS` from both canonical Node and generated Worker modules.
- The primary-position weights total 100, with GK weight 9%; GK always gets 0 secondary positions. For other roles, default selection is weighted without replacement among the existing compatibility groups, with preference adjustments for the foot. No new role IDs are necessary.
- Explicit `secondaryPositions` (manual exact array) and `secondaryCount` (exact count) bypass the automatic count distribution. `allowedSecondaries` filters the eligible role pool before weighted selection.
- Admin `previewPlayerGeneration` invokes the same canonical generated Worker core, then stores a server-owned draft. `commitPlayerGeneration` persists that approved draft; no independent position-frequency draw happens at commit.
- **Existing contract gap (out of this calibration):** the Admin input validator rejects empty `secondaryPositions: []` even though the generator accepts it and the #390 manual-mode design allows zero. The Admin input supports exact `secondaryCount`, not the #390 proposed automatic min/max interval. Keep these distinct from reducing *automatic* frequency.

## Historical baseline versus approved A and unapproved B

These are **theoretical expectations**, not observed seed measurements. The pooled model assumes the canonical 9% GK / 91% outfield primary-position mixture; the actual diagnostic output must be examined before approval.

| 0–5 secondary positions | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Historical, outfield | 25% | 35% | 25% | 11% | 3.5% | 0.5% |
| Historical, all players (model) | 31.75% | 31.85% | 22.75% | 10.01% | 3.19% | 0.46% |
| **A: approved and active, outfield** | 45% | 35% | 15% | 4% | 0.9% | 0.1% |
| **A: approved and active, all players (model)** | 49.95% | 31.85% | 13.65% | 3.64% | 0.82% | 0.09% |
| B: not approved, outfield | 55% | 32% | 10% | 2.5% | 0.45% | 0.05% |
| B: not approved, all players (model) | 59.05% | 29.12% | 9.10% | 2.28% | 0.41% | 0.05% |

**Owner decision: A approved.** It reduces the mathematical automatic outfield rate with 2+ secondaries from 40% to 20%, retaining the maximum of five. B would reduce it to 13% but is NOT approved or active. The count distribution is conditioned on available compatible positions; seeded observations remain authoritative for actual counts.

## Reproducible observation

Run on a checkout with catalog data using Node 22:

```bash
node tools/players-secondary-frequency-audit.mjs
node tools/players-secondary-frequency-audit.mjs --json
node --test tests/players-secondary-frequency-audit.test.mjs
node tools/build-players-runtime.mjs --check
```

The audit generates three cohorts of 1,000 players with existing Phase-1 seeds, reporting 0–5 counts overall, by seed, among outfield players and by each primary role. The script writes no files and does not persist candidates. Check seed-to-seed variability and any eligible-role normalization before treating the model predictions as observed frequency. Note that changes to count frequency change the population eligible for #399's secondary-fit measurement; preserve the specialist/versatile attribute algorithm and review population-level outcomes separately.

## Implementation and QA gates

- [x] Owner approved numerical distribution A (2026-11-12).
- [x] Canonical Node generation and generated Worker use A; no extra draw at Admin preview approval or persistence.
- [x] Dedicated regression covers exact manual choice, fixed secondary count, GK restriction, seeded automatic 3×1,000 cohort frequency and role grouping. Worker source parity has a separate mandatory test.
- [ ] Review exact-head seeded report and existing #399 fit calibration; do not silently change specialist/versatile weights, attribute distributions, suitability model or existing persisted footballers.
- [ ] Verify CI and obtain separately authorized merge; no remote DB/deploy or new migration.
