# Match Physics V1 — C3.4a genuine carry continuity versus interruptions

Research-only evidence for issue #480 / Draft PR #481.

## Scope

These deterministic 22-player, real 60Hz Rapier tests independently replay actual canonical home and away player movement and every shoe START/ACTIVE/END. They consume only the sealed physical fixture runtime; no physical state, roster, foot collider, dribble rule, match result, ball impulse, or player position is injected.

- **Clean two-contact window:** one player's real shoe START, actual subsequent END and a second true exclusive Rapier START by that same actor, second bounded 0.42 N·s carry impulse, real goalward ball progress at least 0.20 m, real player travel, measured per-tick actor-ball separation, and no intervening opponent or teammate shoe. Independent HOME and AWAY replay must match contact sequence and proximity window exactly.
- **Interrupted physical carry:** AWAY carrier `away-10` real first shoe START at tick 190; `home-10` genuine opposing Rapier START+ACTIVE at tick 261 interrupts its live carry proximity window. Independent second world must show the exact same cause, IDs, timing and counters, and **not** fabricate a same-player clean two-contact window for that interruption.
- **No-contact control:** a free ball dropped away from players cannot generate a measured carry or an interrupted carry window.

## Interpretation and remaining gate

These tests preserve the existing observer's `dribbleConfirmed:null` and `officialMatchPossession:false` invariants. The observed two-contact chain proves only a real, uninterrupted *physical* sequence, **not** gameplay dribble adjudication. Proximity, positive ball displacement, a second shoe and even an opposing shoe are individually insufficient to grant a football result.

C3.4a is a physical acceptance/negative replay substep, not completion of the top-level C3 dribbling gate. Future C3.4b needs separately agreed gameplay criteria (including thresholds and continuity rules), an independently replayed positive event, contested and ambiguous counterfactuals, and no fake possession/tackle/score.

Keep PR #481 Draft/HOLD; no deployment, merge, or remote D1 operations.
