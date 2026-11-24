#628 Phase M11 — unstaged autonomous 22-player native body-contact audit

## Purpose and precise limitations

The M10 natural-support experiment verified true 22-player autonomous support and a moving opposing presser with the original Rapier shoe/body event observers, but recorded **0 native body COLLISION_START events**. M11 does not pretend those events occurred. Instead it performs a **reproducible, bounded 12-position × HOME/AWAY sweep** to determine whether the original mover's own autonomous positions can cause a genuine native Rapier body-body impact. Only true `Rapier.EventQueue.COLLISION_EVENTS` events can increment body contact counts.

## Invariants

- `createPlayerMovement()` always receives **NO options**: unchanged 22-player `INITIAL_PLAYERS`, real 60Hz acceleration/braking/turning/press/support, hard 0.98m original separation, <=7m/s. All ball positions are chosen strictly before tick zero, never moved arbitrarily later; scenario initial ball is the *only* independent variable. 12 fixed locations cover central, near-central, flank, attack/defense thirds and box entries; HOME/AWAY mirror the X coordinate.
- Per state one original Rapier ball `World`, **one** native Rapier collision/force `EventQueue`, 22 original shoe proxies plus 22 body colliders, default research body radius **0.49m** (not M8's explicitly staged 0.51m skin). No artificial physical overlaps or extra contact categories.
- A native body START requires the same current tick Rapier collision event with original pair IDs and native `rapier-body-start` source. Per-tick starts must sum exactly to the native bridge's cumulative count. Current active-pair candidates require a previous, independently recorded real Rapier START. Ended contacts without active pairs are not counted as opportunities for physical mover feedback.
- Every original source tick is validated against all 22 identities, 7m/s one-tick displacement, pitch boundaries and full 0.98m canonical separation. The native nearest pair, nearest *opposing* pair and minimum canonical player gap are separately computed. A near miss is merely geometric, never a tackle, interception or collision.
- The **read-only feedback safety screen** evaluates a real active native pair's *actual solver XY* substituted only for that pair, while leaving all other original player positions unchanged. Every candidate must satisfy the original 22-player pairwise >=0.98m gap, pitch bounds and <=7m/s displacement from prior original canonical XY. The screen does **not** mutate mover or physics. It can return `no-native-active-pair` or a specific rejected physical bound. No gameplay authority is conferred.
- A body-disabled/shoe-disabled control is run with the same original 22-player mover and original ball, and produces no native body/shoe contact observations by construction. Validates research OFF truly remains free of private native proxies; the default original ball world still exists.

## Reproduce

From `match-engine/`: `npm run audit:unstaged-body` runs all 24 original-world scenarios for **160 ticks each** and prints `ME_628_M11_AUDIT` JSON including the genuine contact total, physical shoe total, nearest real native body pair, distance and admissible candidates. The same audit is called by the Node test suite (`tests/unstaged-body-contact-audit-m11.test.mjs`), with independent HOME/AWAY replay, original/no-body negatives, invalid option checks, malformed source rejection and forged active-pair rejection.

## Acceptance boundary

M11 is an **audit gate**, not general player-body physics integration. Report actual positive events if present; if the genuine native contact count is zero, report zero and retain the absence as a constraint. Never manufacture a contact by enlarging collider radius, changing player spawn positions, forcing their movement or awarding possession. A read-only candidate, even if physically admissible, does not authorize a match action. Native body responses are only feedback-integrated in the already bounded/staged M8/M9 research encounter, **not** here.

**Follow-up:** If native STARTs are absent in the original mover, separately design and validate source-grounded natural opposing convergence while keeping 0.98m and preserving the five original Action LABs. Only after a genuine, repeated source contact and safe all-22 candidate should generic feedback be introduced. Phase M and I/T/F, C2–C5 and D1–D5 remain OPEN. PR #633 Draft/HOLD. No merge, remote DB changes or deploy.