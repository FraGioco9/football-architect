# Club finance stress v1 — DRAFT/HOLD

27 seeded scenarios (9 cases × 3 seeds), up to 32 sporting seasons each; underfunded cases intentionally stop before awards/season commitments. Uses canonical 320 club identities, 256 active and 64 inactive, membership and exact v5 awards, proposed per-club genesis, separate 2.4M reserve, zero opening personal wallets. No runtime, DB or transactions. All financial scenarios hypothetical.

## Model boundaries
- Synthetic neutral ranks (not matches), exact participation and fixed outcome awards, rank-weight points proxy with explicit research-only remainder order, 3 promotion/relegation including playoff proxy, previous top six qualify, no holder exceptions. Whole 2.4M season envelope reserved before any season events; reserve used first, shortfall issued only under scenario annual cap, otherwise fail closed with no partial rewards or season. Caps are sensitivities, not policy. Day28/56 certified proxy awards globally credited before payroll. No future rewards spendable.
- 25 synthetic roster slots, standardized skills 55–75, v5 wage formula, 1–3 initial contract seasons and two-season renewals, fixed wage until renewal except promotion floor, two annual replacements per active club; no private player inputs. Opening human mandates are synthetic pre-existing rights; demand, purchased mandates queued for replacements, AI fallback. Not a full canonical player career/generator, transfer, own-origin contract or negotiation model. Initial coverage is a scenario stress, not an entitlement; realized coverage evolves. Prices 200/1100/3200 ARC are rough already-discounted youth ticket sensitivities informed by earlier research, not actual per-player 90% quotes. 768 new offers/year, fixed demand attempts, ARC from earned wallets or separate hypothetical EUR budget; no paid/free personal top-up. Purchased youth can queue indefinitely here; no retirement model for unplaced youth, market churn or secondary sales. No actual demand evidence.
- Oldest-period-first integer proportional partial payroll using explicit research-only tie order, earned recipient retained across replacements, 100% human or AI reserve, arrears persist; hypothetical staff bills serviced only after payroll and blocked during wage arrears. Staff costs are model proxies not mandatory policy. No forced spending/withdrawal, no sporting transfers. Whole world stocks reconcile at each milestone and season; opening + capped reward issuance + verified hypothetical capital issuance equals all balances plus earmarked funds. License case: exogenous 20 finite unique primary sales/season, no renewals, reference base price plus separately itemized EUR20 chosen capital directly to treasury once at 100 ARC/EUR. No secondary sales, cash redemption, user wallet credit, payment provider, legal or tax claims. Gross EUR receipts separate from ARC stocks.

## Results

| Case | Completed by seed | Peak clubs arrears day28 | Peak clubs arrears day56 | Peak day56 arrears ARC | Mean last-10 issuance ARC/season |
|---|---|---:|---:|---:|---:|
| ordinary | 32/32/32 | 0 | 0 | 0 | 1558591 |
| all-ai | 32/32/32 | 0 | 0 | 0 | 1491173 |
| all-human-opening | 32/32/32 | 0 | 0 | 0 | 1563989 |
| low-demand | 32/32/32 | 0 | 0 | 0 | 1530880 |
| high-cost | 32/32/32 | 79 | 32 | 24237 | 831879 |
| cap-1800k | 1/1/1 | 0 | 0 | 0 | 0 |
| cap-1200k | 1/1/1 | 0 | 0 | 0 | 0 |
| license-capital | 32/32/32 | 0 | 0 | 0 | 1561044 |
| half-genesis-high-cost | 32/32/32 | 104 | 37 | 33130 | 824795 |

Mean last-ten is over available completed seasons, not extrapolation for stopped runs. Full per-season accounting and EUR gross sensitivity in [results](club-finance-stress-v1-results.json). Repository CLI check: `node tools/run-club-finance-stress.mjs --check`. Isolated JS actually ran all scenarios and invariant assertions; full Node and CI still required.

## License horizon sensitivity

| Forecast seasons | Persistent hypothetical top D1 base EUR | D1 Sovereign neutral EUR | D1 Federation neutral EUR | D1 no cup EUR | D2 EUR |
|---:|---:|---:|---:|---:|---:|
| 5 | 390 | 300 | 265 | 230 | 130 |
| 10 | 350 | 250 | 230 | 210 | 155 |
| 20 | 330 | 220 | 210 | 200 | 170 |
| 32 | 320 | 205 | 200 | 195 | 180 |

Recommend review of 20-season forecast (EUR330 top persistent reference) or 32-season forecast (EUR320), keeping 3x valuation multiple and current costs rather than tuning costs just to hit EUR300. Longer horizons converge neutral D1/D2 and dilute initial cup value; this is a product trade-off, not approved price. No actual club rank inferred from identity. Genesis coefficient and per-club strength evidence remain open. No final cap or capital allocation approved; discuss reserve replenishment, productive optional spend, actual contract/academy demand and cap funding feasibility before launch. Full linked player career/market and exact local D1 settlement tests remain #775/#777/#778 and subsequent calibration.
