# #628 M30 — real second shoe tap and genuine ball-release audit

M29 showed 120 original native shoe ACTIVE ticks, 120 solver-contact manifold ticks and 112 force-report ticks, but **no separate shoe END/START**. The original un-kicked M27 path therefore cannot be called repeated football touches.

M30 introduces one explicitly opted-in **CONTROL > M30 Real ball release / recontact** research variant in the **existing** Scenario dropdown's Control Scene select (no sixth top-level scenario). It preserves all 22 canonical players, one original Rapier ball/World, mirrored HOME/AWAY initial conditions and original autonomous movement.

At the **second genuine exclusive native receiver shoe START only**, require original physically applied #10 PASS, true M25 receiving impulse, M27 measured defender gap and `defer-clearance-to-keep-ball-near` choice; then, only in the M30 opt-in scene, **replace that previously deferred clearance with exactly one bounded 1.35 N·s horizontal tap on the real ball**, direction from the receiver's *live velocity* (or current ball motion when the player is nearly still). Never also apply the original CLEARANCE. Reject close-pressure, distant ball, excessive relative speed, invalid input and forbidden core option combinations. No synthetic collision, teleport, staged touch, ball ownership or official action.

A new read-only 240-tick observer consumes the original event queue and Rapier contact-pair manifolds/solver, checks ordered 22 identities and consecutive ticks, and distinguishes:
- genuine receiver shoe END after the physical tap,
- a **new independent exclusive receiver shoe START after an END**,
- competing real opposing starts or a later genuine physical action,
- genuine pressure and physical ball travel, without extrapolation.

It records observed or missing evidence; **never presumes recontact happens**. A release plus new START is an independently observed touch *candidate*, not proof of controlled dribble, pass completion, tackle, interception or official possession. All official outcomes remain false. Previous M27–M29 variants unchanged; DEV/private HTTP allowlist retains public/non-DEV negatives. Regression tests include HOME/AWAY source-matched one-world A/B and deterministic replay.

Next acceptance requires natural release/reacquisition under meaningful opponent pressure and validated official football state transitions; the separate 2+ natural simultaneous Rapier **body** pairs condition remains open. PR #633 stays Draft/HOLD; no merge, deploy or DB changes.

## Observed positive Rapier source (HOME/AWAY, 60Hz, reproducible)

M30's same-world source-matched A/B and deterministic replay generated a genuinely independent physical shoe reunion on **both** mirrored sides. Original M25 cushion at tick 30; original independent second receiver shoe START at tick 63; same original M27 `defer-clearance` decision. Exactly one bounded 1.35 N·s horizontal M30 tap is physically applied to the original ball on tick 63; the original clearance is not applied at that tick. **Real Rapier shoe END tick 65**, followed by a **new exclusive native shoe START tick 136** (74 real observation ticks). Ball actually travelled 4.6130m HOME / 4.6132m AWAY, its largest real receiver gap was 0.7061m / 0.7062m. There were **13 original-defender-within-3m ticks**; minimum actual defender gap was 2.4668m / 2.4670m. No opposing shoe START occurred before recontact. On that new native receiver START tick 136, the ORIGINAL uniform policy issued a REAL `clearance` action. This confirms **release + a new independent physical interaction**, not sustained controlled dribbling or possession; no opponent shoe-ball duel yet. All official booleans remain false.

[ME-01 exact-head M30 initial gate](https://github.com/FraGioco9/football-architect/actions/runs/43921066474): 392/392 Node tests, 10/10 DEV security/routing plus Chrome LAB/viewport checks PASS. This final research hardening additionally makes the positive native END/START, original subsequent clearance and real defender pressure mandatory in the mirrored M30 tests.
