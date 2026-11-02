# PAGE-LOAD-01 A01–A02 implementation plan

> For agentic workers: use superpowers:executing-plans for inline execution.

Goal: ship final responsive standings structure at first paint and fill it without provisional values or hidden panels.
Architecture: keep generated HTML and shared runtime; emit capacity-sized blank desktop/mobile rows before scripts. Retain pending structure until a validated source commits; confirmed empty states remain distinct from loading.
Tech stack: existing HTML/CSS/JavaScript/Node generators, no new dependencies.
Spec: GitHub issue #338 (owner-approved 2026-11-02).

## Constraints and review focus
- PR #337 Draft/HOLD; no merge/deploy/remote D1/email; publication guard unchanged.
- A01 scoped to shared dependencies encountered by Competition Standings; later pages remain separate blocks.
- Do not expose provisional season membership during an unresolved request.
- Preserve the current responsive dimensions, static headers/logos, focus and loaded assets.
- Check cold/slow/failing source, Season 0, stale responses, source switches and mobile-before-JS.
- Browser QA is required before closing A02; report it UNKNOWN if no runnable browser is available.

## Task 1 — Generated structure and initial runtime
Files: tools/render-competition-page.mjs, generated competition pages, assets/competition-page.js, assets/app.css.
- [x] Add failing generator tests for blank 16/24-row desktop and mobile structures, with no fake participants, dashes or initial no-data state.
- [x] Emit both layouts, using existing classes and reserved crest space. CSS chooses the correct layout before scripts.
- [x] Keep these structures intact at runtime startup. Commit source data/confirmed empty state separately; signal aria-busy correctly and show a final failure message rather than a permanent blank page.
- [x] Regenerate and verify canonical parity.

## Task 2 — Remove DEV first-paint hiding and verify
Files: tools/dev-preview-artifact.mjs, tools/dev-standings-preview.mjs, tests, docs/ux-account-admin-02.md.
- [x] Add failing coverage for the actual loopback HTML response keeping standings visible while data is delayed.
- [x] Remove standings paint-suppression rules; keep unrelated page behavior scoped out.
- [x] Run focused generator/runtime/source-switch/publication tests, syntax and diff checks. Browser QA where available.
- [ ] Review and commit this block; update issue #338 with exact SHA, PASS/FAIL/UNKNOWN and next page. Do not close A02 while browser evidence is missing.

Execution note: implementation and focused automated verification complete; real browser QA remains pending because Chromium is unavailable. Issue #338 retains A02 open for that evidence.
