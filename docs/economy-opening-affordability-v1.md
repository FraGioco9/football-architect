# Opening affordability and realized salary exposure — DRAFT/HOLD

Owner-authorized next research slice. Mixed initial ages 16–32 (synthetic distribution), canonical club IDs/memberships, 6400 players, 256 human agents, zero opening wallets, 1,234,400 ARC club genesis, 2.4M prize candidate. Keep 99% ARC / 90% EUR youth quote, +10% raw valuation, 5% executed secondary mandate fee proxy, no staff. No actual roster or wallet data, no actual free mandate allocation authorized.

Extend prior guarded signing policy to opening contracts: retain sampled fixed 1–3 season terms and relative salary weights, scale proposed opening wages downward if their cumulative half-season obligations exceed actual treasury plus current participation awards and conservative D2 participation in later years. Apply existing division minima; fail if those minima cannot fit. This is a synthetic origination policy, never a cut to a signed salary. Renewals/transfer affordability uses same previous guard. Promotion floor implementation, full production holds/independent authorization still open.

Compare random opening mandate assignments vs greedy balance by opening annual wage entitlement (not number of players, not a grant recommendation). Both remain wholly synthetic. Three reference seeds for each = six training paths. Compute average last-ten paid wages / full-population sum of K214 suitability wage benchmark on three balanced reference runs, including unemployed players in denominator. Result 1.0056936622239494 (approximately +0.57%). Apply as a constant public forecast exposure sensitivity to market value only (before +10% multiplier and existing rounding), not actual contract wages or changed K. It is aggregate exposure, not employment probability, and can exceed one. Test with three independent seeds across three demand scenarios = nine validation paths, 15 total 100-season paths. Not evidence of actual behavioral demand.

Track gross actual paid salary by individual activated player including eventual arrears, even after mandate resale. Retired cohort purchased seasons21–70 (all retirements observed by season100): compare aggregate gross career wages with purchase-time displayed valuation. This measures player-level earnings, not agent net return, as ownership may change and secondary prices/fees are separate.

## Results

All 15 diagnostic paths have zero arrears at both payment milestones throughout 100 seasons (year-end peak zero; half-season zero follows conservative guarded prefix assumptions; see trace). Opening contracts scaled in 169–182 of 256 clubs, first-year wage bill ~1.920–1.938M ARC vs ~2.4M anticipated rewards. Later actual wages approach the full-reward planning target (~2.398–2.400M reference in last ten), no forced salary adjustment. Full population 6400, with ~5987–6082 employed in reference validation/training.

| Scenario | Minimum opening reserve for 100-season path | 24M reserve completed seasons | Closing arrears |
|---|---:|---:|---:|
| Random mandates, reference | 17.66–18.10M | 100 | 0 |
| Balanced mandates, reference | 17.19–17.39M | 100 | 0 |
| Balanced + exposure, reference holdout | 16.75–17.07M | 100 | 0 |
| Balanced + exposure, low EUR holdout | 10.40–11.09M | 100 | 0 |
| Balanced + exposure, high EUR holdout | 41.02–43.87M | 41–43 | 0 (diagnostic) |

Reserve acceptance uses exact no-injection prefix of a reserve-independent diagnostic path, stopping before an unfunded pool; later diagnostic continuation with tracked hypothetical injections is NOT authorized currency creation or accepted funding. 24M remains an option, not a chosen amount. No structural sustainability demonstrated.

Reference balanced opening annual salary income per agent is about 7484–7578 ARC across training seeds, versus random min 2936, max15880. End of training, balanced wallet Gini 0.296–0.318 vs random 0.303–0.311, no robust lasting equalization. Holdout reference closing wallet stock 11.92–12.46M; p10 11681–16520, median 41945–45786, p90 81899–86970. Low EUR wallets 4.35–4.92M; high EUR wallets 37.50–40.30M (diagnostic). Initial allocation does not solve long-run wallet retention.

Holdout reference retired cohorts ~16.3k players per seed: average paid career 7235–7248 ARC, mean quoted value 8289–8297, ratio 87.28–87.44%. Raw benchmark observed wage exposure near one, so preserve K214 and +10% market premium rather than fitting the model to selected purchase cohorts. Rounded displayed quote intentionally includes premium; 99% ARC asking price is ~8207–8214 ARC per such average purchase, above gross career salary; not a guarantee of profitability for an agent. Low EUR selects cheaper candidates (paid/quoted ~95–96%). Observed payment mix, self-selection, ownership and willingness to pay matter. EUR reference gross last-ten 3081–3524/season, low 964–1089, high 5797–5879. Not actual revenue or profit.

Next: retain opening affordability design as candidate; do not mandate balanced/free agent rights or alter valuation from this small synthetic calibration. Long-run circulation requires testing voluntary agent willingness to buy relative to gross career returns and alternative initial funding/adaptive reserve policies, no forced spend or imaginary fee. Explicitly settle launch acquisition of existing mandates (no free grants assumed outside the synthetic stress) and reserve policy with owner. No runtime settings, live ledger, DB, checkout, deploy or merge.

Reproduce `node tools/run-economy-opening-affordability.mjs --check`. 15 full paths executed in isolated JS with stock/population/arrears invariants; historical three-season equivalence checked. Short CI regression added; full Node/CI not yet verified.


**Owner selection:** existing-player mandates must be purchased; all remain AI/unrepresented until acquisition. The random/balanced synthetic opening assignments above are historical counterfactuals, not the launch model. See latest owner decision in economy-approved-draft-v5.md. Pricing/currency pending calibration.
