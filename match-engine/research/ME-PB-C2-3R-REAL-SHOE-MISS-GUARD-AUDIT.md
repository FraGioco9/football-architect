# C2.3r — Physical shoe MISS anatomy: oriented 3D geometry and actual guard

Research-only follow-up to [#480](https://github.com/FraGioco9/football-architect/issues/480)
on cumulative Draft/HOLD PR #481, no production changes. C2.3q
produced real source-authenticated near-ball movement for
AWAY-10 over ticks635–694, but **no later actual Rapier shoe START**:
best *static* clearance measured 0.470m at tick664, compared with
0.250m for the original real `press` at tick657 and 2.060m for
the prolonged off-ball support at tick683.

## Source-authenticated measurements

Six independent **720-tick, 22-player real Rapier** HOME IT/AWAY DE
worlds across baseline, C2.3n handoff and C2.3q near-ball access.
In each world a separate **observer-only** canonical mover receives
only the previous physical ball + subsequently authenticated
same-world exclusive Rapier shoe PASS/CARRY/END events, proving
all 22 body XY match what Rapier used in the current 60Hz tick.
This independent witness cannot steer or create any shoe collision.

Read-only decomposition uses the *exact* canonical oriented
shoe transform (offset 0.22m forward, z 0.09m), underlying
rounded-cuboid 0.105m/0.052m/0.035m half-extents, 0.020m
bevel, and 0.11m physical ball radius. Project the actual
post-physics ball position onto shoe-local forward, lateral
and vertical axes; measure overshoot of each box half-extent,
and compare the combined Euclidean excess to the physical
rounding+ball radius. Assert the result matches the existing
shoe geometry helper to full precision. The **static** gap
MUST NEVER be called a Rapier collision, nor treated as
a CCD/swept contact inference. Only the real shoe
`started` + `active` feed and action impulse prove contact.

At source-proven physical tick657 (original presser) and tick664
(C2.3q) and all relevant nearby ticks, log:
real physical ball XYZ and pre/post displacement, actual actor XY,
facing and movement step; world shoe centre, ball-local
forward/lateral/vertical and excess margins; the first real
Rapier shoe START/ACTIVE/END; trusted movement duty and
whether the current off-ball support / near-ball access
is still authenticated by earlier PASS/CARRY.

Read-only neighbor interference: actor `blockedBy` from the
actual 22-player integrator, and actual nearest teammate
vs nearest opponent centre-to-centre distances, including
the real authenticated carrier AWAY-9. The existing
teammate separation floor is **0.98m**, a potentially
competing movement constraint, not a collision proof.
Track whether an actual movement rejection happened;
never infer an opponent tackle or ball possession.

## Regression / acceptance

Original HOME negative world is unchanged in all 3 modes.
Original AWAY source: 53-frame post-CARRY relay, later
real C2.3n relay 148 frames, C2.3q 60-frame
authenticated on-ball approach, first true divergence
tick600 and tick635 respectively. Preserve all exact
physical 22-player positions, speed cap 7m/s, 16 true
AWAY shoe STARTs in all 3 modes, **0 later AWAY-10
START**, and **0 natural SHOT**. Hard unchanged 35m
range misses by ≥0.681m and shot-lane policy stays
untouched. Record new audit in a single explicitly
registered Node test and this note; no physics, tactics,
collider, impulse, contacts, AI, generated players,
official scoring or remote database changes.

The finding should distinguish actual angular/lateral
foot miss, player blocking and ball motion and support
the next independently opt-in experiment, **not**
automatically authorize a new steering change or
tactical shooting success. #480 remains 11/20 (55%).

## CI log-size evidence correction

The first exact-head #43514857316 **passed 753/753 Node** plus
route/security and Chrome/benchmark, but the single raw JSON stdout
record was over the GitHub Actions 64 KiB line cap and was truncated
mid-AWAY result. The test remains unchanged in its 6×720-tick actual
Rapier fixture runs, read-only source mirrors and strict physical
assertions. Only the **printed report** now chooses tick635,657,660,
664,665,693 for AWAY and summary-only for negative HOME so complete
JSON evidence can be retrieved in one untruncated log line. This is
not a tactical, test-assertion or physics correction.
