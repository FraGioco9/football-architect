# P0 — final 22-player scenario matrix execution

**Scope:** One intentional Tier C run on Draft/HOLD PR #481 for [issue #480](https://github.com/FraGioco9/football-architect/issues/480). This file is a **one-time push trigger**, not acceptance or proof of a passing job. A new commit touching this file is required for any future Tier C rerun. The existing Draft ME-01 Tier A/B workflow is unchanged and remains the fast/default path.

## Exact on-branch workflow

[Dedicated P0 matrix workflow](../../.github/workflows/match-engine-p0-final-matrix.yml) starts only for pushes to `feat/me-pb-01-player-ball-reach` that modify this trigger document or the workflow YAML. It asserts `git rev-parse HEAD == github.sha`, uses Node 22 and the pinned Rapier lockfile, then runs **once**:

```powershell
npm ci --prefix match-engine --no-audit --no-fund
npm --prefix match-engine test
```

The package's explicit `test` script enumerates its broad, existing match-engine suites. No new match fixtures, deterministic shoe STARTs, fabricated pass/shots, scoring rules or ball impulses are added. Both positive and negative evidence are required. A saved text log is retained as a short-lived GitHub Actions artifact.

## Evidence coverage (existing tests, not new scripted outcomes)

| Matrix requirement | Existing source tests | Required observation |
| --- | --- | --- |
| HOME/AWAY ordinary real 22-player physical progression | `player-ball-natural-physical-progression.test.mjs`, `player-ball-press-handoff-ab.test.mjs` | Actual 60Hz shoe START/ACTIVE and ball displacement, negative natural SHOT stays negative unless genuine evidence changes |
| Baseline versus opt-in carry/support/press A/B | `player-ball-carry-support-ab.test.mjs`, `player-ball-press-handoff-ab.test.mjs`, `player-ball-carry-live-access-ab.test.mjs` | True physics on both teams, independence, deterministic replay, no behavior forced ON |
| Same-tick physical fixture and reset | `physical-fixture-step-runtime.test.mjs`, `player-ball-universal-world.test.mjs` | 22 canonical actors, genuine Rapier contacts, independent fixtures and reset/replay |
| Real PASS attempt and opposed follow-through | `physical-fixture-step-runtime.test.mjs`, `player-ball-uniform-autonomous-action.test.mjs`, `player-ball-press-handoff-ab.test.mjs` | Source-bound exclusive START, actual applied impulse; no invented reception or possession |
| Missing/ambiguous/forged contact and rejected no-action gates | `player-football-intent.test.mjs`, `player-ball-uniform-autonomous-action.test.mjs`, `physical-fixture-step-runtime.test.mjs` | Fail closed and preserve authentic/ambiguous evidence; no fake actions |
| Shot window/lane/access and negative results | `player-ball-shot-access-diagnostics.test.mjs`, `player-ball-shot-boundary-observer.test.mjs`, `player-ball-natural-physical-progression.test.mjs` | No synthetic goal/SHOT, unchanged 35m original gate, no physical rule relaxation |

**Important:** This is a broad catalog run, not a guarantee of successful natural ordinary-formation shooting or a substitute for behavioral P1 approval. Pure shot-lane tests do not themselves prove authentic shot execution.

## P0 acceptance checklist (DO NOT pre-check)

- [ ] Exact new push HEAD and completed GitHub Actions Tier C run URL recorded.
- [ ] All enumerated scenario suites passed, with reproducible test count and no unresolved failure; archive the job evidence and explicitly note any skipped tests.
- [ ] CI-OPT-03 FULL evidence on that same exact HEAD is SUCCESS.
- [ ] Ordinary HOME/AWAY no-shot negatives remain unmodified unless a genuine physical witness proves otherwise.
- [ ] Update issue #480 P0 third checkbox only when all above evidence is available. Keep PR #481 Draft/HOLD with no merge/deploy/remote DB edits.

This run **does not** approve P1 tactical priorities, wire P2 live decision authorization, or close C2 natural SHOT.
