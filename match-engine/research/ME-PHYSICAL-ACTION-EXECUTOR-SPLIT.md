# #480 / #620 — third small extraction: closed physical-action impulse

**Source:** original Draft/HOLD [#481](https://github.com/FraGioco9/football-architect/pull/481), exact preserved HEAD `82bf5d8`.
**Dependency chain:** [#622](https://github.com/FraGioco9/football-architect/pull/622) pure action policy → [#624](https://github.com/FraGioco9/football-architect/pull/624) actual Rapier 22-shoe contact producer → this small Draft/HOLD PR for physical action execution. The legacy 208-file #481 and Action LAB #621 remain untouched.

## What is implemented

- `src/private-physical-action-executor.mjs` owns the **only new action impulse write**. It obtains its START and ACTIVE arrays exclusively from the private `rapier-foot-contact-bridge.mjs` in the same existing closed Rapier world.
- It calls the **unchanged original selector** `selectUniformAutonomousContactAction` and pre-impulse gate auditor `inspectPhysicalActionRejection` already extracted byte-identically in #622.
- With `createEngine(RAPIER, scenario, {diagnosticPlayerFootContactsEnabled:true, diagnosticAutonomousFixtureActionEnabled:true})`, the original 60Hz physics step computes collision evidence, then conditionally applies the original selector's PASS / SHOT / CLEARANCE / CARRY impulse to the **actual single Rapier ball body**, and exposes frozen source-bound action and rejection snapshots. The optional `diagnosticAutonomousCarryEnabled:true` requires the action flag.
- Without those explicit flags: original `createEngine()` does **not** create 22 shoes or an event queue, does **not** instantiate a physical action executor and does **not** expose action methods; all legacy physics experiments, route security and browser LAB must still PASS.
- No new tactic, movement controller, scoring, pass completion, dribble, interception or ball possession authority. Pure contextual PASS/SHOT/CARRY selection is the **pre-existing original #481 policy**. No new shot-distance thresholds or mass/grass friction.
- The physical shooter/recipient suggestion is an **attempt** only; recorded real impulse is never a goal, and a physical contact is not a successful tackle.

## Acceptance and evidence

- [ ] Exact-HEAD HOME/AWAY genuine exclusive Rapier shoe START produces the *original* PASS impulse inside the same ball world, stronger than an otherwise identical contact-only world; deterministic replay, frozen metadata, source-bound gate and current tick.
- [ ] No user-supplied event array / command can trigger an impulse; action disabled until both explicit opt-in flags allow real contacts; malformed/stale player frames rejected.
- [ ] Core/route/Chrome regression checks all PASS.
- [ ] Controlled LAB SHOT and CARRY are physically wired **but not yet demonstrated** in the clean standalone setup: original ordinary-formations at tick 1 do not place an outfielder in a legal shot window or an isolated carry opportunity. **Do not claim natural C2 shot, completed C3 dribble, pass completion or C4 tackle**. The follow-up #621 action LAB retargeting must stage source-authenticated true HOME/AWAY positive witnesses under the clean physics, without reintroducing tactical experiments.
- [ ] Separate authorization required for merging PRs in base order. FULL gate enforces `base.ref == main`: intentionally stacked PRs will be BLOCKED until the underlying foundation lands on main. No artificial FULL PASS claim.

## Later

Stabilize this source/executor link and then refit Action LAB #621 to the extracted real APIs, with explicit controlled geometry for SHOT/CARRY and authentic negative-case gates. Only after fundamental actions are accepted should #480 proceed to individual movement, decisions and team tactics.
