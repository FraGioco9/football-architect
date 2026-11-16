#628 — Phase M9: single original-world native queue for shoe and body physics

## Architectural contract

- One original `Rapier.World` contains the accepted genuine ball, 22 native dynamic player body colliders and the canonical 22 kinematic shoe proxies **only in explicit opt-in DEV research mode** `diagnosticSharedContactEventsEnabled:true`. The mode requires both bridges active, with `diagnosticAutonomousFixtureActionEnabled:false` and `diagnosticAutonomousCarryEnabled:false`. Existing default, shoe-only and body-only modes do not change.
- There is **one** new `Rapier.EventQueue` and **exactly one** `world.step(sharedContactQueue)` per 60Hz tick. The core drains native collision events and contact-force events once into immutable same-tick samples, then forwards the same authentic samples independently to the existing shoe observer and 22-body observer. Neither observer drains or frees that shared queue; its owner is the core and frees it exactly once. Unshared legacy observation paths are unchanged.
- Collision categories are explicitly isolated **only in shared research mode**: real ball and shoe collider membership/filter `0x0001/0x0001`, player body membership/filter `0x0020/0x0020`. The ground remains unchanged and is compatible with the ball category. Shoes may physically affect the existing ball; player-body colliders interact with each other, **not** ball/shoes. Mere proximity, same physics tick or body contact can never be turned into a shoe-ball START.
- `sharedNativeContactSnapshot()` supplies the original physics tick, one-world/one-queue flags, physical native collision/force event counts, genuine shoe-ball START IDs and genuine body START/pair states. All official-match action, tackle, score and possession fields remain false/null.

## Tests and honesty boundary

- M-15 uses the existing M8 before-tick-zero opposing-forward approach and exact original canonical 22-player acceleration, hard 0.98m separation, speed bound, native body collision event and bounded solver XY feedback, while 22 shoe proxies are simultaneously present. Side mirroring HOME/AWAY, original Rapier ball unchanged until acted on by a genuine physical shoe collision. **No football action executor is active**.
- M-16 is exactly the same 22-player encounter with native body and shoe bridges **OFF**, and must never claim a body or shoe physical witness.
- A separate same-world **authentic shoe-positive** test places one original stationary Rapier ball at the existing HOME #10 oriented shoe location (a before-tick-zero bounded test state, no event injection), alongside all 22 native body colliders. It compares the actual original shoe START evidence and ball trajectory against the accepted shoe-only baseline. This independently proves shoe events are not consumed by body observers. The staged M-15 body event and shoe event do **not** have to occur on the same tick; the evidence must report exactly which did and did not happen.
- Tests must reject missing/shared-only switches, combined action executor, any synthetic body/tackle/possession signal; verify deterministic 60Hz independent HOME/AWAY and reset/disposal, five accepted original Action LABs, browser interactions and DEV-only route controls. Full exact-head CI required.

## Not yet finished

This certifies **genuine, separate shoe-ball and body-body event routing within one Rapier world and one event queue in research**; it does **not** authorize natural football possession, completed pass, player-body tackling, or full 11v11 match physics. The body feedback scenario is still explicitly staged, the shoe-positive baseline separate, and combined gameplay action decisions under spontaneous pressure need further M work. Phase I/T/F and C2–C5/D1–D5 remain OPEN.

PR #633 must remain Draft/HOLD. No main merge, deployment, database writes or new official football authority.