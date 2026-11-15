# #628 Phase M6 — real support-lane movement and isolated Rapier player-body contact proof

## M-09 / M-10: source-only support lane in the existing 22-player Movement LAB
- The **actual original** `createPlayerMovement()` decides which teammate is eligible to support and which lateral corridor is preferred using current opponent and teammate XY. The observed field is unmodified.
- The adapter follows only that *assigned player*, from its real `frame.supports[side]`, and records a strictly consecutive 60 Hz path and measured advance toward the actual current assigned target. Any player or lane change interrupts the continuity. A target alone does not earn a witness.
- `support-lane` uses a stationary real Rapier ball in the opposing third (x=+27 HOME / x=-27 AWAY). `support-neutral` uses the centre of the pitch and must never fabricate a support assignment.
- Display actual runner ID/lane, accumulated path/advance, and source-computed minimum teammate/opponent clearance; retain a 0.98 m hard kinematic 22-player gap.
- Both remain *positions only*: no Rapier shoe/ball contact enabled, no pass/reception, no possession or result; no changing target policy or tactical decisions.

## Separate native Rapier body-pair proof (research only; not the canonical world)
- `src/rapier-body-pair-probe.mjs` constructs an **isolated disposable Rapier World**, with exactly two real *dynamic spherical player-body proxies*, zero gravity for an XY experiment and no ball/score/action.
- Impact and diverging no-contact examples use native Rapier `EventQueue` collision events (`COLLISION_EVENTS`) and the actual post-solver body velocities, with HOME/AWAY mirrored starting velocities. Never invent a contact from distance; a witness needs a real Rapier `COLLISION_EVENTS` start.
- This validates the basic native collider event/response plumbing and a paired negative. **It is not a body collision in the accepted canonical 22-player match world and must not be reported as one.** Current world still uses a hard kinematic 0.98 m rejection. Further integration of Rapier bodies with full 22-player dynamics/collision groups is a separate acceptance gate.
- Body pair's collision distance is 2×PLAYER_RADIUS_M, not the *canonical* 2×radius+0.10 m separation guard; do not confuse these or grant a tackle/interception/possession.

## Verification and stop conditions
- Source-only deterministic Node M6 support/home/away/reset/neutral + native Rapier positive/negative tests, existing 312 Node tests, 9 routing tests, real desktop Chrome for two new choices, full exact-HEAD CI before acceptance.
- No shoe START or physical ball impulse from M-09/M-10; no player-body event in the canonical match; no replay teleports or tactical AI.
- Keep PR #633 Draft/HOLD. No merge/deploy/remote D1 changes. Follow-up: integrate actual player-body colliders into the approved core world with source-only collision response, fully independent quality gates, and separately verify support under real passing pressure before Phase M can close.
