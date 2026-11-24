# Joint Rewards, salary, youth valuation and license calibration — DRAFT/HOLD

Owner target: actual youth activations match retirements, EUR90% (selected), ARC100% reference, ARC reserve receipts match seasonal Rewards in steady state, top D1 ~EUR300 and low D2 ~EUR100, no material unsold generation costs. 48 research cases (6 Rewards scales ×8 wage K scales) and 32-season aggregate stock-flow overlays. No change to public/runtime prices. Reward schedules scaled only in offline calculation, fixed participation/placement/points relative structure and exact integer allocation retained. Salary forecasts recomputed from existing synthetic age/skill exposures, scaled reward context through benchmark, existing retirement/growth, renewal, collection and upward rounding. Youth age 16–19 equally weighted; five skill bins 47/54/61/68/75 with weights 6/24/40/24/6%, versatility 5%; not actual generated profile distribution or observed demand. 332 activations (249 ARC/83 EUR) are fixed steady-state sensitivity, not actual retirement count or forced order mix. 50% human payroll assumption; 100% AI gross to reserve; staff allowance assumed 100% platform receipts for this optimistic scenario, not approved sink. Recruitment allowance is interclub redistribution, never counted as reserve income. Club forecasts use neutral 320 membership, 20-season horizon and existing 3x multiple, reference persistent high/low profiles. Aggregate payroll modeled with constant representative suitability65 and weighted AI factor, not actual per-player contract. No individual affordability, arrears, role matching, actual retirement variation, demand estimation or mid-season funding modeled.

## Result

| Reward scale | Wage K scale | Top D1 EUR | Low D2 EUR | Youth mean ARC | Base reserve recovery % | Unfunded youth ARC demand |
|---:|---:|---:|---:|---:|---:|---:|
| 0.75 | 1 | 195 | 55 | 1373 | 39.83 | 98637 |
| 0.75 | 1.5 | 155 | 30 | 2056 | 53.34 | 147131 |
| 0.75 | 2 | 120 | 10 | 2724 | 66.85 | 191897 |
| 0.75 | 3 | 50 | 10 | 4101 | 93.88 | 291349 |
| 1 | 1 | 295 | 100 | 1582 | 33.01 | 112990 |
| 1 | 1.5 | 250 | 70 | 2373 | 44.71 | 169622 |
| 1 | 2 | 210 | 40 | 3172 | 56.41 | 228055 |
| 1 | 3 | 125 | 10 | 4724 | 79.82 | 333579 |
| 1.25 | 1 | 395 | 145 | 1772 | 28.61 | 127119 |
| 1.25 | 1.5 | 350 | 110 | 2651 | 39.08 | 189079 |
| 1.25 | 2 | 300 | 80 | 3539 | 49.55 | 253085 |
| 1.25 | 3 | 210 | 15 | 5280 | 70.48 | 372718 |
| 1.5 | 1 | 495 | 190 | 1935 | 25.51 | 137794 |
| 1.5 | 1.5 | 445 | 155 | 2911 | 35.07 | 208975 |
| 1.5 | 2 | 395 | 120 | 3866 | 44.62 | 274567 |
| 1.5 | 3 | 295 | 50 | 5799 | 63.73 | 411900 |
| 2 | 1 | 705 | 285 | 2225 | 21.35 | 156864 |
| 2 | 1.5 | 645 | 245 | 3335 | 29.62 | 234718 |
| 2 | 2 | 585 | 205 | 4451 | 37.9 | 313853 |
| 2 | 3 | 465 | 125 | 6743 | 54.45 | 487487 |

At current scale, 2400000 Rewards, mean youth 1582 ARC, theoretical ARC demand 393852; annual fresh human income 280862, so only 280862 can be funded from current payroll under aggregate zero-opening wallet assumption. Deficit 112990; aggregate ceiling is not proof of individual affordability. Even under optimistic staff receipts, base reserve 792124 (33.01%), gap 1607876. EUR receipts conditional on 83 orders: EUR1181.58 gross, contribution EUR958.95 after illustrative 3% + EUR0.25 processing and EUR0.50 assets per activated player in both currencies, before actual tax/refunds/overhead; not verified costs or profit.

**Structural constraint:** reserve funding comes only from paid reserve credits. Human salary and club transfers are redistribution. Positive club and wallet net savings necessarily reduce same-season reserve receipts unless new ARC is introduced or past stocks run down. Even if ARC academy purchases use all human wages, maximum academy + AI payroll receipts equal gross payroll, not all Rewards. Raising wage K to improve recycling cuts club surplus/license values; raising prices without corresponding income worsens affordability. No grid case meeting both price tolerance and affordable ARC target achieves closed recycling from baseline channels. A hypothetical full discretionary closure spends net club cash growth and remaining wallet income back to reserve; it is an accounting upper bound, not approved or modeled voluntary demand. It exhausts all net aggregate savings each season. With current baseline and no discretionary closure, 32-season aggregate overlay issues 49844156 ARC; full closure requires 0 under assumed aggregate spending. This overlay models annual timing only, not day28/56 or cap. The license valuation measures operating surplus before discretionary choices, not net cash after closure. Cannot promise stable reserve and perpetual positive aggregate cash accumulation simultaneously.

Recommendation: retain current price anchors and existing 2.4M/K60 until owner reviews alternative distribution between clubs and agent earnings and real useful optional services. Do not raise youth price artificially, force user spending, impose unapproved recurring fees, assume initial wallet funding or count EUR as ARC. Revisit reward pool, wage schedule, actual affordability, useful sinks and realistic demand together. Actual activation remains tied to retirements, no free fallback. Need a joint per-player/agent/club model with observed/synthetic age profiles, signed salary, actual order budget, unmatched vacancies, reserve milestones and independent club affordability before final parameter selection. #775/#777/#778/#779/#586 remain authoritative. Historical snapshots unchanged. Reproduce `node tools/run-economy-joint-calibration.mjs --check`. Isolated JS grid executed, CI pending.
