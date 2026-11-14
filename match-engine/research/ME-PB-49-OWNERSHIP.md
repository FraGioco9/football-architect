# ME-PB-49 — B1 local authoritative ball-ownership transition model

Status: isolated Draft/HOLD implementation, NOT official match integration.

## Functional states

- **free:** no verified physical control and no active shoe contact.
- **contested:** real physical shoe contact is active, but co-motion stability
  is insufficient, or more than one shoe is active. No owner is assigned.
- **controlled:** ONE canonical shoe has been witnessed in a continuous
  real Rapier START → ACTIVE episode, and for at least SIX consecutive
  60Hz samples, measured ball and player motion is within the already
  established conservative ME-PB-38 eligibility thresholds: relative
  velocity <=0.75m/s; shoe XY separation <=0.46m; grounded ball
  center <=0.28m; moving/aligned player and ball. A unique
  ownerPlayerId represents the local authoritative owner.

A real END, changed/ambiguous shoe contact, unstable co-motion,
high airborne ball, or a break in episode provenance removes local
ownership ON THAT physics tick. Reacquisition needs a newly tracked
shoe START and fresh qualifying consecutive samples. Neither
proximity nor the initial physical START alone is ownership.

## Trusted physical input boundary

The pure state machine consumes real engine footContactSnapshot(),
snapshot() and the canonical createPlayerMovement step() for the SAME
tick. Initial state is tick0 with no shoe contacts. Every transition
requires consecutive ticks, canonical roster identities, bounded player
displacement and turning, finite ball XYZ and velocity, and a coherent
sorted Rapier START/END/ACTIVE ledger. Forged/missing IDs, stale frames
or impossible transitions throw without mutating the prior state.
State is deeply immutable and never steers Rapier bodies or applies
gameplay impulses.

The provenance guarantee requires a TRUSTED local engine caller:
this pure JS validation cannot cryptographically attest an arbitrary
external fake object. Do not allow public input to claim official
possession from an imitation physical frame. Synthetic unit fixtures
for multi-shoe arbitration are negative logic tests, not real Rapier
collision evidence.

## Acceptance and boundaries

Real pinned 22-player trial: physical Away #10 START tick1, genuine
END tick19 and real Home #10 new START tick127. Ownership may arise
only after sustained first-player co-motion, must end immediately
at shoe END, and a second START is initially contested. A distant
ball gives no possession; independently replayed real Rapier runs
and observer ON/OFF have byte-identical ball/foot results.
Malformed/gapped/ambiguous physical records fail closed.

B1 is a **test-only owner authority**, not integrated into normal
gameplay, statistics, score, pass, shot, dribble, interception or
player-to-club data. B2–B5 remain required for playable game actions.
No new shoe profiles, grass physics knobs, extra UI or lab mode.

See the LIVE 20-gate checklist at
https://github.com/FraGioco9/football-architect/issues/480 .
A2/A3/A5 are signed (15% overall); B1 becomes signed (20%) only
after this implementation's exact-head targeted CI passes.
