# #628 ACTIONS-B01 — first functional coverage, real cross

## Directive

**Base actions first; tune parameters later.** The original movement, Rapier
single ball, 22-player physical source and protected DEV LAB remain the only
authorities. No need to perfect every defender's pursuit before exposing the
next fundamental action. Existing PASS / SHOT / short CARRY / CLEARANCE are
already provisional physical attempts; official results stay guarded.

## First action slice: CROSS

Add a distinct `cross` to the existing **uniform 22-player autonomous
shoe-START policy** and to the **one existing Scenario dropdown** (LAB-19).
A winger in the wide attacking third chooses an *actual live teammate* in
the penalty area from the original 22-player movement frame. Require an
open physical crossing lane; use one provisional lofted impulse on the
ORIGINAL Rapier ball, exclusively after a genuine same-tick single shoe START.
The same M33 action can be attempted by either HOME or AWAY. A cross attempt
is **not** a successful cross, reception, header, goal or possession.

For laboratory verification only, mirrored initial pre-tick-zero research
lineups move original #10 to the wide ball and original #9 to the goal
area. No runtime teleports, extra ball, fake shoe contacts, new press policy,
performance tuning, or official score/goal/tackle events.

QA includes a bounded pure policy negative test, canonical 0.98m spacing,
HOME/AWAY deterministic same-world Rapier replay, native exclusive START,
genuine applied impulse and observed 3D ball flight, plus all previous
action scenes. All provisional numbers are central constants for later
tuning, not final gameplay balance.

## Next functional sequence

1. [x] PASS, SHOT, short CARRY, CLEARANCE physical attempts (prior work)
2. [x] CROSS physical attempt (this block, pending CI evidence)
3. [ ] Goalkeeper basic SAVE/DIVE physical attempt; separate from confirmed stop
4. [ ] Explicit TACKLE / INTERCEPTION attempt with original native contact
5. [ ] Receiving/control and controlled dribble that does not assume possession
6. [ ] Goal/out-of-play/restart event handling and complete match clock/score
7. [ ] Distinct official match outcomes and integrated full-season proof
8. [ ] Later: speed/strength, pass/shot/cross accuracy, success probability,
     pressing radius, shot arc, collision tolerances, and visual polish

**HOLD** PR #633; no merge, deploy or remote D1 writes. Keep grouped commits,
one targeted exact-head CI, and full acceptance tests at the end of the block.
