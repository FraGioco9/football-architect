# CI and QA — current operating guide

**Living source baseline:** `main@f9b595636d02d4a1ebfdbd967e1a97c18f2dd41d` (2026-11-06). Actual workflow authority: `.github/workflows/landing-checks.yml`, `int24-browser-qa.yml`, `admin-world-checks.yml`, `ci-opt-03-full-gate.yml`, plus `tools/ci-opt-01-impact.mjs`, `tools/ci-discovery.mjs` and `tools/ci-test-ownership.json`.

## Modes and gates

| Mode | Typical selection | Evidence limits |
| --- | --- | --- |
| FAST | Draft PR only touching `docs/`, `README.md` or other allowlisted docs | Essential contracts, **not FULL browser** |
| TARGETED | One reviewed Calendar/Clubs/Competitions/Guide/Admin area | Bounded tests relevant to that area |
| FULL | Ready-for-review, main, unknown/shared/CI/CSS/routing/DB/security changes | Site, Browser, Admin and exact-head FULL evidence gate |

**Important:** `backend/docs-*.md` is **not** covered by the `docs/` FAST classifier prefix and can trigger FULL. Never change selector or publication rules to avoid it. An older green HEAD, PENDING, skipped or cancelled run is not proof of current FULL acceptance. Ready-for-review may start another automatic cycle; do not manually dispatch duplicate suites.

## Windows 11 PowerShell targeted reproduction

Node.js 22; commands run at the repository root:

```powershell
node tools/ci-discovery.mjs
node tools/generate-app-pages.mjs --check
node --test tests/ci-opt-01-impact.test.mjs
node --test --test-concurrency=1 (Get-ChildItem .\tests\*.test.mjs | Select-Object -ExpandProperty FullName)
```

The full Node suite is optional for a documentation-only edit. First verify relative Markdown links/anchors, referenced file paths and real npm scripts, route names, `git diff --check` and zero generated changes. For backend-specific changes: `npm --prefix backend ci`, then `npm --prefix backend run typecheck` and `npm --prefix backend run test:contracts`.

## Browser and acceptance

`tests/int24-browser-qa.mjs` is the broad Browser QA owner. [FE-05 visual regression](../architecture/fe-05-visual-regression.md) checks **same-SHA** deterministic stability, not cross-commit approved golden files. [FE-03 profiler](../architecture/fe-03-frontend-performance.md) is optional Chromium lab instrumentation, not proof of live Production performance. Real iPhone Safari and assistive-tech acceptance remain UNKNOWN if not physically tested.

Use one task branch, grouped commits, one Draft/HOLD PR and exact-head verification; merge requires a separate explicit authorization and does not authorize deploy, secrets or remote D1. Preserve fail-closed public publication guard. For dated implementation context see [CI-FAST-01](../architecture/ci-fast-01.md), [CI-OPT-02](../ci-opt-02-workflow-ledger.md), [CI-OPT-04/05 plan](ci-opt-04-05-plan.md) and [technical report](ci-opt-04-05.md).
