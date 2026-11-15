# #481 contact layer split — genuine Rapier shoe evidence

This is the second **small** extraction for the action-first redesign ([#620](https://github.com/FraGioco9/football-architect/issues/620)) after pure action-policy Draft PR [#622](https://github.com/FraGioco9/football-architect/pull/622). It is stacked directly on #622, not on the 208-file Draft #481.

## Boundary — what was extracted

The following three modules were copied **byte-for-byte** from the original #481 source HEAD `82bf5d8`:

- `src/player-foot-contact.mjs`: 22 canonical kinematic shoe proxy dimensions, orientation/quaternion, and strict consecutive 60Hz mover/frame validation (body speed, heading turn, player identity, role and bounds).
- `src/player-foot-contact-timeline.mjs`: consumes observed *real Rapier-sourced* unique ordered START/ACTIVE/END lists to measure contact episodes and closing relative movement; does not create an event or manipulate the ball.
- `src/player-foot-contact-solver.mjs`: immutable read-only Rapier force-event/manifold summaries with source pair identifiers, independent of football action authority.

The new `tests/player-foot-contact-foundation.test.mjs` constructs a **test-only** closed 22-shoe Rapier world with the **same original dimensions, mass/inertia, ball radius, 60Hz tick, response materials and kinematic player adapter**, so it can measure genuine collision events in a disposable fixture. It samples actual `EventQueue.drainCollisionEvents`, `drainContactForceEvents` and `contactPair`; the source pairs are accepted only when a real ball collider and a known canonical shoe collide. Mirrored HOME/AWAY independent replays, frame spoof/gap/teleport rejection and immutable readouts are asserted. **The test world is never included in, or exposed to, normal gameplay.** It verifies the extracted geometry and read-only parsing functions against genuine Rapier outputs, not a standalone operational game session.

## Unimplemented integration — kept separate

The canonical ball engine's existing `src/core.mjs` on `main` does not yet integrate shoe collider creation or drain the Rapier event queue. The original #481 `core.mjs` extension is interwoven with many experimental local passing/movement/defense options and must **not** be copied wholesale. The next extraction must insert one carefully audited, opt-in physical shoe bridge into the existing ball engine, with exact-HEAD authentic contact regressions and preserved default-off core physics. No separate competing gameplay ball world.

A synthetic claimant can forge a structurally valid collision list; validators alone do **not** authenticate the source. Only a *private* Rapier producer/collector owns provenance. Nothing in this PR grants a kick, an official pass completion, a tackle, a dribble, possession, score, or a natural C2 shot.

## Acceptance
- [ ] New exact-HEAD ME-01 + existing main baseline regressions PASS.
- [ ] HOME/AWAY real event START and solver checks PASS, with no invented distance-derived contact.
- [ ] Original three module blobs identical to #481 source HEAD `82bf5d8`.
- [ ] Subsequent opt-in core bridge and genuine runtime source/consumer integration; then rebase Action LAB #621.
- [ ] No merge, deploy, DB writes or ready-for-review without distinct authorization.

Legacy accepted #480 physics gates stay 11/20 (55%). #481 and #621 remain preserved Draft/HOLD.
