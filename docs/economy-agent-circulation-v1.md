# Agent tenure economics and ARC circulation — DRAFT/HOLD

12 synthetic 100-season paths (three seeds for each of four variants), paid mixed-age launch, all initial mandates AI and wallets zero, existing and youth primary 99% ARC/90% EUR research reference, +10% raw valuation, 2.4M seasonal prizes, guarded opening/renewal contracts, no staff, 5% secondary fee. Existing mandate pricing remains unapproved. No new currency issuance in accepted reserve prefixes. Same EUR250 annual hypothetical budget/person and shopping assumptions as reference. No actual demand or sporting roster data.

Track each exclusive human mandate tenure separately: purchase price/currency, earned actual salary by immutable obligation tenure ID, net sale proceeds after fee, retirement or resale closure, no double ownership. Reconcile every individual ARC wallet with salary + net resale - ARC purchase spend each season; EUR cents separate. Mature acquisition cohorts through season70 (24+ seasons observation), classify existing/youth/secondary and ARC/EUR. Recovery = (paid ARC wages + net ARC resale)/price; EUR denominator is cents at the configured purchase denomination, NOT redeemable cash or monetary return. No unrealized market marks; no guaranteed return. Historical reference paths reproduced (same reserve minima and EUR flows). Closed tenure may end before retirement, so this differs from gross player-career income.

Reference phases (annual averages across seeds shown as ranges):
| Phase | Prize recovery | Annual reserve gap ARC | Annual wallet growth ARC |
|---|---:|---:|---:|
| 1–10 | 87.87–88.56% | 274444–291212 | 121405–135468 |
| 11–20 | 82.91–84.03% | 383309–410177 | 365849–395531 |
| 21–100 | 96.00–96.25% | 89975–95918 | 88473–94105 |

At regime AI and initial primary receipts zero; reserve recovers youth ARC and actual secondary fees only. Club cash increases ~1.5–1.8k/year; remaining gap is wallet growth. Annual market volume ~701218–706225 ARC; fee ~34971–35221 ARC. At unchanged flow a 5% fee would require another ~1.8–1.92M ARC annual trade principal to cover residual; this is static arithmetic, not a demand forecast or justification for artificial turnover.

| Reference closed tenure | Aggregate nominal recovery | Fraction recovering cost |
|---|---:|---:|
| Existing ARC | 89.1–92.6% | 33.0–36.5% |
| Existing EUR (denomination only) | 95.7–97.1% | 39.3–41.5% |
| Youth ARC | 88.0–88.2% | 25.9–26.3% |
| Youth EUR (denomination only) | 95.1–95.8% | 38.0–39.8% |
| Secondary ARC | 100.6–101.5% | 44.3–44.7% |

Youth ARC mean cost ~7723–7753; gross salary during tenure ~5227–5233, net resale ~1575–1599. Secondary mean positive does not imply most profitable. Recovery is not annualized; EUR is no real return. These results reveal a weakness of assuming purchases solely on affordability.

| Variant | Regime recovery | Annual gap ARC | Annual secondary fee ARC | Min initial reserve for 100-season path |
|---|---:|---:|---:|---:|
| No secondary | 95.34–96.22% | 90712–111900 | 0 | 16.98–18.75M |
| Reference (3% listing attempt per player/season) | 96.00–96.25% | 89975–95918 | 34971–35221 | 16.88–17.99M |
| Active market (12% listing attempt) | 97.14–97.29% | 65116–68700 | 138159–139372 | 16.20–16.37M |
| Return-sensitive (3% listing attempt) | 26.98–27.38% | 1.743–1.752M | 14673–15170 | 160.08–161.28M |

Secondary attempts and random bilateral acceptance conditional on affordability are synthetic, not endogenous rational seller pricing or actual demand. Raising listing frequency fourfold raises fees but displaces primary ARC spend and lowers original youth ARC tenure recovery to 84.4–84.7%; only 14.3–14.8% recover price. No fee change proposed.

Return-sensitive buyers require expected raw public remaining career wages >= asking price times a fixed heterogeneous reservation threshold spanning 0.85–1.15. Apply separately to funded ARC and EUR options and secondary ARC purchases; no observed elasticity, discounting, utility, sophisticated seller model or guaranteed resale. EUR nominal discount shifts choices toward EUR; annual gross youth EUR last10 ~16352–16965 versus ~3070–3248 reference, but severe ARC leakage. Final population 6201–6274 versus 6400 other scenarios; 24M funds only 21–22 seasons. Diagnostic continuation is not funded. All 12 zero year-end arrears under modeled affordability. No acceptable permanent balance. Do not solve this by simply increasing reserve or forced purchases.

Recommendation: reconcile acquisition quote incentives against actual paid income and distinguish public market value from asking price; calibrate ARC vs EUR and optional genuine gameplay value / purchasing preference with owner before changing approved numbers. Test lifetime return and endogenous demand across price alternatives (retain current 99/90/+10 reference and 5% fee); use zero-issuance reserve prefix and population constraints. Need actual willingness-to-pay evidence before commercial projections. No new spend mechanism, taxes, issuance, runtime, DB, payment, deploy or merge authorization.

Reproduce separately: `node tools/run-economy-agent-circulation.mjs --check` and `node tools/run-economy-agent-circulation.mjs --alternatives --check`. 12 full paths executed in isolated JS; per-agent wallet and ownership, aggregate stocks and phase conservation checks passed. Full Node/CI pending. Short regular CI test only; full runs separate.
