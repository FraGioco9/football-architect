# #628 M31 — true opponent shoe-ball challenge vs. receiver recontact

M30 confirmed a real original receiver shoe END at tick 65 and a renewed
exclusive START at tick 136, but without any opposing shoe-ball START. Mere
defender distance (2.47 m) and a new receiver CLEARANCE are *not* a genuine
tackle, interception or certified dribble.

M31 adds a second bounded variant to the **existing CONTROL scene selector**:
`receive-contest`. The only change from the M30 receiver-release scenario
is the BEFORE-tick-zero placement of the same original away/home midfielder
#7 closer to the receiver at mirrored (0, -3.8) instead of (2, -3.8).
The normal 22-player kinematic mover, initial no-overlap test, native Rapier
shoe collider and ball world are unchanged. The M30 1.35 N·s tap remains
conditional on a physically genuine receiver second START and safe existing
M27 decision: a nearby defender may legitimately prevent it.

A separate strictly **read-only M31 audit** starts only with an authenticated
actual M30 second receiver tap and observes 240 consecutive 60Hz source
samples. It records the original receiver shoe END/independent recontact and
**separately checks the first opponent's TRUE Rapier shoe-ball START** against
the same tick's collision and solver/manifold pair, distinguishing actual
opposing shoe contact from merely being within 2–3m. Additional fields
observe a competing action and physical ball travel. The observer deliberately
continues after the receiver's recontact, so a later real defender touch is
not masked by an early "complete" result.

The proper outcomes are evidence, NOT promises: if a natural opponent shoe
START does not occur, M31 must say so and leave the physical-duel gate OPEN.
Any future real opposing START is *only* a physical challenge witness,
not proof of tackle/interception, controlled dribbling or possession. No
official state transitions, new physics write, synthetic collision, second
ball/World or duplicate top-level LAB opener. All official flags false.

Negative guards: fake tick, bad 22-player identities, duplicate/noncanonical
shoe IDs, mismatching solver, invalid core/mover option combinations and
public/non-DEV module exposure. Mirrored HOME/AWAY deterministic replay and
unchanged original M30 A/B baseline must pass. No merge/deploy/D1 writes;
PR #633 remains Draft/HOLD.
