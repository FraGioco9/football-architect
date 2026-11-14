# P0 — deterministic HOME/AWAY physical baseline (C2 remains open)

Research-only evidence for [issue #480](https://github.com/FraGioco9/football-architect/issues/480), [Draft/HOLD PR #481](https://github.com/FraGioco9/football-architect/pull/481).

## Why this baseline

Compare future *general* football behavior against a genuine 22-player 60 Hz Rapier HOME/AWAY replay, not a hard-coded single late running path. Both existing 720-tick ordinary and opt-in presser-handoff cases are already tested with independent AWAY replay. The rejected early spacing/waypoint prototypes remain rejected; the separate blocked-carry detour remains default OFF.

## Last verified pre-instrumentation physical evidence

On exact [HEAD `700fbb6`](https://github.com/FraGioco9/football-architect/commit/700fbb628acd529dcb42fb681772c21549548438), [ME-01 #43630683157](https://github.com/FraGioco9/football-architect/actions/runs/43630683157) and [FULL #43630682984](https://github.com/FraGioco9/football-architect/actions/runs/43630682984) passed. Genuine real-world Rapier logs recorded:

| Scenario | Real shoe STARTs | Observed actions | 35 m shot-zone frames | Natural SHOT | Best range shortfall |
| --- | ---: | --- | ---: | ---: | ---: |
| HOME IT, ordinary | 5 | PASS tick 1, CARRY 143/175/212 | 0 | 0 | 19.477 m |
| AWAY DE, ordinary | 16 | PASS 1/292, later CARRY, opposing PASS 694 | 0 | 0 | 0.681 m |
| AWAY DE, handoff | 16 | PASS 1/292, CARRY 567, opposing CARRY 694 | 0 | 0 | 0.681 m |

At AWAY tick 640 the genuine carrier `away-9` was blocked by `home-10`. At tick 693, the carrier-ball gap was ~5.251 m, and the ball was still 0.681 m short of the 35 m shooting-range boundary. Opt-in post-carry support grew from 53 to 148 observed frames, without an authentic shot. These are *negative observations*, not frozen requirements to prevent future correct shots.

## New exact-tick raw receiver snapshot

The already-registered `player-ball-press-handoff-ab.test.mjs` reuses the **same genuine HOME/AWAY physical worlds**, without launching duplicates, and records `observedPassDirections` at ticks 599, 640, 693 and 720. Source: the internally returned `frame.ball.position` and `physicalPlayerPositions`. For canonical actor `home-9`/`away-9`, the existing pure `measureObservedPassingCorridors` measures 10 real-frame receiver segments. The log includes the `-10` support receiver's nearest observed opposing-body centreline gap, and up to three widest raw directions. It is deterministic, asserts actor identity, ten candidates, no authorized affordances and both HOME/AWAY contexts.

**Do not conflate geometry with action eligibility:** a wide segment is not an open pass lane. It ignores ball flight, future defender motion, the actor's real shoe-ball contact and the unchanged physical action policy. `passEligible:null` and `physicalPassAttempt:false` here describe the **raw geometry readout only**. Real attempted passes are separately evidenced by actual Rapier START/ACTIVE + applied impulse.

## Reproduction and acceptance

```powershell
node --test match-engine/tests/player-football-intent.test.mjs
node --test match-engine/tests/player-ball-press-handoff-ab.test.mjs
```

The existing ME-01 workflow already covers these tests. Review `C2_3N_REAL_CARRY_PRESS_HANDOFF_AB` and `C2_B_REAL_RAPIER_SHOT_GATE_TIMELINE` on the exact new HEAD. Do not add duplicate 720-tick worlds, promote a negative shot to a pass, loosen the 35 m shooting gate or 0.98 m separation, change the action policy, or alter remote DB/gameplay.

This P0 evidence freeze does not establish C2, approve proposed P1 tactical priorities, or wire P2 intentions to the live mover. Official #480 top-level progress stays **11/20 (55%)**.

## Existing uniform action policy geometry (read-only, no shoe authority)

The existing `src/player-ball-uniform-autonomous-action.mjs` now exposes **`inspectUniformPolicyGeometry`**, reusing its *private, unchanged* `chooseLiveShotLane` and `chooseRecipient` implementations plus the original `SHOT_MAX_RANGE_M`, shot lateral window and exactly the same 22-player lineup. This is NOT a new ranking policy. It is called only from unit tests and the existing physical baseline suite on internal completed frames: the same 599/640/693/720 checkpoints now capture shot-range shortfall, whether the unchanged real policy geometry finds a shot aim point, and which receiver its current algorithm would *geometrically* consider.

An available lane/recipient from this diagnostic is **not** an executable PASS or SHOT. The observer does not check authenticated same-tick exclusive START, shoe gap, cooldown, ball horizontal velocity/height or actual applied impulse; `actualShoeContactVerified:null`, `physicalActionAuthorized:false`, and `authorizedAffordances:[]` prevent false classification. It does not write a mover, select an intent, or apply physics. Its input validation is structural only; only the tests' internal runtime producer establishes provenance. The separate real physical-pass-audit remains the executed action witness.

The HOME/AWAY normal-form checkpoints are still **outside** the existing 35 m shot-range gate for the chosen actors: this explains zero geometrically allowed shot targets there, not the lack of a future shot opportunity. Future P2 behavior improvements must not relax the policy to force C2. The P1 approval gate remains open, and C2/#480 status unchanged.

## P0 genuine pre-impulse contact, gap, cooldown and ball kinematics

The existing `selectUniformAutonomousContactAction` now includes **immutable read-only** `physicalPrerequisites` evidence *only on an action actually selected after its unchanged original gates*. It captures, **before Rapier applies the genuine selected impulse**, the real selector's contact actor/tick, elapsed cooldown ticks, shoe-to-ball gap, ball height/radius and horizontal ball speed. This reuses **exactly** the original policy checks: it introduces no new thresholds, selector branches, decisions, attributes or alternative action authority.

The already registered HOME/AWAY 720-tick true-Rapier regression checks this input evidence on **each actually applied local action**, with authenticated actual shoe START/ACTIVE and applied impulse confirmed separately. A fast pure P0 test independently exercises the unchanged selector's rejection of absent/ambiguous shoe contact, stale/cooldown tick, excessive gap, airborne ball and high velocity, plus malformed/duplicated IDs; this pure test **does not authenticate its synthetic inputs**. The evidence explicitly reports `contactAuthenticatedByShape:false` and never implies an official action/goal or pass completion.

**Scope:** not a snapshot for every rejected zero-action tick, and not a new trusted policy. A more detailed no-action gate diagnostic would require separate source-bound internal instrumentation and explicit review. P1 qualitative policy and C2 natural ordinary-formation SHOT remain OPEN; no top-level #480 progress is claimed (11/20).

## P0 pure no-action input-gate classifier (not yet wired to live Rapier)

`inspectPhysicalActionRejection` is a **pure, read-only** descriptor of the unchanged uniform physical selector's input guards. It identifies the *first* blocking condition in the exact policy order: `no-exclusive-shoe-start`, `cooldown`, `ball-height`, `ball-speed` or `shoe-ball-gap`. A `null` first failure indicates only that this limited input-gate check passed, **not** that any action was selected or authorized. The function makes no physics writes and offers no football affordances. Structural matching arrays are not authentic Rapier shoe events.

The registered fast decision suite tests each rejected case against the original, unmodified `selectUniformAutonomousContactAction`, multiple failures in precedence order and malformed inputs. **Next required P0 step:** invoke this observer inside the canonical internal 60Hz pre-impulse boundary and cross-check rejected/no-action ticks against genuine Rapier START/ACTIVE; never reconstruct this input from the post-impulse frame. P0 parent, P1 approval and C2 genuine shot remain open; #480 still 11/20.

## P0 real 60Hz rejected/no-action tick evidence

The pure `inspectPhysicalActionRejection` is now invoked at the **canonical internal real Rapier contact boundary** on the same exact tick and same ball/player inputs as the unchanged physical action selector, **before** any impulse. The immutable `physicalRejectionAudit` carries first-failed input gate or a conservative `not-selected-after-input-gates` fallback, with explicit `actionSelected` and no claimed football authority. The universal world verifies this against its real START/ACTIVE shoe feed; the fixture wrapper exposes the audit read-only. The existing 720-tick HOME/AWAY A/B replay accounts for every frame (selected action + rejection count = 720), preserving original negative ordinary-shot observations. No new physics worlds, thresholds, tactical decisions, contact generation, possession or action authority. P0 acceptance still requires exact-head CI and reviewing real reason totals; no P1 priority approval is implied.

## P0 exact real HOME/AWAY first-blocking reason counts — frozen

Source: **existing** 22-player 720-tick Rapier HOME/AWAY fixture, [ME-01 #43636102036](https://github.com/FraGioco9/football-architect/actions/runs/43636102036) on exact commit `b1a914b4f5e97893ac39f403689e61b5faad49b9` (SUCCESS, 17/17 pure and 5/5 genuine Rapier tests). Values below are parsed from the `C2_3N_REAL_CARRY_PRESS_HANDOFF_AB` line of the **actual completed job log**, not estimated from a geometry snapshot. `baseline` is default-off blocked-carry detour; `handoff` is opt-in experimental detour. Each run counts **720 distinct 60 Hz ticks**, with one source-bound pre-impulse reason or one genuine selected action per tick.

| Fixture | Mode | No exclusive shoe START | Cooldown | Ball height | Ball speed | Shoe gap | Fallback after gates | Selected actions | Total ticks | Natural SHOT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| HOME | baseline | 715 | 1 | 0 | 0 | 0 | 0 | 4 | 720 | 0 |
| HOME | handoff | 715 | 1 | 0 | 0 | 0 | 0 | 4 | 720 | 0 |
| AWAY | baseline | 704 | 2 | 0 | 0 | 0 | 0 | 14 | 720 | 0 |
| AWAY | handoff | 704 | 2 | 0 | 0 | 0 | 0 | 14 | 720 | 0 |

- **HOME**: genuine shoe STARTs = 5, selected actions at ticks 1 (PASS), 143, 175, 212 (CARRY); 1 rejected cooldown tick. No physical divergence between baseline and handoff.
- **AWAY**: 14 selected actions, 2 cooldown rejects, 704 ticks without an exclusive shoe START; opt-in handoff first physically diverges at tick **600**, yet the *reason totals stay identical* and there is no natural shot. The final tick 694 action differs in label: baseline PASS vs experimental CARRY (both `home-7`); this does not establish better gameplay.
- No `ball-height`, `ball-speed`, `shoe-ball-gap` or `not-selected-after-input-gates` rejection occurs in these two specific ordinary formation cases. This **does not prove** those gates are unnecessary, nor does it imply a passing lane or shot eligibility. It means the overwhelmingly dominant blocker in this sample is *absence of a fresh exclusive real Rapier START*, not an excessive shoe-to-ball distance after START. No threshold tuning is justified by these counts alone.
- The existing tests already assert the full 720-tick accounting and A/B replay determinism. These frozen figures are observational and do **not** authorize synthetic contacts, gameplay changes, or new pass/shot policy. Preserve the negative C2 natural-SHOT finding. P1 qualitative approval remains separate.
