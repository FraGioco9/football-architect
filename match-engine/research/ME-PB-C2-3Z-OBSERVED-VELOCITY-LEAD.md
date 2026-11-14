# C2.3z — observed previous-ball velocity bounded tactical interception

## Why
C2.3y `ec8e4ce` improved the authentic AWAY static shoe-ball
clearance 0.173m→0.152m but generated **no new post-initial
AWAY-10 Rapier shoe START, no natural SHOT**. The real ball
remained 0.681m outside the unchanged original 35m shot range.
The prior near-miss showed translation-dominant lateral slip;
this is the next bounded **movement-target** experiment.

## Strictly source-bound opt-in
The separate DEV-only flag
`autonomousCarrySupportObservedBallVelocityLead:true` requires
all earlier existing flags, including C2.3y
`autonomousCarrySupportFootLateralLead:true` and a
same-session **genuine physical shoe PASS then later real Rapier
CARRY**, with <=4m current eligible post-carry support.

The mover *already* knows the previous actual Rapier ball from
its current input and the earlier real ball from the previous
60Hz input `lastBall`. The pair are **physically observed**
consecutive source frames, never sampled from the future.
Compute `12*(latestBall-olderBall)` (a 12 tick / **0.20s**
constant-speed estimate) and shift **only** the existing C2.3y
tactical target, capped at **0.50m TOTAL XY displacement**
and original pitch bounds. The input ball and real physical
collider are never moved by that forecast. Record actual
source ticks, both genuine earlier ball samples, requested
displacement, capped target and unmodified action authority
in a DEV-only provenance object.

Original 60Hz movement speed <=7m/s, acceleration 9m/s²,
braking 12m/s², turning 6rad/s, teammate hard guard 0.98m,
Rapier shoe collider, real physical START+ACTIVE and END
contact events, real actual ball impulse, 35m original
shooting threshold and production score/possession authority
remain unchanged.

## Verification and efficiency
Extend the **already registered**
`player-ball-carry-foot-lateral-lead-ab.test.mjs` to three
physical modes without adding a second duplicate expensive
test: C2.3v centre target (control), C2.3y foot-side lead
(control), C2.3z observed-speed target (candidate).
Both HOME IT and AWAY DE each have three true independent
720-tick 22-player Rapier worlds (six in total), plus a
seventh independently replayed AWAY candidate world.
Each of the six active worlds has an independent canonical
22-player mover receiving only **previous physical ball** and
physically authenticated same-world PASS/CARRY/shoe END.
Check every actor XY and turn bound, mode opt-out, source
ticks, earlier/latest real physical ball coordinates, exactly
12 observed-displacement ticks, strict 0.50m Euclidean
clamp, reset and all invalid experimental combinations.
Check no difference before the true PASS→CARRY eligibility;
audit actual Rapier shoe START+ACTIVE, every authorized
autonomous football action including any real SHOT, the
strict 35m shot boundary and ball progression.
Static geometry is diagnostic, never a contact substitute.

Keep one cumulative Draft/HOLD PR #481, no merge,
Preview or remote DB. C2 remains open and the overall
V1 progress stays 11/20=55% unless a real natural
physical SHOT is verified with exact-head CI.
