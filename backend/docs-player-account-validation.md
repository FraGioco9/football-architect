# Account app/profile validation — 30 October 2026

## Passing local checks
- Site Node/Chrome regression command: `CHROME_BIN=... node --test tests/*.test.mjs` — **748/748 PASS**, no skipped tests.
- Backend pure Node contracts — **70/70 PASS**; backend TypeScript — PASS.
- Python SQLite migration suite — **38/38 PASS**.
- Dedicated auth/registration/recovery/Admin migration Worker+D1 — **64/64 PASS**.
- Account page Chromium matrix — **34 cases PASS** (five locales, dark/light, 320/390/1440, preserved input, app handoff, one-time token handling, asynchronous recovery label and Unicode city validation).
- Unified Admin Settings Chromium — **31 cases PASS**.
- Safe-return Chromium — **22 assertions PASS**.
- Desktop login and mobile registration screenshots visually inspected. Browser binary: locally extracted Chromium 153; CI retains its pinned Playwright/Chromium setup.

## Full Worker regression remains red on the pre-existing branch
Running `npm test` against the implementation gives **127 passed, 71 failed, 15 skipped (213)** across 33 files. Running the exact same command against pristine pre-implementation HEAD `b5a29534be778956ad7afc7f5cbe62213eadb72e` gives **123 passed, 71 failed, 15 skipped (209)**. Failure signatures are identical; the four additional registration tests pass. The existing failures are dominated by fixtures calling retired legacy Admin sessions (`legacy_admin_session_retired`) and dependent setup/assertions. No bypass was introduced to make these pass.

Affected pre-existing suites:
- `tests/admin-calendar-automatic-runtime.test.ts`
- `tests/admin-calendar-bridge-runtime.test.ts`
- `tests/admin-calendar-clock-runtime.test.ts`
- `tests/admin-calendar-command-runtime.test.ts`
- `tests/admin-calendar-initialize-runtime.test.ts`
- `tests/admin-domestic-stage-runtime.test.ts`
- `tests/admin-end-season-transition-runtime.test.ts`
- `tests/calendar-command-runtime.test.ts`
- `tests/lifecycle-command-runtime.test.ts`
- `tests/prepare-runtime.test.ts`
- `tests/public-sporting-runtime.test.ts`
- `tests/reset-world-runtime.test.ts`
- `tests/season-two-activation-runtime.test.ts`
- `tests/season-two-authority-runtime.test.ts`
- `tests/season-two-persistence-runtime.test.ts`

This is not full #170 final acceptance or permission to close #15. Original checklist remains 12/15 (80%). Actual approved operator cutover and outbound provider acceptance are also still pending. No real outbound email, remote D1, merge or deployment occurred.

## Independent review and corrections
The independent reviewer identified an email-enumeration oracle when a taken username was combined with existing/nonexistent emails. A runtime regression failed with 202 vs 409 before the correction; username conflict precedence now yields the same response independently of email existence, including the concurrent insert-conflict path. Dedicated auth is green afterward.

The reviewer also identified a stale recovery-button label after a mid-request language change and UTF-16 city truncation inconsistent with 100 Unicode code points. Both were included in the correction pass because the approved plan explicitly requires correct busy-state translation and Unicode validation. Browser regressions reproduced both before their fixes; all 34 account cases pass afterward.

Implementation choices: work in an isolated clone of the already-approved feature branch; use an ASCII NOCASE unique index instead of duplicating a normalized username column (Unicode usernames would require revisiting that constraint); retain existing loopback IP/unconfigured preview-host fallbacks instead of inventing production host provisioning. Normal site/local account entry moves to app before account API calls. Production deployment and host-level configuration remain separately gated.
