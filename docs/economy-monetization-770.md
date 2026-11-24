# #770 monetization research — first sensitivity (DRAFT/HOLD)

Depends on canonical #765 valuation @ 16625612bba33e6ae05a968600deae6cf5fa6662 and #769/#771 research @ b5ad445f8cb3caaaee8d195ece54fefcb63014ad. Stacked research PR only; no new runtime features, payments, licenses, contract writes, DB, release or merge. No rate/price is approved by this study. Sources: #755, #586, #587, #757; all approved sports/economic rules retained.

## Scope and assumptions

- Purchase of a youth candidate activates the player and grants exclusive agent mandate only; no ownership of person, no sporting transfer price. Normally no automatic club; origin-license-holder redemption additionally signs three-season contract. Career sensitivities for origin Tier1/Tier2 show hypothetical minimum-respecting wages and employment for three seasons; actual salary and same-user conflict resolution remain open. World overlay excludes this special redemption pathway pending affordability/conflict design; do not treat ordinary cohort prices as actual checkout.
- Same canonical valuation and role profile. Price candidates: ceil(25%,40%,60% of **raw** reference), plus 40% with experimental 50–2500 ARC band; this is distinct from approved upward rounding of public market value. No conversion to EUR. Unsold candidates carried without recalculation of pricing or age in this sensitivity only; actual unsold progression deferred, no age-freeze decision.
- 3,000 seeded entry players x12 stochastic careers per variant, six variants (retained mandate, 5%/10% annual loss, employment/collection stress, origin club Tier1/Tier2). No individual hidden aptitude/retirement consulted. Public synthetic age/skill employment probabilities, independently varied development, 1–3 season terms, realized wage variation, conditional retirement, 5% of paid wages; mandate loss stops future commissions to first buyer. No resale proceeds included in career break-even. Salary conditional forecast is not an actual signed contract. Loss = cumulative paid commissions below purchase price before career/mandate ends, not real financial loss.
- 27 32-season aggregate overlays, 3 seeds per case, 256 active agent accounts, assumed virtual starting grant 1500 or 500 ARC (explicit new issuance, not approved free credits), 5%/10% churn, persistent inactive wallets, stochastic purchases, 768 catalog additions/year resampled from canonical cohort (not fresh generation), finite shopping effort and resale attempts. No actual users/market demand or individual club solvency model. Full 60M reward funding, club treasury aggregate, #769 base payroll reference with residual AI wages (not cap), 5.76M virtual staff cost, reserve recycling or new issuance. Human commissions calculated once from actually paid modeled salaries. No compulsory personal-to-club transfer. Churn loses active representation in this sensitivity only, not approved mandate policy. Actual origin-license transaction excluded in world overlay. No primary license price or secondary license turnover assumed.
- Fees 5%/10% of executed consideration, seller/buyer/split comparisons; no fee on salary, rewards or sporting transfers. Whole ARC fee floor only as test candidate, cancellation no fee, idempotent same payment ID; production atomicity/refunds separately designed. Refunds must reverse original consideration/fee exactly once only if legally and operationally eligible, not recompute using later fee version.
- Executed in isolated V8 against repository canonical generator numeric source (synthetic identity banks preserving name draw counts), exact calculator and forecast. Repository CLI not yet independently run. `node tools/economy-monetization-770.mjs` on stacked branch. JSON summary includes career and annual outputs. All 864 simulated annual stocks reconcile; fees and mandate counts checked. No actual EUR receipts, taxes or provider costs known.

## Career results (36,000 paths per variant; ARC)

| Mandate assumption | Price rule | Median price | Median paid commissions | Failure to recover price | Median seasons to recovery, recovered only |
|---|---|---:|---:|---:|---:|
| retained | 25pct | 356 | 1573 | 0.4% | 8 |
| retained | 40pct | 570 | 1573 | 1.0% | 11 |
| retained | 60pct | 855 | 1573 | 2.6% | 14 |
| retained | 40pct-banded | 570 | 1573 | 1.0% | 10 |
| 5pct-mandate-loss | 25pct | 356 | 695 | 30.4% | 8 |
| 5pct-mandate-loss | 40pct | 570 | 695 | 39.8% | 10 |
| 5pct-mandate-loss | 60pct | 855 | 695 | 49.0% | 13 |
| 5pct-mandate-loss | 40pct-banded | 570 | 695 | 39.6% | 10 |
| 10pct-mandate-loss | 25pct | 356 | 324 | 51.5% | 7 |
| 10pct-mandate-loss | 40pct | 570 | 324 | 63.1% | 10 |
| 10pct-mandate-loss | 60pct | 855 | 324 | 73.2% | 13 |
| 10pct-mandate-loss | 40pct-banded | 570 | 324 | 62.7% | 10 |
| stress | 25pct | 356 | 177 | 65.5% | 10 |
| stress | 40pct | 570 | 177 | 77.3% | 13 |
| stress | 60pct | 855 | 177 | 87.8% | 16 |
| stress | 40pct-banded | 570 | 177 | 76.9% | 13 |
| origin-tier1 | 25pct | 356 | 770 | 21.5% | 6 |
| origin-tier1 | 40pct | 570 | 770 | 31.4% | 9 |
| origin-tier1 | 60pct | 855 | 770 | 41.3% | 12 |
| origin-tier1 | 40pct-banded | 570 | 770 | 31.1% | 9 |
| origin-tier2 | 25pct | 356 | 753 | 23.3% | 6 |
| origin-tier2 | 40pct | 570 | 753 | 33.9% | 9 |
| origin-tier2 | 60pct | 855 | 753 | 43.8% | 12 |
| origin-tier2 | 40pct-banded | 570 | 753 | 33.7% | 9 |

## World overlay (three-seed means; last ten seasons annual flows, closing stock)

| Scenario | Youth/year | Primary ARC/year | Secondary fees/year | Commissions/year | Closing catalog | Closing agent wallets |
|---|---:|---:|---:|---:|---:|---:|
| 25pct | 355 | 161451 | 1937 | 363456 | 13618 | 3640115 |
| 40pct | 300 | 152576 | 675 | 178667 | 15950 | 869418 |
| 60pct | 203 | 78938 | 240 | 71057 | 18650 | 364233 |
| 40pct-banded | 299 | 153920 | 667 | 179371 | 15937 | 870679 |
| 40pct-fee10 | 298 | 151480 | 1389 | 173774 | 15999 | 836750 |
| 40pct-buyer5 | 297 | 152645 | 654 | 177364 | 16013 | 863516 |
| 40pct-low-wallet | 199 | 55654 | 168 | 60351 | 19361 | 256032 |
| 40pct-high-churn | 237 | 78271 | 200 | 55964 | 17164 | 510986 |
| 40pct-fresh-issuance | 300 | 152576 | 675 | 178667 | 15950 | 869418 |

## EUR and legal boundary

Separate direct EUR listing prices from ARC pricing; do not infer a fixed exchange rate, cash-out, financial return or cash profit from reserve receipts. Illustrative arithmetic only: annual order counts 1k/5k/10k, EUR price 3/5/10, hypothetical tax-inclusive rate 22%, processor 2.9% + 0.30 EUR/order; neither applicable tax treatment nor provider terms established. Net before operating = gross/(1+tax rate) minus processor fee; refunds, fraud, disputes, fixed/variable infrastructure, accounting, support and other costs not modeled. Actual cash revenue/costs unknown. Before any checkout or indirect EUR resale, obtain jurisdiction-specific legal, consumer/tax/payment provider/fraud/age eligibility review. No legal classification or investment guarantees.

## Remaining owner decisions

Review price bands and relative schedule, entry wallet access, churn/mandate transfer, secondary fee payer and rate, primary club license prices (different product and utility), EUR/ARC settlement rules, reserve recycling, actual demand/turnover, license-holder redemption conflict and affordability. No explicit authorization of rates or transaction scope. Further work: fresh annual cohorts and linked club-level world, owner license mapping, account-level eligibility, realistic purchase selection/resale negotiation and demand stress, separate currency cash-flow with actual fees/tax/refunds only after review. No implementation beyond offline research.
