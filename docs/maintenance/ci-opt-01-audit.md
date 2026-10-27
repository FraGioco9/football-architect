# CI-OPT-01 — workflow and test inventory (issue #324)

Recorded against `main` at `e4db9ad954ba9ea93305cd3612bdceaaa8796fed`. This is a measured inventory, not authorization to remove existing gates.

| Workflow | Trigger | Main checks / dependencies | Policy |
| --- | --- | --- | --- |
| `landing-checks.yml` / Site checks | PR open/synchronize/reopen; push main; manual dispatch | Independent exact-head job; Node 22, syntax, 91 Node test files (645 tests in observed FULL); narrow provider-safe selection in old main | FULL for ready-for-review and main; FAST essentials in draft, never remove exact-head |
| `int24-browser-qa.yml` / browser QA | PR open/synchronize/reopen; push main; manual dispatch | Node 22; Playwright Chromium; 245 browser checks / 52 screenshots in observed FULL; 64 CSS parity permutations; network timing and iPhone-emulated WebKit; DEV server port 2000 | FULL on ready-for-review/main; PR-only CSS parity; draft skips expensive browser |
| `render-01-perf.yml` / performance | PR path changes to benchmark/workflow; manual dispatch, job restricted to PR #263 | Fixed historical baseline and Chrome benchmark; no unconditional main run | Legacy project-specific; audit before removal |
| `manual-debug-manifest-hash.yml` | Manual dispatch only | Generate debug manifest hash | Keep manual and protected |
| `manual-public-debug-audit.yml` | Manual dispatch only | Offline public Debug audit | Keep manual and protected |
| `manual-vercel-preview.yml` | Manual dispatch only | Guarded preview workflow | Keep manual; do not dispatch or weaken guard |

## Actual timing baseline (GitHub Actions, 2026-10-27 UTC)

| Scenario | Run | Approx. wall time | Result |
| --- | --- | --- | --- |
| PR #323 Site checks FULL | #40589046819 | 5m14s | PASS, 645/645 |
| PR #323 browser FULL | #40589046815 | 4m39s | PASS |
| Squash main push Site checks FULL | #40592430091 | 5m03s | PASS |
| Squash main push browser FULL | #40592430135 | 3m05s | FAIL after 245 Chromium checks because PR_BASE_SHA unavailable for CSS PR baseline |
| Draft PR #325 Site checks FAST | #40595178589 | See run timestamps; PASS | PASS |
| Draft PR #325 browser deferred | #40595178667 | No browser setup/preview run | PASS |

These durations are observed whole-run times, not per-test CPU time. Concurrent Site and Browser workflows overlap. No before/after speed-up conclusion yet.

## Classification boundaries

Current Draft branch implements a fast essential Node contract set and defers browser checks; the current non-draft/main path remains FULL. `ci-fast-scope.mjs` predates this branch and remains provider-only; a generalized area map (Calendar, Clubs, Competitions, Guide, global CSS, routes and shared modules) is still pending. Unknown paths must fail closed into FULL. Final FULL must be enforced on exact PR HEAD after Ready-for-review (and repeated if HEAD changes), not inferred from earlier Draft success.

## Constraints and diagnostics

- Site checks run exact-head verification separately; main checks compare against `github.sha`.
- Browser tests use loopback DEV preview on port 2000, ephemeral Playwright dependencies and screenshots/log artifacts.
- CSS before/after parity is valid only when the event has a real PR base SHA; on main push it is inapplicable. The other browser checks continue on main.
- Preserve publication gate, anti-deploy, safety, routing and provider contracts.
- Cancel superseded runs only within the same PR; never cancel main runs.
- Keep all manual workflows manual. Do not touch Vercel/DB/deployment.
- Do not add checkboxes to issue #324: update its existing 19 items only.
