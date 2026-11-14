# ME-PB-51 / Match Physics V1 B3 — physical accompaniment and natural ball release

**Status:** isolated 22-player real Rapier 60Hz research session in
Draft/HOLD PR #481. This does NOT represent official match possession,
a general dribble/pass/shot, a new ball force, or deployed gameplay.

## What is physically implemented

`src/player-ball-carry-release.mjs` wraps the trusted B2
`createLocalBallReceptionSession()` without exposing its Rapier
engine or allowing the caller to feed fake shoe events, movement frames,
external ball coordinates, an owner ID, or an artificial release command.

Each private `step()` measures ONLY observations returned from the
in-process Rapier solver and B1 exclusive owner state. For each actual
continuous controlled episode, it records:

- the true shoe START provenance and first physically qualified control;
- consecutive controlled ticks during which the SAME player physically
  accompanies the SAME Rapier ball;
- real XY travel of the ball **and** the player's canonical movement
  over those controlled frames;
- the precise tick and reason that B1 loses control (may be a physical
  stability failure *before* the foot collider ends);
- the REAL Rapier END of the original player's shoe;
- how many subsequent ticks have **no real active shoe contact or
  START/END**, and how far the free ball actually continues to roll;
- the FIRST subsequent new physical contact tick, which censors the
  previously uncontaminated free rolling trajectory.

The observer never directs the player, pins the ball, adds forces or
changes restitution/grass/friction. It only classifies measured physical
motion already produced by Rapier's collision solver and the existing
canonical 22-player movement, with a single shared ball response
(default 1.00) for ALL shoes and pitches. Immutable snapshots,
deterministic reset and disposal are preserved. No external fake
`step({contact})`, `step({force})` or `reset({owner})` calls.

## Expected real pinned witness and negative controls

The already independently verified real 22-player initial condition has
Away #10 physical shoe START tick1, local control acquired tick7 and a
real shoe END tick19. B1 may revoke control earlier as co-motion becomes
unstable; B3 must NOT falsely claim the player retained control until
END. The ball subsequently continues to move in the same physical
Rapier world, with **ticks20–126 expected clean**, and the genuine
Home #10 START tick127 must censor the free-ball window. That short
contact END tick130 is not a reception. A distinct Home #10 real START
tick141 can qualify for control only at tick146 after six stable frames.

Real 60Hz integration tests compare a separately stepped B2 world
against the B3 wrapper **at every tick** for identical ball trajectory,
foot START/END/ACTIVE event data and owner state. Independent replay,
reset, no-contact negative, external-injection rejection and the same
single scalar at 0.85/1/1.15 prevent synthetic success.

## Scope boundaries

This verifies **passive, naturally released physical possession**,
not a deliberately commanded release, pass or dribble. It does not
introduce official game ownership; A1/A4 remain open until real
gameplay wiring is independently authorized. B4 will handle actual
opponent contests, invalidated possession, and realistic owner
handoffs. C1–C5 will implement deliberate generic football actions
without scripted guaranteed success. Advanced boot/turf/aerodynamic
parameter sweeps are OUT of V1 scope.

Track the real current pass/fail statuses and checked gates in
[issue #480](https://github.com/FraGioco9/football-architect/issues/480).
Never auto-merge or deploy PR #481 and never write to remote D1.
