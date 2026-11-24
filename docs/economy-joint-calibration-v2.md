# Joint calibration v2 — staff included in operating surplus — DRAFT/HOLD

Owner correction: staff is a discretionary use of club operating surplus, not a separate standardized deduction or guaranteed reserve receipt. Actual paid staff expenses reduce realized cash, and only actual reserve credits count as recycling. No new staff fee or service approved. Earlier v1/renewal/stress staff assumptions are historical; retain snapshots unchanged.

Same 48 combinations and 32-season aggregate overlay, zero staff deduction and automatic receipts. Recruitment allowance remains separate, not a world sink. Rewards 2.4M, salary K60, youth EUR90/ARC100 reference and other assumptions unchanged. One ARC difference in modeled aggregate payroll is rounding of per-club forecasts, not a wage change.

| Baseline | Historical v1 | Staff optional v2 |
|---|---:|---:|
| Rewards ARC | 2400000 | 2400000 |
| Human payroll ARC | 280862 | 280861 |
| AI payroll ARC | 280862 | 280862 |
| Separate staff deduction ARC | 230400 | 0 |
| Recruitment allowance ARC | 290304 | 290304 |
| Operating surplus ARC | 1317572 | 1547973 |
| Reserve inflows ARC (aggregate ceiling) | 792124 | 561723 |
| Additional receipts required ARC | 1607876 | 1838277 |
| Base recovery % | 33.01 | 23.41 |
| Top D1 EUR | 295 | 325 |
| Low D2 EUR | 100 | 120 |
| Genesis candidate ARC | 591200 | 476000 |

Unchanged 3x/20-season valuation raises reference quotes; EUR300/EUR100 owner targets remain, these are sensitivities only. K90 with same rewards yields EUR285/EUR90 but remains an unapproved scenario and does not close recycling. No artificial offsetting fee or guaranteed staff receipts. Full grid and cashflows in [results](economy-joint-calibration-v2-results.json). Reproduce `node tools/run-economy-joint-calibration-v2.mjs --check`. Isolated JS verified v1 unchanged and v2 accounting; repository CI pending. No runtime, DB, checkout or merge changes.
