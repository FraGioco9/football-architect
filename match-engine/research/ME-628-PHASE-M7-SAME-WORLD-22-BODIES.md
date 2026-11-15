#628 Phase M7 — 22 native Rapier player-body colliders inside the original ball world (opt-in research)

## What is integrated

- `createEngine(RAPIER, scenario, {diagnosticPlayerBodyCollidersEnabled:true})` now creates **22 real dynamic spherical player-body colliders in the SAME Rapier `World` as the accepted ball**. There is no second Rapier world in M7.
- All body colliders use the canonical ordered `INITIAL_PLAYERS` IDs, `PLAYER_MIN_SEPARATION_M/2` research radius (0.49m), fixed timestep 1/60, and native `EventQueue.COLLISION_EVENTS`. Their body-only Rapier collision group `(0x0020 membership, 0x0020 filter)` makes contact possible ONLY with fellow player-body research colliders; **no ball, shoes or grass** collisions.
- The bridge receives actual 22-player `createPlayerMovement().step(...)` output at every 60Hz tick and rejects incorrect tick, ordering, role, nonfinite/overspeed velocity or unphysical position discontinuity. It commands dynamic bodies with the **actual current canonical velocity**. Rapier solves native responses and emits genuine collision events. Read-only `engine.nativePlayerBodySnapshot()` exposes actual physical positions/velocities, source-vs-physical drift, native collision START/END counts, minimum physical interplayer gap and a bounded original-event timeline.
- `core.snapshot()` and the accepted default ball world remain unchanged. The initial-option switch defaults OFF and refuses coexistence with genuine shoe/action contact mode; the private Action LAB and production physics do not receive it. Reset creates a new world, disposes prior native queue and events.

## Important limitation — NOT full integration

- The original kinematic mover continues to own the authoritative 22-player field positions. **Rapier physical body XY is measured but NOT fed back to the mover**, and the next sampled canonical velocity can overwrite the previous solver velocity. This is a source-bound diagnostic parallel to, but in the SAME WORLD as, original ball physics.
- A genuine Rapier body-to-body event is reported only when emitted by Rapier's collision event queue. It is **not** a certified match-body collision, interception, tackle, pass completion, possession or score.
- The 0.98m original kinematic hard spacing is checked separately from native Rapier physical interbody gap. The latter may show solver penetration or divergent shadow positions; never conflate them.
- **Next gate M8**: two-way reconcile source positions with solver positions, combine real foot/ball and body events under one queue, verify collisions under pressure and preserve 0.98m teammate separation and Action LAB invariants before accepting Phase M.

## LAB and verification

- M-11 **22 native Rapier bodies** (HOME/AWAY): 22 current-world colliders + actual native collision events, physical gap and maximum mover drift.
- M-12 **Bodies OFF**: exact same scenario and canonical mover, with zero body colliders and no possible body collision witness.
- Repeatable HOME/AWAY Node 60Hz runs, invalid-frame/option guards, real vs default-off ball trajectory equality, reset/disposal, DEV-only routing, desktop Chrome UI and viewport; broader CI exact HEAD. No Safari/iPhone requirement.

Draft/HOLD #633. No main merge, deploy, database mutation, or approval for tactics/normal 11v11. Phase I/T/F and C2–C5/D1–D5 remain open.
