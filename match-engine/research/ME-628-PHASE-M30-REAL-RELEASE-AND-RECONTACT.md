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
