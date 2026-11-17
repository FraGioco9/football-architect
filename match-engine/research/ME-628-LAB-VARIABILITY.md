# ME-628 / LAB-VAR-01 — Deterministic small-sided variations before football-skill tuning

The existing Lab previously had one fixed starting geometry per S-01…S-05 for HOME/AWAY. The user observed identical action sequences. This increment creates **30 reproducible physical initial positions per visible small-sided exercise**, without inventing any football outcome, simulated touches or in-play teleports.

## Source and constraints

- `smallSidedSetup(id,side,canonicalPlayers,{variantIndex})` accepts an integer in **0…29**, rejects invalid values, and preserves **V01 / variantIndex=0** exactly for all prior tests.
- For V02–V30 the same deterministic integer PRNG, keyed by `id#variantIndex`, samples initial ball X/Y, forward ball-start alignment, supporting forward positions, defensive lines, and goalkeeper depth/angle. Every candidate is checked against **all 22 canonical identities** for at least **1.15 m** pairwise separation (canonical required lower bound 0.98 m). Up to 96 bounded deterministic retries; impossible geometry fails closed. Only these 2–7 selected players receive authentic Rapier shoe colliders.
- HOME/AWAY are exact X mirrors with equal Y, seed sequence and player numbers, with no privilege for either team. Ball starts at rest, and only authentic Rapier impulses may change its physics. No changes to production game policy, ball aerodynamic parameters, player skills, or official results.
- Side and Replay/Reset preserve the selected `variantIndex`; Next/Previous traverse all 30 from the existing in-page toolbar. Switching to a different exercise resets to V01. Existing field/elevation/transport and visible scenario catalog remain unchanged.
- A single per-source `variantIndex` is threaded to the existing **same** Action Lab session, Rapier `createEngine` and canonical `createPlayerMovement`; all three stage exactly the same coordinates, not independent or duplicated worlds. Dedicated fail-closed flags prevent variants leaking into ordinary match simulation or archived diagnostic action scenes.

## QA

- All 5 scenarios × 2 sides × 30 variants = **300 source geometries**: mirrored X, exact seed replay, 22-player separation, near-ball actual active shoe, distinct positions, source-only football outcomes.
- Rapier physics: 5 × HOME/AWAY × V02,V10,V22, 60Hz ticks, original active collider list, native shoe START and impulse, deterministic repeated runs, no inferred goals, saves or possession.
- Chrome: visible Next → different actual initial ball, Reset → identical, Previous → original; original main pitch with no modal. Explicit desktop `--window-size=1280,800` tests main viewport, while the separate dedicated viewport matrix remains authoritative for smaller heights.
- Passing VAR-01 does **not** mean decision utility / execution quality / realistic dribbling are complete. The next stages LAB-VAR-02, LAB-VAR-03 and LAB-DRIBBLE-01 remain separate checkboxes and require comparative QA.

No full 11v11 until the reduced situations have been approved. PR remains Draft/HOLD, no deploy, merge or remote database writes.
