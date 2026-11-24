# Full-payroll economy and 10% player valuation uplift — DRAFT/HOLD

Latest owner decision: 100% of Rewards targeted to fixed player salaries in aggregate; no staff or undefined service spend, no residual club surplus as a valuation basis. Change club license valuation to sporting/economic capacity. Player market valuation raw benchmark increased by 10%, then existing upward display rounding; youth ARC price 100% remains research reference and EUR price 90% of the **new** value, ~10% of activated players paid in EUR. No new payroll fee, forced expenditures or direct EUR-to-ARC wallet issuance. Contract pay remains negotiated fixed gross amount, not a rule automatically setting each contract/club's pay equal to actual awards. 100% is a long-run world payroll target; individual liquidity, independent signing/holds, arrears, promotion/relegation, and risk buffers remain separately gated. All parameters DRAFT. No runtime changes authorized here.

## Player formula

Let B be the existing unrounded remaining expected paid salary stream from public age, suitability, versatility, projected growth, employment/collection, survival, reference renewal, discount and human payout fraction. New raw V=1.10×B; displayed V=existing upward rounding(V). Retired zero; invalid input remains null; no private retirement_age, aptitude, actual club or agent. Apply multiplier once to raw valuation, not a second price markup or salary multiplier. If using the former K60 baseline alone, this is a 10% raw uplift with rounding effects, not a claim that replacing wages with full payroll produces only 10% overall change. Full-payroll calibration separately normalizes the career wage curve to 100% of proposed Rewards using full-employment/collection cohort assumptions, not the current canonical exposure dataset. Future integrated implementation requires recalibrating salary and standardized public employment/collection, updating version/index/tests separately; no live calculator or index changed.

At 6.6M proposed Rewards, normalized suitability60 wage coefficient 588.66 ARC before versatility. Reference annual 332 activations, ages16–19, 19.29 expected career seasons, same 5-bin suitability profile as prior study. Mean raw career 19879.52, previous displayed 20297.50, new raw 21867.47, new displayed 22360.50. ARC100 quote uses new displayed value, EUR90 quote rounds up cents. 299 ARC / 33 EUR requires mean ARC 22073.58 for exact aggregate recycling. Actual theoretical ticket demand 6685790 ARC, maximum payable from fresh aggregate wages 6600000, unfunded demand 85790, reserve gap 0. Do not equate capped receipts with fulfillment of all 299 orders. Exact 10% EUR and 10% value uplift on unrounded fair career returns gives 0.90×1.10=99% recycling; upward rounding and integer mix affect result. No forced exact spend, arbitrary repricing or demand guarantee.

## Licenses

Indefinite EUR-only sporting management right, not financial return; forecast gross domestic+international Rewards using 32-season representative sporting transitions, promotion/relegation and qualification, no costs or treasury subtraction. Use calibrated nonlinear mapping with two anchor profiles, R_low=19634.81, R_top=39950.49 ARC, exponent log(300/100)/log(R_top/R_low)=1.546607. Base EUR=max(10, round_to_5(100×(R/R_low)^exponent)). Anchors hypothetical, not identity rankings; fixed calibration references to be versioned, not automatically rescaled with every season. All 320 reference rows included; actual club-specific sporting strength not established. One-time genesis separate, optional additional capital separate verified EUR item, never personal wallet. EUR300/100 attained by construction, not market demand evidence. Old 3x surplus formula superseded by owner direction; exact exponent, rounding, reference schedule and individual quotes proposed for approval. Total genesis candidate 3341600, opening reserve candidate 6600000, separate combined 9941600. No actual funding or issuance.

| Group | Clubs | Mean base EUR | Mean genesis ARC |
|---|---:|---:|---:|
| 0/0 | 64 | 10 | 500 |
| 1/0 | 80 | 160 | 13800 |
| 1/1 | 24 | 170 | 32100 |
| 1/2 | 24 | 165 | 23000 |
| 2/0 | 128 | 140 | 6900 |

## Reserve and real receipts

| EUR orders | ARC orders | ARC desired | ARC funded ceiling | Unfunded demand | Gap ARC | EUR gross |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 332 | 7423686 | 6600000 | 823686 | 0 | 0.00 |
| 17 | 315 | 7043558 | 6600000 | 443558 | 0 | 3421.16 |
| 33 | 299 | 6685790 | 6600000 | 85790 | 0 | 6641.07 |
| 50 | 282 | 6305661 | 6305661 | 0 | 294339 | 10062.22 |
| 66 | 266 | 5947893 | 5947893 | 0 | 652107 | 13282.14 |

At reference 33 EUR purchases, gross EUR6641.07, illustrative contribution EUR6267.58 after hypothetical provider fees and activated-player assets, not actual profit. No assumed staff, transfer principal or marketplace receipts. Fee sensitivity only, no new fee. 32-season aggregate reserve-only overlay stops before unfunded award pool, no automatic mint. This is an aggregate ceiling and NOT evidence of individual purchases, demand or actual retirement replacements. 100% payroll leaves no world operating savings; adverse individual prize variance can exhaust genesis over repeated seasons. One-season liquidity checks not guarantee. No live payment or database changes. Reproduce `node tools/run-economy-full-payroll.mjs --check`. Isolated JS checks passed, CI pending.
