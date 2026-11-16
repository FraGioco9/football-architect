#628 Phase M12 — opt-in source-driven opposing press convergence, without staged actors

## Why this is required

The M11 matrix sampled 24 ordinary 22-player matches for 160 ticks and saw **zero native body-body collision STARTs**. Its smallest opponent distance was ~3.007m. The existing press policy sends the two opposing pressers toward ball.x ±1.8m, maintaining a 3.6m target gap even when the original ball is stationary and both genuinely observed opposing pressers approach it. A real natural contest requires both actors to be allowed to close in on the **actual ball** without fabricated opponents or physical collision events.

## Implemented as strictly isolated research policy

- New opt-in **`createPlayerMovement({researchOpposingPressConvergence:true})`**. No player staging or pre-scripted opponent targeting. The initial 22 actors are precisely `INITIAL_PLAYERS`; normal default `createPlayerMovement()` and all previous Action LABs remain unchanged. The flag may not be combined with M8/M9 controlled encounters, research passes, carries or any other option.
- Pure `observedOpposingPressConvergence` checks the **two independently assigned actual current pressers**, their observed position relative to the actual physics ball, and their actual mutual gap. Entry requires each presser <=6m from the ball and an opposing-player gap <=12m. For the same real pair, hold thresholds are <=9m/<=15m to prevent repeated 60Hz switching. No actual presser/too-far ball -> negative; no inferred football possession.
- While both are authentically engaged, only their pressing *intent* changes to the **actual current ball XY** instead of the original ±1.8m screen. The same original 60Hz acceleration/braking, 7m/s, orientation, all-22 0.98m hard collision rejection, team spacing and formation remain in force. No body positions/velocities are fabricated, no collider radius enlargement, no invisible player movement.
- The core runs the same M9 one-original-Rapier-ball-world / one-authentic-collision-and-force-queue research mode with all 22 native body + shoe colliders. Only actual native `rapier-body-start` events, with the original ID pair and tick, count as physically real body contact. Mere presser convergence/proximity, refusal by canonical hard guard, or physical shoe START is not a body event.
- An opt-in extension to the existing M11 reproducible audit, rather than an unrelated artificial scene, measures both positive convergence and negative original policy from the same fixed 22-player lineup and real ball-state inputs. The read-only M11 response-admissibility screen is reused; it never modifies the authoritative mover, takes possession or awards a tackle.

## Acceptance plan

- Compare six pre-selected ordinary initial ball territories mirrored HOME/AWAY (12 research sessions), 225 original 60Hz ticks each. Record real observed engagement ticks/actor IDs and distances, nearest real opposing player gap, same-world original native collision STARTs (including their exact pair/tick), native shoe STARTs, and source-valid read-only body response opportunities.
- Verify repeated replay, original-actor identity/order, <=7m/s and all-pair >=0.98m, unchanged original no-policy negative and body-disabled negative. If no original native event occurs, M12 positive contact remains **FAILED/OPEN**, regardless of near-miss distances; do not fake or widen colliders to pass.
- Run `cd match-engine && npm run audit:opposing-convergence` for the independent audit JSON; `npm test` includes M12 contracts; desktop Chrome, routing and exact-head general CI must remain green.

## Not football match authority

Even a source-confirmed native body START during naturally convergent opposing pressing does NOT prove a successful tackle, possession, interception or full 11v11 match rules. The native response in this step is only evaluated **read-only** against 0.98m, pitch and speed constraints. No general unstaged solver-to-mover feedback is authorized yet. Phase M and I/T/F and C2–C5/D1–D5 remain open. Existing PR #633 Draft/HOLD; no merge, deploy, remote D1.
