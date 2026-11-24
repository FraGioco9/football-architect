# #769 economy recalibration — research slice 1 (DRAFT / HOLD)

> **Historical research — not current policy.** Later owner-approved #775 decisions take precedence. See [the current DRAFT v5 baseline](economy-approved-draft-v5.md) for EUR-only club acquisition, standardized base pricing, one-time individual genesis capital, optional purchased capital, reserve-first capped funding, zero initial personal wallets, and oldest-period-first proportional payroll. Numerical results below are preserved unchanged as evidence; they are not a rerun with the new ledger assumptions.

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

## Slice 2: executed cohort and 32-season synthetic world

Executed the repository numerical generator core in an isolated V8 runtime with placeholder identity banks (same name-sampling PRNG draw counts; no sporting attribute changes). Three seeds × 1,000 entries; full cohort distributions and annual simulation results in `docs/economy-recalibration-769-results.json`. The full repository CLI with actual catalog and CI still require independent verification. Reproduce in a repository checkout with `node tools/economy-world-769.mjs`. This world uses resampling from the seeded cohort for 768 annual candidates, not freshly generated individual cohorts. No real transactions or price assumptions.

World assumptions: 32 seasons, 256 clubs, 18 pools totaling 60M per season, synthetic strength ranking/points/advancement (not canonical sporting matches), 3+3 cup entrants per nation based on previous simulated ranks, two direct division swaps plus a stochastic playoff proxy. Exogenous purchase/activation, persistent unsold catalog, variable actual employment, 1–3 year terms, population growth and conditional retirement, negotiated wages/AI opening premium, free agency and bilateral transfer proxy. Staff/other virtual costs are paid into reserve; EUR receipts and costs are unknown. Initial club cash, recruitment target, acceptance and purchases are simulation inputs, not enforced game caps or actual checkout. Coverage targets are exogenous mandate probabilities, including hypothetical all-AI control after activation; no actual youth mandate sale rule is changed. Recycled reserve funds the next rewards pool; new issuance fills its shortfall. Burn is a separate sensitivity, not policy. Each period asserts exact reward, salary split and total stock conservation; unsettled wage obligations persist with their earned mandate attribution. Cumulative floor rounding is a research proposal only, not approved settlement; no production idempotency implementation. No automatic bailout. At day 28 first participation installments have both arrived before first payroll; remaining results credited by final payroll (aggregate timing proxy, not certification implementation).

| Scenario | Last 10-season mean wages paid | Mean agent commissions | Closing club stock | Closing reserve | Closing unpaid salary |
|---|---:|---:|---:|---:|---:|
| 0% / candidate / 25 slots / recycle | 19697998 | 0 | 1162678360 | 26167876 | 0 |
| 25% / candidate / 25 slots / recycle | 18976447 | 212118 | 1184581327 | 25012058 | 0 |
| 50% / candidate / 25 slots / recycle | 18305550 | 443855 | 1202536956 | 24382370 | 0 |
| 75% / candidate / 25 slots / recycle | 17963862 | 656908 | 1207491451 | 23767979 | 0 |
| 100% / candidate / 25 slots / recycle | 17265102 | 861094 | 1234958669 | 22465310 | 0 |
| 50% / candidate / 25 slots / issue | 18305550 | 443855 | 1202536956 | 704850885 | 0 |
| 50% / candidate / 25 slots / recycle + burn | 18305550 | 443855 | 1202536956 | 12191185 | 0 |
| 50% / candidate / 18 slots / recycle | 15926630 | 376732 | 1297766995 | 22149101 | 0 |
| 50% / candidate / 32 slots / recycle | 19565047 | 460323 | 1136970727 | 25544898 | 0 |
| 50% / candidate / 25 slots / recycle stress | 3691520 | 89602 | 772385683 | 34690050 | 0 |
| 50% / lower-base / 25 slots / recycle | 15254622 | 369693 | 1291052670 | 21278795 | 0 |
| 50% / steeper / 25 slots / recycle | 25830157 | 628577 | 1005864662 | 32335049 | 0 |

Remaining: fit skill-conditioned future club capacities and empirical employment distributions, independent random seeds, fresh annual canonical cohorts and role-balanced squads, separate purchase/mandate economics in #770, further accounting tests (duplicate settlement identities, ownership boundaries), actual repository CLI and CI evidence, owner review. No public valuation integration.

## Slice 3 — fresh annual cohorts, group matching and liquidity stress

`node tools/economy-world-stress-769.mjs` (isolated research). 10 scenario configurations × 3 world seeds × 32 seasons; 24,576 fresh annual profiles generated by the numerical generator, plus 3,000 bootstrap profiles. Same fresh generation sequence for comparable world runs. Executed in isolated V8 with synthetic identity placeholders; repository CLI remains unverified. Reproducible compact observations and annual evidence in `docs/economy-recalibration-769-stress.json`. First-stage historical figures above remain historical; do not mix model versions. Group targets GK/DEF/MID/FWD are recruitment preferences, not a sporting rule or mandatory squad cap. Initial squads are hypothetical bootstrap, and fresh candidates remain catalog entries until exogenous activation. No actual purchases or real payments. Staff debts are carried separately, wages retain earned mandate; cash may reach zero but never negative, no bailout. Stress wages and staff are exogenous hypothetical cost multipliers, not approved prices or caps. Results are three-seed sensitivity, not empirical world forecasts.

| Case | Mean closing club stock | Mean last-10 annual paid wages | Mean closing employed | Mean closing median squad | Peak clubs unpaid at day 28 | Peak clubs unpaid at season end | Peak salary arrears |
|---|---:|---:|---:|---:|---:|---:|---:|
| base | 1098199090 | 22583837 | 6075 | 24.0 | 0 | 0 | 0 |
| low staff / small squad | 1240098772 | 18156242 | 4328 | 17.0 | 0 | 0 | 0 |
| large squad | 975271505 | 26206128 | 7769 | 30.3 | 0 | 0 | 0 |
| high staff and wage demand | 0 | 29978322 | 6054 | 24.0 | 256 | 256 | 620283457 |
| low activation and acceptance | 576983633 | 9303933 | 3151 | 16.7 | 56 | 21 | 381981 |
| wage shock | 0 | 27333614 | 6054 | 24.0 | 256 | 256 | 2306734621 |
| lower base | 1203907200 | 18821475 | 6075 | 24.0 | 0 | 0 | 0 |
| steeper | 887653030 | 30887347 | 6075 | 24.0 | 0 | 0 | 0 |
| fresh issuance | 1098199090 | 22583837 | 6075 | 24.0 | 0 | 0 | 0 |
| reserve retirement | 1098199090 | 22583837 | 6075 | 24.0 | 0 | 0 | 0 |

Accounting research: cumulative floor(P/20) for each earned period / mandate obligation, reserve receives residual exactly, AI receives zero. Tested arbitrary installment partitions, arrears paid after mandate change, duplicate payment identity and conflicting retries in a pure in-memory reference. This is NOT production transaction/idempotency implementation or approval of the rounding policy. World annual reward/salary/supply conservation asserted in all 960 simulated seasons. Staff debts are not currency creation. Base observations by public age/skill cell include active exposures, employed exposures, paid share and binned prospective reward capacity; these are inputs to next valuation sensitivity, not actual population forecasts. No private aptitude, actual current agent or actual club treasury in public estimates. Remaining: alternative standardized public-input forecast and owner selection, canonical sporting match/qualification proxy limitations, complete integration and exact-head checks.

## Slice 4 — standardized public age/skill forecast (sensitivity)

`node tools/economy-valuation-forecast-769.mjs` reads only aggregated synthetic active/employed/paid exposures and binned prospective club reward contexts from the three ordinary world scenarios (seasons 13–32). Interpolate age/skill cell midpoints and shrink sparse cells toward pooled same-age observations (250 exposure pseudo-counts, research setting). Salary references use K1500/slope2, original versatility, square-root expected reward response, tier-specific floors, and two-season renewals. Employment and collection are separately forecast from aggregate cells; no individual hidden retirement/aptitude, current club balance, agent, or actual salary is an input. Actual historical signed wages are descriptive only. The product of separately interpolated employment/collection and conditional wage is an approximation, not a fitted joint expected payment model. End-season collection does not count later recovery of arrears in the same cohort exposure. All observations are from synthetic assumptions, not market evidence. Cross-seed sensitivity is not out-of-sample validation. No integration to #765 authorized.

| Variant | P10 rounded | Median rounded | P90 rounded |
|---|---:|---:|---:|
| fullContext | 860 | 1900 | 4800 |
| worldEmployment | 280 | 1500 | 4600 |
| discount3 | 190 | 1000 | 3200 |
| discount5 | 150 | 800 | 2600 |

Recommendation for owner review: keep K=1500 / slope=2 / versatility up to 10%, 5% rate, tier floors and 250k reward benchmark; no additional AI premium in standardized public reference, no direct XI multiplier, and compare full employment upper sensitivity with synthetic employment-adjusted values. Do not ratify a synthetic employment curve as actual behavior; select the provisional public reference/discount separately. Prefer recycling reserve before new issuance in scenarios, not currency retirement solely to reduce a balance; both leave club accumulation unresolved without actual economic uses. No salary cap, payroll percentage or compulsory reserve extraction. Consider productive optional staff/facilities/operations sinks as a later design decision only, not an authorization. #770 should evaluate acquisition and mandate economics using these ranges, not guaranteed returns. All final parameters remain DRAFT/HOLD pending explicit review; no real-world financial receipts/costs established.
