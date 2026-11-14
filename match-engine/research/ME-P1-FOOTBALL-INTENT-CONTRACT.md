# P1 — Observed football intent contract (draft for review)

Issue: [#480](https://github.com/FraGioco9/football-architect/issues/480)  
Draft/HOLD research PR: [#481](https://github.com/FraGioco9/football-architect/pull/481)  
Status: **PURE CONTRACT / PROPOSED qualitative priority only**. Not connected to the live player mover, decision/action policy, or authoritative backend.

## Why a separate contract

Natural shots do not consistently emerge from normal 22-player formations even though same-tick real Rapier shoe START → selected PASS/SHOT → actual ball impulse works in staged scenarios. Repeated centimetre-level chase/foot adjustments optimized one trace rather than football judgment. P1 isolates *what a player would intend* from *what actually happened*. This is not a substitute for genuine physical contact.

## Public draft API

\`chooseObservedFootballIntent(observation) → frozen intent | null\`

The proposed P1 observation shape:

\`\`\`js
{
 physicsTick: 20,
 playerId: 'home-7',
 team: 'home',
 phase: 'ball-opportunity', // or attack-off-ball / defend-off-ball
 frame: {
  tick: 20,
  ball: {x: 0, y: 0, z: 0.11},
  players: [ // exactly 11 HOME + 11 AWAY unique observed players
   {id: 'home-1', team: 'home', x: 0, y: 0}, /* ... */
  ]
 },
 affordances: [
  {kind: 'shoot', available: false, evidenceTick: 20,
   target: {x: 52.5, y: 0}},
  {kind: 'pass', available: true, evidenceTick: 20,
   targetPlayerId: 'home-10'}
 ]
}
\`\`\`

**P1 is not the perception engine.** The \`available\` flag is a *declared, untrusted candidate* and does not prove that the existing physics policy permits the action. This module does not infer availability from arbitrary distance, cannot authenticate external observations, and is **not wired into production or any autonomous fixture**. P2 must produce candidates from validated live player/ball observations; the physical action policy must separately revalidate current real contact, eligibility, shot range, lane and source.

The validator rejects malformed 11v11 frames, unknown actors, wrong-team pass/press targets, stale/future frame evidence, unsupported phase/actions, duplicate candidates, non-finite coordinates and malformed availability. Frame and evidence must be current or at most one tick old. No future-ball trajectory extrapolation or declared physical shoe START is permitted.

An eligible choice returns a frozen intent with:
\`\`\`js
{
 version: 'me-p1-observed-intent-draft-v1',
 physicsTick: 20, observedFrameTick: 20, evidenceTick: 20,
 playerId: 'home-7', team: 'home',
 phase: 'ball-opportunity', intent: 'pass',
 targetPlayerId: 'home-10', target: {x: /* teammate live x */, y: /* live y */},
 fromDeclaredObservedAffordance: true,
 realShoeContactObserved: false,
 physicalActionExecuted: false, officialMatchAction: false,
 guaranteedFootballOutcome: false
}
\`\`\`
\`null\` means **no declared eligible action**; it does not authorize a kick, forced forward run, move, possession or score.

## Qualitative priorities — proposals needing review before P2

| Context | Candidate order | No eligible candidate |
| --- | --- | --- |
| Ball opportunity | SHOOT → PASS → ADVANCE → RETAIN → REPOSITION | \`null\` |
| Attacking off ball | SUPPORT → REPOSITION | \`null\` |
| Defending off ball | PRESS → COVER → RECOVER | \`null\` |

**RETAIN** is a targetless intention to avoid unjustified physical action when movement/pass/shot is unavailable. It does not establish possession, stop the canonical mover or freeze the ball. Its output target is `null` and its affordance is untrusted.

These are **ordered discrete alternatives**, not numerical utility/scoring, personality, suitability, player attributes, role tactics, or pressure coefficients. Ineligible candidates never win. Equal kinds use stable target ID (or coordinate) order, not input-array order. Do not extrapolate that an intent is always the correct decision in real football; tie-break/order and role selection remain design review items.

## P1 QA matrix (pure, no Rapier dependency)

- Shot declared eligible vs blocked; blocked shot falls back to actual same-team pass candidate.
- Shot/pass unavailable falls to observed advance; RETAIN (without a target) is possible when explicitly declared, otherwise reposition or null.
- Off-ball teammate support or reposition; opponent press, cover or recover.
- Both HOME and AWAY symmetry; target coordinates must be derived from observed player frame for player-targeted intents.
- Reordering candidates changes nothing; input is not mutated; output is frozen and has no physical/official authority.
- Invalid/future/stale evidence, forged target teams, duplicate candidates, invalid coordinates and unsupported action phase must be rejected.
- Negative/no-contact input must not manufacture shoe START, shot impulse or guaranteed outcome.

Run **only** the pure P1 suite during contract review:
\`node --test match-engine/tests/player-football-intent.test.mjs\`

The same suite is registered in \`match-engine/package.json\` for the final full engine test pass. On Draft PR #481, the existing ME-01 targeted workflow may run this pure suite alongside the already registered genuine C2-b Rapier witness; do not launch a separate duplicate CI workflow.

## Integration gate (NOT approved by this contract)

1. Review the qualitative priority and missing-football-choice cases; explicitly agree before enabling live behavior. No numeric thresholds have been proposed.
2. Define observation adapter from **the current canonical 22-player frame** and current/prior real Rapier ball and authenticated contact evidence. Verify source/frame identity and prevent arbitrary caller-supplied availability from becoming action authorization.
3. Keep the existing same-tick **one genuine exclusive Rapier shoe START+ACTIVE → policy-selected football action → impulse on the same physical ball**. P1 must never directly command impulses or claim official action/goal.
4. Maintain canonical 60 Hz movement, turning, 0.98 m separation, genuine ball physics; zero new remote DB or production/gameplay authority.
5. Use small table-driven isolated tests, then multiple physical HOME/AWAY situations and independent replay, **not** just the existing AWAY tick 693 geometry.
6. Retain Draft/HOLD; do not merge/deploy or advance top-level #480 gates on P1 test success.

### Questions to review before P2

- Should an available pass ever outrank an available shot based on pressure, receiver quality or shot quality? (No weights yet.)
- Should a carrier choose ball-retention/hold as an explicit alternative, rather than defaulting to reposition or \`null\`?
- Should defense prioritize PRESS vs COVER based on role/distance or passing-lane threat?
- What verified observation fields are sufficient for the eligibility adapter, without duplicating the canonical same-tick action policy?

**Current progress: 11/20 (55%). C2 genuine ordinary-formation natural shot remains OPEN.**

## P1 follow-up — targetless RETAIN (pure, draft only)

The bounded pure selector now accepts an available RETAIN with no target, rejects fabricated motion/player targets, and records no physical action, possession, or guaranteed outcome. Fixed SHOOT-over-PASS and PRESS-over-COVER orderings remain unapproved proposals, not live gameplay logic. No P2 adapter, movement wiring, physical contact or engine tuning is included in this change. P1 approval gate stays open until the full qualitative policy is reviewed.

## P2 preflight: read-only current-frame projection (Draft/HOLD)

`src/player-football-observation.mjs` exports `projectObservedFootballContext(physicalFrame, {playerId, phase})`. It maps **existing** `physicalFrame.ball.position` and ordered `physicalFrame.physicalPlayerPositions` into the P1 observation shape. It requires matching `physicsTick`, `footContact.tick`, `autonomousMovement.physicsTick`, canonical actor IDs/teams/roles, finite coordinates and the existing fixture-frame metadata. Output is deeply frozen, copied and starts with **zero affordances**. Pure tests include HOME/AWAY, deterministic projection, null selection and rejection of inconsistent timestamps, changed roles/teams, non-finite geometry and unsealed positions.

**Security boundary:** This is only a *structural preflight*. A caller can forge an object of the same shape; this module cannot independently prove Rapier contact/source authenticity. The future P2 runtime wiring must invoke it with the **internally created** fixture frame, never arbitrary API/user-supplied input, and must separately source/validate any candidate affordances before permitting a decision. The existing same-tick Rapier START + physical policy remains authoritative. This file introduces **no** live adapter invocation, available:true candidates, action execution, player movement, physics, possession or score.

The P1 qualitative-priority approval gate remains OPEN. P2's live-decision checklist remains OPEN. No top-level #480 gate is completed by this structural test.

## P2 read-only passing corridor geometry (Draft/HOLD, no eligibility)

`src/player-football-corridors.mjs` measures the **straight XY segment from the currently observed ball location to each of the ten same-team players other than the actor**. The output lists each receiver's direction length and the *nearest observed opposing body* and *nearest other teammate*, including center-distance to the segment and fractional projected position. Results are source-frame bounded, frozen, HOME/AWAY symmetric, input-order stable, and preserve zero-length cases. No new scoring weights, pressure coefficients, pass-clearance thresholds or tactics were introduced.

These distances are **descriptive snapshots, not a true pass trajectory or a verdict that a passing lane is clear**: the actual ball may be airborne, moving, contested or physically unreachable by the actor, and defenders can move during the flight. The observer deliberately accepts only zero-affordance P1 contexts and reports `passEligible: null`, `physicalContactProven: false`, `passExecuted: false`, and zero authorized affordances. It cannot issue `available:true` or execute a PASS. The existing Rapier shoe/contact/action policy remains the only physical action authority. Structurally valid context is not authentication of a genuine frame; runtime integration is still unapproved.

New pure tests are included in the already registered P1 suite for symmetry, nearest teammates/opponents, reordered players, degenerate segments, and invalid/future/candidate-bearing contexts. No runtime integration or motion changes; the #480 P1 approval gate and C2 natural SHOT both remain OPEN.

## P2 consecutive physical corridor changes — read-only two-tick evidence

`measureObservedPassingCorridorChanges(previous, current)` compares two *consecutive, exact-tick* P1 ball-opportunity observations for the same player and team. It validates 22 observed actor IDs/team continuity; each input must independently pass the zero-affordance corridor validator. Outputs observed ball and receiver displacement, segment-length delta, and changes to the nearest opponent/teammate's identity and centreline distance for each of 10 receivers. It never predicts the future, does not prescribe pressure thresholds, and cannot grant a pass or any other physical action.

**Important:** nearest-body centreline distances may change because **either endpoint or the defender moved**; a negative delta does not prove a blocked lane, an interception, or actual pass unavailability. The source/physics authenticity requirement is unchanged: these pure shape checks are not attestation, and the future adapter must use privately obtained canonical frames only. Pure HOME/AWAY positive and invalid-tick/identity/candidate negative tests are registered in the existing P1 suite. No physical fixture integration, tuning, live decision selection or change in #480 approval gates.
