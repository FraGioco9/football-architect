# Club license calibration v1 — DRAFT/HOLD

First analytical slice for #770/#775 in #787. No offer, live quote, balance or financial transaction. All numerical assumptions below require owner review. Current pricing policy in [DRAFT v5](economy-approved-draft-v5.md) prevails.

## Model

- Canonical 320 identities and approved Season 1 participant selection; 128 D1, 128 D2, 64 inactive. First-season 24 Sovereign and 24 Federation entries are known. ID order is **not** sporting strength. No private ratings, generated random strength, or real season results inferred. Neutral rank probabilities within each division; per-club scenario overrides are explicitly configurable and must be supported by evidence before publication. Same-input clubs receive the same quote.
- Five sporting-season expectation and 32-season horizon sensitivity, not a license term. Joint Markov states distinguish D1 with no cup/Sovereign/Federation, D2 and inactive. Next-year cup allocation uses top three/next three rank proxy, no holder exceptions; two automatic promotions/relegations and one playoff/playout expected swap, conditional on rank with equal playoff chances. No inactive activation assumed. Rank-point weights 70 minus 3 per rank (historical #769 proxy), canonical integer reward allocator and exact fixed placement amounts; international conditional mean pool/24, not match simulation. Neutral world reconciles annual mean pool to 2.4M up to display rounding.
- Costs are standardized scenario estimates, not actual contracts: 25 slots, suitability 65, 5% versatility, 50% AI at modeled 1.125 salary factor, canonical v5 wage curve and division floors, staff reference 1200/600 ARC from earlier research. No bonus, forced spend, actual staff service or guaranteed surplus. Sensitivity +/-25% cost. Forecast does not use actual spending or treasury.
- Base price = max(EUR10, nearest EUR5 to 3 × expected annual surplus / 100); EUR5 rounding is proposed only. Negative surplus receives minimum. Optional purchased capital excluded. Existing one-time genesis capital is separately proposed as max(positive tier minimum, half modeled first-season costs rounded up to 100 ARC); independently configurable per club. Genesis is not a mandatory purchase amount or a ledger grant here. Primary-price sensitivity shows genesis coefficient 0%, 25%, 100% as separate price components; no coefficient selected, no double counting base and chosen capital. At 100 ARC/EUR the separately chosen EUR capital would map directly to ARC on future authorized fulfillment; no checkout here.
- Hypothetical persistent top D1 profile uses explicit rank weights in config; not assigned to real clubs. It is a calibration check against the EUR300 base anchor, not a ceiling or guaranteed price.

## Results

| Initial group | Clubs | Mean annual surplus ARC | Mean base EUR | Mean genesis ARC |
|---|---:|---:|---:|---:|
| Inactive | 64 | 0 | 10 | 500 |
| D1 / no cup | 80 | 7602.06 | 230 | 1800 |
| D1 / Sovereign | 24 | 10017.58 | 300 | 2500 |
| D1 / Federation | 24 | 8796.57 | 265 | 2200 |
| D2 | 128 | 4282.6 | 130 | 1200 |

Top hypothetical reference: 12954.85 ARC annual surplus, EUR390 base. Proposed aggregate club genesis 442400 ARC, separate reserve reference 2,400,000 ARC, combined reference 2842400 ARC. 0 clubs uncovered in deterministic first-payday reference (not a liquidity stress or solvency guarantee).

Per-club output: [results](club-license-calibration-v1-results.json). Reproduce: `node tools/run-club-license-calibration.mjs --check` (or `--write` to regenerate). Tests extend existing competition Rewards contract. Isolated JS checks: 320 unique rows, reward conservation, positive balances, price floor, ordering independence, unknown override rejection, independence of base quote from genesis override. Actual repository Node and CI must still verify exact HEAD.

## Remaining before owner price approval / activation

Use genuine pre-launch sporting strength inputs or owner-approved explicit group policy before individual differentiated offers; calibrate top reference closer to anchor if necessary. Validate rank proxy and holder exceptions, standardized payroll roster mix and optional costs. The 32-season expectation is **not** a linked financial world stress test: run full reserve-first capped issuance, zero personal wallet, genesis distribution, payroll arrears and demand scenarios separately before final approval; no issuance cap has been ratified. Review capital bounds and steps, genesis coefficient, rounding, secondary market, inactive clubs and refund/legal/provider gates. #775 owns ledger, #781 marketplace, #782 real-money checkout, #788 reset. No runtime changes or remote operations.


Follow-up stress and horizon comparison: [club-finance-stress-v1.md](club-finance-stress-v1.md). All prices and caps remain provisional.
