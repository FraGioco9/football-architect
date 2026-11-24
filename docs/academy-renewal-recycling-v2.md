# Retirement-matched academy renewal and ARC recycling — DRAFT/HOLD

Latest owner direction: EUR youth price 90% of displayed market value (explicit owner selection); 100% ARC is the working reference for review. Aim for activated youth equal to actual retirements and ARC recycled equal to seasonal Rewards; EUR receipts are the recurring commercial revenue stream, not ARC. Keep license prices and denomination unchanged pending wider recalibration. All values remain configurable before launch.

## Supply and cost boundary

- Prior 768/year (3 per active club) is a historical offer-supply design, not a target for activations. Retirements determine the desired total new activations across ARC and EUR, not the number of fresh offers. Reference 332/year at 6400 active roster slots is an expected steady-state estimate, not a fixed production quota. Actual retirements vary; track unmatched vacancies and unmet demand; no free automatic AI replacement, forced purchase or hidden mint. Whether to enforce an activation cap, handle partial-season timing, role matching, initial age imbalance and unsold relisting/origin reassignment requires #586/#779 review.
- Owner wants no material cost for unsold youth. Prefer lightweight deterministic candidate profiles, defer expensive durable assets (e.g. final portrait) and activation until verified checkout. Minimal preview/catalog compute/storage may still cost something; no zero actual infrastructure cost guarantee. Unsold offers may be archived/retired from catalog or reused in another season/club after separate lifecycle rules; no sale/contract/mandate on archive and no ARC burn. No duplicate active identity or double purchase; preserve history for activated players. Unsold lifecycle and reassignment not finalized.
- Cost of delivered assets applies to all activated youth, ARC and EUR buyers alike. Illustrative contribution is EUR gross less hypothetical payment processing (3% + EUR0.25/order, not verified) and per-activation external generation expense. VAT, refunds, overhead etc not modeled; not actual margin/profit. If preview generation costs exist add them separately.

## Recycling feasibility

2.4M ARC seasonal Rewards unchanged. With fixed activation count R, EUR-paid activations E, ARC orders R-E, target average ARC ticket = Rewards/(R-E) if academy is the sole recycler. At 100% ARC price this is the necessary average displayed market value. With the previous illustrative ticket distribution, mean 1555 ARC / EUR13.995 at 90% EUR. Results below are arithmetic sensitivities, not demand simulation; selected mix is not a sales quota.

| ARC orders | EUR orders | ARC academy receipts | Rewards recycled | Required average ARC ticket for academy-only full recycle | EUR gross |
|---:|---:|---:|---:|---:|---:|
| 332 | 0 | 516260 | 21.51% | 7229 | 0.00 |
| 266 | 66 | 413630 | 17.23% | 9023 | 923.67 |
| 249 | 83 | 387195 | 16.13% | 9639 | 1161.59 |
| 216 | 116 | 335880 | 14% | 11112 | 1623.42 |
| 166 | 166 | 258130 | 10.76% | 14458 | 2323.17 |

At 249 ARC and 83 EUR orders, full academy-only recycling requires 9639 ARC average (about 6.2x the illustrative mean); this cannot be obtained by changing 90% to 100%. Do not simply increase public valuation or reduce rewards without rerunning wage/valuation/affordability: if valuations scale proportionally with rewards, the ratio may not improve. Wages paid to agents and transfers between clubs redistribute ARC, not platform receipts. Only reserve credits (academy ARC, AI/unrepresented salary, approved fees and any future useful purchases) replenish reward funding; count each once. Target whole-economy reserve inflows equal Rewards at steady state is a practical alternative to academy-only; opening reserve and authorized capped issuance bridge timing/shortfall, not permanent subsidy. If owner requires academy-only target, redesign reward/wage/valuation and demand together; no automatic cap, price markup, new fee or forced spend approved. EUR purchases never issue personal ARC.

Reproduce `node tools/run-academy-renewal-recycling.mjs --check`; arithmetic executed in isolated JS. See [results](academy-renewal-recycling-v2-results.json), including sensitivities for other reserve receipts and external generation cost per activation. Historical dual-pricing stress and prior 768 generated-cost model are retained but not current lifecycle/cost assumptions. Full age-linked financial and demand calibration remains open. No runtime/ledger/payment/DB/merge authorization.
