#628 Phase M15 — moving-ball search for authentic concurrent player contacts

## Research boundary

The M14 certified stationary-ball search saw **at most one active native player/body pair**. This M15 step varies **only the ball's before-tick-zero rolling velocity** under the original 12 M11 initial ball territories. Real Rapier governs the moving ball on the same existing World and shared native shoe/body collision event queue. The original 22 `INITIAL_PLAYERS` and 0.49 m native body collider radius remain unchanged. No players or ball are teleported mid-run and no collisions, presser identities, or contact records are staged. For any moving trial the initial rolling fraction is 1 (a real rolling ball); starting speed is capped at 8 m/s.

Four bounded before-tick-zero rolling trajectories are tested, mirrored in world X for AWAY: `forward-roll` (+4,0), `reverse-roll` (-4,0), `diagonal-roll` (+3.6,+2.4), and `crossfield-roll` (0,+4.8), in m/s. Every trial repeats the **same precise initial ball state, the same 22 players, same press-convergence option and same event source** as paired `feedback` and `observe` modes. Later event counts are not assumed identical: authentic physical corrections can change the ensuing path in feedback mode. The negative observes genuine collisions but cannot write player corrections.

## Independent native-pair lifecycle audit

M15 augments the existing M14 source-only audit: replay each tick's exact Rapier body START/END transitions into an independent active-pair ledger and compare that ledger with `native.activePairs` and the cumulative START-minus-END count. Duplicate START, unmatched END, fabricated non-original IDs and source drift abort the audit. Capture the **first true >=2 simultaneously active native pairs with actual pair IDs and tick**, total such ticks and the peak; never treat two historical distinct pairs, a close approach, overlapping shoe events, or two negative fake-pair test inputs as concurrent real contacts.

The existing M13 all-22 atomic native-response gate still enforces >=0.98 m global player separation, <=7 m/s canonical speed/step, 105×68 m pitch, real autonomous press/support/formation, exact acknowledgement, and zero official football action/result authority. No action selection, tactics, 11v11 match conclusion, tackle or possession authority is introduced.

## Reproduce

`cd match-engine && npm test` runs bounded focused M15 QA: **4 independent ball territories × 2 rolling trajectories × 2 sides × feedback/observe = 32 original Rapier sessions**, 225 ticks each, plus deterministic source replay and invalid-input negatives. The focused test emits `ME_628_M15_NATURAL_MOVING_BALL_MATRIX` with observed event totals and the **actual** peak simultaneous body pairs. It does **not** assert that a multi-pair contact must exist; physical evidence is mandatory and an absent positive is an explicit unpassed research gate.

`cd match-engine && npm run audit:moving-ball-multipair` invokes the extended **12 territories × 4 rolling trajectories × 2 sides × feedback/observe = 192 original Rapier sessions**. That longer CLI is intentionally not claimed executed by targeted CI. A positive M15 acceptance requires an actual verified peak >=2 and native START/END provenance for both pairs, plus source-bound pressure/support cohabitation. If not measured, leave Phase M's multi-contact gate **OPEN**. PR #633 remains Draft/HOLD. No merge, deploy, D1 mutations, or Phase I/T/F acceptance.
