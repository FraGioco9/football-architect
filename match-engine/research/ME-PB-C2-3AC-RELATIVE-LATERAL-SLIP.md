# C2.3ac — source-bound last-metre relative lateral speed compensation

## Why this intervention
C2.3ab independently passed targeted 769/769 Node, 10/10 security,
Chrome LAB and benchmark but **failed physically**. Its additional
0.55m run-through body waypoint worsened the static oriented shoe
clearance 0.101m (C2.3aa) → 0.112m (C2.3ab), and did not produce any
new post-initial AWAY-10 Rapier shoe START or natural SHOT. The real
ball remained 0.681m outside the original 35m shot boundary. Prior
C2.3w/x measured predominant lateral relative shoe-ball translation,
not a collision blocker or faulty braking implementation.

## A different, explicitly isolated hypothesis
A separate sealed **DEV-only** `autonomousCarrySupportTerminalLateralSlip:true`
mode is a **sibling** to rejected C2.3ab, not built on its run-through.
It requires all C2.3aa opt-ins, including original actual same-world
Rapier shoe PASS → later real CARRY and currently <=4m supported run.
The lateral adjustment is eligible only within a **true 1.25m**
player-body-to-previous-real-ball XY gap. It explicitly refuses
simultaneous `autonomousCarrySupportTerminalRunThrough:true`.

The mover already receives the **previous real physical ball** and
remembers the preceding previous physics ball `lastBall`. Subtract
the runner's **canonical pre-step actual body velocity** times 1/60s:
`relativePerTick = (actualBallLater-actualBallEarlier)
                 - (actor.vx,actor.vy)*PLAYER_DT`.
Project this actual relative XY motion onto the **pre-step shoe-side**
unit vector `(-sin(actor.facingRad),cos(actor.facingRad))`, then shift
ONLY the C2.3aa original C2.3z **tactical body destination** by
`clamp(relativeSideMotionPerTick*6,-0.40m,+0.40m)` along that side.
This six tick / 0.10s speed-matching estimate aims to reduce the
observed lateral slip rather than moving the actor farther through
the ball; it is NOT a future physical frame read. An independent
source audit proves every ball XY and canonical actor vx/vy, the
side projection and signed bounded target; at pitch borders the
normal clipping rules apply.

The actual mover STILL uses the identical canonical 60Hz capped
7m/s speed, 9m/s² acceleration, 12m/s² brake, 6rad/s turn,
0.98m teammate safety spacing; the unchanged 22 physical Rapier
shoes, ball solver, real START+ACTIVE policy, possession/scoring
and hard 35m shot range are never modified. No direct
player/ball translation, synthetic contact or script-shot action.

## Deterministic real physics A/B
Extend the **already registered** `player-ball-carry-foot-lateral-lead-ab.test.mjs`
to six isolated configurations HOME IT/AWAY DE × C2.3v/y/z/aa/ab/ac:
**twelve genuine 720-tick physical 22-player Rapier worlds**,
each with its own independent canonical 22-actor mover witness
fed only previous real physics ball and subsequent true PASS/CARRY
and real shoe END. A **thirteenth independent AWAY candidate Rapier
replay** verifies exact determinism, without duplicating the whole
registered test suite.

Verify strict sealed flags, reset/opt-out, mutually exclusive runway,
source PASS/CARRY, tick-valid previous real ball, canonical
pre-step vx/vy, signed relative side speed, <=0.40m Euclidean
correction, initial identity vs C2.3aa before eligibility,
actual per-tick physical player XY/speed/facing, real Rapier
shoe START+ACTIVE, original autonomous football actions and
unchanged 35m shot range. A static shoe gap is *diagnostic*, never
a real physical collision; a real physical START does not
alone qualify a shot without unchanged policy choosing SHOT.
Parent C2 / issue #480 stays **11/20=55%** until actual natural
shoe-gated SHOT. PR #481 remains one cumulative Draft/HOLD
commit; no merge/deploy/Preview/remote D1.
