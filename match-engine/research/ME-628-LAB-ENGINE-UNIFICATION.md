# ME-01 — visible LAB engine unification scope

Owner scope clarification: 2026-11-28. This is an architectural milestone, not a tuning or match realism milestone.

## Visible configuration inventory
- Carry Control / Moderate / Sprint: carry-solo, locked phase and existing research rating input; common carry phase and movement proposal.
- Ground pass / cross: pass-pair / cross-pair; one delivery and physical reception.
- Lofted short / long / switch; chest / aerial foot: existing common aerial surfaces and delivery sequence permissions.
- Shot profiles (power, low, placed, chip, curled, tap-in), each with first-time variant: shot-solo, existing shot profile and launch/contact constraints. Menu choices are preserved as found; profile redesign is outside this milestone.
- Header / volley: shared native aerial surface and delivery permission.
- Keeper 1v1 / high cross / high intercept: common paired action ranking and existing keeper glove controller; single-shot exercise constraint.
- Autonomous dribble / standing / sliding / shoulder / aerial duel / interception / block: explicit capability masks, same native world and actor contact authority; remaining dedicated movement/sequence adapters must be assessed as configuration rather than tuning.
- Collective 1v1+keeper / 2v1 / 2v2 / 3v3: unrestricted native open play. Full field is a private fixture, not a visible LAB.
- Archive movement, physics and historical comparator paths are not current visible fundamental exercises.

## Candidate reconciliation
Keep source contract repairs 9742d4e and shared carry phase/pursuit 9e04cf1 / 8bcc909. Keep paired keeper action routing (without changed shot-lane preference). The new mask restricts the autonomous dribbling duel while retaining common collective policy. Defer low-delivery geometry c446c74, Sprint withdrawal c0936e5, action ranking adjustment 8ebf416, best-shot-lane preference in 05d1585 and opposed-carry/offensive tuning 8075bdd; prior commits remain inspectable, with no branch rewrite or changes to published PR. Their behavioral acceptance is for later visual QA. Original acceptance tests from published head remain; no physical thresholds relaxed.

## Remaining structural gates
- Check visible action/sequence and movement adapters (in particular isolated pass, shot, cross, directed defense and keeper approach) for duplicated policy rather than legitimate exercise constraints.
- Validate exact candidate through grouped CI; physical failure witnesses remain open and must be reported, not hidden.
- Owner visual QA per LAB; only then behavioral tuning.

## Final bounded source audit
- Entry: modern menu in lab.mjs resolves createControlledActionLab; all current action exercises use createEngine and createPlayerMovement. Full-field session uses the same two factories.
- Contact: core.mjs selects usesNativePairedShoeBridge for every selected participant when historical carry is false. Current visible options set historicalCarryPhysics and historicalEvidenceBaseline false; no separate historical material path is selected.
- Capability: core creates nativeLabFundamentalMask once, passes it to the action executor, body/aerial guard, keeper and control observer, and the LAB passes the same mask to movement and referee. Snapshot exposes action and movement masks.
- Isolated pass/cross/shot: executor translates the exercise into createNativeActionRestriction (actor, recipient, delivery type, one original action). Shared selector and shared physical applyImpulse path remain; sharedDynamics uses the current common pass, cross, shot and reception calculations. The fixed receiver/starting approach and first-time hold are exercise setup constraints.
- Directed defense: profile mask plus prior witnessed state constrains standing/sliding/shoulder, interception and block. Shared native defensive touch/physical intervention helpers, movement/kinematics and Rapier gates; dedicated recovery/sequence adapters remain. No claim that all tactical movement targets are identical.
- Keeper: current paired attacker uses shared ranking, common shot/carry and native glove controller; one-shot suppression and initial approach remain exercise constraints. Historical unpaired adapter retained for archival comparisons. No changes to scoring preference.
- Fixed Carry: phase, rating and existing Sprint research settings remain explicit inputs. Current phase and open-carry motion use the shared proposal; no independent current physics world or impulse authority.
- There are 25 distinct scenario/defensive-profile permission configurations and 38 visible menu entries when three Carry paces and six shot profiles plus their first-time forms are counted separately. Added runtime construction and one-tick smoke coverage of every menu entry on both sides (76 sessions), checking paired collider count, matching masks, current materials and consecutive native tick. Existing tests remain intact.
- Static structural audit complete within this scope. Dedicated movement and sequence adapters are explicitly retained, not claimed removed. Runtime and visual acceptance are separate; no additional tuning required before grouped CI.
