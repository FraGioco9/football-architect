# C2.3v — previous-real-ball shoe-centre-adjusted runner target

## Motivation
C2.3u reached **0.203m** minimum static oriented shoe-ball
clearance (vs **0.460m** earlier), while observing **zero genuine
post-initial forward shoe START** and no natural SHOT. Both exact-head
TARGETED and FULL were accepted at `3e923d7`. The physical ball
also remained **0.681m outside** the original 35m shot range.

## Closed, opt-in hypothesis
An existing **authenticated same-world real PASS→later real CARRY**
post-carry supporter, already qualified by the original
`autonomousCarrySupportBallAccess` (including current gap <=4m,
C2.3s lateral alignment and C2.3u bounded early facing), may
move its *tactical destination* toward a desired body location
whose **actual 0.22m forward shoe centre**, using the **pre-step
actual facing**, aligns with the **previous real ball centre**.

The prior original target is `(ball.x - attack*0.26,
ball.y + boundedLateralShift)`. The raw shoe-centre target is
`(ball.x - 0.22*cos(preStepFacing),
ball.y - 0.22*sin(preStepFacing))`. Clamp to original
pitch bounds and cap the entire 2D correction vector at
**0.30m**, not 0.30m per axis. This is a bounded destination
correction only: the original 60Hz integrator, 7m/s speed,
9m/s² acceleration, 12m/s² brake, 0.98m teammate guard,
6rad/s facing, 22 unchanged rounded shoe colliders and
actual ball physics are authoritative. The system **does
not translate players or shoes** by that correction; it
moves toward a destination normally. No predicted future
ball, fake contact, forced shot, auto-scoring or possession.

A separate closed DEV flag `autonomousCarrySupportShoeCenterTarget:true`
requires all prior flags (particularly
`autonomousCarrySupportEarlyFacing:true`). With the flag
off, the existing C2.3u early-facing and all default
physics frame structures are unchanged. Mode, reset and
invalid option combinations are checked at both levels.

## Physical acceptance
The registered `player-ball-carry-shoe-center-ab.test.mjs`
replays two true 720-tick 22-player Rapier physical worlds
per attacking team: HOME IT and AWAY DE, **early-facing control**
against **shoe-centre correction candidate**, plus one fully
independent AWAY candidate replay. Each trial includes its
own 22-player canonical mover witness fed **only the previous
actual in-session Rapier ball** and the same-world physical
PASS / CARRY / shoe END events after those occur. All 22
player XY and 6rad/s bounds checked every tick; the real
shoe collision feed and exclusive, actually applied
footballs actions are independently audited.
No before-eligibility divergence permitted.

Record true 720-tick attacking-ball progression, measured
oriented static shoe clearance, actual shoe START+ACTIVE,
natural SHOT policy decision plus shot impulses, and
shortfall to original 35m shooting boundary. Geometric
proximity alone never counts as a touch.

**Research only:** if no real forward contact/SHOT occurs,
report the failure; no policy/shot range/ball impulse
modifications may be made to force a success. Draft/HOLD
PR #481 retains one cumulative commit; top-level C2
is still OPEN, overall Match Physics V1 remains 11/20=55%.
No merge, Preview or remote D1 updates.
