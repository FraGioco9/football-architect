# Match Physics V1 — closure and playable-gameplay acceptance contract

**Status:** ME-PB-48 physics closure audit, 2026-11-11. See
[issue #480](https://github.com/FraGioco9/football-architect/issues/480)
for the 20 exact acceptance gates, authoritative progress ledger, and
per-intervention check-ins. [PR #481](https://github.com/FraGioco9/football-architect/pull/481)
remains Draft/HOLD. No merge, deployment, or remote D1 writes authorized.

## Intent: playable V1, not a new physical research program

One universal 0.43kg / 0.11m radius football, one fixed 60Hz Rapier world,
one universal response scalar (research default 1.00, uniform for all shoes,
players and pitches). Any necessary restitution/friction/grass constants
are internal solver mechanics, not independent game settings. No
per-player boots, materials, stadium surfaces, conditions, or extra sliders.

The **V1 physics** closure contract is deliberately modest and measurable:

1. An ordinary ground pass/rolling ball slows on the common ground and
   eventually rests. No spontaneous horizontal acceleration at rest.
2. Airborne balls move under gravity (simple ballistic arc) without
   being braked by the rolling-grass-only term.
3. A dropped ball has real Rapier ground collision, rebounds lower
   than the release height and does not tunnel through the pitch.
4. A 22-player, fixed-kinematic-input experimental scene can produce
   real Rapier foot START/END and a measurable whole-world ball
   divergence. A no-contact world and a distant-foot sham cannot
   fabricate a collision or change the physical trajectory.
5. All these scenes are deterministic across independent same-input
   runs. Default scalar 1.00 matches the previously verified baseline.

**V1 does not require** scientifically calibrated multi-axis Magnus,
Cd(v), shoe-specific materials, player-specific turf, additional bounce
knobs or new UI options. Advanced flight studies remain disconnected
from gameplay, and neither flight nor contact alone proves ownership.

## Exact existing evidence and gaps (as audited in ME-PB-48)

| Gate | Status before new V1 fixture | Evidence / concrete remaining gap |
| --- | --- | --- |
| A1 common ball, one response | PARTIAL | Global facade 1.00 is research-only; normal gameplay still creates core world without shared V1 control |
| A2 ground roll/stop | VERIFIED | \`core.test.mjs\`, \`physics-diagnostics.test.mjs\` real 60Hz roll, stop and replay |
| A3 simple flight, bounce, boundaries | VERIFIED | \`core.test.mjs\` launch and gravity; \`physics-diagnostics.test.mjs\` multi-bounce, no tunneling |
| A4 22-foot physical collisions | PARTIAL | Authentic opt-in Rapier contact events exist; not authoritative in normal match |
| A5 unified V1 fixture / freeze | PENDING exact-head CI | \`tests/match-physics-v1-baseline.test.mjs\`: fixed 5-test acceptance suite |
| B1–B5 ball control/possession | OPEN | No authoritative free/contested/controlled state, exclusive owner, authenticated transitions |
| C1–C5 general actions | OPEN | Local fixed-ID demo pass/exchange, not any-player pass/shot/dribble/interception/22-player sequence |
| D1–D5 final validation | OPEN | Replays exist but integrated actual gameplay scenario and user-facing QA not accepted |

Existing ME-PB-38/39/41–46 observers are valuable READ-ONLY evidence;
none can be promoted to authoritative possession or football actions.
ME-PB-23/24 local passes/receives are fixed demonstration actors and
must not count as general-purpose player actions. Existing Match
Engine LAB scenarios must be preserved, not made more complex.

## Action order after ME-PB-48

- **B1 next:** implement a minimal, authoritative state transition
  \`free → controlled → released/free\` (and conservative contested state)
  *only* when actual player/shoe Rapier events and measured ball
  stability qualify; no owner from reach alone. Strictly at most one
  owner, invalid or simultaneous contacts fail closed. Keep local
  experimental integration and existing default engine unchanged.
- **B2–B5:** real reception, retention/release and loss under bounce
  or challenge; prove false-ownership negatives.
- **C1–C5:** extract generic pass, shoot, basic dribble and opposition
  decisions from existing fixed-ID demos; require real contact and
  bounded impulses, not fabricated successful action results.
- **D1–D5:** multiple deterministic 22-player plays, a continuous
  pass→receive→move→shot or interception chain, route/CI, benchmark,
  desktop/Safari QA and owner-gated merge/deploy.

## Progress rule

The issue ledger defines **20 independent gates × 5%** each.
Unverified or partial gates count **zero**. While this fixture's
exact-head CI is not yet green, only A2 and A3 are signed (10%).
After the new fixture passes and its acceptance contract is frozen,
A5 may be signed (15%) without implying A1 or A4 are game-ready.
ME-PB-48's step itself has four milestones: inventory, gap
classification, unified fixture+contract, exact-head QA+issue update.

Do not mark the larger physics/player-interaction project "done"
just because the foundation regression passes: the first actual
playable game milestone requires owner-authoritative possession and
generalized physical actions.
