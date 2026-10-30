# PLAYER-AUTH-01 — #15 local acceptance execution plan (30 October 2026)

Status: **OPEN / not accepted**. This document is an evidence-based audit and execution plan, **not a successful test-run report**.

## Latest focused acceptance evidence — 30 October 2026
- Exact HEAD `0a0fc2b3b8233a89b3d584861253b7eb89b8bcc2`: Admin World foundation checks **SUCCESS**, including local auth, **213/213 full Worker D1 tests**, operator persistence/restart and Chromium login/register layout and safe return. This supersedes the historical 71-failure baseline described below.
- Site checks and full Browser QA **SKIPPED intentionally** under Draft diagnostic conditions, **not passed** on that HEAD. WebKit and full exact-head acceptance remain open.
- A new isolated unified Admin regression exercises verified Player-to-legacy-operator email correspondence and link removal; test outcome must be confirmed on its own exact HEAD before claiming PASS.
- No live operator cutover, credentials, remote D1, outgoing email, deployment or merge. Owner sign-off for actual #10 cutover and delivery provider #12 remains required. Checklist **12/15 (80%)**.

## Exact-head starting point
- Baseline inspected: `fcdd1bcc01a37acbaac58bde4df7c6ad06bd98cd` (PR #329).
- Baseline GitHub CI: Site checks, Browser QA and Admin World foundation all SUCCESS on this commit.
- Existing account/Season 0 matrix and targeted Worker+D1 checks are documented in the PR description.
- Historical full `backend/npm test` evidence: 127 passed, 71 failed, 15 skipped against implementation, with the same 71 failing signatures on pristine prior baseline (123 passed, 71 failed, 15 skipped). **These are not a PASS** and should be rechecked on exact HEAD.
- Historical failing groups include Admin calendar, lifecycle, preparation, public sporting, reset world, season transition and persistence runtime suites.

## Observed migration mismatch
`backend/tests/admin-calendar-command-runtime.test.ts` still constructs `AdminSession`, inserts into `admin_sessions` and calls lower-level world commands with the retired identity. Its HTTP test correctly creates a Player identity, explicit `player_admin_operator_links`, permissions and Player session. This mixed fixture model must be audited across all 15 historical failing suites. Do not restore legacy password login as a shortcut. Keep historical audit foreign-key ownership intact.

## Local operator procedure (disposable D1 only)
From a clean checkout on the PR head, with pinned dependencies already installed:

```powershell
git fetch origin feat/player-auth-01-foundation
git switch feat/player-auth-01-foundation
git pull --ff-only
git rev-parse HEAD
git status --short
cd backend
npm run typecheck
npm run test:contracts
npm run test:auth-local
npm run test:operator
npm test
```

Record exact SHA, each exit code, counts of PASS/FAIL/SKIP and first failed assertion by file. Do not mark `npm test` PASS until 0 failures. If a fixture fails after the retired Admin login cutover, update it to provision a verified Player identity, **explicit** operator link and server-owned permissions with disposable local D1; retain race, audit, CSRF, revoke and rollback assertions. Avoid weakening production guards or deleting negative tests. Run affected suite first, then entire suite, followed by typecheck/contracts and exact-head CI.

## Acceptance evidence required before #15 is checked
1. D1 migrations in order and repeatability/rollback behavior; no production/remote D1 writes.
2. Token expiry, revoked sessions, credential version, multi-session revocation, login restore after Worker restart, CSRF/origin, anti-enumeration, one-time recovery and verification; delivery is injected/test-only.
3. Admin denial by default, explicit operator link, rights granted/revoked on each request, atomic mutation/replay, concurrency, stale revision, audit preservation and group cutover rollback. **Actual operator cutover remains #10 and requires separate approval**.
4. Full Worker runtime suite green, or each known failure explicitly classified with reproduced evidence and a separate acceptance decision; no blanket “pre-existing” waiver.
5. Real-browser/mobile, five locales and two themes, anonymous public routing, trailing-slash/canonical links, login return, profile and Season 0 navigation.
6. Check exact-head CI on the final commit; never transfer an old HEAD's green badge to a new commit.

## Hard boundaries
PR #329 stays **Draft/HOLD**. No merge, deployment, remote D1, real email, credentials, or live operator cutover. #12 remains blocked on separately approved outbound email delivery; #10 remains blocked on authorized live migration. Checklist **12/15 = 80%** until independent acceptance evidence exists.

## Draft-only full gate activation
The PR body includes `<!-- admin-world-final-verification -->` to opt into the pre-existing Admin World CI gates (full Worker Vitest, operator persistence and lifecycle browser) without changing workflow logic or remote resources. A new exact-head CI run must be inspected before any success claim. Any failed full suite remains a blocker for criterion #15.
