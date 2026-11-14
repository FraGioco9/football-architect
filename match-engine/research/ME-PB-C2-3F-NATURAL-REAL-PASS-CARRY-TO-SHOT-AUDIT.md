# Match Physics V1 — C2.3f natural formation pass/carry/shot audit

Issue #480, Draft/HOLD PR #481. This C2.3f experiment uses the existing
opt-in `autonomousCarry` route and the SAME untouched canonical initial
22-player formation and real rolling ball starts already used for the
independent C2.3e natural progression diagnostic.

Two mirrored HOME/AWAY midfield scenes, each 720 consecutive real
60Hz Rapier ticks with fully independent second-world replay and
whole-frame equality, audit the actual sequence of authenticated
shoe START+ACTIVE → PASS, optional physical 0.42 N·s CARRY contact,
ball progression, attack-support movement intents, defender contact,
any subsequent real SHOT and whole-ball boundary observation.
Nothing scripts a shot or changes the physics, speed caps, initial
players, foot collider, football rules or production data.

This is an **exploratory test, not a guaranteed positive shot**.
A zero-shot sample must be retained as an actual negative result and
C2.3 must remain unchecked. If a genuine shoe-selected shot appears,
it is still merely a provisional Rapier physical shot: goalScored
and official result remain null. Count and describe carries only if
their real same-tick foot START/ACTIVE and bounded applied physical
impulse are verified; `dribbleConfirmed` remains null.

The output tracks each starting team's physical first PASS, true
CARRY shoe impulses, source actor IDs, original-team forward progress,
shot-range occupancy, any genuine SHOT and ending 3D ball state.
Use these measurements before considering separate, explicitly
reviewed tactical changes. C2.3e baseline and C2.3b isolated
shot-positive fixtures remain unchanged.

No merge, deployment, Preview publication or remote D1.

## C2.3g longer unmodified replay

The already accepted 480-tick physical trial is preserved as a frozen
checkpoint (live 3D ball centre, genuine CARRY count, authentic SHOT count
and maximum attacking progress). The same two independent physical worlds
continue for a further **240 normal 60Hz ticks**, without modifying the
starting formation, tactical code, shot criteria or foot geometry. The
final diagnostic compares subsequent 720-tick ball position, physical
CARRY events and authentic shoe-selected SHOT count to the real 480-tick
checkpoint. A no-shot result remains a **negative**, not an accepted C2.
