# C2.3ad — genuine 60Hz physical sample closest-approach phase audit (read-only)

## Gate, evidence and scope
C2.3ac's genuine TARGETED 770/770 Node, 10/10 route/security,
Chrome LAB and benchmark PASS, but its 0.40m previous-real-ball-minus-body
relative lateral shift **worsened** closest static shoe surface clearance
from C2.3aa **0.101m** to **0.112m**, with **zero new physical Rapier
shoe START** by the relevant AWAY-10 runner and **zero natural SHOT**.
The strict 35m ball-shot range still falls short by **0.681m**.
Do NOT repeat an ungrounded steering experiment.

This step has **no engine, ball, collider, tactical motion, controller,
production or scoring modifications**. It reuses the one existing
registered `player-ball-carry-foot-lateral-lead-ab.test.mjs` with the
same twelve real HOME/AWAY × v/y/z/aa/ab/ac 720-tick 22-player
Rapier worlds and the independently replayed thirteenth AWAY world.
Only one cheap pure numerical unit test and post-step read-only
diagnostics are added, not an entire duplicated real physics run.

## Retrospective physical source
For each genuinely PASS→later CARRY authorized AWAY movement step
in 650–690, the test already possesses:
- actual Rapier ball position from world physics tick t-1 and
  independently the actual ball position after physical step t;
- canonical 22-player XY and facing before and after, already
  asserted to match the same players fed to Rapier's kinematic
  shoes, including <=7m/s XY motion and <=6rad/s angular turn;
- real Rapier START+ACTIVE/END physical contact event feed and
  genuine autonomous football action for that same step.

Construct the **actual previous/end shoe-centre transforms** using
the exact existing `footProxyTransform` (0.22m facing-dependent
forward centre and unchanged 3D height). For the *two actual 3D
endpoint frames*, calculate the linear relative shoe-centre
displacement and its analytic unconstrained closest-time parameter:
`t*=clamp(-dot(relativeCentreStart,relativeDelta)/
           dot(relativeDelta,relativeDelta),0,1)`.
This is the exact time of minimum centre separation of an
**assumed straight chord**, not exact Rapier continuous swept
motion. Classify positive→negative radial closing, the shoe-side
relative velocity and the tangential velocity component.
Reconstruct the existing oriented rounded shoe *static*
surface estimate at 0,1/8,…,1 plus t*, linearly interpolating
the previous/end observed actual ball XY/Z and player XY with
shortest-arc facing; identify forward/lateral/vertical limiting
axis at the best of these ten **hypothetical** poses.

Record compact per-mode minimum chord-centre gap, minimum
sampled proxy clearance and actual 60Hz tick/subframe fraction,
relative radial and tangential speeds, local 3D shoe coordinates,
and source-real shoe START/action separately. Cross-check
regular output and independent replay. A purely synthetic
unit-case with an interpolated crossing explicitly **never
authorizes Rapier contact, possession, tackle, shot or score**.
Invalid ticks, actor IDs, teams, body velocity bounds,
turn rates, negative ball height and nonfinite inputs fail.

## Acceptance
No regression of the genuine real physical worlds, canonical
movement, authentication, normal shoot decisions, official
result or deterministic replay. A minimum interpolated surface
distance—even zero—is **NOT a swept Rapier contact** and cannot
produce synthetic shoe START or SHOT. The purpose is to isolate
which physical axis or timing phase is responsible for the
near miss, before attempting any further movement correction.
C2 remains OPEN; issue #480 remains 11/20 = 55% without a
real same-tick physical shoe START-triggered natural SHOT.
PR #481 one cumulative Draft/HOLD commit; no merge/deploy,
Preview or remote D1.
