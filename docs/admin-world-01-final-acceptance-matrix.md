# ADMIN-WORLD-01 — final acceptance matrix (#315, PR #326)

Status: **verification plan, not a test PASS or release approval**. The issue checklist has 20/22 checked at the time of writing. Preserve Draft/HOLD; do not merge, deploy, provision remote D1, create operator credentials, or trigger manual workflows.

## Acceptance scope

The authoritative reference is the current PR head, never a prior green SHA. Confirm the branch is up to date with main and record exact source SHA, tree SHA, run IDs and conclusions *after* the final changes. The existing PR1 foundation was merged as PR #316; PR #326 contains subsequent lifecycle and console implementation.

### 1. Admin/public identity separation

- In two isolated browser contexts, sign in as the disposable local operator only in the Admin context. Anonymous visitors must read the shared public world without login, but must not access administrative reads or mutation commands.
- Check logout, expired/disabled sessions, missing or mismatched Origin/CSRF, stale generation/revision, duplicate submissions, destructive confirmation, and reset invalidation.
- Verify a held old-generation response cannot repopulate either Admin UI or public projections after reset.
- Run against a disposable local Worker/D1 instance; never use a remote or production database.

### 2. Layout, keyboard and locale matrix

| Dimension | Required acceptance |
| --- | --- |
| Languages | EN (default), DE, ES, FR, IT; Admin labels, errors and operation progress, public competition/season/history navigation |
| Appearance | Dark and Light |
| Desktop | Wide and intermediate browser widths; no clipped action or inaccessible explanation |
| Mobile | iPhone-sized widths, touch targets, no unexpected horizontal overflow |
| Keyboard | Tab/Shift+Tab, visible focus, Enter/Space activation, form submission, confirmation and calendar/season navigation |
| Accessibility | Accessible names, status/error announcement, focus retention/transfer after actions, correct disabled state, contrast and no keyboard trap |
| Authority | Both signed-in Admin and separate anonymous context; explicit selected historical season remains independent of the live season |

Inspect both successful and rejected commands, and busy/retry/empty states. Existing authored suites `tests/admin-world-lifecycle-browser.mjs`, `tests/season-two-navigation-browser.mjs` and `tests/admin-settings-browser.mjs` are inputs to this matrix, not proof until executed on the final source. Actual physical iPhone Safari QA, if requested, is distinct from emulated/mobile-browser checks and must be reported separately.

### 3. Sporting and persistence integrity

- On disposable D1, exercise Season 0 → prepared Season 1 → start/advance → day 56/close → archived Season 1 → prepared/active Season 2, then reset to Season 0 and prepare again.
- Assert both competition ownership and saved temporary-score-v1 results; do not invent player events. Reproduce draws and match outcomes by saved seed/version; do not recompute historical results on read.
- Check all 18 competitions, approved membership, 56-day calendar events vs match slots, administrative milestone rescheduling/dependencies, international cup holder/pot constraints, season-specific historical routes and immutable archives.
- Simulate concurrent commands, rollback/late failures, restart persistence and stale-response rejection.

### 4. Final execution and evidence capture

Run final **Node 22**, backend contracts/real Worker-D1, migrations, typecheck, operator/restart, generator parity, publication isolation and the relevant Site and Browser gates. Keep full, heavy runs in the final verification window only; do not launch them on each ordinary draft push. The Admin workflow requires the documented opt-in marker `<!-- admin-world-final-verification -->` for its final heavy gate. Validate exact-head consistency before treating any run as evidence.

For each suite capture: source SHA, run URL/ID, started/completed times, test counts, failures/retries/flakes, result and known limitations. A previously green run is historical evidence only. A failing check cannot be silently skipped or counted as PASS.

## Completion policy

Only mark issue #315 checklist item **21** when desktop/mobile/keyboard/accessibility/five-language and Admin/public checks have actually executed with recorded evidence. Only mark item **22** when setup, migrations, recovery and source-specific verification documentation are current *and* the required exact-head checks have passed. The two checkmarks are independent. Keep operational release gates (real HTTPS topology, real D1 provisioning, resource/throughput, credential-screening and production rollout) explicitly separate: green local CI is not authorization to deploy.

Related references: `docs/admin-world-01-operations.md`, `docs/superpowers/plans/2026-10-29-final-test-alignment.md`, `docs/superpowers/plans/2026-10-29-final-verification.md`.
