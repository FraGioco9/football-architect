# Mixed-age launch reserve and contract affordability stress — DRAFT/HOLD

Owner direction: mixed-age launch only. Synthetic opening age distribution truncated to 16–32 using the prior stationary-weight method; actual launch histogram not approved. Canonical club membership, 6400 synthetic initial players, 256 human-agent wallets initially zero, same 2.4M Rewards candidate, 99% ARC / 90% EUR youth quotes, +10% raw player valuation, no staff. Initial club genesis 1,234,400 ARC unchanged. New entrants 16–19, canonical retirement hazards, no free replacements. No live roster snapshot. Same sporting and voluntary purchasing proxies as individual v1; three hypothetical EUR demand scenarios, three seeds each, two contract policies = 18 diagnostic 100-season paths. Five reserve options per path = 90 no-issuance prefix checks.

The reference signing policy uses expected rewards as the budget. Guarded policy additionally checks available cash minus arrears and any transfer consideration, and half-season future cumulative fixed contract liabilities against conservative participation income (current known division/cup then D2 domestic participation only for future years). Rejects offers that fail; does not rewrite existing contracts, does not require spending 100% of actual prizes, and is not a production hold or authorization model. Initial synthetic existing contracts unchanged, explaining residual early arrears. Promotion floors and independent same-user controls remain open. No guaranteed fees or new costs.

## No-issuance reserve test

Reserve is not a behavioral input to this simulator except the full prize earmark. Full diagnostic paths temporarily top up missing reserve for measurement only; **acceptance results stop at the first unfunded season**. Recover the exact reserve-independent path net flow by removing diagnostic injections; each tested reserve must cover the entire pool before each season. Prefix is valid without minting; later diagnostic data is not a financed continuation. Minimum initial reserve for a particular 100-season path is max(pool minus cumulative previous net flows). No actual issuance, grant or remote action.

| Guarded demand scenario | 2.4M | 4.8M | 7.2M | 12M | 24M | Required opening reserve across seeds |
|---|---:|---:|---:|---:|---:|---:|
| Low EUR | 1 | 2 | 3 | 100 | 100 | 11.19–11.71M |
| Reference EUR | 1 | 2 | 3 | 21–22 | 100 | 17.56–18.43M |
| Higher EUR | 1 | 2 | 3 | 9–11 | 40–42 | 44.14–46.55M |

Numbers are completed seasons before a full prize pool cannot be earmarked (maximum 100). 24M is sufficient for all three reference seeds but not high EUR demand. A finite reserve lasting 100 seasons is not proof of long-run stable circulation. Reference forecast-only minimum 17.13–18.23M; low EUR 10.88–11.48M; high EUR 43.93–46.17M.

## Contract guard effect

At end of 100-season diagnostic paths, all nine guarded runs have zero unpaid salaries, compared with forecast-only reference 734783–875392 ARC final arrears. Guarded reference peak arrears 115473–132647 ARC, initial contracts not screened. Reference guarded rejected 6660–6842 signing offers over 100 seasons, final employed 6019–6045, population 6400. Cash remains ~3.06–3.10M across club treasuries and ~12.65–13.72M across personal wallets in the diagnostic reference, so reserve depletion persists despite improved payroll. Last ten reference gross EUR per season 3144.69–3316.59 conditional on assumed demand. These are diagnostic balances and not observed player behavior or profit. About 2533–2567 retirements over first ten seasons in guarded reference; early limited replacement demand is important.

## Recommendation

Keep mixed-age reference, unchanged youth prices/valuation, no artificial staff costs, no automatic issuance. Advance the signing guard for further research and test opening contract affordability with actual genesis/guaranteed reward capacity, including transfer holds and promotion obligations; validate wage/market forecast against actual collected salaries, and refine launch circulation before choosing a reserve. A 24M opening reserve is a tested reference buffer only, not a selected amount or structural solution; high EUR adoption can still drain it. Do not approve runtime settings or merge yet.

Reproduce `node tools/run-economy-mixed-launch.mjs --check`. 18 full diagnostic paths executed in isolated JavaScript; stock, arrears and population invariants checked. Previous 3-season historical equivalence checked, short regression added to normal CI; full offline run separate. No Node/CI claim. No runtime, DB, payment, deploy or merge.
