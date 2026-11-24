#628 — Phase M3: authenticated post-PASS movement and opponent-sampled defensive recovery

**Scope:** Draft/HOLD #633, incremental source-bound observer only. No new tactical decision policy, ball impulse, official result, or player teleport.

## Post-PASS receiving run — real HOME source
- This scene delegates to the already accepted `createControlledActionLab(RAPIER,'control')`. It does NOT construct an alternative Rapier world, fake shoe START, physical impulse or standalone PASS selector.
- That closed Action LAB witnesses HOME #10 authentic PASS (tick 1), then HOME #9 movement from the original canonical 22-player mover. M3 exposes **read-only canonical mover samples** through `observedMovementPlayers` while preserving the older projected Action LAB fields.
- Measured post-pass path accumulates strictly after a genuine PASS witness (same immutable `priorRealPass` with `physicalImpulseApplied === true`), never from a target, proximity or guessed possession. A separate receiving shoe START is diagnostic observation only, **not** pass completion or possession.
- Only HOME is supported at this checkpoint. AWAY post-PASS deliberately rejects requests; no unwitnessed mirrored pass or opponent event is claimed. AWAY parity is a later source-authority gate, not a UI mirror alone.

## Recovery under real opposition and negative control — HOME/AWAY
- The positive scenario inspects `screens`, `recoveries`, actual current opponent ID and the currently assigned player as produced by the existing canonical mover, not by fabricated opposition fixtures.
- Positive goal-side distance is measured from two consecutive actual XY samples of the **same assigned player versus the same currently observed opponent**; hard-blocked ticks cannot contribute. Merely assigning a defender is not a measured response.
- The negative scenario keeps the actual Rapier ball away from an opponent-detection context; absent a current opposition observation, no phantom recovery witness is awarded.
- Both remain **position-only**: standard Rapier ball world with shoe colliders and autonomous physical actions DISABLED; no successful tackle, interception or recovery of possession can be inferred.

## Safety and QA
- One 60Hz source per scene, 22 canonical body positions, minimum 0.98m separation, deterministic reset/replay, no in-simulation teleports.
- Separate Node M3 scenarios plus extended real Chrome Movement LAB interactions; prior five physical Action LABs unchanged.
- Keep `#633` Draft/HOLD, no merge/deploy/remote database. Safari/iPhone QA N/A for the desktop-only DEV LAB.
- Follow-up: genuine AWAY post-pass provenance, independent physical contest after tracking, and later Phase I decisions. Historical C2-C5/D1-D5 remain open.
