# A04-12 — Final provider contract verification (Draft/HOLD)

Issue: #268. Baseline: `main` at `853a6da7b740df00131ecbe79ae9b38d98a6b759`.

## Reused regression evidence

- Exact-main post-merge Site checks: [run #40208198513](https://github.com/FraGioco9/football-architect/actions/runs/40208198513), SUCCESS. Its `head-exact` and `landing` jobs succeeded; the full sequential Node suite reported **540 passed / 540 tests, zero failed**.
- Exact-main post-merge INT-24 Chromium: [run #40208198485](https://github.com/FraGioco9/football-architect/actions/runs/40208198485), SUCCESS.
- Generator verification is included within the full Node suite through `tests/generator-windows.test.mjs` and checked-in output integrity tests; **no separate generator invocation is claimed**. Running the generator against `main` and committing outputs is not part of this evidence-only checkpoint.
- The merged A04-11 scope adds explicit tests for DEV isolation, Calendar event-state authorization and public staging. Browser runtime and public routing regressions run in the same full Node/Chromium workflows.

## Completion gate

This evidence-only PR must itself pass full Site checks, Chromium and exact-head SHA validation. It changes no runtime, generator, public allowlist, database or workflow. Its own final CI IDs, checked commit and mergeability must be recorded on issue #268 before A04-12 is closed. Until explicitly authorized for squash merge and verified on integrated main, A04-12 remains OPEN.

This is not a claim of approved historical source data, native provider envelopes from all producers, or a deployed environment. PR #280 remains separately Draft/HOLD.
