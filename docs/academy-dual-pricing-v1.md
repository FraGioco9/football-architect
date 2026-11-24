# Youth dual-currency pricing — DRAFT/HOLD

Owner requested both ARC recycling and real EUR receipts from academy sales, with distinct price percentages to incentivize EUR. Current approved 90%/90% remains baseline until numeric selection; test separate percentages of the same displayed market value. One candidate, one purchase, same rights, no double charge, no EUR-to-ARC wallet mint or cash redemption. ARC receipts credit reserve; EUR receipts are external gross cash, not ARC. License and other price policy unchanged. 100 ARC/EUR is purchase denomination, not redeemability.

Five price pairs, three *assumed* EUR preferences when both affordable, three seeds, 32 seasons each (45 runs). Reuse historical synthetic roster/automatic fallback model and v2 genesis reference; this is a payment-choice sensitivity, NOT a valid demographic, recruitment-cost or final solvency simulation. Fixed 256 agents, zero opening wallets, EUR15 hypothetical spending budget/agent/season, three attempts, unchanged sample ticket weights 25/50/25 at displayed values 220/1220/3560 ARC (rough earlier research controls). Fixed preference is not estimated elasticity; price affordability changes, preference assumptions vary independently. No actual orders or demand claims. Report mean last 10 seasons across 3 seeds. All isolated accounting assertions passed. No live code, payments or database. CLI `node tools/run-academy-dual-pricing.mjs --check`.

| ARC % | EUR % | Relative EUR discount | ARC orders | EUR orders | ARC reserve receipts | EUR gross / season |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 90 | 90 | 0.0% | 396 | 136 | 546619 | 1126.36 |
| 100 | 90 | 10.0% | 364 | 132 | 523532 | 1102.52 |
| 100 | 85 | 15.0% | 364 | 132 | 523532 | 1041.27 |
| 100 | 80 | 20.0% | 364 | 132 | 523532 | 980.02 |
| 90 | 80 | 11.1% | 396 | 136 | 546619 | 1001.21 |

Unit economics: illustrative provider cost 3% + EUR0.25 per order, **not a verified provider rate**; no VAT, refunds, chargebacks, tax, fixed overhead or paid acquisition costs modeled. Unit generation costs 0.10/0.50/1/2 EUR applied to all 768 offers, not merely sales. Break-even is for generation only after illustrative payment processing, not site profitability. Mean ticket assumes same mix regardless of payment currency; actual mix in stress can differ. No guaranteed revenue. Minimum 332 activations/year from retirement research assumes every activated player can fill a slot. Full joint career and financial model remains open.

Recommend owner review 100% ARC / 85% EUR as balanced initial candidate, with 100/80 stronger incentive and 90/80 accessibility alternative; do not impose mandatory EUR quota, forced purchases or promise income. Test actual demand and verified provider/tax/unit costs before commercial decision. Revisit when genuine price distributions and user willingness-to-pay available. #586/#782 own purchase and compliance; #775 ledger. All percentages editable/versioned DRAFT; no selection implied by this report.
