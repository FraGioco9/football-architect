# ME-P0 test tiers and acceptance boundary

Research checkpoint, 2026-11-15. **No gameplay, physics, tactical-priority, or CI-workflow change.** PR #481 stays Draft/HOLD. The third P0 checkbox remains open until the final matrix is demonstrably run and accepted on the exact final HEAD.

## Tier A — fast pure decisions (no Rapier world)

Run from repository root:

```sh
node --test match-engine/tests/player-football-intent.test.mjs
```

This validates the existing intent and physical-input rejection contracts, malformed/stale context, precedence of the original gates, no fake Rapier authentication, and no executable PASS/SHOT from diagnostics. It **does not** prove contact, possession, or match outcome. Current exact-head ME-01 workflow runs this as a distinct command.

## Tier B — small authentic physical integration (real Rapier)

```sh
node --test match-engine/tests/player-ball-press-handoff-ab.test.mjs
```

This is the existing, bounded genuine 22-player HOME/AWAY 720-tick A/B fixture, not a synthetic kick. It checks same-tick physical START/ACTIVE, source-bound pre-impulse rejection classification, independent replay determinism, and negative natural-shot results. The current ME-01 Draft #481 workflow runs it **once**, separately from Tier A. Do not add new worlds or replay it inside the same CI job. Frozen observations: HOME 715 no-exclusive START + 1 cooldown + 4 selected actions; AWAY 704 + 2 + 14; zero natural SHOT in both baseline and opt-in. These are research negatives, not tactical permission.

## Tier C — final complete 22-player scenario matrix (NOT YET ACCEPTED)

The existing `npm --prefix match-engine test` command lists the broader match-engine tests. The current `.github/workflows/match-engine-01.yml` intentionally **skips** that command for Draft PR #481; it runs the two focused commands above instead. Thus a green targeted ME-01 run **cannot** be described as a completed final scenario matrix.

Before checking P0's third subtask, define and run the full final matrix on the **same exact PR HEAD**: genuine HOME/AWAY ordinary formations, baseline and explicitly enabled experimental carry A/B, independent deterministic repeats, multiple exclusive/ambiguous/no-contact cases, source-bound action vs no-action classification, real-ball progression, pass/shot eligibility, and negative evidence where no natural shot occurs. Include full 22-player physics coverage, both teams and adverse contact cases, without faked contact/shot or relaxed physical guards. Prefer existing test fixtures, and make any new coverage proportional to a documented gap.

**Acceptance evidence:** record the exact HEAD SHA, exact test commands, cases/expected outcomes, pass/fail totals and links to the actual GitHub Actions jobs. Only after the matrix passes and the required FULL evidence gate is green on that same HEAD may the third P0 subtask be checked. A green `CI-OPT-03 FULL evidence gate` is a CI coverage signal, **not automatically proof** that this football-specific scenario matrix has been executed.

## Workflow/CI evidence inspected

At HEAD `33bc7be09b41804bab9ce4a91551464b06edb178`, [ME-01 #43652286200](https://github.com/FraGioco9/football-architect/actions/runs/43652286200) and [FULL #43652286212](https://github.com/FraGioco9/football-architect/actions/runs/43652286212) completed SUCCESS. The ME-01 job shows the focused combined step PASS while the full `npm test` step was SKIPPED by design. Do not duplicate this work or equate these signals.

## Guardrails

Keep `autonomousCarryBlockedDetour` default OFF, P1 qualitative priorities unapproved, C2 natural ordinary SHOT unproven. No merge, deploy, remote DB changes, new selector, contact fabrication, or gameplay tuning in this checkpoint.
