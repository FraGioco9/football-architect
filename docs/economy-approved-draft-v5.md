# Approved economy target — DRAFT v5 (24 November 2026)

Owner approved the 2.4M seasonal Rewards/full human salary payout/90% youth price/5% secondary marketplace fee/top D1 EUR300/indefinite license configuration after #769/#770 research. Owner expressly deferred inactivity rules. Editable until launch; design approval only. Current main and #767 may still implement v3/v4 values; do not retroactively alter historical results or treat this document as an implementation, checkout, migration, deployment or merge authorization.

## Selected settings

| Parameter | Approved target or selected scenario reference |
|---|---|
| Purchase denomination | 100 ARC per EUR; no direct cash redemption |
| Human salary | 100% of actually paid gross fixed salary to valid human agent |
| AI/unrepresented salary | 100% to platform reserve |
| Club salary cost | Gross salary only; no additional fee, no bonus |
| Salary reference | K60, multiplier 2 per ten suitability, square-root reward response, benchmark 10000 |
| Division minimum | D1 40 / D2 20 ARC; prospective uplift on promotion, no automatic relegation cut |
| AI initial ask | +25% |
| Valuation research assumptions | Proximity-weighted versatility up to 10%, two-season renewal, zero discount, scale-25 synthetic employment/collection exposures, existing retirement/growth and upward display rounding |
| Youth purchase | 90% of displayed market value, payable directly in ARC or EUR; integer quote ceil(9 × value / 10) is implementation candidate, same number of EUR cents at stated denomination |
| Secondary marketplace fee | 5%; payer, settlement/refund policy and rounding remain open |
| Top D1 primary license | Approximately EUR300 / 30000 ARC reference; actual purchase modalities and other price bands remain open |
| License duration | Indefinite, no seasonal renewal or fee; ends on valid cession or qualifying holder inactivity |
| Inactivity | Expressly deferred; no automatic revocation, timer, forfeiture or forced sale approved |

## Rewards target (v4 fixed amounts scaled by 1/25)

| Competition | Entrants | Pool | Participation | Points | Placement/advancement | Participation per entrant |
|---|---:|---:|---:|---:|---:|---:|
| D1 (8) | 16 | 160000 | 96000 | 24000 | 40000 | 6000 |
| D2 (8) | 16 | 80000 | 48000 | 12000 | 20000 | 3000 |
| Sovereign | 24 | 320000 | 134400 | 57600 | 128000 | 5600 |
| Federation | 24 | 160000 | 67200 | 28800 | 64000 | 2800 |
| World | — | 2400000 | 1353600 | 374400 | 672000 | — |

D1 rank awards: 4800, 4400, 4200, 3800, 3600, 3200, 3000, 2600, 2400, 2000, 1800, 1400, 1200, 800, 600, 200. D2 exactly half. Sovereign champion 36000, runner-up 20000, each semifinal loser 12000, each quarterfinal loser 8000, each playoff loser 4000; 12 league-phase eliminated zero. Federation half. Only points allocated proportionally in integer ARC (Hamilton); tie-break/zero-denominator/certification exceptions remain gated. Day28 half participation: world 676800. Day56 remaining half plus certified results: 1723200. No day0. Rewards before payroll on both dates. No prize rake. Historical versioning must preserve actual evidence.

## Implementation boundaries

Prior 60M / 5% salary split, unscaled full-payout PR #783 (withdrawn), 1.2M alternative and earlier youth-price suggestions are historical. #771 and #773 contain evidence, not production payment code. Coordinate one new valuation version with scale-25 forecast and fixtures, preserve public privacy, versioned derived index and authorized refresh procedure; coordinate future reward configuration with #766/#767. No remote index action or migration here. Separate #775 ledger, #776 settlement, #777 mandates/contracts, #778 payroll, #779 lifecycle, #780 finance reads, #586 academy, #587 sporting transfer, #757/#781 license/rights marketplace, #782 checkout. No salary cap, forced spending, personal-to-club topups, treasury withdrawals, guaranteed profit or cash-out. Optional sporting expenses, initial user access, license price bands, inactivity, conflict-of-interest controls, actual demand, reserve funding/recycling, transaction rounding/refunds, legal/tax/payment-provider reviews still open; no new recurring revenue from license renewals.

## Implementation checkpoint

Read-only v5 calculator uses the scale-25 synthetic grid from #771 at 544ade3971111f1eddaaeff39a622813454caa8d. Raw and rounded fixtures: [[16,50,159.329115122,160],[16,60,1091.534745799,1100],[16,70,3831.523755708,3900],[16,80,10110.472433112,11000],[24,50,71.869795179,72],[24,60,412.712498491,420],[24,70,1627.773770483,1700],[24,80,4773.905230856,4800],[32,50,38.654145957,39],[32,60,118.366321112,120],[32,70,502.384455769,510],[32,80,1501.566971357,1600],[39,50,8.455123898,9],[39,60,25.732988384,26],[39,70,107.130660978,110],[39,80,316.666431323,320]]. Isolated V8 checks: 401 assertions across 13 synchronous callbacks; no repository CLI, full CI or browser run asserted. Existing index SHA-256 config fingerprint includes exposure grid; v3 rows fail closed for global value sorting/filtering until explicitly refreshed. No new schema or remote refresh authorization. Current/archived read-only Rewards estimates use current draft reference, not actual payments or historical rule-version evidence. Historical ledger data must not be repriced.
