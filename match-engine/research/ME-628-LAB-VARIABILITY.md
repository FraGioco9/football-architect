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


## LAB-DRIBBLE-FIRST / candidate implementation (PR #633)

The new visible **D-01 Dribbling 1v1 (no GK)** uses exactly two original Rapier shoe collider actors: attacker #10 and opposing defender #2. The original 22-person movement frame stays validated, with HOME/AWAY mirroring. No goalkeeper, scripted pass/shot/tackle, modal, artificial contact, possession or completed dribble is introduced. Default browser Bodies ON remains available for A/B with OFF.

The isolated `isolatedDribbleContext` is created only from the pre-tick-zero real 1v1 setup and threads through the original single-world closed action executor. Upon a *genuine exclusive* attacker shoe START only, the existing carry action uses a ground impulse: V01 original 0.42 Ns straight baseline, V02–V30 deterministic 0.30–0.54 Ns with bounded lateral aim responding to actual defender coordinates and tick. Defender shoe/body contact remains Rapier-native without automatic action impulse. No claimed continuous dribbling or retention until measured multi-touch QA.

Candidate status: test and browser CI required; source-bound traces do not prove successful dribbling. PR remains Draft/HOLD. No merge/deploy/remote DB.


## LAB-DRIBBLE-FIRST-02/03 — source audit (research, not gameplay)

An isolated read-only D-01 Rapier audit records authentic native attacker shoe START/END/recontact, exact exclusive action impulses, defender shoe START, measured 2D ball travel, defender-ball proximity, active body-ball and torso collisions, all-22 canonical 0.98m minimum separation and 7m/s maximum speed. The inline field readout displays physical carries, native releases, independent recontacts and travel (no virtual possession). A 120-trial matrix covers all 30 variants × HOME/AWAY × Bodies ON/OFF for 180 genuine 60Hz ticks per trial, with 8 exact replay pairs. Its log distinguishes multi-touch physical success from mere variation of the first touch. Never mark an unobserved release or recontact as success. Future improvements to turn/carry kinematics must be isolated to D-01.


## D-01 VISUAL REALISM REWORK (17 November 2026, #628, PR #633 Draft/HOLD)

Owner rejected the previous candidate as too strong, lofting and infrequent. The first honest 120-run matrix recorded ~0.30–0.54 Ns impulses, ~1.93 applied carries / 3 seconds per trial and confirmed real START/END but **not** visually acceptable dribbling. The D-01-only rework leaves all other Match Engine situations, the official match path, 22 canonical players and one Rapier World intact. It uses 0.095–0.170 Ns impulse proposals (V01 0.12), zero rebound on the original D-01 ball/shoe/grass, reduced equator-height shoe collider, D-01 lower-leg collider at ball center, 4-tick D-01 policy cooldown, 4 m/s jog cap for active D-01 players, and a continuous 10.5 cm / 24-tick (2.5 Hz) *real kinematic shoe stride* subject to a 7 m/s checked maximum. Original shoe START/END events are still generated by Rapier only; no scripted contact or fake possession.

The original V01 had a shoe deeply overlapping the ball before tick zero; staged further behind and now observed from a genuine native approach. The latest [ME-01 targeted run](https://github.com/FraGioco9/football-architect/actions/runs/44009151575) PASS at `b3877055`: 443/443 Node, 10/10 routing/security, Chrome viewport and action-scene browser PASS. **30 variants × HOME/AWAY × Bodies ON/OFF = 120** deterministic real 180-tick samples and 8 replay pairs. At this candidate: **V01 all four combinations = 6 native applied carries, 5 real independent recontacts, ~5.007 m forward ball path, 0.0 cm peak lift, ~2.867 m/s maximum ball velocity**. Across all variants, peak measured ball-ground clearance **1.312 cm**, zero frames above 2 cm, measured max ball speed **3.2642 m/s**, 102/120 trials with at least one applied physical carry, 81/120 with repeat carries, 85/120 with real release/recontact, 25/120 with four or more carries, mean **2.475 carries per 3 seconds**. 18 trials lack applied physical carries and remain true negative evidence, not awarded success.

Automated test thresholds enforce these physical bounds but do not certify realistic success against a defender, foot anatomy, official possession, or visual acceptance. D-01 continues HOLD until fresh owner observation in the existing inline LAB. No deployment, merge, remote DB writes, tactics, keeper, shots or full 11v11 are authorized.


## 2026-11-17 — D-01 continuation: pressure-pacing and variation start QA

Initial D-01 V01 was confirmed physically grounded and repeated, but original 120-trial distribution still had **18 no-carry samples**, only **81/120 multi-touch**, and mean **2.475 carries in 180 ticks**. The next candidate stages every variant's attacker 0.50–0.67 m behind the original pre-tick-zero ball (V01 unchanged), rather than 0.25–0.51 m where a native shoe proxy may initially intersect the ball; every other small-sided situation preserves its geometry. The D-01-only carry intent now draws a stable per-variant lateral bias, modest per-touch deterministic correction, measured defender proximity and direction, plus reduced applied impulse as measured forward ball speed rises. No in-play repositioning, second world, synthetic contact, or possession. Extend the physical matrix with actual attacker-ball gaps, reverse travel and weak/no-carry sample diagnostics. Compare exact-head CI before asserting improvement.
