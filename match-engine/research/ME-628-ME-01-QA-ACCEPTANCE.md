# ME-01-QA — Football fundamentals acceptance (#628)

Status: **OPEN / Draft / HOLD**. This is a new acceptance phase, not a claim of visual or behavioral completion.

## Immutable integrated baseline
- Main: `53138ec164b31e2a112334dc9a6e07ef918904cc` (squash merge of #817; tree `c6483e818ada1ad1625939802496a7c0a1ed1e2c`).
- #815 merged at `1dd8d4b604020f27d2f92615148053c20ec6ecb1`.
- #817 certified HEAD `67aa8e652ae56738890e9e271230707b387ce80b`, identical integrated tree.
- [ME-01 targeted 46138785599](https://github.com/FraGioco9/football-architect/actions/runs/46138785599), [Site 46138785587](https://github.com/FraGioco9/football-architect/actions/runs/46138785587), [Browser 46138785548](https://github.com/FraGioco9/football-architect/actions/runs/46138785548), [Admin 46138785531](https://github.com/FraGioco9/football-architect/actions/runs/46138785531), [gate 46138785540](https://github.com/FraGioco9/football-architect/actions/runs/46138785540): PASS on certified #817 HEAD, economic rehearsal inherited (not executed).
- Prior automated evidence is retained, not an owner visual acceptance or new QA execution.

## Inventory
Source: `match-engine/src/lab.mjs` setupUnifiedScenarioMenu and `lab-shot-calibration.mjs` profiles, verified against prior browser catalog contract (38 options). 34 individual fundamentals options below; four collective options are supplemental smoke coverage only. ME-06 remains the later ordered equal-sided validation.

| ID | Exact visible LAB value | Automated QA on QA candidate | Visual/behavioral QA | Notes / evidence |
| --- | --- | --- | --- | --- |
| CARRY-01 | `action:carry-solo:control` | NOT RUN | NOT RUN | — |
| CARRY-02 | `action:carry-solo:moderate` | NOT RUN | NOT RUN | — |
| CARRY-03 | `action:carry-solo:sprint` | NOT RUN | NOT RUN | — |
| PASS-01 | `action:pass-pair` | NOT RUN | NOT RUN | — |
| PASS-02 | `action:cross-pair` | NOT RUN | NOT RUN | — |
| PASS-03 | `action:lofted-short` | NOT RUN | NOT RUN | — |
| PASS-04 | `action:lofted-pass` | NOT RUN | NOT RUN | — |
| PASS-05 | `action:lofted-switch` | NOT RUN | NOT RUN | — |
| PASS-06 | `action:chest-control` | NOT RUN | NOT RUN | — |
| PASS-07 | `action:aerial-foot-control` | NOT RUN | NOT RUN | — |
| SHOT-01 | `action:shot-solo` | NOT RUN | NOT RUN | — |
| SHOT-02 | `action:shot-solo:low` | NOT RUN | NOT RUN | — |
| SHOT-03 | `action:shot-solo:placed` | NOT RUN | NOT RUN | — |
| SHOT-04 | `action:shot-solo:chip` | NOT RUN | NOT RUN | — |
| SHOT-05 | `action:shot-solo:curled` | NOT RUN | NOT RUN | — |
| SHOT-06 | `action:shot-solo:tap-in` | NOT RUN | NOT RUN | — |
| SHOT-07 | `action:shot-solo:power:first-time` | NOT RUN | NOT RUN | — |
| SHOT-08 | `action:shot-solo:low:first-time` | NOT RUN | NOT RUN | — |
| SHOT-09 | `action:shot-solo:placed:first-time` | NOT RUN | NOT RUN | — |
| SHOT-10 | `action:shot-solo:chip:first-time` | NOT RUN | NOT RUN | — |
| SHOT-11 | `action:shot-solo:curled:first-time` | NOT RUN | NOT RUN | — |
| SHOT-12 | `action:shot-solo:tap-in:first-time` | NOT RUN | NOT RUN | — |
| SHOT-13 | `action:header-pair` | NOT RUN | NOT RUN | — |
| SHOT-14 | `action:volley-solo` | NOT RUN | NOT RUN | — |
| GK-01 | `action:keeper-1v1` | NOT RUN | NOT RUN | — |
| GK-02 | `action:keeper-high-cross` | NOT RUN | NOT RUN | — |
| GK-03 | `action:keeper-high-intercept` | NOT RUN | NOT RUN | — |
| DEF-01 | `action:dribble-1v1` | NOT RUN | NOT RUN | — |
| DEF-02 | `action:dribble-1v1:standing` | NOT RUN | NOT RUN | — |
| DEF-03 | `action:dribble-1v1:sliding` | NOT RUN | NOT RUN | — |
| DEF-04 | `action:dribble-1v1:shoulder` | NOT RUN | NOT RUN | — |
| DEF-05 | `action:aerial-duel` | NOT RUN | NOT RUN | — |
| DEF-06 | `action:pass-pair:interception` | NOT RUN | NOT RUN | — |
| DEF-07 | `action:defender-1v1:block` | NOT RUN | NOT RUN | — |

Supplemental collective options: `action:defender-1v1`, `action:overload-2v1`, `action:duel-2v2`, `action:duel-3v3`. Not ME-06 acceptance.

## Acceptance by group
- **Carry phases:** Physical touch cadence, strength, speed, pursuit, continuity; no stuck player.
- **Passing:** Genuine delivery and separate reception contact, reachable flight, cushioning, follow-through, loss of control.
- **Shooting:** Real strike, trajectory/target choice, legal reach, correct action label, no fabricated goal; header and volley follow real crosses.
- **Goalkeeping:** One shot in keeper LAB, close-down, parry/dive/deflection, genuine hand contact, grip/pressure/punch and loss/release.
- **Dribbling & defending:** Contact provenance, tackle differences, shoulder displacement, possession recovery, interception, block, contested aerial reach and liveness.
- Audit shared fundamentals not isolated in a visible menu option: ordinary first touch, shielding, defensive clearance, header pass/clearance, keeper low challenge/distribution, off-ball support needed for the action. Locate authentic existing fixtures or record coverage gap; add only needed tests or shared-engine corrections. No new tactical phase.
- Real Rapier contact, bounded impulse, actual resulting movement and ball continuity; distinguish attempt from confirmed outcome. No scripted success or automatic possession.
- Run targeted physical checks against both HOME/AWAY and reproducible variants (30 seeded variants where supported), negative and contested cases. Review representative visual cases plus all flagged outliers; exact seed/side/time and observed action must be recorded. Do not demand a goal/save on every valid attempt.
- Browser: each visible option loads and starts; Play/Pause/Step/Reset, variant and side switching, deterministic replay, action panel reflects actual action; no freezes, exceptions, layout regressions. Chrome desktop; Safari/iPhone visual review where available. Automated browser success is not human visual sign-off.
- Use reference attributes only; no ME-07 calibration. No new engine implementation separate from the shared engine. Group changes, targeted tests where needed, final exact-head CI after coherent block. Keep existing protections; no deploy or database action.

## Evidence record template
Case ID / LAB / side / variation / exact candidate SHA / test or visual observation / actual outcome and timestamp / expected behavior / PASS, PASS WITH NOTE, FAIL, or NOT RUN / regression link / owner decision.

## Closure
All required rows and supplemental shared fundamentals must have explicit disposition and evidence; fix failures in this PR, record owner visual review, certify exact-head checks and obtain separate merge authorization. ME-02 remains on HOLD until this PR is accepted and integrated.

## U-01A — opposed carry intent parity (candidate)
The directed LAB wrapper and native open play now invoke the same live geometry/impulse proposal, without a fixture seed or caller-selected ceiling. The shared opposed cap preserves the existing directed limit (0.30 Ns); open space retains 0.42 Ns when no opponent exists. Stable head-on tie selection uses live ball Y. Candidate paired pure-helper regression covers HOME/AWAY, three field Y values, three opponent offsets, three ball speeds, 30 seeds and two ticks (3,240 pairs). This is **not** Rapier replay, visual acceptance, or completion of U-01. Fixed-phase Control/Moderate/Sprint impulse and movement, restitution, body/foot geometry and control/recovery remain open; existing historical comparator stays intact. Actual hosted tests pending.

## U-01B — reference open-space pace impulse (candidate)
Moved existing fixed-phase impulse formula and accepted 50-reference constants into one pure phase planner. The locked wrapper authenticates the exclusive shoe source and delegates, preserving the existing numbers. Native autonomous carry with a canonical actor and no opponent selects Control/Moderate/Sprint from observed speed and gap, delegates to the same formula, and remains subject to original action/contact gates. No new attribute calibration. Opposed carry remains U-01A; extension to realistic open space in the presence of distant opponents, common movement phase/foot contacts, restitution and actual physical replay remain open. Six paired HOME/AWAY phase cases plus second-half polarity, no-extra-impulse and missing-contact negatives added. Pure-source preflight 54 assertions PASS; not full Node/Rapier/browser execution. Visual acceptance NOT RUN.
