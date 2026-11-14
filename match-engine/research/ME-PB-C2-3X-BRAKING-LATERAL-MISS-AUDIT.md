# C2.3x — original 60Hz braking law vs lateral shoe miss, no policy change

## Evidence entering the step
At C2.3w exact-head `1dddf92`, ME-01 targeted was
**763/763 Node and 10/10 routing PASS**, real Chrome/benchmark PASS.
Two independent 720-tick AWAY Rapier control/candidate worlds showed
at ticks655–670 **0 hard teammate-blocked frames**. Original
C2.3u approach reversed at tick666 with ~0.2016m minimum estimated
interpolated clearance; C2.3v reversed at tick667 with ~0.1711m.
Neither had a post-initial genuine `away-10` shoe START or natural SHOT.
FULL, Site, Browser results are independently checked before
new acceptance; do not infer success from their being queued.

## C2.3x controlled observation
Extend the **existing registered test file**
`player-ball-relative-shoe-window-audit.test.mjs` so there
is no duplicate expensive 720-tick replay. No new test-file
registration or physics/runtime/player AI source changes.

Independent, read-only movement reconstruction for each
of the original 16 authenticated AWAY-10 real ticks:

- Canonical prior actor `vx,vy`, pre-step actual destination
  `provisionalCarrySupportBallAccess.target`, actual next
  velocity and 60Hz step; verify
  `speedLimit=min(7,sqrt(2*12*targetDistance))`.
- Separate (a) distance-limited speed cap below 7m/s,
  (b) the controller selecting its 12m/s² braking
  velocity branch rather than 9m/s² acceleration,
  and (c) **observed** negative speed change. These are
  three distinct, measured categories, not synonymous.
- Verify independently reconstructed velocity delta under
  the actual 9/12m/s² cap against true mover velocity,
  rejecting forged targets, non-finite numbers,
  over-speed changes and invalid pitch coordinates.
- Reconstruct relative shoe-ball velocity from the two
  **real frame** centres. Separate change of lateral
  shoe-relative ball offset into (a) actual world
  translation of ball and moved shoe, expressed in
  the *pre-step shoe frame*, and (b) coordinate-frame
  rotation due to actual bounded shoe yaw. Verify
  their exact sum equals the observed local lateral
  offset delta; quantify tangential speed separately
  from radial closing speed. Distinguish sideways
  slip from angular target tracking.
- Continue checking four true 720-tick HOME/AWAY
  C2.3u/C2.3v Rapier worlds, independent fifth AWAY
  physical replay, and independent canonical 22-player
  witness fed only prior authentic ball and subsequent
  genuine PASS/CARRY/END. Do not feed calculated future
  ball, interpolation or classified cause back to
  the mover. Keep real START/ACTIVE as the **only**
  touch authority, with the original shot rules.
- The decomposition is diagnostic, not proof of
  causality; any later fix must be a separate bounded
  hypothesis with genuine 60Hz physical A/B and exact
  head CI.

C2 remains OPEN; 11/20=55%. Draft/HOLD PR #481
continues with one cumulative commit, no merge,
Preview deployment or remote D1 changes.
