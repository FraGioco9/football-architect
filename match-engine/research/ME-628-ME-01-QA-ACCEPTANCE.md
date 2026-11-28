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

## U-01C-R1 — full-field regression containment (candidate)
Hosted U-01B ME-01 run 46144145253: 593 passed, 1 failed, 2 skipped. Existing full-field HOME variant 2 reached a real throw-in at played tick 377, then stalled for all 1,800 restart approach ticks: home-8 blockedBy away-8, no hand contact or take. This is a downstream regression after the carry changes; exact causality not yet isolated. Preserve the full-field test and original restart authentication unchanged. Added a bounded live non-taker clearance target for a nearby blocking player during a verified throw-in; uses actual IDs/positions, ordinary kinematics and existing detour helper, no changed physical authority. Pure mirrored/near-end helper regression (24 assertions) PASS, real replay pending. U-01C carry-context/kinematics changes deferred until the regression is cleared. Admin rehearsal was SKIPPED on U-01B.

## U-01C — open-space motion candidate (not certified)
Shared reference kinematic configuration and pursuit offset, live >6 m nearest-opponent context; common movement phase used by subsequent carry contact selection when still in open space. Existing locked configurations checked against prior source for all three phases and four historical ratings; no attribute changes. Opposed path stays U-01A; restart/recovery/slide priority remains. Source-level preflight 204 assertions PASS, no Rapier or browser certification. Candidate deliberately not published to PR HEAD until R1 focused regression evidence completes. Threshold, pace and real collision behavior remain provisional.

## U-01C-R2 — common carry context and movement precedence (prepared candidate)
Movement and contact now use the same active-opponent selector, including goalkeeper and stable ID tie-break. Open carry target, kinematic limits and emitted pace are only selected after restart, recovery, balance, active slide, shoulder and delivery priorities are evaluated. This fixes a source-level candidate inconsistency; not evidence that the existing full-field goal gate is resolved. Added mirrored and polarity helper contracts. No changes to contact authority, rules, fixtures, thresholds or test gates. Candidate is staged off the PR branch to defer hosted CI.

## U-01D — shared live carry stride candidate
Native guarded open play now consumes the same-tick carry phase selected by common movement, with the same cadence and forward stroke formula as reference Solo Carry. Only active outfield carriers are eligible; recovery and non-carry decisions use normal poses, returning continuously within the existing 7 m/s shoe cap. Existing single open-play collider versus two solo colliders, restitution, historical non-phase gait and physical authorization unchanged. 4392 pure source assertions PASS across HOME/AWAY, polarity and 120 consecutive ticks per phase; no actual Rapier or browser run. Off-branch candidate, pending grouped acceptance; missing full-field goal remains unresolved.

## U-01E1 — native shoe geometry and actor-contact reducer
Common shoe geometry/material descriptor and Rapier collider construction now serve the standard shoe and both physical Solo Carry shoes. Historical dimensions/materials remain unchanged (standard versus legacy ground). Shared two-foot transition helper reduces native left/right sets into actor START/END and exclusive physical START; refuses mismatched started/active foot identity, does not create events. 418 source assertions PASS including all 64 previous/next/start combinations and all 15 legacy scale pairs. No Rapier replay. Not yet enabling a second collider in native open play: downstream action/cushion/restart gates, native contact aggregation and physical count contracts must migrate together. Ball/turf restitution still differs; do not claim physical parity. Candidate off PR branch, CI deferred.

## U-01E2 — paired native open-play shoe candidate
Native guarded open play now creates two continuously positioned colliders per physically active actor (including keeper; inactive placeholders excluded), common two-foot stance/phase gait and material factory. Aggregate true native START/END, forces and both manifolds per actor; retain per-foot exclusivity and actual contacting shoe position for ground receiving. Native action and grounded restart authorization require genuine single-foot exclusive START in addition to existing actor/physical gates. 324 pure helper assertions PASS; no Rapier/Node/browser execution. Legacy Solo Carry and single-shoe historical LABs retain their material/geometry and count; this candidate is not yet parity across all LABs. Need physical count, liveness, restart, aerial/cushion and replay validation plus remaining legacy migration and ball/turf material convergence. Off PR branch, no CI.

## U-01E3 — ordinary isolated LAB pair migration candidate
Native selected-participant scenarios now use the same paired shoe bridge even without a body guard, including ordinary pass/cross/shot, isolated keeper/defence and collective cases. Legacy ground-carry and first-time-shot cases explicitly deferred (dedicated physical/recovery contracts). Both shoes use the same collision-group rule and existing standard material profile. Added actual collider-count readout without replacing actor-ID readout, stricter pair identity/count/foot validation, and physical exclusivity in remaining historical receiving authorization branches. 350 pure helper assertions PASS including existing U-01E2 matrix with explicit pair provenance. Added real Rapier test for collider counts 2/4/14/44 and active IDs in HOME/AWAY, NOT RUN. No physics outcome, continuity or goal claim. Remaining: first-time shot recovery, legacy carry material/geometry, actual all-LAB acceptance and full-field goal regression. Off PR branch; grouped CI deferred.

## U-01E4 — first-time paired strike and authentic-foot recovery candidate
First-time shot and tap-in now enter the shared paired bridge. Strike evidence records the actual exclusive physical foot and pose. The existing six-tick release target applies only to that shoe, following genuine immediately preceding Rapier contact and applied shot; the other shoe retains ordinary stance, and both retain the 7 m/s total travel cap. Tap-in retains no extra release profile as before. 232 pure helper assertions PASS across both teams, both feet, both release directions and ambiguous/missing provenance. Historical single-shoe adapter still supported but not selected for current first-time LAB. Rapier shot matrix, post-strike clearance and goal evidence NOT RUN; no claim of physical equivalence. Legacy ground carry/material and full-field missing-goal gate remain open. Off PR branch; CI deferred.

## U-01E5a — common carry material candidate
Current physical isolated Carry/Dribbling now use the ordinary ball/turf restitution and friction, standard shoe material/height and standard guarded body geometry rather than a scenario-selected zero-bounce ball and raised low-profile shoe/leg. Explicit historicalCarryPhysics/diagnosticHistoricalCarryPhysics archive option preserves the original material baseline; existing intent-only comparator remains historical, and historical paired scale experiments explicitly pin that mode. Current fixed phase native carry is not automatically historical. Shoe research scale values remain explicit experimental knobs. 22 pure material assertions PASS (actual source), no Rapier execution. Solo already has paired real feet, isolated duel still uses historical single-shoe stride topology: migrate that separately before claiming complete parity. No calibrated rebound/contact outcomes or goal/liveness certification. Off PR branch, CI deferred.

## U-01E5b — paired isolated duel candidate
Current isolated dribble/defensive duel now selects the same paired shoe bridge as collective play, not the historical single-shoe path. Both duel actors have two real shoe colliders. Current same-tick carry movement may emit the shared observed phase; recovery, slide, shoulder and delivery priority suppress that phase. Existing directed duel action restrictions/selector unchanged, and the executor already requires exclusive physical single-foot source. Explicit archived carry material option still selects historical single-shoe duel; current Solo Carry retains existing two-foot diagnostics adapter. Added collider/material readouts and 28 pure eligibility/provenance assertions PASS in V8. Added actual Rapier first-tick allocation/material regression across HOME/AWAY, directed/ordinary and archive/current; NOT RUN. No physical or behavior acceptance. Remaining: converge Solo Carry adapter, opposed carry action policies, cooldown and action masks; investigate full-field goal regression. Off PR branch, CI deferred.
