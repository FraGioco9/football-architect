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

## LAB-VAR-02 — Live contextual physical-action choice

**Isolation**: only the five small-sided scenes with V02–V30 enable the seeded choice. V01 remains the original uniform baseline. The default 22-player selector and 17 legacy closed Action LAB regression cases remain unchanged. There is NO externally submitted player command or action impulse.

At a real, exclusive Rapier shoe START, with original 60 Hz movement, live ball coordinates and the actual 2–7 active participants:

1. Retain original priority for real keeper physical parry attempts and genuine defensive tackle/interception attempts.
2. Compute actual shooting-lane clearance, genuinely eligible recipient and unobstructed pass, and short-ground carry eligibility using live geometry. No candidate means no chance of selecting it.
3. Weight only eligible **shot/pass/carry** options according to distance to goal, direct opponent pressure, lane clearance and recipient availability. Choose by seeded, symmetric hash of situation/variant/player number/physics tick. The weights allow a close-range shot even when a pass exists, while a safe pressured pass may win despite an open shooting lane. A carry is a single 0.42 Ns native short touch, **not** dribbling success, controlled possession, shielding or an animated fake.
4. The existing executor checks the original source evidence gates and applies one and only one Rapier impulse in the existing World; records a read-only contextual-choice trace within `decisionContext`. The UI displays the latest ACTUAL Rapier action rather than labeling a planned but never executed choice as completed.
5. If no shot/pass/carry is viable, retain the original player action fallbacks. No official goal, score, pass completion, reception, save, interception or possession is manufactured.

**QA**: pure seeded mirrored HOME/AWAY choice distribution for 29 variants, blocked-opportunity negative cases, 22-player/ordinary scenario fail-closed behavior, real physical first-attempt distributions in 1v1 vs goalkeeper and 2v1 with native shoe START and impulse. Further success/failure mechanics, player attributes and variable execution strength remain LAB-VAR-03/DRIBBLE-01 and are not claimed here.

## LAB-VAR-02B / Phase 1 — physical body and ball-contact source (experimental)

**Status: under physical/regression QA; NOT shielding complete.** The previous LAB decision selector's short carry is not a possession or true protective dribble. To avoid a fake "shield" label, all five visible small-sided Lab scenes (V01–V30, HOME/AWAY) **start with physical Bodies ON**. The in-field **Bodies** button is a manual opt-out/re-enable for physical A/B comparison, not a separate popup. This runs in the SAME original ball Rapier World, with no other world or physics step:

- Selected 2–7 original canonical actors only (never instantiate physical colliders for the other 15–20 inactive actors); one dynamic zero-gravity body per selected actor, with upper torso sphere (native player/opponent body contact) and smaller lower-leg sphere (native ball collision only). Original shoe colliders exclude the body category; ball body/collider are not replaced.
- Original 60Hz canonical mover velocity drives these physical bodies; the native solver alone determines whether body collisions and ball deflections occur. Body responses are explicitly NOT fed back to the canonical mover; authoritative full shielding/play/possession cannot be claimed from this isolation experiment.
- Read exact post-step `world.contactPair` native solver manifolds for leg/ball and opposing torsos, with genuine starts, ends, active contacts and original body positions; never generate contacts, interpolate made-up events, or count nearby players as collisions.
- Prevent a double autonomous shoe impulse on a tick that already has authentic native body/ball contact. The ball still responds physically from Rapier alone. **The visible Lab defaults to Bodies ON in V01–V30.** The API/automated legacy fixtures still default to Bodies OFF unless explicitly enabled, preserving the old original-physics regression reference. Regular-world, archived non-small-sided scenes and 22-player match paths keep it unavailable and fail closed if the guard is requested without an isolated V02–V30 actual shoe source.
- The inline LAB shows native contact evidence only on ticks with actual contacts; every record continues to say `ballProtectionProven:false`, `successfulPossession:false`, no official goals or tackles.

**Acceptance for complete LAB-VAR-02B remains OPEN:** measured repeated opponent intervention and actually retained/covered ball resulting from physical response, with the original player's kinematics respecting those solver responses. This foundation detects real collisions, but does not itself prove a successful shielding technique, or create virtual ball control.

**Regression isolation:** An earlier global auto-on implementation suppressed valid legacy shoe impulses and failed VAR-02A regression tests. The updated design defaults Bodies ON **only in the visible reduced-player Lab**; the programmatic/archived action fixtures remain OFF unless explicitly requested and retain their original validated distributions. The user can turn Bodies OFF for a clean same-seed comparison; manual OFF persists across variations inside the same scene, while choosing a new exercise restores ON. V01 uses its identical baseline geometry with physical bodies ON in the visible Lab and can be switched OFF for original-physics comparison. Dedicated body guard tests are now added to the package's explicit test manifest rather than being silently skipped.

**LAB-VAR-02B UI correction (2026-11-17):** user explicitly requested native player bodies default ON. Verify in Chrome that every newly selected small-sided scene starts with `aria-pressed=true` even for V01; Reset/HOME/AWAY/Next retain ON, manual OFF is respected, switching to another exercise restores ON, and non-small-sided scenes cannot enable the collision guard. This does not represent a claim that ball shielding or possession has been proven.

## LAB-VAR-02B / Phase 2a — bounded body-to-mover feedback (not shielding acceptance)

With visible Bodies ON the SAME original Rapier World now supplies selected 2–7 body XY solver responses to the existing 22-player canonical mover *after* the native shoe/ball integration. Only actual native ball/leg or opposing torso solver manifolds qualify. The whole correction is atomically rejected unless the exact 60 Hz prior mover position, <=7 m/s speed, legal pitch bounds, >=0.98 m separation from every canonical actor, and next-tick original shoe handoff all remain valid. A same-tick acknowledgment synchronizes original body bookkeeping; no collision, extra physics tick, kick, possession or player teleport is invented. Bodies OFF retains the previous isolated shoe-only baseline. Source snapshots report the exact tick, applied/rejected XY adjustment and reason, and retain `ballProtectionProven:false`, `successfulPossession:false`, `tackleWon:false`. This is a *guarded feedback foundation*, not evidence of ball retention or successful shielding; repeated contested-ball physics QA remains open before LAB-VAR-02B/2 can be marked complete.
