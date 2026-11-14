# C2.3t — Actual-ball future-horizon foot-turn feasibility (read-only)

## Motivation and non-authority
C2.3s exact-head 755/755 registered Node + real Chrome/benchmark PASS
(`e78c961de727e80ac96f5b03e7b18222bce60d73`) and independent
FULL PASS. The source-authenticated, <=0.35m lateral-only waypoint
adjustment moved the AWAY forward's static oriented shoe clearance
from **0.470m to 0.460m** at the best measured instant (tick664);
there was no new exclusive Rapier shoe START and no natural SHOT.
The ball remained **0.681m** outside the unchanged 35m shot-zone
boundary. Another speculative movement change is not justified
without diagnosing whether a genuine foot could geometrically turn
and translate in time to meet the *moving* actual ball.

## C2.3t witness / strict boundaries
- In **four genuine 720-tick 22-player 60Hz Rapier fixtures**,
  independently verify the canonical 22-player mover against
  physical frame positions. HOME IT/AWAY DE, C2.3q access and
  C2.3s lateral-aligned modes; same original seeds/formation/ball.
- A **fifth independent aligned AWAY physical replay** must match
  actual frame-by-frame ball, all 22 bodies, shoe START/ACTIVE/END
  and genuinely selected football action.
- The observer consumes only **prior real ball** and **post-step
  authenticated actual same-world shoe PASS/CARRY/END**. A sample
  is eligible only if the movement has an active earlier
  source-matched PASS then CARRY and post-carry access. Six AWAY
  anchors: ticks 635, 650, 664, 675, 683 and 693.
- Only **after** all physical frames have been stepped, compare
  each anchor to the **real observed future ball** at +6, +12
  and +24 ticks. This is retrospective measurement; *future ball
  frames are never provided to the mover or to a shot policy*.
- At each horizon calculate: actual ball travel, actual forward
  travel/turn, authentic future shoe START, static oriented shoe
  gap, an optimistic maximum body path from the existing
  `7m/s`, `9m/s²`, `60Hz` caps, and the lower bound on
  needed body translation given the actual shoe's 0.22m
  offset/half-length, rounding and ball radius. Also report
  fixed-body angle-to-future-ball vs the `6rad/s` upper turn.
- These are **one-way necessary/optimistic kinematic screens**.
  Fixed-body turn does not model changing bearing with translation;
  body speed does not include obstructing opponents, acceleration
  direction, 3D vertical geometry, collider sweep or dynamic
  Rapier contacts. A 'possible' flag never means a shoe will
  touch, pass or shoot. Only genuine same-tick Rapier START+ACTIVE
  and a real action can be called an actual contact/action.
- All off/default semantics, 35m shot range, 2.4m lane,
  collision surfaces, source life, policies, physics impulses,
  results and backend remain unchanged. No production scoring,
  owner, tackle, teleport or staged action.

## Acceptance
Register `player-ball-foot-turn-feasibility.test.mjs` in the
fixed test manifest. Require honest physical replay and negative
nonfinite/invalid-input envelope cases. Observe the HOME negative
control and AWAY C2.3q vs C2.3s no-new-shoe-contact branch.
Record **measured** speed/turn feasibility and actual shoe
events; do not claim any natural SHOT or move C2 until real
evidence and exact-head CI justify it. Keep PR #481 Draft/HOLD,
one cumulative commit, no merge/deploy/remote D1.

Issue #480 remains **11/20 = 55%**; C2 is OPEN.
