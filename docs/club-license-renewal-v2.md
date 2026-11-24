# License calibration v2 — retirement and recruitment — DRAFT/HOLD

Owner requested two anchors: top D1 approx EUR300, low-table D2 approx EUR100; account for generating/replacing retirees. Base license excludes buyer-selected capital, remains indefinite and EUR-only. Prior v1 and stress snapshots are historical, unchanged. All quotes and costs below are research, not fees, approved allocations or live offers.

## Cost separation

- #586: 3 generated candidates per active club, 768/year; only verified purchases activate them. At 90% displayed market value the mandate buyer pays personally in ARC or direct EUR; no automatic charge to club treasury, no free AI fallback, no double-counting personal academy purchase as club sporting fee. Own-origin three-season contract and affordability remain separately gated. Ordinary transfers/negotiated sporting consideration #587 not yet priced.
- Club forecast: standardized *gross* sporting recruitment allowance per vacancy, not a mandatory charge, to reflect replacement-related negotiated recruitment/transfer costs beyond salary. Candidate D1 1000 ARC, D2 750 ARC per retirement replacement. A transfer from one club to another is redistribution, not a currency sink; do not infer reserve receipts or new issuance from this allowance. Free-agent signings may have no transfer consideration. Sensitivities include zero. No new actual generation fee approved; separate hypothetical 0/100/250 ARC per generated candidate illustrates possible club-funded generation charges only if later approved, not current policy.
- Platform actual generation expense (compute/storage/portrait/operations) is distinct external EUR cost; no vendor/unit cost established. Illustrative EUR0/0.10/0.50/1.00 per generated candidate, applied to **all** 768 offers, not just sales. No implied actual costs or cash profit. At 768 candidates each season, EUR0.50 per candidate would be EUR384/season. No actual payment, compute cost quote, fee or automatic burn.

## Demographic renewal

Uses approved conditional retirement hazards from MARKET_VALUE_CONFIG, ages 16–19 equiprobable as scenario assumption, survival to each season, stationary opening age mix, 25 roster slots per active club. Expected career 19.29 sporting seasons, 1.3 retirements per club/year, 331.71 worldwide. Minimum steady-state activation fraction 43.19% of annual 768 candidates assuming every activation can fill a slot. No private retirement age used. The 32-season expected population overlay ages all activated players and applies actual conditional hazards; constant annual activation assumptions, no automatic AI generation/replacement, no mandatory club placement, no explicit unsold ageing assumption, no role/quality matching. Initial 6400 is a research roster target, not live roster count.

| Activated/year | Expected active pool after32 | Ending shortfall vs 6400 |
|---:|---:|---:|
| 0 | 0 | 6400 |
| 206 | 3974.61 | 2425.39 |
| 332 | 6405.68 | 0 |
| 497 | 9589.23 | 0 |
| 768 | 14817.96 | 0 |

## Reference quotes

20-season horizon, 3x annual surplus, EUR5 provisional rounding. Persistent top rank weights unchanged; low D2 profile doubles relative probability weight of last four ranks (not an identity-based ranking or promise that a club remains low). Costs from canonical v5 plus annual standardized retirement recruitment budget 1296 / 972 ARC. Profile choices and fee sensitivity explicitly shown; illustrative mid-range cost, not empirical negotiated transfer fee. Do not assign actual club strength by ID.

| Group | Mean base EUR | Mean genesis candidate ARC |
|---|---:|---:|
| Inactive | 10 | 500 |
| D1 / no cup | 165 | 2500 |
| D1 / Sovereign | 185 | 3100 |
| D1 / Federation | 175 | 2800 |
| D2 neutral | 140 | 1700 |

Hypothetical persistent top D1 **EUR295**; hypothetical low-table D2 **EUR100**. New neutral genesis candidate total 591200 ARC, reserve separate 2.4M. Genesis coefficient still unapproved; optional additional capital not included. See full 320-club output, cost and generation sensitivity in [results](club-license-renewal-v2-results.json). Reproduce `node tools/run-club-license-renewal.mjs --check`. Isolated JS checks preserve v1 output and anchor fixtures; repository CI pending.

Remaining: test linked age-specific player market and actual negotiation/transfer cash flow, club/agent affordability and productive sporting demand, observed unit generation costs, free entry, exact per-club strength and capital schedule, reserve and arrears under revised acquisition/retirement demand. Prior financial stress used fixed replacements and automatic AI fallback, so no longer supports a full supply/solvency claim. #775 owns ledger; #586/#777/#779 own actual lifecycle, #782 checkout. No implementation of payment/fee/ledger or remote actions.


Latest owner cost direction: defer expensive generation until activation; all-offer cost sensitivity above is historical. See [retirement-matched recycling](academy-renewal-recycling-v2.md).
