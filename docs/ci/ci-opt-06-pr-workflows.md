# CI-OPT-06 — PR CI launch and Admin-scope closeout

## Measured baseline (20–21 November 2026)

Historical GitHub Actions observations, not controlled before/after benchmarks.
Draft PR #732 source HEADs (workflow execution window, seconds, including pending FULL evidence observation):

| HEAD | Workflows launched | Slowest completion (s) |
| --- | ---: | ---: |
| `60abbd0b` | 8 | 462 |
| `999af2a8` | 8 | 494 |
| `003fd68a` | 8 | 441 |
| `ebd903d8` | 8 | 463 |

The 8 workflows include Site, Browser, Admin, FULL observer, first-name catalog,
surname catalog, Match Engine targeted and a skipped Preview package. These four
heads all edited `tools/ci-test-ownership.json`, triggering both catalog workflows.
The baseline is **not** evidence of any speedup yet. A new CI workflow change
will necessarily trigger FULL during the implementation PR.

## Focused implementation

1. Removed the shared test-ownership manifest from the *dedicated* first-name and
   surname catalog workflow path triggers. Ownership/discovery enforcement remains
   in all primary Site, Browser, and Admin source jobs. Both catalog workflows
   still trigger on their own catalog, test, or workflow edits. No catalog test removed.
2. Fixed the surname catalog workflow: a PR changing only the surname regression
   test now runs that test, rather than reporting a skipped catalog validation.
   The catalog-only scope guard and first-name isolation rule remain enforced
   when the surname data itself changes.
3. Added a conservative Admin-only Draft scope router, built from the **existing**
   reviewed single-area Site selector. Pure public calendar, clubs, competition,
   guide or documentation updates can run Admin FAST contracts rather than
   installing Worker/browser engines and repeating all account QA. Draft Admin
   changes stay TARGETED; unknown, shared CSS/JS, backend, auth, cross-area, CI,
   unsafe or malformed changes stay FULL. This does **not** change Site/Browser
   selection, final-verification opt-in, or protected merge checks.

## Expected versus observed outcome

- For ownership-registry-only updates: *expected* dedicated catalog workflow
  launches **2 → 0**, while source ownership checks and FULL Node suite remain.
- For reviewed single-area public-page Draft changes: *expected* Admin mode
  **TARGETED → FAST**, retaining its syntax and CI safety-contract checks;
  Account Chromium/WebKit and Worker/D1 complete FULL remain mandatory at final
  ready-for-review or explicit final verification.
- The overall time-to-green improvement and runner-minute savings are **not yet
  measured** on comparable post-merge feature PRs. Do not claim the ≥25% target
  as achieved merely because the CI-OPT-06 implementation PR passes.

## Mandatory verification

Run selector contract tests and CI-discovery, plus all automatically triggered
FULL source checks on the single final exact PR HEAD. Verify the FULL evidence
gate is PASS, and no `skipped`, `pending`, `cancelled` or reused partial job
is counted as new exact-head FULL proof. Repeat measured Draft scenarios only
when natural qualifying PRs occur; avoid wasting repeated FULL runs just to
collect performance numbers.

No change to branch rules, production deploy, remote D1, security assertions,
all five supported locales, or Chromium + WebKit FULL regression coverage.
Keep CI-OPT-06 PR Draft/HOLD. No merge without separate owner authorization.

## Owner refinement — remove unnecessary workflow entries entirely

The two dedicated **first-name** and **surname** pull-request workflows are removed:
`tests/players-names-catalog.test.mjs` and `tests/surnames-01-catalog.test.mjs`
remain in the Site FULL Node discovery runner, exactly once each. The surname
source-only validation (including PLAYERS-03 isolation) now runs in the Site
job before expensive suites when surname catalog data changes. This preserves
relevant assertions without starting another pair of GitHub Actions runs.

The Match Engine workflow stays available **only** on `match-engine/**` or edits
to its own workflow; shared `tools/dev-standings-preview.mjs` changes no longer
start it. The Site/Browser workflows continue to test preview routing. The
Match Engine workflow retains its physics, real Chrome viewport and benchmark
checks for engine changes and now checks out the exact source PR HEAD.

For the representative #732 historical changes touching `tools/ci-test-ownership.json`
and `tools/dev-standings-preview.mjs` without `match-engine/**`, expected
workflow launches go from eight to **five**, including the already-skipped
Cloudflare Preview package workflow; this is a trigger-count projection, not
a newly measured CI time saving. Required Site, Browser, Admin and exact-head
FULL gate remain in place.
