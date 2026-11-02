# CI-OPT-03 — Audit A01 and selector A02

Reference: issue #341, building on #324 / #331; base main `9c73dd049e708054b344325ccc573422d73ee586`.

## Audit observations (2026-11-02)
- Seven existing workflows: Site checks, Browser QA, Admin World foundation, Landing checks, three manual Debug/Vercel workflows and legacy render performance (see `.github/workflows`; eight files in total).
- Site checks and Browser QA already call `tools/ci-opt-01-impact.mjs` on Draft PRs; ready-for-review and main run FULL. Their concurrency was designed for obsolete PR runs.
- Existing impact mapping handles calendar, clubs, competitions, admin, guide. It does not safely cover the new Debug, Auth and backend surface.
- Admin World uses path-triggered PR jobs and local-only Worker/D1; it has independent Draft versus final modes.
- Existing fail-closed selectors `tools/ci-fast-scope.mjs` and `tools/ci-opt-01-impact.mjs` remain unchanged.
- Ruleset `FA-MAIN-PROTECTION` is active on main, allows squash-only PR, strict status check `landing` (integration 15368), but **does not enforce a dedicated FULL gate**. Branch protection read endpoint returns 403 to this GitHub App. No claim of merge protection beyond this observed ruleset.
- #340 recorded 806 PASS / 62 FAIL; no result reinterpreted as green.

## A02 contract
`tools/ci-select-tests.mjs` uses the trusted base and expected HEAD with an actual git merge-base, checks exact checkout, returns machine-readable mode/area/tests/reason and logs source paths. Invalid SHA, diff or unknown paths select FULL, never PASS. Existing proven area mapping is reused for TARGETED; uncertain Debug/Auth/backend, shared runtime, generation, CSS and workflow paths choose FULL rather than unsafe under-selection.

## Rollout / pending
Keep existing workflows and required `landing` unchanged until the new selection and final gate are demonstrated. A03–A07 remain open; current FULL is not yet a verified required merge check. No deployment, DB remote, or publication guard modifications.
