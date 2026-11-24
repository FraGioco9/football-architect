# Full agent salary payout — rate-only control (24 Nov 2026)

Owner decision: 100% of actually paid gross fixed salary to human agent, no salary commission or withholding. AI/unrepresented gross salary remains reserve-directed pending confirmation. No extra fee or prize rake. Existing secondary marketplace fee sensitivities are separate. Current main 2345a8c81a9e408dd299d579a0d002047a57c7c0; #765 already merged. DRAFT/HOLD, no live settlement, DB, merge/deploy. Canonical valuation version remaining-agent-salary-draft-v4-769; same K1500/slope2, employment/collection forecast, growth, retirement and floors as rate-only control; not a new empirically fitted model. Raw values multiply by 20, final rounding unchanged. Existing aggregate forecast still uses previous sporting assumptions; revalidate v4 fixed awards and actual day28/day56 timing in #769. No current agent type or private field affects value. Cache fingerprint changes; explicitly refresh index under separate authorized procedure; stale ranks fail closed, no new schema or implicit remote refresh.

## Rate-only numerical evidence

16 raw and rounded fixtures, 4 isolated test callbacks, 3000 numerical canonical generated players with placeholder identity banks preserving RNG draw counts. Actual repository tests/CI pending. Cohort rounded P10/median/P90 5500/29000/91000; hypothetical primary price P10/median/P90:

- 1.25% raw: 69/356/1126
- 2% raw: 110/570/1801
- 3% raw: 165/855/2701
- 5% raw: 274/1424/4501
- 25% raw: 1369/7119/22501

Old 25% raw price translates to 1.25% price-neutral under unchanged wages. No new price approved. Recalibrate actual world demand, reserves and conflicts before any financial implementation. Historical documents and old results superseded, not silently rewritten.
