# #769 economy recalibration — research slice 1 (DRAFT / HOLD)

No production code, accounting, payment, DB or deployment changes. No numerical wage model ratification. #770 is explicitly subsequent work.

## Source audit (2026-11-24)

- Main: d8db4910ade592462539c3b230e9b84a14baf917. The current main tree has the canonical generator, not the open valuation and Rewards implementations.
- #765 head `fac2ccc23984f25b45241508d2905221e7e543cf`: `backend/src/player-market-value.mjs` uses 10%, K=1226.223546184737, slope 2.5, two-season renewal, full paid fraction and no discount; no club capacity response. Its golden tests use old rate. Update this **single** production path only after numerical review; this research tool is not an alternative public calculator.
- #765 public projection allowlists `market_value_arc`; directory applies global sorting and inclusive filters before paging. Player header, Players, Club Roster and Transfers share locale-aware presentation. Tests with literal 4700 are formatting/UI examples, not model goldens. Keep API, width, locale and rounding behavior unchanged. Audit privacy against #764 private retirement seed projection when branches converge.
- #767 head `19b37af164a500a4ccb0cd1b22f58aa7a808d0ad`: 60M across 18 competitions, shares/points/placement apportionment; no salary commission or real settlement. No Rewards changes. #764 head `37e95ee9a58752ac7a4b8738fd9c7ccb737c9397` is private retirement generation, not public valuation input.
- #755, #763, #769 establish 5% included in gross paid wage; 95% to reserve with human agent; otherwise 100% reserve. No additional surcharge, no prize fee, no bonuses. Keep historical terms. Rate and research settings are versioned.

## Isolated first-stage trial

```powershell
node tools/economy-recalibration-769.mjs --self-test
node tools/economy-recalibration-769.mjs
```

The tool imports the canonical seeded generator and canonical role suitability, samples three 1,000-player entry cohorts, deduplicates roles, and reports salary and raw/rounded value quantiles by age and skill. It consumes no private aptitude or retirement seed. Growth and retirement arrays are pinned research snapshots from #765/#390; no hidden individual data or historical repricing. Only final displayed valuation is rounded upward.

Capacity example: 16 synthetic rank/points profiles per division; qualification probabilities total 3 per nation per cup, mutually exclusive; conditional entrants receive the mean cup reward as an expectation, not guaranteed money. Domestic points/placement weights follow #766. Equal-weight future club contexts are deliberately a neutral sensitivity, not a skill-conditioned fitted model or international qualification rule. No assumption that every club qualifies. The two division floors apply after capacity scaling; opening AI premium 1.25 is a separate ask, not a multiplier on public value or automatically accepted wages. Model K=1500/slope=2 against K=1250, flatter and steeper slopes; full employment and 75% combined paid/employed stress are scenarios, not empirical estimates.

### Rate-only control (same wages/probabilities, skill 60, no versatility)

| Age | Previous raw 10% | New raw 5% | New display |
|---:|---:|---:|---:|
| 16 | 4147.935618 | 2073.967809 | 2100 |
| 24 | 1879.241387 | 939.620693 | 940 |
| 32 | 589.798344 | 294.899172 | 300 |
| 39 | 122.622355 | 61.311177 | 62 |

### Preliminary standardized wage sensitivity (skill, no versatility; $ARC)

| Skill | Historical | K1500 slope 2 | Slope 1.6 | Slope 2.5 |
|---:|---:|---:|---:|---:|
| 40 | 196.20 | 750.00 | 750.00 | 750.00 |
| 50 | 490.49 | 787.78 | 903.20 | 750.00 |
| 60 | 1226.22 | 1384.60 | 1384.60 | 1384.60 |
| 70 | 3065.56 | 2769.19 | 2215.35 | 3461.49 |
| 80 | 7663.90 | 5538.38 | 3544.56 | 8653.72 |
| 90 | 19159.74 | 11076.76 | 5671.30 | 21634.30 |

The pure reference checks and tables were executed in isolated JavaScript before commit. The repository CLI/generator-backed cohort and exact-head CI have **not** been executed in that environment. No claim of a complete cohort or world result.

## Next research slices (not implemented here)

1. Execute and review seeded cohort output; estimate skill-conditioned future club/league/qualification and employment/collection distributions, distinguish opening AI requests and accepted salaries, test discount and versatility, review growth saturation. No final salary scale yet.
2. Build a 30+ season synthetic world simulation: 256 active clubs, 18 competitions, 768 generated candidates per season, explicit purchase probability/catalog, promotion/relegation, qualifying outcomes, contract renewals and retirement, squad sizes, agent coverage 0/25/50/75/100%, negotiation rejection, payroll timing, arrears, partial payment, staff/other costs and transfer activity. No automatic bailout or forced full employment. Compare fresh issuance vs reserve recycling and actual currency retirement; track club/agent/reserve balances, liquidity/defaults/concentration and reconcile conservation every period. Separate actual EUR revenue/cost assumptions; no conversion or guaranteed return.
3. Review accounting alternatives for deterministic integer split, cumulative installments, earned mandate attribution, arrears and idempotency. Settlement code is separately authorized; no live accounting changes.
4. Present owner review of the distributions, parameters and updated #765 fixtures; only then integrate approved research into #765. #770 consumes completed salary/value and currency-flow evidence; do not select monetization fees here.
