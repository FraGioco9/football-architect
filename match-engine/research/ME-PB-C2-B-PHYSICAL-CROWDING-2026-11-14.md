# C2-b real-body crowding: early carry escape A/B (2026-11-14)

**Status:** measurement / rejected experiment, **not** C2 acceptance. Normal Rapier ball and the canonical 0.98 m player-separation guard are unchanged.

## Reproducible fixture

- PR #481 Draft/HOLD; 720-tick genuine AWAY ordinary-formation 22-player Rapier fixture, baseline press handoff compared to opt-in `autonomousCarryBlockedDetour`.
- Most recent **accepted** opt-in prototype: `f14d0db18fc4e3d13bd6769cec53ba5f3821a4ad`, exact-head [ME-01 run 43616754609](https://github.com/FraGioco9/football-architect/actions/runs/43616754609), **5 PASS, 0 FAIL**.
- Accepted behavior: first waypoint at tick 678; first movement divergence tick 679; at tick 693 displacement 0.300 m and carrier–ball gap 5.024 m vs baseline 5.251 m; at tick 720 gap 4.950 m vs baseline 6.217 m. Shoe START count 16 vs 16, post-carry support 148 vs 148 frames; minimum carrier separation 0.98 m. **No genuine natural shot.**
- The attempted earlier two-leg corridor was rejected by [run 43617290352](https://github.com/FraGioco9/football-architect/actions/runs/43617290352) and single-leg feasibility revision by [run 43617445987](https://github.com/FraGioco9/football-architect/actions/runs/43617445987), both **4 PASS, 1 FAIL**: first accepted waypoint remained tick 678.
- Physical-neighbor witness [run 43617551239](https://github.com/FraGioco9/football-architect/actions/runs/43617551239) measured the actual blockers rather than assuming an empty lateral lane.

## Exact physical neighborhood (approximate XY metres, rounded to 0.001)

| Tick | Runner `away-9` | `home-10` (distance) | `away-11` (distance) | `home-9` (distance) |
| --- | --- | --- | --- | --- |
| 620 | (-12.876, -6.466) | (-13.766, -6.880), 0.982 m | (-12.125, -7.110), 0.990 m | (-13.722, -5.742), 1.114 m |
| 640 | (-12.880, -6.462) | (-13.766, -6.880), 0.980 m | (-12.051, -6.985), 0.980 m | (-13.544, -5.485), 1.182 m |
| 660 | (-12.880, -6.462) | (-13.766, -6.880), 0.980 m | (-11.861, -7.167), 1.238 m | (-12.694, -5.346), 1.132 m |

The required sum of two clearance radii is 1.96 m. At tick 640 `away-11`–`home-9` body-center separation is approximately 2.116 m (about 0.156 m geometric corridor); at tick 660 it is approximately 2.002 m (about 0.042 m geometric corridor). Other overlapping 0.98 m exclusion discs constrain the approach. These are **instantaneous** clearances, **not** proof that every continuous future route is impossible.

## Source-authorized teammate-spacing trial (rejected)

A default-OFF experiment asked a nearby unassigned teammate (`away-11` in this fixture) to move away by normal acceleration-limited target steering only after 12 real consecutive blocked carry-pursuit steps. It moved the first divergence to tick 636 and accepted an escape waypoint at tick 639, without changing the authentic Rapier START count (16 each), post-carry support (148 each) or the minimum 0.98 m clearance. However, the carrier then met the *other* genuine defender, `home-9`:

- [run 43617943745](https://github.com/FraGioco9/football-architect/actions/runs/43617943745): at tick 693 displacement from baseline 0.775 m, but **carrier–ball gap worsened to 5.306 m vs 5.251 m**; 4 PASS / 1 FAIL on the unchanged functional efficacy requirement.
- One bounded replan on a second real blocker [run 43618109995](https://github.com/FraGioco9/football-architect/actions/runs/43618109995) still left the same 5.306 m gap at tick 693, 4 PASS / 1 FAIL. `home-9` remained the obstacle and the proposed alternate route was not safely traversable.

**Decision:** Do not lower the 0.98 m separation, alter the shooting range, force a touch or weaken the efficacy assertion to claim a success. Restore the last passing default-OFF/opt-in mover, keep read-only nearby-body diagnostics in the A/B test, and leave C2 natural shot OPEN.

## Next hypothesis, explicitly unproved

The issue is an evolving **three-player clearance problem**, not merely the geometry of the original `home-10` blocker. Investigate source-authenticated movement cooperation and player-space allocation, assessing whether the teammate can clear space **without steering the carrier into a second defender**, or allow natural play to select an alternative passing route. Require independent HOME/AWAY replay, exact-head CI, no earlier unexplained divergence, unchanged full separation/contact guards, and measured benefit in authentic ball progress or a true shot. No official possession, result or goal authority is part of this work.
