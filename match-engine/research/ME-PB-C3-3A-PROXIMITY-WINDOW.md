# Match Physics V1 — C3.3a: continuous player–ball proximity, physical measurement only

Status: new candidate, **real exact-head CI pending**. Prior C3.2b authentic HOME/AWAY two-shoe proof passed [ME-01 #43252208291](https://github.com/FraGioco9/football-architect/actions/runs/43252208291) on `3dfc650`. **C3 remains open**.

## Why another stage after two real shoe touches?

Two physical Rapier shoe STARTs by the same actor with a real END between them establish authentic recontact, *not* continuous dribbling. A player can recontact a ball after it has been far away for most of the interval. A control claim therefore requires independently measured relative motion and an explicit game-rule decision, neither of which is established by C3.2b alone.

## Sealed per-tick measurement

The closed fixture runtime now supplies the C3.3a observer the **same-frame** authenticated 60 Hz Rapier ball centre, the immutable current 22 actor XY positions from the canonical mover, genuine shoe START/ACTIVE/END feed, actual carry action and C3.2b read-only proof. It measures only between a first real 0.42 N·s carry and a second valid same-actor genuine START/END/START + physical carry pair. An intervening other player's START/ACTIVE, 150-tick expiry or a non-authenticated same-player contact terminates the candidate.

The immutable `physicalCarryProximity` output reports:
- `measuredWindows`, `interruptedWindows` and `latestMeasuredWindow` (read-only);
- per 60 Hz frame horizontal player–ball gap (minimum, maximum, average), number of frames within a **diagnostic** 1.25 m radius, and the corresponding fraction (0–1);
- physically measured actor XY path, ball 3D path, positive attack-direction displacement, and authentic first-shoe / intervening-END / second-shoe ticks;
- `ballAttached:false`, `ballControlConfirmed:null`, `dribbleConfirmed:null`, `officialMatchPossession:false` and `officialMatchResult:null`.

The 1.25 m radius is a **research measurement band**, not a gameplay control threshold or privileged possession. No subjective dribble classifier has been added. The observer cannot move a player or ball, force a shoe event or produce a new impulse. It does not affect production, D1 or official fixture state.

## QA gate

`node --test match-engine/tests/player-ball-carry-proximity.test.mjs` must pass deterministic independent 22-player real HOME/AWAY 600-tick Rapier fixtures with strictly authenticated repeated carry windows and actual actor motion, plus a no-contact negative and an invalid input rejection. Existing C3.2b proof, ordinary match-engine tests, route allowlist, on-site primary LAB and exact-head CI must stay green. The runner's explicit `autonomousActions:true,autonomousCarry:true` mode exposes these measurements for offline inspection.

This is **C3.3a measurement groundwork only**, not C3 complete. A later C3.3b should evaluate sustained close control against the observed distributions and validate adversarial opponent interference before any dribbling rule is proposed. The owner must approve any new product/gameplay control rule. No merge/deploy/remote D1 work.
