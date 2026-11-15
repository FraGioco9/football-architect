# Action LABs V1 — Clean action-first baseline

Issue [#620](https://github.com/FraGioco9/football-architect/issues/620) supersedes the order of the old [#480](https://github.com/FraGioco9/football-architect/issues/480) behavior-first roadmap. **Code cleanup → source-bound fundamental actions → movement/decisions → tactics**. Keep Draft/HOLD and no official match writes.

## Verified state and action-specific controlled LAB

| Controlled LAB | Actual source and setup | Proven event / boundary |
| --- | --- | --- |
| LAB-14 · Pass | Original 22-player uniform physical selector, normal HOME shoe-ball contact | Sole real shoe START + applied Rapier `pass` impulse, no assumed reception/completed pass |
| LAB-15 · Shot | Explicitly staged 22-player attacking-third research positioning, original shot range and open lane | Genuine Rapier `shot` on both teams proven in `player-ball-real-shot-witness.test.mjs`; **not** ordinary-formation C2, goal, or score |
| LAB-16 · Physical challenge | Existing local opponent-lane / exchange diagnostic | Opposing real shoe START can be observed; neither tackle nor interception is confirmed |
| LAB-17 · Control | Existing local pass-and-receive diagnostic | Second independent receiving shoe START/trap, provisional physical local control; **no** official possession |
| LAB-18 · Carry | Existing opt-in autonomous physical short carry | Shoe-origin bounded `carry` impulse, continuing real 60Hz physics; **no** formally approved dribble outcome |

Action catalog: `src/action-lab-scenarios.mjs`. Single controller: `src/action-labs.mjs`. These are isolated from `src/lab.mjs` (historical physics/trajectory LAB), and use its existing Rapier and pitch-marking modules. A single dialog and one Play/Pause/Step/Reset control set manages **one** Rapier world per action. Opening it closes the previous physics world; closing restores the former LAB in its reset state. Render only compact, relevant actors from the actual 22-player physical mover, not a panel where users manually control 11 players. These scenes use fixed test seeds and do not create special unofficial player attributes, scoring or possession.

## Cleanup rules

- Keep original physics LAB-01/02/04/05, their current selectors and diagnostics intact. Do not remove old source/test research prematurely; catalog it and migrate only with equivalence QA.
- No new physics rule, ball radius, shot-distance gate, contact source, proximity-derived shoe START, body-position manipulation or outcome postprocessing.
- **Observed action** means a matching same-tick real shoe contact, authoritative internal action and actual impulse. `classifyActionLabEvidence` refuses action objects without the real-sourced internal selector's applied flag and exact exclusive START. A 'physical challenge' is not a successful steal without independent football outcome semantics.
- Controlled LAB status should say *waiting* if no positive evidence appears. It must never promise a goal, possession, pass completion, tackle or dribble.
- Existing dev-only route allowlists explicitly include new action modules; do not expose them via public game APIs.

## Scenarios after action acceptance

**Movements to implement/QA later:** start/stop, acceleration and deceleration, turn and facing update, run to ball, walk/jog/sprint, reposition, support run, create passing angle, move away from teammate's lane, follow pass, press, contain, cover, mark, intercept run, recovery run, loose-ball contest, tackle approach, shielding and goalkeeper positioning. The canonical 60Hz mover and 0.98 m separation remain the sole physical movement authority.

**Decision alternatives to design later:** SHOOT if legal real opening, PASS to source-supported teammate, clear under pressure, CARRY/advance, control/retain/reposition, offer support, hold position, screen, press vs contain vs cover, track opponent, mark receiver, attempt physical interception, challenge tackle when legally/physically eligible, recover loose ball, communicate/hand off defender responsibility. These are **candidate intentions** and must not directly grant possession, shoe contact or a new ball impulse.

## Acceptance

- [ ] Exact SHA focused pure catalog and real Rapier action tests green
- [ ] Manual Chrome desktop / iPhone Safari DEV LAB action dialog QA
- [ ] Confirm PASS, staged SHOT, controlled reception and short CARRY positively witnessed; challenge has real opposing shoe evidence but **no** tackle verdict
- [ ] Regression check existing physics LAB remains unchanged; negative/ambiguous contacts cannot be labeled as successful outcomes
- [ ] Separate code-review and **explicit merge** authorization

No natural C2 or C3/C4 acceptance is implied. Existing #480 11/20 (55%) is still the historical accepted physics-gate count.
