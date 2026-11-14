# ME-PB C2.3c — Real-pass-triggered attacking support from ordinary 22-player formation

**Status:** new exact-head CI pending. C2 parent remains OPEN until a normal, unprepared autonomous sequence physically reaches a genuine shot.

## Real-world trigger

The existing internal 60 Hz universal fixture runs `autonomousActions: true` from the **unchanged canonical 22-player formation**, not the curated C2.3b `researchShotAttacker` mode. Only a genuine exclusive Rapier shoe START+ACTIVE resulting in the authentic opt-in **pass** impulse can record a source pass. The mover checks its tick, team, player and recipient IDs, applied physical impulse, exact physical trigger, closed same-tick pass target, and non-official status. A proposed pass or fabricated contact never starts this follow-through.

## Off-ball run

Within at most 240 physical ticks after that observed pass, select one **currently available actual teammate forward** (not passer, recipient, an assigned presser or defensive covering player). Preserve the runner across ticks when eligible. From **current ball position**, the candidate's target is 14m forward in the attacking X direction and a separate ±8m lateral lane, clamped within the canonical pitch. Neither target nor new duty confers possession, a received pass, touch, shot or goal. All current speed, acceleration, turning, hard teammate collision, Rapier shoe/ball physics, mass, restitution, global field friction and actual foot-contact guards remain unchanged. The physical integrator may fail to reach the target; only observed actual XY counts.

The fixture maps `attack-support-intent` to exactly that canonical runner in the corresponding 60 Hz autonomous duty set and separately validates it against the previously verified genuine **same-team physical pass** before exposing `contactDecisionObservation.attackSupportRun`. A run from the same physics tick as its source pass, a different team, a mismatched duty or outside its 240-tick window is rejected. This is experimental local data only.

## Tests and limits

- Pure mirrored Home/Away geometry, bounded temporal eligibility, stable selection, no-candidate, and forged/invalid-pass negative contracts.
- Independent **unprepared canonical 22-player** real Rapier fixtures with both teams initiating a genuine pass, then at least 12 observed following physical frames and a genuine >0.5m forward advance by the selected teammate. Compare both live worlds tick-by-tick, then verify reset from the physical initial state.
- No-contact and non-autonomous scenarios: no pass, no attacking run, no phantom score.

**This is a tactical transition, not accepted C2 shooting.** It does not assert a shot from the default formation, complete a football pass, or award a goal/shot-on-target/out-of-play. C2.3b already proved real kicks from curated physically valid starting scenarios, not ordinary automatic 11v11 sequences. Further tactical and physical evidence is needed before C2 can be checked.

No new 11v11 panel, remote database, production scoring engine or public API. The local editable ball-drop LAB remains the same simple UI.
