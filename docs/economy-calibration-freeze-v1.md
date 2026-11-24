# Economy calibration freeze — provisional development baseline (24 November 2026)

Owner direction: pause numerical economic calibration and synthetic agent/club strategy experiments until the actual player contract rules are sufficiently defined. Preserve all existing research code, configuration, seeds, snapshots and negative findings. Use the following working reference for downstream development/design, not as final launch settings. This freeze supersedes the previous recommendation to run further speculative calibration now. Values remain configurable DRAFT, not a runtime activation or merge authorization.

| Parameter | Frozen working reference | Status |
|---|---|---|
| World seasonal Rewards | 2,400,000 ARC; D1 160k/league, D2 80k/league, Sovereign 320k, Federation 160k | Existing baseline |
| Gross fixed salary allocation | 100% actually paid to valid human agent; AI/unrepresented 100% reserve; no bonuses or extra wage fee | Owner direction |
| Club payroll | Aim to reinvest seasonal rewards in fixed wages in aggregate; no compulsory spend or guaranteed individual profit | Owner direction |
| Staff costs | None | Owner direction |
| Salary benchmark K | 214.05719342119738 ARC | Research reference only; not a replacement of the live K60 or signed contract salary |
| Public player market value | 1.10 times raw expected remaining paid salary before existing upward rounding | Owner direction; actual forecast needs contract design |
| Youth price | 99% ARC / 90% EUR of displayed value | Owner direction |
| Existing primary mandate price | 99% ARC / 90% EUR of displayed value | Provisional working reference, exact rates/currencies not final |
| Secondary marketplace fee | 5%; payer, settlement and rounding open | Owner direction |
| Initial platform reserve | 24,000,000 ARC | Research candidate, not selected genesis posting or guarantee |
| Total club genesis | 1,234,400 ARC in simulation; positive club-specific treasury incl inactive clubs | Candidate, exact allocation and capital pricing unresolved |
| License acquisition | EUR-only, indefinite until valid cession or qualifying inactivity; top D1 approx EUR300, lower D2 approx EUR100; gross multi-season sporting capacity basis, capital separately configurable | Owner direction; exact prices, opening capital influence and formula unresolved |
| ARC/EUR | 100 ARC per EUR purchase denomination only; no direct redemption | Owner direction |
| Opening population | Mixed ages; 16–32 synthetic reference, not final histogram | Owner direction / reference |
| Opening human mandate coverage / personal wallets | 0% / 0 ARC; paid existing-player mandates, no free grant | Owner direction |
| Youth supply | 768 offers/season, 16–19; activation only through verified purchase, no forced orders or fixed EUR share | Existing draft |

Competitive gameplay: only well-managed clubs/agents should be able to earn gains; no universal break-even guarantee or predetermined winner fraction. Preserve affordability and ledger invariants; distinguish user losses from platform-wide sustainability. The reserve does not prove permanent equilibrium. Existing synthetic experiments do not validate actual demand, profitability, real-money receipts, or a final wage distribution.

## Resume gate

#777 is the primary dependency: agree what fixed contracts players can sign (salary demand and allowed offers, duration/renewals, division minima and promotion behavior, public information, acceptance/refusal and negotiations, free-agent/AI/human mandate behavior, conflict-of-interest and affordability). Coordinate #778 payroll timing/attribution, #775 account authority and #763 valuation forecast; #587 transfers and #779 lifecycle where material. Earlier 1–3 season and salary-floor assumptions are provisional until reconciled with the actual contract design. No assumption of new final contract policy here.

After contract rules are reviewed, replace wage/renewal/acceptance proxies, rerun reproducible 100-season mixed launch and competitive-strategy cases with matched assumptions, assess population, club/agent returns, reserve conservation and actual funded obligations, then revisit price coefficients, reward scale and reserve if needed. Preserve historic results unchanged; version any future revision. No merge, production parameter switch, migrations, remote DB, external payments or deploy authorized by this freeze. #787 remains DRAFT/HOLD for review; related work may use the provisional references without treating them as production-approved.
