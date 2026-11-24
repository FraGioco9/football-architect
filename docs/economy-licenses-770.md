# #770 — license pricing, own-origin redemption and EUR sensitivity (DRAFT/HOLD)

Research only; no actual license sales, ownership change, user wallets, checkout, contracts, tax determination or remote actions. Canonical valuation version remaining-commission-draft-v3-769; previous slice #773 and #769. Current #765 base 180284b8adb63749924195f514bebf236bea767d changes the index/read path but not valuation math; this slice does not edit it. 24 runs ×32 seasons, 3 seeds, 24,576 fresh annual numerical generator profiles with explicit three-per-active-club origins; isolated V8 using placeholder identity banks, not full repository CLI. Each season verifies stock and license ownership conservation. All prices, user balances, purchase/listing/churn behavior, staff/base payroll, review and wage shock inputs are hypothetical.

## License pricing

320 licensable clubs, 256 active/64 inactive. One license per club, not one per account. Personal money only; treasury and historical club contracts unchanged on sale. No fee on primary sales besides the price; seller fee on executed secondary trade; voluntary listing (churn does not automatically forfeit title or confiscate wallets). No automatic expiry or guaranteed resale. Tier pricing for primary sale is an illustrative access/utility schedule, not a formula based on club cash, income, or agent commissions. Secondary consideration independently negotiated proxy (70–130% of tier primary reference, not binding). No future primary price guarantee, club treasury redemption or price change to existing ownership on promotion/relegation. Inactive clubs generate no youth or rewards; future participation not guaranteed. User shopping preference exogenous; no actual demand elasticity measured. Initial and new-account wallet grants are sensitivity inputs, not approved free credits.

| Case | T1/T2/inactive prices ARC | Initial personal wallet | Closing licenses | Closing active-club licenses | Primary sales total | Mean secondary trades/year (last 10) | Mean secondary fees/year |
|---|---|---:|---:|---:|---:|---:|---:|
| low | 1000/600/250 | 5000 | 319 | 256 | 319 | 19.8 | 602 |
| mid | 2500/1500/500 | 5000 | 317 | 256 | 317 | 17.7 | 1223 |
| high | 5000/3000/1000 | 5000 | 319 | 255 | 319 | 16.3 | 2081 |
| mid-wallet1500 | 2500/1500/500 | 1500 | 275 | 211 | 275 | 7.9 | 375 |
| mid-fee10 | 2500/1500/500 | 5000 | 318 | 256 | 318 | 16.2 | 2251 |
| low-wallet1500 | 1000/600/250 | 1500 | 315 | 255 | 315 | 13.4 | 360 |
| low-cost-stress-review | 1000/600/250 | 5000 | 320 | 256 | 320 | 20.1 | 621 |
| low-cost-stress-no-review | 1000/600/250 | 5000 | 320 | 256 | 320 | 20.5 | 605 |

## Own-origin redemption

The same personal candidate price applies; successful purchase and three-season club contract must be atomic. Check current license holder and current club tier at commit, exclusive mandate and candidate availability, fixed wage and term, separate club authority and personal affordability. No transfer from personal wallet to club. Independent review proposal: evaluate actual negotiated salary and three-season projected affordability; no mandated salary maximum or payroll percentage. Demonstrate conflict: if the buyer controls both sides, increasing salary by 10,000 ARC transfers up to 500 ARC/year from club funds to personal agent (only if paid), while 9,500 goes to reserve; 30,000 gross over 3 years. Do not permit self-approval solely on the basis of the license. An independent approval/control is a proposal, not an approved hard cap. The simulation uses a conservative review proxy: current cash + two future domestic guaranteed awards vs three-year base salary/staff proxy and existing obligations; assumes full three-year continuation of existing commitments, ignores future variable awards, may reject viable offers; no future award credited early. Review scope should be refined, not deployed. Current season participation is credited before the experiment's contract review; end-season payment proxy is not approved milestone implementation. Existing earned mandate retains attribution after license transfer. Fixed wages apply promotion floors, no relegation haircut; 3-season own contract paid obligations preserved until collected. No actual sporting squad integration, no retirements within these youth contracts, no later ordinary renewal/mandate income modeled in this *isolated* license slice. Ordinary candidates can be activated but their career income is excluded here; do not combine cash results with first slice as if one linked world. Base salary/staff proxy is separate; stress intentionally makes club obligations excessive.

| Case | Own offers (32 seasons) | Own redemptions | Rejected personal funds | Rejected review | Paid own commissions | Peak clubs with wage arrears |
|---|---:|---:|---:|---:|---:|---:|
| low | 3814 | 2328 | 1486 | 0 | 539016 | 0.0 |
| mid | 3687 | 1963 | 1724 | 0 | 429687 | 0.0 |
| high | 3146 | 1207 | 1939 | 0 | 233204 | 0.0 |
| mid-wallet1500 | 2145 | 76 | 2068 | 0 | 9536 | 0.0 |
| mid-fee10 | 3671 | 1947 | 1724 | 0 | 428766 | 0.0 |
| low-wallet1500 | 3151 | 705 | 2446 | 0 | 118665 | 0.0 |
| low-cost-stress-review | 3843 | 2464 | 393 | 985 | 3197319 | 0.0 |
| low-cost-stress-no-review | 3789 | 3596 | 193 | 0 | 4491437 | 83.7 |

## EUR cash-flow sensitivity

Illustration: 100 primary license orders/year at EUR25 and 1k/5k/10k youth orders/year at EUR3/5/10; 5% gross refunds, hypothetical 22% tax-inclusive rate, 2.9% + EUR0.30 processor fee on original orders (non-refunded), annual operating cost scenarios EUR5k/15k/30k. None is an actual rate, price, forecast, tax liability or provider quote. No fixed EUR/ARC rate, no direct redemption, no real-money return claim. Keep direct EUR pricing, ARC wallet purchase policy and secondary market currency decisions independent. Secondary EUR fees are excluded; no actual external cash flows inferred from virtual reserve.

| Youth ticket | Youth orders | Gross EUR | Contribution after refunds, illustrative tax and fees | Balance after EUR15k operating cost |
|---:|---:|---:|---:|---:|
| 3 | 1000 | 5500 | 3793 | -11207 |
| 3 | 5000 | 17500 | 11590 | -3410 |
| 3 | 10000 | 32500 | 21335 | 6335 |
| 5 | 1000 | 7500 | 5293 | -9707 |
| 5 | 5000 | 27500 | 19086 | 4086 |
| 5 | 10000 | 52500 | 36329 | 21329 |
| 10 | 1000 | 12500 | 9041 | -5959 |
| 10 | 5000 | 52500 | 37829 | 22829 |
| 10 | 10000 | 102500 | 73813 | 58813 |

Prior to any sale, jurisdiction-specific legal, consumer protection, tax, payment-provider, fraud, eligibility/age and indirect resale/cash-out review required. Design cancellation before execution as no fee; refund after execution reverses exact original split once, subject to eligibility and sufficient escrow/funds (no forced negative user balances, no new fee calculation). Pure reference split/refund checks PASS; not transactional or regulatory approval. No actual receipts or costs available. Do not advertise real profit opportunities.

## Proposed next owner review

Youth 25% raw value candidate; compare lower absolute access bands with real demand tests. License price alternatives are sensitivities, not approved prices; select whether primary license uses ARC, EUR or both without automatic conversion. Prefer seller-paid 5% secondary fee candidate, and separate own-origin independent authorization and affordability safeguards. Explicitly choose user access/wallet model, primary license activity/expiry policy, pricing and refund terms. Linked full world with all ordinary careers, real demand and legally reviewed EUR assumptions remains open. No production implementation, schema, payments, merge or deployment.
