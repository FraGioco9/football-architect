# C2.3y — bounded real-ball lateral interception, first corrective A/B

## Starting evidence
C2.3x `e4f30f6` passed exact-head targeted, FULL, Site, Admin,
and Browser CI. The existing genuine 720-tick HOME/AWAY Rapier
scenario yields no new AWAY-10 physical shoe START and no
natural SHOT despite 0.1711m closest retrospectively interpolated
static clearance. Real 60Hz analysis found 0/16 teammate
hard-block ticks, normal distance-dependent braking on all
16 AWAY-10 ticks655–670, and **translation-dominant**
shoe-relative lateral slip: tick666 actual world movement
−0.0752m + true bounded shoe yaw +0.0341m = −0.0411m
net lateral escape. Relative tangential velocity 5.2918m/s,
radial closing 0.4761m/s before becoming negative.

## Hypothesis under separate source-sealed DEV opt-in
`autonomousCarrySupportFootLateralLead:true` ONLY when all
earlier autonomous mode flags including
`autonomousCarrySupportShoeCenterTarget:true` are explicitly
active. The same earlier **authentic physical shoe PASS followed
by genuine Rapier CARRY** has already granted the naturally
selected support forward a <=4m live-ball approach. This
does not select a special player ID, force a body position
or cause a football action.

At each eligible step take the **previous real Rapier ball XY**
and the forward's **canonical pre-step actual facing**.
Measure the signed local side `lateral = -sin(yaw)*(ball.x-body.x)
+ cos(yaw)*(ball.y-body.y)`. Shift only the C2.3v
**tactical BODY destination** (not actual body position) by
`clamp(1.75*lateral, -0.45m, +0.45m)` along
`(-sin(yaw),cos(yaw))`, within existing pitch bounds.
This is a deliberate bounded **lateral overshoot of the
real observed ball's local side**, seeking intercept while
the ordinary position-dependent speed-cap and acceleration
operate. It does not alter the forward axis target, use
future ball samples, bypass the <=4m real-source duty or
reset the 150/480-tick authentic support clock.

The unchanged original 60Hz mover bounds remain:
7m/s maximum speed, 9m/s² acceleration, 12m/s² braking,
6rad/s turning, hard 0.98m teammate separation, full
original Rapier shoe geometry/contact solver, immutable
35m shooting range, authentic START+ACTIVE impulse policy,
no inferred possession/goal/official match outcome.

## Acceptance
Register the new `player-ball-carry-foot-lateral-lead-ab.test.mjs`:
- HOME IT + AWAY DE, two 720-tick **true physical Rapier
  worlds** each, prior C2.3v control vs new C2.3y candidate;
  independent fifth candidate AWAY physical replay.
- Every world has a distinct 22-player canonical mover witness,
  receiving **only the previous actual physics ball** and
  later same-session true Rapier shoe-gated PASS/CARRY/END.
  Actual XY and normal turn bounds asserted per player/tick.
- Strict option rejection and reset, frame source PASS and CARRY
  provenance, real previous ball, pre-step actual facing,
  exact 1.75 side projection, <=0.45m XY lateral correction,
  no leakage before the authenticated support phase.
- Audit actual Rapier shoe START+ACTIVE, authorized physical
  actions including any real SHOT, original 35m shot zone,
  actual physical ball advancement, and read-only oriented
  shoe static clearance. Never count geometry as touch.
  If still no genuine shoe START/SHOT, record this explicitly:
  passing QA for physical safety does **not** close C2.

Maintain one cumulative Draft/HOLD PR #481, no merge,
Preview deployment or remote DB changes. Top-level
Match Physics V1 remains 11/20 (55%) until gate C2
actually qualifies.
