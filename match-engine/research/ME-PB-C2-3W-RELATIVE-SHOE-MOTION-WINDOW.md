# C2.3w — read-only relative shoe/ball motion & missed-contact audit

## Starting evidence
C2.3v `5b58a49` passed all exact-head targeted,
FULL, Site, Browser and Admin CI. Its original 720-tick
HOME IT / AWAY DE real Rapier test found the AWAY forward
`away-10` authenticated for 60 frames (ticks635–694), but
still no additional shoe START or natural SHOT. The best
**static** rounded oriented shoe geometry improved
0.203m → 0.173m (tick665), with the actual ball still
0.681m beyond the original 35m shooting threshold.

## Step C2.3w (no physical/tactical edits)
Before attempting another destination or facing adjustment,
measure what the actual 60Hz world did at ticks **655–670**
when this forward almost met the ball, separately for
C2.3u early-facing control and C2.3v shoe-centre target.

The registered independent test
`player-ball-relative-shoe-window-audit.test.mjs`:
- Runs **four genuine 720-tick 22-actor Rapier simulations**,
  HOME/AWAY × C2.3u/C2.3v, and a **fifth independent AWAY
  replay**, verifying identical ball, actor positions, real
  contact feed and action in the replay.
- Has separate canonical 22-player mover witnesses per
  world, always consuming the **previous actual physics
  ball**, real PASS/CARRY events **only after** corresponding
  physical shoe START+ACTIVE and real physical shoe END
  as sent by the real runtime. Every frame is compared to
  actual positions; 7m/s / 6rad/s limits are asserted.
- Rejects invalid/out-of-order/over-speed/non-finite
  diagnostic samples, checks source PASS tick292 and
  last real CARRY tick567 for the same `away-10` window.
- At each full physics tick in the window, reports the
  moved shoe's real **before/after oriented centres**,
  finite-difference body, shoe and ball speeds, relative
  3D speed and start-of-frame radial approach/recede
  speed; real blockedBy actor identity, target distance
  progress, body-ball gap, canonical oriented shoe
  static surface gap, relative forward/lateral placement,
  and whether an actual Rapier shoe START occurred.
- Examines five evenly spaced **retrospective** interpolated
  poses over each real start/end 60Hz segment, using the
  same canonical shoe-centre offset, shoe geometry and
  real ball endpoints. Their sampled minimum *cannot*
  stand in for continuous Rapier swept-collider tests,
  physical START, possession, pass success, action
  authorization or scoring. This approximation is
  explicitly labelled and computed **only after**
  the true frame; no lookahead may reach the mover.
- Aggregates number of blocked frames, positive vs
  negative closing-speed frames and target progression
  for each mode to diagnose whether the miss was
  caused by player arrest, target lag, relative approach
  speed or lateral shoe alignment. **Do not hard-code
  an unobserved cause or change game policy.**

No new flags; code changes limited to fixed test
registration and this research note. No change to
shoes, normal physical movement, ball impulses,
the true 35m shot rule, auto-scoring, production
match authority or remote DB. PR #481 stays one
cumulative Draft/HOLD commit. Parent C2 remains
open; top-level Match Physics V1 remains 11/20=55%.
