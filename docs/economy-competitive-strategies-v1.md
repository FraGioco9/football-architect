# Competitive club and agent strategy experiment — DRAFT/HOLD

Owner direction: reward the best managers, not universal individual profitability. Nine synthetic 100-season paths, three matched seeds per variant: random-label control, mixed public-information strategies, and mixed strategies with selective purchasing. 6400 initial players mixed 16–32, 256 active clubs and 256 prospective agents, AI mandates initially, zero personal wallets. Same 2.4M seasonal reward pool, 99% ARC/90% EUR youth and candidate initial mandate pricing, +10% valuation, 5% executed secondary fee, guarded fixed wage affordability, zero staff costs. No actual roster/demand data. Identical initial seeds; diverging decisions consume RNG differently, so later shocks are not paired exactly.

Labels assigned before outcomes, agent groups 85–86 each, club labels stratified by initial country/division/cup. No profit quotas or direct skill-based rewards. Random control applies identical behavior regardless of label and reproduces preceding reference reserve minima. Mixed strategy clubs sample free agents by role: random one, intermediate best current public skill among up to three, expert best current skill plus two-year public growth proxy among up to eight. Same salary budget/guard and acceptance rules, no bonus, no hidden aptitude/retirement info. Sporting results use the existing synthetic skill/noise proxy, not match engine. No full negotiation or club license profit model.

Mixed agent strategies: random affordable choice; intermediate best of two sampled offers, expert best of up to eight by public expected remaining benchmark earnings adjusted for current fixed contract wage and bounded skill-based employment proxy relative to price; expert secondary buyer rejects asking price above estimate and seller rejects net offer below 80% of estimate. Same assumed budgets and currency preference. Selective variant additionally uses conservative 88% raw benchmark plus known contract adjustment; intermediate minimum forecast/price .93, expert 1.03; expert seller minimum net proceeds equals estimate. These are illustrative behavioral policies, not fitted or production rules. Candidate ranking uses affordable ARC price if available, else EUR nominal equivalent, not a fully optimized currency or risk model. Agents can refuse purchases. No guaranteed future resale or hidden data.

Per-user ledger: reconcile actual ARC wallets, salaries, ARC spend and net resale; EUR spending separate. Closed mature tenure cohort bought through season70, no unrealized valuation credited. Closed net combines ARC net and EUR cost at purchase denomination only; this is virtual nominal comparison, NOT actual cash profit or annualized return. Report open positions separately. Club metrics season21–100: actual rewards less paid wages, treasury movement plus net sporting transfer principal, D1/cup season shares; no owner withdrawal or EUR return. Stock/tenure/club cash checks.

## Results

| Variant | Final population | Annual regime reserve gap | Minimum reserve for 100 seasons | 24M financed seasons |
|---|---:|---:|---:|---:|
| Random control | 6400 | 90–96k | 16.88–17.99M | 100 |
| Mixed scouting | 6400 | 36.7–44.8k | 13.21–13.53M | 100 |
| Selective mixed | 3927–4018 | 917–926k | 87.50–88.42M | 29 |

All nine diagnostic paths zero year-end wage arrears. Reserve acceptance stops before unfunded full pool, later diagnostic path not authorized issuance. No structural sustainability.

Mixed scouting club sporting results, shares of seasons21–100: random D1 20.1–21.2%, cup 2.59–2.81%; intermediate D1 54.3–56.2%, cup 17.7–18.4%; expert D1 73.9–74.6%, cup 35.4–35.6%. Expert club median 80-season operating surplus 98–3031 ARC vs random -401 to324; expert share positive 51.2–60.7%, random44.2–56.0%. Expert clubs 31–35 of 64 top operating-surplus ranks vs random7–10. Sporting advantage clear in proxy, financial advantage weaker.

Mixed scouting agents: aggregate closed-tenure recovery random87.0–87.3%, intermediate85.1–85.3%, expert83.2–83.8%; median nominal closed net negative for every group (-106–112k, -142–147k, -183–189k respectively). No agent positive on mature combined closed cohort across all six initial paths. Expert scouting proxy fails: favoring costly apparent value without rejecting poor investments does not produce gains.

Selective mixed agent outcomes:
| Strategy | Median closed ARC net | Median combined closed nominal net | Positive closed nominal share |
|---|---:|---:|---:|
| Random | -78.1k to -71.8k | -103.0k to -86.6k | 1.2–5.8% |
| Intermediate | +10.9–11.8k | +12.4–15.2k | 92.9–97.6% |
| Expert | +10.3–11.8k | +12.8–14.4k | 97.6–98.8% |

Expert closed aggregate nominal recovery 132.9–136.2%, intermediate116.6–120.9%, random93.3–93.7%. Median EUR spend experts EUR65–80 over full simulation, intermediate EUR184–196, random EUR3842–3964. Median open positions expert1–2, intermediate2, random42–43: strategies trade markedly different volumes; raw gains are not controlled for capital at risk or time. No clear expert absolute gain superiority over intermediate. These strategies favor few deals and starve youth recruitment. All clubs positive operating balance in selective diagnostic due to much smaller rosters and lower payroll, not desired competitive balance. Thus no candidate passes simultaneously skill differentiation, demographic stability, club economic competition and permanent reserve funding. Do not infer that random agents are better or that successful user share is fixed.

Next: calibrate intermediate reservation thresholds / diverse player public information / negotiated contracts and resale, realistic agent budget constraints, and club recruitment that accounts for wage demands and squad scarcity. Test distinct agent-only and club-only strategy interventions; avoid treating all conservative users as experts or simply lowering every price. Maintain approved settings until a candidate supports a viable population, genuine management advantage and aggregate circulation. No forced spend, free rights, new mint or bailout. No runtime, DB, payment, deploy or merge.

Reproduce `node tools/run-economy-competitive-strategies.mjs --check` and `node tools/run-economy-competitive-strategies.mjs --disciplined --check`. Nine full paths executed in isolated JS. Short regression added; repository Node/CI pending.
