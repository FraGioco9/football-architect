# #628 ACTIONS-B05 — ball fully out, goal mouth and source-bound restarts

## Source and rule scope

One new **read-only original Rapier ball boundary referee** checks pairs
of consecutive same-world 60Hz ball-centre positions and original 22-player
movement frames. The ball must pass entirely over the 105×68 m field boundary
to exit: centre beyond the line by one true physical radius (0.11m), not
when its centre reaches the painted line. Resolve the **first** exit across
goal line/touchline using real segment crossing time. A genuine goal
requires the whole ball within 7.32m posts and below the 2.44m bar.

- Goal crossing: record a **provisional lab-only goal**, positive home or
  away according to the actual goal line. The opposite team receives the
  centre-circle **KICKOFF**. In explicitly protected DEV restart mode,
  place the EXISTING original Rapier ball at (0,0,0.11) with zero velocity
  and angular spin, on the SAME original World, after the real fully-out
  event. This is dead-ball placement, **not** a fabricated shoe collision
  or autonomous kick. The ordinary engine's physics remains untouched.
- Touchline: the physical crossing marks a candidate **THROW-IN** location.
  A team can be assigned only if a genuine sole Rapier shoe START is
  verified against its current-tick original solver/manifold. Without
  that last touch, `unresolved-throw-in` is a real OUT event but **not**
  a fabricated award of a throw-in to either team.
- Goal line outside posts / over bar: if a genuine last shoe START is
  observed, defending team's last touch yields a **CORNER** for the attacker
  while attacking team's last touch yields a **GOAL KICK** for the defender.
  No genuine touch leaves `unresolved-goal-line` with both candidate
  types and **no invented owner**.
- All spots use the original 105×68 geometry; legal corner (52.39,33.89)
  and 5.5m goalkeeper-box values are provisional. Real physical placement
  is gated by exact-tick source evidence and a ready, team-assigned restart.
- Original score and match result are unchanged: `officialMatchResult:null`,
  `officialPossession:false`, `scoreChanged:false`. Referee stores
  `provisionalGoals` **only in DEV Action LAB**.

## Existing UI and proof

Three new cases **LAB-25 Goal crossing / kickoff**, **LAB-26 Touchline /
throw-in**, **LAB-27 Goal-line / set piece** are part of the SINGLE original
Scenario dropdown. HOME/AWAY use mirrored ordinary Rapier 60Hz roll starts
strictly inside the pitch, with 22 players and original genuine native
shoe bridge. Total Scenario options: 4 ball + 14 action + 30 movement = 48.

The exact native source, deterministic mirrored trajectories, strict
negative no-last-touch and bounds/post/bar checks, goal and physical
kickoff on original body are acceptance tests. A successful kickoff
positioning does not yet mean an original player has **taken** kickoff.

## Still open for the complete match loop

Confirmed last-touch attribution on source-positive throw-in, corner and
goal-kick end-to-end cases, actual player taking those set pieces, free
kicks and fouls, half/match clock and official scoring, real roster
identity, persistence and full match outcome remain open.
These are deliberately not inferred from ball proximity or prior action
that did not exist in the same physical world.

**B05 is a first functional field-rule slice, not a finished referee.**
The next slice must close unresolved restart ownership by integrating
genuine source-positive player touches, then original physical set-piece
execution. All numeric tuning deferred. PR #633 remains Draft/HOLD,
no merge, deploy or remote DB writes.
