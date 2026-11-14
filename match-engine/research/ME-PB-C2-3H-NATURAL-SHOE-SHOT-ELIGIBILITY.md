# C2.3h — Natural physical shoe-to-shot geometry, no gameplay verdict

Research-only addition to existing issue #480 / Draft PR #481 C2.3f/g
two-mirror 22-player, two-independent-world 720-tick Rapier scans.

For EVERY same-step real 60Hz frame, calculate **post-step diagnostic**
ball-to-goal distance (35m existing SHOT_MAX_RANGE_M threshold), remaining
distance to own team's shooting zone, actual nearest outfielder shoe-body
XY gap and opponent geometric clearance along each of the three existing
goal-lane aim points (0, -3.1m, +3.1m; 2.4m clearance heuristic).
For audit only, report count of frames where the measured ball is within
5m of the shot zone, in the shot zone, and a post-step lane appears open.

Retain the LAST twelve REAL shoe START+ACTIVE events, their canonical team,
actor identity, current ball XY, post-step goal range and lane clearance,
and the actual already-applied physical action if any. Save checkpoint
snapshots at 480, 600 and 720 ticks and final nearest player/goal geometry.
Assert that observed shoe counts are preserved and any claimed physical
shot is backed by the real previously applied action.

**Important boundary**: the uniformly applied shot policy chooses based
on the same-tick pre-impulse movement/ball and exclusive Rapier contact;
these are explicitly POST-step observations, **not** an authorization to
kick, not a retrospective proof that the pre-contact lane would have been
clear, and never an action recommendation or awarded result. No new
bodies, ball forces, starting positions, collider geometry, actor
selection, scoring, possession or football adjudication.

Keep a zero-shot natural scan as an actual negative result. The owner
must approve any later tactical policy changes. C2.3 and C2 parent stay
OPEN until genuine HOME and AWAY natural source shoe shots are observed.

One cumulative commit, exact-head targeted CI and two independent worlds.
No merge, deploy, Preview publication or remote D1.
