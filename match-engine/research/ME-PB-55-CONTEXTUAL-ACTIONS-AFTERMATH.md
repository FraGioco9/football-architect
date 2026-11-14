# ME-PB-55 · A4.2b.2 — contextual autonomous actions and real aftermath

**Scope: provisional, opt-in local physical fixture, NOT the football
match rules engine.** Default 22-player Rapier baseline and
`temporary-score-v1` remain unchanged.

## Decision before impulse

`player-ball-uniform-autonomous-action.mjs` retains real Rapier shoe
START, identical temporary players (20 × 50), 12-tick cooldown,
distance/height/speed limits and the **same** Rapier ball. It now uses
two elementary, symmetric, deterministic geometric checks:

- **Pass:** reject a receiver whose segment from the real ball is
  too close to an opponent (minimum 1.9m) or whose receiving
  position is tightly marked (1.6m); compare forward gain,
  receiver separation and open lane. Never treat an open lane
  as a completed pass.
- **Shot:** shoot near goal only with an unblocked 2.4m-clear
  line to the goal's centre. A blocked shot falls back to a
  safe pass, or a conservative clearance.
- **Pressure:** nearest opposing actor inside 3m is noted as
  pressure. If no safe pass exists, make a clearance; pressure
  alone does not cause a tackle or change ball ownership.

One immutable `decisionContext` explains the selected policy rule,
measured nearest opponent, shot/pass lane clearances and confirmed
lack of action/goal success at the moment of the impulse. These are
simple DEV geometry heuristics, **not tuned tactics**.

## Observe after the real Rapier impulse

The fixture's `physicalActionOutcome` is generated from the
same real 60Hz `ballSnapshot`, A4.1 START events and A4.2b.1
applied-action record, with no new Rapier world or synthetic
colliders. It measures the ball's net displacement and subsequent
opponent or intended-recipient shoe START occurrences across
**12 consecutive ticks**; it retains the last completed window.
It does not send gameplay commands or modify the ball. Every
episode says `shotOnTarget:null`, `passCompleted:null`,
`goalScored:null`, `interceptionConfirmed:null`,
`tackleConfirmed:null`. START at a later time is evidence of a
physical contact only, not proof of a received pass or interception.

The CLI exposes the observation window count and last physical
readout **only in local physics output**; legacy SHA evidence still
uses the same real ball/contact canonical data. The persisted
due-fixture bridge cannot enable autonomous actions, remains
read-only, and never uses local outcomes to change official scoring.

## Acceptance boundary and next gate

Dedicated Node tests cover open/blocked pass lanes, opponent
pressure without safe receivers, open/blocked shots, mirrored
teams, no-contact, forged inputs, independent real-Rapier action
replay/reset over the actual subsequent 12 ticks, baseline
numeric equality, and deterministic local CLI summary. They
do NOT establish scored goals, successful passes or match results.

This is A4.2b.2 **local contextual/aftermath step**, not
full integrated A4. A4.3 still needs exact-head Chrome,
benchmark, comprehensive 11v11 acceptance and normal action-loop
authorization decisions; no promotion until all required
evidence and policy are met. PR Draft/HOLD, no remote D1 writes,
no generated player IDs or financial contracts.
